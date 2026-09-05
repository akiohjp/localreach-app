/**
 * Review text generation (zero API).
 * Assembler: full business name + all keywords verbatim + ~100 words, human-style phrasing.
 * Do not add AIO / GEO / SEO product language into generated review text; only natural guest wording.
 * Guest-facing output must not use typographic long dashes (em/en); enforced in `review-full-templates.ts`.
 * Seeded RNG + per-run nonce so outputs vary strongly across runs.
 */

import { buildLocalizedReview, type KeywordTypeMap, type ReviewEntity } from "@/lib/review-engine";
import { resolveAudience, resolveVertical, type ReviewLocale } from "@/lib/review-pools";
import type { SupportedLocale } from "@/types/database";

/**
 * Words that are capitalised in English wherever they sit, so a keyword that
 * starts with one is NOT merely sentence-cased. Nationalities, places, brands
 * and calendar words that turn up in real store configs. Anything not listed
 * stays capitalised too (a miss here keeps the owner's casing, never the
 * reverse), so the list only needs to cover what owners actually type.
 */
const ALWAYS_CAPITALIZED: ReadonlySet<string> = new Set([
  "Emirati", "Arab", "Arabic", "Arabian", "Japanese", "Korean", "Chinese", "Indian", "Italian",
  "French", "Turkish", "Thai", "Lebanese", "Syrian", "Egyptian", "British", "English", "American",
  "German", "Spanish", "Greek", "Mexican", "Pakistani", "Filipino", "Moroccan", "Omani", "Saudi",
  "Kuwaiti", "Bahraini", "Qatari", "Iraqi", "Iranian", "Persian", "African", "Asian", "European",
  "Western", "Swiss", "Belgian", "Dutch", "Australian", "Canadian", "Russian", "Vietnamese",
  "Malaysian", "Indonesian", "Singaporean", "Nepali", "Bangladeshi", "Yemeni", "Jordanian",
  "Sudanese", "Ethiopian", "Kenyan", "Nigerian", "Brazilian", "Mediterranean", "Levantine",
  "Gulf", "Khaleeji", "Hereke", "Anatolian", "Ottoman", "Uzbek", "Afghan", "Kashmiri",
  "Dubai", "Abu", "Sharjah", "Ajman", "Riyadh", "Doha", "Muscat", "Istanbul", "Cappadocia",
  "Tokyo", "Kyoto", "Osaka", "London", "Paris", "Milan", "Google", "Michelin", "Instagram",
  "WhatsApp", "Halal", "Ramadan", "Eid", "Christmas", "Diwali", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March",
  "April", "May", "June", "July", "August", "September", "October", "November", "December",
]);

/**
 * How a keyword is written INSIDE a review sentence.
 *
 * Owners type descriptive phrases in sentence case ("Long-lasting scent",
 * "Elegant packaging") because a form field invites it. Reproduced verbatim
 * mid-sentence that capital is the loudest bot tell on the page: "One thing I
 * didn't expect was the Long-lasting scent." A person writes "the
 * long-lasting scent". So a DECLARED attribute / category / service phrase
 * whose only capital is the first letter of an ordinary word is lowered at the
 * boundary, before the engine sees it. Items and geo phrases keep the owner's
 * casing: a product name is a name, and a search phrase is matched as typed.
 *
 * Search is case-insensitive, so the SEO mechanism is untouched; the visible
 * promise "your phrase appears in the draft" now reads "as a person would
 * write it in the middle of a sentence". verify-keyword-verbatim checks the
 * same form.
 */
export function reviewKeywordForm(keyword: string, type?: string | null): string {
  const kw = keyword.trim();
  if (type !== "attribute" && type !== "category" && type !== "service") return kw;
  const words = kw.split(/\s+/);
  if (words.length < 2) return kw;
  const first = words[0]!;
  // One capital, then ordinary letters (hyphenated allowed): "Long-lasting".
  // "UAE", "K-Beauty", "iPhone" all fail this test and stay as typed.
  if (!/^[A-Z][a-z]+(-[a-z]+)*$/.test(first)) return kw;
  // A capital anywhere later marks a name ("Japanese Tea Gift Set").
  if (words.slice(1).some((w) => /^[A-Z]/.test(w))) return kw;
  if (ALWAYS_CAPITALIZED.has(first.split("-")[0]!)) return kw;
  return first.charAt(0).toLowerCase() + kw.slice(1);
}

export type GenerateReviewOptions = {
  nonce?: string;
  /**
   * Per-outlet entropy (store UUID + optional hints). Same keywords + different IDs
   * produce visibly different arcs; same ID + new nonce still rotates phrasing each run.
   */
  outletKey?: string;
  /** Guest/store locale — 'ja' → Japanese, 'ar' → Arabic, else English. */
  locale?: SupportedLocale;
  /** Store business_category (free text) — selects a vertical flavour. */
  category?: string | null;
  /**
   * How many of the leading keywords are the store's forced/core phrases
   * (mergeGuestAndForced puts forced first). Forced phrases are always woven in;
   * from the remaining guest picks only a seed-rotated few are used per review,
   * so selecting many pills stays natural (no keyword dump) and still rotates.
   */
  forcedCount?: number;
  /** Guest's star rating (4-5 reach generation). 4 biases shorter/measured. */
  rating?: number;
  /**
   * Entity layer (AI visibility): branch area, city and per-locale business
   * noun, woven once per review via dedicated sentences (never via {kw}).
   * `categoryLabel` is the stores.entity_category_label jsonb; the label for
   * the review locale is resolved here (en fallback).
   */
  entity?: {
    area?: string | null;
    city?: string | null;
    categoryLabel?: Record<string, string> | null;
  } | null;
  /**
   * `stores.keyword_types` — what each keyword NAMES (item / service /
   * category / attribute / geo). The engine used to guess this from the
   * string, and the guess is what produced "Big yes to Japanese and Korean
   * groceries." Anything absent from the map still falls back to the guess.
   */
  keywordTypes?: Record<string, string> | null;
};

function toReviewLocale(locale?: SupportedLocale): ReviewLocale {
  return locale === "ja" ? "ja" : locale === "ar" ? "ar" : "en";
}

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
  const rawTypes = (options?.keywordTypes ?? undefined) as KeywordTypeMap | undefined;
  // Sentence-case lowering happens here, once, so every downstream check
  // (verbatim, trimming, tails) works on the form the guest will read.
  const cleaned = keywords
    .map((k) => reviewKeywordForm(k, rawTypes?.[k.trim()]))
    .filter(Boolean);
  const keywordTypes: KeywordTypeMap | undefined = rawTypes
    ? (Object.fromEntries(
        Object.entries(rawTypes).map(([k, v]) => [reviewKeywordForm(k, v), v]),
      ) as KeywordTypeMap)
    : undefined;
  const locale = toReviewLocale(options?.locale);
  const vertical = resolveVertical(options?.category);
  // Local regulars or one-time visitors: decides which voice pools the review draws from.
  const audience = resolveAudience(options?.category);
  // Fold locale + vertical into the entropy so switching language/industry rotates cleanly.
  const seed = computeReviewSeed(store, cleaned, nonce, `${outlet}\0${locale}\0${vertical}`);
  const forcedCount = Math.max(0, Math.min(options?.forcedCount ?? 0, cleaned.length));
  const rating = Math.min(5, Math.max(1, Math.round(options?.rating ?? 5)));
  const entity: ReviewEntity | undefined = options?.entity
    ? {
        area: options.entity.area ?? null,
        city: options.entity.city ?? null,
        cat:
          options.entity.categoryLabel?.[locale]?.trim() ||
          options.entity.categoryLabel?.en?.trim() ||
          null,
      }
    : undefined;
  return buildLocalizedReview(
    store,
    cleaned,
    seed,
    locale,
    vertical,
    forcedCount,
    rating,
    entity,
    keywordTypes,
    audience,
    `${options?.category ?? ""} ${entity?.cat ?? ""} ${store}`,
  );
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
