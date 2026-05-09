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
  | { ok: true; store: NewStoreRow; reusedAuthUser: boolean }
  | { ok: false; error: string }

async function masterUnauthorized(): Promise<{ ok: false; error: string } | null> {
  const email = await getMasterSessionEmail()
  if (!email) {
    return { ok: false, error: 'Unauthorized — sign in at /master-admin/login.' }
  }
  return null
}

/** Supabase Auth allows one user per email; duplicate createUser → reuse that user for another store. */
function isDuplicateEmailAuthMessage(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('already been registered') ||
    m.includes('already registered') ||
    m.includes('user already registered') ||
    (m.includes('duplicate') && m.includes('email'))
  )
}

const USER_LOOKUP_MAX_PAGES = 100

async function lookupAuthUserIdByEmail(
  adminClient: ReturnType<typeof createAdminClient>,
  emailNorm: string,
): Promise<string | null> {
  for (let page = 1; page <= USER_LOOKUP_MAX_PAGES; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return null
    const users = data.users ?? []
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === emailNorm)
    if (hit) return hit.id
    if (users.length < 1000) break
  }
  return null
}

function formatSupabaseActionError(context: string, raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('econnrefused')) {
    return (
      `${context}: ${raw} — ` +
      'Supabase にサーバーから届いていません。Vercel の Environment Variables で ' +
      'Preview（および Development）にも `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を設定し、再デプロイしてください。'
    )
  }
  return `${context}: ${raw}`
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

  const emailTrim = payload.email.trim()
  const emailNorm = emailTrim.toLowerCase()

  try {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: emailTrim,
      password: payload.password,
      email_confirm: true,
    })

    let ownerId: string
    let reusedAuthUser = false

    if (authError?.message && isDuplicateEmailAuthMessage(authError.message)) {
      const existingId = await lookupAuthUserIdByEmail(adminClient, emailNorm)
      if (!existingId) {
        return {
          ok: false,
          error:
            'Auth: メールアドレスは既に登録済みですが、既存ユーザーを検索できませんでした。',
        }
      }
      ownerId = existingId
      reusedAuthUser = true
      const { error: pwErr } = await adminClient.auth.admin.updateUserById(existingId, {
        password: payload.password,
      })
      if (pwErr) {
        return {
          ok: false,
          error: formatSupabaseActionError('Auth', pwErr.message ?? 'パスワード更新に失敗しました。'),
        }
      }
    } else if (authError || !authData?.user) {
      const msg = authError?.message ?? 'Failed to create auth user.'
      return { ok: false, error: formatSupabaseActionError('Auth', msg) }
    } else {
      ownerId = authData.user.id
    }

    const { data: store, error: storeError } = await adminClient
      .from('stores')
      .insert({
        owner_id: ownerId,
        store_name: { en: payload.storeName.trim() },
        google_review_url: '',
        is_active: true,
      })
      .select('id, store_name, default_language, is_active, created_at')
      .single()

    if (storeError || !store) {
      if (!reusedAuthUser) {
        await adminClient.auth.admin.deleteUser(ownerId)
      }
      const msg = storeError?.message ?? 'Failed to create store record.'
      return { ok: false, error: formatSupabaseActionError('Database', msg) }
    }

    return {
      ok: true,
      reusedAuthUser,
      store: {
        id: store.id,
        name: (store.store_name as { en?: string })?.en ?? payload.storeName.trim(),
        isActive: store.is_active,
        createdAt: store.created_at,
        customerCount: 0,
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: formatSupabaseActionError('Request', msg),
    }
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
