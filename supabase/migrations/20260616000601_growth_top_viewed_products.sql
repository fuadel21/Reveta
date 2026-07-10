create or replace view public.growth_top_viewed_products
with (security_invoker = true)
as
select
  id as product_id,
  title,
  price,
  status,
  location,
  coalesce(views, 0)::int as view_count,
  created_at
from public.products
order by coalesce(views, 0) desc, created_at desc;
