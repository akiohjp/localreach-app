/**
 * The guest-facing review link, in one place.
 *
 * Two shapes exist and both stay valid forever (QR codes get printed):
 *   long   https://localreach.miraireach.marketing/store/<uuid>
 *   short  https://qr.miraireach.ae/<slug>        (NEXT_PUBLIC_QR_HOST + stores.slug)
 *
 * Every surface that shows or encodes the link (owner dashboard QR, counter
 * card, master admin, WhatsApp share) goes through guestReviewUrl(), so the
 * short form is used everywhere at once when the host is configured and the
 * store has a slug, and nowhere when either is missing.
 *
 * No Next/Supabase imports: the middleware (Edge) and scripts use this too.
 */

/** 31 characters, no 0/o and 1/i/l, so a slug read off a card is never mistyped. */
export const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const SLUG_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/;

/** Path pattern the QR host rewrites to the store page ("/x7kp2m"). */
export const SLUG_PATH_RE = /^\/([23456789abcdefghjkmnpqrstuvwxyz]{6})\/?$/;

/** The short host, normalised (no scheme, no path, lower case), or null when unset. */
export function qrHost(env: Record<string, string | undefined> = process.env): string | null {
  const raw = (env.NEXT_PUBLIC_QR_HOST ?? "").trim().toLowerCase();
  const host = raw.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "");
  return host || null;
}

/** True when a request's Host header is the short host. */
export function isQrHost(
  hostHeader: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const host = qrHost(env);
  if (!host || !hostHeader) return false;
  return hostHeader.trim().toLowerCase().replace(/:\d+$/, "") === host;
}

/**
 * The link a guest scans or taps. Short when possible, long otherwise; the
 * long form is always valid, so a store that predates slugs loses nothing.
 */
export function guestReviewUrl(
  store: { id: string; slug?: string | null },
  appUrl: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const host = qrHost(env);
  if (host && store.slug && SLUG_RE.test(store.slug)) return `https://${host}/${store.slug}`;
  return `${appUrl.replace(/\/$/, "")}/store/${store.id}`;
}
