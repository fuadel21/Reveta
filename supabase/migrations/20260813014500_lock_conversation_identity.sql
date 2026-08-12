begin;

create or replace function public.guard_conversation_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean := false;
begin
  if new.buyer_id is not distinct from old.buyer_id
     and new.seller_id is not distinct from old.seller_id
     and new.product_id is not distinct from old.product_id then
    return new;
  end if;

  -- Trusted backend/database maintenance has no authenticated end-user id.
  if v_actor is null then
    return new;
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role::text = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception using
      errcode = '42501',
      message = 'CONVERSATION_IDENTITY_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_conversation_identity() from public;

drop trigger if exists guard_conversation_identity on public.conversations;
create trigger guard_conversation_identity
before update of buyer_id, seller_id, product_id
on public.conversations
for each row
execute function public.guard_conversation_identity();

comment on function public.guard_conversation_identity() is
  'Prevents authenticated non-admin participants from changing buyer, seller, or product on an existing conversation.';

commit;
