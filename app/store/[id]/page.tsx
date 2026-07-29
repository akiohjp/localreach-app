import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { getLocalizedText, isRtlLocale, type SupportedLocale } from '@/types/database'
import { resolveStoreLogoForViewer } from '@/lib/resolve-store-logo-url'
import ReviewFlow from './ReviewFlow'

const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'ja', 'ar']
const LOCALE_LABELS: Record<SupportedLocale, string> = { en: 'EN', ja: 'JA', ar: 'AR' }

// React cache deduplicates the Supabase query between generateMetadata and Page.
// Reads the anon-safe VIEW (not the base table) so the public anon key can never
// pull owner_id / notification_email of any store. See migration
// 20260701120000_stores_public_review_view.sql.
const getStore = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('public_store_review')
    .select(
      'id, store_name, greeting_text, keywords, forced_keywords, google_review_url, brand_color, default_language, is_active, logo_url, business_category, entity_area, entity_city, entity_category_label',
    )
    .eq('id', id)
    .single()
  return data ?? null
})

// ----------------------------------------------------------------
// Metadata
// ----------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const store = await getStore(id)
  if (!store) return { title: 'Store Not Found' }

  const lang = store.default_language
  const name = getLocalizedText(store.store_name, lang, lang)
  const greeting = getLocalizedText(store.greeting_text, lang, lang)
  return {
    title: `Leave a Review — ${name}`,
    description: greeting || undefined,
  }
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------
interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function StorePage({ params, searchParams }: Props) {
  const { id } = await params
  const { lang } = await searchParams

  const store = await getStore(id)
  if (!store) notFound()
  if (!store.is_active) redirect('/inactive')

  // Locale resolution: ?lang= override → store default → 'en'
  const locale: SupportedLocale = SUPPORTED_LOCALES.includes(lang as SupportedLocale)
    ? (lang as SupportedLocale)
    : store.default_language

  const isRtl = isRtlLocale(locale)
  const storeName = getLocalizedText(store.store_name, locale, store.default_language)
  const greetingText = getLocalizedText(store.greeting_text, locale, store.default_language)
  const logoSignedUrl = await resolveStoreLogoForViewer(store.logo_url)

  return (
    // dir is set here so the language switcher links also respect RTL
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-[100dvh] bg-slate-50 flex items-start justify-center
        px-4 pt-[max(3rem,env(safe-area-inset-top))]
        pb-[calc(3rem+env(safe-area-inset-bottom))]"
    >
      <div className="w-full max-w-sm">

        {/* Top meta row: brand + language switcher */}
        <div className="mb-5 px-1 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach
          </span>
          <div className="flex gap-1.5">
            {SUPPORTED_LOCALES.map((l) => (
              <a
                key={l}
                href={`?lang=${l}`}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider transition-colors ${
                  l === locale
                    ? 'text-white'
                    : 'bg-white text-slate-400 border border-gray-200 hover:border-slate-400 hover:text-slate-600'
                }`}
                style={l === locale ? { backgroundColor: store.brand_color } : undefined}
              >
                {LOCALE_LABELS[l]}
              </a>
            ))}
          </div>
        </div>

        {/* Interactive review card (Client Component) */}
        <ReviewFlow
          storeId={store.id}
          storeName={storeName}
          greetingText={greetingText}
          keywords={store.keywords}
          forcedKeywords={store.forced_keywords ?? []}
          googleReviewUrl={store.google_review_url}
          brandColor={store.brand_color}
          isRtl={isRtl}
          locale={locale}
          logoUrl={logoSignedUrl}
          businessCategory={store.business_category}
          entityArea={store.entity_area ?? null}
          entityCity={store.entity_city ?? null}
          entityCategoryLabel={(store.entity_category_label as Record<string, string> | null) ?? null}
        />

        <p className="text-center text-[10px] text-slate-400 mt-5 tracking-widest uppercase">
          Powered by LocalReach
        </p>
      </div>
    </main>
  )
}
