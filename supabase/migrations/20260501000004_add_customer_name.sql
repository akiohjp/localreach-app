-- Optional customer name captured during WhatsApp CRM step
alter table public.customers
  add column if not exists customer_name text;
