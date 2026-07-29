/**
 * Owner-reply generator (zero API).
 *
 * Reads the guest's review, pulls out the SPECIFIC things they praised or
 * complained about ("the matcha croissant", "the wait"), and reacts to them by
 * name so the reply reads like a real owner answered THIS review, not a template.
 *
 * Zero API: no per-reply cost, works offline, connector-independent (owner pastes
 * the review). Deterministic seeded RNG so a fixed nonce reproduces and a fresh
 * nonce rotates phrasing. Nothing is sent; the output is a draft the owner edits
 * and posts themselves (human-gated).
 */

import { forkRng } from "@/lib/review-rng";
import {
  REPLY_POOLS, THEME_ORDER, THEME_DETECT, THEME_PHRASE,
  EN_POS_ADJ, EN_NEG_ADJ, SPEC_STOP,
  type ReplyLocale, type ReplyTone, type Sentiment, type Theme, type ReplyPool,
} from "@/lib/reply-pools";
import type { SupportedLocale } from "@/types/database";

export type GenerateReplyOptions = {
  /** 1–5 stars. Drives sentiment. */
  rating: number;
  /** The guest's review text. Read to extract specifics + theme. */
  reviewText?: string;
  /** Reply language. */
  locale?: SupportedLocale;
  /** Voice. Defaults to 'warm'. */
  tone?: ReplyTone;
  /** A real locality/area to weave for Local SEO (e.g. "Dubai Marina"). */
  geoPhrase?: string;
  /**
   * Natural business noun ("udon restaurant"). Woven together with the area so
   * the fallback reply carries the same "<category> in <area>" phrasing the AI
   * answer engines match on — the Gemini path gets it via the prompt.
   */
  categoryNoun?: string;
  /** Set false to suppress geo weaving. Default true. */
  weaveGeo?: boolean;
  /**
   * The store's forced GEO keywords ("best doughnuts in Dubai" …). ONE is
   * seed-rotated into positive/mixed replies, quoted so any phrase reads
   * naturally — the AIO/Local-SEO signal owner replies should carry.
   */
  geoKeywords?: string[];
  /** Custom sign-off (verbatim; "{store}" is replaced). Empty = pool sign-offs. */
  signature?: string;
  /** Per-run entropy so each "Regenerate" yields a different draft. */
  nonce?: string;
};

function toReplyLocale(locale?: SupportedLocale): ReplyLocale {
  return locale === "ja" ? "ja" : locale === "ar" ? "ar" : "en";
}

export function sentimentForRating(rating: number): Sentiment {
  const r = Math.round(rating);
  if (r >= 4) return "positive";
  if (r <= 2 && r >= 1) return "negative";
  return "mixed";
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

// ── Rating-only safety net ──────────────────────────────────────────────────
// The open/react/body beats have dedicated no-text pools, but the optional beats
// (warm, brand, kw, geo) and the closers are shared, and plenty of them thank the
// guest for what they wrote ("your kind words", 「何より嬉しいお言葉です」) or claim to
// know what they made of the visit ("delighted you noticed"). Under a silent rating
// both are inventions, so those lines are filtered out rather than audited by hand
// across three languages — new pool entries are covered automatically.

const ASSUMES_TEXT: Record<ReplyLocale, RegExp> = {
  en: /\b(words?|wrote|writing|write|said|saying|say so|reviews?|mention(ed)?|describ(e|ed)|note|comments?|feedback|reading|read|message)\b|\byou (noticed|enjoyed|loved|liked|felt|found|caught)\b/i,
  ja: /お言葉|レビュー|ご感想|書い|拝読|コメント|おっしゃ|仰っ|お褒め|ご指摘|読ん|読み/,
  ar: /كلمات|كلماتك|كتبت|ذكرت|قلت|ملاحظات|تعليق|مراجعت|قرأنا|قراءة/,
};

/**
 * Drop templates that reference words the guest never wrote. `required` keeps the
 * original pool if filtering would empty it (a slightly off line beats no line);
 * optional beats just disappear, which is the better outcome for them.
 */
function noTextSafe(lines: string[], locale: ReplyLocale, required = false): string[] {
  const kept = lines.filter((l) => !ASSUMES_TEXT[locale].test(l));
  return kept.length > 0 || !required ? kept : lines;
}

// ── Specific-phrase extraction ──────────────────────────────────────────────

/** Tidy a captured noun phrase into a bare {spec}: drop article, trim, guard. */
function cleanSpec(raw: string): string | null {
  let s = raw.toLowerCase().trim();
  s = s.replace(/^(the|our|their|your|a|an|its|his|her)\s+/i, "");
  // Cut at a preposition/conjunction so "brownies in dubai" -> "brownies" (drops
  // the trailing place/clause we'd otherwise echo back awkwardly).
  s = s.split(/\s+(?:in|at|on|of|with|for|to|from|near|by|and|but|though|however|that|which)\s+/)[0]!;
  s = s.replace(/['".,!?;:()]+$/g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const words = s.split(" ");
  if (words.length > 3) return null;          // a clause, not a thing
  if (s.length < 3) return null;
  if (words.every((w) => SPEC_STOP.has(w))) return null;
  if (SPEC_STOP.has(words[0]!) && words.length === 1) return null;
  return s;
}

function collectMatches(text: string, re: RegExp, group: number, out: string[]): void {
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = r.exec(text)) !== null) {
    const cleaned = cleanSpec(m[group] ?? "");
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
    if (m.index === r.lastIndex) r.lastIndex++;
  }
}

/** Extract praised (EN) noun phrases the guest named. */
function extractPraiseEn(text: string): string[] {
  const out: string[] = [];
  collectMatches(text, new RegExp(`\\b(?:the|our|their|your|a|an)\\s+([a-z][a-z' -]{1,26}?)\\s+(?:was|were|is|are|tasted|looked|felt|seemed)\\s+(?:really |very |so |absolutely |truly |quite |pretty |genuinely |just )*(?:${EN_POS_ADJ})\\b`, "gi"), 1, out);
  collectMatches(text, new RegExp(`\\b(?:${EN_POS_ADJ})\\s+([a-z][a-z' -]{1,26}?)(?=[.,!?]|\\s+(?:and|but|with|the|our|though|however|so)\\b|$)`, "gi"), 1, out);
  collectMatches(text, new RegExp(`\\b(?:loved|enjoyed|liked|adored|appreciated|recommend|impressed by)\\s+(?:the|our|their|your|a|an)?\\s*([a-z][a-z' -]{1,26}?)(?=[.,!?]|\\s+(?:and|but|so)\\b|$)`, "gi"), 1, out);
  return out.slice(0, 2);
}

/** Extract complained-about (EN) noun phrases. */
function extractGripeEn(text: string): string[] {
  const out: string[] = [];
  collectMatches(text, new RegExp(`\\b(?:the|our|their|your|a|an)\\s+([a-z][a-z' -]{1,26}?)\\s+(?:was|were|is|are|tasted|looked|felt|seemed)\\s+(?:really |very |so |too |quite |just )*(?:${EN_NEG_ADJ})\\b`, "gi"), 1, out);
  collectMatches(text, new RegExp(`\\b(?:${EN_NEG_ADJ})\\s+([a-z][a-z' -]{1,26}?)(?=[.,!?]|\\s+(?:and|but)\\b|$)`, "gi"), 1, out);
  if (/\b(wait|waited|waiting|queue|too long|so long|ages|slow service)\b/i.test(text) && !out.includes("wait")) out.push("wait");
  return out.slice(0, 2);
}

// ── JA extraction ───────────────────────────────────────────────────────────
// Particle-anchored, LAZY capture: the noun phrase directly before は/が/も with
// only a known adverb allowed between particle and the sentiment word. A greedy
// span here bleeds into the adverb (「お寿司がとて…」), which is why the earlier
// free-form version was disabled. AR stays theme-based (morphology is harder).

const JA_ADVERB = "(?:、)?(?:とても|すごく|本当に|とっても|一番|特に|かなり|めっちゃ|非常に|想像以上に|期待以上に)?";
const JA_PRAISE = "美味し|おいし|よかった|良かった|良く|最高|素晴らし|丁寧|親切|優し|新鮮|清潔|きれい|綺麗|落ち着|居心地|好き|気に入|嬉し|感動|早|速|安|充実";
const JA_GRIPE = "遅|長すぎ|長かった|冷め|冷た|汚|ひど|残念|まず|不味|不快|雑|高すぎ|高かった|待たされ|少な|狭|うるさ|騒がし|悪";

/** Words too generic to echo back by name. */
const JA_SPEC_STOP = new Set([
  "お店", "こちら", "ここ", "全体", "全部", "すべて", "全て", "何もかも",
  "こと", "もの", "感じ", "とき", "時間帯", "今回", "前回", "本当", "最初", "最後",
]);

function extractJa(text: string, markers: string): string[] {
  const out: string[] = [];
  const re = new RegExp(
    `([\\u4e00-\\u9faf\\u3041-\\u3096\\u30a1-\\u30f6\\u30fcA-Za-z0-9]{2,12}?(?:の[\\u4e00-\\u9faf\\u3041-\\u3096\\u30a1-\\u30f6\\u30fc]{2,8})?)(?:は|が|も)${JA_ADVERB}(?:${markers})`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const cand = (m[1] ?? "").trim();
    if (cand.length >= 2 && !JA_SPEC_STOP.has(cand) && !out.includes(cand)) out.push(cand);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out.slice(0, 2);
}

/**
 * EN and JA get free-text specific extraction; AR falls back to the clean theme
 * phrases (الطعام …) — Arabic morphology makes naive capture unreliable.
 */
function extractSpecifics(text: string, locale: ReplyLocale): { praise: string[]; gripe: string[] } {
  const t = (text ?? "").trim();
  if (!t) return { praise: [], gripe: [] };
  if (locale === "en") return { praise: extractPraiseEn(t), gripe: extractGripeEn(t) };
  if (locale === "ja") return { praise: extractJa(t, JA_PRAISE), gripe: extractJa(t, JA_GRIPE) };
  return { praise: [], gripe: [] };
}

export function detectThemes(reviewText: string): Theme[] {
  const t = (reviewText ?? "").trim();
  if (!t) return [];
  const found: Theme[] = [];
  for (const theme of THEME_ORDER) {
    if (theme === "experience") continue;
    if (THEME_DETECT[theme].test(t)) found.push(theme);
  }
  return found;
}

// ── Assembly ────────────────────────────────────────────────────────────────

function fillSpec(tpl: string, spec: string, spec2?: string): string {
  return tpl.replace(/\{spec2\}/g, spec2 ?? "").replace(/\{spec\}/g, spec);
}

function normalizeDashes(text: string): string {
  return text.replace(/—/g, ", ").replace(/–/g, "-");
}
function collapse(s: string): string {
  return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, " ").trim();
}
function joinSentences(parts: string[], locale: ReplyLocale): string {
  const glue = locale === "ja" ? "" : " ";
  return parts.map(collapse).filter(Boolean).join(glue);
}

/** Build the "react to what they said" sentence for this review + sentiment. */
function buildReaction(
  pool: ReplyPool, locale: ReplyLocale, sentiment: Sentiment,
  praise: string[], gripe: string[], primaryTheme: Theme | null, seed: number,
): string {
  const r = (salt: number) => forkRng(seed, salt);
  if (sentiment === "positive") {
    if (praise.length >= 2) return fillSpec(pick(pool.reactPair, r(0x210)), praise[0]!, praise[1]!);
    if (praise.length === 1) return fillSpec(pick(pool.reactSpec, r(0x211)), praise[0]!);
  } else if (sentiment === "negative") {
    if (gripe.length >= 2) return fillSpec(pick(pool.reactPair, r(0x212)), gripe[0]!, gripe[1]!);
    if (gripe.length === 1) return fillSpec(pick(pool.reactSpec, r(0x213)), gripe[0]!);
  } else {
    // mixed: reference praise + gripe when both are known (resolves mislabel risk)
    if (praise.length >= 1 && gripe.length >= 1) return fillSpec(pick(pool.reactPair, r(0x214)), praise[0]!, gripe[0]!);
    if (gripe.length >= 1) return fillSpec(pick(pool.reactSpec, r(0x215)), gripe[0]!);
  }
  // Fallbacks: theme (positive/negative only — mixed theme risks mislabel), then generic.
  if (primaryTheme && sentiment !== "mixed" && pool.reactTheme.length) {
    return pick(pool.reactTheme, r(0x216)).replace(/\{theme\}/g, THEME_PHRASE[locale][primaryTheme]);
  }
  return pick(pool.reactGeneric, r(0x217));
}

export function generateReply(storeName: string, options: GenerateReplyOptions): string {
  const locale = toReplyLocale(options.locale);
  const store = storeName.trim() || (locale === "ja" ? "当店" : "our team");
  const tone: ReplyTone = options.tone === "professional" ? "professional" : "warm";
  const sentiment = sentimentForRating(options.rating);
  const pool = REPLY_POOLS[locale][sentiment];

  const { praise, gripe } = extractSpecifics(options.reviewText ?? "", locale);
  const themes = detectThemes(options.reviewText ?? "");
  const primaryTheme: Theme | null = themes[0] ?? null;

  // Rating-only: stars, no words. The normal beats all assume the guest wrote
  // something ("thanks for the kind words", "glad the whole visit landed well"),
  // which reads as a lie under a silent rating, so this case gets its own pools.
  const ratingOnly = !(options.reviewText ?? "").trim();

  const nonce = options.nonce ?? (typeof globalThis !== "undefined" ? `${Date.now()}-${Math.random().toString(16).slice(2)}` : "ssr");
  const seed = hashString(`${store}\0${locale}\0${tone}\0${sentiment}\0${ratingOnly ? "notext" : "text"}\0${praise.join(",")}\0${gripe.join(",")}\0${primaryTheme ?? "-"}\0${nonce}`);
  const r = (salt: number) => forkRng(seed, salt);

  /** Shared pools need the writing-reference filter in rating-only mode. */
  const usable = (lines: string[], required = false) => (ratingOnly ? noTextSafe(lines, locale, required) : lines);

  const bodyPool = usable(ratingOnly && pool.bodyNoText.length ? pool.bodyNoText : pool.body, true);
  const closePool = usable(pool.close, true);
  const geoPool = usable(pool.geoWoven);
  const kwPool = usable(pool.kwWoven);
  const brandPool = usable(pool.brand);
  const warmPool = usable(pool.warm);

  const open = pick(ratingOnly && pool.openNoText.length ? pool.openNoText : pool.open, r(0x101));
  const reaction = ratingOnly && pool.reactNoText.length
    ? pick(pool.reactNoText, r(0x102))
    : buildReaction(pool, locale, sentiment, praise, gripe, primaryTheme, seed);
  const body = pick(bodyPool, r(0x104));
  const close = pick(closePool, r(0x105));
  const customSig = (options.signature ?? "").trim();
  const signoff = (customSig || pick(pool.signoff, r(0x106))).replace(/\{store\}/g, store);

  const notNegative = sentiment !== "negative";

  // ── SEO/AIO beats (pos/mixed only — never decorate an apology) ──
  // Locality: near-always when the owner set one (each reply answers a
  // different review, so repetition across replies is fine and desirable).
  const geo = (options.geoPhrase ?? "").trim();
  const cat = (options.categoryNoun ?? "").trim();
  // "Motor City" becomes "Motor City as an udon restaurant"? No — the templates
  // are place-framed ("being part of {geo}"), so the category rides as an
  // apposition on the AREA itself, which keeps every template grammatical:
  // "part of Motor City" -> "part of Motor City as your local udon restaurant".
  const geoValue = geo;
  const geoOn = options.weaveGeo !== false && geo && geoPool.length && notNegative && r(0x120)() < 0.9;
  const catTail = cat && r(0x123)() < 0.55 ? CATEGORY_TAIL[locale].replace(/\{cat\}/g, cat) : "";
  const geoSentence = geoOn
    ? pick(geoPool, r(0x121)).replace(/\{geo\}/g, geoValue).replace(/\{store\}/g, store) + catTail
    : "";

  // One forced GEO keyword, seed-rotated across the store's list, quoted in-template.
  // Suppressed on a silent 3-star: quoting a marketing phrase at a guest who was
  // unimpressed enough to say nothing reads as tone-deaf. Silent 5-star keeps it —
  // there the reply is the only text Google and the AI assistants can index.
  const kws = (options.geoKeywords ?? []).map((k) => k.trim()).filter(Boolean);
  const kwAllowed = notNegative && !(ratingOnly && sentiment === "mixed");
  const kwOn = kws.length > 0 && kwPool.length > 0 && kwAllowed && r(0x150)() < 0.75;
  const kw = kwOn ? kws[Math.floor(r(0x151)() * kws.length)]! : "";
  const kwSentence = kw ? pick(kwPool, r(0x152)).replace(/\{kw\}/g, kw).replace(/\{store\}/g, store) : "";

  // Brand line: the store name inside the body (entity signal beyond the sign-off).
  const brandOn = brandPool.length > 0 && notNegative && r(0x160)() < 0.5;
  const brandSentence = brandOn ? pick(brandPool, r(0x161)).replace(/\{store\}/g, store) : "";

  // Human beat.
  const warmOn = warmPool.length > 0 && notNegative && r(0x140)() < 0.5;
  const warmSentence = warmOn ? pick(warmPool, r(0x141)) : "";

  // ── Structure ──
  // Owner requirement (2026-07-12): replies must NOT come out short. Core beats
  // (open, reaction, body) always ship; the close drops only occasionally; and
  // of the optional beats we keep at most TWO so replies stay 4-6 sentences,
  // never 2-3 and never a bloated 8. Priority: kw > geo > brand > warm when
  // over budget (SEO beats win; the human beat is the garnish).
  // A silent 3-star gives us nothing to answer, so padding it with extra beats
  // reads as filler; keep that one lean and let the ask-what-went-wrong body carry it.
  const optionalCap = ratingOnly && sentiment === "mixed" ? 1 : 2;
  const optional: string[] = [];
  const ranked: Array<[string, string]> = [
    ["kw", kwSentence], ["geo", geoSentence], ["brand", brandSentence], ["warm", warmSentence],
  ];
  for (const [, s] of ranked) {
    if (s && optional.length < optionalCap) optional.push(s);
  }
  // If nothing optional rolled on a positive/mixed reply, force one SEO beat so
  // the reply always carries more than the bare minimum.
  if (optional.length === 0 && notNegative) {
    if (geo && geoPool.length) {
      optional.push(pick(geoPool, r(0x122)).replace(/\{geo\}/g, geo).replace(/\{store\}/g, store));
    } else if (brandPool.length) {
      optional.push(pick(brandPool, r(0x162)).replace(/\{store\}/g, store));
    }
  }

  const dropClose = r(0x131)() < 0.25;
  const segments: string[] = [open, reaction, ...optional, body];
  if (!dropClose) segments.push(close);

  const bodyText = joinSentences(segments, locale);
  return normalizeDashes(`${bodyText}\n\n${collapse(signoff)}`).trim();
}

/**
 * Sentence appended after the locality beat so a reply states WHAT the business
 * is. Kept as a short follow-on rather than its own beat: a standalone "We are a
 * udon restaurant" reads like an advert, an apposition reads like an owner.
 */
const CATEGORY_TAIL: Record<string, string> = {
  en: " That's what we set out to be as a {cat} here.",
  ja: "{cat}として、これからも大事にしていきます。",
  ar: " هذا ما نسعى إليه بصفتنا {cat} هنا.",
};

/** Fresh entropy per "Regenerate" (client). */
export function createReplyNonce(): string {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
