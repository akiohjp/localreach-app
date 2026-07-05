'use client'

import { useState } from 'react'

type Lang = 'en' | 'ja'

type Props = {
  customerUrl: string
  adminUrl: string
  masterUrl: string
  lpUrl: string
  qrDataUrl: string
  hasDemoStore: boolean
}

// Customer-facing presentation guide: EN is the default (shown to prospects),
// JA is the owner's view and additionally reveals internal-only notes
// (env hint, master-admin) that prospects shouldn't see.
const STRINGS = {
  en: {
    title: 'Live Demo Guide',
    subtitle:
      'Open the guest review journey and the store dashboard (forced GEO keywords · pills · QR) straight from this page.',
    subnote: 'Presentation helper — open each link in a new tab while you talk.',
    guestHeading: '1. Guest flow',
    guestBody:
      'Star rating → keyword picks → generated review text → post on Google. Forced keywords are merged in behind the scenes.',
    guestButton: 'Open guest screen',
    qrLabel: 'On-site QR (same URL)',
    adminHeading: '2. Store dashboard',
    adminBody:
      'Forced GEO keywords · Guest keyword pills · QR · multilingual content · Google review link · WhatsApp review requests.',
    adminButton: 'Dashboard sign-in',
    otherHeading: '3. More',
    lpButton: 'Product page (LP)',
    scriptHeading: 'Suggested talk track (~3 min)',
    scriptSteps: [
      'On a phone: QR or "guest screen" — stars, keywords, and how natural the generated text reads.',
      'Show the dashboard: "forced keywords enter the text without the guest tapping anything".',
      'The Google-post link and copy flow (actual posting needs the demo environment).',
      'If useful, one line on product positioning via the LP.',
    ],
  },
  ja: {
    title: 'プレゼン用デモガイド',
    subtitle:
      'ゲストのレビュー導線と管理画面（強制GEOキーワード・ピル・QR）を、このページからすぐ開けます。',
    subnote: 'Presentation helper — open each link in a new tab while you talk.',
    guestHeading: '1. お客様フロー（Guest）',
    guestBody:
      '星評価 → キーワード選択 → 生成文案 → Google投稿。強制キーワードは裏で合流します。',
    guestButton: 'お客様画面を開く',
    qrLabel: '会場用 QR（同上URL）',
    adminHeading: '2. 管理画面（Store admin）',
    adminBody:
      'Forced GEO keywords · Guest keyword pills · QR · 多言語コンテンツ · GBPリンク · WhatsAppレビュー依頼。',
    adminButton: '管理ログイン',
    otherHeading: '3. その他',
    lpButton: 'LP（local-reach-lp）',
    scriptHeading: '話す順番の例（約3分）',
    scriptSteps: [
      'スマホで QR または「お客様画面」— 星とキーワード、生成文の natural さ。',
      '「強制キーワードはタップ不要で本文に入る」と管理画面で見せる。',
      'GBP 投稿用リンク・コピー導線（実際の投稿はデモ環境で要調整）。',
      '必要なら LP でプロダクト位置づけの一言。',
    ],
  },
} as const

export default function DemoGuide({
  customerUrl,
  adminUrl,
  masterUrl,
  lpUrl,
  qrDataUrl,
  hasDemoStore,
}: Props) {
  const [lang, setLang] = useState<Lang>('en')
  const t = STRINGS[lang]

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-3xl px-5 py-12 space-y-10">
        {/* Language toggle */}
        <div className="flex justify-end">
          <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {(['en', 'ja'] as Lang[]).map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={[
                  'rounded-lg px-4 py-1.5 text-xs font-bold uppercase transition-all',
                  lang === code
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {code === 'en' ? 'English' : '日本語'}
              </button>
            ))}
          </div>
        </div>

        <header className="space-y-3 text-center">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-slate-400">
            LocalReach
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t.title}
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
            {t.subtitle}
            <span className="block mt-1 text-xs text-slate-500">{t.subnote}</span>
          </p>
        </header>

        {/* Internal-only hint: owner (JA) view only — prospects never see env details. */}
        {!hasDemoStore && lang === 'ja' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-semibold mb-1">ヒント（社内用・ENでは非表示）</p>
            <p className="leading-relaxed text-amber-900/90">
              <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">
                NEXT_PUBLIC_DEMO_STORE_ID
              </code>{' '}
              に本番同様の店舗UUIDを入れると、「お客様フロー」のリンクが{' '}
              <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">/store/…</code>{' '}
              になり、WhatsApp保存も含めたフル体験で話せます。未設定のときはローカルデモの{' '}
              <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">/</code>{' '}
              になります。
            </p>
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
            {t.guestHeading}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">{t.guestBody}</p>
              <a
                href={customerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 transition-colors"
              >
                {t.guestButton}
              </a>
              <p className="text-[10px] text-slate-400 break-all font-mono">{customerUrl}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col items-center justify-center gap-3">
              <p className="text-xs font-semibold text-slate-500 text-center">{t.qrLabel}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code to guest review flow"
                width={220}
                height={220}
                className="rounded-lg border border-gray-100"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
            {t.adminHeading}
          </h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">{t.adminBody}</p>
            <a
              href={adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500 transition-colors"
            >
              {t.adminButton}
            </a>
            <p className="text-[10px] text-slate-400 break-all font-mono">{adminUrl}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
            {t.otherHeading}
          </h2>
          <div className="flex flex-wrap gap-3">
            <a
              href={lpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-400 transition-colors"
            >
              {t.lpButton}
            </a>
            {/* Internal-only: master console link stays off the customer-facing EN view. */}
            {lang === 'ja' && (
              <a
                href={masterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-400 transition-colors"
              >
                マスター管理（/master-admin/login・社内用）
              </a>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-5 space-y-3">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
            {t.scriptHeading}
          </h2>
          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
            {t.scriptSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <p className="text-center text-[10px] text-slate-400 tracking-widest uppercase pb-8">
          Powered by LocalReach · /demo
        </p>
      </div>
    </main>
  )
}
