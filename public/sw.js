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

const CACHE_VERSION = "localreach-v2";
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

// ── Push: new guest feedback ────────────────────────────────────────────────
// The dashboard is something an owner opens on purpose, and feedback that only
// exists behind a deliberate visit reads to staff as feedback that never came.
// This is the one channel that reaches the phone on its own — the app is
// already installable, and on iOS push only works once it has been installed,
// which is what the "Install app" button is for.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "New guest feedback";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      // Reuse the installed app's own icons so the notification is recognisable.
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Same tag per store: a busy evening collapses into one line instead of
      // burying the phone in separate notifications.
      tag: data.tag || "feedback",
      renotify: true,
      data: { url: data.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Focus a tab that already has the dashboard open rather than stacking
      // another one on top of it.
      for (const client of all) {
        if (client.url.includes("/admin") && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
