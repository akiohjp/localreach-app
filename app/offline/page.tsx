import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

/**
 * Offline fallback, precached by the service worker (public/sw.js). Kept as a
 * fully static Server Component with NO client JS so it renders and its
 * "Try again" link works even on a fresh install with no connectivity (the
 * page's JS chunk is never fetched). The link re-navigates to "/" — the SW
 * serves this page again while offline and loads the app once back online.
 */
export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="LocalReach"
          width={72}
          height={72}
          className="mx-auto mb-6 rounded-2xl shadow-md"
        />
        <h1 className="text-lg font-bold text-slate-900">You&rsquo;re offline</h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          We couldn&rsquo;t reach the network. Check your connection and try
          again — your review takes just a moment.
        </p>
        {/* Plain anchor (not next/link) on purpose: a hard navigation needs no
            client JS, so "Try again" works on an offline fresh install. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          Try again
        </a>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Powered by LocalReach
        </p>
      </div>
    </main>
  );
}
