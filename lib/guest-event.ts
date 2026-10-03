import { isValidUuid } from "@/lib/is-valid-uuid";

export type GuestEvent = "draft_shown" | "post_click" | "copy" | "copy_blocked";

/**
 * Record one tap on the guest review screen (POST /api/event). Uses the same
 * per-tab session id ViewBeacon stored, so the open and the taps line up.
 *
 * keepalive, because post_click fires as the guest leaves for Google. Silent:
 * a failed beacon must never reach the guest. Preview pages (no real store
 * row) send nothing.
 */
export function logGuestEvent(storeId: string, event: GuestEvent, locale?: string) {
  if (!isValidUuid(storeId)) return;
  let sessionId: string | null = null;
  try {
    sessionId = sessionStorage.getItem(`lr:view:${storeId}`);
  } catch {
    // storage disabled: log without an id
  }
  void fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId, event, sessionId, locale: locale ?? null }),
    keepalive: true,
  }).catch(() => {});
}
