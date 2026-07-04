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
    const r = rng();
    if (r < 0.48) return `${p[0]} and ${p[1]}`;
    if (r < 0.8) return `${p[0]}, ${p[1]}`;
    return `${p[0]} plus ${p[1]}`;
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
  if (p.length === 2) return rng() < 0.5 ? `${p[0]}と${p[1]}` : `${p[0]}、${p[1]}`;
  const last = p[p.length - 1]!;
  const head = p.slice(0, -1).join("、");
  return rng() < 0.5 ? `${head}、${last}` : `${head}、そして${last}`;
}

const LOCALE_CFG: Record<ReviewLocale, LocaleCfg> = {
  en: {
    measure: wordCount,
    target: 100,
    min: 90,
    max: 118,
    sentenceEnd: /\./g,
    glue: " ",
    joinList: joinListEn,
  },
  ja: {
    measure: cjkCount,
    target: 210,
    min: 150,
    max: 300,
    sentenceEnd: /。/g,
    glue: "",
    joinList: joinListJa,
  },
};

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

function tuneLength(text: string, store: string, pool: PoolSet, cfg: LocaleCfg, seed: number, salt: number): string {
  const rng = forkRng(seed, salt);
  let t = text;
  let n = cfg.measure(t);
  let guard = 0;
  while (n > cfg.max && guard < 4) {
    t = trimTailSentence(t, cfg.sentenceEnd);
    n = cfg.measure(t);
    guard++;
  }
  guard = 0;
  while (n < cfg.min && guard < 6 && pool.fillers.length > 0) {
    t = appendToLast(t, fill(pick(pool.fillers, rng), { store }), cfg.glue);
    n = cfg.measure(t);
    guard++;
  }
  if (n < cfg.target - Math.round(cfg.target * 0.06) && pool.fillers.length > 0) {
    t = appendToLast(t, fill(pick(pool.fillers, rng), { store }), cfg.glue);
  }
  if (cfg.measure(t) > cfg.max) t = trimTailSentence(t, cfg.sentenceEnd);
  return normalizeParagraphFormatting(t);
}

function joinKeywordDual(store: string, kws: string[], pool: PoolSet, cfg: LocaleCfg, rng: () => number, seed: number): string | null {
  if (kws.length < 6 || pool.dualBlocks.length === 0) return null;
  if (rng() > 0.34) return null;
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

/** Typographic sentence dashes read "AI"; normalize any leak. Keeps `\n\n`. */
function normalizeDashes(text: string): string {
  return normalizeParagraphFormatting(
    text
      .split(/\n\n+/)
      .map((p) => p.replace(/—/g, ", ").replace(/–/g, "-"))
      .join(PARAGRAPH_GAP),
  );
}

export function buildLocalizedReview(
  store: string,
  kws: string[],
  seed: number,
  locale: ReviewLocale,
  vertical: Vertical,
): string {
  const cfg = LOCALE_CFG[locale];
  const pool = resolvePoolSet(locale, vertical);
  const name = store.trim() || (locale === "ja" ? "こちらのお店" : "this establishment");
  const keywords = kws.map((k) => k.trim()).filter(Boolean);

  if (keywords.length === 0) {
    return normalizeDashes(reviewNoKeywords(name, pool, cfg, seed));
  }

  const shuffled = shuffle(keywords, forkRng(seed, 0xb8b26351));
  const many = shuffled.length > 8;
  const longPhrases =
    shuffled.reduce((n, k) => n + k.length, 0) > 140 ||
    shuffled.some((k) => k.split(/\s+/).length > 5);
  const compact = many || longPhrases;

  let text = buildInner(name, shuffled, pool, cfg, compact, seed);
  text = tuneLength(text, name, pool, cfg, seed, 0x301);

  if (!text.includes(name)) {
    text = appendToLast(text, `(${name})`, cfg.glue);
  }

  let salt = 0xd00;
  for (const kw of shuffled) {
    if (kw.length > 0 && !text.includes(kw) && pool.tails.length > 0) {
      text = appendToLast(text, fill(pick(pool.tails, forkRng(seed, salt++)), { kw }), cfg.glue);
    }
  }

  text = tuneLength(text, name, pool, cfg, seed, 0x302);
  return normalizeDashes(text);
}
