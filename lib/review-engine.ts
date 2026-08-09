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
import { resolvePoolSet, NON_VISIT_VERTICALS } from "@/lib/review-pools";

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
 * which accept ANY phrase shape. JA has its own detector + tails (see
 * ATTRIBUTE_SHAPED_JA); AR pools take these phrases naturally already.
 */
const ATTRIBUTE_SHAPED: RegExp[] = [
  /^(great|good|perfect|ideal|nice|excellent)\s+(for|to)\b/i,
  /^(family|kid|kids|pet|child|wheelchair|budget)[\s-]?friendly$/i,
  /^(clean|cosy|cozy|comfortable|friendly|quiet|spacious|affordable|cheap|fast|quick|tasty|delicious|relaxing|welcoming)(\s+and\s+\w+)?$/i,
  /\b(and|&)\s+(clean|comfortable|cosy|cozy|quiet|friendly|fast|affordable|welcoming)$/i,
  /\b(daily|weekly|nightly|always|often)$/i,
  /^(no|not)\s/i,
];

/**
 * JA equivalent. Japanese pills are usually noun phrases ("丁寧な接客", "気軽に
 * 行けるカウンター") which sit fine in an object slot, but owners also type
 * predicates and clauses ("一人でも入りやすい", "ランチが手頃", "リーズナブル").
 * Those break the object slots outright: "ランチが手頃が目当てでした" (double が),
 * "一人でも入りやすいに不満はありません" — both from a live 20-keyword store
 * (2026-07-30). Detected by predicate ENDING, so it stays data-independent (no
 * food/thing lexicon to maintain). Katakana-final nouns ("フライ", "パイ") are
 * untouched because the adjective endings listed are hiragana.
 */
const ATTRIBUTE_SHAPED_JA: RegExp[] = [
  // い-adjective ending the phrase.
  /(やすい|づらい|にくい|しい|安い|多い|早い|速い|広い|近い|軽い|明るい|温かい|暖かい|強い|旨い)$/,
  // Potential-form verb ("1貫から頼める", "子どもと入れる") — a predicate, not a thing.
  /[えけげせてねべめれ]る$/,
  // Owner shorthand for a condition ("子連れOK", "時価なし", "予約可").
  /(なし|OK|ＯＫ|可)$/,
  // Clause: "<noun>が/も<predicate>" — a whole sentence, not a thing.
  /[がも][^、。]{0,12}(手頃|豊富|充実|新鮮|丁寧|親切|清潔|静か|便利|快適|安心|お得|良し|多い|安い|早い|できる|しやすい)$/,
  // Bare na-adjective / katakana adjective describing the place.
  /^(リーズナブル|フレンドリー|カジュアル|アットホーム|コスパ|コスパ良し|清潔|静か|快適|便利|豊富|充実|新鮮|丁寧|親切|お得|安心)$/,
];

function isAttributeShaped(phrase: string, locale: ReviewLocale): boolean {
  const t = phrase.trim();
  if (!t) return false;
  if (locale === "ja") return ATTRIBUTE_SHAPED_JA.some((re) => re.test(t));
  if (!/^[\x20-\x7E]+$/.test(t)) return false; // non-Latin → leave alone
  return ATTRIBUTE_SHAPED.some((re) => re.test(t));
}

/**
 * Taste/try-flavoured templates ("{list}が特に美味しかったです", "{kw}はぜひ試して
 * ほしいです", "{list}にやられました", "{list}目当てでぜひ") only work when the
 * keyword IS something you eat or order. Stores mix dishes with service, price
 * and atmosphere pills, which produced "明朗会計と丁寧な接客が最高で、また食べに
 * 来たいです" on a live sushi store (2026-07-30).
 *
 * Detection is by NON-consumable marker (service / room / price / place / people)
 * rather than by a food lexicon: the marker list is small and closed, a food
 * lexicon never is. A phrase we cannot classify counts as consumable, so a real
 * dish never loses its food voice.
 */
const NON_CONSUMABLE_JA =
  /(接客|対応|サービス|スタッフ|店員|店主|大将|職人|板前|店内|内装|雰囲気|空間|カウンター|座席|個室|会計|価格|値段|料金|コスパ|予約|清潔|立地|場所|駐車|アクセス|支払|屋$|店$|さん$)/;

/** Templates whose voice assumes the keyword is food/drink. */
const TASTE_TEMPLATE_JA = /(美味し|食べ|試して|目当て|やられ)/;

/**
 * Drop taste-voiced templates when any keyword going into the slot is not a
 * consumable. Falls back to the unfiltered pool if nothing survives — an empty
 * slot would break assembly.
 */
function filterTasteVoice(pool: string[], locale: ReviewLocale, kws: string[]): string[] {
  if (pool.length === 0) return pool;
  if (locale === "ja") {
    if (!kws.some((k) => NON_CONSUMABLE_JA.test(k))) return pool;
    const kept = pool.filter((t) => !TASTE_TEMPLATE_JA.test(t));
    return kept.length > 0 ? kept : pool;
  }
  if (locale === "en") {
    if (!kws.some((k) => NON_CONSUMABLE_EN.test(k))) return pool;
    const kept = pool.filter((t) => !TASTE_TEMPLATE_EN.test(t));
    return kept.length > 0 ? kept : pool;
  }
  return pool;
}

/**
 * EN equivalent of NON_CONSUMABLE_JA. Stores mix dishes with room/service/price
 * pills exactly like JA stores do, and the food-voiced templates broke the same
 * way on live Pitfire data (owner eye-check 2026-07-31): "The place absolutely
 * nailed the friendly team", "The comfortable seating lived up to the hype",
 * "Worth going back for the comfortable seating alone". Detection is by closed
 * NON-consumable marker list, never by a food lexicon.
 */
const NON_CONSUMABLE_EN =
  /\b(seating|seats|service|staff|team|crew|value|prices?|pricing|bill|atmosphere|ambien[ct]e|vibe|decor|interior|space|parking|wi-?fi|cleanliness|hygiene|location|hospitality|host|waiters?|queue|wait|booking|reservation|delivery|takeaway)\b/i;

/** EN templates whose voice assumes the keyword is food or drink. */
const TASTE_TEMPLATE_EN = /(nailed|lived up to the hype|go for |big yes to|try |first bite|tasted|hungry)/i;

/**
 * Rhetorical MOVES — the loudest tell in the owner eye-check of live output
 * (2026-07-31). Each template is fine alone, but one review saying "was
 * recommended to me" (opener), "took a friend's recommendation" (filler) and
 * "is a solid choice, give it a go" (closer) makes the same move three times.
 * No guest does that. Same for two "stood out"s in one review.
 */
const MOVE_RES: Record<ReviewLocale, [string, RegExp][]> = {
  en: [
    // Stems, not whole words: "recommend\b" never matches "recommended", which
    // let the opener/filler pair slip through the first version of this guard.
    ["recommend", /\b(recommend\w*|tell (?:people|everyone|friends)|telling everyone|give (?:it|\S+) a (?:go|try)|worth a visit|if you haven'?t|solid choice|shout-out)/i],
    ["return", /\b(be back|come back|coming back|going back|go back|back again|next visit|regular\w*|again)\b/i],
    ["value", /\b(value|price\w*|pricing|bill|worth (?:it|every)|fair)\b/i],
    ["service", /\b(staff|service\w*|team|attentive|sorted|looked after)\b/i],
    ["pace", /\b(rushed|wait\w*|quick\w*|smooth\w*|pace)\b/i],
    ["hype", /\b(hype|rav\w+|did not disappoint|didn'?t disappoint)\b/i],
    ["standout", /\b(stood out|standout|highlight\w*|can'?t say enough|nail\w+|won me over|made the (?:visit|trip))\b/i],
    ["easy", /\b(felt easy|no notes|hard to fault|no complaints|straightforward|went smoothly)\b/i],
    ["atmosphere", /\b(atmosphere|ambien[ct]e|relaxed|cos[yz]|vibe|clean and comfortable|settle in)\b/i],
    ["firsttime", /\b(first time|been meaning to|finally made it)\b/i],
    ["smalltouch", /\b(little things|small touches|details right|clearly run by)\b/i],
  ],
  ja: [
    ["recommend", /(おすすめ|オススメ|勧め|人に教えたく|ぜひ)/],
    ["return", /(また来|再訪|また行|通い|リピート)/],
    ["value", /(価格|値段|コスパ|会計|お得|手頃)/],
    ["service", /(接客|対応|スタッフ|店員|サービス)/],
    ["atmosphere", /(雰囲気|落ち着|居心地|清潔|店内)/],
  ],
  ar: [],
};

function movesIn(text: string, locale: ReviewLocale): Set<string> {
  const out = new Set<string>();
  for (const [name, re] of MOVE_RES[locale]) if (re.test(text)) out.add(name);
  return out;
}

/**
 * Pick a template that does not repeat a move the text already makes. `render`
 * turns the raw template into the sentence that would actually be inserted, so
 * classification runs on the final wording. Falls back to a plain pick when
 * nothing fresh exists: an empty slot would break assembly.
 */
function pickFreshMove(
  pool: readonly string[],
  text: string,
  locale: ReviewLocale,
  rng: () => number,
  render: (tpl: string) => string = (t) => t,
  /** Structural slots (opener/core/closer) must yield something; optional
   *  padding (fillers, tails) is better dropped than repeated. */
  required = true,
): string {
  if (pool.length === 0) return "";
  const used = movesIn(text, locale);
  for (const tpl of shuffle([...pool], rng)) {
    const moves = movesIn(render(tpl), locale);
    let clash = false;
    for (const m of moves) if (used.has(m)) { clash = true; break; }
    if (!clash) return tpl;
  }
  return required ? pick(pool, rng) : "";
}

/**
 * Store names can END in sentence punctuation — "Let It Dough!" is a live
 * client, "Smith & Co." is the other shape. Sentence-level operations that
 * split on `.`/`!`/`?` therefore see a boundary INSIDE a real sentence, and the
 * 2026-07-31 rewrite (which inserts padding between sentences instead of after
 * the last one) shattered them:
 *   "Adding Let It Dough! The kind of place ... To my regular list."
 * Caught 2026-08-01 auditing that rewrite. Masking the name to a character that
 * can never be a terminator fixes it once for every caller, rather than each
 * call site re-deriving where the name sits.
 */
const NAME_MASK = "";
function maskStore(text: string, store?: string): string {
  if (!store || !/[.!?]/.test(store)) return text;
  return text.split(store).join(NAME_MASK);
}
function unmaskStore(text: string, store?: string): string {
  if (!store || !text.includes(NAME_MASK)) return text;
  return text.split(NAME_MASK).join(store);
}

/** Sentence count, used for the per-review beat budget. */
function countSentences(text: string, locale: ReviewLocale, store?: string): number {
  const t = maskStore(text.trim(), store);
  if (!t) return 0;
  return locale === "ja"
    ? ((t.match(/。/g) ?? []).length || 1)
    : ((t.match(/[.!?](\s|$)/g) ?? []).length || 1);
}

/** Split into sentences, keeping terminators attached. */
function splitSentences(text: string, locale: ReviewLocale, store?: string): string[] {
  const re = locale === "ja" ? /[^。]*。|[^。]+$/g : /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  const masked = maskStore(text, store);
  return (masked.match(re) ?? []).map((s) => unmaskStore(s.trim(), store)).filter(Boolean);
}

/**
 * Total sentences a review may contain. Before 2026-07-31 there was no ceiling:
 * opener + core + bridge + closer + one tail per leftover keyword + entity + up
 * to 3 fillers could stack 10-12 disconnected one-liners. Real reviews of this
 * length run 3-7 sentences.
 */
function sentenceBudget(kind: LenBucket["kind"]): number {
  return kind === "short" ? 3 : kind === "medium" ? 5 : 8;
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

/**
 * Assembly now produces ONE block; paragraphing is decided once at the end from
 * the finished text (layoutParagraphs). The old per-beat coin flip broke a
 * 100-word review into six one-sentence paragraphs — the most visible tell in
 * the owner eye-check of live output (2026-07-31).
 */
function weaveParagraphs(parts: string[], _rng: () => number, _compact: boolean, glue: string): string {
  const cleaned = parts.map(oneLineCollapse).filter(Boolean);
  if (cleaned.length === 0) return "";
  return normalizeParagraphFormatting(cleaned.join(glue));
}

/**
 * Append a sentence somewhere natural instead of always the tail. Stacking every
 * filler and keyword-tail onto the last paragraph produced a closing WALL of 5+
 * disconnected one-liners (eye-check 2026-07-25) — the single loudest bot tell.
 * Spread: usually merge into the last paragraph, sometimes an earlier one, and
 * occasionally stand alone before the closer, so padding reads as passing
 * remarks woven through the review.
 */
function appendSpread(full: string, sentence: string, glue: string, rng: () => number, locale: ReviewLocale = "en", store?: string): string {
  const flat = oneLineCollapse(normalizeParagraphFormatting(full).replace(/\n+/g, locale === "ja" ? "" : " "));
  const frag = oneLineCollapse(sentence);
  if (!frag) return flat;
  if (!flat) return frag;
  const parts = splitSentences(flat, locale, store);
  if (parts.length < 3) return `${flat}${glue}${frag}`;
  // Land the remark BEFORE the closing sentence most of the time: everything
  // stacking after the closer was what produced the trailing wall of one-liners.
  // Never before the opening sentence — a review has to start with the visit.
  const r = rng();
  const idx = r < 0.62 ? parts.length - 1 : r < 0.85 ? Math.max(1, parts.length - 2) : parts.length;
  const next = [...parts.slice(0, idx), frag, ...parts.slice(idx)];
  // Join with the locale's OWN glue. `glue || " "` looked harmless but JA glue
  // is the empty string, so every insertion put a halfwidth space after 。 —
  // "文句なしでした。 Hokkaido Curry目当てでぜひ。" (found 2026-08-01). Japanese
  // never spaces after the full stop, and it is the kind of tell a Japanese
  // owner spots instantly.
  return oneLineCollapse(next.join(glue));
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
function pickFreshFiller(
  t: string,
  store: string,
  pool: PoolSet,
  rng: () => number,
  locale: ReviewLocale = "en",
): string {
  // Fresh means: not already present AND not repeating a rhetorical move the
  // review already makes ("recommended to me" + "took a friend's recommendation"
  // in one review — owner eye-check 2026-07-31).
  const tpl = pickFreshMove(pool.fillers, t, locale, rng, (x) => fill(x, { store }), false);
  if (!tpl) return "";
  const cand = fill(tpl, { store });
  return cand && !t.includes(cand) ? cand : "";
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
 * groups"). Used for attribute-shaped keywords so they never enter an object
 * slot. Deliberately colon/"plus"-led (EN) or sentence-closed (JA): no article,
 * no particle, no verb agreement to break.
 */
const ATTRIBUTE_TAILS: Record<ReviewLocale, string[]> = {
  // Single-sentence ONLY. Two-sentence templates ("{kw}。この点は大きいと思い
  // ます。") split at the terminator, and each half became its own repeated
  // refrain on stores with many attribute keywords — measured 2026-08-03 on the
  // live Tsukasa config: the bare "‹›。" half 20x/100, the constant half 11x.
  // Stores whose keyword lists are attribute-heavy draw this slot constantly,
  // so it carries choice groups like the other hot slots.
  en: [
    "Another plus: {kw}.",
    "{Also worth mentioning|Worth flagging too}: {kw}.",
    "One more thing{ I liked|}: {kw}.",
    "Plus {kw}, which I {appreciated|rate|didn't take for granted}.",
    "{Same goes|That goes} for {kw} {too|as well}.",
    "And {kw}, which counts for a lot.",
    "And {kw}, too, which {helps|matters|makes a difference}.",
    "It's also {kw}, {for what that's worth|and that helps|no small thing}.",
    "Add {kw} to the plus column.",
    "On top of that, {kw}.",
    "Also {kw}, which {sealed it|tipped the scales|settled it} for me.",
    "Small detail, but a {good|welcome|nice} one: {kw}.",
  ],
  // JA: the phrase is closed off with 、before the frame continues, so no
  // particle ever attaches to the keyword — grammatical for a noun, an adjective
  // or a whole clause alike ("ランチが手頃、という点も良かったです。").
  ja: [
    "{kw}という点も{良かった|ありがたかった|評価したい}です。",
    "あと{kw}、これも{嬉しい|大事な|地味に効く}ポイントでした。",
    "{kw}というのも{嬉しい|助かる|ポイントが高い}ところです。",
    "{kw}、この点は{大きい|見逃せない|かなり効く}と思います。",
    "{kw}、これも良いところだと思います。",
    "{kw}、この点は特に嬉しかったです。",
    "{kw}なのも{良かった|続けやすそう|通いやすい理由}です。",
    "個人的には{kw}という部分も刺さりました。",
    "{kw}、こういうところが効いてきます。",
    "{地味ですが|意外と|なにげに}{kw}という点、{大事|効いてくる|ありがたい}と思います。",
  ],
  // AR has no attribute detector, so this slot is never reached.
  ar: [],
};

export type ReviewEntity = {
  area?: string | null;
  city?: string | null;
  /** Locale-resolved natural noun (assembler picks the label for the locale). */
  cat?: string | null;
};

function fillEntity(tpl: string, loc: string, cat: string): string {
  const filled = tpl.replace(/\{loc\}/g, loc).replace(/\{cat\}/g, cat);
  // "a" → "an" when the substituted category starts with a vowel LETTER:
  // "a Asian supermarket" reached production output (caught 2026-08-03).
  // Letter heuristic over sound is right for this domain: "an udon restaurant"
  // is also correct (oo-sound), and vowel-letter-consonant-sound words
  // ("university") don't occur as business categories here.
  if (/^[AEIOUaeiou]/.test(cat)) {
    const esc = cat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return filled.replace(new RegExp("\\b([Aa]) (" + esc + ")", "g"), (_m, a, c) => `${a}n ${c}`);
  }
  return filled;
}

/**
 * Inline choice groups: "{friendly|warm|genuinely kind}" resolves to ONE of the
 * options, seeded. This is the combinatorial layer on top of template pools —
 * a single template with two 3-way groups has 9 surface forms, so the pool's
 * effective size multiplies without writing (and reviewing) 9 near-duplicates.
 * Introduced 2026-08-03 after measuring sentence-level repetition across 100
 * reviews per store: pool growth alone left constant bridge/filler sentences
 * at 9-11 appearances per 100, because a hot slot draws ~150 times per 100
 * reviews and balls-in-bins guarantees a lopsided max. Choices cut the surface
 * repetition multiplicatively where adding templates cuts it only linearly.
 *
 * Runs BEFORE placeholder substitution. Safe against the named placeholders
 * ({store} {list} {a} {b} {kw} {loc} {cat}): a group only matches when its
 * body contains "|", which the named placeholders never do.
 */
function expandChoices(tpl: string, rng: () => number): string {
  return tpl.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, body: string) => {
    const opts = body.split("|");
    return opts[Math.floor(rng() * opts.length)]!;
  });
}

/** Resolve every choice group in a PoolSet once per review (seeded). */
function expandPoolChoices(pool: PoolSet, rng: () => number): PoolSet {
  const out = {} as PoolSet;
  (Object.keys(pool) as (keyof PoolSet)[]).forEach((k) => {
    out[k] = pool[k].map((t) => expandChoices(t, rng));
  });
  return out;
}

/**
 * Medical verticals: a treatment is not a dish. The generic keyword templates
 * include command/consumption voice ("Go for {list}", "Definitely try {kw}",
 * "Save room for {kw}") that reads like product promotion when the keyword is
 * a medical procedure — "Go for Exosome Therapy." on the live Kotobuki demo
 * (owner-flagged 2026-08-01). Recommending a clinic is a normal thing patients
 * do; urging strangers toward a specific procedure is not, and on a medical
 * profile it also reads as planted marketing.
 *
 * Vertical-keyed rather than keyword-keyed: every keyword a clinic configures
 * is a procedure or programme, so per-keyword detection would only be a worse
 * spelling of "vertical is medical".
 */
const MEDICAL_VERTICALS: ReadonlySet<Vertical> = new Set<Vertical>(["aesthetic", "clinic", "dental"]);

const MEDICAL_UNFIT: Record<ReviewLocale, RegExp> = {
  // Walk-in-casual voice is filtered alongside command/consumption voice: a
  // patient books an appointment, they don't wander in "with an hour to kill"
  // (caught 2026-08-03 in the final eye-check).
  // "We chose {store} for a small celebration" and "Brought a relative
  // visiting from abroad" read absurd for a clinic (owner read-through
  // 2026-08-07). Occasion/outing voice is filtered with the rest.
  // Restaurant league-table voice is the other half, and it was missing
  // until a live measurement on Kotobuki put it at 36% of EN reviews
  // (2026-08-09): "The star of the visit was HydraFacial, no contest.",
  // "Kotobuki Clinic nailed AGA Treatment.", "Big fan of IV Drip here.",
  // "Next time I'm starting with the regenerative medicine." A patient does
  // not rank treatments the way a diner ranks dishes. Kept OUT deliberately:
  // "loved", "can't say enough about", "people weren't wrong about" — a
  // patient really does write those about care they received, and stripping
  // them leaves the clinic pools too thin for the diversity gate.
  // Added 2026-08-09 after the naturalness reader (scripts/read-naturalness)
  // flagged "Loved IV Drip." and "Aesthetics Therapy, so good." on the live
  // Kotobuki config. "Loved" was deliberately kept in an hour earlier on the
  // argument that a patient does write it about care received — a native
  // reader disagreed for a NAMED PROCEDURE, which is the object slot here.
  en: /\b(go for|definitely try|don't skip|save room|go hungry|big yes|come for|did not miss)\b|\bask about\b|\byou'll want to ask\b|\bnailed\b|\bstar of the visit\b|\bno contest\b|\bbig fan of\b|\bunderrated\b|\bstarting with\b|\bkeep an eye out for\b|\bmake a fuss about\b|\bloved\b|\bso good\b|\bgo see\b|time to spare|hour to kill|popped into|more or less by chance|quick stop|celebration|celebrate|visiting from abroad/i,
  ja: /(試して|試しに|目当てでぜひ|をどうぞ|頼んで正解|締めて正解|食べ|美味し|お腹|楽しみ方|たまたま通りかかって|立ち寄り)/,
  ar: /(جرّب|اذهب من أجل|لا تفوّت|اترك مساحة|إن احترت، خذ)/,
};

function filterMedicalVoice(pool: PoolSet, locale: ReviewLocale, vertical: Vertical): PoolSet {
  if (!MEDICAL_VERTICALS.has(vertical)) return pool;
  const re = MEDICAL_UNFIT[locale];
  const strip = (arr: string[]) => {
    const kept = arr.filter((t) => !re.test(t));
    return kept.length > 0 ? kept : arr; // an empty slot would break assembly
  };
  // Every slot is filtered, not just the keyword slots: closers and fillers
  // carry consumption voice too ("今度は別の楽しみ方で{store}を試してみるつもり
  // です" reads absurd for a clinic — caught 2026-08-03 in verification).
  const out = {} as PoolSet;
  (Object.keys(pool) as (keyof PoolSet)[]).forEach((k) => {
    out[k] = strip(pool[k]);
  });
  return out;
}

// EN templates never place an indefinite article directly before {cat} ("a
// udon restaurant" would need "an") — only "a good/better {cat}" forms are
// safe. All templates are number-neutral; superlative ones are filtered out
// for 4-star reviews.
const ENTITY_BOTH: Record<ReviewLocale, string[]> = {
  // Superlatives ("best", "favourite", "hard to find better") are OUT: they are
  // the engine putting a rank in the guest's mouth, they read as planted, and
  // they collide with the review-solicitation policy line on influencing
  // content. Placement only — the guest says WHERE and WHAT, not "the best".
  // Pool size is a naturalness constraint, not padding: this sentence appears
  // ONCE IN EVERY REVIEW, so with N templates the most-used one shows up
  // ~100/N times per hundred reviews. At the original 6 templates the top
  // entity line hit 20-23x per 100 (measured 2026-08-03) — the loudest repeat
  // on a store's whole page. Structural variety matters more than count: these
  // deliberately mix recommendation, discovery, habit and plain-statement
  // shapes rather than reshuffling one sentence.
  en: [
    "My {go-to|default|first-choice} {cat} in {loc} now.",
    "Glad to have this {cat} {in|here in|right in} {loc}.",
    "If you're {near|around|anywhere near} {loc}, this is the {cat} to try.",
    "{Solid|Dependable|Quality} {cat} right in {loc}.",
    "{Good|Great|Reassuring} to have a {cat} like this {around|near} {loc}.",
    "Handy {spot|place|stop} if you're {in|around} {loc} and after a {cat}.",
    "Didn't expect to find a {cat} {this good|of this standard|this solid} in {loc}.",
    "{loc} {needed|was missing|has been waiting for} a {cat} like this.",
    // "a proper X" is British-marked as an intensifier; a US reader hears it
    // as foreign. Neutral branches only (owner note 2026-08-07).
    "A {real|genuinely good|seriously good} {cat}, right here in {loc}.",
    "We're {lucky|fortunate|glad} to have this {cat} in {loc}.",
    "If you {live|work|spend time} around {loc}, keep this {cat} {on your list|in mind|bookmarked}.",
    "Nice surprise to {come across|find|stumble on} a {cat} like this in {loc}.",
    "Whenever I'm {in|around|passing through} {loc}, this is my {cat} of choice.",
    "Anyone around {loc} should give this {cat} a {look|try|chance}.",
    "It's become our {regular|default|usual} {cat} whenever we're in {loc}.",
    "A {cat} in {loc} that actually {delivers|comes through|holds up}.",
    "Happy to finally have a {decent|good|solid} {cat} close by in {loc}.",
    "You don't come across a {cat} like this in {loc} {every day|often|all that often}.",
    "Ended up here {looking|hunting|searching} for a {cat} in {loc} and {got lucky|struck gold|found a keeper}.",
    "Between the {cat} options {in|around} {loc}, this is the one I'd {pick again|go back to|stick with}.",
  ],
  ja: [
    "{loc}で{cat}を探しているなら、ここを{おすすめします|推します|すすめたいです}。",
    "{loc}でこの{cat}に{出会えて|巡り会えて|見つけられて}よかったです。",
    "{loc}に来たらまた{寄りたい|立ち寄りたい|行きたい}{cat}です。",
    "{loc}に{あるのがうれしい|あってうれしい|あるのがありがたい}{cat}です。",
    "{loc}でこの水準の{cat}は{貴重だと思います|なかなかないと思います|そう多くないと思います}。",
    "{loc}{周辺|近く|エリア}で{cat}に行くなら、{まずここ|ここが第一候補|最初にここ}です。",
    "{loc}に{こんな|これほどの|この水準の}{cat}があったとは{知りませんでした|気づいていませんでした|思いませんでした}。",
    "{loc}の中でも{通いたくなる|また行きたくなる|足が向く}{cat}です。",
    "{loc}あたりで{cat}を探している人には{ぜひ教えたい|真っ先に教えたい|教えてあげたい}お店です。",
    "この{cat}が{loc}にあるのは{ありがたいです|助かります|心強いです}。",
    "{loc}方面に行くときは、この{cat}に寄るのが{楽しみ|恒例|お決まり}になりました。",
    "{cat}としても、{loc}という立地としても{文句なしです|申し分ないです|満足しています}。",
    "{近所に欲しかった|ずっと探していた|こういうのを待っていた}タイプの{cat}が{loc}にありました。",
    "{loc}でこの{cat}を知ってから、{他に行かなくなりました|ほかを探さなくなりました|ここばかりです}。",
    "{友人|周り|同僚}にも{loc}の{cat}ならここと伝えています。",
    "{loc}で{cat}選びに迷ったら、{ここでいい|ここを選べば安心|まずここでいい}と思います。",
  ],
  ar: [
    "من أفضل ما جربت من {cat} في {loc} {بصراحة|فعلاً|بلا مبالغة}.",
    "أفضل {cat} وجدته في {loc} {حتى الآن|إلى اليوم|حتى اللحظة}.",
    "{إن|إذا} كنت في {loc} وتبحث عن {cat} فهذا هو المكان {المناسب|الصحيح}.",
    "{صار|أصبح} {cat} المفضل لدي في {loc}.",
    "وجود {cat} بهذا المستوى في {loc} {شيء جميل|أمر يستحق التقدير|شيء يفرح}.",
    "لم {أتوقع|أكن أتوقع} أن أجد {cat} بهذا المستوى في {loc}.",
    "مكان يستحق {الزيارة|التجربة} لكل من يبحث عن {cat} في {loc}.",
    "أصبح وجهتي {عندما|كلما} أريد {cat} في {loc}.",
    "خيار {موثوق|مضمون|يُعتمد عليه} لمن يبحث عن {cat} في {loc}.",
    "{يسعدني|يسرني|من الجيد} وجود {cat} كهذا في {loc}.",
    "لمن يسأل عن {cat} في {loc}، {هذا هو المكان|هذه إجابتي|فهذا هو جوابي}.",
    "خيار {ممتاز|جيد جداً|موفق} لمن يريد {cat} في {loc}.",
    "سأعود إليه {كلما احتجت|في كل مرة أحتاج فيها} {cat} في {loc}.",
    "المكان الذي {أنصح به|أرشحه|أشير إليه} عندما يُذكر {cat} في {loc}.",
  ],
};

/**
 * Non-visit verticals (you hire them; you don't "pop in"). Visit-shaped entity
 * lines read wrong for these — "If you're near Dubai, this is the AI SEO agency
 * to try" was caught on our own live store 2026-07-29. Same slots, client voice.
 */
const ENTITY_BOTH_B2B: Record<ReviewLocale, string[]> = {
  en: [
    "Best {cat} we've {worked with|dealt with|hired} in {loc}.",
    "If you {need|are looking for|are hunting for} a {cat} in {loc}, {start here|this is the place to start|look here first}.",
    "The {cat} I'd {recommend|point out|suggest} to {anyone|any owner|any business} in {loc}.",
    "Glad we {found|came across|landed on} a {cat} like this in {loc}.",
    "{Reliable|Dependable|Trustworthy} {cat} for anyone {based|operating|doing business} in {loc}.",
    "Hard to find a {better|more reliable|more straightforward} {cat} in {loc}.",
    "For a business in {loc}, having a {cat} you can {trust|rely on|count on} matters, and this is one.",
    "We compared a few {cat} options in {loc} and landed here, {no regrets|glad we did|good call}.",
    "A {cat} in {loc} that {does what it says it will|delivers what it promises|keeps its word}.",
    "Other {companies|owners|businesses} in {loc} keep asking who our {cat} is.",
  ],
  ja: [
    "{loc}で{cat}を探しているなら、ここを{おすすめします|推します|すすめたいです}。",
    "{loc}の{cat}の中では間違いなく{良い選択でした|正解でした|当たりでした}。",
    "{loc}で{cat}を頼むなら{ここだと思います|ここを選びます|ここが堅いと思います}。",
    "{loc}でこの{cat}に{出会えて|巡り会えて|見つけられて}よかったです。",
    "{loc}で複数の{cat}を{比較して|見比べて}、ここに決めて正解でした。",
    "{loc}で信頼できる{cat}が見つかって{助かっています|安心しています|ありがたいです}。",
    "同じ{loc}の経営者にも、この{cat}を{紹介しています|すすめています}。",
  ],
  ar: [
    "أفضل {cat} {تعاملنا معه|عملنا معه} في {loc}.",
    "{إن|إذا} كنت تبحث عن {cat} في {loc} فابدأ من هنا.",
    "{cat} {أنصح به|أرشحه} لأي شركة في {loc}.",
    "{سعداء|محظوظون} أننا وجدنا {cat} بهذا المستوى في {loc}.",
    "قارنا عدة خيارات {cat} في {loc} واخترنا هذا، {ولم نندم|وكان القرار صائباً}.",
    "{cat} في {loc} {يفي بما يعد به|ينفذ ما يتفق عليه}.",
  ],
};

const ENTITY_LOC_ONLY_B2B: Record<ReviewLocale, string[]> = {
  en: [
    "Great to have them working in {loc}.",
    "Worth knowing about if you're based in {loc}.",
    "A real asset for businesses in {loc}.",
    "If your company operates around {loc}, keep them in mind.",
    "Being local to {loc} makes working with them easy.",
    "Plenty of options in {loc}, but these are the ones we stayed with.",
  ],
  ja: [
    "{loc}で事業をしているなら知っておいて損はありません。",
    "{loc}で頼れる先が見つかったのは大きいです。",
    "{loc}の会社なのでやり取りも早くて助かります。",
    "{loc}で商売をしている知人にも紹介しました。",
  ],
  ar: [
    "من {الجيد|المريح} وجودهم في {loc}.",
    "يستحق {المعرفة|الاطلاع} إن كان عملك في {loc}.",
    "كونهم في {loc} يجعل التعامل معهم {سهلاً|أسرع|أيسر}.",
    "خيارات كثيرة في {loc}، {لكننا بقينا معهم|إلا أننا استقرينا عليهم}.",
  ],
};

const ENTITY_CAT_ONLY_B2B: Record<ReviewLocale, string[]> = {
  en: [
    "Exactly what you want from a {cat}.",
    "One of the better {cat} options out there.",
    "A {cat} that communicates clearly and delivers on time.",
    "The rare {cat} that makes things simpler, not more complicated.",
    "As a {cat}, they hold themselves to a high standard.",
    "You can tell this {cat} cares about long-term clients, not one-off jobs.",
  ],
  ja: [
    "{cat}としては{文句なしです|申し分ないです|言うことなしです}。",
    "{良い|しっかりした}{cat}に依頼できたと思います。",
    "報告が{分かりやすい|明快な|丁寧な}{cat}です。",
    "長く{付き合える|お願いできる}{cat}だと感じています。",
    "仕事の丁寧さは{cat}として{信頼できます|安心できます}。",
  ],
  ar: [
    "{cat} بالمستوى الذي {تتوقعه|تنتظره} تماماً.",
    "من أفضل خيارات {cat} {المتاحة|الموجودة}.",
    "{cat} يتواصل بوضوح {ويلتزم بالمواعيد|ويحترم المواعيد}.",
    "من النادر أن تجد {cat} يجعل الأمور {أبسط لا أعقد|أسهل لا أصعب}.",
  ],
};

const ENTITY_LOC_ONLY: Record<ReviewLocale, string[]> = {
  en: [
    "Worth the {trip|drive|detour} out to {loc}.",
    "Great addition to {loc}.",
    "If you're around {loc}, stop by.",
    "Nice to have a place like this in {loc}.",
    "One more reason to like {loc}.",
    "Handy if you work around {loc}.",
    "We were in {loc} anyway and I'm glad we {stopped|came in|made the stop}.",
    "Being in {loc} makes it an easy stop for us.",
    "Easy to get to if you're in {loc}.",
    "{loc} locals, take note.",
  ],
  ja: [
    "{loc}という{場所も便利です|立地も助かります|場所なのも便利です}。",
    "{loc}に行くときは{また寄ります|また立ち寄ります|きっとまた寄ります}。",
    "{loc}にこういうお店があるのは{うれしいです|ありがたいです|助かります}。",
    "{loc}に用事があるときの{定番になりそうです|寄り道先になりました|お決まりになりそうです}。",
    "{loc}での{楽しみがひとつ増えました|行き先がひとつ増えました|お気に入りがひとつ増えました}。",
    "{loc}を通るたびに{寄りたくなります|つい寄ってしまいます|足が向きます}。",
    "{loc}まで{足を延ばす|出向く|行ってみる}価値があります。",
    "{loc}{周辺|近辺|エリア}では{ありがたい存在です|貴重だと思います|重宝しています}。",
    "場所は{loc}で、{分かりやすかったです|迷わず行けました|すぐ分かりました}。",
  ],
  ar: [
    "يستحق {الزيارة|التوقف} إن كنت قرب {loc}.",
    "موقعه في {loc} {مناسب جداً|عملي جداً|مريح}.",
    "{جميل|من الجيد|يسعدني} أن يوجد مكان كهذا في {loc}.",
    "سبب {إضافي|آخر|وجيه} لزيارة {loc}.",
    "كنت في {loc} على أي حال {وسعدت|وسررت} بالتوقف هنا.",
    "لمن يمر {قرب|بجوار|من} {loc}، يستحق التوقف.",
    "وجوده في {loc} {نقطة قوة|ميزة إضافية|أمر في صالحه}.",
    "زيارته سهلة لمن {يعمل|يسكن|يمر} قرب {loc}.",
  ],
};

const ENTITY_CAT_ONLY: Record<ReviewLocale, string[]> = {
  // The pool-size arithmetic in ENTITY_BOTH applies here verbatim, and EN was
  // the one branch that never got it: 8 flat templates, no choice groups, one
  // entity sentence per review = a top line at 100/8. Live Cinar Istanbul
  // measured 15x "If every rug store ran like this..." and 14x "Exactly what a
  // good rug store should be." per 100 reviews (bench, 2026-08-09) — ja/ar
  // already carried choice groups, so only EN refrained. Choice branches now
  // put every surface at ~5 per 100. Two "A {cat} ..." openers were folded into
  // "This {cat} ..." on the way: a bare indefinite article before {cat} breaks
  // on any vowel-initial category ("A Asian supermarket"), which is the rule
  // stated above this block but not followed here.
  en: [
    "{Exactly|Pretty much} what a good {cat} should be.",
    "One of the better {cat} options {around|in the area|I've come across}.",
    "You can tell this {cat} is run {with care|properly|by people who care}.",
    "The kind of {cat} {you hope to stumble on|you want to find|that's easy to recommend}.",
    "As far as a {cat} goes, this one {gets it right|has it sorted|does it properly}.",
    "This {cat} {does the simple things properly|gets the basics right|takes the details seriously}.",
    "If every {cat} ran like this, {I'd complain a lot less|there'd be a lot less to complain about}.",
    "{Good|Nice|Reassuring} to find this sort of {cat}.",
    "The sort of {cat} you can {trust|rely on|recommend without hesitating}.",
    "{Nothing|Not much} I'd change about this {cat}.",
  ],
  ja: [
    "{cat}としては{文句なしです|申し分ないです|言うことなしです}。",
    "{いい|良い|感じのいい}{cat}を{見つけました|見つけられました}。",
    "{cat}に求めるものが{きちんと揃っています|ひと通り揃っています|しっかり揃っています}。",
    "こういう{cat}が{近くに欲しかったです|前から欲しかったです|ずっと欲しかったです}。",
    "{cat}を探している人には{自信を持っておすすめできます|迷わずすすめられます|安心してすすめられます}。",
    "{丁寧にやっている|きちんとやっている|手を抜かない}{cat}だと思います。",
    "また{利用したい|使いたい|来たい}{cat}です。",
    "{cat}としての基本が{しっかりしています|きちんとしています|できています}。",
  ],
  ar: [
    "{cat} {ممتاز|رائع|جيد جداً} بكل المقاييس.",
    "من أفضل خيارات {cat} التي {جربتها|مررت بها}.",
    "{cat} {يهتم بالتفاصيل|لا يهمل التفاصيل|يعتني بالتفاصيل}.",
    "من النوع الذي {تتمنى|تأمل} أن تجده من {cat}.",
    "كل شيء فيه يدل على {cat} {يُدار بعناية|مُدار باهتمام|يُدار باحتراف}.",
    "سأكرر الزيارة {بالتأكيد|بلا شك}، فهو {cat} يستحق.",
  ],
};

/** Superlative markers unsuitable for a measured 4-star review. */
const SUPERLATIVE_RE = /favourite|Best \{cat\}|間違いなく|いちばん|أفضل|المفضل/;

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
  // EN guests write "in Dubai Hills", never "in Dubai Hills, Dubai" — the pair
  // reads like a directory entry (owner eye-check 2026-07-31). JA keeps the
  // natural possessive form, which is how people actually speak there.
  if (area && city && locale === "ja" && rng() < 0.35) return `${city}の${area}`;
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
  vertical: Vertical = "generic",
  store?: string,
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

  const b2b = NON_VISIT_VERTICALS.has(vertical);
  let pool: string[];
  if (missLoc && missCat) {
    pool = b2b ? ENTITY_BOTH_B2B[locale] : ENTITY_BOTH[locale];
  } else if (missLoc) {
    pool = b2b ? ENTITY_LOC_ONLY_B2B[locale] : ENTITY_LOC_ONLY[locale];
  } else {
    pool = b2b ? ENTITY_CAT_ONLY_B2B[locale] : ENTITY_CAT_ONLY[locale];
  }
  // Entity pools bypass filterMedicalVoice (they are not part of the PoolSet),
  // so the medical-voice filter is applied here too — "また立ち寄りたい美容・
  // 再生医療クリニック" slipped through this gap (caught 2026-08-03).
  if (MEDICAL_VERTICALS.has(vertical)) {
    const clinical = pool.filter((t) => !MEDICAL_UNFIT[locale].test(t));
    if (clinical.length > 0) pool = clinical;
  }
  if (rating < 5) {
    const measured = pool.filter((t) => !SUPERLATIVE_RE.test(t));
    if (measured.length > 0) pool = measured;
  }
  const sentence = fillEntity(expandChoices(pick(pool, rng), rng), loc ?? "", cat ?? "");
  return { text: appendSpread(text, sentence, cfg.glue, rng, locale, store), protect };
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
  locale: ReviewLocale = "en",
  budget = Infinity,
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
  // Beat budget outranks the length target: a review padded to its word count
  // with platitudes is exactly what the owner flagged. Two fillers max, and
  // never past the sentence ceiling.
  while (n < cfg.min && added < 2 && pool.fillers.length > 0 && countSentences(t, locale, store) < budget) {
    const filler = pickFreshFiller(t, store, pool, rng, locale);
    if (!filler) break;
    t = appendSpread(t, filler, cfg.glue, rng, locale, store);
    n = cfg.measure(t);
    added++;
  }
  if (
    added === 0 &&
    n < cfg.target - Math.round(cfg.target * 0.06) &&
    pool.fillers.length > 0 &&
    countSentences(t, locale, store) < budget
  ) {
    const filler = pickFreshFiller(t, store, pool, rng, locale);
    if (filler) t = appendSpread(t, filler, cfg.glue, rng, locale, store);
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

function buildCore(store: string, kws: string[], pool: PoolSet, cfg: LocaleCfg, compact: boolean, seed: number, locale: ReviewLocale): string {
  const rDual = forkRng(seed, 0x33);
  if (!compact) {
    const dual = joinKeywordDual(store, kws, pool, cfg, rDual, seed);
    if (dual) return dual;
  }
  const list = cfg.joinList(kws, forkRng(seed, 0xaa11));
  const rawPool = compact && pool.coresCompact.length > 0 ? pool.coresCompact : pool.coresLong;
  const corePool = filterTasteVoice(rawPool, locale, kws);
  return fill(pick(corePool, forkRng(seed, compact ? 0x103 : 0x102)), { store, list });
}

function buildInner(store: string, kws: string[], pool: PoolSet, cfg: LocaleCfg, compact: boolean, seed: number, locale: ReviewLocale): string {
  const openerPool = compact && pool.openersShort.length > 0 ? pool.openersShort : pool.openersLong;
  const bridgePool = compact && pool.bridgesShort.length > 0 ? pool.bridgesShort : pool.bridgesLong;
  const closerPool = compact && pool.closersShort.length > 0 ? pool.closersShort : pool.closersLong;

  // Picked SEQUENTIALLY so each beat can see what the review already said: the
  // opener, bridge and closer pools all contain recommend/return/value moves,
  // and picking them independently let one review make the same move three
  // times (owner eye-check 2026-07-31).
  const opener = fill(pick(openerPool, forkRng(seed, 0x101)), { store });
  const core = buildCore(store, kws, pool, cfg, compact, seed, locale);
  const soFar = `${opener} ${core}`;
  const bridge = bridgePool.length
    ? fill(pickFreshMove(bridgePool, soFar, locale, forkRng(seed, 0x104), (t) => fill(t, { store })), { store })
    : "";
  const closer = fill(
    pickFreshMove(closerPool, `${soFar} ${bridge}`, locale, forkRng(seed, 0x105), (t) => fill(t, { store })),
    { store },
  );

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
  // "the place" / "the spot" read like a bot narrating ("Will definitely be back
  // to the place." — owner eye-check 2026-07-31). Guests say "this place", or
  // "here" when no preposition is in the way (handled at the call site).
  en: ["this place", "this spot"],
  ja: ["こちら", "このお店", "ここ", "こちらのお店"],
  ar: ["هذا المكان", "المكان"],
};

/**
 * You don't call a law firm "the spot". Non-visit verticals get stand-ins that
 * refer to the provider, not to premises — same slots, so grammar is unchanged.
 */
const STANDINS_NON_VISIT: Record<ReviewLocale, string[]> = {
  en: ["them", "the team", "this team"],
  ja: ["こちら", "こちらの担当者", "担当の方"],
  ar: ["هذا الفريق", "الفريق"],
};

function capStoreMentions(
  text: string,
  name: string,
  locale: ReviewLocale,
  rng: () => number,
  vertical: Vertical = "generic",
): string {
  if (!name) return text;
  const variants = NON_VISIT_VERTICALS.has(vertical) ? STANDINS_NON_VISIT[locale] : STANDINS[locale];
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
      // "back to here" / "at here" are ungrammatical: after a preposition only a
      // noun phrase works, so the bare adverb variant is swapped out.
      if (locale === "en" && sub === "here" && /\b(to|at|in|from|near|about|of)\s*$/i.test(before)) {
        sub = "this place";
      }
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
/**
 * A store name that already ends in sentence punctuation collides with the
 * terminator of whatever template it closes: "Already planning my next visit to
 * Let It Dough!." and "Adding Smith & Co.. to my list" (live client + the other
 * name shape, found 2026-08-01). The name is verbatim-protected, so the fix is
 * to drop the template's redundant terminator, never the name's own.
 */
function dedupeTerminators(text: string): string {
  return text
    .replace(/([.!?])[.!?]+/g, "$1")
    .replace(/([.!?])\s*。/g, "$1")
    .replace(/。。+/g, "。");
}

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
 * How many of the store's forced/core phrases may appear in ONE review.
 *
 * Forced phrases used to ALL be woven into EVERY review. With a store carrying
 * three or four of them plus the guest's own taps, a single review had to carry
 * six or seven verbatim phrases, and the text collapsed into a keyword dump
 * (owner eye-check 2026-08-02, live Kotobuki demo):
 *
 *   "Japanese aesthetic medicine in Dubai plus Diabetes & Metabolism Programme
 *    plus IV Drip and the aesthetic treatments in Dubai lived up to the hype."
 *
 * A real-config bench over every live store measured it: 52% of reviews crammed
 * 3+ phrases into one sentence with all forced woven, 15% with one, 0.1% with
 * none. So the forced set now ROTATES — each review carries one (two only when
 * the guest tapped almost nothing, so a sparse review still has substance).
 *
 * This is also the better SEO/AIO outcome, not a trade against it. Every review
 * still carries a buyer-language phrase, but the corpus ends up with all of the
 * store's phrases spread across it instead of the same three repeated verbatim
 * in every single review — which is what a review-spam filter looks for and
 * what makes an LLM treat the text as boilerplate rather than testimony.
 */
const FORCED_PER_REVIEW = 1;

/**
 * An English buyer-language phrase ("aesthetic treatments in Dubai", "udon in
 * Dubai") reads fine in an English review and reads like an advert inside a
 * Japanese or Arabic one:
 *
 *   "IV Dripとaesthetic treatments in Dubaiは誰かに教えたくなる良さでした。"
 *
 * (found 2026-08-02 eye-checking the Kotobuki demo). Product and treatment
 * names are different — a Japanese patient really does write "IV Drip" — so the
 * test is for an English PHRASE, not for Latin script itself.
 *
 * The first cut of this test looked only for an English function word gluing the
 * phrase together. That let every glue-less phrase straight through, which is
 * most of them — "premium doughnuts", "artisan pizza", "regenerative medicine",
 * and (found 2026-08-02 while configuring Sakura's gift line) "Japanese tea gift
 * boxes", which lands as「Japanese tea gift boxesにやられました。」— the same
 * advert-shaped sentence the test was written to stop.
 *
 * So the real distinction is name vs. phrase, and English writes it in the
 * capitalisation: a name is capitalised throughout ("IV Drip", "Matcha Suruga
 * RG", "Diabetes & Metabolism Programme") while a descriptive phrase carries
 * lowercase words ("premium doughnuts", "72-hour dough"). A lowercase word in a
 * multi-word Latin phrase therefore means prose, and prose in the wrong language
 * reads as an advert.
 *
 * Dropping these in ja/ar costs no discoverability: the entity layer already
 * writes the category and area in the review's own language ("Dubaiの
 * Trade Centreで美容・再生医療クリニック"), which is the phrase a Japanese
 * searcher actually types.
 */
const EN_PHRASE_GLUE = /\b(in|at|for|of|near|the|and|with|from|to)\b/i;
/** Capitalised throughout (digits and `&` count) = a name, not English prose. */
function looksLikeProperName(kw: string): boolean {
  return kw.split(/[\s&]+/).filter(Boolean).every((w) => !/^[a-z]/.test(w));
}
/**
 * Buyer-search GEO phrases ("pizza in Dubai", "aesthetic treatments in Dubai")
 * are searches, not dishes. In an OBJECT slot they read broken — the live
 * Pitfire demo produced "Hot Honey Margherita and the pizza in Dubai lived up
 * to everything I'd heard" (owner-caught 2026-08-03): a dish and a geography
 * joined as if both were menu items, plus a withArt "the" on a phrase that
 * must never take one. JA/AR drop these phrases (dropForeignPhrases); EN must
 * KEEP them — they are the SEO layer — so they route through dedicated frames
 * where a search phrase is the natural object: "Hard to beat for pizza in
 * Dubai." They never join a {list}, never merge with other tails, and never
 * take an article.
 */
function isGeoPhrase(kw: string): boolean {
  return /^[\x20-\x7E]+$/.test(kw) && /\s/.test(kw) && /\b(in|near|around)\s+[A-Z]/.test(kw);
}

/**
 * What KIND of thing a keyword names.
 *
 * Until 2026-08-09 this was inferred from the string alone, in three branches:
 * geo phrase, attribute-shaped, and — for everything else — "a thing you order
 * or buy". That last branch is not a classification, it is the leftover pile,
 * and it is where every unnatural sentence the owner caught on a live phone
 * came from. A category ("Japanese and Korean groceries") landed in a dish
 * slot and produced "Big yes to Japanese and Korean groceries."; a field of
 * medicine produced "Kotobuki Clinic nailed AGA Treatment." No regex fixes
 * that, because the defect is semantic: the string carries no signal for the
 * difference between a dish and a discipline.
 *
 * So the type is DATA now. `stores.keyword_types` maps a keyword to its type,
 * set by whoever writes the keyword, and inference survives only as the
 * fallback for keywords nobody has typed yet — which keeps every existing
 * store rendering exactly as it does today.
 */
export type KeywordType = "item" | "service" | "category" | "attribute" | "geo";
export type KeywordTypeMap = Record<string, KeywordType>;

const KEYWORD_TYPES: ReadonlySet<string> = new Set([
  "item", "service", "category", "attribute", "geo",
]);

export function classifyKeyword(
  kw: string,
  types: KeywordTypeMap | undefined,
  locale: ReviewLocale,
): KeywordType {
  const explicit = types?.[kw.trim()];
  if (explicit && KEYWORD_TYPES.has(explicit)) return explicit;
  if (isGeoPhrase(kw)) return "geo";
  if (isAttributeShaped(kw, locale)) return "attribute";
  return "item";
}

/**
 * Frames for a CATEGORY — a class of goods the business sells ("luxury rugs",
 * "Japanese and Korean groceries"), not one orderable thing. Verbs stay
 * number-neutral: the same slot takes a plural class and a mass noun, so any
 * "is/was/are" here becomes a visible grammar error on half the stores.
 */
const CATEGORY_TAILS: Record<ReviewLocale, string[]> = {
  en: [
    "Good {range|selection|choice} of {kw}.",
    "They know their {kw}.",
    "This is where I {go|come} for {kw}.",
    "Plenty of {kw} to {choose from|pick from}.",
    "Worth a look if you {want|need} {kw}.",
    "No shortage of {kw} {here|at this place}.",
    "They clearly {care about|take pride in} their {kw}.",
    "That's what I {come|keep coming} here for: {kw}.",
  ],
  ja: [
    "{kw}の{品揃え|ラインナップ}が{良かったです|しっかりしていました}。",
    "{kw}を{探している|見ている}なら{一度見る価値があります|ここだと思います}。",
    "{kw}の{種類|選択肢}が{豊富でした|多かったです}。",
    "{kw}については{ここで揃います|ここで足ります}。",
    "{kw}を{ひと通り|まとめて}{見られました|見ることができました}。",
  ],
  ar: [
    "{تشكيلة|مجموعة} {جيدة|واسعة} من {kw}.",
    "إن كنت تبحث عن {kw}، فهذا هو المكان.",
    "خيارات {kw} {متنوعة|كثيرة} هنا.",
    "يعرفون {kw} {جيداً|تماماً}.",
  ],
};

/**
 * Frames for a SERVICE the guest received ("regenerative medicine", "custom
 * sizing"). Deliberately clinical: no taste, no ranking, no ordering voice, so
 * these are safe for medical verticals unfiltered. Number-neutral for the same
 * reason as CATEGORY_TAILS.
 */
const SERVICE_TAILS: Record<ReviewLocale, string[]> = {
  en: [
    "Came in for {kw} and the process was {explained properly|walked through step by step|clear from the start}.",
    "They took the time to explain {kw} before anything {started|began}.",
    "No {complaints|concerns} about {kw}.",
    "If you're {considering|looking into} {kw}, this is a {sensible|solid} place to start.",
    "Happy with how they handled {kw}.",
    "The follow-up after {kw} was {thorough|genuinely good}.",
    "{Straightforward|Smooth} experience with {kw}.",
    "Went in for {kw} and left knowing exactly what {had been done|to expect next}.",
    "Nothing was {rushed|glossed over} around {kw}.",
    "They answered every question I had about {kw}.",
    "{Clear|Honest} about what {kw} would and would not do.",
    "Booked {kw} and the whole thing ran {on time|to schedule}.",
  ],
  ja: [
    "{kw}について{丁寧に説明してもらえました|きちんと説明がありました}。",
    "{kw}を{受けました|お願いしました}が、{不安はありませんでした|安心して任せられました}。",
    "{kw}を{検討している|考えている}なら、{まず相談してみる価値があります|話を聞いてみる価値があります}。",
    "{kw}の{事前説明|説明}が{分かりやすかったです|明確でした}。",
    "{kw}の{後のフォロー|アフターケア}も{しっかりしていました|丁寧でした}。",
  ],
  ar: [
    "شرحوا {kw} {بوضوح|بالتفصيل} قبل البدء.",
    "لا {ملاحظات|تحفظات} على {kw}.",
    "إن كنت {تفكر في|تبحث عن} {kw}، فهذه بداية {موفقة|جيدة}.",
    "المتابعة بعد {kw} كانت {ممتازة|دقيقة}.",
  ],
};

/** EN-only frames where a buyer-search phrase reads natural. No taste or
 *  command voice, so they are safe for medical verticals unfiltered. */
const GEO_TAILS: string[] = [
  // Every frame carries a choice group: geo phrases draw ~1 per review, so a
  // single-surface frame lands ~11x per 100 reviews and trips the diversity
  // gate (measured 16x, 2026-08-03). ~22 surfaces keeps the max under the cap.
  // "Hard to beat FOR X" reads as "unbeatable in terms of X" — the idiom's
  // usual object is price or value ("hard to beat for the money"), so a
  // product+place phrase leaves it saying nothing a reader can parse, on top
  // of the missing subject: "Hard to beat for Anatolian rugs in Dubai"
  // (owner read-through 2026-08-09, live Cinar Dubai QR). "for" only works
  // here in its PURPOSE reading, which needs a plain noun head in front of it.
  // Not "hard to find better {kw}": that is the comparative ENTITY_BOTH rules
  // out by name, and "You won't do much better for {kw}" already covers it.
  "{Solid|Reliable} choice for {kw}.",
  // "As far as X goes" forces singular agreement, and keywords are routinely
  // plural ("naturally dyed rugs") -> "As far as ... rugs in Cappadocia goes"
  // is a visible grammar error (owner read-through 2026-08-07). "When it comes
  // to X" is agreement-free.
  "When it comes to {kw}, this is {the place|the spot|the one to know}.",
  "For {kw}, this is {my pick|the spot|where I'd send people}.",
  "If you're after {kw}, {this is it|look no further|start here}.",
  "My {go-to|first stop} for {kw} {now|these days}.",
  "You won't {do|find} much better for {kw}.",
  "Sets the {bar|standard} for {kw}.",
  "When someone asks about {kw}, this is {my answer|the name I give|where I point them}.",
  // "Ticks the boxes" is British-marked; "checks" reads neutral to a US ear.
  // Pitfire's management is a US native speaker (owner note 2026-08-07).
  // "Checks all the boxes FOR X" wants X to be a need or an occasion ("for a
  // family dinner"). Store keywords are product+place phrases ("pizza in
  // Dubai"), which makes the "for" reading abstract and slightly off. The
  // conditional frame takes any noun phrase (owner questioned it twice:
  // 2026-08-07, first as "Ticks every box for natural dye rugs in Cappadocia").
  "If you're {after|looking for} {kw}, this {checks every box|checks all the boxes}.",
];

function isForeignPhrase(kw: string, locale: ReviewLocale): boolean {
  if (locale === "en") return false;
  if (!/^[\x20-\x7E]+$/.test(kw)) return false; // not pure Latin/ASCII → leave alone
  if (!/\s/.test(kw)) return false; // single token = a name, keep it
  return EN_PHRASE_GLUE.test(kw) || !looksLikeProperName(kw);
}

/**
 * Remove English buyer-search phrases when the review is not in English.
 *
 * Applies to the WHOLE keyword list, not just the forced slice. The original
 * version keyed on forcedCount — and the 2026-08-03 compliance change turned
 * core phrases into pre-ticked guest pills, so forcedCount became 0 in
 * production and "udon in Dubaiは特に印象に残りました" reached a live JA draft
 * (owner-caught 2026-08-03).
 *
 * Guest picks use the NARROW test (English glue words only): "udon in Dubai"
 * goes, but menu items stay even when lowercase — Dubai menus are written in
 * English, so a Japanese guest genuinely writes "Niku Beef udonを頼みました".
 * The forced slice keeps the stricter test (glue OR not-a-proper-name) for
 * callers that still pass forcedCount, e.g. the bench.
 */
const isAsciiText = (k: string): boolean =>
  [...k].every((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x7e);

function dropForeignPhrases(
  keywords: string[],
  forcedCount: number,
  locale: ReviewLocale,
  types?: KeywordTypeMap,
): { keywords: string[]; forcedCount: number } {
  if (locale === "en") {
    // Only for stores that carry types: an untyped legacy store must keep
    // rendering exactly as it does today.
    if (!types) return { keywords, forcedCount };
    const keptEn: string[] = [];
    let keptForcedEn = 0;
    keywords.forEach((k, i) => {
      if (!isAsciiText(k)) return;
      keptEn.push(k);
      if (i < forcedCount) keptForcedEn++;
    });
    return { keywords: keptEn, forcedCount: keptForcedEn };
  }
  // An explicitly typed keyword does not need the shape guess. In a non-English
  // review only an ITEM survives — a menu name a guest really does write in
  // English ("Niku Beef udon"). Category, service, geo and attribute are all
  // English PROSE, and prose in the wrong language reads as machine text.
  //
  // This is the actual cause of "handmade udon noodlesで締めて正解でした。" and
  // "まずはregenerative medicineを。" on live JA demos: the 2026-08-03 change
  // that turned core phrases into pre-ticked guest pills zeroed forcedCount in
  // production, which silently moved those phrases from the strict test below
  // to the narrow one — and the narrow test only looks for English glue words,
  // which "sanuki-style udon" does not have. Typing the keyword removes the
  // guess entirely; untyped keywords fall through to the old behaviour.
  if (types) {
    const kept: string[] = [];
    let keptForced = 0;
    keywords.forEach((k, i) => {
      const t = types[k.trim()];
      if (t && t !== "item" && isAsciiText(k)) return;
      kept.push(k);
      if (i < forcedCount) keptForced++;
    });
    keywords = kept;
    forcedCount = keptForced;
  }
  const fc = Math.max(0, Math.min(forcedCount, keywords.length));
  const forcedKept = keywords.slice(0, fc).filter((k) => !isForeignPhrase(k, locale));
  const guestKept = keywords
    .slice(fc)
    .filter((k) => !(/^[\x20-\x7E]+$/.test(k) && /\s/.test(k) && EN_PHRASE_GLUE.test(k)));
  return { keywords: [...forcedKept, ...guestKept], forcedCount: forcedKept.length };
}

/**
 * Pick the phrases to weave. EVERY guest pick is woven — the guest deliberately
 * tapped those, so dropping any reads as "my keyword disappeared" (real-store
 * feedback 2026-07-16). The forced/core set rotates instead (FORCED_PER_REVIEW).
 * Only when the total is extreme (> WOVEN_KEYWORD_CAP) do we trim guest picks.
 */
function selectWovenKeywords(keywords: string[], forcedCount: number, seed: number): string[] {
  const fc = Math.max(0, Math.min(forcedCount, keywords.length));
  const allForced = keywords.slice(0, fc);
  const guest = keywords.slice(fc);
  // A review the guest barely filled in can carry a second core phrase without
  // reading as a dump; a busy one cannot.
  const take = Math.min(allForced.length, guest.length <= 1 ? FORCED_PER_REVIEW + 1 : FORCED_PER_REVIEW);
  // Rotate by seed so the corpus covers every forced phrase over time, and the
  // same store never opens with the identical core phrase twice in a row.
  const forced = allForced.length <= take ? allForced : shuffle(allForced, forkRng(seed, 0xc0ffe1)).slice(0, take);
  const room = Math.max(0, WOVEN_KEYWORD_CAP - forced.length);
  if (room === 0 || guest.length === 0) return forced;
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
  keywordTypes?: KeywordTypeMap,
): string {
  // Choice groups resolve once per review with their own fork, so the same
  // template lands with different surface wording from review to review.
  const pool = expandPoolChoices(
    filterMedicalVoice(resolvePoolSet(locale, vertical), locale, vertical),
    forkRng(seed, 0xc401ce),
  );
  const name =
    store.trim() ||
    (locale === "ja" ? "こちらのお店" : locale === "ar" ? "هذا المكان" : "this establishment");
  const allKeywords = [...new Set(kws.map((k) => k.trim()).filter(Boolean))];

  if (allKeywords.length === 0) {
    const cfg0 = { ...LOCALE_CFG[locale], ...pickLenBucket(locale, seed, rating, 0) };
    let t0 = reviewNoKeywords(name, pool, cfg0, seed);
    const woven0 = weaveEntity(t0, entity, locale, cfg0, seed, rating, vertical, name);
    t0 = normalizeDashes(capStoreMentions(woven0.text, name, locale, forkRng(seed, 0xca9), vertical));
    if (locale === "en") t0 = capitalizeSentenceStartsEn(t0, [name, ...woven0.protect]);
    return t0;
  }

  const { keywords: kwPool, forcedCount: fcUsable } = dropForeignPhrases(allKeywords, forcedCount, locale, keywordTypes);
  const keywords = selectWovenKeywords(kwPool, fcUsable, seed);
  // Length bucket is chosen AFTER keyword selection: the woven count decides
  // how short a review can honestly be while keeping every phrase verbatim.
  const bucket = pickLenBucket(locale, seed, rating, keywords.length);
  const cfg = { ...LOCALE_CFG[locale], ...bucket };
  // Geo search phrases are pulled out BEFORE the core/tail machinery: they
  // must never enter a {list} or an ordinary object tail (see isGeoPhrase).
  const typeOf = (k: string) => classifyKeyword(k, keywordTypes, locale);
  const geoKws = locale === "en" ? keywords.filter((k) => typeOf(k) === "geo") : [];
  // Categories and services leave the object machinery for the same reason geo
  // phrases do: the {list} slot and the ordinary tails both assume the phrase
  // names one thing you ordered.
  const catKws = keywords.filter((k) => typeOf(k) === "category");
  const svcKws = keywords.filter((k) => typeOf(k) === "service");
  const dedicated = new Set([...geoKws, ...catKws, ...svcKws]);
  const nonGeoKeywords = dedicated.size > 0 ? keywords.filter((k) => !dedicated.has(k)) : keywords;
  const shuffledRaw = shuffle(nonGeoKeywords, forkRng(seed, 0xb8b26351));
  // Attribute-shaped phrases ("great for groups") cannot sit in the {list}
  // object slot, so sort them to the back — the core takes nouns, and they come
  // out through the appositive tails below. Stable within each group, so the
  // shuffle still drives variety.
  const shuffled = [
    ...shuffledRaw.filter((k) => typeOf(k) !== "attribute"),
    ...shuffledRaw.filter((k) => typeOf(k) === "attribute"),
  ];

  // Only a small CORE of keywords goes into the {list} sentence (see LIST_CAP);
  // the rest are appended as natural single-keyword tails below. This is the
  // single biggest human-ness lever: it turns "A, B, C, D and E" dumps into a
  // guest naming one or two things, then mentioning the others in passing.
  const coreCount = bucket.kind === "short" ? 1 : Math.min(LIST_CAP, shuffled.length);
  // The core {list} sentence is an object slot, so it takes NOUNS only. With
  // few nouns the core simply gets shorter (or empty) and the attribute phrases
  // all leave through the appositive tails — never "Loved the family friendly".
  const coreNouns = shuffled.filter((k) => typeOf(k) !== "attribute");
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
      : buildInner(name, coreKws, pool, cfg, compact, seed, locale);
  // protect ALL verbatim keywords from length-trimming, not just the core ones.
  // Reserve room for what still has to be woven after this pass: at least one
  // keyword tail and the entity sentence. Without the reserve the filler pass
  // ate the whole budget and the review ran two beats long anyway.
  text = tuneLength(text, name, pool, cfg, seed, 0x301, shuffled, locale, Math.max(3, sentenceBudget(bucket.kind) - 2));

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
  const nounLeft = leftovers.filter((k) => typeOf(k) !== "attribute");
  const attrLeft = leftovers.filter((k) => typeOf(k) === "attribute");
  // `n` = how many verbatim phrases this slot already carries, so the later
  // budget merge cannot stack a pair onto a pair. Without it, pushGroup paired
  // 4 leftovers into 2 slots and the merge then joined those 2 slots into ONE
  // sentence carrying all four: "Definitely try the aesthetic treatments in
  // Dubai and Weight Management Programme and Medical Wellness Check and
  // Anti-Aging Treatment." (found 2026-08-02 by the live-config bench).
  const slots: { text: string; attr: boolean; n: number }[] = [];
  const pushGroup = (group: string[], attr: boolean) => {
    if (group.length >= 4 && !attr) {
      for (let i = 0; i < group.length; i += 2) {
        const pair = group.slice(i, i + 2);
        slots.push({
          attr,
          n: pair.length,
          text:
            pair.length === 2
              ? cfg.joinList(pair, forkRng(seed, 0x7c00 + i))
              : locale === "en" ? withArt(pair[0]!) : pair[0]!,
        });
      }
      return;
    }
    for (const kw of group) {
      slots.push({ attr, n: 1, text: attr ? kw : locale === "en" ? withArt(kw) : kw });
    }
  };
  pushGroup(nounLeft, false);
  pushGroup(attrLeft, true);

  // Attribute tails bypass the PoolSet, so expandPoolChoices never sees them —
  // resolve their choice groups here or the raw "{a|b}" braces reach the guest
  // (caught 2026-08-03: the diversity gate printed an unexpanded group).
  const attrChoiceRng = forkRng(seed, 0x7a2c);
  const attrOrder = shuffle(
    ATTRIBUTE_TAILS[locale].map((t) => expandChoices(t, attrChoiceRng)),
    forkRng(seed, 0x7a22),
  );
  const budget = sentenceBudget(bucket.kind);
  // The beat budget must NEVER drop a keyword — every selected phrase is a
  // verbatim guarantee (the first cut of this guard broke it: 2 of 4 keywords
  // silently disappeared). When leftovers outnumber the sentences left, the
  // budget changes the GROUPING (more phrases per tail), never the coverage.
  const roomForTails = Math.max(1, budget - countSentences(text, locale, name) - 1);
  if (slots.length > roomForTails) {
    // HARD ceiling of 2 verbatim phrases per tail sentence. Before 2026-08-02
    // this divided the leftovers by the room available, so a tight budget
    // produced tails of three and four phrases ("A plus B plus C and D") — the
    // keyword-dump the owner flagged. Naturalness outranks the sentence budget:
    // when the two conflict the review simply runs a sentence longer, which a
    // reader does not notice, rather than stacking a list a reader notices
    // immediately. Merging is by PHRASE COUNT, not slot count, so a pair is
    // never merged onto another pair.
    const merged: { text: string; attr: boolean; n: number }[] = [];
    for (const attr of [false, true]) {
      const group = slots.filter((s) => s.attr === attr);
      let i = 0;
      while (i < group.length) {
        const head = group[i]!;
        const next = group[i + 1];
        // Attribute phrases are never merged. Their tails already read as an
        // aside ("Another plus: {kw}."), so joining two produced "Another plus:
        // the perfect for gifts plus the no artificial colors" — a doubled
        // "plus" AND an article on a phrase that must not take one (withArt
        // runs inside joinList). Found 2026-08-02 on the live Let It Dough
        // config, which is the store that actually carries attribute keywords.
        if (!attr && head.n === 1 && next && next.n === 1) {
          merged.push({
            attr,
            n: 2,
            text: cfg.joinList([head.text, next.text], forkRng(seed, 0x7d00 + i)),
          });
          i += 2;
        } else {
          merged.push(head);
          i += 1;
        }
      }
    }
    slots.length = 0;
    slots.push(...merged);
  }
  let ti = 0;
  let ai = 0;
  // The rotation counters below index into `order`, but `order` is re-filtered
  // per slot (filterTasteVoice depends on the phrase), so the same template can
  // come up twice — "Special mention for A. Special mention for B." landed
  // adjacent in one review (owner read-through 2026-08-07). Remember what has
  // been used and skip it.
  const usedTails = new Set<string>();
  for (const slot of slots) {
    // Noun tails additionally drop taste voice when this phrase is not something
    // you eat ("気さくな大将はぜひ試してほしいです" — caught 2026-07-30; the EN
    // equivalent "nailed the friendly team" — 2026-07-31).
    const order = slot.attr ? attrOrder : filterTasteVoice(tailOrder, locale, [slot.text]);
    if (order.length === 0) continue;
    // Rotation keeps consecutive tails off the same template; the move check
    // then rejects one that repeats a rhetorical beat already in the review.
    const rotated = slot.attr ? order[ai++ % order.length]! : order[ti++ % order.length]!;
    let tpl = movesIn(fill(rotated, { kw: slot.text }), locale).size === 0
      ? rotated
      : pickFreshMove(order, text, locale, tailSpread, (t) => fill(t, { kw: slot.text }));
    if (usedTails.has(tpl)) {
      const fresh = order.find((t) => !usedTails.has(t));
      if (fresh) tpl = fresh; // else: pool exhausted, repeating beats dropping the phrase
    }
    usedTails.add(tpl);
    text = appendSpread(text, fill(tpl, { kw: slot.text }), cfg.glue, tailSpread, locale, name);
  }

  // Geo search phrases: one dedicated sentence each, rotated frames, never
  // merged and never article'd. The verbatim guarantee holds — they join the
  // protect list below so the length tuner cannot trim them.
  if (geoKws.length > 0) {
    const geoChoiceRng = forkRng(seed, 0x9e01);
    const geoOrder = shuffle(
      GEO_TAILS.map((t) => expandChoices(t, geoChoiceRng)),
      forkRng(seed, 0x9e02),
    );
    let gi = 0;
    for (const gkw of geoKws) {
      if (text.includes(gkw)) continue;
      const tpl = geoOrder[gi++ % geoOrder.length]!;
      text = appendSpread(text, fill(tpl, { kw: gkw }), cfg.glue, tailSpread, locale, name);
    }
  }

  // Category and service phrases: same treatment, their own frame pools. Each
  // gets one dedicated sentence, rotated, never merged into a list.
  const weaveDedicated = (phrases: string[], pool: string[], salt: number) => {
    if (phrases.length === 0) return;
    const choiceRng = forkRng(seed, salt);
    const order = shuffle(pool.map((t) => expandChoices(t, choiceRng)), forkRng(seed, salt + 1));
    let i = 0;
    for (const kw of phrases) {
      if (text.includes(kw)) continue;
      text = appendSpread(text, fill(order[i++ % order.length]!, { kw }), cfg.glue, tailSpread, locale, name);
    }
  };
  weaveDedicated(catKws, CATEGORY_TAILS[locale], 0x9e11);
  weaveDedicated(svcKws, SERVICE_TAILS[locale], 0x9e21);

  // Entity sentence goes in BEFORE the final length pass so trimming can never
  // delete it (its terms join the verbatim-protect list).
  const woven = weaveEntity(text, entity, locale, cfg, seed, rating, vertical, name);
  text = woven.text;
  const protectAll = [...shuffled, ...geoKws, ...catKws, ...svcKws, ...woven.protect];

  text = tuneLength(text, name, pool, cfg, seed, 0x302, protectAll, locale, sentenceBudget(bucket.kind));
  // Cap store-name mentions at 2 (SEO-spam tell). Skipped when a woven keyword
  // itself contains the name, so the verbatim-keyword guarantee is never broken.
  if (!protectAll.some((k) => k.includes(name))) {
    text = capStoreMentions(text, name, locale, forkRng(seed, 0xca9), vertical);
  }
  text = normalizeDashes(text);
  text = dedupeTerminators(text);
  if (locale === "en") text = capitalizeSentenceStartsEn(text, [...protectAll, name]);
  // Paragraphing decided ONCE, from the finished text. See layoutParagraphs.
  return layoutParagraphs(text, locale, forkRng(seed, 0x9a17), name);
}

/**
 * Paragraph breaks, decided once from the finished text.
 *
 * Two failure modes sit either side of this function. The old engine flipped a
 * coin between every beat and turned a 100-word review into six one-sentence
 * paragraphs (owner eye-check 2026-07-31) — the loudest bot tell in the output.
 * The fix for that overshot: a break needed 55+ words AND 4+ sentences AND a 70%
 * roll, so a typical 45-90 word review shipped as one dense wall and was hard to
 * read in the edit box (owner eye-check 2026-08-02, live Sakura gift review).
 *
 * A guest writing 6 sentences on a phone does press return once. So the gate is
 * now the length at which a block genuinely gets tiring rather than the length
 * at which it is unarguably long, breaks are the common case rather than a
 * minority roll, and a genuinely long review earns a second break. Single-block
 * output survives as real variation, not as the default.
 */
// Real Google reviews are overwhelmingly ONE block. A 45-word review with a
// paragraph break in it is already unusual; a listing where most reviews are
// split the same way is the tell. Thresholds are the floor BELOW which a break
// never happens, and the odds above it scale with length (owner note
// 2026-08-07: "改行も自然にしよう" — 48/60 reviews were exactly 2 paragraphs).
const PARA_MIN_SIZE = { en: 70, ja: 150 } as const; // never break below this
const PARA_TWO_SIZE = { en: 150, ja: 320 } as const; // three paragraphs need this
function layoutParagraphs(text: string, locale: ReviewLocale, rng: () => number, store?: string): string {
  const flat = oneLineCollapse(text.replace(/\n+/g, " "));
  if (!flat) return "";
  const size = locale === "ja" ? cjkCount(flat) : wordCount(flat);
  const parts = splitSentences(flat, locale, store);
  const min = locale === "ja" ? PARA_MIN_SIZE.ja : PARA_MIN_SIZE.en;
  if (size < min || parts.length < 3) return flat;
  // Odds of breaking at all, by length. Short reviews stay whole; only genuinely
  // long ones usually split, which is what a real listing looks like.
  const twoSize = locale === "ja" ? PARA_TWO_SIZE.ja : PARA_TWO_SIZE.en;
  const breakChance = size >= twoSize ? 0.7 : size >= min * 1.4 ? 0.45 : 0.25;
  if (rng() > breakChance) return flat;
  const joiner = locale === "ja" ? "" : " ";
  const chunk = (from: number, to: number) => parts.slice(from, to).join(joiner).trim();
  // Long enough for three paragraphs, with every one of them ≥2 sentences.
  const two = twoSize;
  if (size >= two && parts.length >= 7 && rng() < 0.3) {
    const a = Math.round(parts.length / 3);
    const b = Math.round((parts.length * 2) / 3);
    return [chunk(0, a), chunk(a, b), chunk(b, parts.length)].join(PARAGRAPH_GAP);
  }
  // Break near the middle, never orphaning the opening or closing sentence.
  const at = Math.max(2, Math.min(parts.length - 1, Math.round(parts.length / 2)));
  return `${chunk(0, at)}${PARAGRAPH_GAP}${chunk(at, parts.length)}`;
}
