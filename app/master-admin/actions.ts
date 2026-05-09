'use server'

import { getMasterSessionEmail } from '@/lib/master-session-server'
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

async function masterUnauthorized(): Promise<{ ok: false; error: string } | null> {
  const email = await getMasterSessionEmail()
  if (!email) {
    return { ok: false, error: 'Unauthorized — sign in at /master-admin/login.' }
  }
  return null
}

export async function createStore(payload: {
  storeName: string
  email: string
  password: string
}): Promise<CreateStoreResult> {
  const denied = await masterUnauthorized()
  if (denied) return denied

  let adminClient: ReturnType<typeof createAdminClient>
  try {
    adminClient = createAdminClient()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: payload.email.trim(),
    password: payload.password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return { ok: false, error: authError?.message ?? 'Failed to create auth user.' }
  }

  const newUserId = authData.user.id

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

export async function masterSetStoreActive(
  storeId: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const denied = await masterUnauthorized()
  if (denied) return denied

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('stores').update({ is_active: isActive }).eq('id', storeId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function masterExportCustomersCsv(
  storeId: string,
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const denied = await masterUnauthorized()
  if (denied) return denied

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('customers')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('customer_name, whatsapp_number, opt_in, selected_keywords, created_at' as any)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'No data.' }

    const header = 'customer_name,whatsapp_number,opt_in,selected_keywords,registered_at'
    const rowLines = (data as unknown as Array<Record<string, unknown>>).map((c) => {
      const name = c.customer_name ? `"${String(c.customer_name).replace(/"/g, '""')}"` : ''
      const keywords = Array.isArray(c.selected_keywords) ? c.selected_keywords.join('|') : ''
      return `${name},${c.whatsapp_number},${c.opt_in},"${keywords}",${c.created_at}`
    })
    const csv = '\ufeff' + [header, ...rowLines].join('\n')
    return { ok: true, csv }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
