'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import type { SupportedLocale } from '@/types/database'
import styles from './print-card.module.css'

/**
 * A counter card the owner can print, instead of a bare QR PNG they have to
 * lay out themselves.
 *
 * This sits on the only path that actually produces reviews: the QR has to be
 * somewhere a guest sees it while they still remember the visit. Handing over
 * a PNG left every client to design that themselves, and the ones who never
 * got round to it collected nothing — which is the number they judge the
 * monthly fee on.
 *
 * Printed via the browser's own print dialog rather than a PDF library: the
 * layout is CSS the user can see on screen before committing paper, it works
 * on any device the owner already has, and "Save as PDF" is a button in that
 * same dialog for anyone who wants a file to send to a print shop.
 */

type CardSize = 'a5' | 'a6'

const CTA: Record<SupportedLocale, { headline: string; sub: string; dir: 'ltr' | 'rtl' }> = {
  en: { headline: 'How was it?', sub: 'Scan to leave a review — about 30 seconds', dir: 'ltr' },
  ja: { headline: 'いかがでしたか？', sub: 'QRを読み取って感想をひとこと（約30秒）', dir: 'ltr' },
  ar: { headline: 'كيف كانت تجربتك؟', sub: 'امسح الرمز لترك تقييم — حوالي ٣٠ ثانية', dir: 'rtl' },
}

export default function PrintCard({
  storeName,
  storeUrl,
  qrDataUrl,
  brandColor,
  logoUrl,
  locales,
  backHref,
}: {
  storeName: string
  storeUrl: string
  qrDataUrl: string
  brandColor: string
  logoUrl: string | null
  locales: SupportedLocale[]
  backHref: string
}) {
  const [size, setSize] = useState<CardSize>('a5')
  // The primary locale gets the big headline; the rest ride along underneath so
  // a guest who doesn't read it still sees a line they do.
  const [primary, ...secondary] = locales

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Screen-only controls */}
      <div className="print:hidden sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-6 py-4">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2
              text-xs font-semibold text-slate-600 hover:border-slate-500 hover:text-slate-900
              active:scale-[0.98] transition-all"
          >
            <ArrowLeft size={12} />
            Dashboard
          </Link>

          <div className="flex overflow-hidden rounded-xl border border-gray-300">
            {(['a5', 'a6'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  size === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-gray-50'
                }`}
              >
                {s === 'a5' ? 'A5 · counter card' : 'A6 · table tent'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2
              text-xs font-semibold text-white shadow-sm hover:bg-slate-800
              active:scale-[0.98] transition-all"
          >
            <Printer size={12} />
            Print
          </button>
        </div>
        <div className="mx-auto max-w-3xl px-6 pb-4">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Print on plain white paper or card. In the print dialog choose
            &ldquo;Save as PDF&rdquo; if you want a file to send to a print shop.
            Turn off &ldquo;headers and footers&rdquo; so the page URL is not
            printed across the card.
          </p>
        </div>
      </div>

      {/* The card itself */}
      {/* The card is a fixed 148mm (~559px) and never shrinks, so on a phone
          it is wider than the screen. It scrolls inside this box rather than
          dragging the whole page sideways. Print ignores overflow. */}
      <div className="flex justify-center overflow-x-auto px-6 py-10 print:overflow-visible print:p-0">
        <div
          className={`${styles.card} ${size === 'a5' ? styles.a5 : styles.a6}`}
          style={{ borderTop: `10px solid ${brandColor}` }}
        >
          <div className="flex h-full flex-col items-center justify-between p-[8%] text-center">
            <div className="flex flex-col items-center gap-[3%]">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="max-h-[64px] max-w-[60%] object-contain" />
              ) : null}
              <p className="text-[1.15em] font-bold leading-tight text-slate-900">{storeName}</p>
            </div>

            <div className="flex flex-col items-center gap-[2%]">
              <p
                dir={CTA[primary].dir}
                className="text-[1.5em] font-bold leading-tight"
                style={{ color: brandColor }}
              >
                {CTA[primary].headline}
              </p>
              <p dir={CTA[primary].dir} className="text-[0.92em] leading-snug text-slate-600">
                {CTA[primary].sub}
              </p>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt=""
              className="w-[54%] rounded-xl border border-gray-200"
            />

            <div className="flex w-full flex-col items-center gap-[1%]">
              {secondary.map((l) => (
                <p key={l} dir={CTA[l].dir} className="text-[0.8em] leading-snug text-slate-500">
                  {CTA[l].headline} · {CTA[l].sub}
                </p>
              ))}
              <p className="mt-[2%] text-[0.62em] tracking-wide text-slate-400 break-all">
                {storeUrl.replace(/^https?:\/\//, '')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Page box for printing. A plain <style> tag: these are global
          at-rules, not component styling, and styled-jsx cannot parse the
          multi-line Tailwind classNames in this file. */}
      <style>{`
        @media print {
          @page { size: auto; margin: 8mm; }
          html, body { background: #fff !important; }
        }
      `}</style>
    </div>
  )
}
