'use client'

import { useState } from 'react'
import { Star, Sparkles, Copy, RefreshCw, CheckCircle, MapPin, Loader2, PenLine } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { generateReply, createReplyNonce } from '@/lib/reply-engine'
import type { ReplyTone } from '@/lib/reply-pools'
import type { SupportedLocale, ReplySettings } from '@/types/database'

type Props = {
  /** Store row id — used to persist reply defaults to stores.reply_settings. */
  storeId: string
  storeName: string
  /** Store default language — seeds the reply language selector. */
  defaultLocale: SupportedLocale
  /** Saved per-store defaults (stores.reply_settings). NULL = built-in defaults. */
  initialSettings?: ReplySettings | null
  /** Forced GEO keywords — one is woven (quoted) into positive/mixed replies. */
  forcedKeywords?: string[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'ar', label: 'AR' },
]

const TONES: { code: ReplyTone; label: string }[] = [
  { code: 'warm', label: 'Warm' },
  { code: 'professional', label: 'Professional' },
]

export default function ReplyGenerator({ storeId, storeName, defaultLocale, initialSettings, forcedKeywords = [] }: Props) {
  const [rating, setRating] = useState<number>(5)
  const [reviewText, setReviewText] = useState('')
  const [locale, setLocale] = useState<SupportedLocale>(defaultLocale)
  const [tone, setTone] = useState<ReplyTone>(initialSettings?.tone === 'professional' ? 'professional' : 'warm')
  const [geoPhrase, setGeoPhrase] = useState<string>(initialSettings?.locality ?? '')
  const [weaveGeo, setWeaveGeo] = useState<boolean>(initialSettings?.weaveGeo !== false)
  const [weaveKw, setWeaveKw] = useState<boolean>(true)
  const [signature, setSignature] = useState<string>(initialSettings?.signature ?? '')
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [generating, setGenerating] = useState(false)
  /** 'ai' = Gemini read the review; 'instant' = offline template fallback. */
  const [mode, setMode] = useState<'ai' | 'instant' | null>(null)

  function defaultSignoff(): string {
    const sig = signature.trim()
    if (sig) return sig.replace(/\{store\}/g, storeName)
    if (locale === 'ja') return `${storeName} スタッフ一同`
    if (locale === 'ar') return `فريق ${storeName}`
    return `The team at ${storeName}`
  }

  /** Instant offline draft from the template engine (also the AI fallback). */
  function runLocal() {
    setDraft(
      generateReply(storeName, {
        rating,
        reviewText,
        locale,
        tone,
        geoPhrase,
        weaveGeo,
        geoKeywords: weaveKw ? forcedKeywords : [],
        signature,
        nonce: createReplyNonce(),
      }),
    )
    setMode('instant')
    setCopied(false)
  }

  /**
   * Primary path: the AI actually reads the review and answers its specifics.
   * Falls back to the instant template engine if the AI is unavailable, so the
   * button always produces a draft.
   */
  async function run() {
    setGenerating(true)
    setCopied(false)
    try {
      const res = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          rating,
          reviewText,
          locale,
          tone,
          geoPhrase: weaveGeo ? geoPhrase : '',
          geoKeywords: weaveKw ? forcedKeywords : [],
          signature,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { reply?: string }
        if (data.reply) {
          setDraft(`${data.reply.trim()}\n\n${defaultSignoff()}`)
          setMode('ai')
          return
        }
      }
      runLocal()
    } catch {
      runLocal()
    } finally {
      setGenerating(false)
    }
  }

  /** Persist tone / locality / weave / signature as this store's defaults. */
  async function saveDefaults() {
    setSaveState('saving')
    try {
      const reply_settings: ReplySettings = {
        tone,
        locality: geoPhrase.trim(),
        weaveGeo,
        signature: signature.trim(),
      }
      const supabase = createClient()
      const { data, error } = await supabase
        .from('stores')
        .update({ reply_settings })
        .eq('id', storeId)
        .select('id')
      if (error) throw error
      // 0 rows = RLS silently blocked the write; surface it (no false "Saved").
      if (!data || data.length === 0) throw new Error('No rows updated')
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
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
          Neighbourhood / area (a real place)
        </label>
        <input
          type="text"
          value={geoPhrase}
          onChange={(e) => setGeoPhrase(e.target.value)}
          placeholder="e.g. Dubai Marina, JLT, Al Barsha"
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
          Weave the area into replies naturally
        </label>
        {forcedKeywords.length > 0 && (
          <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={weaveKw}
              onChange={(e) => setWeaveKw(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 accent-emerald-600"
            />
            <span>
              Mention one of your GEO keywords per reply{' '}
              <span className="text-slate-400">
                ({forcedKeywords.slice(0, 3).join(' · ')}
                {forcedKeywords.length > 3 ? ` +${forcedKeywords.length - 3}` : ''})
              </span>
            </span>
          </label>
        )}
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Your replies are indexed by Google and read by AI assistants. Mentioning
          your area and one keyword per reply (lightly, never stuffed) strengthens
          local search and AI Overviews. Only on positive and mixed replies, never
          apologies.
        </p>
      </div>

      {/* Signature */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
          <PenLine size={12} />
          Sign-off <span className="font-medium text-slate-300 normal-case">(optional — blank rotates natural sign-offs)</span>
        </label>
        <input
          type="text"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={`e.g. Akio, Owner of ${storeName}`}
          dir={isRtl ? 'rtl' : 'ltr'}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2
            text-sm text-slate-900 placeholder:text-slate-400 outline-none
            focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
        />
      </div>

      {/* Save defaults */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="text-[10px] text-slate-500 leading-relaxed pe-2">
          Save tone, area and sign-off as this store&apos;s defaults — they&apos;ll be
          pre-filled every time you open this page.
        </p>
        <button
          type="button"
          onClick={saveDefaults}
          disabled={saveState === 'saving'}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300
            bg-white px-3 py-1.5 text-xs font-semibold text-slate-600
            hover:border-slate-500 hover:text-slate-900 active:scale-[0.98] transition-all
            disabled:opacity-50"
        >
          {saveState === 'saving' && <Loader2 size={12} className="animate-spin" />}
          {saveState === 'saved' && <CheckCircle size={12} className="text-green-600" />}
          {saveState === 'error'
            ? 'Save failed — retry'
            : saveState === 'saved'
              ? 'Saved'
              : 'Save as defaults'}
        </button>
      </div>

      {/* Generate */}
      <button
        type="button"
        onClick={run}
        disabled={generating}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900
          px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800
          active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-wait"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {generating ? 'Reading the review…' : draft ? 'Generate another' : 'Generate reply'}
      </button>

      {/* Draft */}
      {draft && (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
              Draft reply — edit before posting
            </label>
            {mode === 'instant' && (
              <span className="text-[10px] font-semibold text-amber-600">
                Instant draft (AI unavailable)
              </span>
            )}
          </div>
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
