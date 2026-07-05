create table if not exists public.product_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('possible_fraud', 'fake_product', 'prohibited_item', 'suspicious_price', 'spam', 'other')),
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_reports_not_self_report check (reporter_id <> seller_id),
  constraint product_reports_unique_report unique (product_id, reporter_id)
);

create index if not exists product_reports_product_id_idx on public.product_reports(product_id);
create index if not exists product_reports_reporter_id_idx on public.product_reports(reporter_id);
create index if not exists product_reports_seller_id_idx on public.product_reports(seller_id);
create index if not exists product_reports_status_idx on public.product_reports(status);
create index if not exists product_reports_created_at_idx on public.product_reports(created_at desc);

alter table public.product_reports enable row level security;

drop policy if exists "Users can create product reports" on public.product_reports;
drop policy if exists "Users can view own product reports" on public.product_reports;
drop policy if exists "Admins can view product reports" on public.product_reports;
drop policy if exists "Admins can update product reports" on public.product_reports;

create policy "Users can create product reports"
on public.product_reports
for insert
to authenticated
with check (
  auth.uid() = reporter_id
  and auth.uid() <> seller_id
);

create policy "Users can view own product reports"
on public.product_reports
for select
to authenticated
using (auth.uid() = reporter_id);

create policy "Admins can view product reports"
on public.product_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
);

create policy "Admins can update product reports"
on public.product_reports
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
);

create or replace function public.set_product_reports_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_product_reports_updated_at on public.product_reports;
create trigger set_product_reports_updated_at
before update on public.product_reports
for each row
execute function public.set_product_reports_updated_at();
