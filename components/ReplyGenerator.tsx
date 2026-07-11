'use client'

import { useState } from 'react'
import { Star, Sparkles, Copy, RefreshCw, CheckCircle, MapPin } from 'lucide-react'
import { generateReply, createReplyNonce } from '@/lib/reply-engine'
import type { ReplyTone } from '@/lib/reply-pools'
import type { SupportedLocale } from '@/types/database'

type Props = {
  storeName: string
  /** Store default language — seeds the reply language selector. */
  defaultLocale: SupportedLocale
  /** Store forced GEO phrases — the first seeds the locality woven for Local SEO. */
  forcedKeywords?: string[]
}

const LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'ar', label: 'AR' },
]

const TONES: { code: ReplyTone; label: string }[] = [
  { code: 'warm', label: 'Warm' },
  { code: 'professional', label: 'Professional' },
]

export default function ReplyGenerator({ storeName, defaultLocale, forcedKeywords = [] }: Props) {
  const [rating, setRating] = useState<number>(5)
  const [reviewText, setReviewText] = useState('')
  const [locale, setLocale] = useState<SupportedLocale>(defaultLocale)
  const [tone, setTone] = useState<ReplyTone>('warm')
  const [geoPhrase, setGeoPhrase] = useState<string>(forcedKeywords[0] ?? '')
  const [weaveGeo, setWeaveGeo] = useState<boolean>(true)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  function run() {
    setDraft(
      generateReply(storeName, {
        rating,
        reviewText,
        locale,
        tone,
        geoPhrase,
        weaveGeo,
        nonce: createReplyNonce(),
      }),
    )
    setCopied(false)
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — owner can select the text manually */
    }
  }

  const isRtl = locale === 'ar'

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 leading-relaxed">
        Paste a customer&apos;s Google review, pick the rating, and generate a reply in
        your brand voice. Nothing is posted automatically — <span className="font-semibold text-slate-800">edit the draft, then copy it into Google yourself</span>.
      </p>

      {/* Rating */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
          Their rating
        </label>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= rating
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className="p-0.5 transition-transform active:scale-90"
              >
                <Star
                  size={26}
                  className={active ? 'text-amber-400' : 'text-slate-200'}
                  fill={active ? 'currentColor' : 'none'}
                  strokeWidth={active ? 0 : 1.5}
                />
              </button>
            )
          })}
          <span className="ms-2 text-xs font-semibold tabular-nums text-slate-500">
            {rating} / 5
          </span>
        </div>
      </div>

      {/* Review text */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
          Their review <span className="font-medium text-slate-300 normal-case">(optional — helps tailor the reply)</span>
        </label>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="Paste the customer's review here…"
          rows={3}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2
            text-sm text-slate-900 placeholder:text-slate-400 outline-none
            focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition resize-none"
        />
      </div>

      {/* Language + Tone */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
            Language
          </label>
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {LOCALES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={[
                  'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
                  locale === code ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
            Tone
          </label>
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {TONES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setTone(code)}
                className={[
                  'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
                  tone === code ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Local SEO / GEO weave */}
      <div className="space-y-2 rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3">
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] uppercase text-emerald-700">
          <MapPin size={12} />
          Local area to mention
        </label>
        <input
          type="text"
          value={geoPhrase}
          onChange={(e) => setGeoPhrase(e.target.value)}
          placeholder="e.g. Dubai Marina"
          dir={isRtl ? 'rtl' : 'ltr'}
          className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2
            text-sm text-slate-900 placeholder:text-slate-400 outline-none
            focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
        />
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={weaveGeo}
            onChange={(e) => setWeaveGeo(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 accent-emerald-600"
          />
          Weave it into replies naturally
        </label>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Mentioning your neighbourhood in replies (lightly, never stuffed) helps
          Google local search and AI Overviews connect you to the area. Only used
          on positive and mixed replies, not apologies.
        </p>
      </div>

      {/* Generate */}
      <button
        type="button"
        onClick={run}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900
          px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800
          active:scale-[0.99] transition-all"
      >
        <Sparkles size={14} />
        {draft ? 'Generate another' : 'Generate reply'}
      </button>

      {/* Draft */}
      {draft && (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
            Draft reply — edit before posting
          </label>
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setCopied(false) }}
            dir={isRtl ? 'rtl' : 'ltr'}
            rows={7}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2
              text-sm text-slate-900 outline-none focus:border-slate-400
              focus:ring-2 focus:ring-slate-100 transition resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={run}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300
                bg-white px-3 py-1.5 text-xs font-semibold text-slate-600
                hover:border-slate-500 hover:text-slate-900 active:scale-[0.98] transition-all"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
            <button
              type="button"
              onClick={copyDraft}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5
                text-xs font-semibold text-white shadow-sm hover:bg-slate-800
                active:scale-[0.98] transition-all"
            >
              {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
