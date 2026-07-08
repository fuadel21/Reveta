-- Reveta offer acceptance hardening
-- Adds missing offer metadata and an atomic accept_offer RPC to prevent duplicate reservations.

alter table if exists public.offers
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz default now();

-- Default creator from the authenticated user so existing frontend inserts keep working with RLS.
alter table if exists public.offers
  alter column created_by set default auth.uid();

alter table if exists public.transactions
  add column if not exists offer_id uuid references public.offers(id) on delete set null;

create index if not exists offers_created_by_idx on public.offers (created_by);
create index if not exists transactions_offer_id_idx on public.transactions (offer_id);

create unique index if not exists transactions_offer_id_unique_idx
on public.transactions (offer_id)
where offer_id is not null;

-- Backfill older offers: if created_by is missing, treat the buyer as the original offer creator.
update public.offers
set created_by = buyer_id
where created_by is null;

create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_transaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para aceptar una oferta.' using errcode = '28000';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'La oferta no existe.' using errcode = 'P0002';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'Esta oferta ya no está pendiente.' using errcode = '23514';
  end if;

  if v_offer.created_by = auth.uid() then
    raise exception 'No puedes aceptar tu propia oferta.' using errcode = '42501';
  end if;

  if auth.uid() not in (v_offer.buyer_id, v_offer.seller_id) then
    raise exception 'No tienes permiso para aceptar esta oferta.' using errcode = '42501';
  end if;

  update public.products
  set status = 'reserved', updated_at = now()
  where id = v_offer.product_id
    and status = 'active';

  if not found then
    raise exception 'No se pudo reservar el producto porque ya no está activo.' using errcode = '23514';
  end if;

  insert into public.transactions (
    product_id,
    buyer_id,
    seller_id,
    amount,
    status,
    offer_id,
    created_at,
    updated_at
  ) values (
    v_offer.product_id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.amount,
    'pending',
    v_offer.id,
    now(),
    now()
  )
  returning id into v_transaction_id;

  update public.offers
  set status = 'accepted', updated_at = now()
  where id = v_offer.id;

  update public.offers
  set status = 'rejected', updated_at = now()
  where product_id = v_offer.product_id
    and status = 'pending'
    and id <> v_offer.id;

  return v_transaction_id;
end;
$$;

grant execute on function public.accept_offer(uuid) to authenticated;

-- Refresh RLS policies with created_by support.
alter table if exists public.offers enable row level security;

drop policy if exists "offers_select_parties_or_admin" on public.offers;
create policy "offers_select_parties_or_admin"
on public.offers
for select
to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or created_by = auth.uid()
  or public.is_admin()
);

drop policy if exists "offers_insert_buyer" on public.offers;
create policy "offers_insert_buyer"
on public.offers
for insert
to authenticated
with check (
  created_by = auth.uid()
  and buyer_id <> seller_id
  and auth.uid() in (buyer_id, seller_id)
);

drop policy if exists "offers_update_parties_or_admin" on public.offers;
create policy "offers_update_parties_or_admin"
on public.offers
for update
to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or created_by = auth.uid()
  or public.is_admin()
)
with check (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
  or created_by = auth.uid()
  or public.is_admin()
);
