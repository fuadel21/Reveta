-- Reveta: notificaciones y mensajes de chat cuando una reserva de 24h se cancela o caduca.

create or replace function public.cancel_product_reservation(target_reservation_id uuid)
returns public.product_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  reservation_record public.product_reservations%rowtype;
  product_record public.products%rowtype;
  v_conversation_id uuid;
  cancellation_actor text;
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  select *
  into reservation_record
  from public.product_reservations
  where id = target_reservation_id
  for update;

  if not found then
    raise exception 'Reserva no encontrada.' using errcode = 'P0002';
  end if;

  if current_user_id <> reservation_record.buyer_id
     and current_user_id <> reservation_record.seller_id then
    raise exception 'No puedes cancelar esta reserva.' using errcode = '42501';
  end if;

  if reservation_record.status <> 'active' then
    return reservation_record;
  end if;

  select *
  into product_record
  from public.products
  where id = reservation_record.product_id;

  update public.product_reservations
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = reservation_record.id
    and status = 'active'
  returning * into reservation_record;

  if not exists (
    select 1
    from public.transactions t
    where t.product_id = reservation_record.product_id
      and t.status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review')
  ) then
    update public.products
    set status = 'active', updated_at = now()
    where id = reservation_record.product_id
      and status = 'reserved';
  end if;

  cancellation_actor := case
    when current_user_id = reservation_record.buyer_id then 'El comprador'
    else 'El vendedor'
  end;

  begin
    insert into public.notifications (user_id, type, title, message, data, read)
    values
      (
        reservation_record.buyer_id,
        'product_reservation_cancelled',
        'Reserva cancelada',
        cancellation_actor || ' ha cancelado la reserva de “' || coalesce(product_record.title, 'producto') || '”.',
        jsonb_build_object(
          'reservation_id', reservation_record.id,
          'product_id', reservation_record.product_id,
          'cancelled_by', current_user_id,
          'url', '/product/' || reservation_record.product_id
        ),
        false
      ),
      (
        reservation_record.seller_id,
        'product_reservation_cancelled',
        'Reserva cancelada',
        cancellation_actor || ' ha cancelado la reserva de “' || coalesce(product_record.title, 'producto') || '”.',
        jsonb_build_object(
          'reservation_id', reservation_record.id,
          'product_id', reservation_record.product_id,
          'cancelled_by', current_user_id,
          'url', '/product/' || reservation_record.product_id
        ),
        false
      );
  exception when others then
    raise warning 'No se pudieron crear las notificaciones de cancelación %: %', reservation_record.id, sqlerrm;
  end;

  begin
    select c.id
    into v_conversation_id
    from public.conversations c
    where c.product_id = reservation_record.product_id
      and c.buyer_id = reservation_record.buyer_id
      and c.seller_id = reservation_record.seller_id
    order by c.created_at asc
    limit 1;

    if v_conversation_id is not null
       and not exists (
         select 1
         from public.messages m
         where m.conversation_id = v_conversation_id
           and m.content like '❌ Reserva 24h cancelada%'
           and m.created_at >= reservation_record.updated_at - interval '1 minute'
       ) then
      insert into public.messages (conversation_id, sender_id, content)
      values (
        v_conversation_id,
        current_user_id,
        '❌ Reserva 24h cancelada' || E'\n\n' ||
        cancellation_actor || ' ha cancelado la reserva de “' || coalesce(product_record.title, 'producto') || '”. ' ||
        'El producto vuelve a estar disponible si no existe ninguna compra abierta.'
      );

      update public.conversations
      set updated_at = now()
      where id = v_conversation_id;
    end if;
  exception when others then
    raise warning 'No se pudo registrar el mensaje de cancelación %: %', reservation_record.id, sqlerrm;
  end;

  return reservation_record;
end;
$$;

revoke all on function public.cancel_product_reservation(uuid) from public;
grant execute on function public.cancel_product_reservation(uuid) to authenticated;

create or replace function public.release_expired_product_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer := 0;
  reservation_record public.product_reservations%rowtype;
  product_record public.products%rowtype;
  v_conversation_id uuid;
begin
  for reservation_record in
    select pr.*
    from public.product_reservations pr
    where pr.status = 'active'
      and pr.expires_at <= now()
    for update skip locked
  loop
    select *
    into product_record
    from public.products
    where id = reservation_record.product_id;

    update public.product_reservations
    set status = 'expired', updated_at = now()
    where id = reservation_record.id
      and status = 'active';

    if found then
      released_count := released_count + 1;

      if not exists (
        select 1
        from public.transactions t
        where t.product_id = reservation_record.product_id
          and t.status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review')
      ) then
        update public.products
        set status = 'active', updated_at = now()
        where id = reservation_record.product_id
          and status = 'reserved';
      end if;

      begin
        insert into public.notifications (user_id, type, title, message, data, read)
        values
          (
            reservation_record.buyer_id,
            'product_reservation_expired',
            'Tu reserva ha caducado',
            'La reserva de “' || coalesce(product_record.title, 'producto') || '” ha terminado.',
            jsonb_build_object(
              'reservation_id', reservation_record.id,
              'product_id', reservation_record.product_id,
              'url', '/product/' || reservation_record.product_id
            ),
            false
          ),
          (
            reservation_record.seller_id,
            'product_reservation_expired',
            'Reserva caducada',
            'La reserva de “' || coalesce(product_record.title, 'producto') || '” ha terminado y el producto vuelve a estar disponible si no existe una compra abierta.',
            jsonb_build_object(
              'reservation_id', reservation_record.id,
              'product_id', reservation_record.product_id,
              'url', '/product/' || reservation_record.product_id
            ),
            false
          );
      exception when others then
        raise warning 'No se pudieron crear las notificaciones de caducidad %: %', reservation_record.id, sqlerrm;
      end;

      begin
        select c.id
        into v_conversation_id
        from public.conversations c
        where c.product_id = reservation_record.product_id
          and c.buyer_id = reservation_record.buyer_id
          and c.seller_id = reservation_record.seller_id
        order by c.created_at asc
        limit 1;

        if v_conversation_id is not null
           and not exists (
             select 1
             from public.messages m
             where m.conversation_id = v_conversation_id
               and m.content like '⌛ Reserva 24h caducada%'
               and m.created_at >= reservation_record.expires_at - interval '1 minute'
           ) then
          insert into public.messages (conversation_id, sender_id, content)
          values (
            v_conversation_id,
            reservation_record.buyer_id,
            '⌛ Reserva 24h caducada' || E'\n\n' ||
            'La reserva de “' || coalesce(product_record.title, 'producto') || '” ha terminado. ' ||
            'El producto vuelve a estar disponible si no existe ninguna compra abierta.'
          );

          update public.conversations
          set updated_at = now()
          where id = v_conversation_id;
        end if;
      exception when others then
        raise warning 'No se pudo registrar el mensaje de caducidad %: %', reservation_record.id, sqlerrm;
      end;
    end if;
  end loop;

  return released_count;
end;
$$;

revoke all on function public.release_expired_product_reservations() from public;
grant execute on function public.release_expired_product_reservations() to authenticated;
