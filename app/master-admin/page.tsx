import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/utils/supabase/admin'
import { getLocalizedText, type LocalizedText, type SupportedLocale } from '@/types/database'
import { getMasterSessionEmail } from '@/lib/master-session-server'
import { isMissingColumnError } from '@/lib/supabase-errors'
import { qrHost } from '@/lib/store-links'
import MasterDashboard from './MasterDashboard'

export const metadata: Metadata = { title: 'Master Admin — LocalReach' }

export default async function MasterAdminPage() {
  const master = await getMasterSessionEmail()
  if (!master) redirect('/master-admin/login')

  const admin = createAdminClient()
  const BASE = 'id, store_name, default_language, is_active, subscription_expires_at, created_at, customers(count)'
  type MasterStoreRow = {
    id: string
    store_name: LocalizedText
    default_language: SupportedLocale
    is_active: boolean
    subscription_expires_at: string | null
    created_at: string
    customers: unknown
    /** Absent only while the 2026-09-06 migrations have not reached this database. */
    ai_review_enabled?: boolean
    slug?: string | null
  }
  // Deploy-order guard: the 2026-09-06 columns (ai_review_enabled, slug)
  // arrive with their migrations; until then the toggle reads off and the
  // short link is simply not shown.
  let stores: MasterStoreRow[] | null = null
  for (const cols of [`${BASE}, ai_review_enabled, slug`, `${BASE}, ai_review_enabled`, BASE]) {
    const res = await admin.from('stores').select(cols).order('created_at', { ascending: false })
    if (!res.error) {
      stores = res.data as unknown as MasterStoreRow[] | null
      break
    }
    if (!isMissingColumnError(res.error, 'slug') && !isMissingColumnError(res.error, 'ai_review_enabled')) break
  }

  const rows = (stores ?? []).map((s) => {
    const countArr = s.customers as unknown as { count: number }[] | null
    return {
      id: s.id,
      name:
        getLocalizedText(s.store_name, s.default_language, s.default_language) ||
        '(unnamed)',
      isActive: s.is_active,
      expiresAt: s.subscription_expires_at,
      aiDrafts: Boolean(s.ai_review_enabled),
      slug: s.slug ?? null,
      createdAt: s.created_at,
      customerCount: Number(countArr?.[0]?.count ?? 0),
    }
  })

  return <MasterDashboard rows={rows} qrHost={qrHost()} />
}
