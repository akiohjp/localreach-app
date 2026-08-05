import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { resolveStoreLogoForViewer } from '@/lib/resolve-store-logo-url'
import { isStoreCurrentlyActive } from '@/lib/subscription'
import { getLocalizedText, type SupportedLocale } from '@/types/database'
import { qrPngDataUrl } from '@/lib/qr'
import PrintCard from './PrintCard'

export const metadata: Metadata = {
  title: 'Counter card — LocalReach',
  robots: { index: false, follow: false },
}

const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'ja', 'ar']

/**
 * Same derivation the guest page uses: the locales the owner actually filled
 * in. A card printed for a Dubai counter should carry Arabic; one for a Tokyo
 * shop should not, and neither should invent a language the store never set up.
 */
function localesForStore(store: {
  default_language: SupportedLocale
  store_name: Record<string, string> | null
  greeting_text: Record<string, string> | null
}): SupportedLocale[] {
  const filled = new Set<string>([store.default_language])
  for (const src of [store.store_name, store.greeting_text]) {
    for (const [k, v] of Object.entries(src ?? {})) {
      if (typeof v === 'string' && v.trim()) filled.add(k)
    }
  }
  const list = SUPPORTED_LOCALES.filter((l) => filled.has(l))
  return list.length > 0 ? list : [store.default_language]
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
