import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/utils/supabase/admin'
import { getLocalizedText, type LocalizedText, type SupportedLocale } from '@/types/database'
import { getMasterSessionEmail } from '@/lib/master-session-server'
import { isMissingColumnError } from '@/lib/supabase-errors'
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
    /** Absent only while the 2026-09-06 migration has not reached this database. */
    ai_review_enabled?: boolean
  }
  const first = await admin
    .from('stores')
    .select(`${BASE}, ai_review_enabled`)
    .order('created_at', { ascending: false })
  let stores = first.data as unknown as MasterStoreRow[] | null
  // Deploy-order guard: the AI-drafts column arrives with migration
  // 20260906120000_ai_review_drafts.sql; until then the toggle just reads off.
  if (isMissingColumnError(first.error, 'ai_review_enabled')) {
    const second = await admin.from('stores').select(BASE).order('created_at', { ascending: false })
    stores = second.data as unknown as MasterStoreRow[] | null
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
      createdAt: s.created_at,
      customerCount: Number(countArr?.[0]?.count ?? 0),
    }
  })

  return <MasterDashboard rows={rows} />
}
