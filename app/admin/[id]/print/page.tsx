import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { resolveStoreLogoForViewer } from '@/lib/resolve-store-logo-url'
import { isStoreCurrentlyActive } from '@/lib/subscription'
import { getLocalizedText } from '@/types/database'
import { localesForStore } from '@/lib/guest-locales'
import { qrPngDataUrl } from '@/lib/qr'
import PrintCard from './PrintCard'

export const metadata: Metadata = {
  title: 'Counter card — LocalReach',
  robots: { index: false, follow: false },
}

export default async function PrintCardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: store } = await supabase.from('stores').select('*').eq('id', id).single()
  if (!store) notFound()
  if (store.owner_id !== user.id) redirect('/admin/login')
  if (!isStoreCurrentlyActive(store)) redirect('/admin/paused')

  let appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (!appUrl) {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    appUrl = host ? `${proto}://${host}` : 'http://localhost:3000'
  }
  const storeUrl = `${appUrl}/store/${store.id}`

  // 1024px so the QR stays crisp at print DPI — the dashboard's 320px preview
  // is a screen thumbnail and prints visibly soft at card size.
  const qrDataUrl = await qrPngDataUrl(storeUrl, 1024)

  const storeName = getLocalizedText(
    store.store_name,
    store.default_language,
    store.default_language,
  )
  const logoUrl = await resolveStoreLogoForViewer(store.logo_url)

  return (
    <PrintCard
      storeName={storeName}
      storeUrl={storeUrl}
      qrDataUrl={qrDataUrl}
      brandColor={store.brand_color || '#0f172a'}
      logoUrl={logoUrl}
      locales={localesForStore(store)}
      backHref={`/admin/${store.id}`}
    />
  )
}
