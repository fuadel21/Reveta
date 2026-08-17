begin;

create table if not exists public.user_reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text null check (review is null or char_length(review) <= 1000),
  status text not null default 'published' check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaction_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create index if not exists user_reviews_reviewee_idx
  on public.user_reviews(reviewee_id, created_at desc);

create index if not exists user_reviews_transaction_idx
  on public.user_reviews(transaction_id);

alter table public.user_reviews enable row level security;

drop policy if exists "published reviews are public" on public.user_reviews;
create policy "published reviews are public"
on public.user_reviews
for select
to public
using (status = 'published');

drop policy if exists "reviewers can read own reviews" on public.user_reviews;
create policy "reviewers can read own reviews"
on public.user_reviews
for select
to authenticated
using (reviewer_id = auth.uid());

drop policy if exists "reviewers can create own reviews" on public.user_reviews;
create policy "reviewers can create own reviews"
on public.user_reviews
for insert
to authenticated
with check (reviewer_id = auth.uid());

drop policy if exists "reviewers can update own reviews" on public.user_reviews;
create policy "reviewers can update own reviews"
on public.user_reviews
for update
to authenticated
using (reviewer_id = auth.uid())
with check (reviewer_id = auth.uid());

create or replace function public.submit_transaction_review(
  p_transaction_id uuid,
  p_rating smallint,
  p_review text default null
)
returns public.user_reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_reviewee uuid;
  v_result public.user_reviews;
  v_text text := nullif(btrim(left(coalesce(p_review, ''), 1000)), '');
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'INVALID_RATING';
  end if;

  select * into v_transaction
  from public.transactions
  where id = p_transaction_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'TRANSACTION_NOT_FOUND';
  end if;

  if v_transaction.status <> 'completed' then
    raise exception using errcode = '42501', message = 'TRANSACTION_NOT_COMPLETED';
  end if;

  if v_actor = v_transaction.buyer_id then
    v_reviewee := v_transaction.seller_id;
  elsif v_actor = v_transaction.seller_id then
    v_reviewee := v_transaction.buyer_id;
  else
    raise exception using errcode = '42501', message = 'TRANSACTION_PARTICIPANT_REQUIRED';
  end if;

  insert into public.user_reviews (
    transaction_id,
    reviewer_id,
    reviewee_id,
    rating,
    review
  ) values (
    p_transaction_id,
    v_actor,
    v_reviewee,
    p_rating,
    v_text
  )
  on conflict (transaction_id, reviewer_id)
  do update set
    rating = excluded.rating,
    review = excluded.review,
    status = 'published',
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.submit_transaction_review(uuid, smallint, text) from public;
grant execute on function public.submit_transaction_review(uuid, smallint, text) to authenticated;

create or replace view public.user_reputation as
select
  reviewee_id as user_id,
  round(avg(rating)::numeric, 2) as average_rating,
  count(*)::integer as review_count,
  count(*) filter (where rating = 5)::integer as five_star_count,
  count(*) filter (where rating = 4)::integer as four_star_count,
  count(*) filter (where rating = 3)::integer as three_star_count,
  count(*) filter (where rating = 2)::integer as two_star_count,
  count(*) filter (where rating = 1)::integer as one_star_count
from public.user_reviews
where status = 'published'
group by reviewee_id;

grant select on public.user_reputation to anon, authenticated;

commit;
