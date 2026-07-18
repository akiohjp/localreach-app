-- 1) Shared API rate limiter (fixed window, atomic upsert).
--    In-memory limits are per-instance on Vercel and reset on cold start; this
--    table gives a GLOBAL window. Service-role only: RLS on with no policies,
--    and the RPC is executable by service_role alone.

create table if not exists public.api_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

alter table public.api_rate_limits enable row level security;

create or replace function public.bump_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.api_rate_limits;
begin
  insert into public.api_rate_limits as r (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update set
    count = case
      when r.window_start + make_interval(secs => p_window_seconds) <= v_now then 1
      else r.count + 1
    end,
    window_start = case
      when r.window_start + make_interval(secs => p_window_seconds) <= v_now then v_now
      else r.window_start
    end
  returning * into v_row;

  if v_row.count > p_max then
    return query select
      false,
      greatest(
        1,
        ceil(extract(epoch from (v_row.window_start + make_interval(secs => p_window_seconds) - v_now)))::integer
      );
  else
    return query select true, 0;
  end if;
end;
$$;

revoke all on function public.bump_rate_limit(text, integer, integer) from public;
revoke all on function public.bump_rate_limit(text, integer, integer) from anon;
revoke all on function public.bump_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.bump_rate_limit(text, integer, integer) to service_role;

comment on function public.bump_rate_limit(text, integer, integer)
  is 'Global fixed-window rate limiter. Service-role only; used by API routes (e.g. /api/generate-reply).';

-- 2) Close the anon direct-write paths into customers. All lead writes go
--    through /api/customer-leads (service role) which validates E.164 and the
--    contract-expiry gate; these legacy anon paths bypassed both. The app has
--    no remaining client-side RPC/insert callers (verified 2026-07-19).

drop policy if exists "anon_insert_customer_active_store_only" on public.customers;
revoke insert on table public.customers from anon;

revoke execute on function public.capture_store_customer_lead(uuid, text, boolean, text[], text) from anon;
revoke execute on function public.capture_store_customer_lead(uuid, text, boolean, text[], text) from authenticated;

comment on function public.capture_store_customer_lead(uuid, text, boolean, text[], text)
  is 'Legacy lead-capture RPC. Anon/authenticated execute revoked 2026-07-19: all lead writes go through /api/customer-leads (service role) which enforces E.164 + subscription expiry.';
