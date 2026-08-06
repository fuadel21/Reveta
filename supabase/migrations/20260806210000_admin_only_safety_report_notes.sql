begin;

create or replace function public.current_user_is_reveta_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role::text = 'admin'
  );
$$;

revoke all on function public.current_user_is_reveta_admin() from public;
grant execute on function public.current_user_is_reveta_admin() to authenticated;

create table if not exists public.safety_report_admin_notes (
  report_id uuid primary key references public.safety_reports(id) on delete cascade,
  notes text not null check (char_length(notes) between 1 and 2000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.safety_report_admin_notes enable row level security;

drop policy if exists "admins manage safety report notes" on public.safety_report_admin_notes;
create policy "admins manage safety report notes"
on public.safety_report_admin_notes
for all
to authenticated
using (public.current_user_is_reveta_admin())
with check (public.current_user_is_reveta_admin());

grant select, insert, update, delete on public.safety_report_admin_notes to authenticated;

insert into public.safety_report_admin_notes (
  report_id,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  id,
  left(btrim(resolution_notes), 2000),
  reviewed_by,
  reviewed_by,
  coalesce(reviewed_at, updated_at, created_at, now()),
  coalesce(reviewed_at, updated_at, now())
from public.safety_reports
where nullif(btrim(resolution_notes), '') is not null
on conflict (report_id) do update
set notes = excluded.notes,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

alter table public.safety_reports
  drop column if exists resolution_notes;

create or replace function public.admin_update_safety_report(
  p_report_id uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_notes text := nullif(btrim(left(coalesce(p_notes, ''), 2000)), '');
begin
  if v_actor is null or not public.current_user_is_reveta_admin() then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_REQUIRED';
  end if;

  if p_status not in ('open', 'under_review', 'resolved', 'dismissed') then
    raise exception using
      errcode = '22023',
      message = 'INVALID_SAFETY_REPORT_STATUS';
  end if;

  update public.safety_reports
  set status = p_status,
      reviewed_by = v_actor,
      reviewed_at = now()
  where id = p_report_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SAFETY_REPORT_NOT_FOUND';
  end if;

  if v_notes is null then
    delete from public.safety_report_admin_notes
    where report_id = p_report_id;
  else
    insert into public.safety_report_admin_notes (
      report_id,
      notes,
      created_by,
      updated_by
    ) values (
      p_report_id,
      v_notes,
      v_actor,
      v_actor
    )
    on conflict (report_id) do update
    set notes = excluded.notes,
        updated_by = v_actor,
        updated_at = now();
  end if;
end;
$$;

revoke all on function public.admin_update_safety_report(uuid, text, text) from public;
grant execute on function public.admin_update_safety_report(uuid, text, text) to authenticated;

comment on table public.safety_report_admin_notes is
  'Internal moderation notes. Rows are accessible only to authenticated administrators through RLS.';
comment on function public.admin_update_safety_report(uuid, text, text) is
  'Atomically updates a safety report status and its admin-only moderation note.';

commit;
