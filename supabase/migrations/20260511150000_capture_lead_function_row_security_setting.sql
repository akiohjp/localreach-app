-- If set_config('row_security', 'off') inside PL/pgSQL is rejected on your plan,
-- this attaches the setting to the function itself (recommended on Supabase / PG15).

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'capture_store_customer_lead'
      and pg_get_function_identity_arguments(p.oid)
        = 'uuid, text, boolean, text[], text'
  ) then
    execute $e$
      alter function public.capture_store_customer_lead(uuid, text, boolean, text[], text)
      set row_security to off
    $e$;
  end if;
end $$;
