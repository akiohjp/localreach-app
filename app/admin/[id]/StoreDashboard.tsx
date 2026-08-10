'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLink, Palette, Tag, QrCode,
  CheckCircle, Loader2, X, Plus, Download, Printer,
  Globe, Link2, LogOut, Languages, Users, Lock,
  MessageCircle, Send, Copy, Star, MessageSquareWarning, Reply, Settings, Megaphone, MapPin, Sparkles,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { ratingGoals, reviewActivity, type ReviewSnapshot } from '@/lib/review-metrics'
import LogoUploader from '@/components/LogoUploader'
import ReplyGenerator from '@/components/ReplyGenerator'
import InstallAppButton from '@/components/InstallAppButton'
import NotificationToggle from '@/components/NotificationToggle'
import { waTemplate, buildWaLink, normalizeWaNumber, type WaLocale } from '@/lib/whatsapp'
import { keywordPresetsFor } from '@/lib/keyword-presets'
import { resolveVertical } from '@/lib/review-pools'
import { classifyKeyword, type KeywordType } from '@/lib/review-engine'
import type { Store, LocalizedText, SupportedLocale, StoreUpdate, KeywordTypes } from '@/types/database'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type RecentCustomer = {
  whatsapp_number: string
  opt_in: boolean
  selected_keywords: string[] | null
  created_at: string
}

type FeedbackEntry = {
  id: string
  rating: number
  message: string
  /** Countable reasons the guest tapped; empty for a note left with a high rating. */
  topics?: string[] | null
  contact_name?: string | null
  contact_phone?: string | null
  /** NULL = nobody has opened it yet. */
  read_at?: string | null
  created_at: string
}

/** Same fixed keys the guest screen stores. Shown, never stored, in English. */
const TOPIC_LABEL: Record<string, string> = {
  service: 'Service',
  wait: 'Waiting time',
  quality: 'Quality',
  cleanliness: 'Cleanliness',
  price: 'Price',
  other: 'Something else',
}

type Props = {
  store: Store
  storeName: string
  storeUrl: string
  /** PNG data URL of the store QR, generated server-side (no third-party call). */
  qrDataUrl: string
  customerCount?: number
  recentCustomers?: RecentCustomer[]
  /** True when the server-side customers query failed (renders an error state instead of a misleading 0). */
  crmLoadError?: boolean
  /** Private low-rating (<4★) guest feedback — owner-only. */
  feedback?: FeedbackEntry[]
  feedbackCount?: number
  /** Notes nobody has opened yet — drives the tab badge. */
  feedbackUnread?: number
  /** Signed URL when logo bucket is non-public. */
  logoSignedUrl?: string | null
  /** Workspace to open first (from the URL's ?tab=). */
  initialTab?: TabId
  /** Daily Google rating/review-count snapshots (oldest first). Empty = no place id or no data yet. */
  reviewStats?: { captured_on: string; rating: number | null; review_count: number }[]
}

type TabId = 'grow' | 'customers' | 'settings'

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────

/** Group label between cards so a long settings list stays scannable. */
function SettingsHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-1 pt-1">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-400">{hint}</p>
    </div>
  )
}

function SectionCard({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-xs font-bold tracking-[0.15em] uppercase text-slate-500">
          {label}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function SaveFeedback({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin" />
        Saving…
      </span>
    )
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600 font-semibold">
        <CheckCircle size={12} />
        Saved
      </span>
    )
  }
  if (state === 'error') {
    return <span className="text-xs text-red-500">Save failed — try again.</span>
  }
  return null
}

async function saveField(
  storeId: string,
  patch: StoreUpdate,
): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stores')
    .update(patch)
    .eq('id', storeId)
    .select('id')
  if (error) throw error
  // A 0-row update means RLS silently blocked the write (or the row is gone):
  // Postgres accepts the statement but changes nothing. Without .select() this
  // resolves and the UI shows a false "Saved". Surface it as an error instead.
  if (!data || data.length === 0) {
    throw new Error('No rows updated — you may not have permission to edit this store.')
  }
}

// ─────────────────────────────────────────────
// Brand Color Editor
// ─────────────────────────────────────────────

function BrandColorEditor({
  storeId,
  initial,
}: {
  storeId: string
  initial: string
}) {
  const [color, setColor] = useState(initial)
  const [savedColor, setSavedColor] = useState(initial)
  const [state, setState] = useState<SaveState>('idle')

  async function handleSave() {
    setState('saving')
    try {
      await saveField(storeId, { brand_color: color })
      setSavedColor(color)
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  const isDirty = color !== savedColor || state === 'error'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label
          htmlFor="brand-color-input"
          className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-gray-200 shadow-sm transition hover:border-slate-400"
          style={{ backgroundColor: color }}
        >
          <input
            id="brand-color-input"
            type="color"
            value={color}
            onChange={(e) => { setColor(e.target.value); setState('idle') }}
            className="sr-only"
          />
        </label>
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-slate-900 tabular-nums uppercase tracking-wider">
            {color}
          </p>
          <p className="text-xs text-slate-400">Click the swatch to change</p>
        </div>
      </div>

      <div
        className="h-2 w-full rounded-full transition-colors duration-200"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-center justify-between">
        <SaveFeedback state={state} />
        <button
          onClick={handleSave}
          disabled={!isDirty || state === 'saving'}
          className="ms-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold
            text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Color
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Keyword Manager
// ─────────────────────────────────────────────

/**
 * Keyword shape check (owner guidance, never blocking).
 *
 * Every keyword lands in an OBJECT slot: "Definitely try {kw}", "No notes on
 * {kw}", "Worth going back for {kw} alone". Nouns read perfectly there; an
 * attribute phrase does not ("Definitely try the clean and comfortable").
 * Place names are the same class of mistake — those belong in the Location &
 * business type section, not here.
 */
const ATTRIBUTE_SHAPED = [
  /^(great|good|perfect|ideal|nice)\s+(for|to)\b/i,
  /^(clean|cosy|cozy|comfortable|friendly|quiet|spacious|affordable|cheap|fast|quick|fresh|tasty|delicious)\b(?!\s+\w*(s|ice|ing|ry|ty|room|food|coffee|pizza|udon|staff|team|menu|option|selection|atmosphere|vibe|service)\b)/i,
  /^(family|kid|pet|wheelchair|budget)[\s-]?friendly$/i,
  /\b(and|&)\s+(clean|comfortable|cosy|cozy|quiet|friendly|fast|affordable)$/i,
  /\b(daily|weekly|always|often|24\/7)$/i,
]

function keywordShapeWarning(kw: string): string | null {
  const t = kw.trim()
  if (!t) return null
  // Latin-only heuristic; JA/AR keywords use different grammar in their pools.
  if (!/^[\x20-\x7E]+$/.test(t)) return null
  if (ATTRIBUTE_SHAPED.some((re) => re.test(t))) {
    return 'reads as a description, not a thing — reviews say "Definitely try the …", so name a dish or feature instead'
  }
  return null
}

/**
 * What a keyword NAMES decides which sentences it can appear in, and until
 * 2026-08-09 the engine guessed it from the string. The guess had no way to
 * tell a dish from a discipline, so a clinic got "nailed AGA Treatment" and a
 * grocery got "Big yes to Japanese and Korean groceries". The owner picks it
 * here instead; anything left unset still falls back to the guess.
 *
 * Wording is deliberately in the owner's language, not the engine's: nobody
 * running a shop thinks in "attribute" or "geo".
 */
const KEYWORD_TYPE_CHOICES: { value: KeywordType; label: string; hint: string }[] = [
  { value: 'item', label: 'A thing', hint: 'One dish, product or named treatment — something a guest orders or buys' },
  { value: 'service', label: 'Something you do for them', hint: 'A treatment, a fitting, shipping — reviews describe how it went, not how it tasted' },
  { value: 'category', label: 'A whole range', hint: 'A class of what you sell, e.g. "Korean skincare" — reviews talk about selection' },
  { value: 'attribute', label: 'A quality', hint: 'A description, not a thing, e.g. "family friendly", "no pressure to buy"' },
  { value: 'geo', label: 'A search phrase', hint: 'What people type to find you, e.g. "pizza in Dubai"' },
]

function KeywordTypePicker({
  kw,
  value,
  locale,
  onChange,
  onDark = false,
}: {
  kw: string
  value?: KeywordType
  locale?: SupportedLocale
  onChange: (t: KeywordType) => void
  /** Core-phrase pills are near-black; slate text on them is unreadable. */
  onDark?: boolean
}) {
  // Showing the guess as the selected option (rather than a blank) means the
  // owner sees what the engine is ALREADY doing and only has to correct it.
  const effective = value ?? classifyKeyword(kw, undefined, locale === 'ja' ? 'ja' : locale === 'ar' ? 'ar' : 'en')
  return (
    <select
      value={effective}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as KeywordType)}
      aria-label={`What "${kw}" is`}
      title={KEYWORD_TYPE_CHOICES.find((c) => c.value === effective)?.hint}
      className={`rounded border bg-transparent py-0 pl-1 pr-4 text-[10px] font-semibold outline-none
        ${onDark
          ? value ? 'border-white/40 text-white' : 'border-dashed border-white/30 text-white/60'
          : value ? 'border-slate-300 text-slate-600' : 'border-dashed border-slate-300 text-slate-400'}`}
    >
      {KEYWORD_TYPE_CHOICES.map((c) => (
        <option key={c.value} value={c.value}>{c.label}</option>
      ))}
    </select>
  )
}

function KeywordManager({
  storeId,
  initial,
  businessCategory,
  locale,
  types,
  onTypeChange,
}: {
  storeId: string
  initial: string[]
  /** Free-text category from the store row — resolved to a vertical here. */
  businessCategory?: string | null
  locale?: SupportedLocale
  /** Shared with the core-phrase manager: ONE map covers both lists, so it is
   *  owned by the parent and neither manager can clobber the other. */
  types: KeywordTypes
  onTypeChange: (kw: string, t: KeywordType) => void
}) {
  const [keywords, setKeywords] = useState<string[]>(initial)
  const [input, setInput] = useState('')
  const [state, setState] = useState<SaveState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const trimmed = input.trim()
    if (!trimmed || keywords.includes(trimmed)) { setInput(''); return }
    setKeywords((prev) => [...prev, trimmed])
    setInput('')
    setState('idle')
  }

  function remove(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw))
    setState('idle')
  }

  // Starter keywords for this industry. Every phrase is noun-shaped so it reads
  // correctly in the review templates ("Definitely try the teeth whitening").
  // Only phrases not already present are offered, so the button is a top-up
  // rather than a reset.
  const presets = keywordPresetsFor(resolveVertical(businessCategory ?? ''), locale ?? 'en')
  const missingPresets = presets.filter((k) => !keywords.includes(k))

  function addPresets() {
    if (missingPresets.length === 0) return
    setKeywords((prev) => [...prev, ...missingPresets])
    setState('idle')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // While a Japanese/CJK IME is composing, Enter/"," confirm the conversion —
    // do not treat them as "add keyword" or the word gets committed half-typed.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && !input && keywords.length) {
      remove(keywords[keywords.length - 1])
    }
  }

  async function handleSave() {
    // Flush any text still sitting in the input — an owner who types a keyword
    // and clicks Save (without Enter) must not silently lose it.
    const pending = input.trim()
    const toSave = pending && !keywords.includes(pending) ? [...keywords, pending] : keywords
    if (toSave !== keywords) { setKeywords(toSave); setInput('') }
    setState('saving')
    try {
      await saveField(storeId, { keywords: toSave, keyword_types: types })
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="flex min-h-[3rem] flex-wrap gap-2 rounded-xl border border-gray-200
          bg-gray-50 p-3 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200
              bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm"
          >
            {kw}
            <KeywordTypePicker
              kw={kw}
              value={types[kw]}
              locale={locale}
              onChange={(t) => onTypeChange(kw, t)}
            />
            <button
              onClick={(e) => { e.stopPropagation(); remove(kw) }}
              aria-label={`Remove ${kw}`}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={keywords.length === 0 ? 'Type a keyword and press Enter…' : ''}
          className="min-w-[8rem] flex-1 bg-transparent text-xs text-slate-700
            placeholder:text-slate-400 outline-none"
        />
      </div>

      <p className="text-[10px] text-slate-400">
        Press <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">Enter</kbd> or <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">,</kbd> to add · {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}
      </p>

      {missingPresets.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
          <p className="text-[11px] text-sky-900 mb-2 leading-relaxed">
            <strong>Suggested for your industry.</strong> These are the phrases customers in your
            category actually search for — add them, then swap in your own dishes and services.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {missingPresets.slice(0, 8).map((k) => (
              <span key={k} className="rounded-md bg-white border border-sky-200 px-2 py-0.5 text-[10px] text-sky-800">
                {k}
              </span>
            ))}
            {missingPresets.length > 8 && (
              <span className="text-[10px] text-sky-700 self-center">+{missingPresets.length - 8} more</span>
            )}
          </div>
          <button
            type="button"
            onClick={addPresets}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5
              text-[11px] font-semibold text-white hover:bg-sky-700 transition cursor-pointer"
          >
            <Sparkles size={11} />
            Add all {missingPresets.length}
          </button>
        </div>
      )}

      {keywords.some((k) => keywordShapeWarning(k)) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">
            These still work, but they read better as things a guest can name:
          </p>
          <ul className="space-y-0.5">
            {keywords.filter((k) => keywordShapeWarning(k)).map((k) => (
              <li key={k} className="text-[10px] text-amber-700">
                <strong>{k}</strong> — {keywordShapeWarning(k)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        {input.trim() && (
          <button
            onClick={add}
            className="flex items-center gap-1 rounded-lg border border-gray-300
              bg-white px-3 py-1.5 text-xs font-semibold text-slate-600
              hover:border-slate-500 transition-all"
          >
            <Plus size={11} />
            Add &ldquo;{input.trim()}&rdquo;
          </button>
        )}
        <div className="flex flex-1 items-center justify-between">
          <SaveFeedback state={state} />
          <button
            onClick={handleSave}
            disabled={state === 'saving'}
            className="ms-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold
              text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Keywords
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Forced GEO keywords — always merged into generated reviews (miraiReach-style)
// ─────────────────────────────────────────────

function ForcedKeywordManager({
  storeId,
  initial,
  locale,
  types,
  onTypeChange,
}: {
  storeId: string
  initial: string[]
  locale?: SupportedLocale
  types: KeywordTypes
  onTypeChange: (kw: string, t: KeywordType) => void
}) {
  const [items, setItems] = useState<string[]>(initial)
  const [input, setInput] = useState('')
  const [state, setState] = useState<SaveState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const trimmed = input.trim()
    if (!trimmed || items.includes(trimmed)) {
      setInput('')
      return
    }
    setItems((prev) => [...prev, trimmed])
    setInput('')
    setState('idle')
  }

  function remove(kw: string) {
    setItems((prev) => prev.filter((k) => k !== kw))
    setState('idle')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Ignore Enter/"," while a CJK IME is mid-composition (conversion confirm).
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    }
    if (e.key === 'Backspace' && !input && items.length) {
      remove(items[items.length - 1])
    }
  }

  async function handleSave() {
    // Flush pending input so a typed-but-not-committed keyword isn't lost.
    const pending = input.trim()
    const toSave = pending && !items.includes(pending) ? [...items, pending] : items
    if (toSave !== items) { setItems(toSave); setInput('') }
    setState('saving')
    try {
      await saveField(storeId, { forced_keywords: toSave, keyword_types: types })
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 leading-relaxed">
        These phrases are <span className="font-semibold text-slate-800">offered to every guest already selected</span>,{' '}
        so the terms you want to be found for reach most reviews — and a guest who does not want one
        can remove it. Add your location and what you want to rank for, e.g.{' '}
        <span className="font-medium text-slate-700">&ldquo;best doughnuts in Dubai&rdquo;</span>.
      </p>
      <div
        className="flex min-h-[3rem] flex-wrap gap-2 rounded-xl border border-slate-700/20
          bg-slate-900/5 p-3 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {items.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700
              bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
          >
            {kw}
            <KeywordTypePicker
              kw={kw}
              value={types[kw]}
              locale={locale}
              onDark
              onChange={(t) => onTypeChange(kw, t)}
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                remove(kw)
              }}
              aria-label={`Remove core phrase ${kw}`}
              className="text-slate-400 hover:text-amber-300 transition-colors"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={items.length === 0 ? 'Type a keyword and press Enter…' : ''}
          className="min-w-[8rem] flex-1 bg-transparent text-xs text-slate-800
            placeholder:text-slate-400 outline-none"
        />
      </div>

      <p className="text-[10px] text-slate-400">
        Press <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">Enter</kbd>{' '}
        or <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">,</kbd> to
        add · {items.length} keyword{items.length !== 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-2">
        {input.trim() && (
          <button
            onClick={add}
            className="flex items-center gap-1 rounded-lg border border-gray-300
              bg-white px-3 py-1.5 text-xs font-semibold text-slate-600
              hover:border-slate-500 transition-all"
          >
            <Plus size={11} />
            Add &ldquo;{input.trim()}&rdquo;
          </button>
        )}
        <div className="flex flex-1 items-center justify-between">
          <SaveFeedback state={state} />
          <button
            onClick={handleSave}
            disabled={state === 'saving'}
            className="ms-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold
              text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save keywords
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Store Content Editor (multilingual)
// ─────────────────────────────────────────────

const LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'ar', label: 'AR' },
]

type ContentState = {
  store_name: LocalizedText
  greeting_text: LocalizedText
  description: LocalizedText
}

function ContentEditor({
  storeId,
  initial,
}: {
  storeId: string
  initial: ContentState
}) {
  const [content, setContent] = useState<ContentState>(initial)
  const [activeLocale, setActiveLocale] = useState<SupportedLocale>('en')
  const [state, setState] = useState<SaveState>('idle')

  function setField(field: keyof ContentState, locale: SupportedLocale, value: string) {
    setContent((prev) => ({
      ...prev,
      [field]: { ...prev[field], [locale]: value },
    }))
    setState('idle')
  }

  async function handleSave() {
    setState('saving')
    try {
      await saveField(storeId, {
        store_name: content.store_name,
        greeting_text: content.greeting_text,
        description: content.description,
      })
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  const inputCls = `w-full rounded-xl border border-gray-200 bg-white px-3 py-2
    text-sm text-slate-900 placeholder:text-slate-400 outline-none
    focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition`

  return (
    <div className="space-y-4">
      {/* Locale tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {LOCALES.map(({ code, label }) => (
          <button
            key={code}
            onClick={() => setActiveLocale(code)}
            className={[
              'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
              activeLocale === code
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-600',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="space-y-3" dir={activeLocale === 'ar' ? 'rtl' : 'ltr'}>
        <div className="space-y-1">
          <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
            Store Name
          </label>
          <input
            type="text"
            value={content.store_name[activeLocale] ?? ''}
            onChange={(e) => setField('store_name', activeLocale, e.target.value)}
            placeholder="e.g. Sakura Sushi"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
            Greeting
          </label>
          <input
            type="text"
            value={content.greeting_text[activeLocale] ?? ''}
            onChange={(e) => setField('greeting_text', activeLocale, e.target.value)}
            placeholder="e.g. Welcome! Leave us a review."
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
            Description
          </label>
          <textarea
            value={content.description[activeLocale] ?? ''}
            onChange={(e) => setField('description', activeLocale, e.target.value)}
            placeholder="A short description of your store…"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <SaveFeedback state={state} />
        <button
          onClick={handleSave}
          disabled={state === 'saving'}
          className="ms-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold
            text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Content
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Language Selector
// ─────────────────────────────────────────────

function LanguageSelectorSection({
  storeId,
  initial,
}: {
  storeId: string
  initial: SupportedLocale
}) {
  const [lang, setLang] = useState<SupportedLocale>(initial)
  const [state, setState] = useState<SaveState>('idle')

  async function handleSave() {
    setState('saving')
    try {
      await saveField(storeId, { default_language: lang })
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-4">
      <select
        value={lang}
        onChange={(e) => { setLang(e.target.value as SupportedLocale); setState('idle') }}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
          text-sm text-slate-900 outline-none focus:border-slate-400
          focus:ring-2 focus:ring-slate-100 transition cursor-pointer"
      >
        <option value="en">English</option>
        <option value="ja">日本語</option>
        <option value="ar">العربية (RTL)</option>
      </select>
      <p className="text-[10px] text-slate-400">
        Sets the default locale for the customer review page. Arabic enables right-to-left layout.
      </p>
      <div className="flex items-center justify-between">
        <SaveFeedback state={state} />
        <button
          onClick={handleSave}
          disabled={lang === initial || state === 'saving'}
          className="ms-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold
            text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Language
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Entity (AI visibility) — area / city / category noun
// ─────────────────────────────────────────────

/**
 * The engine weaves ONE natural sentence per review carrying "<category> in
 * <area>" (city rides along occasionally). This is what AI answers and local
 * ranking match against — keywords are dish/object slots and must not carry
 * place names. "Fetch from Google" resolves the store's own review-link place
 * id via /api/place-entity (EN labels; JA/AR are optional manual refinements).
 */
function EntitySection({
  storeId,
  initialArea,
  initialCity,
  initialCategoryLabel,
  googleReviewUrl,
}: {
  storeId: string
  initialArea: string | null
  initialCity: string | null
  initialCategoryLabel: Record<string, string> | null
  googleReviewUrl: string
}) {
  const [area, setArea] = useState(initialArea ?? '')
  const [city, setCity] = useState(initialCity ?? '')
  const [catEn, setCatEn] = useState(initialCategoryLabel?.en ?? '')
  const [catJa, setCatJa] = useState(initialCategoryLabel?.ja ?? '')
  const [catAr, setCatAr] = useState(initialCategoryLabel?.ar ?? '')
  const [state, setState] = useState<SaveState>('idle')
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)

  const placeId = /[?&]placeid=([A-Za-z0-9_-]{10,200})/i.exec(googleReviewUrl)?.[1] ?? null

  async function handleFetch() {
    if (!placeId) return
    setFetching(true)
    setFetchMsg(null)
    try {
      const res = await fetch(`/api/place-entity?placeId=${encodeURIComponent(placeId)}`)
      if (res.status === 501) {
        setFetchMsg('Auto-fill is not configured on this server — please type the values below.')
        return
      }
      if (!res.ok) {
        setFetchMsg('Could not read this place from Google — please type the values below.')
        return
      }
      const data = (await res.json()) as { area: string | null; city: string | null; category: string | null }
      if (data.area) setArea(data.area)
      if (data.city) setCity(data.city)
      if (data.category) setCatEn(data.category)
      if (!data.area && !data.city && !data.category) {
        setFetchMsg('Google returned no usable fields for this place — please type the values below.')
      } else {
        setFetchMsg('Filled from your Google listing — review, adjust, then Save.')
      }
      setState('idle')
    } catch {
      setFetchMsg('Network error — please type the values below.')
    } finally {
      setFetching(false)
    }
  }

  async function handleSave() {
    setState('saving')
    try {
      const label: Record<string, string> = {}
      if (catEn.trim()) label.en = catEn.trim()
      if (catJa.trim()) label.ja = catJa.trim()
      if (catAr.trim()) label.ar = catAr.trim()
      await saveField(storeId, {
        entity_area: area.trim() || null,
        entity_city: city.trim() || null,
        entity_category_label: label,
      })
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  const inputCls =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm ' +
    'text-slate-900 outline-none focus:border-slate-400 focus:ring-2 ' +
    'focus:ring-slate-100 transition'

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 leading-relaxed">
        Each generated review naturally mentions <strong>what</strong> your business is and{' '}
        <strong>where</strong> it is (e.g. &ldquo;best udon restaurant I&rsquo;ve found around
        Motor City&rdquo;). This is what Google&rsquo;s local ranking and AI answers
        (AI Overviews, ChatGPT) match against — leave it empty and your reviews stay
        location-blind.
      </p>

      {placeId && (
        <button
          type="button"
          onClick={handleFetch}
          disabled={fetching}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200
            bg-white px-3.5 py-2 text-xs font-semibold text-slate-700
            hover:border-slate-400 transition disabled:opacity-50 cursor-pointer"
        >
          {fetching ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
          Fetch from your Google listing
        </button>
      )}
      {fetchMsg && <p className="text-[11px] text-slate-500">{fetchMsg}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Area / neighbourhood
          </label>
          <input value={area} onChange={(e) => { setArea(e.target.value); setState('idle') }}
            placeholder="e.g. Motor City" className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            City
          </label>
          <input value={city} onChange={(e) => { setCity(e.target.value); setState('idle') }}
            placeholder="e.g. Dubai" className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Business type — as it should read in a review (English)
        </label>
        <input value={catEn} onChange={(e) => { setCatEn(e.target.value); setState('idle') }}
          placeholder="e.g. udon restaurant" className={inputCls} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            日本語 (optional)
          </label>
          <input value={catJa} onChange={(e) => { setCatJa(e.target.value); setState('idle') }}
            placeholder="例: うどん店" className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            العربية (optional)
          </label>
          <input dir="rtl" value={catAr} onChange={(e) => { setCatAr(e.target.value); setState('idle') }}
            placeholder="مثال: مطعم ياباني" className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={state === 'saving'}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white
            hover:bg-slate-700 transition disabled:opacity-50 cursor-pointer"
        >
          Save
        </button>
        <SaveFeedback state={state} />
      </div>
    </div>
  )
}

const BUSINESS_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '一般 / General (default)' },
  { value: 'restaurant', label: '飲食店 / Restaurant' },
  { value: 'cafe', label: 'カフェ / Cafe' },
  { value: 'beauty', label: '美容室・サロン / Beauty & Salon' },
  { value: 'aesthetic', label: '美容医療・皮膚科・脱毛 / Aesthetic & Derma' },
  { value: 'dental', label: '歯科 / Dental' },
  { value: 'clinic', label: 'クリニック・医療 / Clinic & Medical' },
  { value: 'realestate', label: '不動産 / Real Estate' },
  { value: 'legal', label: '法律・会計・士業 / Legal & Professional' },
  { value: 'home', label: 'リフォーム・内装・工務店 / Home & Renovation' },
  { value: 'education', label: 'スクール・塾・教室 / Education' },
  { value: 'pet', label: '動物病院・ペット / Pet Care' },
  { value: 'retail', label: '小売・ショップ / Retail & Shop' },
  { value: 'fitness', label: 'ジム・フィットネス / Fitness' },
  { value: 'hotel', label: 'ホテル・宿泊 / Hotel' },
  { value: 'auto', label: '自動車 / Automotive' },
  { value: 'agency', label: '広告・マーケ・制作会社 / Marketing & Digital Agency' },
  { value: 'services', label: 'その他サービス / Other services' },
]

function BusinessCategorySelectorSection({
  storeId,
  initial,
}: {
  storeId: string
  initial: string | null
}) {
  const [cat, setCat] = useState<string>(initial ?? '')
  const [state, setState] = useState<SaveState>('idle')

  async function handleSave() {
    setState('saving')
    try {
      await saveField(storeId, { business_category: cat || null })
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-4">
      <select
        value={cat}
        onChange={(e) => { setCat(e.target.value); setState('idle') }}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
          text-sm text-slate-900 outline-none focus:border-slate-400
          focus:ring-2 focus:ring-slate-100 transition cursor-pointer"
      >
        {BUSINESS_CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className="text-[10px] text-slate-400">
        Tailors the generated review wording to your industry. &quot;General&quot; is safe for any business.
      </p>
      <div className="flex items-center justify-between">
        <SaveFeedback state={state} />
        <button
          onClick={handleSave}
          disabled={(cat || null) === initial || state === 'saving'}
          className="ms-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold
            text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Category
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Google Review URL Editor
// ─────────────────────────────────────────────

function ReviewUrlEditor({
  storeId,
  initial,
}: {
  storeId: string
  initial: string
}) {
  const [url, setUrl] = useState(initial)
  const [state, setState] = useState<SaveState>('idle')
  const [formatError, setFormatError] = useState<string | null>(null)

  async function handleSave() {
    // Normalize before saving: guests' "Post on Google" opens this verbatim, so
    // a scheme-less paste (g.page/r/…) must become https://… — and anything that
    // still isn't an absolute http(s) URL is rejected with a visible error.
    let candidate = url.trim()
    if (candidate && !/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`
    }
    if (candidate) {
      try {
        const parsed = new URL(candidate)
        if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.')) throw new Error('bad')
      } catch {
        setFormatError('That does not look like a valid link. It should start with https:// (e.g. https://g.page/r/...).')
        setState('idle')
        return
      }
    }
    setFormatError(null)
    setState('saving')
    try {
      await saveField(storeId, { google_review_url: candidate })
      setUrl(candidate)
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  const isDirty = url !== initial || state === 'error'

  return (
    <div className="space-y-4">
      {!initial.trim() && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
          <span className="font-semibold">Action needed:</span> without this link, guests can
          copy their review but the &ldquo;Post on Google&rdquo; button can&apos;t open your
          review box. Set it to complete your funnel.
        </div>
      )}
      <input
        type="url"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setState('idle'); setFormatError(null) }}
        placeholder="https://g.page/r/..."
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
          text-sm text-slate-900 placeholder:text-slate-400 outline-none
          focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
      />
      {formatError && (
        <p className="text-xs text-red-500" role="alert">{formatError}</p>
      )}
      <p className="text-[10px] text-slate-400 leading-relaxed">
        The link that opens your Google review box (looks like g.page/r/…). Guests who rate you
        4–5 stars are sent here to post it. To find it: open your Google Business Profile, tap
        &ldquo;Ask for reviews&rdquo;, and copy the link.
      </p>
      <div className="flex items-center justify-between">
        <SaveFeedback state={state} />
        <button
          onClick={handleSave}
          disabled={!isDirty || state === 'saving'}
          className="ms-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold
            text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save URL
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// QR Code Panel
// ─────────────────────────────────────────────

function QRCodePanel({
  storeUrl,
  qrDataUrl,
  storeId,
}: {
  storeUrl: string
  qrDataUrl: string
  storeId: string
}) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div className="shrink-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="Customer-facing QR code"
          width={160}
          height={160}
          className="rounded-xl"
        />
      </div>

      <div className="space-y-3 text-center sm:text-left">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-900">
            Scan to leave a review
          </p>
          <p className="text-xs text-slate-500 break-all">{storeUrl}</p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <a
            href={`/admin/${storeId}/print`}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2
              text-xs font-semibold text-white shadow-sm hover:bg-slate-800
              active:scale-[0.98] transition-all"
          >
            <Printer size={12} />
            Print counter card
          </a>

          <a
            href={qrDataUrl}
            download="qr-code.png"
            className="flex items-center gap-1.5 rounded-xl border border-gray-300
              bg-white px-4 py-2 text-xs font-semibold text-slate-600
              hover:border-slate-500 hover:text-slate-900 active:scale-[0.98] transition-all"
          >
            <Download size={12} />
            QR only (PNG)
          </a>

          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-gray-300
              bg-white px-4 py-2 text-xs font-semibold text-slate-600
              hover:border-slate-500 hover:text-slate-900 active:scale-[0.98] transition-all"
          >
            <ExternalLink size={12} />
            Open Page
          </a>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// WhatsApp review requests (Phase 1 — click-to-chat, no Meta API/fees)
// ─────────────────────────────────────────────

function WhatsAppRequestSection({
  storeName,
  storeUrl,
  locale,
  message,
  onLocale,
  onMessage,
}: {
  storeName: string
  storeUrl: string
  locale: WaLocale
  message: string
  onLocale: (l: WaLocale) => void
  onMessage: (m: string) => void
}) {
  const [number, setNumber] = useState('')
  const [copied, setCopied] = useState(false)

  const dialable = normalizeWaNumber(number).length >= 7

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — owner can select the text manually */
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 leading-relaxed">
        Send your review link over WhatsApp — from <span className="font-semibold text-slate-800">your own number</span>,
        no extra fees. Message <span className="font-semibold text-slate-800">only customers who gave you their number</span>.
      </p>

      {/* Message language */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {(['en', 'ja', 'ar'] as WaLocale[]).map((code) => (
          <button
            key={code}
            onClick={() => { onLocale(code); onMessage(waTemplate(code, storeName, storeUrl)) }}
            className={[
              'flex-1 rounded-lg py-1.5 text-xs font-bold uppercase transition-all',
              locale === code
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-600',
            ].join(' ')}
          >
            {code}
          </button>
        ))}
      </div>

      {/* Editable message */}
      <div className="space-y-1">
        <textarea
          value={message}
          onChange={(e) => onMessage(e.target.value)}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          rows={4}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2
            text-sm text-slate-900 outline-none focus:border-slate-400
            focus:ring-2 focus:ring-slate-100 transition resize-none"
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400">Link to your review page is included.</p>
          <button
            onClick={copyMessage}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300
              bg-white px-3 py-1.5 text-xs font-semibold text-slate-600
              hover:border-slate-500 hover:text-slate-900 active:scale-[0.98] transition-all"
          >
            {copied ? <CheckCircle size={12} className="text-green-600" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy message'}
          </button>
        </div>
      </div>

      {/* Send to a single number */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
        <label className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
          Send to one customer
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            inputMode="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="+971 50 123 4567"
            dir="ltr"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5
              text-sm text-slate-900 placeholder:text-slate-400 outline-none
              focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
          />
          <a
            href={dialable ? buildWaLink(number, message) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!dialable}
            onClick={(e) => { if (!dialable) e.preventDefault() }}
            className={[
              'flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm transition-all',
              dialable
                ? 'bg-[#25D366] text-white hover:brightness-95 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            <Send size={12} />
            Open in WhatsApp
          </a>
        </div>
      </div>

      {/* Broadcast helper */}
      <a
        href={buildWaLink('', message)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border
          border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-xs font-semibold
          text-[#128C7E] hover:bg-[#25D366]/20 active:scale-[0.98] transition-all"
      >
        <MessageCircle size={13} />
        Open WhatsApp to pick a contact / broadcast
      </a>
    </div>
  )
}

// ─────────────────────────────────────────────
// CRM Stats (read-only — no CSV export for store owners)
// ─────────────────────────────────────────────

function CrmSection({
  count,
  recent,
  waMessage,
  loadError = false,
}: {
  count: number
  recent: RecentCustomer[]
  waMessage: string
  loadError?: boolean
}) {
  if (loadError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Couldn&apos;t load your customer list right now. Your data is safe — refresh the
        page to try again.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {/* Total count */}
      <div className="flex items-center gap-4">
        <div className="text-center px-6 py-3 bg-slate-50 rounded-xl border border-gray-200">
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{count}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
            registered
          </p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Customers who left their WhatsApp number via the review page.
        </p>
      </div>

      {/* Recent list */}
      {recent.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
            Recent
          </p>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            {recent.map((c, i) => (
              <div key={i} className="flex items-start justify-between gap-3 px-4 py-3 bg-white">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-mono text-slate-800">{c.whatsapp_number}</p>
                  {c.selected_keywords && c.selected_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.selected_keywords.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium
                            bg-slate-100 text-slate-500"
                        >
                          {kw}
                        </span>
                      ))}
                      {c.selected_keywords.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{c.selected_keywords.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1.5">
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {new Date(c.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <span
                    className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      c.opt_in
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.opt_in ? 'opted in' : 'opted out'}
                  </span>
                  {/* Only offer a send button for customers who opted in. */}
                  {c.opt_in && (
                    <a
                      href={buildWaLink(c.whatsapp_number, waMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg bg-[#25D366] px-2 py-1
                        text-[10px] font-semibold text-white shadow-sm
                        hover:brightness-95 active:scale-[0.98] transition-all"
                    >
                      <Send size={10} />
                      Ask
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400 text-center py-4">
          No customers yet. Share your QR code to start collecting.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Private guest notes — read-only, owner only. Any rating: a happy guest can
// leave one too, which is also what keeps the flow from treating unhappy
// guests as a separate case.
// ─────────────────────────────────────────────

function FeedbackSection({
  storeId,
  count,
  unread,
  recent,
  vapidPublicKey,
}: {
  storeId: string
  count: number
  unread: number
  recent: FeedbackEntry[]
  vapidPublicKey: string
}) {
  const [cleared, setCleared] = useState(false)
  const openUnread = cleared ? 0 : unread

  async function markRead() {
    setCleared(true)
    try {
      const res = await fetch('/api/feedback/mark-read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ store_id: storeId }),
      })
      // Put the badge back rather than pretending: an owner who thinks they
      // have read everything stops looking.
      if (!res.ok) setCleared(false)
    } catch {
      setCleared(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-center px-6 py-3 bg-slate-50 rounded-xl border border-gray-200">
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{count}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
            received
          </p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Notes guests sent straight to you. Never shown on Google — only you see them, so you can
          put something right before it becomes a public review, and hear the good things guests
          only say in person.
        </p>
      </div>

      <NotificationToggle storeId={storeId} vapidPublicKey={vapidPublicKey} />

      {openUnread > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5">
          <p className="text-xs font-semibold text-sky-900">
            {openUnread} you have not opened yet
          </p>
          <button
            type="button"
            onClick={markRead}
            className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-2"
          >
            Mark all as read
          </button>
        </div>
      )}

      {recent.length > 0 ? (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
          {recent.map((f) => (
            <div
              key={f.id}
              className={`flex items-start justify-between gap-3 px-4 py-3 ${
                !f.read_at && !cleared ? 'bg-sky-50/60' : 'bg-white'
              }`}
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-0.5" aria-label={`${f.rating} stars`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={13}
                      className={n <= f.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                {f.topics && f.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {f.topics.map((key) => (
                      <span
                        key={key}
                        className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                      >
                        {TOPIC_LABEL[key] ?? key}
                      </span>
                    ))}
                  </div>
                )}
                {f.message && <p className="text-sm text-slate-700 break-words">{f.message}</p>}
                {(f.contact_name || f.contact_phone) && (
                  <p className="text-[11px] text-slate-500">
                    {/* The difference between reading a complaint and being able
                        to answer it. Tel link so it is one tap from here. */}
                    {f.contact_name}
                    {f.contact_name && f.contact_phone ? ' · ' : ''}
                    {f.contact_phone && (
                      <a href={`tel:${f.contact_phone}`} className="font-semibold text-sky-700 hover:underline">
                        {f.contact_phone}
                      </a>
                    )}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-slate-400 tabular-nums shrink-0">
                {new Date(f.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 py-4 text-center">No notes from guests yet.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Results panel (review count / rating over time)
// ─────────────────────────────────────────────

/**
 * The retention argument for the monthly fee, stated by the product itself:
 * current public review count + rating, the delta since tracking began, and a
 * small trend bar. Facts only — no projections, no promises (rank or count
 * guarantees are exactly what the sales rules forbid).
 */
function RatingGoal({ rating, count }: { rating: number; count: number }) {
  if (count === 0) return null
  const goals = ratingGoals(rating, count)
  if (goals.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 leading-relaxed">
        At {rating.toFixed(1)} there is nowhere further for the rating to go.
        From here it is the review count that keeps moving.
      </p>
    )
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-400">
        To move the rating
      </p>
      <ul className="space-y-1">
        {goals.map(({ target, needed }) => (
          <li key={target} className="flex items-baseline gap-2 text-sm text-slate-700">
            <span className="font-bold text-slate-900 tabular-nums">
              {target.toFixed(1)}<span className="text-amber-400">★</span>
            </span>
            <span className="text-slate-400">needs</span>
            <span className="font-bold text-slate-900 tabular-nums">{needed}</span>
            <span className="text-slate-500">more 5-star review{needed === 1 ? '' : 's'}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Estimated from the rounded rating Google shows, assuming the next
        reviews are 5-star. A 4-star review still helps the count but moves the
        average more slowly.
      </p>
    </div>
  )
}

/**
 * Recent activity. `daysSinceNewReview` is the one that changes behaviour: a
 * store whose count has not moved in weeks has a card that fell off the
 * counter, and nothing else in the product would tell the owner that.
 * Deliberately stated as a fact with a suggestion, never as a rebuke.
 */
function ActivityLine({ stats }: { stats: ReviewSnapshot[] }) {
  const { last7, last30, daysSinceNewReview, trackedDays } = reviewActivity(stats)
  if (trackedDays < 2) {
    return (
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Tracking started {trackedDays === 0 ? 'today' : 'yesterday'} — new-review
        activity appears once there are a couple of days to compare.
      </p>
    )
  }
  const stale = daysSinceNewReview != null && daysSinceNewReview >= 14
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-400">
        Recent activity
      </p>
      {last7 == null ? (
        // Every store spends its first week here, including the demos we send
        // out, so this is not a corner case — it is the first impression. Say
        // what is being counted and when the figure arrives, rather than
        // rendering an empty row.
        <p className="text-sm text-slate-500 leading-relaxed">
          Counting from day {trackedDays + 1}. The 7-day figure appears
          {trackedDays >= 6 ? ' tomorrow' : ` in ${7 - trackedDays} days`}.
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          <span className="text-slate-700">
            <span className="font-bold text-slate-900 tabular-nums">
              {last7 > 0 ? `+${last7}` : '0'}
            </span>{' '}
            <span className="text-slate-500">in the last 7 days</span>
          </span>
          {last30 != null && (
            <span className="text-slate-700">
              <span className="font-bold text-slate-900 tabular-nums">
                {last30 > 0 ? `+${last30}` : '0'}
              </span>{' '}
              <span className="text-slate-500">in the last 30</span>
            </span>
          )}
        </div>
      )}
      {daysSinceNewReview != null && (
        <p className={`text-[11px] leading-relaxed ${stale ? 'text-amber-700' : 'text-slate-500'}`}>
          {daysSinceNewReview === 0
            ? 'A new review came in today.'
            : `Last new review ${daysSinceNewReview} day${daysSinceNewReview === 1 ? '' : 's'} ago.`}
          {stale && ' Worth checking the QR card is still where guests see it.'}
        </p>
      )}
      {daysSinceNewReview == null && (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          No new reviews recorded yet since tracking started.
        </p>
      )}
    </div>
  )
}

function ResultsPanel({
  stats,
}: {
  stats: { captured_on: string; rating: number | null; review_count: number }[]
}) {
  if (stats.length === 0) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        Tracking starts automatically — your review count and rating will appear
        here from the first daily snapshot.
      </p>
    )
  }
  const first = stats[0]
  const last = stats[stats.length - 1]
  const delta = last.review_count - first.review_count
  const sinceLabel = new Date(first.captured_on + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
  // Trend bars over the last 30 snapshots, scaled between min and max so
  // movement is visible even when counts are large.
  const window = stats.slice(-30)
  const counts = window.map((s) => s.review_count)
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  const range = Math.max(1, max - min)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-400">Google reviews</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{last.review_count}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-400">Rating</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {last.rating != null ? last.rating.toFixed(1) : '—'}
            <span className="ml-1 align-middle text-amber-400">★</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-400">Since {sinceLabel}</p>
          <p className={`text-2xl font-bold tabular-nums ${delta > 0 ? 'text-green-600' : 'text-slate-900'}`}>
            {delta > 0 ? `+${delta}` : delta}
          </p>
        </div>
      </div>
      {window.length >= 2 && (
        <div className="flex h-10 items-end gap-[2px]" aria-hidden>
          {window.map((snapshot, i) => (
            <div
              key={i}
              title={`${snapshot.captured_on}: ${snapshot.review_count}`}
              className="flex-1 rounded-t bg-slate-300"
              style={{ height: `${20 + ((snapshot.review_count - min) / range) * 80}%` }}
            />
          ))}
        </div>
      )}
      <div className="border-t border-gray-100 pt-4">
        <ActivityLine stats={stats} />
      </div>
      {last.rating != null && (
        <div className="border-t border-gray-100 pt-4">
          <RatingGoal rating={last.rating} count={last.review_count} />
        </div>
      )}
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Public numbers from your Google listing, captured daily. Google moderates
        reviews on its side, so counts can occasionally go down as well as up.
      </p>
    </div>
  )
}

export default function StoreDashboard({
  store,
  storeName,
  storeUrl,
  qrDataUrl,
  customerCount = 0,
  recentCustomers = [],
  crmLoadError = false,
  feedback = [],
  feedbackCount = 0,
  feedbackUnread = 0,
  logoSignedUrl,
  initialTab = 'grow',
  reviewStats = [],
}: Props) {
  const router = useRouter()

  // WhatsApp review-request message — seeded from the store's default language
  // and the customer-facing review page, editable in its own section below.
  const [waLocale, setWaLocale] = useState<WaLocale>((store.default_language as WaLocale) || 'en')
  const [waMessage, setWaMessage] = useState(() =>
    waTemplate((store.default_language as WaLocale) || 'en', storeName, storeUrl),
  )

  // Dashboard is split into three focused workspaces instead of one long scroll.
  // The active tab is mirrored to the URL (?tab=) so a reload or a shared link
  // lands on the same workspace (the server passes it back as initialTab).
  const [tab, setTab] = useState<TabId>(initialTab)

  // ONE map for both keyword lists. Held here rather than inside each manager
  // so that saving one list cannot write back a stale copy of the other's
  // types — both managers read and write this same object.
  const [keywordTypes, setKeywordTypes] = useState<KeywordTypes>(
    () => (store.keyword_types ?? {}) as KeywordTypes,
  )
  const setKeywordType = (kw: string, t: KeywordType) =>
    setKeywordTypes((prev) => ({ ...prev, [kw]: t }))

  function switchTab(t: TabId) {
    setTab(t)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', t)
    window.history.replaceState(null, '', url)
  }
  const TABS = [
    { id: 'grow' as const, label: 'Grow', icon: Megaphone, blurb: 'Collect and answer reviews' },
    { id: 'customers' as const, label: 'Customers', icon: Users, blurb: 'Who came in, and notes they sent you' },
    { id: 'settings' as const, label: 'Settings', icon: Settings, blurb: 'Brand, content and review setup' },
  ]

  // Header avatar: real logo if we have a usable URL, otherwise a brand-colour monogram.
  const logoSrc =
    logoSignedUrl ??
    (store.logo_url && /^(https?:|\/)/.test(store.logo_url) ? store.logo_url : null)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header + tabs ───────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-2xl px-6 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl object-cover border border-gray-200"
                />
              ) : (
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                    text-sm font-bold text-white shadow-sm"
                  style={{ backgroundColor: store.brand_color || '#0f172a' }}
                >
                  {storeName.trim().charAt(0).toUpperCase() || 'L'}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
                  LocalReach
                </p>
                <h1 className="truncate text-base font-bold text-slate-900 tracking-tight">
                  {storeName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <InstallAppButton />
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200
                  bg-white px-3 py-1.5 text-xs font-semibold text-slate-500
                  hover:border-slate-400 hover:text-slate-900 transition-all"
              >
                <ExternalLink size={12} />
                <span className="hidden sm:inline">Preview</span>
              </a>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200
                  bg-white px-3 py-1.5 text-xs font-semibold text-slate-500
                  hover:border-slate-400 hover:text-slate-900 transition-all"
              >
                <LogOut size={12} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>

          {/* Segmented tab bar */}
          <nav className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
            {TABS.map((t) => {
              const active = tab === t.id
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={[
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2',
                    'text-xs font-bold transition-all',
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800',
                  ].join(' ')}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              )
            })}
          </nav>
          <div className="h-3" />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-6 py-8">
        <p className="mb-5 text-xs text-slate-500">
          {TABS.find((t) => t.id === tab)?.blurb}
        </p>

        {/* ── GROW ──
            Panels are hidden, not unmounted, when inactive: unmounting would
            discard in-progress state (a generated reply draft, half-typed
            keywords, an edited WhatsApp message) on every tab switch. */}
        <div hidden={tab !== 'grow'} className="space-y-6">
            {/* First-run orientation — folds away, always available for reference. */}
            <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3.5">
                <span className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] uppercase text-slate-500">
                  <span className="text-base leading-none">💡</span>
                  How LocalReach works
                </span>
                <span className="text-[10px] font-semibold text-slate-400 group-open:hidden">Show</span>
                <span className="hidden text-[10px] font-semibold text-slate-400 group-open:inline">Hide</span>
              </summary>
              <ol className="space-y-3 border-t border-gray-100 px-5 py-4">
                {[
                  ['Show your QR code', 'Print it for your counter or table, or send your review link by WhatsApp (both are below).'],
                  ['Guests leave a review in seconds', 'They scan, tap what they liked, and post the draft on Google in their own words. Every guest gets the same path, whatever they rated you.'],
                  ['Reply to Google reviews with AI', 'Got a review on Google? Paste it into “Review replies” below and post the reply we write for you.'],
                ].map(([title, body], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </details>

            {(store.google_place_id || reviewStats.length > 0) && (
              <SectionCard label="Your results" icon={<Star size={14} />}>
                <ResultsPanel stats={reviewStats} />
              </SectionCard>
            )}

            <SectionCard label="Customer QR Code" icon={<QrCode size={14} />}>
              <QRCodePanel storeUrl={storeUrl} qrDataUrl={qrDataUrl} storeId={store.id} />
            </SectionCard>

            <SectionCard label="WhatsApp review requests" icon={<MessageCircle size={14} />}>
              <WhatsAppRequestSection
                storeName={storeName}
                storeUrl={storeUrl}
                locale={waLocale}
                message={waMessage}
                onLocale={setWaLocale}
                onMessage={setWaMessage}
              />
            </SectionCard>

            <SectionCard label="Review replies" icon={<Reply size={14} />}>
              <ReplyGenerator
                storeId={store.id}
                storeName={storeName}
                defaultLocale={store.default_language}
                initialSettings={store.reply_settings ?? null}
                forcedKeywords={store.forced_keywords ?? []}
                keywords={store.keywords}
                entityArea={store.entity_area ?? null}
                entityCity={store.entity_city ?? null}
                entityCategoryLabel={(store.entity_category_label as Record<string, string> | null) ?? null}
              />
            </SectionCard>
        </div>

        {/* ── CUSTOMERS ── */}
        <div hidden={tab !== 'customers'} className="space-y-6">
            <SectionCard label="Customers" icon={<Users size={14} />}>
              <CrmSection count={customerCount} recent={recentCustomers} waMessage={waMessage} loadError={crmLoadError} />
            </SectionCard>

            <SectionCard label="Private feedback" icon={<MessageSquareWarning size={14} />}>
              <FeedbackSection
                storeId={store.id}
                count={feedbackCount}
                unread={feedbackUnread}
                recent={feedback}
                vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''}
              />
            </SectionCard>
        </div>

        {/* ── SETTINGS ── */}
        <div hidden={tab !== 'settings'} className="space-y-6">
            <SettingsHeading title="Branding" hint="How your review page looks to guests" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <SectionCard label="Store Logo" icon={<span className="text-base leading-none">🖼</span>}>
                <LogoUploader
                  storeId={store.id}
                  currentLogoUrl={logoSignedUrl ?? store.logo_url}
                />
              </SectionCard>

              <SectionCard label="Brand Color" icon={<Palette size={14} />}>
                <BrandColorEditor storeId={store.id} initial={store.brand_color} />
              </SectionCard>
            </div>

            <SectionCard label="Store Content" icon={<Globe size={14} />}>
              <ContentEditor
                storeId={store.id}
                initial={{
                  store_name: store.store_name,
                  greeting_text: store.greeting_text,
                  description: store.description,
                }}
              />
            </SectionCard>

            <SettingsHeading title="Review setup" hint="Controls the reviews and replies you generate" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <SectionCard label="Default Language" icon={<Languages size={14} />}>
                <LanguageSelectorSection storeId={store.id} initial={store.default_language} />
              </SectionCard>

              <SectionCard label="Business Category" icon={<Tag size={14} />}>
                <BusinessCategorySelectorSection storeId={store.id} initial={store.business_category} />
              </SectionCard>
            </div>

            <SectionCard label="Location & business type (AI visibility)" icon={<MapPin size={14} />}>
              <EntitySection
                storeId={store.id}
                initialArea={store.entity_area ?? null}
                initialCity={store.entity_city ?? null}
                initialCategoryLabel={(store.entity_category_label as Record<string, string> | null) ?? null}
                googleReviewUrl={store.google_review_url}
              />
            </SectionCard>

            <SectionCard label="Google Review Link" icon={<Link2 size={14} />}>
              <ReviewUrlEditor storeId={store.id} initial={store.google_review_url} />
            </SectionCard>

            <SectionCard label="Core phrases (SEO)" icon={<Star size={14} />}>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                The phrases you most want to be found for. Each guest is offered a couple of
                them as recommended pills that are already switched on, mixed in with the ones
                below — and a guest can remove any of them. Almost nobody does, so they reach most
                reviews, but nothing is ever added to a review the guest did not agree to.
                They rotate between guests, so your reviews do not all read the same.
              </p>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                The small dropdown on each phrase tells us <span className="font-semibold text-slate-800">what
                the phrase is</span> — a thing, something you do, a whole range, a quality, or a search
                phrase. It decides which sentences the phrase can appear in: a treatment should never be
                praised the way a dish is. We guess it for you; correct it when the guess is wrong.
              </p>
              <ForcedKeywordManager
                storeId={store.id}
                initial={store.forced_keywords ?? []}
                locale={store.default_language}
                types={keywordTypes}
                onTypeChange={setKeywordType}
              />
            </SectionCard>

            <SectionCard label="Guest keywords (tap-to-add)" icon={<Tag size={14} />}>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                These appear as tappable buttons on your review page. Guests tap the ones that
                match their visit, and we build a natural review from them. Add the dishes, services
                and highlights guests are likely to mention. (Your core phrases above are mixed into this
                same list, pre-selected.)
              </p>
              <KeywordManager
                storeId={store.id}
                initial={store.keywords}
                businessCategory={store.business_category}
                locale={store.default_language}
                types={keywordTypes}
                onTypeChange={setKeywordType}
              />
            </SectionCard>
        </div>

      </main>
    </div>
  )
}
