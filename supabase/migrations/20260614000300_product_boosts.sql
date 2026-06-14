create extension if not exists pgcrypto;

alter table public.products
add column if not exists boosted_until timestamptz;

create table if not exists public.product_boosts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('7d', '14d', '30d')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur',
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_boosts enable row level security;

grant select, insert, update on public.product_boosts to authenticated;
grant update on public.products to authenticated;

drop policy if exists "users can view their product boosts" on public.product_boosts;
drop policy if exists "users can create their product boosts" on public.product_boosts;
drop policy if exists "users can update their product boosts" on public.product_boosts;
drop policy if exists "owners can update boost status on products" on public.products;

create policy "users can view their product boosts"
on public.product_boosts
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can create their product boosts"
on public.product_boosts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.products p
    where p.id = product_boosts.product_id
      and p.user_id = auth.uid()
  )
);

create policy "users can update their product boosts"
on public.product_boosts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "owners can update boost status on products"
on public.products
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists products_boosted_until_idx
on public.products (boosted_until desc)
where boosted_until is not null;

create index if not exists product_boosts_product_id_idx
on public.product_boosts(product_id);

create index if not exists product_boosts_user_id_idx
on public.product_boosts(user_id);
