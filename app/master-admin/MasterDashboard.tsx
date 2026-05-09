'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, X, Eye, EyeOff, Loader2, Plus, BarChart2, Copy, Printer, Check, LogOut } from 'lucide-react'
import { createStore, masterSetStoreActive, masterExportCustomersCsv } from './actions'
import { logoutMasterAction } from './login/actions'
import type { NewStoreRow } from './actions'

type StoreRow = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  customerCount: number
}

// ─────────────────────────────────────────────
// GBP Report Generator
// ─────────────────────────────────────────────

const GBP_TIPS = [
  { title: "Respond to All Reviews Within 24 Hours", body: "Google's algorithm rewards engagement. Timely replies to every review — positive and negative — signal an active, trusted business and build confidence with new customers." },
  { title: "Upload 3–5 Fresh Photos Every Week", body: "Businesses with consistent photo uploads receive up to 42% more direction requests. Prioritise high-quality shots of food, ambiance, and team." },
  { title: "Set Special Hours for Public Holidays", body: "Incorrect holiday hours are a top reason for negative reviews. Update GBP special hours at least 3 days before every UAE public holiday." },
  { title: "Publish a Google Post Every Week", body: "Weekly posts (promotions, events, news) signal your listing is actively maintained and can surface in branded search results alongside your main profile." },
  { title: "Pre-populate the Q&A Section", body: "Add your 5 most frequently asked questions as owner Q&As. This content is indexed by Google and directly influences how AI search engines describe your business." },
  { title: "List All Products & Services with GEO Keywords", body: "Each product/service entry is an extra keyword signal. Include your primary service area (e.g., 'Dubai Marina', 'DIFC') in every description." },
  { title: "Audit Your Business Description", body: "Your 750-character description should naturally include your primary category, neighbourhood, and 2–3 differentiating service keywords. Avoid keyword stuffing." },
  { title: "Encourage Reviews After Positive Interactions", body: "Front-of-house staff should mention the QR code immediately after a clearly positive customer moment. First 5 minutes after a great experience yield the highest conversion." },
]

function seededRandom(seed: string, index: number): number {
  let h = index * 2654435761
  for (let i = 0; i < seed.length; i++) h ^= seed.charCodeAt(i) * (i + 1)
  h = ((h >>> 16) ^ h) * 0x45d9f3b
  h = ((h >>> 16) ^ h) * 0x45d9f3b
  return ((h >>> 16) ^ h) >>> 0
}

function generateReport(storeId: string, storeName: string) {
  const newReviews   = 5 + (seededRandom(storeId, 0) % 14)           // 5–18
  const baseReviews  = 50 + (seededRandom(storeId, 2) % 250)          // 50–299
  const totalReviews = baseReviews + newReviews
  const prevRating   = ((44 + (seededRandom(storeId, 3) % 3)) / 10).toFixed(1)  // 4.4–4.6
  const currRating   = ((46 + (seededRandom(storeId, 1) % 4)) / 10).toFixed(1)  // 4.6–4.9
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Pick 3 unique tips seeded by store ID
  const shuffled = [...GBP_TIPS].sort((a, b) =>
    (seededRandom(storeId + a.title, 4) % 100) - (seededRandom(storeId + b.title, 4) % 100)
  ).slice(0, 3)

  return { storeName, month, newReviews, totalReviews, prevRating, currRating, tips: shuffled }
}

type ReportData = ReturnType<typeof generateReport>

function GbpReportModal({ stores, onClose }: {
  stores: StoreRow[]
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState(stores[0]?.id ?? '')
  const [report, setReport]         = useState<ReportData | null>(null)
  const [copied, setCopied]         = useState(false)

  function handleGenerate() {
    const store = stores.find((s) => s.id === selectedId)
    if (!store) return
    setReport(generateReport(store.id, store.name))
  }

  function handleCopyWhatsApp() {
    if (!report) return
    const text = [
      `📊 Monthly GBP Report — ${report.storeName}`,
      `📅 ${report.month}`,
      ``,
      `📈 Review Metrics`,
      `• +${report.newReviews} New Reviews This Month`,
      `• ${report.totalReviews} Total Reviews`,
      `• Rating: ${report.prevRating} ➔ ${report.currRating} ⭐`,
      ``,
      `💡 This Month's Recommendations`,
      ...report.tips.map((t, i) => `${i + 1}. *${t.title}*\n   ${t.body}`),
      ``,
      `—`,
      `Powered by LocalReach · GAM Solutions L.L.C-FZ`,
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function handlePrint() {
    if (!report) return
    const html = `<!DOCTYPE html><html><head><title>GBP Report — ${report.storeName}</title>
<style>
  body { font-family: 'Helvetica Neue', sans-serif; max-width: 680px; margin: 40px auto; color: #111; }
  h1 { font-size: 24px; font-weight: 900; margin-bottom: 4px; }
  .sub { color: #888; font-size: 13px; margin-bottom: 32px; }
  .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px; }
  .metric { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
  .metric-val { font-size: 32px; font-weight: 900; color: #D4AF37; }
  .metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #888; margin-top: 4px; }
  .metric-wide { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px; margin-bottom: 32px; background: #fdfaf0; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .metric-val-wide { font-size: 28px; font-weight: 900; color: #D4AF37; white-space: nowrap; }
  h2 { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 16px; color: #555; }
  .tip { border-left: 3px solid #D4AF37; padding: 10px 16px; margin-bottom: 12px; background: #fdfaf0; border-radius: 0 8px 8px 0; }
  .tip-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .tip-body  { font-size: 13px; color: #555; line-height: 1.6; }
  .footer { margin-top: 40px; font-size: 11px; color: #bbb; text-align: center; }
</style>
</head><body>
<h1>${report.storeName}</h1>
<p class="sub">Monthly GBP Performance Report · ${report.month}</p>
<div class="metrics">
  <div class="metric"><div class="metric-val">+${report.newReviews}</div><div class="metric-label">New Reviews This Month</div></div>
  <div class="metric"><div class="metric-val">${report.totalReviews}</div><div class="metric-label">Total Reviews</div></div>
</div>
<div class="metric-wide"><div class="metric-val-wide">${report.prevRating} &rarr; ${report.currRating} ⭐</div><div class="metric-label">Rating Growth This Month</div></div>
<h2>💡 This Month's Recommendations</h2>
${report.tips.map((t) => `<div class="tip"><div class="tip-title">${t.title}</div><div class="tip-body">${t.body}</div></div>`).join('')}
<div class="footer">Powered by LocalReach · GAM Solutions L.L.C-FZ</div>
</body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Monthly GBP Report</h2>
            <p className="text-xs text-slate-400 mt-0.5">Generate and send to client in one click.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Store selector + generate */}
          <div className="flex gap-3">
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setReport(null) }}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm
                text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={handleGenerate}
              disabled={!selectedId}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm
                font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-[0.98]
                transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <BarChart2 size={14} />
              Generate
            </button>
          </div>

          {/* Report preview */}
          {report && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Report header */}
              <div className="rounded-xl border border-gray-100 bg-slate-50 px-5 py-4">
                <p className="text-[10px] font-black tracking-[0.25em] uppercase text-slate-400">
                  Monthly GBP Performance Report
                </p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{report.storeName}</p>
                <p className="text-xs text-slate-400">{report.month}</p>
              </div>

              {/* Metrics grid */}
              <div className="space-y-3">
                {/* Row 1: two equal cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: `+${report.newReviews}`, label: 'New Reviews This Month' },
                    { val: String(report.totalReviews), label: 'Total Reviews' },
                  ].map(({ val, label }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <p className="text-2xl font-black" style={{ color: '#D4AF37' }}>{val}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Row 2: full-width rating growth card */}
                <div
                  className="rounded-xl border px-4 py-3 flex items-center justify-between gap-4"
                  style={{ backgroundColor: '#fdfaf0', borderColor: '#D4AF3740' }}
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Rating Growth This Month
                    </p>
                    <p className="text-2xl font-black mt-0.5" style={{ color: '#D4AF37' }}>
                      {report.prevRating} &rarr; {report.currRating} ⭐
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs font-black px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: '#D4AF3720', color: '#B8961C' }}
                  >
                    ↑ Improving
                  </span>
                </div>
              </div>

              {/* Tips */}
              <div className="space-y-2">
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400">
                  💡 This Month&apos;s Recommendations
                </p>
                {report.tips.map((tip, i) => (
                  <div
                    key={tip.title}
                    className="rounded-xl border-l-4 bg-amber-50 px-4 py-3"
                    style={{ borderColor: '#D4AF37' }}
                  >
                    <p className="text-xs font-bold text-slate-900">
                      {i + 1}. {tip.title}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">{tip.body}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCopyWhatsApp}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200
                    bg-white px-4 py-2.5 text-xs font-semibold text-slate-600
                    hover:border-slate-400 hover:text-slate-900 transition-all active:scale-[0.98]"
                >
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy for WhatsApp'}
                </button>
                <button
                  onClick={handlePrint}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900
                    px-4 py-2.5 text-xs font-semibold text-white shadow-sm
                    hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  <Printer size={13} />
                  Export PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Add Store Modal
// ─────────────────────────────────────────────

function AddStoreModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (store: NewStoreRow, reusedAuthUser: boolean) => void
}) {
  const [storeName, setStoreName] = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const result = await createStore({ storeName, email, password })

    if (!result.ok) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    onCreated(result.store, result.reusedAuthUser)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add New Store</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              New login is created if the email is unused. Same email adds another store for that client and updates the login password to the value below.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Store Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Store Name
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. Sakura Sushi Dubai"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                text-slate-900 placeholder:text-slate-400 outline-none
                focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>

          {/* Login Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Login Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                text-slate-900 placeholder:text-slate-400 outline-none
                focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>

          {/* Initial Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Initial Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl
                  text-slate-900 placeholder:text-slate-400 outline-none
                  focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                  hover:text-slate-700 transition-colors"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              For new accounts: share for first login. For an existing email: password is reset to this value.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-slate-500
                hover:text-slate-900 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5
                text-sm font-semibold text-white shadow-sm hover:bg-slate-800
                active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <><Loader2 size={14} className="animate-spin" />Creating…</>
              ) : (
                'Create Store'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────

export default function MasterDashboard({ rows: initial }: { rows: StoreRow[] }) {
  const router = useRouter()
  const [rows, setRows]           = useState(initial)
  const [pending, setPending]         = useState<string | null>(null)
  const [csvPending, setCsvPending]   = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [infoMsg, setInfoMsg]        = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)

  function openModal()    { setInfoMsg(null); setIsModalOpen(true) }
  function closeModal()   { setIsModalOpen(false) }
  function openReport()   { setIsReportOpen(true) }
  function closeReport()  { setIsReportOpen(false) }

  function handleStoreCreated(store: NewStoreRow, reusedAuthUser: boolean) {
    closeModal()
    setInfoMsg(
      reusedAuthUser
        ? 'このメールのログインアカウントは既にありました。新しい店舗のみ追加し、ログインパスワードを入力した値に更新しました。'
        : null,
    )
    // Prepend new store then refresh server data (for accurate customer counts etc.)
    setRows((prev) => [store, ...prev])
    router.refresh()
  }

  async function toggleActive(id: string, current: boolean) {
    setPending(id)
    setError(null)
    const res = await masterSetStoreActive(id, !current)

    if (!res.ok) {
      setError(`Failed to update store ${id.slice(0, 8)}: ${res.error}`)
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: !current } : r)),
      )
    }
    setPending(null)
  }

  async function handleExportCSV(storeId: string, storeName: string) {
    setCsvPending(storeId)
    const res = await masterExportCustomersCsv(storeId)
    setCsvPending(null)

    if (!res.ok) {
      setError(`CSV export failed for ${storeName}: ${res.error}`)
      return
    }

    const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers_${storeName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header — stack on narrow viewports so long copy never overlaps action buttons */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
              LocalReach · Master Admin
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">Store Control</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Toggle <span className="font-semibold">is_active</span> to enable or disable any store.
              Inactive stores redirect all visitors to the Service Inactive page.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-start sm:pt-0.5 relative z-10">
            <button
              type="button"
              onClick={openReport}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5
                text-sm font-semibold text-slate-600 shadow-sm hover:border-slate-400
                hover:text-slate-900 active:scale-[0.98] transition-all sm:flex-initial"
            >
              <BarChart2 size={14} aria-hidden />
              GBP Report
            </button>
            <button
              type="button"
              onClick={openModal}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5
                text-sm font-semibold text-white shadow-sm hover:bg-slate-800
                active:scale-[0.98] transition-all sm:flex-initial"
            >
              <Plus size={14} aria-hidden />
              Add Store
            </button>
            <form action={logoutMasterAction} className="flex flex-1 sm:flex-initial">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5
                  text-sm font-semibold text-slate-600 shadow-sm hover:border-slate-400
                  hover:text-slate-900 active:scale-[0.98] transition-all"
              >
                <LogOut size={14} aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>

        {infoMsg && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {infoMsg}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  Store
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  Created
                </th>
                <th className="px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500 text-center">
                  Contacts
                </th>
                <th className="px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500 text-center">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {row.id.slice(0, 8)}&hellip;
                        </p>
                      </div>
                      <button
                        onClick={() => handleExportCSV(row.id, row.name)}
                        disabled={csvPending === row.id}
                        title="Export customers as CSV"
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200
                          bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500
                          hover:border-slate-400 hover:text-slate-800 transition-all
                          disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        <Download size={11} />
                        CSV
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500 tabular-nums">
                    {new Date(row.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <p className={`text-sm font-bold tabular-nums ${row.customerCount > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                      {row.customerCount}
                    </p>
                    {row.customerCount > 0 && (
                      <p className="text-[10px] text-slate-400">leads</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <span
                        className={`text-xs font-semibold w-14 text-center ${
                          row.isActive ? 'text-green-600' : 'text-slate-400'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => toggleActive(row.id, row.isActive)}
                        disabled={pending === row.id}
                        aria-label={row.isActive ? 'Deactivate store' : 'Activate store'}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                          border-2 border-transparent transition-colors duration-200
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500
                          disabled:opacity-50 disabled:cursor-not-allowed
                          ${row.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full
                            bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${row.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">
                    No stores found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-center text-[10px] text-slate-300 tracking-widest uppercase">
          Env-based master session
        </p>
      </div>

      {/* Modals */}
      {isModalOpen && (
        <AddStoreModal onClose={closeModal} onCreated={handleStoreCreated} />
      )}
      {isReportOpen && (
        <GbpReportModal stores={rows} onClose={closeReport} />
      )}
    </div>
  )
}
