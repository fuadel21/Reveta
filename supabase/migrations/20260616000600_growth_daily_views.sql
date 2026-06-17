create or replace view public.growth_daily_searches
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  count(*)::int as search_count,
  sum(case when result_count = 0 then 1 else 0 end)::int as zero_result_count,
  sum(case when geo_enabled then 1 else 0 end)::int as geo_search_count,
  count(distinct coalesce(nullif(trim(query), ''), 'Sin texto'))::int as unique_search_terms
from public.search_analytics
group by date_trunc('day', created_at)::date
order by day desc;

create or replace view public.growth_daily_product_clicks
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  count(*)::int as click_count,
  count(distinct product_id)::int as unique_clicked_products,
  count(distinct user_id)::int as unique_clicking_users
from public.product_clicks
group by date_trunc('day', created_at)::date
order by day desc;

create or replace view public.growth_daily_summary
with (security_invoker = true)
as
select
  coalesce(s.day, c.day) as day,
  coalesce(s.search_count, 0)::int as search_count,
  coalesce(s.zero_result_count, 0)::int as zero_result_count,
  coalesce(s.geo_search_count, 0)::int as geo_search_count,
  coalesce(s.unique_search_terms, 0)::int as unique_search_terms,
  coalesce(c.click_count, 0)::int as click_count,
  coalesce(c.unique_clicked_products, 0)::int as unique_clicked_products,
  coalesce(c.unique_clicking_users, 0)::int as unique_clicking_users
from public.growth_daily_searches s
full outer join public.growth_daily_product_clicks c on c.day = s.day
order by day desc;
