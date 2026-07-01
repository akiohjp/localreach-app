/**
 * Review text generation (zero API).
 * Assembler: full business name + all keywords verbatim + ~100 words, human-style phrasing.
 * Do not add AIO / GEO / SEO product language into generated review text; only natural guest wording.
 * Guest-facing output must not use typographic long dashes (em/en); enforced in `review-full-templates.ts`.
 * Seeded RNG + per-run nonce so outputs vary strongly across runs.
 */

import { buildFullTemplateReview } from "@/lib/review-full-templates";

export type GenerateReviewOptions = {
  nonce?: string;
  /**
   * Per-outlet entropy (store UUID + optional hints). Same keywords + different IDs
   * produce visibly different arcs; same ID + new nonce still rotates phrasing each run.
   */
  outletKey?: string;
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mix bits so small nonce changes flip many template slots. */
function avalanche32(x: number): number {
  let v = x >>> 0;
  v ^= v >>> 16;
  v = Math.imul(v, 0x7feb352d);
  v ^= v >>> 15;
  v = Math.imul(v, 0x846ca68b);
  return (v ^ (v >>> 16)) >>> 0;
}

function computeReviewSeed(
  store: string,
  keywordsOrdered: string[],
  nonce: string,
  outlet: string,
): number {
  const sorted = [...keywordsOrdered].sort().join("\0");
  const ordered = keywordsOrdered.join("\0");
  const meta = `${keywordsOrdered.length}\0${keywordsOrdered.reduce((n, k) => n + k.length, 0)}`;
  const hStable = hashString(`${sorted}\0${store}\0${outlet}\0${meta}`);
  const hEntropy = hashString(`${nonce}\0${ordered}\0${store}`);
  return avalanche32(hStable ^ avalanche32(hEntropy));
}

export function generateReview(
  storeName: string,
  keywords: string[],
  options?: GenerateReviewOptions,
): string {
  const store = storeName.trim() || "this place";
  const nonce =
    options?.nonce ??
    (typeof globalThis !== "undefined"
      ? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      : `${Date.now()}-ssr`);

  const outlet = options?.outletKey?.trim() ?? "";
  const cleaned = keywords.map((k) => k.trim()).filter(Boolean);
  const seed = computeReviewSeed(store, cleaned, nonce, outlet);
  return buildFullTemplateReview(store, cleaned, seed);
}

/** Call once per generated review (client). Each call must be unique for visible shuffle in demos. */
export function createReviewNonce(): string {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID && c?.getRandomValues) {
      const extra = new Uint32Array(2);
      c.getRandomValues(extra);
      return `${c.randomUUID()}:${extra[0].toString(16)}:${extra[1].toString(16)}`;
    }
    if (c?.randomUUID) return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 14)}`;
}
