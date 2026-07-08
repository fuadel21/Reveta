-- Reveta private browser calls
-- Creates call sessions and WebRTC signaling tables with participant-only RLS.

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  caller_id uuid not null,
  callee_id uuid not null,
  status text not null default 'requested' check (status in ('requested', 'active', 'ended', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.call_sessions(id) on delete cascade,
  sender_id uuid not null,
  type text not null check (type in ('offer', 'answer', 'ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists call_sessions_conversation_id_idx on public.call_sessions (conversation_id);
create index if not exists call_sessions_product_id_idx on public.call_sessions (product_id);
create index if not exists call_sessions_caller_id_idx on public.call_sessions (caller_id);
create index if not exists call_sessions_callee_id_idx on public.call_sessions (callee_id);
create index if not exists call_sessions_status_idx on public.call_sessions (status);
create index if not exists call_signals_call_created_idx on public.call_signals (call_id, created_at);
create index if not exists call_signals_sender_id_idx on public.call_signals (sender_id);

alter table public.call_sessions enable row level security;
alter table public.call_signals enable row level security;

-- Call sessions: only participants or admins can read/update. Caller creates a session with themselves as caller.
drop policy if exists "call_sessions_select_participants_or_admin" on public.call_sessions;
create policy "call_sessions_select_participants_or_admin"
on public.call_sessions
for select
to authenticated
using (caller_id = auth.uid() or callee_id = auth.uid() or public.is_admin());

drop policy if exists "call_sessions_insert_caller" on public.call_sessions;
create policy "call_sessions_insert_caller"
on public.call_sessions
for insert
to authenticated
with check (
  caller_id = auth.uid()
  and callee_id <> auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.product_id = call_sessions.product_id
      and c.buyer_id = auth.uid()
      and c.seller_id = call_sessions.callee_id
  )
);

drop policy if exists "call_sessions_update_participants_or_admin" on public.call_sessions;
create policy "call_sessions_update_participants_or_admin"
on public.call_sessions
for update
to authenticated
using (caller_id = auth.uid() or callee_id = auth.uid() or public.is_admin())
with check (caller_id = auth.uid() or callee_id = auth.uid() or public.is_admin());

drop policy if exists "call_sessions_delete_admin" on public.call_sessions;
create policy "call_sessions_delete_admin"
on public.call_sessions
for delete
to authenticated
using (public.is_admin());

-- WebRTC signals: only participants in the call can read/write signals.
drop policy if exists "call_signals_select_participants_or_admin" on public.call_signals;
create policy "call_signals_select_participants_or_admin"
on public.call_signals
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.call_sessions cs
    where cs.id = call_id
      and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
  )
);

drop policy if exists "call_signals_insert_participants" on public.call_signals;
create policy "call_signals_insert_participants"
on public.call_signals
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.call_sessions cs
    where cs.id = call_id
      and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
  )
);

drop policy if exists "call_signals_delete_admin" on public.call_signals;
create policy "call_signals_delete_admin"
on public.call_signals
for delete
to authenticated
using (public.is_admin());

-- Realtime publication. Safe when already present.
do $$
begin
  begin
    alter publication supabase_realtime add table public.call_sessions;
  exception
    when duplicate_object then null;
    when undefined_object then raise notice 'supabase_realtime publication not found; skipping call_sessions realtime publication';
  end;

  begin
    alter publication supabase_realtime add table public.call_signals;
  exception
    when duplicate_object then null;
    when undefined_object then raise notice 'supabase_realtime publication not found; skipping call_signals realtime publication';
  end;
end $$;
