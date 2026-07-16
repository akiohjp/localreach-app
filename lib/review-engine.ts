/**
 * Locale- and vertical-aware review assembler (zero API).
 *
 * Data-driven: pools are plain template strings with placeholders that the
 * engine substitutes, so the same deterministic assembly (seeded RNG, forked
 * slots, ~target length, verbatim store name + keywords, dash normalization)
 * works for any language and any business type.
 *
 * Placeholders:
 *   {store} — business name (verbatim, appears >= twice overall)
 *   {list}  — the joined keyword phrases (verbatim keywords)
 *   {a}{b}  — two keyword sub-lists (dual block)
 *   {kw}    — a single keyword (missing-keyword tail)
 *
 * Rules: no typographic long dashes (em/en) as glue; no SEO/AIO product jargon;
 * conversational guest voice, not a graded essay.
 */

import { forkRng } from "@/lib/review-rng";
import type { ReviewLocale, Vertical, PoolSet } from "@/lib/review-pools";
import { resolvePoolSet } from "@/lib/review-pools";

// ---------------------------------------------------------------- helpers ----

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

const PARAGRAPH_GAP = "\n\n";

function oneLineCollapse(s: string): string {
  return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function normalizeParagraphFormatting(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(PARAGRAPH_GAP)
    .trim();
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function fill(
  tpl: string,
  vars: { store?: string; list?: string; a?: string; b?: string; kw?: string },
): string {
  return tpl
    .replace(/\{store\}/g, vars.store ?? "")
    .replace(/\{list\}/g, vars.list ?? "")
    .replace(/\{a\}/g, vars.a ?? "")
    .replace(/\{b\}/g, vars.b ?? "")
    .replace(/\{kw\}/g, vars.kw ?? "");
}

// ---------------------------------------------------------- locale config ----

type LocaleCfg = {
  /** Length metric: EN counts words, JA counts non-space characters. */
  measure: (s: string) => number;
  target: number;
  min: number;
  max: number;
  /** Sentence separator used when trimming the tail sentence. */
  sentenceEnd: RegExp;
  /** Merge two sentences on the same line. */
  glue: string;
  /** Join verbatim keyword phrases into {list}. */
  joinList: (phrases: string[], rng: () => number) => string;
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}
function cjkCount(text: string): number {
  // Count visible characters (ignore whitespace) — a fair length proxy for JA.
  return text.replace(/\s+/g, "").length;
}

function oxford(p: string[]): string {
  if (p.length === 0) return "";
  if (p.length === 1) return p[0]!;
  if (p.length === 2) return `${p[0]} and ${p[1]}`;
  return `${p.slice(0, -1).join(", ")}, and ${p[p.length - 1]}`;
}
function joinListEn(phrases: string[], rng: () => number): string {
  const p = phrases.filter(Boolean);
  if (p.length <= 1) return p[0] ?? "";
  if (p.length === 2) {
    // Two items read best joined with "and"; a bare comma ("A, B was great")
    // looks like a clipped list. Keep an occasional "plus" for variety.
    return rng() < 0.82 ? `${p[0]} and ${p[1]}` : `${p[0]} plus ${p[1]}`;
  }
  if (p.length === 3) {
    const r = rng();
    if (r < 0.54) return oxford(p);
    return `${p[0]}, ${p[1]} and ${p[2]}`;
  }
  const last = p[p.length - 1]!;
  return rng() < 0.5 ? oxford(p) : `${p.slice(0, -1).join(", ")} and ${last}`;
}
function joinListJa(phrases: string[], rng: () => number): string {
  const p = phrases.filter(Boolean);
  if (p.length <= 1) return p[0] ?? "";
  // Two items read best joined with「と」; a bare「、」("A、B が…") looks like a
  // clipped list. Keep「、」only occasionally for variety.
  if (p.length === 2) return rng() < 0.8 ? `${p[0]}と${p[1]}` : `${p[0]}、${p[1]}`;
  const last = p[p.length - 1]!;
  const head = p.slice(0, -1).join("、");
  return rng() < 0.5 ? `${head}、${last}` : `${head}、そして${last}`;
}
function joinListAr(phrases: string[], rng: () => number): string {
  // Arabic "و" (and). Spaced (" و ") rather than attached, so a mixed
  // Arabic + Latin list (English SEO keywords) never glues an Arabic letter
  // onto a Latin word. Two natural styles, chosen by rng for variety: a comma
  // list with a final "و", or "و" repeated between every item (both idiomatic).
  const p = phrases.filter(Boolean);
  if (p.length <= 1) return p[0] ?? "";
  if (p.length === 2) return `${p[0]} و ${p[1]}`;
  if (rng() < 0.5) return p.join(" و ");
  const last = p[p.length - 1]!;
  const head = p.slice(0, -1).join("، ");
  return `${head} و ${last}`;
}

const LOCALE_CFG: Record<ReviewLocale, LocaleCfg> = {
  en: {
    // Real Google reviews skew SHORT (a great many are 10-40 words); high targets
    // force the length-tuner to stuff fillers, which reads as padding. Kept low so
    // most reviews stay lean and only occasionally run long. Per-review buckets
    // (LEN_BUCKETS) spread the actual length so a store's reviews don't cluster.
    measure: wordCount,
    target: 55,
    min: 24,
    max: 100,
    sentenceEnd: /\./g,
    glue: " ",
    joinList: joinListEn,
  },
  ja: {
    // JA Google reviews also skew short (many are 30-80 chars). Low targets keep
    // most reviews lean; buckets below spread the actual length.
    measure: cjkCount,
    target: 90,
    min: 30,
    max: 220,
    sentenceEnd: /。/g,
    glue: "",
    joinList: joinListJa,
  },
  ar: {
    // Arabic is space-delimited, so word count is a fair length metric; it packs
    // more meaning per word than English, so the targets sit a touch lower.
    measure: wordCount,
    target: 42,
    min: 16,
    max: 95,
    sentenceEnd: /\./g,
    glue: " ",
    joinList: joinListAr,
  },
};

// ------------------------------------------------------- length variation ----

/**
 * Real reviews vary WIDELY in length; a store whose reviews all land ~100
 * words is a visible pattern (to readers and to spam heuristics). Each review
 * is seeded into a short/medium/long bucket. Guards: verbatim keywords need
 * room, so keyword-heavy selections are pushed to longer buckets; a 4-star
 * guest reads more measured than a 5-star one, so 4-star biases shorter.
 */
type LenBucket = { kind: "short" | "medium" | "long"; target: number; min: number; max: number };
const LEN_BUCKETS: Record<ReviewLocale, { short: LenBucket; medium: LenBucket; long: LenBucket }> = {
  en: {
    short: { kind: "short", target: 18, min: 10, max: 32 },
    medium: { kind: "medium", target: 42, min: 28, max: 62 },
    long: { kind: "long", target: 72, min: 52, max: 100 },
  },
  ja: {
    short: { kind: "short", target: 34, min: 18, max: 58 },
    medium: { kind: "medium", target: 72, min: 45, max: 115 },
    long: { kind: "long", target: 128, min: 90, max: 220 },
  },
  ar: {
    short: { kind: "short", target: 14, min: 8, max: 26 },
    medium: { kind: "medium", target: 32, min: 22, max: 50 },
    long: { kind: "long", target: 58, min: 42, max: 95 },
  },
};

function pickLenBucket(locale: ReviewLocale, seed: number, rating: number, wovenCount: number): LenBucket {
  const b = LEN_BUCKETS[locale];
  if (wovenCount >= 5) return b.long;                       // 5 verbatim phrases can't breathe in 55 words
  const r = forkRng(seed, 0x777)();
  const measured = rating <= 4;
  if (wovenCount >= 4) return r < (measured ? 0.6 : 0.5) ? b.medium : b.long;
  if (measured) return r < 0.45 ? b.short : r < 0.9 ? b.medium : b.long;
  return r < 0.34 ? b.short : r < 0.74 ? b.medium : b.long;
}

// -------------------------------------------------------------- assembly ----

function weaveParagraphs(parts: string[], rng: () => number, compact: boolean, glue: string): string {
  const cleaned = parts.map(oneLineCollapse).filter(Boolean);
  if (cleaned.length === 0) return "";
  const mergeProb = compact ? 0.5 : 0.36;
  let acc = cleaned[0]!;
  for (let i = 1; i < cleaned.length; i++) {
    acc = rng() < mergeProb ? `${acc}${glue}${cleaned[i]}` : `${acc}${PARAGRAPH_GAP}${cleaned[i]}`;
  }
  return normalizeParagraphFormatting(acc);
}

function appendToLast(full: string, sentence: string, glue: string): string {
  const paras = normalizeParagraphFormatting(full).split(/\n\n+/).filter(Boolean);
  const frag = oneLineCollapse(sentence);
  if (!frag) return normalizeParagraphFormatting(full);
  if (paras.length === 0) return frag;
  const li = paras.length - 1;
  paras[li] = oneLineCollapse(`${paras[li]}${glue}${frag}`);
  return paras.join(PARAGRAPH_GAP);
}

function trimTailSentence(multiline: string, sentenceEnd: RegExp): string {
  const paras = normalizeParagraphFormatting(multiline).split(/\n\n+/).filter(Boolean);
  if (paras.length === 0) return multiline.trim();
  const li = paras.length - 1;
  const last = paras[li]!;
  const end = sentenceEnd.source; // "." or "。"
  const ch = end === "\\." ? "." : "。";
  const idx = last.lastIndexOf(ch);
  if (idx <= 0) return multiline;
  const prev = last.lastIndexOf(ch, idx - 1);
  if (prev <= 0) return multiline;
  paras[li] = last.slice(0, idx + 1).trim();
  return paras.join(PARAGRAPH_GAP);
}

/**
 * A filler that already appears in the text (fillers overlap with closers, and
 * the padding loop samples with replacement) reads as an obvious bot tell.
 * Retry a few times for one the review doesn't contain yet; '' = none fresh.
 */
function pickFreshFiller(t: string, store: string, pool: PoolSet, rng: () => number): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const cand = fill(pick(pool.fillers, rng), { store });
    if (!t.includes(cand)) return cand;
  }
  return "";
}

/** True when trimming would delete a verbatim keyword the review must keep. */
function trimLosesKeyword(before: string, after: string, protect: readonly string[]): boolean {
  return protect.some((k) => k && before.includes(k) && !after.includes(k));
}

function tuneLength(
  text: string,
  store: string,
  pool: PoolSet,
  cfg: LocaleCfg,
  seed: number,
  salt: number,
  protect: readonly string[] = [],
): string {
  const rng = forkRng(seed, salt);
  let t = text;
  let n = cfg.measure(t);
  let guard = 0;
  while (n > cfg.max && guard < 4) {
    const trimmed = trimTailSentence(t, cfg.sentenceEnd);
    // Never trim away a woven keyword to satisfy a (short) length bucket —
    // the verbatim-keyword guarantee outranks the target length.
    if (trimmed === t || trimLosesKeyword(t, trimmed, protect)) break;
    t = trimmed;
    n = cfg.measure(t);
    guard++;
  }
  guard = 0;
  while (n < cfg.min && guard < 6 && pool.fillers.length > 0) {
    const filler = pickFreshFiller(t, store, pool, rng);
    if (!filler) break;
    t = appendToLast(t, filler, cfg.glue);
    n = cfg.measure(t);
    guard++;
  }
  if (n < cfg.target - Math.round(cfg.target * 0.06) && pool.fillers.length > 0) {
    const filler = pickFreshFiller(t, store, pool, rng);
    if (filler) t = appendToLast(t, filler, cfg.glue);
  }
  if (cfg.measure(t) > cfg.max) {
    const trimmed = trimTailSentence(t, cfg.sentenceEnd);
    if (trimmed !== t && !trimLosesKeyword(t, trimmed, protect)) t = trimmed;
  }
  return normalizeParagraphFormatting(t);
}

function joinKeywordDual(store: string, kws: string[], pool: PoolSet, cfg: LocaleCfg, rng: () => number, seed: number): string | null {
  // From 5 phrases up, a single-sentence list reads as a keyword dump, so the
  // two-part weave kicks in earlier and more often than it used to (>=6, 34%).
  if (kws.length < 5 || pool.dualBlocks.length === 0) return null;
  if (rng() > 0.55) return null;
  const minFirst = 2;
  const maxFirst = kws.length - 2;
  if (maxFirst < minFirst) return null;
  const pivot = minFirst + Math.floor(rng() * (maxFirst - minFirst + 1));
  const a = cfg.joinList(kws.slice(0, pivot), forkRng(seed, 0xb200 + pivot * 17));
  const b = cfg.joinList(kws.slice(pivot), forkRng(seed, 0xb380 + pivot * 19));
  return fill(pick(pool.dualBlocks, rng), { store, a, b });
}

function buildCore(store: string, kws: string[], pool: PoolSet, cfg: LocaleCfg, compact: boolean, seed: number): string {
  const rDual = forkRng(seed, 0x33);
  if (!compact) {
    const dual = joinKeywordDual(store, kws, pool, cfg, rDual, seed);
    if (dual) return dual;
  }
  const list = cfg.joinList(kws, forkRng(seed, 0xaa11));
  const corePool = compact && pool.coresCompact.length > 0 ? pool.coresCompact : pool.coresLong;
  return fill(pick(corePool, forkRng(seed, compact ? 0x103 : 0x102)), { store, list });
}

function buildInner(store: string, kws: string[], pool: PoolSet, cfg: LocaleCfg, compact: boolean, seed: number): string {
  const openerPool = compact && pool.openersShort.length > 0 ? pool.openersShort : pool.openersLong;
  const bridgePool = compact && pool.bridgesShort.length > 0 ? pool.bridgesShort : pool.bridgesLong;
  const closerPool = compact && pool.closersShort.length > 0 ? pool.closersShort : pool.closersLong;

  const opener = fill(pick(openerPool, forkRng(seed, 0x101)), { store });
  const core = buildCore(store, kws, pool, cfg, compact, seed);
  const bridge = bridgePool.length ? fill(pick(bridgePool, forkRng(seed, 0x104)), { store }) : "";
  const closer = fill(pick(closerPool, forkRng(seed, 0x105)), { store });

  const bridgeFirst = !compact && forkRng(seed, 0x106)() < 0.41;
  let segments = bridgeFirst ? [opener, bridge, core, closer] : [opener, core, bridge, closer];
  const rMicro = forkRng(seed, 0x10a);
  if (!compact && pool.microOpeners.length > 0 && rMicro() < 0.11) {
    segments = [pick(pool.microOpeners, rMicro), ...segments];
  }
  return weaveParagraphs(segments.filter(Boolean), forkRng(seed, 0x108), compact, cfg.glue);
}

function reviewNoKeywords(store: string, pool: PoolSet, cfg: LocaleCfg, seed: number): string {
  const opener = fill(pick(pool.openersShort.length ? pool.openersShort : pool.openersLong, forkRng(seed, 0x201)), { store });
  const closer = fill(pick(pool.closersShort.length ? pool.closersShort : pool.closersLong, forkRng(seed, 0x202)), { store });
  const mid = pool.noKeywordMid.length
    ? fill(pick(pool.noKeywordMid, forkRng(seed, 0x204)), { store })
    : "";
  const t = [opener, mid, closer].map(oneLineCollapse).filter(Boolean).join(PARAGRAPH_GAP);
  return tuneLength(t, store, pool, cfg, seed, 0x203);
}

/**
 * Real guests name a business 0-2 times; our templates could stack it up to 5
 * (opener + core + filler + closer each carrying {store}), which reads as SEO
 * spam. Keep the first two mentions, swap the rest for a natural stand-in.
 * (If a woven keyword itself contains the store name, that rare case is left
 * alone by running this before keyword tails are appended.)
 */
const STANDINS: Record<ReviewLocale, string[]> = {
  // Stand-ins that read naturally in ANY slot the store name occupies (subject,
  // or object after a preposition like "back to ___"). Rotated so a review never
  // repeats the same stand-in twice, which itself reads as a bot tell. Deliberately
  // no bare "here" — it breaks after prepositions ("back to here").
  en: ["this place", "the place", "the spot"],
  ja: ["こちら", "このお店", "お店", "こちらのお店"],
  ar: ["هذا المكان", "المكان"],
};

function capStoreMentions(text: string, name: string, locale: ReviewLocale, rng: () => number): string {
  if (!name) return text;
  const variants = STANDINS[locale];
  let vi = Math.floor(rng() * variants.length);
  let out = "";
  let rest = text;
  let count = 0;
  for (;;) {
    const i = rest.indexOf(name);
    if (i === -1) return out + rest;
    count++;
    if (count <= 2) {
      out += rest.slice(0, i + name.length);
    } else {
      const before = rest.slice(0, i);
      const prev = (out + before).trimEnd().slice(-1);
      const sentenceStart = (out + before).trim() === "" || /[.!?。！？]/.test(prev);
      let sub = variants[vi % variants.length]!;
      vi++;
      if (locale === "en" && sentenceStart) {
        sub = sub.charAt(0).toUpperCase() + sub.slice(1);
      }
      out += before + sub;
    }
    rest = rest.slice(i + name.length);
  }
}

/** Typographic sentence dashes read "AI"; normalize any leak. Keeps `\n\n`. */
function normalizeDashes(text: string): string {
  return normalizeParagraphFormatting(
    text
      .split(/\n\n+/)
      .map((p) => p.replace(/—/g, ", ").replace(/–/g, "-"))
      .join(PARAGRAPH_GAP),
  );
}

/**
 * Max keyword phrases woven into a single review. A real guest names a few
 * things, not a list of ten. Above this the review reads as a keyword dump and
 * every review looks the same — so we weave the forced/core phrases plus only a
 * seed-rotated handful of the guest's picks, and let the rest surface in other
 * generations (which also keeps 100s of reviews unique and human-sounding).
 */
const WOVEN_KEYWORD_CAP = 4;

/**
 * Max keyword phrases allowed inside ONE {list} sentence. A real guest names one
 * or two things in a single breath ("the doughnuts were fresh and the Karak was
 * great"), never a comma-list of five. Keeping the core sentence to <=2 phrases
 * is what makes the text read human — and it is ALSO the SEO/AIO-safe choice:
 * exact-match keyword dumps read as spam to Google's review filter and add no
 * signal for LLM/AI-Overview extraction, which keys off natural entity mentions.
 * Every remaining verbatim keyword still appears, woven later as its own natural
 * single-keyword sentence (the tail loop), so nothing is dropped.
 */
const LIST_CAP = 2;

/**
 * Pick the phrases to actually weave: ALWAYS keep the forced/core ones, then a
 * seed-rotated SUBSET of the guest picks (1..room) — even when everything would
 * fit under the cap. Weaving every pick every time makes all of a store's
 * reviews carry the same phrase list at the same ~length (a visible pattern);
 * rotating the guest subset varies both content and length per generation, and
 * the remaining picks surface in other guests' reviews instead.
 */
function selectWovenKeywords(keywords: string[], forcedCount: number, seed: number): string[] {
  const fc = Math.max(0, Math.min(forcedCount, keywords.length));
  const forced = keywords.slice(0, fc);
  const guest = keywords.slice(fc);
  const room = Math.max(0, WOVEN_KEYWORD_CAP - forced.length);
  if (room === 0 || guest.length === 0) {
    // Forced alone meets/exceeds the cap; rotate which forced ones show if it overflows.
    return forced.length <= WOVEN_KEYWORD_CAP
      ? forced
      : shuffle(forced, forkRng(seed, 0xc0ffe1)).slice(0, WOVEN_KEYWORD_CAP);
  }
  const maxTake = Math.min(room, guest.length);
  const take = 1 + Math.floor(forkRng(seed, 0xc0ffee)() * maxTake); // 1..maxTake
  const guestWoven = shuffle(guest, forkRng(seed, 0xc0ffef)).slice(0, take);
  return [...forced, ...guestWoven];
}

export function buildLocalizedReview(
  store: string,
  kws: string[],
  seed: number,
  locale: ReviewLocale,
  vertical: Vertical,
  forcedCount = 0,
  rating = 5,
): string {
  const pool = resolvePoolSet(locale, vertical);
  const name =
    store.trim() ||
    (locale === "ja" ? "こちらのお店" : locale === "ar" ? "هذا المكان" : "this establishment");
  const allKeywords = kws.map((k) => k.trim()).filter(Boolean);

  if (allKeywords.length === 0) {
    const cfg0 = { ...LOCALE_CFG[locale], ...pickLenBucket(locale, seed, rating, 0) };
    return normalizeDashes(capStoreMentions(reviewNoKeywords(name, pool, cfg0, seed), name, locale, forkRng(seed, 0xca9)));
  }

  const keywords = selectWovenKeywords(allKeywords, forcedCount, seed);
  // Length bucket is chosen AFTER keyword selection: the woven count decides
  // how short a review can honestly be while keeping every phrase verbatim.
  const bucket = pickLenBucket(locale, seed, rating, keywords.length);
  const cfg = { ...LOCALE_CFG[locale], ...bucket };
  const shuffled = shuffle(keywords, forkRng(seed, 0xb8b26351));

  // Only a small CORE of keywords goes into the {list} sentence (see LIST_CAP);
  // the rest are appended as natural single-keyword tails below. This is the
  // single biggest human-ness lever: it turns "A, B, C, D and E" dumps into a
  // guest naming one or two things, then mentioning the others in passing.
  const coreCount = bucket.kind === "short" ? 1 : Math.min(LIST_CAP, shuffled.length);
  const coreKws = shuffled.slice(0, coreCount);
  const longPhrases =
    coreKws.reduce((n, k) => n + k.length, 0) > 90 ||
    coreKws.some((k) => k.split(/\s+/).length > 5);
  // A short-bucket review needs the compact template set (short openers/cores/
  // closers) or the assembled baseline alone overshoots the bucket ceiling.
  const compact = longPhrases || bucket.kind === "short";

  let text = buildInner(name, coreKws, pool, cfg, compact, seed);
  // protect ALL verbatim keywords from length-trimming, not just the core ones.
  text = tuneLength(text, name, pool, cfg, seed, 0x301, shuffled);

  if (!text.includes(name)) {
    text = appendToLast(text, `(${name})`, cfg.glue);
  }

  let salt = 0xd00;
  for (const kw of shuffled) {
    if (kw.length > 0 && !text.includes(kw) && pool.tails.length > 0) {
      text = appendToLast(text, fill(pick(pool.tails, forkRng(seed, salt++)), { kw }), cfg.glue);
    }
  }

  text = tuneLength(text, name, pool, cfg, seed, 0x302, shuffled);
  // Cap store-name mentions at 2 (SEO-spam tell). Skipped when a woven keyword
  // itself contains the name, so the verbatim-keyword guarantee is never broken.
  if (!shuffled.some((k) => k.includes(name))) {
    text = capStoreMentions(text, name, locale, forkRng(seed, 0xca9));
  }
  return normalizeDashes(text);
}
