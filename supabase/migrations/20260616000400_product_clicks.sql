create table if not exists public.product_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  source text not null default 'search_grid',
  created_at timestamptz not null default now()
);

alter table public.product_clicks enable row level security;

drop policy if exists "users can create product clicks" on public.product_clicks;
create policy "users can create product clicks"
on public.product_clicks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "anonymous can create product clicks" on public.product_clicks;
create policy "anonymous can create product clicks"
on public.product_clicks
for insert
to anon
with check (user_id is null);

drop policy if exists "admins can read product clicks" on public.product_clicks;
create policy "admins can read product clicks"
on public.product_clicks
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

create index if not exists product_clicks_created_at_idx on public.product_clicks(created_at desc);
create index if not exists product_clicks_product_id_idx on public.product_clicks(product_id);
create index if not exists product_clicks_user_id_idx on public.product_clicks(user_id);
