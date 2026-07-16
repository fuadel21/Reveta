-- Prevent two open transactions from reserving/selling the same product at the same time.
-- This protects the marketplace even if two buyers click purchase concurrently.

CREATE UNIQUE INDEX IF NOT EXISTS transactions_one_open_per_product_idx
ON public.transactions (product_id)
WHERE status IN ('pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review');
