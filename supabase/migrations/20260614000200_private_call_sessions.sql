create extension if not exists pgcrypto;

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'active', 'ended', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.call_sessions(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('offer', 'answer', 'ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.call_sessions enable row level security;
alter table public.call_signals enable row level security;

grant select, insert, update on public.call_sessions to authenticated;
grant select, insert on public.call_signals to authenticated;

drop policy if exists "participants can view call sessions" on public.call_sessions;
drop policy if exists "participants can create call sessions" on public.call_sessions;
drop policy if exists "participants can update call sessions" on public.call_sessions;
drop policy if exists "participants can view call signals" on public.call_signals;
drop policy if exists "participants can create call signals" on public.call_signals;

create policy "participants can view call sessions"
on public.call_sessions
for select
to authenticated
using (auth.uid() = caller_id or auth.uid() = callee_id);

create policy "participants can create call sessions"
on public.call_sessions
for insert
to authenticated
with check (auth.uid() = caller_id);

create policy "participants can update call sessions"
on public.call_sessions
for update
to authenticated
using (auth.uid() = caller_id or auth.uid() = callee_id)
with check (auth.uid() = caller_id or auth.uid() = callee_id);

create policy "participants can view call signals"
on public.call_signals
for select
to authenticated
using (
  exists (
    select 1
    from public.call_sessions cs
    where cs.id = call_signals.call_id
      and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
  )
);

create policy "participants can create call signals"
on public.call_signals
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.call_sessions cs
    where cs.id = call_signals.call_id
      and (cs.caller_id = auth.uid() or cs.callee_id = auth.uid())
  )
);

create index if not exists call_sessions_conversation_id_idx on public.call_sessions(conversation_id);
create index if not exists call_sessions_participants_idx on public.call_sessions(caller_id, callee_id);
create index if not exists call_signals_call_id_created_at_idx on public.call_signals(call_id, created_at);
