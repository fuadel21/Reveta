-- Reveta runtime schema compatibility
-- Adds columns/tables used by checkout, Stripe, Sendcloud, boosts, offers and disputes.
-- Safe for existing data: only adds missing objects and nullable/defaulted columns.

-- PRODUCTS
alter table if exists public.products
  add column if not exists boosted_until timestamptz,
  add column if not exists updated_at timestamptz default now(),
  alter column views set default 0,
  alter column status set default 'active';

create index if not exists products_status_idx on public.products (status);
create index if not exists products_user_id_idx on public.products (user_id);
create index if not exists products_boosted_until_idx on public.products (boosted_until desc nulls last);

-- TRANSACTIONS
alter table if exists public.transactions
  add column if not exists payment_provider text,
  add column if not exists payment_status text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists shipping_provider text,
  add column if not exists shipping_status text,
  add column if not exists sendcloud_parcel_id text,
  add column if not exists sendcloud_tracking_number text,
  add column if not exists sendcloud_tracking_url text,
  add column if not exists shipping_address jsonb,
  add column if not exists updated_at timestamptz default now(),
  alter column status set default 'pending';

alter table if exists public.transactions alter column completed_at drop not null;

create index if not exists transactions_buyer_id_idx on public.transactions (buyer_id);
create index if not exists transactions_seller_id_idx on public.transactions (seller_id);
create index if not exists transactions_product_id_idx on public.transactions (product_id);
create unique index if not exists transactions_stripe_payment_intent_id_idx
  on public.transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index if not exists transactions_sendcloud_parcel_id_idx
  on public.transactions (sendcloud_parcel_id)
  where sendcloud_parcel_id is not null;

-- OFFERS
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  buyer_id uuid not null,
  seller_id uuid,
  amount numeric not null check (amount > 0),
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.offers
  add column if not exists product_id uuid references public.products(id) on delete cascade,
  add column if not exists seller_id uuid,
  add column if not exists message text,
  add column if not exists updated_at timestamptz default now(),
  alter column status set default 'pending';

create index if not exists offers_conversation_id_idx on public.offers (conversation_id);
create index if not exists offers_product_id_idx on public.offers (product_id);
create index if not exists offers_buyer_id_idx on public.offers (buyer_id);
create index if not exists offers_seller_id_idx on public.offers (seller_id);

-- PRODUCT BOOSTS
create table if not exists public.product_boosts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null,
  plan text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur',
  stripe_payment_intent_id text unique,
  status text not null default 'pending',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_boosts_product_id_idx on public.product_boosts (product_id);
create index if not exists product_boosts_user_id_idx on public.product_boosts (user_id);
create index if not exists product_boosts_status_idx on public.product_boosts (status);
create index if not exists product_boosts_ends_at_idx on public.product_boosts (ends_at desc nulls last);

-- DISPUTES
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  buyer_id uuid not null,
  seller_id uuid not null,
  opened_by uuid not null,
  reason text not null,
  details text,
  status text not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists disputes_transaction_id_idx on public.disputes (transaction_id);
create index if not exists disputes_product_id_idx on public.disputes (product_id);
create index if not exists disputes_buyer_id_idx on public.disputes (buyer_id);
create index if not exists disputes_seller_id_idx on public.disputes (seller_id);
create index if not exists disputes_status_idx on public.disputes (status);

-- NOTIFICATIONS quality-of-life indexes
create index if not exists notifications_user_read_idx on public.notifications (user_id, read, created_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists conversations_buyer_seller_idx on public.conversations (buyer_id, seller_id, updated_at desc);

-- STORAGE bucket expected by the app
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS for new/optional runtime tables
alter table if exists public.offers enable row level security;
alter table if exists public.product_boosts enable row level security;
alter table if exists public.disputes enable row level security;

drop policy if exists "offers_select_parties_or_admin" on public.offers;
create policy "offers_select_parties_or_admin" on public.offers
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists "offers_insert_buyer" on public.offers;
create policy "offers_insert_buyer" on public.offers
for insert to authenticated
with check (buyer_id = auth.uid() and seller_id <> auth.uid());

drop policy if exists "offers_update_parties_or_admin" on public.offers;
create policy "offers_update_parties_or_admin" on public.offers
for update to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin())
with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists "product_boosts_select_owner_or_admin" on public.product_boosts;
create policy "product_boosts_select_owner_or_admin" on public.product_boosts
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "product_boosts_insert_owner" on public.product_boosts;
create policy "product_boosts_insert_owner" on public.product_boosts
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "product_boosts_update_owner_or_admin" on public.product_boosts;
create policy "product_boosts_update_owner_or_admin" on public.product_boosts
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "disputes_select_parties_or_admin" on public.disputes;
create policy "disputes_select_parties_or_admin" on public.disputes
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or opened_by = auth.uid() or public.is_admin());

drop policy if exists "disputes_insert_party" on public.disputes;
create policy "disputes_insert_party" on public.disputes
for insert to authenticated
with check (opened_by = auth.uid() and (buyer_id = auth.uid() or seller_id = auth.uid()));

drop policy if exists "disputes_update_admin" on public.disputes;
create policy "disputes_update_admin" on public.disputes
for update to authenticated
using (public.is_admin())
with check (public.is_admin());
