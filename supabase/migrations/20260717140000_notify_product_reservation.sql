-- Reveta: avisar al vendedor y registrar en chat las reservas temporales de 24 horas.

create or replace function public.reserve_product_for_24h(target_product_id uuid)
returns public.product_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  product_record public.products%rowtype;
  reservation_record public.product_reservations%rowtype;
  v_conversation_id uuid;
  buyer_name text;
  expiry_label text;
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión para reservar.' using errcode = '42501';
  end if;

  perform public.release_expired_product_reservations();

  select *
  into product_record
  from public.products
  where id = target_product_id
  for update;

  if not found then
    raise exception 'Producto no encontrado.' using errcode = 'P0002';
  end if;

  if product_record.user_id = current_user_id then
    raise exception 'No puedes reservar tu propio producto.' using errcode = '22023';
  end if;

  if product_record.status <> 'active' then
    raise exception 'Este producto ya no está disponible para reservar.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.transactions
    where product_id = target_product_id
      and status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review')
  ) then
    raise exception 'Este producto ya tiene una compra o reserva abierta.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.product_reservations
    where product_id = target_product_id
      and status = 'active'
      and expires_at > now()
  ) then
    raise exception 'Este producto ya está reservado temporalmente.' using errcode = '23505';
  end if;

  insert into public.product_reservations (
    product_id,
    buyer_id,
    seller_id,
    status,
    expires_at
  ) values (
    target_product_id,
    current_user_id,
    product_record.user_id,
    'active',
    now() + interval '24 hours'
  )
  returning * into reservation_record;

  update public.products
  set status = 'reserved', updated_at = now()
  where id = target_product_id
    and status = 'active';

  if not found then
    raise exception 'El producto acaba de dejar de estar disponible.' using errcode = '40001';
  end if;

  -- Los avisos son best-effort: nunca deben invalidar una reserva ya creada.
  begin
    select coalesce(nullif(trim(full_name), ''), nullif(trim(username), ''), 'Un comprador')
    into buyer_name
    from public.profiles
    where id = current_user_id;

    buyer_name := coalesce(buyer_name, 'Un comprador');
    expiry_label := to_char(reservation_record.expires_at at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI');

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      data,
      read
    ) values (
      product_record.user_id,
      'product_reserved_24h',
      'Producto reservado durante 24 horas',
      buyer_name || ' ha reservado “' || product_record.title || '” hasta ' || expiry_label || '.',
      jsonb_build_object(
        'reservation_id', reservation_record.id,
        'product_id', product_record.id,
        'buyer_id', current_user_id,
        'expires_at', reservation_record.expires_at,
        'url', '/product/' || product_record.id
      ),
      false
    );
  exception when others then
    raise warning 'No se pudo crear la notificación de reserva %: %', reservation_record.id, sqlerrm;
  end;

  begin
    select c.id
    into v_conversation_id
    from public.conversations c
    where c.product_id = product_record.id
      and c.buyer_id = current_user_id
      and c.seller_id = product_record.user_id
    order by c.created_at asc
    limit 1;

    if v_conversation_id is null then
      insert into public.conversations (product_id, buyer_id, seller_id)
      values (product_record.id, current_user_id, product_record.user_id)
      returning id into v_conversation_id;
    end if;

    if not exists (
      select 1
      from public.messages m
      where m.conversation_id = v_conversation_id
        and m.sender_id = current_user_id
        and m.content like '📅 Reserva 24h confirmada%'
        and m.created_at >= reservation_record.created_at - interval '1 minute'
    ) then
      insert into public.messages (conversation_id, sender_id, content)
      values (
        v_conversation_id,
        current_user_id,
        '📅 Reserva 24h confirmada' || E'\n\n' ||
        'He reservado “' || product_record.title || '” hasta ' || expiry_label || '. ' ||
        'Podemos coordinar aquí el pago o la entrega antes de que venza la reserva.'
      );
    end if;

    update public.conversations c
    set updated_at = now()
    where c.id = v_conversation_id;
  exception when others then
    raise warning 'No se pudo registrar el mensaje de reserva %: %', reservation_record.id, sqlerrm;
  end;

  return reservation_record;
end;
$$;

revoke all on function public.reserve_product_for_24h(uuid) from public;
grant execute on function public.reserve_product_for_24h(uuid) to authenticated;
