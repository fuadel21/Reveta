alter table public.transactions
  add column if not exists payment_provider text,
  add column if not exists payment_status text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

create unique index if not exists transactions_stripe_payment_intent_id_idx
on public.transactions(stripe_payment_intent_id)
where stripe_payment_intent_id is not null;

create index if not exists transactions_payment_status_idx
on public.transactions(payment_status);
