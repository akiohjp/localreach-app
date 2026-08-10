import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { isValidUuid } from '@/lib/is-valid-uuid'

/**
 * Register (or drop) one device for a store's feedback notifications.
 *
 * Auth matters here in a way it does not for /api/feedback: a subscription says
 * "send this store's guest comments to this endpoint", so an unauthenticated
 * caller could quietly wire another store's feedback to their own device. The
 * signed-in user must own the store.
 */

type Payload = {
  store_id?: unknown
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

function bad(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status })
}

async function assertOwner(storeId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return false
  // RLS on `stores` already limits the row to the owner; an empty result is
  // therefore both "no such store" and "not yours", which is what we want.
  const { data } = await supabase.from('stores').select('id').eq('id', storeId).maybeSingle()
  return !!data
}

export async function POST(request: Request) {
  let payload: Payload
  try {
    payload = (await request.json()) as Payload
  } catch {
    return bad('Invalid JSON body.', 400)
  }

  const storeId = typeof payload.store_id === 'string' ? payload.store_id.trim() : ''
  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : ''
  const p256dh = typeof payload.keys?.p256dh === 'string' ? payload.keys.p256dh : ''
  const auth = typeof payload.keys?.auth === 'string' ? payload.keys.auth : ''

  if (!isValidUuid(storeId)) return bad('Invalid store_id.', 400)
  if (!endpoint.startsWith('https://')) return bad('Invalid endpoint.', 400)
  if (!p256dh || !auth) return bad('Missing keys.', 400)
  if (!(await assertOwner(storeId))) return bad('Not your store.', 403)

  const admin = createAdminClient()
  // Re-subscribing on the same device returns the same endpoint, and a device
  // that was retired can come back — clearing expired_at revives it.
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      store_id: storeId,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      expired_at: null,
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    console.error('[push] subscribe failed', error)
    return bad('Could not save the subscription.', 500)
  }
  return Response.json({ ok: true })
}

export async function DELETE(request: Request) {
  let payload: Payload
  try {
    payload = (await request.json()) as Payload
  } catch {
    return bad('Invalid JSON body.', 400)
  }
  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : ''
  const storeId = typeof payload.store_id === 'string' ? payload.store_id.trim() : ''
  if (!endpoint || !isValidUuid(storeId)) return bad('Invalid payload.', 400)
  if (!(await assertOwner(storeId))) return bad('Not your store.', 403)

  const admin = createAdminClient()
  const { error } = await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) {
    console.error('[push] unsubscribe failed', error)
    return bad('Could not remove the subscription.', 500)
  }
  return Response.json({ ok: true })
}
