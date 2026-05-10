import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolveStoreLogoForViewer } from '@/lib/resolve-store-logo-url'
import { getLocalizedText } from '@/types/database'
import StoreDashboard from './StoreDashboard'

export const metadata: Metadata = { title: 'Store Dashboard — LocalReach' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminStorePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // RLS enforces access: only the owner or super-admin can read this row
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('id', id)
    .single()

  if (!store) notFound()

  // Auth check: store owner only (マスターコンソールは /master-admin で運用し、JWT の super_admin とは別)
  if (store.owner_id !== user.id) redirect('/admin/login')

  if (!store.is_active) redirect('/inactive')

  const storeName = getLocalizedText(
    store.store_name,
    store.default_language,
    store.default_language,
  )

  // CRM stats — use service-role client to bypass RLS and get accurate counts
  const admin = createAdminClient()
  const { data: recentCustomers, count: customerCount } = await admin
    .from('customers')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select('customer_name, whatsapp_number, opt_in, selected_keywords, created_at' as any, { count: 'exact' })
    .eq('store_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const storeUrl = `${appUrl}/store/${store.id}`

  const logoSignedUrl = await resolveStoreLogoForViewer(store.logo_url)

  return (
    <StoreDashboard
      store={store}
      storeName={storeName}
      storeUrl={storeUrl}
      customerCount={customerCount ?? 0}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentCustomers={(recentCustomers ?? []) as any}
      logoSignedUrl={logoSignedUrl}
    />
  )
}
