-- Always embedded in generated reviews (GEO); optional "GEO Keywords" remain guest-selectable.
alter table public.stores
  add column if not exists forced_keywords jsonb not null default '[]'::jsonb;

comment on column public.stores.forced_keywords is
  'Phrases always included in assembled reviews; not shown as guest pills unless also in keywords.';
