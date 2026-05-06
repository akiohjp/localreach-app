-- Store owner's WhatsApp number for inbound review notifications
alter table public.stores
  add column if not exists owner_whatsapp text;
