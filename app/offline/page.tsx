"use client";

/**
 * Offline fallback. Precached by the service worker (public/sw.js) and served
 * for page navigations when the network is unavailable. Must be fully static —
 * no data fetching, no Supabase — so it renders with zero connectivity.
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
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          Try again
        </button>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Powered by LocalReach
        </p>
      </div>
    </main>
  );
}
