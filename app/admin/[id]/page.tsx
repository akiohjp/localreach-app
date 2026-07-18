import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolveStoreLogoForViewer } from '@/lib/resolve-store-logo-url'
import { isStoreCurrentlyActive } from '@/lib/subscription'
import { getLocalizedText } from '@/types/database'
import { qrPngDataUrl } from '@/lib/qr'
import StoreDashboard from './StoreDashboard'

export const metadata: Metadata = { title: 'Store Dashboard — LocalReach' }

type SupabaseColumnError = { code?: string; message?: string; details?: string; hint?: string }
type RecentCustomerRow = {
  customer_name?: string | null
  whatsapp_number: string
  opt_in: boolean
  selected_keywords: string[] | null
  created_at: string
}

function isMissingCustomerNameColumn(error: SupabaseColumnError | null): boolean {
  if (!error) return false
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return (
    (error.code === '42703' || error.code === 'PGRST204' || text.includes('column')) &&
    text.includes('customer_name')
  )
}

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminStorePage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab } = await searchParams
  const initialTab =
    tab === 'customers' || tab === 'settings' ? tab : ('grow' as const)
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

  // Effective active = kill switch AND contract not expired. The public QR page
  // gets this via the public_store_review view; the dashboard reads the base
  // table, so it must apply the same rule or an expired store keeps dashboard
  // access (edits content, burns AI-reply quota) after lockout. Owners go to the
  // owner-facing paused screen — the guest /inactive page has no sign-out.
  if (!isStoreCurrentlyActive(store)) redirect('/admin/paused')

  const storeName = getLocalizedText(
    store.store_name,
    store.default_language,
    store.default_language,
  )

  // CRM stats — use service-role client to bypass RLS and get accurate counts
  const admin = createAdminClient()
  const customersWithName = await admin
    .from('customers')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select('customer_name, whatsapp_number, opt_in, selected_keywords, created_at' as any, { count: 'exact' })
    .eq('store_id', id)
    .order('created_at', { ascending: false })
    .limit(5)
  let recentCustomers = customersWithName.data as unknown as RecentCustomerRow[] | null
  let customerCount = customersWithName.count
  if (isMissingCustomerNameColumn(customersWithName.error)) {
    const customersWithoutName = await admin
      .from('customers')
      .select('whatsapp_number, opt_in, selected_keywords, created_at', { count: 'exact' })
      .eq('store_id', id)
      .order('created_at', { ascending: false })
      .limit(5)
    recentCustomers = customersWithoutName.data as RecentCustomerRow[] | null
    customerCount = customersWithoutName.count
  }
  let crmLoadError = false
  if (customersWithName.error && !isMissingCustomerNameColumn(customersWithName.error)) {
    // Any other error (transient network, rotated service key) would otherwise
    // render as a misleading "0 customers" — log it AND surface an error state.
    console.error('[admin] customers query failed for store', id, customersWithName.error)
    crmLoadError = true
  }

  // Private low-rating (<4★) feedback — service-role read, scoped to this store.
  const feedbackRes = await admin
    .from('feedback')
    .select('id, rating, message, created_at', { count: 'exact' })
    .eq('store_id', id)
    .order('created_at', { ascending: false })
    .limit(30)
  if (feedbackRes.error) {
    console.error('[admin] feedback query failed for store', id, feedbackRes.error)
  }
  const feedback = (feedbackRes.data ?? []) as {
    id: string
    rating: number
    message: string
    created_at: string
  }[]
  const feedbackCount = feedbackRes.count ?? 0

  // NEXT_PUBLIC_APP_URL missing must NEVER silently mint localhost QR codes /
  // WhatsApp links in production — derive from the live request host instead.
  let appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    appUrl = host ? `${proto}://${host}` : 'http://localhost:3000'
    if (process.env.NODE_ENV === 'production') {
      console.error('[admin] NEXT_PUBLIC_APP_URL unset — derived', appUrl, 'from request host')
    }
  }
  const storeUrl = `${appUrl}/store/${store.id}`

  const logoSignedUrl = await resolveStoreLogoForViewer(store.logo_url)
  // Generated on the server so the store URL is never sent to a third-party QR API.
  const qrDataUrl = await qrPngDataUrl(storeUrl, 320)

  return (
    <StoreDashboard
      store={store}
      storeName={storeName}
      storeUrl={storeUrl}
      qrDataUrl={qrDataUrl}
      customerCount={customerCount ?? 0}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentCustomers={(recentCustomers ?? []) as any}
      crmLoadError={crmLoadError}
      feedback={feedback}
      feedbackCount={feedbackCount}
      logoSignedUrl={logoSignedUrl}
      initialTab={initialTab}
    />
  )
}
