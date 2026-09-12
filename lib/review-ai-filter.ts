/**
 * Post-filters for AI-written guest review drafts (/api/generate-review).
 *
 * The prompt (lib/review-prompt.ts) asks for the right thing; this file is what
 * turns the ask into a guarantee. A draft that fails any check here is never
 * shown to the guest: the route retries once, then hands over to the template
 * engine. "Close enough" does not ship under a guest's name.
 *
 * Kept free of Next/Supabase imports so scripts can run the exact same checks.
 */
import type { SupportedLocale } from "@/types/database";

export type DraftCheck =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/**
 * Phrases that read as machine-written on Google. A review that carries one is
 * rejected unless the guest tapped a phrase that contains it (a store may
 * legitimately have "Hidden Gem" as a pill; that is the owner's call).
 */
export const AI_TELL_PHRASES: readonly string[] = [
  "hidden gem",
  "nestled",
  "elevate",
  "culinary",
  "testament",
  "oasis",
  "impeccable",
  "delve",
  "vibrant",
  "bustling",
  "delectable",
  "tantalizing",
  "tantalising",
  "meticulous",
  "top-notch",
  "top notch",
  "exceeded expectations",
  "exceeded my expectations",
  "10/10",
  "must-try",
  "second to none",
  "unparalleled",
  "exquisite",
  "sumptuous",
];

/**
 * Phrases that only exist because the model wrote the instruction down instead
 * of following it. The opening and closing moves in lib/review-prompt tell the
 * model HOW to write; a small model sometimes answers by quoting the brief.
 *
 * Found live on 2026-09-12: "The food is the one thing I would change nothing
 * about." and "I would not change how they prepare the doughnuts because it is
 * the one thing I would not change." — three unusable drafts out of the six
 * that reached one closing move. That move is gone, but the same failure can
 * come from any of the other seventy, so it is caught here by shape.
 *
 * Every entry has to be something no real guest would type about a shop. A
 * phrase a guest might plausibly write (say "in my own words") does not belong
 * here: a false positive costs a regeneration and, at the end of the budget,
 * hands over a draft that was fine.
 */
export const PROMPT_LEAK_PHRASES: readonly string[] = [
  "tapped phrase",
  "the one thing i would change nothing about",
  "one thing i would not change",
  "one thing you would not change",
  "closing line",
  "mid-thought",
  "five words or fewer",
  "four to eight words",
  "the first sentence",
  "this sentence",
  "the tapped",
  "full stop",
  "in the review",
  "this review says",
];

/**
 * Length rails per locale. Words for EN/AR, characters (no spaces) for JA.
 * The floor depends on the rating (a 5 is expected to say more than a 4):
 * a draft under it is regenerated, because "thin" was the owner's reading of
 * a 38-word draft on 2026-09-06.
 */
export const LENGTH_RAILS: Record<SupportedLocale, { min4: number; min5: number; max: number; unit: "words" | "chars" }> = {
  en: { min4: 55, min5: 68, max: 170, unit: "words" },
  ar: { min4: 48, min5: 58, max: 160, unit: "words" },
  ja: { min4: 120, min5: 150, max: 430, unit: "chars" },
};

/** The guest's optional free-text line: bounded, printable, one line. */
export function sanitizeGuestNote(raw: unknown, max = 200): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/**
 * Normalise what the model returned into the one-paragraph, dash-free,
 * unquoted shape every other review in the product has. Formatting only —
 * nothing here can make a bad draft good.
 */
function stripLabel(t: string): string {
  return t.replace(/^(?:review|draft|here(?:'s| is) (?:the|your) review)\s*:\s*/i, "").trim();
}

export function cleanReviewDraft(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "").trim();
  // Bold/italic markers around the tapped phrases (seen on the 2026-09-06
  // sample run despite the "no markdown" line). Formatting only, so stripped
  // rather than rejected; headings and fences still fail in checkReviewDraft.
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1");
  t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, "$1$2");
  // A leading label the model sometimes adds despite the instruction, and the
  // quotes it sometimes wraps the whole thing in. Either can sit inside the
  // other, so the label is stripped on both sides of the quote strip.
  t = stripLabel(t);
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("“") && t.endsWith("”"))) {
    t = t.slice(1, -1).trim();
  }
  t = stripLabel(t);
  t = t.replace(/—/g, ", ").replace(/–/g, "-");
  // One paragraph (PARAGRAPH_BREAKS is off across the product).
  t = t.replace(/\s*\r?\n\s*/g, " ");
  t = t.replace(/^[-*•]\s+/, "");
  t = t.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?])/g, "$1");
  return t.trim();
}

export function measureLength(text: string, locale: SupportedLocale): number {
  if (LENGTH_RAILS[locale].unit === "chars") return text.replace(/\s+/g, "").length;
  return text.split(/\s+/).filter(Boolean).length;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

// Built with RegExp() rather than literals: Unicode property escapes are an
// ES2018 syntax and tsconfig targets ES2017; every runtime we deploy to
// (Node 20+, evergreen browsers) supports them.
const EMOJI_RE = new RegExp("\\p{Extended_Pictographic}", "u");
const HASHTAG_RE = new RegExp("(^|\\s)#[\\p{L}\\d_]", "u");

export type DraftContext = {
  locale: SupportedLocale;
  rating: number;
  keywords: string[];
  storeName: string;
  /**
   * This store's recent shipped drafts, NEWEST FIRST. A new draft must not
   * open like any of the first 20 (same first five words) nor read like one
   * (shared 4-grams), and must not share its first three words with the
   * newest eight: those are the ones a reader sees side by side on Google.
   * (A two-word rule was tried on 2026-09-07 and rejected 4 in 10 first
   * attempts: the model's stock of openers is narrower than its prose.)
   */
  recent?: readonly string[];
};

// RegExp() rather than a literal: \p{} is ES2018 syntax and tsconfig targets ES2017.
const NON_WORD_RE = new RegExp("[^\\p{L}\\p{N}\\s]", "gu");

/** Lower-cased word tokens (JA/AR: characters), punctuation dropped. */
function tokens(text: string): string[] {
  const t = text.toLowerCase().replace(NON_WORD_RE, " ");
  const words = t.split(/\s+/).filter(Boolean);
  // Character-based when the text has no spaces to speak of (Japanese).
  if (words.length < 6 && t.replace(/\s/g, "").length > 20) return Array.from(t.replace(/\s/g, ""));
  return words;
}

/** The first N tokens, joined: what a reader compares when reviews sit side by side. */
export function openingKey(text: string, n = 5): string {
  return tokens(text).slice(0, n).join(" ");
}

function ngrams(toks: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= toks.length; i++) out.add(toks.slice(i, i + n).join(" "));
  return out;
}

/** Share of the draft's 4-grams that also occur in `other` (0..1). */
export function ngramOverlap(draft: string, other: string, n = 4): number {
  const a = ngrams(tokens(draft), n);
  if (a.size === 0) return 0;
  const b = ngrams(tokens(other), n);
  let hit = 0;
  for (const g of a) if (b.has(g)) hit++;
  return hit / a.size;
}

/** Above this share of shared 4-grams, two reviews read as the same review. */
export const SIMILARITY_MAX = 0.3;

/**
 * A rejection the route may overrule when it has nothing better to ship: the
 * draft is clean and truthful and only misses a preference (length target,
 * distinct opening, distance from recent drafts). Every other reason is
 * content that must not reach the guest.
 *
 * Seen 2026-09-08 on the first call to a fresh instance during a slow minute
 * at Google: a 38-word draft fell to the length floor, the retry ran out of
 * budget, and the guest got the template although a usable AI draft existed.
 */
export function isSoftRejection(reason: string): boolean {
  return /^(too_short|too_long|opening_repeat|too_similar)(:|$)/.test(reason);
}

/**
 * The verdict on one cleaned draft. Reasons are short machine-readable tags so
 * ai_review_drafts.reason can be grouped when reading why the route fell back.
 */
class RejectDraft extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

export function checkReviewDraft(text: string, ctx: DraftContext): DraftCheck {
  try {
    return checkReviewDraftInner(text, ctx);
  } catch (e) {
    if (e instanceof RejectDraft) return { ok: false, reason: e.reason };
    throw e;
  }
}

function checkReviewDraftInner(text: string, ctx: DraftContext): DraftCheck {
  const t = text.trim();
  if (!t) return { ok: false, reason: "empty" };

  if (EMOJI_RE.test(t)) return { ok: false, reason: "emoji" };
  if (HASHTAG_RE.test(t)) return { ok: false, reason: "hashtag" };
  if (/\*\*|^#{1,6}\s|```/m.test(t)) return { ok: false, reason: "markdown" };
  if (/["“”「」]/.test(t)) return { ok: false, reason: "quotes" };
  if ((t.match(/!/g) ?? []).length > 2) return { ok: false, reason: "exclamations" };
  if (/https?:\/\/|www\.|@[a-z0-9]+\.[a-z]{2,}|\+?\d[\d\s-]{7,}\d/i.test(t)) {
    return { ok: false, reason: "contact_detail" };
  }
  if (/(^|[^\d])[1-5]\s*(?:\/\s*5|stars?\b|-star)|[★☆⭐]/i.test(t)) {
    return { ok: false, reason: "rating_mentioned" };
  }

  // The verbatim guarantee, case-free: every phrase the guest left switched on
  // appears word for word, in order. Capitalisation may follow the sentence
  // ("Fresh doughnuts" as a pill is "fresh doughnuts" mid-sentence; names and
  // places keep their capitals on their own). An exact-case rule sent 8 of 10
  // otherwise-fine drafts back on the 2026-09-06 sample run, and Google's
  // matching is not case-sensitive either.
  const lower = t.toLowerCase();
  for (const kw of ctx.keywords) {
    if (kw && !lower.includes(kw.toLowerCase())) return { ok: false, reason: `keyword_missing:${kw}` };
  }

  const tapped = ctx.keywords.map((k) => k.toLowerCase());
  for (const phrase of AI_TELL_PHRASES) {
    if (tapped.some((k) => k.includes(phrase))) continue;
    if (lower.includes(phrase)) return { ok: false, reason: `ai_tell:${phrase}` };
  }

  for (const phrase of PROMPT_LEAK_PHRASES) {
    if (lower.includes(phrase)) return { ok: false, reason: `prompt_leak:${phrase}` };
  }

  const name = ctx.storeName.trim();
  if (name.length >= 3 && countOccurrences(lower, name.toLowerCase()) > 1) {
    return { ok: false, reason: "store_name_repeated" };
  }

  // Against this store's recent drafts: the opening must be new, and the body
  // must not be a rephrasing (owner's rule 2026-09-07: fifty reviews of one
  // place must not look like one person wrote them).
  const recent = (ctx.recent ?? []).filter(Boolean).slice(0, 20);
  recent.forEach((prev, i) => {
    if (openingKey(t) === openingKey(prev)) throw new RejectDraft("opening_repeat");
    if (i < 8 && openingKey(t, 3) === openingKey(prev, 3)) throw new RejectDraft("opening_repeat");
    const overlap = ngramOverlap(t, prev);
    if (overlap > SIMILARITY_MAX) throw new RejectDraft(`too_similar:${Math.round(overlap * 100)}`);
  });

  // Length last, so a draft with a content defect reports that defect.
  const rails = LENGTH_RAILS[ctx.locale];
  const len = measureLength(t, ctx.locale);
  const min = ctx.rating >= 5 ? rails.min5 : rails.min4;
  if (len < min) return { ok: false, reason: `too_short:${len}` };
  if (len > rails.max) return { ok: false, reason: `too_long:${len}` };

  return { ok: true, text: t };
}
