-- Prevent double reservations/purchases for the same product.
-- Only one open transaction can exist per product at the database level.
-- Closed/cancelled/failed transactions are intentionally excluded so products can be reactivated safely.

create unique index if not exists transactions_one_open_per_product_idx
on public.transactions (product_id)
where status in (
  'pending',
  'pending_payment',
  'paid',
  'shipped',
  'completed',
  'disputed',
  'under_review'
);
