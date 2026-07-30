-- ============================================================================
-- Per-store contact channel + dial code (de-hardcode the UAE).
--
-- Why: the guest-facing capture block on the result screen was labelled
-- "WhatsApp" with a hardcoded "+971" country code, because every store was in
-- the UAE. The first Japanese store (鮨処つかさ, 2026-07-30) exposed it —
-- WhatsApp is not used in Japan, so the block asked for a channel the guest
-- does not have, prefixed with the wrong country. A guest who cannot answer the
-- question simply leaves the field empty, so the store loses the lead.
--
-- LINE (the channel Japanese guests actually use) cannot be collected this way:
-- there is no public API to add a friend from a phone number, so a JP store
-- collects a normal phone number and the owner reaches the guest by SMS/phone.
--
-- New columns (defaults keep every existing UAE store byte-identical):
--   contact_channel   'whatsapp' | 'sms' — drives the label + consent wording
--   contact_dial_code E.164 country prefix shown in the code box, e.g. '+81'
--
-- Safe to re-run.
-- ============================================================================

alter table public.stores
  add column if not exists contact_channel text not null default 'whatsapp',
  add column if not exists contact_dial_code text not null default '+971';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_contact_channel_chk'
  ) then
    alter table public.stores
      add constraint stores_contact_channel_chk
      check (contact_channel in ('whatsapp', 'sms'));
  end if;
end $$;

comment on column public.stores.contact_channel is
  'Guest contact channel offered on the result screen: whatsapp (UAE default) or sms (e.g. Japan, where WhatsApp is not used and LINE cannot be collected by number).';
comment on column public.stores.contact_dial_code is
  'E.164 country prefix pre-filled in the guest number field, e.g. "+971", "+81".';

-- Recreate the anon-safe view with the two columns. Column list must stay in
-- sync with the live view (effective is_active included).
-- security_invoker stays OFF (default) intentionally — the view runs with owner
-- rights; base-table RLS still blocks direct anon reads.
drop view if exists public.public_store_review;

create view public.public_store_review as
  select
    id,
    store_name,
    greeting_text,
    keywords,
    forced_keywords,
    google_review_url,
    brand_color,
    default_language,
    (is_active and (subscription_expires_at is null or subscription_expires_at > now())) as is_active,
    logo_url,
    business_category,
    entity_area,
    entity_city,
    entity_category_label,
    contact_channel,
    contact_dial_code
  from public.stores;

comment on view public.public_store_review is
  'Anon-safe columns of stores for the public /store/[id] QR review page. '
  'Excludes owner_id, description and timestamps. is_active is the EFFECTIVE '
  'value: manual kill switch AND subscription not expired.';

revoke all on public.public_store_review from anon, authenticated;
grant select on public.public_store_review to anon, authenticated;

-- ============================================================================
-- Verification (SQL editor, after applying)
-- ============================================================================
-- 1) Defaults unchanged for existing stores:
--    select store_name->>'en', contact_channel, contact_dial_code from public.stores;
-- 2) View exposes them to anon:
--    select contact_channel, contact_dial_code from public.public_store_review limit 1;
-- 3) Japan store set correctly:
--    update public.stores set contact_channel='sms', contact_dial_code='+81'
--      where id='98644967-1856-487a-9b72-7a007f032832';
