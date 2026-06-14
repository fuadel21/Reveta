alter table public.product_boosts
  drop constraint if exists product_boosts_plan_check;

alter table public.product_boosts
  add constraint product_boosts_plan_check
  check (plan in ('7d', '14d', '30d'));
