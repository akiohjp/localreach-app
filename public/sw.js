/*
 * LocalReach service worker.
 *
 * Deliberately conservative for a multi-tenant, Supabase-backed SSR app:
 *   - Static, content-hashed assets  → cache-first (stale-while-revalidate)
 *   - Page navigations               → network-first, fall back to /offline
 *   - API / auth / Supabase / other  → never intercepted (always live)
 *
 * We never cache-serve tenant HTML (store pages, dashboards) so one venue can
 * never see another's cached data. Bump CACHE_VERSION to invalidate old caches.
 */

const CACHE_VERSION = "localreach-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";

// Precache the offline fallback + brand icons so they render with no network.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Individual failures (e.g. an icon 404) must not abort the whole install.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("localreach-") && !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  return /\.(?:css|js|woff2?|ttf|otf|png|jpg|jpeg|gif|webp|avif|svg|ico)$/.test(
    url.pathname,
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; leave POST/PUT (leads, auth) fully untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only — never touch Supabase / third-party (analytics, fonts CDN).
  if (url.origin !== self.location.origin) return;

  // Never cache API or auth routes.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // 1) Static, immutable assets → cache-first with background refresh.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
    return;
  }

  // 2) Page navigations → network-first, offline fallback (never stale tenant HTML).
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }

  // 3) Everything else: default browser handling (live network).
});
