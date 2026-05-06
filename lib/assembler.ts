/**
 * Review text generation — zero API.
 * Assembler: full business name + all keywords verbatim + ~100 words, human-style phrasing.
 * Do not add AIO / GEO / SEO product language into generated review text — only natural guest wording.
 * Seeded RNG + per-run nonce so outputs vary strongly across runs.
 */

import { buildFullTemplateReview } from "@/lib/review-full-templates";

export type GenerateReviewOptions = {
  nonce?: string;
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number): () => number {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function takeKeywordsRaw(keywords: string[], rng: () => number): string[] {
  const cleaned = keywords.map((k) => k.trim()).filter(Boolean);
  return shuffle(cleaned, rng);
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

  const seed = hashString(
    [...keywords].sort().join("\0") + "\0" + store + "\0" + nonce,
  );
  const rng = createRng(seed);
  const kws = takeKeywordsRaw(keywords, rng);
  return buildFullTemplateReview(store, kws, rng);
}

/** Call once per generated review (client). Strengthens variance vs. keyword set alone. */
export function createReviewNonce(): string {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
