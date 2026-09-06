import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchStoreById, storeMetadata, StoreReviewPage } from '../store-review-page'

/**
 * /store/<uuid> — the original guest link. Printed on every QR card issued
 * before 2026-09-06 and kept valid for good; the short /r/<slug> address
 * renders the same page (app/store/store-review-page.tsx).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return storeMetadata(await fetchStoreById(id))
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { id } = await params
  const { lang } = await searchParams

  const store = await fetchStoreById(id)
  if (!store) notFound()
  if (!store.is_active) redirect('/inactive')

  return <StoreReviewPage store={store} lang={lang} />
}
