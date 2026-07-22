begin;

create table if not exists public.ai_listing_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'groq',
  action text not null default 'analyze',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_listing_usage_user_created_idx
  on public.ai_listing_usage (user_id, created_at desc);

alter table public.ai_listing_usage enable row level security;

drop policy if exists "users read own ai listing usage" on public.ai_listing_usage;
create policy "users read own ai listing usage"
on public.ai_listing_usage
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.claim_ai_listing_usage(
  p_daily_limit integer default 5,
  p_cooldown_seconds integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
  v_reset_at timestamptz := (date_trunc('day', now() at time zone 'Europe/Madrid') + interval '1 day') at time zone 'Europe/Madrid';
  v_used integer;
  v_last_used timestamptz;
  v_usage_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select count(*), max(created_at)
  into v_used, v_last_used
  from public.ai_listing_usage
  where user_id = v_user_id
    and created_at >= v_today_start;

  if v_last_used is not null and v_last_used > now() - make_interval(secs => greatest(5, p_cooldown_seconds)) then
    return jsonb_build_object(
      'ok', false,
      'code', 'COOLDOWN',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from ((v_last_used + make_interval(secs => greatest(5, p_cooldown_seconds))) - now())))::integer),
      'remaining', greatest(0, p_daily_limit - v_used),
      'reset_at', v_reset_at
    );
  end if;

  if v_used >= greatest(1, p_daily_limit) then
    return jsonb_build_object(
      'ok', false,
      'code', 'DAILY_LIMIT',
      'remaining', 0,
      'reset_at', v_reset_at
    );
  end if;

  insert into public.ai_listing_usage (user_id, provider, action, status)
  values (v_user_id, 'groq', 'analyze', 'pending')
  returning id into v_usage_id;

  return jsonb_build_object(
    'ok', true,
    'usage_id', v_usage_id,
    'remaining', greatest(0, p_daily_limit - v_used - 1),
    'reset_at', v_reset_at
  );
end;
$$;

revoke all on function public.claim_ai_listing_usage(integer, integer) from public;
grant execute on function public.claim_ai_listing_usage(integer, integer) to authenticated;

commit;
