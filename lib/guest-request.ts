import "server-only";
import { createHash } from "node:crypto";

/**
 * What the guest-page beacons (/api/view, /api/event) read off a request.
 * One copy, so a page open and a button tap from the same phone hash alike
 * and can be read side by side.
 */

/** Crawlers and link unfurlers. Their requests are not guests and are not stored. */
export const BOT_RE =
  /bot|crawl|spider|slurp|preview|fetcher|facebookexternalhit|whatsapp|telegram|discord|slackbot|twitterbot|linkedinbot|embedly|quora|pinterest|vkshare|headless|lighthouse|monitor|curl|wget|python-requests|axios|node-fetch|go-http/i;

export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || "";
}

/** /24 for IPv4, /48 for IPv6. Enough to recognise a network, not a person. */
export function ipPrefix(ip: string): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean).slice(0, 3);
    return parts.length ? `${parts.join(":")}::/48` : null;
  }
  const octets = ip.split(".");
  if (octets.length !== 4) return null;
  return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
}

/**
 * Salted so the digest cannot be reversed by hashing the IPv4 space. The
 * service-role key is always present where this runs; VIEW_HASH_SALT
 * overrides it if the key is ever rotated and old rows must stay comparable.
 */
export function ipHash(ip: string): string | null {
  if (!ip) return null;
  const salt = process.env.VIEW_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex").slice(0, 16);
}

export function deviceFrom(ua: string): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!ua) return "unknown";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

/** A foreign page must not be able to write rows into a client's history. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
