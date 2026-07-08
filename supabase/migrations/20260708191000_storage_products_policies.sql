-- Reveta storage policies for product and chat images
-- Matches frontend paths: user_id/file.ext and user_id/chat/file.ext
-- Do not ALTER storage.objects ownership/RLS here: Supabase hosted owns that table.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'products',
  'products',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "products_bucket_public_read" on storage.objects;
create policy "products_bucket_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'products');

drop policy if exists "products_bucket_owner_insert" on storage.objects;
create policy "products_bucket_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'products'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp')
);

drop policy if exists "products_bucket_owner_update" on storage.objects;
create policy "products_bucket_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'products'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'products'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "products_bucket_owner_delete" on storage.objects;
create policy "products_bucket_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'products'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);
