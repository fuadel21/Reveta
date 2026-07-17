-- Reveta: permitir que el titular de una Reserva 24h continúe al checkout
-- sin exponer el producto a compras de otros usuarios.

create or replace function public.guard_transaction_against_active_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_record public.product_reservations%rowtype;
begin
  select *
  into reservation_record
  from public.product_reservations
  where product_id = new.product_id
    and status = 'active'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found and reservation_record.buyer_id <> new.buyer_id then
    raise exception 'Este producto está reservado temporalmente para otro comprador.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_transaction_against_active_reservation() from public;

drop trigger if exists transactions_guard_active_reservation on public.transactions;
create trigger transactions_guard_active_reservation
before insert or update of product_id, buyer_id, status
on public.transactions
for each row
when (new.status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review'))
execute function public.guard_transaction_against_active_reservation();

create or replace function public.keep_reserved_product_checkout_accessible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'reserved'
     and exists (
       select 1
       from public.product_reservations
       where product_id = new.id
         and status = 'active'
         and expires_at > now()
     )
     and not exists (
       select 1
       from public.transactions
       where product_id = new.id
         and status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review')
     ) then
    update public.products
    set status = 'active', updated_at = now()
    where id = new.id
      and status = 'reserved';
  end if;

  return new;
end;
$$;

revoke all on function public.keep_reserved_product_checkout_accessible() from public;

drop trigger if exists products_keep_reservation_checkout_accessible on public.products;
create trigger products_keep_reservation_checkout_accessible
after update of status
on public.products
for each row
when (new.status = 'reserved')
execute function public.keep_reserved_product_checkout_accessible();

-- Corrige reservas activas creadas antes de esta migración.
update public.products p
set status = 'active', updated_at = now()
where p.status = 'reserved'
  and exists (
    select 1
    from public.product_reservations r
    where r.product_id = p.id
      and r.status = 'active'
      and r.expires_at > now()
  )
  and not exists (
    select 1
    from public.transactions t
    where t.product_id = p.id
      and t.status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review')
  );
