create extension if not exists pgcrypto;

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
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

alter table public.disputes enable row level security;

grant select, insert, update on public.disputes to authenticated;

create index if not exists disputes_transaction_id_idx on public.disputes(transaction_id);
create index if not exists disputes_buyer_id_idx on public.disputes(buyer_id);
create index if not exists disputes_seller_id_idx on public.disputes(seller_id);
create index if not exists disputes_status_idx on public.disputes(status);

create unique index if not exists disputes_one_open_per_transaction_uidx
on public.disputes(transaction_id)
where status in ('open', 'under_review');

drop policy if exists "users can view their disputes" on public.disputes;
drop policy if exists "buyers or sellers can open disputes" on public.disputes;
drop policy if exists "participants can update their disputes" on public.disputes;

create policy "users can view their disputes"
on public.disputes
for select
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "buyers or sellers can open disputes"
on public.disputes
for insert
to authenticated
with check (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "participants can update their disputes"
on public.disputes
for update
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id)
with check (auth.uid() = buyer_id or auth.uid() = seller_id);

grant update on public.transactions to authenticated;

drop policy if exists "participants can mark transaction disputed" on public.transactions;

create policy "participants can mark transaction disputed"
on public.transactions
for update
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id)
with check (auth.uid() = buyer_id or auth.uid() = seller_id);
