begin;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

create policy "users manage their own blocks"
on public.user_blocks
for all
to authenticated
using (blocker_id = auth.uid())
with check (blocker_id = auth.uid());

create table if not exists public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 120),
  details text check (details is null or char_length(details) <= 1000),
  source text not null default 'unknown' check (source in ('public_profile','product','chat','transaction','unknown')),
  status text not null default 'open' check (status in ('open','under_review','resolved','dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safety_reports_not_self check (reported_user_id is null or reporter_id <> reported_user_id)
);

create index if not exists safety_reports_reporter_idx on public.safety_reports(reporter_id, created_at desc);
create index if not exists safety_reports_status_idx on public.safety_reports(status, created_at desc);
create index if not exists safety_reports_reported_user_idx on public.safety_reports(reported_user_id, created_at desc);

alter table public.safety_reports enable row level security;

create policy "users create safety reports"
on public.safety_reports
for insert
to authenticated
with check (reporter_id = auth.uid());

create policy "users read their own safety reports"
on public.safety_reports
for select
to authenticated
using (reporter_id = auth.uid());

create or replace function public.users_are_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_id = p_user_a and blocked_id = p_user_b)
       or (blocker_id = p_user_b and blocked_id = p_user_a)
  );
$$;

revoke all on function public.users_are_blocked(uuid, uuid) from public;
grant execute on function public.users_are_blocked(uuid, uuid) to authenticated;

create or replace function public.prevent_blocked_marketplace_interaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_a uuid;
  v_user_b uuid;
begin
  if tg_table_name = 'conversations' then
    v_user_a := new.buyer_id;
    v_user_b := new.seller_id;
  elsif tg_table_name = 'offers' then
    v_user_a := new.buyer_id;
    v_user_b := new.seller_id;
  elsif tg_table_name = 'messages' then
    select buyer_id, seller_id
      into v_user_a, v_user_b
    from public.conversations
    where id = new.conversation_id;
  else
    return new;
  end if;

  if v_user_a is not null and v_user_b is not null and public.users_are_blocked(v_user_a, v_user_b) then
    raise exception using
      errcode = '42501',
      message = 'BLOCKED_MARKETPLACE_INTERACTION';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_blocked_conversation_insert on public.conversations;
create trigger prevent_blocked_conversation_insert
before insert on public.conversations
for each row execute function public.prevent_blocked_marketplace_interaction();

drop trigger if exists prevent_blocked_offer_insert on public.offers;
create trigger prevent_blocked_offer_insert
before insert on public.offers
for each row execute function public.prevent_blocked_marketplace_interaction();

drop trigger if exists prevent_blocked_message_insert on public.messages;
create trigger prevent_blocked_message_insert
before insert on public.messages
for each row execute function public.prevent_blocked_marketplace_interaction();

create or replace function public.touch_safety_report_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_safety_reports_updated_at on public.safety_reports;
create trigger touch_safety_reports_updated_at
before update on public.safety_reports
for each row execute function public.touch_safety_report_updated_at();

commit;
