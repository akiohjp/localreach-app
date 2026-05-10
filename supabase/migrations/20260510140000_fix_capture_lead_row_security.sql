-- PG15+: table owners are subject to RLS — SECURITY DEFINER inserts into customers
-- were failing after `public_insert` was dropped (no INSERT policy matched for the insert).
-- Turn off row security only inside this audited RPC transaction.

CREATE OR REPLACE FUNCTION public.capture_store_customer_lead(
  p_store_id uuid,
  p_whatsapp_number text,
  p_opt_in boolean,
  p_selected_keywords text[],
  p_customer_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF p_whatsapp_number IS NULL OR length(trim(p_whatsapp_number)) < 8 THEN
    RAISE EXCEPTION 'invalid_whatsapp_number';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id AND s.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'inactive_or_unknown_store';
  END IF;

  INSERT INTO public.customers (
    store_id,
    whatsapp_number,
    opt_in,
    selected_keywords,
    customer_name
  )
  VALUES (
    p_store_id,
    trim(p_whatsapp_number),
    COALESCE(p_opt_in, TRUE),
    p_selected_keywords,
    NULLIF(trim(p_customer_name), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_store_customer_lead(uuid, text, boolean, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_store_customer_lead(uuid, text, boolean, text[], text) TO anon;
GRANT EXECUTE ON FUNCTION public.capture_store_customer_lead(uuid, text, boolean, text[], text) TO authenticated;

COMMENT ON FUNCTION public.capture_store_customer_lead(uuid, text, boolean, text[], text)
  IS 'Public review flow WhatsApp CRM capture — RLS-safe insert via txn-local row_security off';
