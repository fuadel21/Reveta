create unique index if not exists transactions_one_open_per_product_idx
on public.transactions(product_id)
where status in ('pending', 'pending_payment', 'paid', 'shipped', 'completed');
