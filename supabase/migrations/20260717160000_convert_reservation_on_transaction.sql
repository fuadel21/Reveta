-- Reveta: convertir una reserva temporal cuando el mismo comprador inicia una compra válida.

create or replace function public.convert_product_reservation_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  converted_reservation public.product_reservations%rowtype;
  target_conversation_id uuid;
begin
  -- pending_payment todavía puede fallar en cliente; la reserva se conserva hasta
  -- que exista una transacción operativa real o el webhook confirme el pago.
  if new.status not in ('pending', 'paid', 'shipped', 'completed', 'disputed', 'under_review') then
    return new;
  end if;

  update public.product_reservations
  set
    status = 'converted',
    converted_at = coalesce(converted_at, now()),
    updated_at = now()
  where product_id = new.product_id
    and buyer_id = new.buyer_id
    and seller_id = new.seller_id
    and status = 'active'
    and expires_at > now()
  returning * into converted_reservation;

  if converted_reservation.id is null then
    return new;
  end if;

  -- Avisos y chat son best-effort. Nunca deben bloquear una compra válida.
  begin
    insert into public.notifications (user_id, type, title, message, data, read)
    values
      (
        new.buyer_id,
        'product_reservation_converted',
        'Reserva convertida en compra',
        'Tu reserva de 24 horas se ha convertido en una operación de compra.',
        jsonb_build_object(
          'reservation_id', converted_reservation.id,
          'transaction_id', new.id,
          'product_id', new.product_id,
          'url', '/transactions'
        ),
        false
      ),
      (
        new.seller_id,
        'product_reservation_converted',
        'Reserva convertida en compra',
        'La reserva de 24 horas de tu producto se ha convertido en una operación de compra.',
        jsonb_build_object(
          'reservation_id', converted_reservation.id,
          'transaction_id', new.id,
          'product_id', new.product_id,
          'url', '/transactions'
        ),
        false
      );
  exception when others then
    raise warning 'No se pudo notificar la conversión de reserva %: %', converted_reservation.id, sqlerrm;
  end;

  begin
    select c.id
    into target_conversation_id
    from public.conversations c
    where c.product_id = new.product_id
      and c.buyer_id = new.buyer_id
      and c.seller_id = new.seller_id
    order by c.created_at asc
    limit 1;

    if target_conversation_id is null then
      insert into public.conversations (product_id, buyer_id, seller_id)
      values (new.product_id, new.buyer_id, new.seller_id)
      returning id into target_conversation_id;
    end if;

    if not exists (
      select 1
      from public.messages m
      where m.conversation_id = target_conversation_id
        and m.content like '✅ Reserva 24h convertida en compra%'
        and m.created_at >= now() - interval '5 minutes'
    ) then
      insert into public.messages (conversation_id, sender_id, content)
      values (
        target_conversation_id,
        new.buyer_id,
        '✅ Reserva 24h convertida en compra' || E'\n\n' ||
        'La reserva temporal ya está vinculada a la operación. Podemos seguir aquí el pago, la entrega y cualquier detalle.'
      );
    end if;

    update public.conversations
    set updated_at = now()
    where id = target_conversation_id;
  exception when others then
    raise warning 'No se pudo registrar el mensaje de conversión de reserva %: %', converted_reservation.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.convert_product_reservation_on_transaction() from public;

-- Un único trigger cubre inserciones y cambios posteriores de estado.
drop trigger if exists convert_product_reservation_after_transaction on public.transactions;

create trigger convert_product_reservation_after_transaction
after insert or update of status on public.transactions
for each row
execute function public.convert_product_reservation_on_transaction();
