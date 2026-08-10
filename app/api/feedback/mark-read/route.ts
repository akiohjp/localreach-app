import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { isValidUuid } from '@/lib/is-valid-uuid'

/**
 * Clear the unread badge for a store.
 *
 * Goes through a route rather than the browser client because `feedback` is
 * service-role only — the dashboard already reads it that way. The signed-in
 * user must own the store, or one owner could mark another's notes as read.
 */
export async function POST(request: Request) {
  let storeId = ''
  try {
    const body = (await request.json()) as { store_id?: unknown }
    storeId = typeof body.store_id === 'string' ? body.store_id.trim() : ''
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  if (!isValidUuid(storeId)) {
    return Response.json({ ok: false, error: 'Invalid store_id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return Response.json({ ok: false, error: 'Not signed in.' }, { status: 401 })
  // RLS on `stores` scopes this to the owner, so an empty row means "not yours".
  const { data: owned } = await supabase.from('stores').select('id').eq('id', storeId).maybeSingle()
  if (!owned) return Response.json({ ok: false, error: 'Not your store.' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('feedback')
    .update({ read_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .is('read_at', null)

  if (error) {
    console.error('[feedback] mark-read failed', error)
    return Response.json({ ok: false, error: 'Could not update.' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
