import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo — LocalReach",
  description: "Presentation flow: guest review journey & admin controls.",
};

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export default function DemoPage() {
  const base = baseUrl();
  const demoStoreId = process.env.NEXT_PUBLIC_DEMO_STORE_ID?.trim() ?? "";
  const customerUrl = demoStoreId ? `${base}/store/${demoStoreId}` : `${base}/`;
  const adminUrl = `${base}/admin/login`;
  const masterUrl = `${base}/master-admin/login`;
  const lpUrl = `${base}/local-reach-lp`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=${encodeURIComponent(customerUrl)}`;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-3xl px-5 py-12 space-y-10">
        <header className="space-y-3 text-center">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-slate-400">
            LocalReach
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            プレゼン用デモガイド
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
            ゲストのレビュー導線と管理画面（強制GEOキーワード・ピル・QR）を、このページからすぐ開けます。
            <span className="block mt-1 text-xs text-slate-500">
              Presentation helper — open each link in a new tab while you talk.
            </span>
          </p>
        </header>

        {!demoStoreId && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-semibold mb-1">ヒント</p>
            <p className="leading-relaxed text-amber-900/90">
              <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">
                NEXT_PUBLIC_DEMO_STORE_ID
              </code>{" "}
              に本番同様の店舗UUIDを入れると、「お客様フロー」のリンクが{" "}
              <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">/store/…</code>{" "}
              になり、WhatsApp保存も含めたフル体験で話せます。未設定のときはローカルデモの{" "}
              <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-xs">/</code>{" "}
              になります。
            </p>
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
            1. お客様フロー（Guest）
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                星評価 → キーワード選択 → 生成文案 → Google投稿。強制キーワードは裏で合流します。
              </p>
              <a
                href={customerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 transition-colors"
              >
                お客様画面を開く
              </a>
              <p className="text-[10px] text-slate-400 break-all font-mono">
                {customerUrl}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col items-center justify-center gap-3">
              <p className="text-xs font-semibold text-slate-500 text-center">
                会場用 QR（同上URL）
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrApiUrl}
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
            2. 管理画面（Store admin）
          </h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Forced GEO keywords · Guest keyword pills · QR · 多言語コンテンツ · GBPリンク。
            </p>
            <a
              href={adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500 transition-colors"
            >
              管理ログイン
            </a>
            <p className="text-[10px] text-slate-400 break-all font-mono">
              {adminUrl}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
            3. その他
          </h2>
          <div className="flex flex-wrap gap-3">
            <a
              href={lpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-400 transition-colors"
            >
              LP（local-reach-lp）
            </a>
            <a
              href={masterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-400 transition-colors"
            >
              マスター管理（/master-admin/login・環境変数）
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-5 space-y-3">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
            話す順番の例（約3分）
          </h2>
          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
            <li>スマホで QR または「お客様画面」— 星とキーワード、生成文の natural さ。</li>
            <li>「強制キーワードはタップ不要で本文に入る」と管理画面で見せる。</li>
            <li>GBP 投稿用リンク・コピー導線（実際の投稿はデモ環境で要調整）。</li>
            <li>必要なら LP でプロダクト位置づけの一言。</li>
          </ol>
        </section>

        <p className="text-center text-[10px] text-slate-400 tracking-widest uppercase pb-8">
          Powered by LocalReach · /demo
        </p>
      </div>
    </main>
  );
}
