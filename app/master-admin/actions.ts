'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export type NewStoreRow = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  customerCount: number
}

export type CreateStoreResult =
  | { ok: true; store: NewStoreRow }
  | { ok: false; error: string }

export async function createStore(payload: {
  storeName: string
  email: string
  password: string
}): Promise<CreateStoreResult> {
  // 1. Re-verify the caller is still a super_admin on every request
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'super_admin') {
    return { ok: false, error: 'Unauthorized.' }
  }

  // 2. Create auth user via Service Role — current session is untouched
  let adminClient: ReturnType<typeof createAdminClient>
  try {
    adminClient = createAdminClient()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: payload.email.trim(),
    password: payload.password,
    email_confirm: true, // skip email verification for admin-created accounts
  })

  if (authError || !authData.user) {
    return { ok: false, error: authError?.message ?? 'Failed to create auth user.' }
  }

  const newUserId = authData.user.id

  // 3. Insert store record linked to the new user
  const { data: store, error: storeError } = await adminClient
    .from('stores')
    .insert({
      owner_id: newUserId,
      store_name: { en: payload.storeName.trim() },
      google_review_url: '',
      is_active: true,
    })
    .select('id, store_name, default_language, is_active, created_at')
    .single()

  if (storeError || !store) {
    // Rollback: remove the orphaned auth user
    await adminClient.auth.admin.deleteUser(newUserId)
    return { ok: false, error: storeError?.message ?? 'Failed to create store record.' }
  }

  return {
    ok: true,
    store: {
      id: store.id,
      name: (store.store_name as { en?: string })?.en ?? payload.storeName.trim(),
      isActive: store.is_active,
      createdAt: store.created_at,
      customerCount: 0,
    },
  }
}
