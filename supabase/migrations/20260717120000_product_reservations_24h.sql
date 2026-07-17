-- Reveta: reservas temporales de producto durante 24 horas.

create table if not exists public.product_reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'converted')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  converted_at timestamptz
);

create unique index if not exists product_reservations_one_active_per_product_idx
  on public.product_reservations(product_id)
  where status = 'active';

create index if not exists product_reservations_buyer_idx
  on public.product_reservations(buyer_id, created_at desc);

create index if not exists product_reservations_seller_idx
  on public.product_reservations(seller_id, created_at desc);

create index if not exists product_reservations_expiry_idx
  on public.product_reservations(expires_at)
  where status = 'active';

alter table public.product_reservations enable row level security;
alter table public.product_reservations force row level security;

revoke all on public.product_reservations from anon;
revoke insert, update, delete on public.product_reservations from authenticated;
grant select on public.product_reservations to authenticated;

create policy "Participants can read product reservations"
  on public.product_reservations
  for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create or replace function public.release_expired_product_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer := 0;
  reservation_record record;
begin
  for reservation_record in
    select id, product_id
    from public.product_reservations
    where status = 'active'
      and expires_at <= now()
    for update skip locked
  loop
    update public.product_reservations
    set status = 'expired', updated_at = now()
    where id = reservation_record.id
      and status = 'active';

    if found then
      released_count := released_count + 1;

      if not exists (
        select 1
        from public.transactions
        where product_id = reservation_record.product_id
          and status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review')
      ) then
        update public.products
        set status = 'active', updated_at = now()
        where id = reservation_record.product_id
          and status = 'reserved';
      end if;
    end if;
  end loop;

  return released_count;
end;
$$;

revoke all on function public.release_expired_product_reservations() from public;
grant execute on function public.release_expired_product_reservations() to authenticated;

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

  return reservation_record;
end;
$$;

revoke all on function public.reserve_product_for_24h(uuid) from public;
grant execute on function public.reserve_product_for_24h(uuid) to authenticated;

create or replace function public.cancel_product_reservation(target_reservation_id uuid)
returns public.product_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  reservation_record public.product_reservations%rowtype;
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

  update public.product_reservations
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = reservation_record.id
  returning * into reservation_record;

  if not exists (
    select 1
    from public.transactions
    where product_id = reservation_record.product_id
      and status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review')
  ) then
    update public.products
    set status = 'active', updated_at = now()
    where id = reservation_record.product_id
      and status = 'reserved';
  end if;

  return reservation_record;
end;
$$;

revoke all on function public.cancel_product_reservation(uuid) from public;
grant execute on function public.cancel_product_reservation(uuid) to authenticated;
