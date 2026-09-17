import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { isValidUuid } from "@/lib/is-valid-uuid";
import { checkRateLimit } from "@/lib/api-rate-limit";

/**
 * Guest page open, logged to store_views (migration 20260917120000).
 *
 * Called once per browser session by app/store/ViewBeacon.tsx. It is a beacon
 * from the guest's own browser on purpose: WhatsApp, iMessage and Slack fetch
 * the page server-side to build their preview card, so logging inside the
 * render would count every forward of a demo link as a visit by the person we
 * sent it to. Link unfurlers do not run JavaScript; phones do.
 *
 * Answers 204 whatever happens. The guest page must never show an error, and a
 * missing view row is worth less than a broken review flow.
 */

export const maxDuration = 5;

type Body = {
  storeId?: unknown;
  entry?: unknown;
  locale?: unknown;
  sessionId?: unknown;
  referrer?: unknown;
};

const NO_CONTENT = new NextResponse(null, { status: 204 });

/** Crawlers and link unfurlers. Their opens are not visits and are not stored. */
const BOT_RE =
  /bot|crawl|spider|slurp|preview|fetcher|facebookexternalhit|whatsapp|telegram|discord|slackbot|twitterbot|linkedinbot|embedly|quora|pinterest|vkshare|headless|lighthouse|monitor|curl|wget|python-requests|axios|node-fetch|go-http/i;

function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || "";
}

/** /24 for IPv4, /48 for IPv6. Enough to recognise a network, not a person. */
function ipPrefix(ip: string): string | null {
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
 * service-role key is always present where this route runs; VIEW_HASH_SALT
 * overrides it if the key is ever rotated and old rows must stay comparable.
 */
function ipHash(ip: string): string | null {
  if (!ip) return null;
  const salt = process.env.VIEW_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex").slice(0, 16);
}

function deviceFrom(ua: string): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!ua) return "unknown";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

function hostOf(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // A foreign page must not be able to write rows into a client's history.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const host = new URL(origin).host;
      if (host !== req.headers.get("host")) return NO_CONTENT;
    } catch {
      return NO_CONTENT;
    }
  }

  const ua = (req.headers.get("user-agent") || "").slice(0, 200);
  if (BOT_RE.test(ua)) return NO_CONTENT;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NO_CONTENT;
  }

  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  if (!isValidUuid(storeId)) return NO_CONTENT;

  const ip = clientIp(req);
  // One phone opening the same page over and over is one story, not sixty.
  if (ip) {
    const { allowed } = await checkRateLimit(`view:iph:${ip}`, 3600, 120);
    if (!allowed) return NO_CONTENT;
  }

  const entry = body.entry === "store" ? "store" : "r";
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 8) : null;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;
  const referrerHost = hostOf(typeof body.referrer === "string" ? body.referrer : "");

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("store_views").insert({
      store_id: storeId,
      entry,
      locale,
      session_id: sessionId,
      ip_prefix: ipPrefix(ip),
      ip_hash: ipHash(ip),
      device: deviceFrom(ua),
      ua: ua || null,
      referrer_host: referrerHost,
    });
    // A store deleted between render and beacon fails the FK; that is not news.
    if (error && error.code !== "23503") console.error("[view] insert failed", error.message);
  } catch (e) {
    console.error("[view] insert failed", e);
  }

  return NO_CONTENT;
}
