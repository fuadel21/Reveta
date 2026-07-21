begin;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "admins read all safety reports" on public.safety_reports;
create policy "admins read all safety reports"
on public.safety_reports
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "admins update safety reports" on public.safety_reports;
create policy "admins update safety reports"
on public.safety_reports
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "admins read user blocks" on public.user_blocks;
create policy "admins read user blocks"
on public.user_blocks
for select
to authenticated
using (public.current_user_is_admin());

commit;
