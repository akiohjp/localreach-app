/**
 * Owner-reply generator (zero API).
 *
 * Given a customer's star rating and (optionally) the text they wrote, this
 * assembles a public owner reply that MATCHES the sentiment and, where possible,
 * references the theme the guest wrote about (service, food, staff …).
 *
 * Zero API by design: no per-reply cost, works offline, and stays connector-
 * independent (the owner pastes the review in — we never need a Google API).
 * Same deterministic seeded RNG approach as the review engine, so a fixed nonce
 * is reproducible and a fresh nonce rotates phrasing for a different draft.
 *
 * Nothing here sends anything. The output is a draft the owner edits and copies
 * to Google themselves (human-gated).
 */

import { forkRng } from "@/lib/review-rng";
import {
  REPLY_POOLS,
  THEME_ORDER,
  THEME_DETECT,
  THEME_PHRASE,
  type ReplyLocale,
  type ReplyTone,
  type Sentiment,
  type Theme,
} from "@/lib/reply-pools";
import type { SupportedLocale } from "@/types/database";

export type GenerateReplyOptions = {
  /** 1–5 stars from the guest's review. Drives sentiment. */
  rating: number;
  /** The guest's review text (optional). Used only to detect the theme. */
  reviewText?: string;
  /** Reply language. 'ar' supported; anything else falls back sensibly. */
  locale?: SupportedLocale;
  /** Voice. Defaults to 'warm'. */
  tone?: ReplyTone;
  /**
   * A single locality/area phrase to weave in naturally for Local SEO / GEO / AIO
   * (e.g. "Dubai Marina"). Woven in place-framing on positive/mixed replies only,
   * and only sometimes — never on an apology, never stuffed. Empty = no weave.
   */
  geoPhrase?: string;
  /** Set false to suppress geo weaving even when geoPhrase is present. Default true. */
  weaveGeo?: boolean;
  /** Per-run entropy so each "Regenerate" yields a different draft. */
  nonce?: string;
};

function toReplyLocale(locale?: SupportedLocale): ReplyLocale {
  return locale === "ja" ? "ja" : locale === "ar" ? "ar" : "en";
}

/** 4–5 = positive, 3 = mixed, 1–2 = negative. Out-of-range clamps to neutral. */
export function sentimentForRating(rating: number): Sentiment {
  const r = Math.round(rating);
  if (r >= 4) return "positive";
  if (r <= 2 && r >= 1) return "negative";
  return "mixed";
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/**
 * Detect every theme the review mentions, in priority order. First element is
 * the primary theme. Empty review (or no match) yields [] and the caller uses
 * the generic acknowledgement.
 */
export function detectThemes(reviewText: string): Theme[] {
  const t = (reviewText ?? "").trim();
  if (!t) return [];
  const found: Theme[] = [];
  for (const theme of THEME_ORDER) {
    if (theme === "experience") continue;
    const re = THEME_DETECT[theme];
    if (re.test(t)) found.push(theme);
  }
  // A tiny nudge: a very short review that clearly maps to nothing still gets a
  // primary "experience" so replies can reference "your visit" naturally.
  return found;
}

/** Typographic long dashes read "AI"; normalize any leak (matches review engine). */
function normalizeDashes(text: string): string {
  return text.replace(/—/g, ", ").replace(/–/g, "-");
}

function collapse(s: string): string {
  return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, " ").trim();
}

/** Join sentence fragments with a single space (EN/AR) or nothing (JA). */
function joinSentences(parts: string[], locale: ReplyLocale): string {
  const glue = locale === "ja" ? "" : " ";
  return parts.map(collapse).filter(Boolean).join(glue);
}

export function generateReply(
  storeName: string,
  options: GenerateReplyOptions,
): string {
  const store = storeName.trim() || (options.locale === "ja" ? "当店" : "our team");
  const locale = toReplyLocale(options.locale);
  const tone: ReplyTone = options.tone === "professional" ? "professional" : "warm";
  const sentiment = sentimentForRating(options.rating);
  const pool = REPLY_POOLS[locale][sentiment];

  const themes = detectThemes(options.reviewText ?? "");
  const primaryTheme: Theme | null = themes[0] ?? null;

  const nonce =
    options.nonce ??
    (typeof globalThis !== "undefined"
      ? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      : "ssr");
  const seed = hashString(
    `${store}\0${locale}\0${tone}\0${sentiment}\0${primaryTheme ?? "-"}\0${nonce}`,
  );

  const open = pick(tone === "warm" ? pool.openWarm : pool.openPro, forkRng(seed, 0x101));

  // Name the detected theme only when it's reliably the RIGHT one to name:
  //  - positive: the theme the guest praised
  //  - negative: the whole review is the complaint, so the theme is the problem
  // A mixed (3★) review contains both praise and a gripe, and the top-priority
  // theme is often the praised one — naming it as the thing to fix reads wrong.
  // So mixed uses the generic acknowledgement (still specific enough, never wrong).
  let ack: string;
  if (primaryTheme && sentiment !== "mixed") {
    const phrase = THEME_PHRASE[locale][primaryTheme];
    ack = pick(pool.ackTheme, forkRng(seed, 0x102)).replace(/\{theme\}/g, phrase);
  } else {
    ack = pick(pool.ackGeneric, forkRng(seed, 0x103));
  }

  const body = pick(pool.body, forkRng(seed, 0x104));
  const close = pick(tone === "warm" ? pool.closeWarm : pool.closePro, forkRng(seed, 0x105));
  const signoff = pick(pool.signoff, forkRng(seed, 0x106)).replace(/\{store\}/g, store);

  // ── Local SEO / GEO weave: one locality phrase, natural place-framing, only on
  // positive/mixed, and only sometimes. Never on an apology, never stuffed. ──
  const geo = (options.geoPhrase ?? "").trim();
  const weaveGeo = options.weaveGeo !== false;
  let geoSentence = "";
  if (
    weaveGeo &&
    geo &&
    pool.geoWoven.length > 0 &&
    (sentiment === "positive" || sentiment === "mixed") &&
    forkRng(seed, 0x120)() < 0.72
  ) {
    geoSentence = pick(pool.geoWoven, forkRng(seed, 0x121))
      .replace(/\{geo\}/g, geo)
      .replace(/\{store\}/g, store);
  }

  // ── Structural variation to kill the template cadence: sometimes drop the
  // closing line, and (positive only) sometimes drop the body for a short,
  // human, two-beat reply. Negative always keeps the make-it-right body. ──
  const dropClose = forkRng(seed, 0x131)() < 0.42;
  const dropBody = sentiment === "positive" && forkRng(seed, 0x132)() < 0.28;

  const segments = [open, geoSentence, ack];
  if (!dropBody) segments.push(body);
  if (!dropClose) segments.push(close);

  const bodyText = joinSentences(segments, locale);
  const out = `${bodyText}\n\n${collapse(signoff)}`;
  return normalizeDashes(out).trim();
}

/** Fresh entropy per "Regenerate" click (client). */
export function createReplyNonce(): string {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
