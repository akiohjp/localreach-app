/**
 * Stores whose guest page asks for the stars and then hands the guest to
 * Google — no keyword step, no draft (template or AI), no text of ours at all.
 *
 * Let it dough, 2026-10-08: the owner does not want AI anywhere near the
 * reviews. A draft we write can carry our mistakes into a review published
 * under the guest's name (2026-10-04 the cookie note was moved onto Brulee Me
 * Away), and template drafts are still "our words" — so the whole draft path
 * is off for this store, not just the Gemini switch. Same QR, same link.
 *
 * Keyed by store id, not slug: both /store/<uuid> and /r/<slug> reach it.
 */
export const RATING_ONLY_STORE_IDS = new Set<string>([
  "72cc4277-05a7-4dc2-b44e-5977cdecf413", // Let It Dough!, WAFI Mall (2dy2tq)
]);

export function isRatingOnly(storeId: string): boolean {
  return RATING_ONLY_STORE_IDS.has(storeId);
}
