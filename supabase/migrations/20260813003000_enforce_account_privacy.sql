begin;

create or replace function public.enforce_conversation_message_privacy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope text := 'everyone';
  v_buyer_verified boolean := false;
begin
  if new.buyer_id is null or new.seller_id is null then
    raise exception using
      errcode = '22023',
      message = 'INVALID_CONVERSATION_PARTICIPANTS';
  end if;

  if new.buyer_id = new.seller_id then
    raise exception using
      errcode = '22023',
      message = 'SELF_CONVERSATION_NOT_ALLOWED';
  end if;

  select coalesce(nullif(us.allow_messages_from, ''), 'everyone')
  into v_scope
  from public.user_settings us
  where us.user_id = new.seller_id;

  v_scope := coalesce(v_scope, 'everyone');

  if v_scope = 'none' then
    raise exception using
      errcode = '42501',
      message = 'MESSAGE_PRIVACY_BLOCKED';
  end if;

  if v_scope = 'verified' then
    select coalesce(p.verified, false)
    into v_buyer_verified
    from public.profiles p
    where p.id = new.buyer_id;

    if not coalesce(v_buyer_verified, false) then
      raise exception using
        errcode = '42501',
        message = 'MESSAGE_VERIFICATION_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_conversation_message_privacy() from public;

drop trigger if exists enforce_conversation_message_privacy on public.conversations;
create trigger enforce_conversation_message_privacy
before insert on public.conversations
for each row execute function public.enforce_conversation_message_privacy();

comment on function public.enforce_conversation_message_privacy() is
  'Enforces the seller allow_messages_from preference when a new conversation is created.';

commit;
