-- Add subscription kill-switch column.
-- Default true so all existing stores remain active after this migration.
alter table public.stores
  add column if not exists is_active boolean not null default true;
