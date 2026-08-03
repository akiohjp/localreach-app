-- Results reporting: daily snapshots of each store's public Google rating and
-- review count, so the product can answer "did reviews actually go up?" itself
-- instead of someone digging the numbers out by hand (which is how the
-- Let It Dough 29->42 case study had to be assembled).
--
-- google_place_id is stored explicitly rather than re-parsed from
-- google_review_url on every capture: most stores carry a
-- "writereview?placeid=..." URL it can be derived from, but short-link formats
-- ("https://g.page/r/.../review" — the live Let It Dough URL) contain no place
-- id at all, so derivation cannot be the source of truth.

alter table public.stores add column if not exists google_place_id text;

update public.stores
set google_place_id = substring(google_review_url from 'placeid=([^&]+)')
where google_place_id is null
  and google_review_url like '%placeid=%';

create table if not exists public.review_stats (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  captured_on date not null,
  rating numeric(2,1),
  review_count integer not null,
  created_at timestamptz not null default now(),
  unique (store_id, captured_on)
);

create index if not exists review_stats_store_date_idx
  on public.review_stats (store_id, captured_on desc);

alter table public.review_stats enable row level security;

-- Owners read their own stores' history. All writes go through the service
-- role (cron + server-side freshness capture); no insert/update/delete policy
-- exists for authenticated on purpose.
create policy "owners read own review stats"
  on public.review_stats for select to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = review_stats.store_id and s.owner_id = auth.uid()
    )
  );
