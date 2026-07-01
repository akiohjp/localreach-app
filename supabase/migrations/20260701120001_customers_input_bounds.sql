-- ============================================================================
-- Defense-in-depth bounds on anon-writable customer leads.
--
-- The anon INSERT policy (anon_insert_customer_active_store_only) only checks
-- whatsapp length >= 8 + active store; customer_name and selected_keywords are
-- otherwise unbounded, so an attacker with the anon key could write very large
-- garbage PII rows. These CHECK constraints cap field sizes at the DB layer.
--
-- Added NOT VALID so the migration never fails on pre-existing rows; the checks
-- still apply to every new INSERT/UPDATE. Apply AFTER a backup.
-- ============================================================================

do $$
begin
  -- WhatsApp: E.164 is <= 15 digits + '+'; allow slack for formatting.
  if not exists (select 1 from pg_constraint where conname = 'customers_whatsapp_len_chk') then
    alter table public.customers
      add constraint customers_whatsapp_len_chk
      check (char_length(btrim(whatsapp_number)) between 8 and 24) not valid;
  end if;

  -- Optional display name.
  if not exists (select 1 from pg_constraint where conname = 'customers_name_len_chk') then
    alter table public.customers
      add constraint customers_name_len_chk
      check (customer_name is null or char_length(customer_name) <= 200) not valid;
  end if;

  -- Keyword snapshot: bound cardinality and total serialized size.
  if not exists (select 1 from pg_constraint where conname = 'customers_keywords_bounds_chk') then
    alter table public.customers
      add constraint customers_keywords_bounds_chk
      check (
        selected_keywords is null
        or (
          coalesce(array_length(selected_keywords, 1), 0) <= 50
          and char_length(array_to_string(selected_keywords, ',')) <= 4000
        )
      ) not valid;
  end if;
end $$;

-- ============================================================================
-- Verification
--   select conname, convalidated from pg_constraint
--    where conrelid = 'public.customers'::regclass and conname like 'customers_%_chk';
-- Optionally validate against existing data once confirmed clean:
--   alter table public.customers validate constraint customers_whatsapp_len_chk;
-- ============================================================================
