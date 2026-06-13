alter table public.transactions
  add column if not exists shipping_provider text,
  add column if not exists shipping_status text default 'pending',
  add column if not exists sendcloud_parcel_id text,
  add column if not exists sendcloud_tracking_number text,
  add column if not exists sendcloud_tracking_url text,
  add column if not exists shipping_address jsonb;

create index if not exists transactions_sendcloud_parcel_id_idx
on public.transactions(sendcloud_parcel_id)
where sendcloud_parcel_id is not null;

grant update on public.transactions to authenticated;

drop policy if exists "buyers can update shipping fields" on public.transactions;

create policy "buyers can update shipping fields"
on public.transactions
for update
to authenticated
using (auth.uid() = buyer_id)
with check (auth.uid() = buyer_id);
