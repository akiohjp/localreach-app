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
 * Lukewarm wording a happy rating must not carry. 4 and 5 stars are both high
 * marks, so a draft under either is rejected if it hedges, unless the guest's
 * own note is what the hedge came from (their words are kept as written).
 */
export const HEDGE_PHRASES: readonly string[] = [
  "just okay",
  "just ok",
  "not perfect",
  "wasn't perfect",
  "was not perfect",
  "wasn't quite",
  "was not quite",
  "could be better",
  "could have been better",
  "nothing special",
  "room for improvement",
  "only downside",
  "the only thing",
  "a bit disappointing",
  "slightly disappointing",
  "not the best",
  "hit or miss",
  "so-so",
  "mediocre",
  "average at best",
  "left a bit to be desired",
  "まあまあ",
  "普通でした",
  "いまいち",
  "イマイチ",
  "惜しい",
  "残念",
];

/** Length rails per locale. Words for EN/AR, characters (no spaces) for JA. */
export const LENGTH_RAILS: Record<SupportedLocale, { min: number; max: number; unit: "words" | "chars" }> = {
  en: { min: 12, max: 130, unit: "words" },
  ar: { min: 10, max: 120, unit: "words" },
  ja: { min: 25, max: 280, unit: "chars" },
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
  /** The guest's own words, when given: a hedge that comes from them is theirs to keep. */
  note?: string;
};

/**
 * The verdict on one cleaned draft. Reasons are short machine-readable tags so
 * ai_review_drafts.reason can be grouped when reading why the route fell back.
 */
export function checkReviewDraft(text: string, ctx: DraftContext): DraftCheck {
  const t = text.trim();
  if (!t) return { ok: false, reason: "empty" };

  const rails = LENGTH_RAILS[ctx.locale];
  const len = measureLength(t, ctx.locale);
  if (len < rails.min) return { ok: false, reason: `too_short:${len}` };
  if (len > rails.max) return { ok: false, reason: `too_long:${len}` };

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

  const name = ctx.storeName.trim();
  if (name.length >= 3 && countOccurrences(lower, name.toLowerCase()) > 1) {
    return { ok: false, reason: "store_name_repeated" };
  }

  if (!(ctx.note ?? "").trim()) {
    for (const phrase of HEDGE_PHRASES) {
      if (lower.includes(phrase.toLowerCase())) return { ok: false, reason: `hedge:${phrase}` };
    }
  }

  return { ok: true, text: t };
}
