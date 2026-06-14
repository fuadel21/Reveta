grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;

drop policy if exists "admins can view all conversations" on public.conversations;
drop policy if exists "admins can view all messages" on public.messages;

create policy "admins can view all conversations"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  )
);

create policy "admins can view all messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  )
);
