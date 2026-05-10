'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLink, Palette, Tag, QrCode,
  CheckCircle, Loader2, X, Plus, Download,
  Globe, Link2, LogOut, Languages, Users, Lock,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import LogoUploader from '@/components/LogoUploader'
import type { Store, LocalizedText, SupportedLocale, StoreUpdate } from '@/types/database'

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

type Props = {
  store: Store
  storeName: string
  storeUrl: string
  customerCount?: number
  recentCustomers?: RecentCustomer[]
  /** Signed URL when logo bucket is non-public. */
  logoSignedUrl?: string | null
}

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────

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
  const { error } = await supabase.from('stores').update(patch).eq('id', storeId)
  if (error) throw error
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

function KeywordManager({
  storeId,
  initial,
}: {
  storeId: string
  initial: string[]
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

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && !input && keywords.length) {
      remove(keywords[keywords.length - 1])
    }
  }

  async function handleSave() {
    setState('saving')
    try {
      await saveField(storeId, { keywords })
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
}: {
  storeId: string
  initial: string[]
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
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    }
    if (e.key === 'Backspace' && !input && items.length) {
      remove(items[items.length - 1])
    }
  }

  async function handleSave() {
    setState('saving')
    try {
      await saveField(storeId, { forced_keywords: items })
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 leading-relaxed">
        These phrases are <span className="font-semibold text-slate-800">always woven into</span>{' '}
        the auto-generated review (shop name, locale, GBP link unchanged). Guests choose from{' '}
        <span className="font-semibold text-slate-800">Guest keyword pills</span> below — they never
        have to tap these, but they still appear in the final text for GEO.
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
            <button
              onClick={(e) => {
                e.stopPropagation()
                remove(kw)
              }}
              aria-label={`Remove forced keyword ${kw}`}
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
          placeholder={items.length === 0 ? 'Type a forced phrase and press Enter…' : ''}
          className="min-w-[8rem] flex-1 bg-transparent text-xs text-slate-800
            placeholder:text-slate-400 outline-none"
        />
      </div>

      <p className="text-[10px] text-slate-400">
        Press <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">Enter</kbd>{' '}
        or <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">,</kbd> to
        add · {items.length} forced phrase{items.length !== 1 ? 's' : ''}
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
            Save forced keywords
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

  async function handleSave() {
    setState('saving')
    try {
      await saveField(storeId, { google_review_url: url })
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  const isDirty = url !== initial || state === 'error'

  return (
    <div className="space-y-4">
      <input
        type="url"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setState('idle') }}
        placeholder="https://g.page/r/..."
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
          text-sm text-slate-900 placeholder:text-slate-400 outline-none
          focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
      />
      <p className="text-[10px] text-slate-400">
        The direct link to your Google Business Profile review page.
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

function QRCodePanel({ storeUrl, qrApiUrl }: { storeUrl: string; qrApiUrl: string }) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div className="shrink-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrApiUrl}
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
            href={qrApiUrl}
            download="qr-code.png"
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2
              text-xs font-semibold text-white shadow-sm hover:bg-slate-800
              active:scale-[0.98] transition-all"
          >
            <Download size={12} />
            Download PNG
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
// CRM Stats (read-only — no CSV export for store owners)
// ─────────────────────────────────────────────

function CrmSection({
  count,
  recent,
}: {
  count: number
  recent: RecentCustomer[]
}) {
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
                <div className="text-right shrink-0 space-y-1">
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

export default function StoreDashboard({
  store,
  storeName,
  storeUrl,
  customerCount = 0,
  recentCustomers = [],
  logoSignedUrl,
}: Props) {
  const router = useRouter()
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=${encodeURIComponent(storeUrl)}`

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
              LocalReach · Dashboard
            </p>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {storeName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200
                bg-white px-3 py-1.5 text-xs font-semibold text-slate-500
                hover:border-slate-400 hover:text-slate-900 transition-all"
            >
              <ExternalLink size={12} />
              Preview
            </a>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200
                bg-white px-3 py-1.5 text-xs font-semibold text-slate-500
                hover:border-slate-400 hover:text-slate-900 transition-all"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">

        {/* Row 1: Logo + Color */}
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

        {/* Row 2: Forced + optional GEO keywords */}
        <SectionCard label="Forced GEO keywords" icon={<Lock size={14} />}>
          <ForcedKeywordManager
            storeId={store.id}
            initial={store.forced_keywords ?? []}
          />
        </SectionCard>

        <SectionCard label="Guest keyword pills" icon={<Tag size={14} />}>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Shown as tappable tags on the customer review page. Combined with forced phrases
            above when generating text (duplicates removed automatically).
          </p>
          <KeywordManager storeId={store.id} initial={store.keywords} />
        </SectionCard>

        {/* Row 3: Store Content (multilingual) */}
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

        {/* Row 4: Default Language */}
        <SectionCard label="Default Language" icon={<Languages size={14} />}>
          <LanguageSelectorSection
            storeId={store.id}
            initial={store.default_language}
          />
        </SectionCard>

        {/* Row 5: Google Review Link */}
        <SectionCard label="Google Review Link" icon={<Link2 size={14} />}>
          <ReviewUrlEditor
            storeId={store.id}
            initial={store.google_review_url}
          />
        </SectionCard>

        {/* Row 6: QR Code */}
        <SectionCard label="Customer QR Code" icon={<QrCode size={14} />}>
          <QRCodePanel storeUrl={storeUrl} qrApiUrl={qrApiUrl} />
        </SectionCard>

        {/* Row 7: CRM Stats */}
        <SectionCard label="Customers" icon={<Users size={14} />}>
          <CrmSection count={customerCount} recent={recentCustomers} />
        </SectionCard>

      </main>
    </div>
  )
}
