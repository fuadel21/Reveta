-- Reveta production RLS hardening
-- Idempotent migration. Optional tables/columns are guarded so older databases do not break.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role::text = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- USER ROLES
alter table if exists public.user_roles enable row level security;

drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
create policy "user_roles_select_own_or_admin" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_roles_admin_insert" on public.user_roles;
create policy "user_roles_admin_insert" on public.user_roles for insert to authenticated with check (public.is_admin());

drop policy if exists "user_roles_admin_update" on public.user_roles;
create policy "user_roles_admin_update" on public.user_roles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "user_roles_admin_delete" on public.user_roles;
create policy "user_roles_admin_delete" on public.user_roles for delete to authenticated using (public.is_admin());

-- PROFILES
alter table if exists public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles for select to anon, authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- PRODUCTS
alter table if exists public.products enable row level security;

drop policy if exists "products_select_active_owner_admin" on public.products;
create policy "products_select_active_owner_admin" on public.products for select to anon, authenticated using (status = 'active' or user_id = auth.uid() or public.is_admin());

drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own" on public.products for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "products_update_owner_or_admin" on public.products;
create policy "products_update_owner_or_admin" on public.products for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "products_delete_owner_or_admin" on public.products;
create policy "products_delete_owner_or_admin" on public.products for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- CATEGORIES / SUBCATEGORIES
alter table if exists public.categories enable row level security;
alter table if exists public.subcategories enable row level security;

drop policy if exists "categories_read_all" on public.categories;
create policy "categories_read_all" on public.categories for select to anon, authenticated using (true);

drop policy if exists "subcategories_read_all" on public.subcategories;
create policy "subcategories_read_all" on public.subcategories for select to anon, authenticated using (true);

-- CONVERSATIONS
alter table if exists public.conversations enable row level security;

drop policy if exists "conversations_select_participants_or_admin" on public.conversations;
create policy "conversations_select_participants_or_admin" on public.conversations for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists "conversations_insert_buyer" on public.conversations;
create policy "conversations_insert_buyer" on public.conversations for insert to authenticated with check (buyer_id = auth.uid() and seller_id <> auth.uid());

drop policy if exists "conversations_update_participants_or_admin" on public.conversations;
create policy "conversations_update_participants_or_admin" on public.conversations for update to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin()) with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

-- MESSAGES
alter table if exists public.messages enable row level security;

drop policy if exists "messages_select_conversation_participants" on public.messages;
create policy "messages_select_conversation_participants" on public.messages for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "messages_insert_conversation_participants" on public.messages;
create policy "messages_insert_conversation_participants" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "messages_update_read_participants" on public.messages;
create policy "messages_update_read_participants" on public.messages for update to authenticated using (
  public.is_admin() or exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
) with check (
  public.is_admin() or exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

-- TRANSACTIONS
alter table if exists public.transactions enable row level security;

drop policy if exists "transactions_select_parties_or_admin" on public.transactions;
create policy "transactions_select_parties_or_admin" on public.transactions for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists "transactions_insert_buyer" on public.transactions;
create policy "transactions_insert_buyer" on public.transactions for insert to authenticated with check (buyer_id = auth.uid() and seller_id <> auth.uid());

drop policy if exists "transactions_update_parties_or_admin" on public.transactions;
create policy "transactions_update_parties_or_admin" on public.transactions for update to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin()) with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

do $$
begin
  if to_regclass('public.transactions') is not null then
    begin
      execute 'create unique index if not exists transactions_one_open_per_product_idx on public.transactions (product_id) where status in (''pending'', ''pending_payment'', ''paid'', ''shipped'', ''completed'')';
    exception when others then
      raise notice 'Skipping transactions_one_open_per_product_idx: %', sqlerrm;
    end;
  end if;
end $$;

-- FAVORITES
alter table if exists public.favorites enable row level security;

drop policy if exists "favorites_owner_all" on public.favorites;
create policy "favorites_owner_all" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- REPORTS
alter table if exists public.reports enable row level security;

drop policy if exists "reports_select_owner_or_admin" on public.reports;
create policy "reports_select_owner_or_admin" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "reports_insert_owner" on public.reports;
create policy "reports_insert_owner" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- REVIEWS
alter table if exists public.reviews enable row level security;

drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all" on public.reviews for select to anon, authenticated using (true);

drop policy if exists "reviews_insert_reviewer" on public.reviews;
create policy "reviews_insert_reviewer" on public.reviews for insert to authenticated with check (reviewer_id = auth.uid() and seller_id <> auth.uid());

drop policy if exists "reviews_update_reviewer_or_admin" on public.reviews;
create policy "reviews_update_reviewer_or_admin" on public.reviews for update to authenticated using (reviewer_id = auth.uid() or public.is_admin()) with check (reviewer_id = auth.uid() or public.is_admin());

-- NOTIFICATIONS
alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_owner_all" on public.notifications;
create policy "notifications_owner_all" on public.notifications for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- USER SETTINGS
alter table if exists public.user_settings enable row level security;

drop policy if exists "user_settings_owner_all" on public.user_settings;
create policy "user_settings_owner_all" on public.user_settings for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- SAVED SEARCHES
alter table if exists public.saved_searches enable row level security;

drop policy if exists "saved_searches_owner_all" on public.saved_searches;
create policy "saved_searches_owner_all" on public.saved_searches for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- OFFERS, guarded because older generated types showed a reduced offers table.
do $$
begin
  if to_regclass('public.offers') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'offers' and column_name = 'seller_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'offers' and column_name = 'buyer_id')
  then
    execute 'alter table public.offers enable row level security';
    execute 'drop policy if exists "offers_select_parties_or_admin" on public.offers';
    execute 'create policy "offers_select_parties_or_admin" on public.offers for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin())';
    execute 'drop policy if exists "offers_insert_buyer" on public.offers';
    execute 'create policy "offers_insert_buyer" on public.offers for insert to authenticated with check (buyer_id = auth.uid() and seller_id <> auth.uid())';
    execute 'drop policy if exists "offers_update_parties_or_admin" on public.offers';
    execute 'create policy "offers_update_parties_or_admin" on public.offers for update to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin()) with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin())';
  else
    raise notice 'Skipping offers RLS: table or seller_id/buyer_id columns not present';
  end if;
end $$;

-- PRODUCT BOOSTS, guarded because some environments may not have monetization tables yet.
do $$
begin
  if to_regclass('public.product_boosts') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_boosts' and column_name = 'user_id')
  then
    execute 'alter table public.product_boosts enable row level security';
    execute 'drop policy if exists "product_boosts_select_owner_or_admin" on public.product_boosts';
    execute 'create policy "product_boosts_select_owner_or_admin" on public.product_boosts for select to authenticated using (user_id = auth.uid() or public.is_admin())';
    execute 'drop policy if exists "product_boosts_insert_owner" on public.product_boosts';
    execute 'create policy "product_boosts_insert_owner" on public.product_boosts for insert to authenticated with check (user_id = auth.uid())';
    execute 'drop policy if exists "product_boosts_update_owner_or_admin" on public.product_boosts';
    execute 'create policy "product_boosts_update_owner_or_admin" on public.product_boosts for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin())';
  else
    raise notice 'Skipping product_boosts RLS: table or user_id column not present';
  end if;
end $$;

-- PUSH SUBSCRIPTIONS
alter table if exists public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_owner_all" on public.push_subscriptions;
create policy "push_subscriptions_owner_all" on public.push_subscriptions for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- STORAGE: products bucket
alter table if exists storage.objects enable row level security;

drop policy if exists "products_bucket_public_read" on storage.objects;
create policy "products_bucket_public_read" on storage.objects for select to anon, authenticated using (bucket_id = 'products');

drop policy if exists "products_bucket_owner_insert" on storage.objects;
create policy "products_bucket_owner_insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'products'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp')
);

drop policy if exists "products_bucket_owner_update" on storage.objects;
create policy "products_bucket_owner_update" on storage.objects for update to authenticated using (bucket_id = 'products' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())) with check (bucket_id = 'products' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "products_bucket_owner_delete" on storage.objects;
create policy "products_bucket_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'products' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
