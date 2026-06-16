drop policy if exists "admins can read search analytics" on public.search_analytics;

create policy "admins can read search analytics"
on public.search_analytics
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);
