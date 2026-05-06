/**
 * Human-style review text (zero API).
 * - Business name appears at least twice, verbatim.
 * - Every selected keyword appears verbatim at least once (Oxford-style list + optional weave).
 * - Template pools must not use product jargon (AIO, GEO, SEO, "maps optimization", etc.) — reads as spam.
 * - Length tuned toward ~100 English words.
 */

export type TemplateCtx = {
  store: string;
  a: string;
  b: string;
  c: string;
  extrasTail: string;
};

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** Oxford comma join — keeps each keyword phrase intact. */
export function oxfordJoinKeywordPhrases(phrases: string[]): string {
  const p = phrases.filter(Boolean);
  if (p.length === 0) return "";
  if (p.length === 1) return p[0]!;
  if (p.length === 2) return `${p[0]} and ${p[1]}`;
  return `${p.slice(0, -1).join(", ")}, and ${p[p.length - 1]}`;
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

// ─── Openers: must include {store} — long / short pools ─────────────────────

type Opener = (store: string) => string;

const OPENERS_LONG: readonly Opener[] = [
  (s) =>
    `We ate at ${s} recently and I figured I'd jot down what stuck with us — nothing fancy, just the parts that would matter if a friend asked.`,
  (s) =>
    `Had been meaning to try ${s} for a while; the night didn't feel overhyped on our end, and a few things are still clear in my head the next day.`,
  (s) =>
    `Spent an evening at ${s} with friends. A few details were genuinely strong, so I'm writing this while it's still fresh.`,
  (s) =>
    `First visit to ${s} went better than I expected. I'll keep this short: what worked, what I'd order again, and why I'd go back.`,
  (s) =>
    `Dinner at ${s} was the kind of meal where you walk out and actually want to say something online — so here are straight notes from our table.`,
];

const OPENERS_SHORT: readonly Opener[] = [
  (s) =>
    `Quick take after ${s}: overall a good night, and a couple of specifics are worth mentioning.`,
  (s) =>
    `Stopped by ${s} not long ago; the highs were clear enough that I still remember them.`,
  (s) =>
    `${s} wasn't flawless for us, but the good bits below are real enough that I'd return.`,
];

// ─── Keyword core: all phrases, verbatim — variants by density ─────────────

type CoreBuild = (store: string, list: string) => string;

const CORE_LONG: readonly CoreBuild[] = [
  (s, list) =>
    `What landed best for me was ${list}. At ${s} that wasn't just wording — you could tell someone cared about getting those right.`,
  (s, list) =>
    `If I had to describe the night in a handful of phrases, I'd pick ${list}. ${s} kept that thread from the first bite to the last.`,
  (_, list) =>
    `The things I'd repeat to a coworker or neighbor are ${list}: specific enough that I'm not reaching for generic praise.`,
];

const CORE_MID: readonly CoreBuild[] = [
  (s, list) =>
    `Standouts for us were ${list}; ${s} didn't treat those like afterthoughts.`,
  (_, list) =>
    `The through-line of the meal felt like ${list} — nothing in that set felt like a weak link.`,
  (s, list) =>
    `What I'd steer people toward is ${list}, and ${s} actually delivered on those.`,
];

const CORE_COMPACT: readonly CoreBuild[] = [
  (_, list) =>
    `What worked: ${list}.`,
  (s, list) =>
    `${s} really showed up on ${list}.`,
  (_, list) =>
    `I'd call out ${list} as what made the visit memorable.`,
];

// ─── Bridge (optional length tuning) — may include store ─────────────────────

const BRIDGES_LONG: readonly ((store: string) => string)[] = [
  (s) =>
    `Service at ${s} matched the food — friendly when we needed something, not hovering the rest of the time.`,
  (s) =>
    `Room was comfortable: noise level and pacing felt right for a proper dinner, not a rushed turnover.`,
];

const BRIDGES_SHORT: readonly ((store: string) => string)[] = [
  (s) =>
    `Front of house at ${s} was in step with the kitchen.`,
  (s) =>
    `Nothing felt slapdash — ${s} had its act together night-of.`,
];

// ─── Closers: must include {store} ───────────────────────────────────────────

const CLOSERS_LONG: readonly Opener[] = [
  (s) =>
    `I'd go back to ${s} without overthinking it; the stuff above is what I'd tell someone choosing a spot this week.`,
  (s) =>
    `Happy to recommend ${s} — fair for what we got, and the evening felt easy from walk-in to goodbye.`,
  (s) =>
    `Bottom line for us: ${s} did the important parts well; if our experience is typical, it's a solid pick.`,
];

const CLOSERS_SHORT: readonly Opener[] = [
  (s) =>
    `${s} gets a yes from me; I'll be back when I'm in the mood for the same kind of night.`,
  (s) =>
    `I'd send people to ${s}; it was worth the time we spent there.`,
];

/** Rough cost of list+glue words for budget tuning (not counting store). */
function keywordBudgetSignals(kws: string[]): { many: boolean; longPhrases: boolean } {
  const many = kws.length > 8;
  const longPhrases =
    kws.reduce((n, k) => n + k.length, 0) > 140 || kws.some((k) => k.split(/\s+/).length > 5);
  return { many, longPhrases };
}

function buildKeywordParagraph(
  store: string,
  kws: string[],
  rng: () => number,
  compact: boolean,
): string {
  const list = oxfordJoinKeywordPhrases(kws);
  if (compact) {
    return pick(CORE_COMPACT, rng)(store, list);
  }
  if (kws.length >= 12 || keywordBudgetSignals(kws).many) {
    return pick(CORE_MID, rng)(store, list);
  }
  return pick(CORE_LONG, rng)(store, list);
}

function buildReviewInner(
  store: string,
  kws: string[],
  rng: () => number,
  compact: boolean,
): string {
  const openerPool = compact ? OPENERS_SHORT : OPENERS_LONG;
  const bridgePool = compact ? BRIDGES_SHORT : BRIDGES_LONG;
  const closerPool = compact ? CLOSERS_SHORT : CLOSERS_LONG;

  const opener = pick(openerPool, rng)(store);
  const core = buildKeywordParagraph(store, kws, rng, compact);
  const bridge = pick(bridgePool, rng)(store);
  const closer = pick(closerPool, rng)(store);

  return `${opener} ${core} ${bridge} ${closer}`.replace(/\s+/g, " ").trim();
}

function tuneWordCount(
  text: string,
  store: string,
  rng: () => number,
): string {
  const TARGET = 100;
  let t = text;
  let wc = wordCount(t);

  const trimNonListTail = (s: string): string => {
    const idx = s.lastIndexOf(".");
    if (idx <= 0) return s;
    const prev = s.lastIndexOf(".", idx - 1);
    if (prev <= 0) return s;
    return s.slice(0, idx + 1).trim();
  };

  let guard = 0;
  while (wc > 115 && guard < 4) {
    t = trimNonListTail(t);
    wc = wordCount(t);
    guard++;
  }

  guard = 0;
  const fillers: readonly ((s: string) => string)[] = [
    (s) =>
      `That steady quality is a big part of why I'd pick ${s} again over rolling the dice somewhere new.`,
    (s) =>
      `Walking out of ${s}, we already knew what we'd order next time — that's usually a good sign.`,
  ];

  while (wc < 92 && guard < 6) {
    t = `${t} ${pick(fillers, rng)(store)}`.replace(/\s+/g, " ").trim();
    wc = wordCount(t);
    guard++;
  }

  if (wc < TARGET - 5) {
    t = `${t} ${pick(fillers, rng)(store)}`.replace(/\s+/g, " ").trim();
  }
  if (wordCount(t) > TARGET + 8) {
    t = trimNonListTail(t);
  }

  return t.replace(/\s+/g, " ").trim();
}

function reviewWithNoKeywords(store: string, rng: () => number): string {
  const opener = pick(OPENERS_SHORT, rng)(store);
  const closer = pick(CLOSERS_SHORT, rng)(store);
  const mid =
    "The night ran smoothly for us; I'd still name " +
    store +
    " as a place I'd go back to for hospitality and pacing alone.";
  const t = `${opener} ${mid} ${closer}`.replace(/\s+/g, " ").trim();
  return tuneWordCount(t, store, rng);
}

export const REVIEW_TARGET_WORDS = 100;

/** @deprecated use REVIEW_TARGET_WORDS */
export const GEO_REVIEW_TARGET_WORDS = REVIEW_TARGET_WORDS;

/** @deprecated */
export const FULL_TEMPLATE_COUNTS = {
  one: 0,
  two: 0,
  three: 0,
  total: 0,
} as const;

function appendMissingKeyword(
  text: string,
  kw: string,
  rng: () => number,
): string {
  const tails: readonly ((k: string) => string)[] = [
    (k) => `${k} was a highlight for us.`,
    (k) => `They came through on ${k}.`,
    (k) => `No complaints on ${k}.`,
    (k) => `${k} felt genuine, not bolted on at the end.`,
  ];
  return `${text} ${pick(tails, rng)(kw)}`.replace(/\s+/g, " ").trim();
}

/**
 * Catches accidental reintroduction of old "SEO / AIO" template copy (dev-only console warning).
 * User-supplied keywords may still contain these substrings; warning is informational.
 */
const BANNED_TEMPLATE_LEAK_PHRASES = [
  "aio-style",
  "aio style",
  "for transparency to future guests",
  "decision-quality",
  "maps-driven",
  "using google to compare",
  "optimization for relevance",
  "how people search and choose locally",
  "search and maps",
  "geo optimization",
  "local seo",
  "ai-style summaries",
  "summaries that prize clarity",
] as const;

function warnIfMarketingJargonLeak(text: string): void {
  if (typeof process === "undefined" || process.env.NODE_ENV === "production") return;
  const lower = text.toLowerCase();
  for (const phrase of BANNED_TEMPLATE_LEAK_PHRASES) {
    if (lower.includes(phrase)) {
      console.warn(
        `[review-full-templates] Output contains "${phrase}" — remove from templates; guests should not see product/SEO wording.`,
      );
    }
  }
}

export function buildFullTemplateReview(
  store: string,
  kws: string[],
  rng: () => number,
): string {
  const name = store.trim() || "this establishment";
  const keywords = kws.map((k) => k.trim()).filter(Boolean);

  if (keywords.length === 0) {
    const out = reviewWithNoKeywords(name, rng);
    warnIfMarketingJargonLeak(out);
    return out;
  }

  const shuffled = shuffle(keywords, rng);
  const { many, longPhrases } = keywordBudgetSignals(shuffled);
  const compact = many || longPhrases;

  let text = buildReviewInner(name, shuffled, rng, compact);
  text = tuneWordCount(text, name, rng);

  if (!text.includes(name)) {
    text = `${text} (${name})`.replace(/\s+/g, " ").trim();
  }

  for (const kw of shuffled) {
    if (kw.length > 0 && !text.includes(kw)) {
      text = appendMissingKeyword(text, kw, rng);
    }
  }

  text = tuneWordCount(text, name, rng);
  warnIfMarketingJargonLeak(text);
  return text;
}
