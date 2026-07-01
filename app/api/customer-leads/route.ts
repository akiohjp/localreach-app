import { createAdminClient } from '@/utils/supabase/admin'
import { isValidUuid } from '@/lib/is-valid-uuid'

type LeadPayload = {
  store_id?: unknown
  whatsapp_number?: unknown
  opt_in?: unknown
  selected_keywords?: unknown
  customer_name?: unknown
}

type SupabaseColumnError = { code?: string; message?: string; details?: string; hint?: string }

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status })
}

function logAndHideError(context: string, error: unknown) {
  console.error(`[customer-leads] ${context}`, error)
  return jsonError('Could not save lead.', 500)
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function cleanKeywords(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const keywords = value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((v) => v.slice(0, 80))
  return keywords.length > 0 ? keywords : null
}

function isMissingCustomerNameColumn(error: SupabaseColumnError | null): boolean {
  if (!error) return false
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return (
    (error.code === '42703' || error.code === 'PGRST204' || text.includes('column')) &&
    text.includes('customer_name')
  )
}

export async function POST(request: Request) {
  let payload: LeadPayload
  try {
    payload = (await request.json()) as LeadPayload
  } catch {
    return jsonError('Invalid JSON body.', 400)
  }

  const storeId = cleanString(payload.store_id, 80)
  const whatsappNumber = cleanString(payload.whatsapp_number, 32).replace(/[^\d+]/g, '')
  const customerName = cleanString(payload.customer_name, 120)

  // Single validated write path for ALL stores (service-role, server-side).
  // Replaces the browser anon RPC/insert so leads can't bypass validation.
  if (!isValidUuid(storeId)) return jsonError('Invalid store_id.', 400)
  if (!/^\+[1-9]\d{7,14}$/.test(whatsappNumber)) {
    return jsonError('Invalid whatsapp_number.', 400)
  }

  const admin = createAdminClient()
  const { data: store, error: storeError } = await admin
    .from('stores')
    .select('id, is_active')
    .eq('id', storeId)
    .maybeSingle()

  if (storeError) return logAndHideError('store lookup failed', storeError)
  if (!store?.is_active) return jsonError('inactive_or_unknown_store', 404)

  const row = {
    store_id: storeId,
    whatsapp_number: whatsappNumber,
    opt_in: typeof payload.opt_in === 'boolean' ? payload.opt_in : true,
    selected_keywords: cleanKeywords(payload.selected_keywords),
    customer_name: customerName || null,
  }
  const legacyRow = {
    store_id: row.store_id,
    whatsapp_number: row.whatsapp_number,
    opt_in: row.opt_in,
    selected_keywords: row.selected_keywords,
  }

  let insertResult = await admin.from('customers').insert(row).select('id').single()
  if (isMissingCustomerNameColumn(insertResult.error)) {
    insertResult = await admin.from('customers').insert(legacyRow).select('id').single()
  }

  if (insertResult.error) return logAndHideError('insert failed', insertResult.error)
  return Response.json({ ok: true, id: insertResult.data.id })
}
