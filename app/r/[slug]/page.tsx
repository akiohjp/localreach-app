import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchStoreBySlug, storeMetadata, StoreReviewPage } from '../../store/store-review-page'

/**
 * /r/<slug> — the short guest link. Guests reach it as
 * https://<NEXT_PUBLIC_QR_HOST>/<slug>: middleware.ts rewrites that path here
 * on the QR host, so the address bar keeps the short form. Same page, same
 * data as /store/<uuid>.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return storeMetadata(await fetchStoreBySlug(slug))
}

export default async function ShortStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { slug } = await params
  const { lang } = await searchParams

  const store = await fetchStoreBySlug(slug)
  if (!store) notFound()
  if (!store.is_active) redirect('/inactive')

  return <StoreReviewPage store={store} lang={lang} />
}
