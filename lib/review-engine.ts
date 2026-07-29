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

/**
 * Smart article for EN keyword slots. Store keywords are arbitrary phrases:
 * common nouns ("fresh doughnuts") read naturally as "the fresh doughnuts",
 * but proper nouns / capitalized pills ("Dubai Marina", "Friendly Staff",
 * "Boston Cream") break with a hardcoded article ("nailed the Dubai Marina" —
 * caught in the live store E2E). Heuristic: lowercase first letter → common
 * noun → prepend "the"; uppercase → leave bare. Templates therefore never
 * hardcode "the" before {list}/{kw}/{a}/{b}. The raw keyword stays a verbatim
 * substring either way, so the SEO guarantee is unchanged.
 */
function withArt(phrase: string): string {
  // Never double an article the keyword already carries ("the best pizza in town").
  if (/^the\s/i.test(phrase)) return phrase;
  return /^[a-z]/.test(phrase) ? `the ${phrase}` : phrase;
}

/**
 * Attribute-shaped EN keywords ("great for groups", "family friendly", "clean
 * and comfortable") are descriptions, not things. Every {kw}/{list} template is
 * an OBJECT slot, so they came out as "Definitely try the family friendly" —
 * the same class of bug as putting a place name in a keyword (caught while
 * auditing live store data 2026-07-29).
 *
 * Owners will always type these, so the engine absorbs them instead of relying
 * on perfect data entry: attribute phrases are pushed out of the {list} core
 * and rendered through appositive tails ("Another plus: great for groups.")
 * which accept ANY phrase shape. Latin-script only — JA/AR pools take these
 * phrases naturally already.
 */
const ATTRIBUTE_SHAPED: RegExp[] = [
  /^(great|good|perfect|ideal|nice|excellent)\s+(for|to)\b/i,
  /^(family|kid|kids|pet|child|wheelchair|budget)[\s-]?friendly$/i,
  /^(clean|cosy|cozy|comfortable|friendly|quiet|spacious|affordable|cheap|fast|quick|tasty|delicious|relaxing|welcoming)(\s+and\s+\w+)?$/i,
  /\b(and|&)\s+(clean|comfortable|cosy|cozy|quiet|friendly|fast|affordable|welcoming)$/i,
  /\b(daily|weekly|nightly|always|often)$/i,
  /^(no|not)\s/i,
];

function isAttributeShaped(phrase: string): boolean {
  const t = phrase.trim();
  if (!t || !/^[\x20-\x7E]+$/.test(t)) return false; // non-Latin → leave alone
  return ATTRIBUTE_SHAPED.some((re) => re.test(t));
}

function oxford(p: string[]): string {
  if (p.length === 0) return "";
  if (p.length === 1) return p[0]!;
  if (p.length === 2) return `${p[0]} and ${p[1]}`;
  return `${p.slice(0, -1).join(", ")}, and ${p[p.length - 1]}`;
}
function joinListEn(phrases: string[], rng: () => number): string {
  const p = phrases.filter(Boolean).map(withArt);
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
    // Balance: fleshed-out enough that a review never reads as a bare one-liner
    // (real-store feedback: "too simple", 2026-07-16), but not so high that the
    // tuner stuffs fillers. Most length now comes from weaving every guest
    // keyword as its own sentence; buckets still spread the total so reviews vary.
    measure: wordCount,
    target: 72,
    min: 38,
    max: 125,
    sentenceEnd: /\./g,
    glue: " ",
    joinList: joinListEn,
  },
  ja: {
    // Fleshed-out but not padded; most length comes from weaving every keyword.
    measure: cjkCount,
    target: 135,
    min: 55,
    max: 260,
    sentenceEnd: /。/g,
    glue: "",
    joinList: joinListJa,
  },
  ar: {
    // Arabic is space-delimited, so word count is a fair length metric; it packs
    // more meaning per word than English, so the targets sit a touch lower.
    measure: wordCount,
    target: 58,
    min: 28,
    max: 115,
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
    short: { kind: "short", target: 30, min: 20, max: 44 },
    medium: { kind: "medium", target: 54, min: 40, max: 76 },
    long: { kind: "long", target: 100, min: 74, max: 132 },
  },
  ja: {
    short: { kind: "short", target: 58, min: 40, max: 90 },
    medium: { kind: "medium", target: 110, min: 80, max: 150 },
    long: { kind: "long", target: 175, min: 120, max: 260 },
  },
  ar: {
    short: { kind: "short", target: 30, min: 20, max: 44 },
    medium: { kind: "medium", target: 50, min: 38, max: 72 },
    long: { kind: "long", target: 82, min: 60, max: 115 },
  },
};

function pickLenBucket(locale: ReviewLocale, seed: number, rating: number, wovenCount: number): LenBucket {
  const b = LEN_BUCKETS[locale];
  // Bias longer as keyword count grows, but never LOCK to one bucket — that makes
  // every keyword-heavy review the same length (a pattern tell). Keyword count is
  // the main length driver; the bucket just adds spread on top.
  const r = forkRng(seed, 0x777)();
  const measured = rating <= 4;
  // 7-8 woven phrases can't honestly fit the standard long ceiling (every
  // keyword is verbatim-protected from trimming), so the ceiling stretches
  // rather than letting the tuner report an "over max" it can never fix.
  if (wovenCount >= 7) return { ...b.long, max: Math.round(b.long.max * 1.15) };
  // A slice of genuinely brief 5-6-keyword reviews (compact voice, every phrase
  // still verbatim) keeps the store-wide length spread wide — without it every
  // keyword-loaded review lands 70-105 words, a spread tell the audit guards.
  if (wovenCount >= 5) return r < 0.15 ? b.short : r < 0.55 ? b.medium : b.long;
  if (wovenCount >= 4) return r < (measured ? 0.6 : 0.5) ? b.medium : b.long;
  // A 4-star guest reads more measured: bias clearly shorter than 5-star, or
  // the two distributions collapse together (audit guards the gap).
  if (measured) return r < 0.55 ? b.short : r < 0.93 ? b.medium : b.long;
  // <=3 keywords can't honestly fill a long review; long here means filler-
  // stuffing, so it stays a rare spice rather than a 1-in-4 outcome.
  return r < 0.3 ? b.short : r < 0.83 ? b.medium : b.long;
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

/**
 * Append a sentence somewhere natural instead of always the tail. Stacking every
 * filler and keyword-tail onto the last paragraph produced a closing WALL of 5+
 * disconnected one-liners (eye-check 2026-07-25) — the single loudest bot tell.
 * Spread: usually merge into the last paragraph, sometimes an earlier one, and
 * occasionally stand alone before the closer, so padding reads as passing
 * remarks woven through the review.
 */
function appendSpread(full: string, sentence: string, glue: string, rng: () => number): string {
  const paras = normalizeParagraphFormatting(full).split(/\n\n+/).filter(Boolean);
  const frag = oneLineCollapse(sentence);
  if (!frag) return normalizeParagraphFormatting(full);
  if (paras.length === 0) return frag;
  const r = rng();
  if (r < 0.15 && paras.length >= 2) {
    paras.splice(paras.length - 1, 0, frag);
  } else if (r < 0.5 && paras.length >= 2) {
    // Mid-review remarks read most natural in an EARLIER paragraph; the last
    // paragraph (usually the closer) takes the minority share so it never
    // accretes into a checklist.
    const back = 1 + Math.floor(rng() * Math.min(2, paras.length - 1));
    const idx = paras.length - 1 - back;
    paras[idx] = oneLineCollapse(`${paras[idx]}${glue}${frag}`);
  } else {
    const li = paras.length - 1;
    paras[li] = oneLineCollapse(`${paras[li]}${glue}${frag}`);
  }
  return paras.join(PARAGRAPH_GAP);
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

// ------------------------------------------------------------ entity layer ----

/**
 * Entity layer (AI visibility). The review text is the only surface LocalReach
 * controls, and AI answer engines + Google's local ranking both match reviews
 * against "<category> in <area>" language. The {kw}/{list} slots are OBJECT
 * slots (dishes, things), so entity terms must never route through them —
 * "Definitely try Motor City" was caught on live-store E2E 2026-07-29.
 *
 * Instead each review gets AT MOST ONE dedicated entity sentence, built from
 * whichever parts are not already present verbatim (a forced keyword may
 * already carry the area). Parts:
 *   area — branch neighbourhood ("Motor City")   → woven whenever provided
 *   city — occasionally appended to the area     → ~1 in 3 reviews
 *   cat  — locale-resolved business noun ("udon restaurant") → woven whenever provided
 */
/**
 * Appositive tails that accept ANY phrase shape (noun, adjective, "great for
 * groups"). Used for attribute-shaped EN keywords so they never enter an object
 * slot. Deliberately colon/"plus"-led: no article, no verb agreement to break.
 */
const ATTRIBUTE_TAILS_EN: string[] = [
  "Another plus: {kw}.",
  "Also worth mentioning: {kw}.",
  "One more thing: {kw}.",
  "Plus {kw}, which I appreciated.",
  "Same goes for {kw}.",
  "And {kw}, which counts for a lot.",
];

export type ReviewEntity = {
  area?: string | null;
  city?: string | null;
  /** Locale-resolved natural noun (assembler picks the label for the locale). */
  cat?: string | null;
};

function fillEntity(tpl: string, loc: string, cat: string): string {
  return tpl.replace(/\{loc\}/g, loc).replace(/\{cat\}/g, cat);
}

// EN templates never place an indefinite article directly before {cat} ("a
// udon restaurant" would need "an") — only "a good/better {cat}" forms are
// safe. All templates are number-neutral; superlative ones are filtered out
// for 4-star reviews.
const ENTITY_BOTH: Record<ReviewLocale, string[]> = {
  en: [
    "Easily my favourite {cat} in {loc}.",
    "Best {cat} I've found around {loc}.",
    "My go-to {cat} in {loc} now.",
    "Hard to find a better {cat} in {loc}.",
    "Glad to have this {cat} in {loc}.",
    "If you're near {loc}, this is the {cat} to try.",
    "Solid {cat} right in {loc}.",
  ],
  ja: [
    "{loc}で{cat}を探しているなら、ここをおすすめします。",
    "{loc}の{cat}ではいちばんのお気に入りです。",
    "{loc}でこの{cat}に出会えてよかったです。",
    "{loc}に来たらまた寄りたい{cat}です。",
    "{loc}にあるのがうれしい{cat}です。",
  ],
  ar: [
    "من أفضل ما جربت من {cat} في {loc}.",
    "أفضل {cat} وجدته في {loc} حتى الآن.",
    "إن كنت في {loc} وتبحث عن {cat} فهذا هو المكان.",
    "صار {cat} المفضل لدي في {loc}.",
    "وجود {cat} بهذا المستوى في {loc} شيء جميل.",
  ],
};

const ENTITY_LOC_ONLY: Record<ReviewLocale, string[]> = {
  en: [
    "Worth the trip out to {loc}.",
    "Great addition to {loc}.",
    "If you're around {loc}, stop by.",
    "Nice to have a place like this in {loc}.",
  ],
  ja: [
    "{loc}という場所も便利です。",
    "{loc}に行くときはまた寄ります。",
    "{loc}にこういうお店があるのはうれしいです。",
  ],
  ar: [
    "يستحق الزيارة إن كنت قرب {loc}.",
    "موقعه في {loc} مناسب جداً.",
    "جميل أن يوجد مكان كهذا في {loc}.",
  ],
};

const ENTITY_CAT_ONLY: Record<ReviewLocale, string[]> = {
  en: [
    "Exactly what a good {cat} should be.",
    "One of the better {cat} options around.",
  ],
  ja: [
    "{cat}としては文句なしです。",
    "いい{cat}を見つけました。",
  ],
  ar: [
    "{cat} ممتاز بكل المقاييس.",
    "من أفضل خيارات {cat} التي جربتها.",
  ],
};

/** Superlative markers unsuitable for a measured 4-star review. */
const SUPERLATIVE_RE = /favourite|Best \{cat\}|いちばん|أفضل|المفضل/;

/**
 * Compose the location slot. City rides along ~1 in 3 times so "Dubai" reaches
 * a share of reviews without every single one carrying the full "area, city"
 * pair (which would itself read as a pattern).
 */
function entityLoc(
  area: string | null,
  city: string | null,
  locale: ReviewLocale,
  rng: () => number,
): string | null {
  if (area && city && rng() < 0.35) {
    if (locale === "ja") return `${city}の${area}`;
    // Arabic templates already carry "في" before {loc}; joining with another
    // "في" produced "في Souk Al Bahar في Dubai". Arabic comma keeps it clean.
    if (locale === "ar") return `${area}، ${city}`;
    return `${area}, ${city}`;
  }
  return area ?? city ?? null;
}

/**
 * Weave the entity sentence into `text`. Returns the new text plus every
 * entity term now present, so callers extend the verbatim-protect list.
 */
function weaveEntity(
  text: string,
  entity: ReviewEntity | undefined,
  locale: ReviewLocale,
  cfg: LocaleCfg,
  seed: number,
  rating: number,
): { text: string; protect: string[] } {
  const area = entity?.area?.trim() || null;
  const city = entity?.city?.trim() || null;
  const cat = entity?.cat?.trim() || null;
  if (!area && !city && !cat) return { text, protect: [] };

  const rng = forkRng(seed, 0xe171);
  const loc = entityLoc(area, city, locale, rng);
  const missLoc = !!loc && !text.includes(area ?? loc);
  const missCat = !!cat && !text.includes(cat);
  const protect = [area, city, cat].filter((s): s is string => !!s);
  if (!missLoc && !missCat) return { text, protect };

  let pool: string[];
  if (missLoc && missCat) {
    pool = ENTITY_BOTH[locale];
  } else if (missLoc) {
    pool = ENTITY_LOC_ONLY[locale];
  } else {
    pool = ENTITY_CAT_ONLY[locale];
  }
  if (rating < 5) {
    const measured = pool.filter((t) => !SUPERLATIVE_RE.test(t));
    if (measured.length > 0) pool = measured;
  }
  const sentence = fillEntity(pick(pool, rng), loc ?? "", cat ?? "");
  return { text: appendSpread(text, sentence, cfg.glue, rng), protect };
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
  // Hard cap on fillers: 3 per review. Padding past that to satisfy a length
  // bucket turns the review into a platitude wall (eye-check 2026-07-25) — an
  // honest shorter review beats a stuffed "long" one, so the bucket min yields.
  let added = 0;
  while (n < cfg.min && added < 3 && pool.fillers.length > 0) {
    const filler = pickFreshFiller(t, store, pool, rng);
    if (!filler) break;
    t = appendSpread(t, filler, cfg.glue, rng);
    n = cfg.measure(t);
    added++;
  }
  if (added === 0 && n < cfg.target - Math.round(cfg.target * 0.06) && pool.fillers.length > 0) {
    const filler = pickFreshFiller(t, store, pool, rng);
    if (filler) t = appendSpread(t, filler, cfg.glue, rng);
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

/**
 * EN sentences must start uppercase, but withArt()/tails legitimately place
 * lowercase "the {kw}" at sentence starts ("the sea view alone made the trip
 * worth it."), which reads as a typo at scale. Uppercase every sentence-initial
 * letter, EXCEPT where the change would break a verbatim-protected phrase (a
 * keyword or store name that itself starts lowercase, e.g. "the best pizza in
 * town") — the verbatim guarantee outranks capitalization.
 */
function capitalizeSentenceStartsEn(text: string, protect: readonly string[]): string {
  // A protected phrase can END in sentence punctuation — store names like
  // "Let It Dough!" or "Smith & Co." — and that punctuation is NOT a sentence
  // break. Without this the next word got wrongly capitalized mid-sentence
  // ("Came to Let It Dough! For the first time", live client, caught 2026-07-29).
  // Map every character position covered by a protected phrase, then ignore any
  // terminator that falls inside one.
  const inProtected = new Uint8Array(text.length);
  for (const p of protect) {
    if (!p || !/[.!?]/.test(p)) continue;
    let from = 0;
    for (;;) {
      const at = text.indexOf(p, from);
      if (at === -1) break;
      for (let i = at; i < at + p.length && i < text.length; i++) inProtected[i] = 1;
      from = at + p.length;
    }
  }

  const re = /(^|[.!?]\s+|\n\n+)([a-z])/g;
  let out = text;
  let m: RegExpExecArray | null;
  while ((m = re.exec(out)) !== null) {
    // Terminator sits at m.index when the separator starts with punctuation.
    if (/^[.!?]/.test(m[1]!) && inProtected[m.index]) continue;
    const idx = m.index + m[1]!.length;
    // Same-length replacement, so the regex cursor stays valid.
    const cand = out.slice(0, idx) + out[idx]!.toUpperCase() + out.slice(idx + 1);
    if (!protect.some((k) => k && out.includes(k) && !cand.includes(k))) {
      out = cand;
    }
  }
  return out;
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
 * Upper safety bound on keyword phrases woven into one review — only trims a
 * genuinely extreme selection (a guest who tapped 8+ pills) so it can't become a
 * ten-item monster. It is NOT the naturalness limiter: LIST_CAP keeps each
 * SENTENCE to <=2 phrases, so extra keywords surface as their own natural
 * sentences rather than a dump. The guest's own selections must all appear (they
 * chose them) — dropping a selected keyword reads as a bug to the guest.
 */
const WOVEN_KEYWORD_CAP = 8;

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
 * Pick the phrases to weave: ALWAYS keep the forced/core ones, and weave EVERY
 * guest pick too — the guest deliberately tapped those, so dropping any of them
 * reads as "my keyword disappeared" (real-store feedback 2026-07-16). Only when a
 * selection is extreme (forced + guest exceeds WOVEN_KEYWORD_CAP) do we trim, and
 * even then forced win and a seed-shuffled slice of guest picks fills the rest.
 * Uniqueness across a store's reviews comes from the nonce, template rotation and
 * length buckets — not from hiding the guest's own choices.
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
  // Weave ALL guest picks; only a selection bigger than `room` gets trimmed.
  const guestWoven =
    guest.length <= room ? guest : shuffle(guest, forkRng(seed, 0xc0ffef)).slice(0, room);
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
  entity?: ReviewEntity,
): string {
  const pool = resolvePoolSet(locale, vertical);
  const name =
    store.trim() ||
    (locale === "ja" ? "こちらのお店" : locale === "ar" ? "هذا المكان" : "this establishment");
  const allKeywords = kws.map((k) => k.trim()).filter(Boolean);

  if (allKeywords.length === 0) {
    const cfg0 = { ...LOCALE_CFG[locale], ...pickLenBucket(locale, seed, rating, 0) };
    let t0 = reviewNoKeywords(name, pool, cfg0, seed);
    const woven0 = weaveEntity(t0, entity, locale, cfg0, seed, rating);
    t0 = normalizeDashes(capStoreMentions(woven0.text, name, locale, forkRng(seed, 0xca9)));
    if (locale === "en") t0 = capitalizeSentenceStartsEn(t0, [name, ...woven0.protect]);
    return t0;
  }

  const keywords = selectWovenKeywords(allKeywords, forcedCount, seed);
  // Length bucket is chosen AFTER keyword selection: the woven count decides
  // how short a review can honestly be while keeping every phrase verbatim.
  const bucket = pickLenBucket(locale, seed, rating, keywords.length);
  const cfg = { ...LOCALE_CFG[locale], ...bucket };
  const shuffledRaw = shuffle(keywords, forkRng(seed, 0xb8b26351));
  // Attribute-shaped phrases ("great for groups") cannot sit in the {list}
  // object slot, so sort them to the back — the core takes nouns, and they come
  // out through the appositive tails below. Stable within each group, so the
  // shuffle still drives variety.
  const shuffled =
    locale === "en"
      ? [...shuffledRaw.filter((k) => !isAttributeShaped(k)), ...shuffledRaw.filter(isAttributeShaped)]
      : shuffledRaw;

  // Only a small CORE of keywords goes into the {list} sentence (see LIST_CAP);
  // the rest are appended as natural single-keyword tails below. This is the
  // single biggest human-ness lever: it turns "A, B, C, D and E" dumps into a
  // guest naming one or two things, then mentioning the others in passing.
  const coreCount = bucket.kind === "short" ? 1 : Math.min(LIST_CAP, shuffled.length);
  // The core {list} sentence is an object slot, so it takes NOUNS only. With
  // few nouns the core simply gets shorter (or empty) and the attribute phrases
  // all leave through the appositive tails — never "Loved the family friendly".
  const coreNouns = locale === "en" ? shuffled.filter((k) => !isAttributeShaped(k)) : shuffled;
  const coreKws = coreNouns.slice(0, coreCount);
  const longPhrases =
    coreKws.reduce((n, k) => n + k.length, 0) > 90 ||
    coreKws.some((k) => k.split(/\s+/).length > 5);
  // A short-bucket review needs the compact template set (short openers/cores/
  // closers) or the assembled baseline alone overshoots the bucket ceiling.
  const compact = longPhrases || bucket.kind === "short";

  // Every keyword is attribute-shaped → no noun exists for the core sentence.
  // Build the keyword-free skeleton instead; the tails carry all the phrases.
  let text =
    coreKws.length === 0
      ? reviewNoKeywords(name, pool, cfg, seed)
      : buildInner(name, coreKws, pool, cfg, compact, seed);
  // protect ALL verbatim keywords from length-trimming, not just the core ones.
  text = tuneLength(text, name, pool, cfg, seed, 0x301, shuffled);

  if (!text.includes(name)) {
    text = appendToLast(text, `(${name})`, cfg.glue);
  }

  // Give each leftover keyword its OWN tail template — cycling a shuffled order so
  // consecutive keywords never reuse the same sentence ("Really enjoyed the X.
  // Really enjoyed the Y." was a visible tell when several keywords were woven).
  const tailOrder = shuffle([...pool.tails], forkRng(seed, 0x7a11));
  const tailSpread = forkRng(seed, 0x7b22);
  // 4+ leftover keywords as one-liner tails read as a checklist no matter where
  // they land, so pair them up ("Also have to mention the sea view and the
  // wagyu.") — both phrases stay verbatim, tail count halves.
  const leftovers = shuffled.filter((kw) => kw.length > 0 && !text.includes(kw));
  // Attribute phrases get appositive tails; nouns keep the rich object tails.
  // Pairing only ever joins same-kind phrases so a pair never mixes the two.
  const nounLeft = locale === "en" ? leftovers.filter((k) => !isAttributeShaped(k)) : leftovers;
  const attrLeft = locale === "en" ? leftovers.filter(isAttributeShaped) : [];
  const slots: { text: string; attr: boolean }[] = [];
  const pushGroup = (group: string[], attr: boolean) => {
    if (group.length >= 4 && !attr) {
      for (let i = 0; i < group.length; i += 2) {
        const pair = group.slice(i, i + 2);
        slots.push({
          attr,
          text:
            pair.length === 2
              ? cfg.joinList(pair, forkRng(seed, 0x7c00 + i))
              : locale === "en" ? withArt(pair[0]!) : pair[0]!,
        });
      }
      return;
    }
    for (const kw of group) {
      slots.push({ attr, text: attr ? kw : locale === "en" ? withArt(kw) : kw });
    }
  };
  pushGroup(nounLeft, false);
  pushGroup(attrLeft, true);

  const attrOrder = shuffle([...ATTRIBUTE_TAILS_EN], forkRng(seed, 0x7a22));
  let ti = 0;
  let ai = 0;
  for (const slot of slots) {
    const order = slot.attr ? attrOrder : tailOrder;
    if (order.length === 0) break;
    const tpl = slot.attr ? order[ai++ % order.length]! : order[ti++ % order.length]!;
    text = appendSpread(text, fill(tpl, { kw: slot.text }), cfg.glue, tailSpread);
  }

  // Entity sentence goes in BEFORE the final length pass so trimming can never
  // delete it (its terms join the verbatim-protect list).
  const woven = weaveEntity(text, entity, locale, cfg, seed, rating);
  text = woven.text;
  const protectAll = [...shuffled, ...woven.protect];

  text = tuneLength(text, name, pool, cfg, seed, 0x302, protectAll);
  // Cap store-name mentions at 2 (SEO-spam tell). Skipped when a woven keyword
  // itself contains the name, so the verbatim-keyword guarantee is never broken.
  if (!protectAll.some((k) => k.includes(name))) {
    text = capStoreMentions(text, name, locale, forkRng(seed, 0xca9));
  }
  text = normalizeDashes(text);
  if (locale === "en") text = capitalizeSentenceStartsEn(text, [...protectAll, name]);
  return text;
}
