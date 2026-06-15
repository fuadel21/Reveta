create extension if not exists pgcrypto;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'countered', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

alter table public.offers enable row level security;

grant select, insert, update on public.offers to authenticated;

create index if not exists offers_product_id_idx on public.offers(product_id);
create index if not exists offers_conversation_id_idx on public.offers(conversation_id);
create index if not exists offers_buyer_id_idx on public.offers(buyer_id);
create index if not exists offers_seller_id_idx on public.offers(seller_id);
create index if not exists offers_status_idx on public.offers(status);

drop policy if exists "participants can read offers" on public.offers;
drop policy if exists "buyers can create offers" on public.offers;
drop policy if exists "participants can update offers" on public.offers;

create policy "participants can read offers"
on public.offers
for select
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "buyers can create offers"
on public.offers
for insert
to authenticated
with check (auth.uid() = buyer_id and buyer_id <> seller_id);

create policy "participants can update offers"
on public.offers
for update
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id)
with check (auth.uid() = buyer_id or auth.uid() = seller_id);
