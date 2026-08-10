import { createAdminClient } from '@/utils/supabase/admin'
import { isValidUuid } from '@/lib/is-valid-uuid'
import { isStoreCurrentlyActive } from '@/lib/subscription'
import { notifyStore } from '@/lib/push'

type FeedbackPayload = {
  store_id?: unknown
  rating?: unknown
  message?: unknown
  topics?: unknown
  contact_name?: unknown
  contact_phone?: unknown
}

/**
 * Fixed set, so the dashboard can count them. Free text stays the main field —
 * the chips exist because "the service was slow" is actionable and "it was bad"
 * is not, and a guest who is annoyed will tap before they will type.
 */
const TOPICS = ['service', 'wait', 'quality', 'cleanliness', 'price', 'other'] as const

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status })
}

function logAndHideError(context: string, error: unknown) {
  console.error(`[feedback] ${context}`, error)
  return jsonError('Could not save feedback.', 500)
}

/**
 * Writes a private note from a guest to the owner. Service-role only; no anon
 * table access.
 *
 * Any rating, not just under 4. A guest who had a good time and wants to tell
 * the owner one thing directly is the same mechanism, and offering the field to
 * everyone is also what keeps the flow from treating unhappy guests differently.
 */
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
  const topics = Array.isArray(payload.topics)
    ? [...new Set(payload.topics.filter((t): t is string => typeof t === 'string'))]
        .filter((t) => (TOPICS as readonly string[]).includes(t))
        .slice(0, TOPICS.length)
    : []
  const contactName =
    typeof payload.contact_name === 'string' ? payload.contact_name.trim().slice(0, 120) : ''
  const contactPhone =
    typeof payload.contact_phone === 'string' ? payload.contact_phone.trim().slice(0, 40) : ''

  if (!isValidUuid(storeId)) return jsonError('Invalid store_id.', 400)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonError('Invalid rating.', 400)
  }
  if (message.length === 0 && topics.length === 0) return jsonError('Empty feedback.', 400)

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
    .insert({
      store_id: storeId,
      rating,
      message,
      topics,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
    })
    .select('id')
    .single()

  if (error) return logAndHideError('insert failed', error)

  // Tell the owner's devices. Deliberately after the insert and deliberately
  // not awaited into the response path: a push service having a bad minute must
  // never turn a saved piece of feedback into an error the guest sees.
  void notifyStore(storeId, rating, message, topics).catch((err) =>
    console.error('[feedback] push notify failed', err),
  )

  return Response.json({ ok: true, id: data.id })
}
