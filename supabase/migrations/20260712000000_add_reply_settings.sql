-- Owner defaults for the review-reply generator (tone / locality / geo weave /
-- signature). Additive nullable column: NULL = feature uses built-in defaults,
-- zero behaviour change for existing stores. Owner-only feature, so the anon
-- public_store_review view is deliberately NOT recreated to include it.
alter table public.stores
  add column if not exists reply_settings jsonb;

comment on column public.stores.reply_settings is
  'Review-reply generator defaults: {"tone":"warm|professional","locality":string,"weaveGeo":bool,"signature":string}';
