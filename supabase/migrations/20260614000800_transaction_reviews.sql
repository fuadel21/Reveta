create extension if not exists pgcrypto;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewed_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewer_id <> reviewed_id)
);

alter table public.reviews
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

alter table public.reviews enable row level security;

grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

create unique index if not exists reviews_unique_transaction_reviewer_idx
on public.reviews(reviewer_id, transaction_id)
where transaction_id is not null;

create index if not exists reviews_reviewed_id_idx on public.reviews(reviewed_id);
create index if not exists reviews_product_id_idx on public.reviews(product_id);

drop policy if exists "read reviews" on public.reviews;
drop policy if exists "create own review" on public.reviews;

create policy "read reviews"
on public.reviews
for select
using (true);

create policy "create own review"
on public.reviews
for insert
to authenticated
with check (auth.uid() = reviewer_id and reviewer_id <> reviewed_id);
