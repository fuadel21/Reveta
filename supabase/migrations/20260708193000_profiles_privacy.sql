-- Reveta profile privacy hardening
-- Public reads can see safe profile fields only. The owner reads private fields through get_private_profile().

create or replace function public.get_private_profile()
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  location text,
  phone text,
  bio text,
  verified boolean,
  verified_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.location,
    p.phone,
    p.bio,
    p.verified,
    p.verified_at,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = auth.uid();
$$;

grant execute on function public.get_private_profile() to authenticated;

-- Keep RLS active. Row access is still governed by policies, but column grants below remove phone from normal public reads.
alter table if exists public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Remove table-wide SELECT so phone is not exposed by normal PostgREST reads.
revoke select on public.profiles from anon, authenticated;

-- Re-grant only public-safe columns. Phone stays private and is available only through get_private_profile().
grant select (
  id,
  username,
  full_name,
  avatar_url,
  bio,
  location,
  verified,
  verified_at,
  created_at,
  updated_at
) on public.profiles to anon, authenticated;
