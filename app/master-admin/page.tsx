import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/utils/supabase/admin'
import { getLocalizedText } from '@/types/database'
import { getMasterSessionEmail } from '@/lib/master-session-server'
import MasterDashboard from './MasterDashboard'

export const metadata: Metadata = { title: 'Master Admin — LocalReach' }

export default async function MasterAdminPage() {
  const master = await getMasterSessionEmail()
  if (!master) redirect('/master-admin/login')

  const admin = createAdminClient()
  const { data: stores } = await admin
    .from('stores')
    .select('id, store_name, default_language, is_active, created_at, customers(count)')
    .order('created_at', { ascending: false })

  const rows = (stores ?? []).map((s) => {
    const countArr = s.customers as unknown as { count: number }[] | null
    return {
      id: s.id,
      name:
        getLocalizedText(s.store_name, s.default_language, s.default_language) ||
        '(unnamed)',
      isActive: s.is_active,
      createdAt: s.created_at,
      customerCount: Number(countArr?.[0]?.count ?? 0),
    }
  })

  return <MasterDashboard rows={rows} />
}
