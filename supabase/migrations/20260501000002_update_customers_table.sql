-- Rename whatsapp → whatsapp_number for clarity
alter table public.customers
  rename column whatsapp to whatsapp_number;

-- Add marketing opt-in flag and keyword snapshot
alter table public.customers
  add column if not exists opt_in           boolean  not null default true,
  add column if not exists selected_keywords text[];
