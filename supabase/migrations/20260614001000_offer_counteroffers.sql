alter table public.offers
  add column if not exists created_by uuid references auth.users(id) on delete cascade;

update public.offers
set created_by = buyer_id
where created_by is null;

drop policy if exists "buyers can create offers" on public.offers;
drop policy if exists "participants can create offers" on public.offers;

create policy "participants can create offers"
on public.offers
for insert
to authenticated
with check (
  auth.uid() = created_by
  and exists (
    select 1
    from public.conversations c
    where c.id = offers.conversation_id
      and c.product_id = offers.product_id
      and c.buyer_id = offers.buyer_id
      and c.seller_id = offers.seller_id
      and (
        c.buyer_id = auth.uid()
        or c.seller_id = auth.uid()
      )
  )
);

create index if not exists offers_created_by_idx
on public.offers(created_by);
