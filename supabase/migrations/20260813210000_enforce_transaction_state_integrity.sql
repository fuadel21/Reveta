begin;

create or replace function public.enforce_transaction_state_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_is_buyer boolean := false;
  v_is_seller boolean := false;
  v_allowed boolean := false;
begin
  if v_actor is null then
    -- Trusted backend/webhook/service-role updates are allowed to proceed.
    return new;
  end if;

  v_is_buyer := v_actor = new.buyer_id;
  v_is_seller := v_actor = new.seller_id;

  if not v_is_buyer and not v_is_seller then
    raise exception using
      errcode = '42501',
      message = 'TRANSACTION_PARTICIPANT_REQUIRED';
  end if;

  if tg_op = 'UPDATE' then
    if new.product_id is distinct from old.product_id
       or new.buyer_id is distinct from old.buyer_id
       or new.seller_id is distinct from old.seller_id
       or new.amount is distinct from old.amount then
      raise exception using
        errcode = '42501',
        message = 'TRANSACTION_CORE_FIELDS_IMMUTABLE';
    end if;

    if new.status is distinct from old.status then
      if new.status = 'cancelled' then
        v_allowed := v_is_buyer
          and old.status in ('pending', 'pending_payment');
      elsif new.status = 'paid' then
        v_allowed := v_is_seller
          and old.status = 'pending';
      elsif new.status = 'shipped' then
        v_allowed := v_is_seller
          and old.status = 'paid';
      elsif new.status = 'completed' then
        v_allowed := v_is_buyer
          and old.status in ('paid', 'shipped');
      elsif new.status = 'disputed' then
        v_allowed := (v_is_buyer or v_is_seller)
          and old.status in ('pending', 'pending_payment', 'paid', 'shipped');
      elsif new.status = old.status then
        v_allowed := true;
      end if;

      if not v_allowed then
        raise exception using
          errcode = '42501',
          message = 'INVALID_TRANSACTION_STATE_TRANSITION';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_transaction_state_integrity() from public;

drop trigger if exists enforce_transaction_state_integrity on public.transactions;

create trigger enforce_transaction_state_integrity
before update on public.transactions
for each row
execute function public.enforce_transaction_state_integrity();

comment on function public.enforce_transaction_state_integrity() is
  'Prevents buyers/sellers from changing transaction ownership, amount, or status outside the allowed lifecycle. Trusted backend updates remain supported.';

commit;
