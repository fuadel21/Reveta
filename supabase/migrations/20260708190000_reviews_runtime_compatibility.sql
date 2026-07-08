-- Reveta reviews runtime compatibility
-- Aligns the reviews table with the UI: reviewer_id, reviewed_id, product_id, transaction_id.

alter table if exists public.reviews
  add column if not exists reviewed_id uuid,
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null,
  alter column product_id drop not null,
  alter column comment drop not null;

-- Backfill reviewed_id from older seller_id column when present.
do $$
begin
  if to_regclass('public.reviews') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reviews' and column_name = 'seller_id')
  then
    execute 'update public.reviews set reviewed_id = seller_id where reviewed_id is null and seller_id is not null';
  end if;
end $$;

-- Add FK only if it does not already exist.
do $$
begin
  if to_regclass('public.reviews') is not null
     and not exists (
       select 1 from information_schema.table_constraints
       where constraint_schema = 'public'
         and table_name = 'reviews'
         and constraint_name = 'reviews_reviewed_id_fkey'
     )
  then
    alter table public.reviews
      add constraint reviews_reviewed_id_fkey foreign key (reviewed_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create index if not exists reviews_reviewer_id_idx on public.reviews (reviewer_id);
create index if not exists reviews_reviewed_id_idx on public.reviews (reviewed_id);
create index if not exists reviews_product_id_idx on public.reviews (product_id);
create index if not exists reviews_transaction_id_idx on public.reviews (transaction_id);

create unique index if not exists reviews_one_per_transaction_reviewer_idx
on public.reviews (transaction_id, reviewer_id)
where transaction_id is not null;

create unique index if not exists reviews_one_per_product_reviewer_reviewed_idx
on public.reviews (product_id, reviewer_id, reviewed_id)
where transaction_id is null and product_id is not null and reviewed_id is not null;

alter table if exists public.reviews enable row level security;

drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all"
on public.reviews
for select
to anon, authenticated
using (true);

drop policy if exists "reviews_insert_reviewer" on public.reviews;
create policy "reviews_insert_reviewer"
on public.reviews
for insert
to authenticated
with check (
  reviewer_id = auth.uid()
  and reviewed_id is not null
  and reviewed_id <> auth.uid()
  and (
    transaction_id is null
    or exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and t.status in ('paid', 'shipped', 'completed')
        and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
        and (t.buyer_id = reviewed_id or t.seller_id = reviewed_id)
    )
  )
);

drop policy if exists "reviews_update_reviewer_or_admin" on public.reviews;
create policy "reviews_update_reviewer_or_admin"
on public.reviews
for update
to authenticated
using (reviewer_id = auth.uid() or public.is_admin())
with check (reviewer_id = auth.uid() or public.is_admin());

drop policy if exists "reviews_delete_reviewer_or_admin" on public.reviews;
create policy "reviews_delete_reviewer_or_admin"
on public.reviews
for delete
to authenticated
using (reviewer_id = auth.uid() or public.is_admin());
