import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isValidUuid } from "@/lib/is-valid-uuid";
import { checkRateLimit } from "@/lib/api-rate-limit";
import type { GuestEvent } from "@/lib/guest-event";
import { BOT_RE, clientIp, deviceFrom, ipHash, sameOrigin } from "@/lib/guest-request";

/**
 * A tap on the guest review screen, logged to guest_events (migration
 * 20261003120000). Called by lib/guest-event.ts from the guest's browser.
 *
 * Answers 204 whatever happens, including when the table does not exist yet:
 * the guest is on their way to Google and a missing row is worth less than a
 * broken button.
 */

export const maxDuration = 5;

const NO_CONTENT = new NextResponse(null, { status: 204 });
const EVENTS = new Set([
  "draft_shown",
  "post_click",
  "copy",
  "copy_blocked",
  "rated",
  "google_shown",
]);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NO_CONTENT;
  const ua = (req.headers.get("user-agent") || "").slice(0, 200);
  if (BOT_RE.test(ua)) return NO_CONTENT;

  let body: {
    storeId?: unknown;
    event?: unknown;
    sessionId?: unknown;
    locale?: unknown;
    rating?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NO_CONTENT;
  }
  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  const raw = typeof body.event === "string" ? body.event : "";
  if (!isValidUuid(storeId) || !EVENTS.has(raw)) return NO_CONTENT;
  const event = raw as GuestEvent;
  const rating =
    typeof body.rating === "number" && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5
      ? body.rating
      : null;

  const ip = clientIp(req);
  if (ip) {
    const { allowed } = await checkRateLimit(`event:iph:${ip}`, 3600, 200);
    if (!allowed) return NO_CONTENT;
  }

  try {
    const { error } = await createAdminClient().from("guest_events").insert({
      store_id: storeId,
      event,
      session_id: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
      locale: typeof body.locale === "string" ? body.locale.slice(0, 8) : null,
      ip_hash: ipHash(ip),
      device: deviceFrom(ua),
      // Column added 20261008120000; only "rated" carries it.
      ...(rating !== null ? { rating } : {}),
    });
    if (error && error.code !== "23503") console.error("[event] insert failed", error.message);
  } catch (e) {
    console.error("[event] insert failed", e);
  }
  return NO_CONTENT;
}
