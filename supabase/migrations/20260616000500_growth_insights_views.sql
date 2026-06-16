create or replace view public.growth_top_searches
with (security_invoker = true)
as
select
  coalesce(nullif(trim(query), ''), 'Sin texto') as search_term,
  count(*)::int as search_count,
  sum(case when result_count = 0 then 1 else 0 end)::int as zero_result_count,
  max(created_at) as last_searched_at
from public.search_analytics
group by coalesce(nullif(trim(query), ''), 'Sin texto')
order by search_count desc, last_searched_at desc;

create or replace view public.growth_top_locations
with (security_invoker = true)
as
select
  coalesce(nullif(trim(location), ''), 'Sin ubicación') as location,
  count(*)::int as search_count,
  sum(case when result_count = 0 then 1 else 0 end)::int as zero_result_count,
  max(created_at) as last_searched_at
from public.search_analytics
group by coalesce(nullif(trim(location), ''), 'Sin ubicación')
order by search_count desc, last_searched_at desc;

create or replace view public.growth_zero_result_searches
with (security_invoker = true)
as
select
  coalesce(nullif(trim(query), ''), 'Sin texto') as search_term,
  coalesce(nullif(trim(location), ''), 'Sin ubicación') as location,
  count(*)::int as zero_result_count,
  max(created_at) as last_searched_at
from public.search_analytics
where result_count = 0
group by coalesce(nullif(trim(query), ''), 'Sin texto'), coalesce(nullif(trim(location), ''), 'Sin ubicación')
order by zero_result_count desc, last_searched_at desc;

create or replace view public.growth_top_clicked_products
with (security_invoker = true)
as
select
  pc.product_id,
  p.title,
  p.price,
  p.status,
  count(*)::int as click_count,
  max(pc.created_at) as last_clicked_at
from public.product_clicks pc
left join public.products p on p.id = pc.product_id
group by pc.product_id, p.title, p.price, p.status
order by click_count desc, last_clicked_at desc;
