alter table public.transactions
  add column if not exists offer_id uuid references public.offers(id) on delete set null;

create index if not exists transactions_offer_id_idx
on public.transactions(offer_id);
