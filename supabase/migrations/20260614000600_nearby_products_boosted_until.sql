create or replace function public.get_products_within_radius(
  user_lat double precision,
  user_lon double precision,
  radius_km double precision default 25,
  search_query text default null,
  category_filter uuid default null,
  condition_filter text default null,
  min_price numeric default null,
  max_price numeric default null,
  sort_option text default 'distance'
)
returns table (
  id uuid,
  title text,
  price numeric,
  images text[],
  location text,
  created_at timestamptz,
  condition text,
  distance_km double precision,
  latitude double precision,
  longitude double precision,
  subcategory_id uuid,
  boosted_until timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.title,
    p.price,
    p.images,
    p.location,
    p.created_at,
    p.condition,
    (
      6371 * acos(
        least(
          1,
          greatest(
            -1,
            cos(radians(user_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(user_lon)) +
            sin(radians(user_lat)) * sin(radians(p.latitude))
          )
        )
      )
    ) as distance_km,
    p.latitude,
    p.longitude,
    p.subcategory_id,
    p.boosted_until
  from public.products p
  where p.status = 'active'
    and p.latitude is not null
    and p.longitude is not null
    and (
      6371 * acos(
        least(
          1,
          greatest(
            -1,
            cos(radians(user_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(user_lon)) +
            sin(radians(user_lat)) * sin(radians(p.latitude))
          )
        )
      )
    ) <= radius_km
    and (search_query is null or p.title ilike '%' || search_query || '%' or p.description ilike '%' || search_query || '%')
    and (category_filter is null or p.category_id = category_filter)
    and (condition_filter is null or p.condition = condition_filter)
    and (min_price is null or p.price >= min_price)
    and (max_price is null or p.price <= max_price)
  order by
    case when p.boosted_until is not null and p.boosted_until > now() then 0 else 1 end asc,
    case when sort_option = 'price_asc' then p.price end asc,
    case when sort_option = 'price_desc' then p.price end desc,
    case when sort_option = 'recent' then p.created_at end desc,
    distance_km asc;
$$;

grant execute on function public.get_products_within_radius(
  double precision,
  double precision,
  double precision,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text
) to anon, authenticated;
