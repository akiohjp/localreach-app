import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isValidUuid } from "@/lib/is-valid-uuid";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { BOT_RE, clientIp, deviceFrom, ipHash, ipPrefix, sameOrigin } from "@/lib/guest-request";

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
  if (!sameOrigin(req)) return NO_CONTENT;

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
