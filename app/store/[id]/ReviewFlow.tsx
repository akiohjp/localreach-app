'use client'

import { useState } from 'react'
import { createReviewNonce, generateReview } from '@/lib/assembler'
import StepRating from '@/components/StepRating'
import StepKeywords from '@/components/StepKeywords'
import StepGenerating from '@/components/StepGenerating'
import StepResult from '@/components/StepResult'
import StepFeedback from '@/components/StepFeedback'
import StepFeedbackSent from '@/components/StepFeedbackSent'
import type { Step } from '@/lib/config'
import type { SupportedLocale } from '@/types/database'
import { getUiStrings } from '@/lib/ui-strings'
import { useFlowPersistence } from '@/lib/use-flow-persistence'

function mergeGuestAndForced(forced: string[], guest: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const k of forced) {
    const t = k.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  for (const k of guest) {
    const t = k.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

// Steps that show the progress bar
const POSITIVE_STEPS: Step[] = ['rating', 'keywords', 'generating', 'result']

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
  /** Admin-only phrases always embedded in generated text (not shown as pills). */
  forcedKeywords: string[]
  googleReviewUrl: string
  brandColor: string      // hex, e.g. "#f59e0b" — drives card accent + progress bar
  isRtl: boolean          // true when locale === 'ar'
  locale: SupportedLocale // resolved locale — drives UI copy (en/ja/ar)
  logoUrl?: string | null
  businessCategory?: string | null
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
  logoUrl,
  businessCategory,
}: Props) {
  const t = getUiStrings(locale)
  const [step, setStep] = useState<Step>('rating')
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])

  // Survive an accidental reload so a generated review isn't lost back to rating.
  useFlowPersistence(
    storeId,
    { step, rating, reviewText, selectedKeywords },
    (s) => {
      setStep(s.step as Step)
      setRating(s.rating)
      setReviewText(s.reviewText)
      setSelectedKeywords(s.selectedKeywords)
    },
  )

  const progressIdx = POSITIVE_STEPS.indexOf(step)

  function hasAnyConfiguredKeywords(): boolean {
    return (
      forcedKeywords.some((k) => k.trim()) ||
      keywords.some((k) => k.trim())
    )
  }

  const forcedCount = new Set(
    forcedKeywords.map((k) => k.trim()).filter(Boolean),
  ).size

  async function proceedToGenerate(guestSelected: string[]) {
    const merged = mergeGuestAndForced(forcedKeywords, guestSelected)
    setSelectedKeywords(merged)
    setStep('generating')
    await new Promise((r) => setTimeout(r, GENERATE_DELAY_MS))
    setReviewText(
      generateReview(storeName, merged, {
        nonce: createReviewNonce(),
        outletKey: `${storeId}|${businessCategory ?? ''}|${brandColor}`,
        locale,
        category: businessCategory,
        forcedCount,
      }),
    )
    setStep('result')
  }

  function handleRating(value: number) {
    setRating(value)
    if (value < 4) {
      setStep('feedback')
      return
    }
    if (!hasAnyConfiguredKeywords()) {
      void proceedToGenerate([])
      return
    }
    setStep('keywords')
  }

  async function handleKeywords(guestSelected: string[]) {
    await proceedToGenerate(guestSelected)
  }

  const forcedSet = new Set(
    forcedKeywords.map((k) => k.trim()).filter(Boolean),
  )
  const pillKeywords = keywords.filter((k) => !forcedSet.has(k.trim()))

  const allowGuestKeywordSkip =
    forcedKeywords.length > 0 && pillKeywords.length === 0

  function reset() {
    setStep('rating')
    setRating(0)
    setReviewText('')
    setSelectedKeywords([])
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
              onRetry={reset}
              onReviewTextChange={setReviewText}
              onRegenerate={() =>
                generateReview(storeName, selectedKeywords, {
                  nonce: createReviewNonce(),
                  outletKey: `${storeId}|${businessCategory ?? ''}|${brandColor}`,
                  locale,
                  category: businessCategory,
                  forcedCount,
                })}
            />
          )}

          {step === 'feedback' && (
            <StepFeedback
              t={t}
              storeId={storeId}
              rating={rating}
              storeName={storeName}
              onSubmit={() => setStep('feedback_sent')}
            />
          )}

          {step === 'feedback_sent' && (
            <StepFeedbackSent
              t={t}
              storeName={storeName}
              onReset={reset}
            />
          )}
        </div>
      </div>
    </div>
  )
}
