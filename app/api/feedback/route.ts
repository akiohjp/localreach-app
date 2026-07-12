import { createAdminClient } from '@/utils/supabase/admin'
import { isValidUuid } from '@/lib/is-valid-uuid'
import { isStoreCurrentlyActive } from '@/lib/subscription'

type FeedbackPayload = {
  store_id?: unknown
  rating?: unknown
  message?: unknown
}

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status })
}

function logAndHideError(context: string, error: unknown) {
  console.error(`[feedback] ${context}`, error)
  return jsonError('Could not save feedback.', 500)
}

/** Writes private (<4★) guest feedback. Service-role only; no anon table access. */
export async function POST(request: Request) {
  let payload: FeedbackPayload
  try {
    payload = (await request.json()) as FeedbackPayload
  } catch {
    return jsonError('Invalid JSON body.', 400)
  }

  const storeId = typeof payload.store_id === 'string' ? payload.store_id.trim() : ''
  const rating = Number(payload.rating)
  const message =
    typeof payload.message === 'string' ? payload.message.trim().slice(0, 2000) : ''

  if (!isValidUuid(storeId)) return jsonError('Invalid store_id.', 400)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonError('Invalid rating.', 400)
  }
  if (message.length === 0) return jsonError('Empty message.', 400)

  const admin = createAdminClient()
  const { data: store, error: storeError } = await admin
    .from('stores')
    .select('id, is_active, subscription_expires_at')
    .eq('id', storeId)
    .maybeSingle()

  if (storeError) return logAndHideError('store lookup failed', storeError)
  if (!store || !isStoreCurrentlyActive(store)) {
    return jsonError('inactive_or_unknown_store', 404)
  }

  const { data, error } = await admin
    .from('feedback')
    .insert({ store_id: storeId, rating, message })
    .select('id')
    .single()

  if (error) return logAndHideError('insert failed', error)
  return Response.json({ ok: true, id: data.id })
}
