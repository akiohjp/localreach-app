-- Security hardening: advisor issues (non-Auth-email related).
-- Apply in production after backup; logos require SERVICE_ROLE signing in the app layer.

-- 1) Sandbox table left behind in dashboard / SQL experiments
DROP TABLE IF EXISTS public.test_table;

-- 2) Normalize stores.logo_url: full public URLs → bucket-relative path (uuid/filename...)
UPDATE public.stores
SET logo_url = split_part(split_part(logo_url, '/object/public/store-logos/', 2), '?', 1)
WHERE logo_url IS NOT NULL
  AND logo_url LIKE '%/object/public/store-logos/%';

-- 3) Immutable search_path for security-sensitive functions (linter-friendly)
ALTER FUNCTION public.set_updated_at() SET search_path TO public;
ALTER FUNCTION public.is_super_admin() SET search_path TO public;

-- 4) Replace permissive anon INSERT on customers with a SECURITY DEFINER RPC
DROP POLICY IF EXISTS "public_insert" ON public.customers;

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
  IS 'Public review flow WhatsApp CRM capture — replaces permissive INSERT policy';

-- 5) Private logo bucket — remove world-readable SELECT; owners read own prefix only
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'store-logos';

DROP POLICY IF EXISTS "public_read_logo" ON storage.objects;
DROP POLICY IF EXISTS "owner_read_own_logo_objects" ON storage.objects;

CREATE POLICY "owner_read_own_logo_objects"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'store-logos'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);
