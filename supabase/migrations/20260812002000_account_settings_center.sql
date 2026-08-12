begin;

do $$
begin
  if to_regclass('public.blocked_users') is not null
     and to_regclass('public.user_blocks') is not null then
    execute $sql$
      insert into public.user_blocks (blocker_id, blocked_id, created_at)
      select
        user_id,
        blocked_user_id,
        coalesce(created_at, now())
      from public.blocked_users
      where user_id is not null
        and blocked_user_id is not null
        and user_id <> blocked_user_id
      on conflict (blocker_id, blocked_id) do nothing
    $sql$;
  end if;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
