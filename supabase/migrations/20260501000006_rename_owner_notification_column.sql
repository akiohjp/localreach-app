-- Replace phone-based notification with email notification (zero cost via Resend free tier)
alter table public.stores
  add column if not exists notification_email text;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'stores'
      and column_name  = 'owner_whatsapp'
  ) then
    update public.stores
       set notification_email = owner_whatsapp
     where owner_whatsapp is not null;
    alter table public.stores drop column owner_whatsapp;
  end if;
end $$;
