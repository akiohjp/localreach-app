'use client'

import { useEffect, useState } from 'react'
import { createReviewNonce, generateReview } from '@/lib/assembler'
import StepRating from '@/components/StepRating'
import StepKeywords from '@/components/StepKeywords'
import StepGenerating from '@/components/StepGenerating'
import StepResult from '@/components/StepResult'
import StepFeedback from '@/components/StepFeedback'
import StepFeedbackSent from '@/components/StepFeedbackSent'
import type { Step } from '@/lib/config'
import type { ContactChannel, SupportedLocale } from '@/types/database'
import { getUiStrings } from '@/lib/ui-strings'
import { useFlowPersistence } from '@/lib/use-flow-persistence'

/**
 * Trim + de-duplicate the guest's selection, preserving order.
 *
 * This replaced mergeGuestAndForced() on 2026-08-03. That helper prepended the
 * store's forced keywords to whatever the guest chose, which meant a phrase the
 * guest had never been shown ended up in a review published under their name.
 * Core phrases are now offered as pre-ticked, removable pills instead, so by the
 * time selection reaches here it is entirely the guest's own.
 */
function dedupeKeywords(selected: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const k of selected) {
    const t = k.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

// Steps that show the progress bar
const POSITIVE_STEPS: Step[] = ['rating', 'keywords', 'generating', 'result']

// Native language names for the guest's review-language picker (self-referential,
// so they read correctly whatever the surrounding UI language is).
const LANG_LABEL: Record<SupportedLocale, string> = {
  en: 'English',
  ja: '日本語',
  ar: 'العربية',
}

/**
 * Generation itself is instant (zero API); this brief pause is deliberate so
 * the "crafting your review" beat registers as real work. Kept short and
 * matched exactly by StepGenerating's determinate progress bar, so the wait
 * feels bounded instead of laggy.
 */
const GENERATE_DELAY_MS = 900

type Props = {
  storeId: string
  storeName: string       // pre-resolved by Server Component (locale-aware)
  greetingText: string    // pre-resolved
  keywords: string[]
  /** The store's core phrases. Offered as pre-ticked, removable pills — never injected. */
  forcedKeywords: string[]
  googleReviewUrl: string
  brandColor: string      // hex, e.g. "#f59e0b" — drives card accent + progress bar
  isRtl: boolean          // true when locale === 'ar'
  locale: SupportedLocale // resolved locale — drives UI copy (en/ja/ar)
  /**
   * Locales this store actually offers (derived from what the owner filled in).
   * The review-language picker used to always add EN + AR because every store
   * was in the UAE; a Japanese store must not offer Arabic.
   */
  availableLocales?: SupportedLocale[]
  logoUrl?: string | null
  businessCategory?: string | null
  /**
   * Guest contact block: which channel to ask for and which dial code to
   * pre-fill. Store-level because WhatsApp/+971 is not universal (JP = SMS/+81).
   */
  contactChannel?: ContactChannel
  contactDialCode?: string | null
  /** Entity layer (AI visibility) — woven once per review by the engine. */
  entityArea?: string | null
  entityCity?: string | null
  entityCategoryLabel?: Record<string, string> | null
  /** stores.keyword_types — what each keyword names. See classifyKeyword. */
  keywordTypes?: Record<string, string> | null
}

export default function ReviewFlow({
  storeId,
  storeName,
  greetingText,
  keywords,
  forcedKeywords,
  googleReviewUrl,
  brandColor,
  isRtl,
  locale,
  availableLocales,
  logoUrl,
  businessCategory,
  contactChannel,
  contactDialCode,
  entityArea,
  entityCity,
  entityCategoryLabel,
  keywordTypes,
}: Props) {
  const entity = {
    area: entityArea ?? null,
    city: entityCity ?? null,
    categoryLabel: entityCategoryLabel ?? null,
  }
  // Shown on every screen so staff (and the guest) can see at a glance WHICH
  // branch this QR belongs to. Falls back to the city when no area is set.
  const branchLabel = [entityArea, entityCity].filter(Boolean).join(', ') || null
  const t = getUiStrings(locale)
  const [step, setStep] = useState<Step>('rating')
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  // The guest picks which language the REVIEW is generated in (independent of the
  // page UI). Defaults to the page locale.
  const [reviewLocale, setReviewLocale] = useState<SupportedLocale>(locale)

  // Options for the review-language picker: the page locale first, then the other
  // locales THIS store offers. It used to always append EN + AR (a UAE-only
  // assumption) — a Japanese store must not offer Arabic. Deduped, order-preserving.
  const reviewLocaleOptions = Array.from(
    new Set<SupportedLocale>([locale, ...(availableLocales ?? [locale])]),
  ).map((code) => ({ code, label: LANG_LABEL[code] }))

  // Survive an accidental reload so a generated review isn't lost back to rating.
  useFlowPersistence(
    storeId,
    { step, rating, reviewText, selectedKeywords, reviewLocale },
    (s) => {
      setStep(s.step as Step)
      setRating(s.rating)
      setReviewText(s.reviewText)
      setSelectedKeywords(s.selectedKeywords)
      // Restore the language the text was generated in, or the result screen
      // mislabels it after the top language switcher navigates (wrong sl= too).
      if (s.reviewLocale === 'en' || s.reviewLocale === 'ja' || s.reviewLocale === 'ar') {
        setReviewLocale(s.reviewLocale)
      }
      // A reload mid-flow restored the keywords step with no core phrases
      // offered (forcedOffered is not persisted) — safe-direction failure, but
      // the store silently lost its discoverability phrases. Re-rotate.
      if ((s.step as Step) === 'keywords') rotateForced()
    },
  )

  // The shared root layout hardcodes <html lang="en">; reflect the page locale
  // on the document element for a11y / auto-translate / SEO correctness.
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  const progressIdx = POSITIVE_STEPS.indexOf(step)

  function hasAnyConfiguredKeywords(): boolean {
    return (
      forcedKeywords.some((k) => k.trim()) ||
      keywords.some((k) => k.trim())
    )
  }

  /**
   * How many of the store's core phrases are offered to one guest. See the
   * comment above `pillKeywords`: all of them in every review is a keyword dump,
   * so they rotate.
   */
  const FORCED_OFFERED_MAX = 2

  /**
   * Which core phrases this guest is offered. Chosen on the client when the
   * guest reaches the keyword step, NOT during render — a random pick in render
   * would differ between the server and hydration.
   */
  const [forcedOffered, setForcedOffered] = useState<string[]>([])

  // ratingValue is passed explicitly because handleRating calls this right
  // after setRating — the `rating` state is still stale in that same tick.
  async function proceedToGenerate(guestSelected: string[], ratingValue: number = rating) {
    // Exactly what the guest left switched on — nothing is appended here. The
    // store's core phrases reach this point only because the guest kept them
    // ticked in StepKeywords, which is what makes them the guest's own content
    // rather than content we requested be included.
    const merged = dedupeKeywords(guestSelected)
    setSelectedKeywords(merged)
    setStep('generating')
    await new Promise((r) => setTimeout(r, GENERATE_DELAY_MS))
    setReviewText(
      generateReview(storeName, merged, {
        nonce: createReviewNonce(),
        outletKey: `${storeId}|${businessCategory ?? ''}|${brandColor}`,
        locale: reviewLocale,
        category: businessCategory,
        rating: ratingValue,
        entity,
        keywordTypes,
      }),
    )
    setStep('result')
  }

  /**
   * Regenerate the current review in a specific language (guest picked it on the
   * result step). Returns the new text so StepResult can swap its local copy.
   */
  function generateInLocale(loc: SupportedLocale): string {
    setReviewLocale(loc)
    const next = generateReview(storeName, selectedKeywords, {
      nonce: createReviewNonce(),
      outletKey: `${storeId}|${businessCategory ?? ''}|${brandColor}`,
      locale: loc,
      category: businessCategory,
      rating,
      entity,
      keywordTypes,
    })
    setReviewText(next)
    return next
  }

  function handleRating(value: number) {
    setRating(value)
    if (value < 4) {
      // Not a gate: the feedback step offers the SAME Google review link a happy
      // guest gets, side by side with the private option, and keeps offering it
      // after sending. What changes is only that no draft is assembled — a low
      // rater writes their own words, because putting words in an unhappy
      // guest's mouth is exactly what Google's solicitation policy forbids.
      // Routing low raters to a private-only path would be "selectively solicit
      // positive reviews" (support.google.com/business/answer/7400114).
      setStep('feedback')
      return
    }
    if (!hasAnyConfiguredKeywords()) {
      void proceedToGenerate([], value)
      return
    }
    rotateForced()
    setStep('keywords')
  }

  /**
   * Pick which core phrases this guest is offered. Runs from event handlers and
   * the persistence-restore callback (both client-only), never during render —
   * a random pick in render would not match what the server sent.
   */
  function rotateForced() {
    const pool = [...cleanForced]
    const picked: string[] = []
    // At most ONE buyer-search geo phrase ("pizza in Dubai") per guest: two
    // search phrases side by side read as spam to the guest AND concentrate
    // the engine's geo frames until they repeat across the store's page
    // (diversity gate caught 17-20x/100 with two per review, 2026-08-03).
    // Mirrors lib/review-engine isGeoPhrase.
    const GEO_RE = /\b(in|near|around)\s+[A-Z]/
    let geoTaken = false
    while (pool.length > 0 && picked.length < FORCED_OFFERED_MAX) {
      const [k] = pool.splice(Math.floor(Math.random() * pool.length), 1)
      if (!k) break
      const isGeo = /^[\x20-\x7E]+$/.test(k) && GEO_RE.test(k)
      if (isGeo && geoTaken) continue
      if (isGeo) geoTaken = true
      picked.push(k)
    }
    setForcedOffered(picked)
  }

  async function handleKeywords(guestSelected: string[]) {
    await proceedToGenerate(guestSelected)
  }

  const cleanForced = [...new Set(forcedKeywords.map((k) => k.trim()).filter(Boolean))]
  const forcedSet = new Set(cleanForced)
  const guestPills = keywords.map((k) => k.trim()).filter((k) => k && !forcedSet.has(k))

  // The store's own core phrases are OFFERED, never injected: they render as
  // ordinary pills, switched on by default, and the guest can switch any of them
  // off — so what the guest sees selected is exactly what the draft contains.
  //
  // Google prohibits "request[ing] that specific content be included" and
  // "attempting to influence ... the contents of the review"
  // (support.google.com/business/answer/7400114, tightened 2026-04-17). Weaving
  // in a phrase the guest was never shown is that; offering it pre-ticked and
  // removable is not. Almost nobody switches them off, so the discoverability
  // value is kept — this is not a trade of reach against safety.
  //
  // Only a rotating subset is offered per guest (FORCED_OFFERED_MAX): a store
  // with four core phrases would otherwise put all four into every review,
  // which reads as a keyword dump and is what a review-spam filter looks for.
  // Rotating spreads the whole set across the corpus instead.
  const pillKeywords = [...forcedOffered, ...guestPills]
  const allowGuestKeywordSkip = pillKeywords.length === 0

  function reset() {
    setStep('rating')
    setRating(0)
    setReviewText('')
    setSelectedKeywords([])
    setReviewLocale(locale)
  }

  return (
    // dir mirrors the page-level setting so inner text aligns correctly
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Card: top border uses the client's brand color */}
      <div
        className="bg-white rounded-2xl overflow-hidden shadow-2xl"
        style={{ borderTop: `4px solid ${brandColor}` }}
      >

        {/* ── Header bar ───────────────────────────────── */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400 mb-0.5">
                {t.flow.shareExperience}
              </p>
              <p className="text-sm font-bold text-slate-900 tracking-tight">
                {storeName}
              </p>
              {branchLabel && (
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500 tracking-tight">
                  {branchLabel}
                </p>
              )}
            </div>
            {progressIdx > 0 && (
              <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                {progressIdx}&nbsp;/&nbsp;{POSITIVE_STEPS.length - 1}
              </span>
            )}
          </div>

          {/* Progress bar — filled segments use brandColor */}
          {progressIdx > 0 && (
            <div className="flex gap-1 mt-4">
              {POSITIVE_STEPS.map((_, i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: i <= progressIdx ? brandColor : '#e5e7eb',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Step content ───────────────────────────────
            key={step} remounts the wrapper on every step change so the
            entrance animation replays — swaps glide in instead of popping. */}
        <div key={step} className="p-6 animate-step-in">
          {step === 'rating' && (
            <StepRating
              t={t}
              storeName={storeName}
              branchLabel={branchLabel}
              greetingText={greetingText}
              onSelect={handleRating}
              logoUrl={logoUrl}
              businessCategory={businessCategory}
            />
          )}

          {step === 'keywords' && (
            <StepKeywords
              t={t}
              keywords={pillKeywords}
              allowGuestSkip={allowGuestKeywordSkip}
              initialSelected={forcedOffered}
              onConfirm={handleKeywords}
            />
          )}

          {step === 'generating' && (
            <StepGenerating t={t} brandColor={brandColor} durationMs={GENERATE_DELAY_MS} />
          )}

          {step === 'result' && (
            <StepResult
              t={t}
              reviewText={reviewText}
              gbpReviewUrl={googleReviewUrl}
              storeId={storeId}
              selectedKeywords={selectedKeywords}
              reviewLocale={reviewLocale}
              reviewLocaleOptions={reviewLocaleOptions}
              onReviewLocaleChange={generateInLocale}
              onRetry={reset}
              onReviewTextChange={setReviewText}
              contactChannel={contactChannel}
              contactDialCode={contactDialCode ?? undefined}
              onRegenerate={() =>
                generateReview(storeName, selectedKeywords, {
                  nonce: createReviewNonce(),
                  outletKey: `${storeId}|${businessCategory ?? ''}|${brandColor}`,
                  locale: reviewLocale,
                  category: businessCategory,
                            rating,
                  entity,
                  keywordTypes,
                })}
            />
          )}

          {step === 'feedback' && (
            <StepFeedback
              t={t}
              storeId={storeId}
              rating={rating}
              storeName={storeName}
              googleReviewUrl={googleReviewUrl}
              onSubmit={() => setStep('feedback_sent')}
            />
          )}

          {step === 'feedback_sent' && (
            <StepFeedbackSent
              t={t}
              storeName={storeName}
              googleReviewUrl={googleReviewUrl}
              onReset={reset}
            />
          )}
        </div>
      </div>
    </div>
  )
}
