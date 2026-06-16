create table if not exists public.search_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  query text,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  location text,
  min_price numeric,
  max_price numeric,
  condition text,
  geo_enabled boolean not null default false,
  radius_km integer,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.search_analytics enable row level security;

drop policy if exists "users can create search analytics" on public.search_analytics;
create policy "users can create search analytics"
on public.search_analytics
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "anonymous can create search analytics" on public.search_analytics;
create policy "anonymous can create search analytics"
on public.search_analytics
for insert
to anon
with check (user_id is null);

create index if not exists search_analytics_created_at_idx on public.search_analytics(created_at desc);
create index if not exists search_analytics_query_idx on public.search_analytics(query);
create index if not exists search_analytics_location_idx on public.search_analytics(location);
create index if not exists search_analytics_category_id_idx on public.search_analytics(category_id);
