'use client'

import { useState } from 'react'
import { Star, Sparkles, Copy, RefreshCw, CheckCircle, MapPin, Loader2, PenLine, MessageSquareOff, MessageSquareText } from 'lucide-react'
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
  /** Guest keyword list — used when no forced keywords are set, so replies are never keyword-less. */
  keywords?: string[]
  /** Entity fields (single source of truth for the area — see the Location section). */
  entityArea?: string | null
  entityCity?: string | null
  entityCategoryLabel?: Record<string, string> | null
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

/** What the guest actually left. Rating-only is a distinct writing job, not an empty field. */
type ReviewKind = 'text' | 'rating-only'

export default function ReplyGenerator({
  storeId,
  storeName,
  defaultLocale,
  initialSettings,
  forcedKeywords = [],
  keywords = [],
  entityArea,
  entityCity,
  entityCategoryLabel,
}: Props) {
  // The area now lives on the store row (Location & business type). The old
  // reply-only `locality` stays as an override so saved settings keep working,
  // but an owner who filled the Location section must not have to type it twice.
  const entityGeo = [entityArea, entityCity].filter(Boolean).join(', ')
  // Replies must never go out keyword-less: moving place names out of
  // forced_keywords left some stores with an empty forced list.
  const replyKeywords = forcedKeywords.length > 0 ? forcedKeywords : keywords
  const categoryNounFor = (loc: SupportedLocale) =>
    entityCategoryLabel?.[loc]?.trim() || entityCategoryLabel?.en?.trim() || ''
  const [rating, setRating] = useState<number>(5)
  const [kind, setKind] = useState<ReviewKind>('text')
  const [reviewText, setReviewText] = useState('')
  const [locale, setLocale] = useState<SupportedLocale>(defaultLocale)
  const [tone, setTone] = useState<ReplyTone>(initialSettings?.tone === 'professional' ? 'professional' : 'warm')
  const [geoPhrase, setGeoPhrase] = useState<string>(initialSettings?.locality || entityGeo)
  const [weaveGeo, setWeaveGeo] = useState<boolean>(initialSettings?.weaveGeo !== false)
  const [weaveKw, setWeaveKw] = useState<boolean>(initialSettings?.weaveKw !== false)
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

  /**
   * Rating-only sends no text at all, so both the AI and the template engine take
   * their no-text path (which invents nothing) rather than reacting to a stale
   * draft the owner typed and then switched away from.
   */
  const effectiveText = kind === 'rating-only' ? '' : reviewText

  /** Instant offline draft from the template engine (also the AI fallback). */
  function runLocal() {
    setDraft(
      generateReply(storeName, {
        rating,
        reviewText: effectiveText,
        locale,
        tone,
        geoPhrase,
        categoryNoun: categoryNounFor(defaultLocale),
        weaveGeo,
        geoKeywords: weaveKw ? replyKeywords : [],
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
          reviewText: effectiveText,
          locale,
          tone,
          geoPhrase: weaveGeo ? geoPhrase : '',
          categoryNoun: weaveGeo ? categoryNounFor(locale) : '',
          geoKeywords: weaveKw ? replyKeywords : [],
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
        weaveKw,
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
        Generate a reply in your brand voice — for a written review, or for a guest
        who left a rating and nothing else. Nothing is posted automatically — <span className="font-semibold text-slate-800">edit the draft, then copy it into Google yourself</span>.
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

      {/* What the guest left: written review vs rating only */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
          What did they leave?
        </label>
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {([
            { code: 'text', label: 'Rating + written review', Icon: MessageSquareText },
            { code: 'rating-only', label: 'Rating only (no words)', Icon: MessageSquareOff },
          ] as const).map(({ code, label, Icon }) => (
            <button
              key={code}
              type="button"
              onClick={() => { setKind(code); setCopied(false) }}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all',
                kind === code ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
              ].join(' ')}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Review text — written reviews only */}
      {kind === 'text' ? (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
            Their review <span className="font-medium text-slate-300 normal-case">(paste it — the AI answers what they actually wrote)</span>
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
      ) : (
        /* Rating-only: no text to react to. Say plainly what the draft will do,
           so the owner isn't left wondering why it reads differently. */
        <div className="space-y-2 rounded-xl border border-sky-200/70 bg-sky-50/50 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] uppercase text-sky-700">
            <MessageSquareOff size={12} />
            Rating-only reply
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            {rating >= 4
              ? 'They gave you stars and no words, so the draft thanks them for the rating without pretending to know what they enjoyed — and it carries your area and keyword, because this reply is the only text Google and AI assistants can read under that rating.'
              : rating === 3
                ? 'A silent 3-star means something missed and you cannot see what. The draft says so honestly and asks them what would have made it better. No keywords, no guessing at the problem.'
                : 'A silent low rating means something went wrong and you cannot see what. The draft apologises in general terms, admits you do not know what happened, and asks them to tell you so you can fix it. It never invents a reason.'}
          </p>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Silent ratings are worth replying to. Your reply is indexed either way,
            and the guest gets a notification — which is often what brings the words
            out, especially on a low rating.
          </p>
        </div>
      )}

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
          local search and AI Overviews. Never used on apologies, or on a silent
          low rating — those need honesty, not marketing.
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
        {generating
          ? kind === 'rating-only' ? 'Writing the reply…' : 'Reading the review…'
          : draft ? 'Generate another' : 'Generate reply'}
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
