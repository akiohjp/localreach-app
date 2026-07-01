-- WhatsApp CRM: mirror capture_store_customer_lead rules as a narrow anon INSERT policy.
-- If the SECURITY DEFINER RPC fails in some PG/RLS edge cases, the app can fall back to REST insert.

grant insert on table public.customers to anon;

drop policy if exists "anon_insert_customer_active_store_only" on public.customers;

create policy "anon_insert_customer_active_store_only"
on public.customers
for insert
to anon
with check (
  whatsapp_number is not null
  and length(trim(whatsapp_number)) >= 8
  and exists (
    select 1 from public.stores s
    where s.id = customers.store_id
      and s.is_active is true
  )
);

comment on policy "anon_insert_customer_active_store_only" on public.customers is
  'Public review flow: allow anon to insert CRM lead only when store exists and is active; same constraints as capture_store_customer_lead.';
