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
const LEADING_DETERMINER = /^(the|a|an|my|our|your|their|its|this|that|these|those|some|any|every|no|one|two|three|\d+)\s/i;

/**
 * Title Case all the way through is a NAME ("Boston Cream", "Za'atar & Labneh",
 * "Dubai Marina"); a capital on the first word only is a common noun the owner
 * happened to sentence-case ("Hojicha latte", "Japanese tea gift set"). The old
 * uppercase-means-proper-noun rule sent the second group out bare — "What got
 * me was Hojicha latte and Japanese tea gift set" (naturalness reader,
 * 2026-08-10, 11 sentences on the live Ocha Cafe config).
 */
function looksSentenceCased(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  if (words.length < 2) return false;
  if (!/^[A-Z]/.test(words[0]!)) return false;
  // ALL-CAPS tokens are acronyms and say nothing either way ("AI SEO audit",
  // "Best V60 in Dubai"); a Title-Case word after the first is what marks a
  // real name ("Boston Cream", "Matcha Suruga RG").
  return !words.slice(1).some((w) => /^[A-Z][a-z]/.test(w));
}

/**
 * @param typedItem the owner has SAID this keyword names something orderable
 *   (stores.keyword_types = "item"), rather than the engine guessing from the
 *   string.
 *
 * Title Case on its own still means "this is a name, send it out bare" —
 * "the Dubai Marina" and "the Michelin Quality" are both wrong, and the
 * synthetic audit probes exactly that. But a Title-Cased DISH is not a name in
 * the same sense: "I loved Garlic Knots." and "Herby Chicken Caesar sealed it
 * for me." were rejected on the live Pitfire config (2026-08-18), and both
 * want "the". The two cases are indistinguishable from the string, which is
 * why the owner's declared type decides and the guess path is left alone.
 */
function withArt(phrase: string, typedItem = false): string {
  // Never double a determiner the keyword already carries. Was "the" only, so
  // the keyword "a thoughtful gift" came out as "the a thoughtful gift" on the
  // live Let It Dough! config (naturalness reader, 2026-08-10).
  if (LEADING_DETERMINER.test(phrase)) return phrase;
  if (/^[a-z]/.test(phrase)) return `the ${phrase}`;
  if (looksSentenceCased(phrase)) return `the ${phrase}`;
  return typedItem ? `the ${phrase}` : phrase;
}

/**
 * Services split in two and the article follows the split, not the type:
 * you book A scan, an audit, a setup — but "the regenerative medicine" and
 * "the worldwide shipping" are wrong, because the head is a field or an
 * activity, not a countable thing. Adding the article to every service phrase
 * fixed mirAIreach and broke Kotobuki in the same run (naturalness reader,
 * 2026-08-10) — the head noun is what decides.
 */
const MASS_NOUN_HEADS: ReadonlySet<string> = new Set([
  "medicine", "advice", "care", "support", "maintenance", "training", "coaching",
  "consulting", "guidance", "work", "content", "management", "automation",
  "hospitality", "service", "shipping", "insurance", "aftercare", "wellness",
  "nutrition", "therapy", "dentistry", "surgery", "research", "assistance",
  "visibility", "optimization", "optimisation", "exposure", "awareness",
]);

/**
 * The mirror case: a Title-Cased service name is a proper name and stays bare
 * ("HydraFacial", "IV Drip"), UNTIL its head is a generic service noun — then
 * it is one specific programme at one clinic and English wants the article:
 * "No complaints about Weight Management Programme" (naturalness reader,
 * 2026-08-10, live Kotobuki config).
 */
const NAMED_SERVICE_HEADS: ReadonlySet<string> = new Set([
  "programme", "program", "package", "plan", "check", "checkup", "treatment",
  "consultation", "session", "course", "scan", "audit", "report", "setup",
  "system", "formula", "assessment", "screening",
]);

function headIsNamedService(phrase: string): boolean {
  const last = phrase.trim().split(/\s+/).pop()!.toLowerCase().replace(/[^a-z-]/g, "");
  return NAMED_SERVICE_HEADS.has(last);
}

function headIsUncountable(phrase: string): boolean {
  const last = phrase.trim().split(/\s+/).pop()!.toLowerCase().replace(/[^a-z-]/g, "");
  // Gerunds are activities, never countable here: shipping, sizing, cleaning,
  // reporting, tailoring, detailing.
  return MASS_NOUN_HEADS.has(last) || /ing$/.test(last);
}

const BRANDED_SERVICE_HEADS: ReadonlySet<string> = new Set([
  "therapy", "drip", "facial", "infusion", "peel", "cleanse", "massage",
  "injection", "wellness", "medicine",
]);

/** Every word capitalised = the business's own name for the service. */
function isTitleCased(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  return words.length > 1 && words.every((w) => /^[A-Z0-9]/.test(w) || /^(of|and|the|for|with|in)$/i.test(w));
}

/**
 * Service frames written in VISIT voice. An agency client does not "come in
 * for" monthly reporting and a rug store does not get "booked" for worldwide
 * shipping — both read as a template wearing the wrong business (naturalness
 * reader, 2026-08-10: 12 of the 29 findings that survived two runs).
 */
const SERVICE_VISIT_VOICE = /^(Came in for|Went in for|Booked)/;

function serviceTailsFor(vertical: Vertical, locale: ReviewLocale): string[] {
  const pool = SERVICE_TAILS[locale];
  if (locale !== "en") return pool;
  if (!NON_VISIT_VERTICALS.has(vertical) && vertical !== "retail") return pool;
  const kept = pool.filter((t) => !SERVICE_VISIT_VOICE.test(t));
  return kept.length > 0 ? kept : pool;
}

function withServiceArt(phrase: string): string {
  if (LEADING_DETERMINER.test(phrase)) return phrase;
  // "the IV Therapy" is right and "the regenerative medicine" is wrong, and the
  // head noun alone cannot tell them apart — the difference is that one is the
  // clinic's NAME for one specific service. Title-casing is that signal.
  const head = phrase.trim().split(/\s+/).pop()!.toLowerCase().replace(/[^a-z-]/g, "");
  if (isTitleCased(phrase) && (BRANDED_SERVICE_HEADS.has(head) || NAMED_SERVICE_HEADS.has(head))) {
    return `the ${phrase}`;
  }
  if (headIsUncountable(phrase)) return phrase;
  if (headIsNamedService(phrase)) return `the ${phrase}`;
  return withArt(phrase);
}

/**
 * Geo / category / service phrases are deliberately left bare ("Solid choice
 * for sushi in Dubai"), but a superlative head is ungrammatical without the
 * article: "If you're after best doughnuts in Dubai". English does not allow
 * the bare form here, whatever the phrase is.
 */
const SUPERLATIVE_HEAD = /^(best|top|finest|cheapest|largest|biggest|nicest|greatest|fastest|closest|friendliest|most)\b/i;

function withSuperlativeArt(phrase: string, locale: ReviewLocale): string {
  if (locale !== "en") return phrase;
  if (LEADING_DETERMINER.test(phrase)) return phrase;
  return SUPERLATIVE_HEAD.test(phrase) ? `the ${phrase}` : phrase;
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
  // Adverb-led descriptions: the head is an adjective or participle, never a
  // thing you can "try" ("Spotlessly clean", "Freshly fried", "Highly
  // recommended"). The adjectival tail is required so "Daily specials" and
  // "Weekly menu" — real items — are not swept in with them.
  /^\w+ly\s+\w+(ed|y|ful|ous|ive|ing|ish|clean|fresh|fast|good)$/i,
  // Verdict pills an owner types as a whole clause ("Will definitely come
  // back", "You won't regret it"), which no object slot can take.
  /^(will|would|i'll|we'll|you'll|can't|cannot|must|never|always)\b/i,
  // Two adjectives joined ("Juicy and addictive", "Rich and flavorful").
  /^\w+(y|ful|ous|ive|ed|ing|ish)\s+and\s+\w+(y|ful|ous|ive|ed|ing|ish)$/i,
  // Provenance / production claims owners type as selling points: they modify
  // the business, they are not things a guest ordered ("UAE homegrown" came out
  // as "The star of the visit was the UAE homegrown, no contest." on the live
  // Let It Dough! config — naturalness reader, 2026-08-10).
  /\b(homegrown|home-grown|handmade|hand-made|family-run|family-owned|locally sourced|locally-sourced|halal|vegan|organic|gluten-free|sugar-free)$/i,
  // "Great options for drinks", "Good spot for groups": a quality-of-the-place
  // claim wearing a noun in the middle. The bare "great for X" case is already
  // the first pattern above.
  /^(great|good|excellent|nice|solid|perfect)\s+\w+\s+for\b/i,
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
/**
 * A2, the other half: a review must not say the same thing twice in its own
 * voice and then again as a keyword.
 *
 * The body pools are constant sentences about service, cleanliness, pace and
 * value — and so are half the attribute pills an owner types. When they
 * collide the review reads as a list being padded out, which is the "stack of
 * template lines" failure however grammatical each sentence is:
 *
 *   "The service was quick and friendly. I'd also point out the quick service
 *    and the cozy atmosphere."      (gate reject, 2026-08-18, demo store #52)
 *
 * So the CONSTANT slots drop any line that repeats a content word the review
 * is already committed to carrying verbatim. Deliberately narrow: whole words
 * of five letters or more, stopwords excluded, and never applied if it would
 * leave the pool with fewer than three lines — a thin pool is its own defect,
 * and this rule is not worth trading one for.
 */
const ECHO_STOPWORDS = new Set([
  "about", "after", "again", "along", "there", "their", "these", "those", "which",
  "while", "would", "could", "should", "every", "place", "spot", "store", "thing", "things",
  "really", "quite", "still", "other", "first", "great", "good",
]);
function echoWords(kws: string[]): string[] {
  const out = new Set<string>();
  for (const k of kws) {
    for (const w of k.toLowerCase().split(/[^a-z]+/)) {
      if (w.length >= 5 && !ECHO_STOPWORDS.has(w)) out.add(w);
    }
  }
  return [...out];
}
function dropKeywordEchoes(pool: string[], kws: string[], locale: ReviewLocale): string[] {
  if (locale !== "en" || pool.length < 4) return pool;
  const words = echoWords(kws);
  if (words.length === 0) return pool;
  const re = new RegExp(`\\b(${words.join("|")})\\b`, "i");
  const kept = pool.filter((t) => !re.test(t));
  return kept.length >= 3 ? kept : pool;
}

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
  // NOT `.map(withArt)`: map passes the index as the second argument, which
  // became `typedItem` and articled every phrase after the first.
  const p = phrases.filter(Boolean).map((x) => withArt(x));
  if (p.length <= 1) return p[0] ?? "";
  if (p.length === 2) {
    // Two items read best joined with "and"; a bare comma ("A, B was great")
    // looks like a clipped list. Keep an occasional "plus" for variety.
    //
    // Unless a phrase already contains "and": "the Karak and doughnuts and a
    // thoughtful gift" reads as one runaway list and the reader cannot tell
    // where the first item ends (naturalness reader, 2026-08-10, live Let It
    // Dough! config, both runs). "plus" keeps the boundary visible.
    if (p.some((x) => /\band\b/i.test(x))) return `${p[0]} plus ${p[1]}`;
    // "plus" now appears ONLY where it is doing that disambiguation work. As a
    // random 18% alternative to "and" it read as marketing copy - "I also have
    // to mention the natural ingredients plus Brulee Me Away." (gate reject,
    // 2026-08-18, live Let It Dough! config). A guest writes "and".
    return `${p[0]} and ${p[1]}`;
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
/**
 * Sentence openings that announce an addendum. Shared by the tail guard and by
 * the bench gate that measures the same thing (scripts/bench-db-stores.mjs).
 * EN only: the JA/AR additive particles are not sentence-initial.
 */
const ADDITIVE_OPEN =
  /^(also\b|and\b|plus\b|another\b|on top of that|one more thing|worth (noting|adding|flagging)|(handy|useful) too|(nice|good) to see|in the plus column|counts for something|not nothing|file this under|small detail|a (detail|point) in their favou?r|one thing i did not expect)/i;

const ATTRIBUTE_TAILS: Record<ReviewLocale | "enNegative" | "enPredicate" | "enOffering", string[]> = {
  // Single-sentence ONLY. Two-sentence templates ("{kw}。この点は大きいと思い
  // ます。") split at the terminator, and each half became its own repeated
  // refrain on stores with many attribute keywords — measured 2026-08-03 on the
  // live Tsukasa config: the bare "‹›。" half 20x/100, the constant half 11x.
  // Stores whose keyword lists are attribute-heavy draw this slot constantly,
  // so it carries choice groups like the other hot slots.
  // 🔑 A1 (owner decision 2026-08-18). This pool was 26 frames and 22 of them
  // were colon asides ("Another plus: X.") or verbless addenda ("Handy too: X.",
  // "No complaints about X either."). Both shapes are on the owner's fail list,
  // and the colon aside is the one they named twice from live output.
  //
  // Deleting without replacing was not an option here, unlike everywhere else:
  // an attribute pill is a verbatim guarantee, so an empty pool would DROP a
  // keyword the guest tapped. The replacements all put the pill in an OBJECT
  // position after a finite verb, which is the only position that survives
  // every pill shape we actually see in live configs — a bare noun phrase
  // ("good value"), a compound ("English-speaking staff") and a whole clause
  // ("no pressure to buy") all read the same after "mention" or "credit for".
  // The pill still never STARTS the sentence: it is verbatim-protected, so the
  // capitaliser leaves it lower-case and the sentence would open in lower case.
  // EN attribute pills come in three grammatical shapes and they do NOT share a
  // frame. The colon appositive used to hide that — "Another plus: X." takes a
  // noun phrase, an adjective and a whole clause without complaint, which is
  // exactly why it was there. With colons gone (A1) the shapes have to be told
  // apart, or the pill lands in an object slot without its article: 26 of the
  // 64 demo-store combinations were rejected for "I should mention cozy
  // atmosphere too." on the first exhaustive run (2026-08-18).
  //
  // en          — quality NOUN phrases ("cozy atmosphere", "quick service").
  //               The pill arrives already carrying "the" (withArt), so these
  //               are ordinary object-position sentences.
  // enNegative  — pills that are a negative clause ("no pressure to buy", "no
  //               artificial colors"). They take no article and cannot follow
  //               a copula; they need an existential to sit in.
  // enPredicate — pills that are adjectival or a provenance claim ("family
  //               friendly", "locally sourced", "perfect for gifts"). They ARE
  //               the predicate, so a copula is the only thing that fits.
  en: [
    "I also have to mention {kw}.",
    "I should mention {kw} too.",
    "It's worth mentioning {kw} as well.",
    "I'd also point out {kw}.",
    "They deserve credit for {kw} too.",
    "I have to give them credit for {kw}.",
    "They get points for {kw} as well.",
    "I appreciated {kw} too.",
    "One thing I didn't expect was {kw}.",
    "I rate them for {kw} as well.",
    "I noticed {kw} straight away.",
    "The other thing I'd flag is {kw}.",
  ],
  // Negative pills already carry their own determiner, so they need the SAME
  // object-position frames as the noun family, just without withArt. Not an
  // existential ("There was {kw}."): a negative pill can be plural ("no
  // artificial colors") and the copula would have to agree with something the
  // engine cannot see. The mention verbs are number-neutral.
  // Perception verbs ONLY — notice/see, not like/appreciate. Under a liking
  // verb the negation flips scope ("I liked no artificial colors" = liked
  // nothing) and under a copula it equates ("What I liked most was no
  // artificial colors" — gate reject, both runs, 2026-08-31, live Let It
  // Dough! config; same family as the "I also have to mention" reject of
  // 2026-08-18). A negative pill is something a guest NOTICED or was relieved
  // to see; the frames say only that. Still number-neutral - "there is/are no
  // artificial colors" would have to agree with a noun the template cannot see.
  enNegative: [
    // "You can tell they take {kw} seriously." was here for a day and got
    // rejected by both gate runs on "no pressure to buy" (2026-09-01, Cinar
    // Cappadocia #15): "take no pressure to buy seriously" parses as taking
    // no pressure. A clause-shaped negative pill cannot sit inside another
    // verb phrase; only see/notice frames hold for every negative shape.
    "I noticed {kw} straight away.",
    "I was glad to see {kw}.",
    "It was nice to see {kw}.",
    "I was happy to see {kw}.",
    "Seeing {kw} was reassuring.",
  ],
  // Number-neutral on purpose: an offering pill is routinely plural ("Great
  // options for drinks") and routinely Title-cased by the owner, so nothing
  // here may agree with it or re-case it.
  enOffering: [
    "They also have {kw}.",
    "They have {kw} as well.",
    "I should mention they have {kw}.",
    "It's worth knowing they have {kw}.",
    "They cover {kw} too.",
    "I'd also point out that they have {kw}.",
  ],
  enPredicate: [
    "It's also {kw}.",
    "The place is also {kw}.",
    "I'd add that it's {kw}.",
    "It is {kw} as well.",
    "It's {kw} too, which matters to us.",
    "One more thing I noticed is that it's {kw}.",
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

/**
 * Islands take "on", not "in" — "a Japanese tea house in Al Maryah Island"
 * (naturalness reader, 2026-08-10, 9 sentences on the live Ocha Cafe config,
 * whose whole address IS an island). The entity templates hardcode "in", so
 * the swap happens after the fill, keyed on the location name itself.
 */
function fixLocPreposition(text: string, loc: string): string {
  if (!/\bislands?$/i.test(loc.trim())) return text;
  const esc = loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp("\\b([Ii])n (" + esc + ")", "g"), (_m, i, l) => `${i === "I" ? "O" : "o"}n ${l}`);
}

function fillEntity(tpl: string, loc: string, cat: string): string {
  const filled = fixLocPreposition(tpl.replace(/\{loc\}/g, loc).replace(/\{cat\}/g, cat), loc);
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
  en: /\b(go for|definitely try|don't skip|save room|go hungry|big yes|come for|did not miss)\b|\bask about\b|\byou'll want to ask\b|\bnailed\b|\bstar of the visit\b|\bno contest\b|\bbig fan of\b|\bunderrated\b|\bstarting with\b|\bkeep an eye out for\b|\bmake a fuss about\b|\bloved\b|\bso good\b|\bgo see\b|bringing {people|friends|visitors}|sort out|half the battle|time to spare|hour to kill|popped into|more or less by chance|quick stop|celebration|celebrate|visiting from abroad/i,
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

/**
 * Shops sell things other people made. The generic pools carry two voices that
 * only fit a place that PRODUCES what you consume: kitchen credit ("1004
 * Gourmet nailed the wasabi paste." — they stock it, they did not make it) and
 * table service ("The person looking after us missed nothing, without writing
 * any of it down." — nobody takes your order in a rug store). Occasion voice
 * lands wrong too: "We chose Cinar Rugs Dubai for a small celebration."
 * All three were flagged by the naturalness reader on the live Cinar and 1004
 * configs (2026-08-10) with every structural gate green — the same shape of
 * defect the medical filter above was built for, one vertical over.
 *
 * EN only, on purpose. JA/AR retail pools have not been read by a native
 * speaker, and those locales are not currently offered to guests (see
 * lib/guest-locales) — inventing patterns for output nobody reads would be
 * guessing dressed up as coverage.
 */
const RETAIL_VERTICALS: ReadonlySet<Vertical> = new Set<Vertical>(["retail"]);

const RETAIL_UNFIT_EN =
  /\bnailed\b|\bcome hungry\b|\bsave room\b|\bfirst bite\b|\btasted\b|\bthe meal\b|celebration|celebrate|without writing any of it down|\bgo see\b|\bthe rotation\b|\bmy usual spots\b|\bmy regular list\b|\bloved\b|\bgo for\b|turned out even better|\bfull day of errands\b|\bnew regular in me\b|\banother good one from\b|\beasy to settle in\b/i;

function filterRetailVoice(pool: PoolSet, locale: ReviewLocale, vertical: Vertical): PoolSet {
  if (locale !== "en" || !RETAIL_VERTICALS.has(vertical)) return pool;
  const strip = (arr: string[]) => {
    const kept = arr.filter((t) => !RETAIL_UNFIT_EN.test(t));
    return kept.length > 0 ? kept : arr; // an empty slot would break assembly
  };
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
  // A1 (2026-08-18): this sentence appears in EVERY review, so it is the most
  // -read frame on a store's page — and half the pool was verbless ("Solid rug
  // store right in the Grand Bazaar.", "Handy spot if you're in X and after a
  // Y.", "A rug store in X that actually delivers."). Verbless frames get their
  // subject back rather than being deleted, for the same reason as
  // SERVICE_TAILS: one frame per review means a thin pool becomes a refrain.
  // The frame that OPENED with {loc} is gone outright — {loc} is verbatim
  // -protected, so capitalizeSentenceStartsEn leaves it alone and the sentence
  // shipped in lower case ("the Grand Bazaar was missing a rug store like
  // this." — 2026-08-18 baseline read, review 14).
  en: [
    "This is my {go-to|first-choice} {cat} in {loc} now.",
    "I'm glad to have this {cat} {in|here in|right in} {loc}.",
    "If you're {near|around|anywhere near} {loc}, this is the {cat} to try.",
    "It's a {solid|dependable|quality} {cat} right in {loc}.",
    "It's {good|great|reassuring} to have a {cat} like this {around|near} {loc}.",
    "It's a handy {spot|place|stop} if you're {in|around} {loc} and after a {cat}.",
    "I didn't expect to find a {cat} {this good|of this standard|this solid} in {loc}.",
    // "a proper X" is British-marked as an intensifier; a US reader hears it
    // as foreign. Neutral branches only (owner note 2026-08-07).
    "It's a {real|genuinely good|seriously good} {cat}, right here in {loc}.",
    "We're {lucky|fortunate|glad} to have this {cat} in {loc}.",
    "If you {live|work|spend time} around {loc}, keep this {cat} {on your list|in mind|bookmarked}.",
    "It was a nice surprise to {come across|find|stumble on} a {cat} like this in {loc}.",
    "It's the {cat} I'll be choosing whenever I'm {in|around|passing through} {loc}.",
    "Anyone around {loc} should give this {cat} a {look|try|chance}.",
    "This will be our {regular|default|usual} {cat} whenever we're in {loc}.",
    "It's a {cat} in {loc} that actually {delivers|comes through|holds up}.",
    "I'm happy to finally have a {decent|good|solid} {cat} close by in {loc}.",
    "You don't come across a {cat} like this in {loc} {every day|often|all that often}.",
    "I ended up here {looking|hunting|searching} for a {cat} in {loc} and {got lucky|struck gold|found a keeper}.",
    "{Of|Among} the {cat} options {in|around} {loc}, this is the one I'd {pick again|go back to|stick with}.",
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
    "They're the best {cat} we've {worked with|dealt with|hired} in {loc}.",
    "If you {need|are looking for|are hunting for} a {cat} in {loc}, {start here|this is the place to start|look here first}.",
    "They're the {cat} I'd {recommend|point out|suggest} to {anyone|any owner|any business} in {loc}.",
    "I'm glad we {found|came across|landed on} a {cat} like this in {loc}.",
    "They're a {reliable|dependable|trustworthy} {cat} for anyone {based|operating|doing business} in {loc}.",
    "It's hard to find a {better|more reliable|more straightforward} {cat} in {loc}.",
    "For a business in {loc}, having a {cat} you can {trust|rely on|count on} matters, and this is one.",
    "We compared a few {cat} options in {loc} and landed here, {no regrets|glad we did|good call}.",
    "They're a {cat} in {loc} that {does what it says it will|delivers what it promises|keeps its word}.",
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
    "It's great to have them working in {loc}.",
    "They're worth knowing about if you're based in {loc}.",
    "They're a real asset for businesses in {loc}.",
    "If your company operates around {loc}, keep them in mind.",
    "Being local to {loc} makes working with them easy.",
    "There are plenty of options in {loc}, but these are the ones we stayed with.",
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
    "They're exactly what you want from a {cat}.",
    "They're one of the better {cat} options out there.",
    "They're a {cat} that communicates clearly and delivers on time.",
    "They're the rare {cat} that makes things simpler, not more complicated.",
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
    "It's worth the {trip|drive|detour} out to {loc}.",
    "It's a great addition to {loc}.",
    "If you're around {loc}, stop by.",
    "It's nice to have a place like this in {loc}.",
    "It's one more reason to like {loc}.",
    "It's handy if you work around {loc}.",
    "We were in {loc} anyway and I'm glad we {stopped|came in|made the stop}.",
    "Being in {loc} makes it an easy stop for us.",
    "It's easy to get to if you're in {loc}.",
    "Anyone living in {loc} should know about it.",
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
    "It's {exactly|pretty much} what a good {cat} should be.",
    "It's one of the better {cat} options {around|in the area|I've come across}.",
    // "by people who care" dropped 2026-09-01: it collided with the filler
    // "It's clearly run by people who care about what they do" inside one
    // review, and the pruned pools make that draw more likely.
    "You can tell this {cat} is run {with care|properly}.",
    "It's the kind of {cat} {you want to find|that's easy to recommend}.",
    "As far as a {cat} goes, this one {gets it right|has it sorted|does it properly}.",
    "This {cat} {does the simple things properly|gets the basics right|takes the details seriously}.",
    "It was {good|nice|reassuring} to find this sort of {cat}.",
    "It's the sort of {cat} you can {trust|rely on|recommend without hesitating}.",
    "There's {nothing|not much} I'd change about this {cat}.",
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
 * An English review must not carry a Japanese place name. entity_area is a
 * single text column (only entity_category_label is per-locale), so a Kumamoto
 * sushi bar published "Nice surprise to come across a sushi restaurant like
 * this in 渡鹿." on its EN tab — 39 sentences across the two Japan stores
 * (naturalness reader, 2026-08-10).
 *
 * Dropping the location is the honest fallback: the entity sentence falls back
 * to the category-only pool, so the review still says WHAT the place is, just
 * not where. The real fix is a per-locale area field (same shape as
 * entity_category_label) — that needs a migration and an owner-facing input,
 * and printing another script at a guest until then is the worse of the two.
 */
const SCRIPT_ALIEN_TO: Record<ReviewLocale, RegExp> = {
  // CJK, Hangul, Arabic, Cyrillic: anything an English reader cannot read.
  en: /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0400-\u04FF]/,
  ja: /[\u0600-\u06FF]/,
  ar: /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/,
};

function readableLocation(value: string | null, locale: ReviewLocale): string | null {
  if (!value) return null;
  return SCRIPT_ALIEN_TO[locale].test(value) ? null : value;
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
  const area = readableLocation(entity?.area?.trim() || null, locale);
  const city = readableLocation(entity?.city?.trim() || null, locale);
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

/** Micro-openers that promise a short review (EN / JA / AR). */
const BREVITY_OPENER = /^(short version|quick note|一言だけ|短めに|باختصار|ملاحظة سريعة)/i;

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
  if (pool.microOpeners.length > 0 && rMicro() < 0.11) {
    // A micro-opener that ANNOUNCES brevity contradicts the review it opens
    // when that review then runs five to eight sentences — owner-caught
    // 2026-08-13 on live output: "Short version: Stopped by ..." followed by
    // five sentences. Which openers do that is a property of the phrase, not
    // of the pool, so brevity-declaring openers go on COMPACT reviews only and
    // the rest keep the long ones (before this they were long-only, which is
    // exactly backwards).
    const fits = pool.microOpeners.filter((m) => BREVITY_OPENER.test(m.trim()) === compact);
    if (fits.length > 0) {
      // On a compact review the brevity opener REPLACES the bridge instead of
      // adding to it. Adding it kept the promise honest but pushed the review
      // to six sentences, and the bench's bottom-heavy-wall count rose with it
      // (2026-08-13). A short review that opens "Quick note." and then runs six
      // sentences is the same contradiction in a smaller size.
      const trimmed = compact && bridge ? segments.filter((x) => x !== bridge) : segments;
      segments = [pick(fits, rMicro), ...trimmed];
    }
  }
  return weaveParagraphs(segments.filter(Boolean), forkRng(seed, 0x108), compact, cfg.glue);
}

/**
 * The skeleton for a review whose CORE slot has no keyword.
 *
 * It used to be three picks: a short opener, one of five noKeywordMid lines,
 * a short closer. That was sized for the rare store with no keywords at all.
 * Keyword TYPES (2026-08-09) changed who lands here: a clinic whose keywords
 * are all "service", or an agency whose keywords are all "service", routes
 * every phrase to a dedicated tail and arrives with an EMPTY core — so this
 * path became the skeleton of EVERY review for those stores, and five lines
 * turned into a refrain. Measured 2026-08-10 once the bench started feeding
 * real types: one sentence in 22 of every 100 Kotobuki reviews, 150 distinct
 * sentences per 100 mirAIreach reviews against a floor of 200.
 *
 * The fix is not more noKeywordMid lines, it is using the pools a keyworded
 * review already uses — openers, fillers, bridges and closers are large and
 * were sitting unused on this path. pickFreshMove keeps the four slots from
 * making the same rhetorical move twice.
 */
function reviewNoKeywords(
  store: string,
  pool: PoolSet,
  cfg: LocaleCfg,
  seed: number,
  locale: ReviewLocale = "en",
): string {
  const render = (t: string) => fill(t, { store });
  const openerPool = [...pool.openersLong, ...pool.openersShort];
  const opener = render(pick(openerPool, forkRng(seed, 0x201)));

  // noKeywordMid stays first in the pool: those lines were written for exactly
  // this shape of review. The fillers join them so the slot has depth.
  const midPool = [...pool.noKeywordMid, ...pool.fillers];
  const mid = midPool.length
    ? render(pickFreshMove(midPool, opener, locale, forkRng(seed, 0x204), render))
    : "";

  const bridgePool = [...pool.bridgesLong, ...pool.bridgesShort];
  const bridge = bridgePool.length
    ? render(pickFreshMove(bridgePool, `${opener} ${mid}`, locale, forkRng(seed, 0x205), render, false))
    : "";

  const closerPool = [...pool.closersLong, ...pool.closersShort];
  const closer = render(
    pickFreshMove(closerPool, `${opener} ${mid} ${bridge}`, locale, forkRng(seed, 0x202), render),
  );

  // Same ordering freedom a keyworded review has, so the bridge is not always
  // the third sentence on a page where every review takes this path.
  const bridgeFirst = forkRng(seed, 0x206)() < 0.41;
  const parts = bridgeFirst ? [opener, bridge, mid, closer] : [opener, mid, bridge, closer];
  const t = parts.map(oneLineCollapse).filter(Boolean).join(PARAGRAPH_GAP);
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
      // The mirror-image error, and the one that actually shipped: "them" is an
      // OBJECT pronoun. It reads right after a preposition ("we'll stay with
      // them") and is ungrammatical as a subject — "Them will be handling our
      // online side for the foreseeable future." went out on the live
      // mirAIreach config (gate reject, 2026-08-18). Where the slot is a
      // subject, use a noun phrase.
      if (locale === "en" && sub === "them" && !/\b(to|at|in|with|from|near|about|of|for|than)\s*$/i.test(before)) {
        sub = "the team";
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
/**
 * A frame like "Glad I finally tried {store}." with a store name that ends in
 * "!" yields "Let It Dough!." — dedupeTerminators keeps only the "!",
 * destroying the evidence that a sentence really ended there, and
 * capitalizeSentenceStartsEn then refuses to touch the next word because the
 * "!" sits inside the protected store name (mid-sentence "Came to Let It
 * Dough! for the first time" must stay lowercase — 2026-07-29). So the
 * boundary is repaired HERE, while the frame's own "." still marks it:
 * capitalize the next word unless it opens a verbatim-protected lowercase
 * phrase (the verbatim guarantee outranks capitalization). The "." is
 * consumed either way. Live repro: "Glad I finally tried Let It Dough! the
 * birthday doughnut box won me over." (2026-09-01).
 */
function capitalizeAfterBangPeriodEn(text: string, protect: readonly string[]): string {
  const lowerProtected = protect.filter((p) => p && /^[a-z]/.test(p));
  return text.replace(
    /([!?])\.(\s+)([a-z])/g,
    (_m, bang: string, gap: string, ch: string, offset: number) => {
      const tail = text.slice(offset + 2 + gap.length);
      const opensProtected = lowerProtected.some((p) => tail.startsWith(p));
      return `${bang}${gap}${opensProtected ? ch : ch.toUpperCase()}`;
    },
  );
}

/**
 * Owner feedback 2026-09-01: "普通はこういう風に書かない" — a short-bucket
 * review was six standalone verdict sentences in a row ("Glad I finally tried
 * Let It Dough! The birthday doughnut box won me over. Everything ran
 * smoothly. …"), which is also what the naturalness judge keeps calling a
 * "stack of taglines". People connect those thoughts: "The birthday doughnut
 * box won me over, and everything ran smoothly." This pass joins up to two
 * adjacent SHORT sentences with ", and" under conservative guards:
 *   - both sentences ≤ 65 chars and the pair ≤ 110, so long lines never run on
 *   - the first must end in "." (never across a real "!" / "?")
 *   - the second must open with a safe lowerable subject (The/It/They/I/…) —
 *     a sentence opening with a verbatim keyword or proper noun is left alone
 *   - neither half may already contain an ", and"/", but" of its own
 *   - a terminator inside a protected phrase ("Let It Dough!") is not a
 *     sentence break, so those boundaries are never touched
 */
const CONJOIN_SUBJECT_EN =
  /^(The|It|They|We|I|Everything|Everyone|Staff|Prices?|Service|There|This|That|Nothing)\b/;
function conjoinShortSentencesEn(text: string, protect: readonly string[], rng: () => number): string {
  const paragraphs = text.split(/\n{2,}/);
  const out = paragraphs.map((para) => {
    const inProtected = new Uint8Array(para.length);
    for (const p of protect) {
      if (!p || !/[.!?]/.test(p)) continue;
      let from = 0;
      for (;;) {
        const at = para.indexOf(p, from);
        if (at === -1) break;
        for (let i = at; i < at + p.length && i < para.length; i++) inProtected[i] = 1;
        from = at + p.length;
      }
    }
    const parts: string[] = [];
    let start = 0;
    for (let i = 0; i < para.length; i++) {
      if (/[.!?]/.test(para[i]!) && !inProtected[i] && para[i + 1] === " ") {
        parts.push(para.slice(start, i + 1));
        start = i + 2;
      }
    }
    if (start < para.length) parts.push(para.slice(start));

    let merges = 0;
    const joined: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i]!, b = parts[i + 1];
      const eligible =
        merges < 2 && b !== undefined &&
        a.endsWith(".") && a.length <= 65 && b.length <= 65 && a.length + b.length <= 110 &&
        CONJOIN_SUBJECT_EN.test(b) &&
        // Either half already carrying a comma or an "and" (its own clause,
        // a list, or a keyword like "Karak and doughnuts") would turn the
        // merge into a run-on / and-chain — audit:reviews caught 5 crammed
        // sentences on the first, looser version of this guard.
        !a.includes(",") && !b.includes(",") &&
        !/\band\b/i.test(a) && !/\band\b/i.test(b) &&
        rng() < 0.55;
      if (eligible) {
        // "I" keeps its capital; the other safe subjects lowercase cleanly.
        const keepsCase = b!.startsWith("I ") || b!.startsWith("I'");
        const bAdj = keepsCase ? b! : b![0]!.toLowerCase() + b!.slice(1);
        joined.push(`${a.slice(0, -1)}, and ${bAdj}`);
        merges++;
        i++;
      } else {
        joined.push(a);
      }
    }
    return joined.join(" ");
  });
  return out.join(PARAGRAPH_GAP);
}

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

/**
 * Quality adjective in front of a service / price / room noun — "good value",
 * "quick service", "friendly staff", "cozy atmosphere". These are ATTRIBUTES,
 * but they are SHAPED like a noun phrase, so every attribute pattern above
 * (adjective phrases, clauses, verdicts) misses them and they land in the
 * "item" leftover pile — the object slot for things you order. Live output on
 * an untyped store, owner-caught 2026-08-13: "Come for the good value.",
 * "The good value, so good.", "Underrated: the good value."
 *
 * Both halves stay CLOSED lists: a small quality-adjective set, and the
 * non-consumable noun list that already exists for taste-voice filtering. A
 * real dish keeps its item voice because its head noun is not in that list
 * ("great coffee", "fresh doughnuts", "premium doughnuts").
 *
 * EN only — JA has its own predicate detector, and AR has no attribute slot
 * (ATTRIBUTE_TAILS.ar is empty), so returning "attribute" there would drop the
 * phrase into a tail pool that does not exist.
 */
const QUALITY_ADJ_EN =
  /^(good|great|excellent|nice|solid|quick|fast|prompt|speedy|friendly|welcoming|warm|attentive|helpful|polite|professional|clean|spotless|tidy|cozy|cosy|comfortable|relaxed|calm|quiet|spacious|convenient|easy|reasonable|fair|affordable|cheap|honest|transparent|efficient|smooth|ample|free)\b/i;

/**
 * Which of the three EN attribute frame families a pill belongs to, and how the
 * pill itself has to be rendered. See the note above ATTRIBUTE_TAILS.
 *
 * "There was {kw} at any point." only reads right for a negative pill, which is
 * why the family is chosen by the pill and not by the seed.
 */
type AttrShape = "noun" | "negative" | "predicate" | "offering";
const NEGATIVE_PILL = /^(no|not|zero|without)\b/i;
// "Great options for drinks", "Good spot for groups": a quality adjective, a
// NOUN, then "for". The noun is the head, so the business HAS it — it is not
// what the business IS. Without this they fell in with "great for groups" and
// took a copula: "It is Great options for drinks as well." (gate reject,
// 2026-08-18, live Let It Dough! config).
const OFFERING_PILL = /^(great|good|excellent|nice|solid|perfect)\s+\w+\s+for\b/i;
function attributeShape(kw: string): AttrShape {
  const t = kw.trim();
  if (NEGATIVE_PILL.test(t)) return "negative";
  if (OFFERING_PILL.test(t)) return "offering";
  if (isQualityNounPhrase(t)) return "noun";
  // A bare noun phrase the quality-adjective test does not recognise ("English
  // -speaking staff", "worldwide shipping", "heirloom quality") still needs an
  // article, not a copula: "It's also worldwide shipping." is not English.
  // Adjectival and provenance pills are the ones isAttributeShaped catches.
  return isAttributeShaped(t, "en") ? "predicate" : "noun";
}

function isQualityNounPhrase(kw: string): boolean {
  const t = kw.trim();
  if (!/^[\x20-\x7E]+$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  return QUALITY_ADJ_EN.test(t) && NON_CONSUMABLE_EN.test(t);
}

export function classifyKeyword(
  kw: string,
  types: KeywordTypeMap | undefined,
  locale: ReviewLocale,
): KeywordType {
  const explicit = types?.[kw.trim()];
  if (explicit && KEYWORD_TYPES.has(explicit)) return explicit;
  if (isGeoPhrase(kw)) return "geo";
  if (isAttributeShaped(kw, locale)) return "attribute";
  if (locale === "en" && isQualityNounPhrase(kw)) return "attribute";
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
    // Pool size is a diversity constraint, not padding: a store with three
    // category keywords emits three of these per review, so 100 reviews draw
    // 300 times from this pool. At 8 templates "They know their ‹›." landed
    // 23 times per 100 against a cap of 12 (bench, 2026-08-10, once real
    // keyword types were fed in). Every frame carries a choice group for the
    // same reason. Number-neutral throughout: the slot takes a plural class
    // and a mass noun alike, so any is/was here is a grammar error on half
    // the stores.
    // A1 (2026-08-18): the verbless half of this pool is gone ("Good range of
    // X.", "Plenty of X to choose from.", "No shortage of X here.") along with
    // the one colon frame ("That is what I keep coming here for: X."). The
    // survivors already had a subject and a verb; three got their dropped
    // subject back rather than being deleted, because this pool fires once per
    // category keyword and a store can carry several.
    "They {know|really know} their {kw}.",
    "This is where I'll be {going|coming} for {kw}.",
    "They have plenty of {kw} to {choose from|pick from}.",
    "They clearly {care about|take pride in} their {kw}.",
    "If you are after {kw}, they have you {covered|sorted}.",
    "You can tell they {focus on|specialize in} {kw}.",
    "I have no {complaints|notes} about their {kw}.",
    "They carry a good {variety|range} of {kw}.",
    "Not many places do {kw} {this well|properly}.",
    "They do {genuinely|really} good {kw} here.",
    "They had what I was looking for in their {kw}.",
    "I came for {kw} and {found exactly that|was not disappointed}.",
    "I would {come back|make the trip} for the {kw} alone.",
    "They are {a step above|ahead of most} when it comes to {kw}.",
    "I couldn't {fault|criticize} their {kw}.",
    "They keep a {solid|strong} {lineup|selection} of {kw}.",
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
    // A1 (2026-08-18): verbless frames rewritten with their subject rather than
    // deleted — a clinic or an agency routes EVERY keyword through this pool,
    // so cutting it in half would leave one frame carrying the page.
    "I came in for {kw} and they {explained the process properly|walked me through it step by step|made it clear from the start}.",
    "They took the time to explain {kw} before anything {started|began}.",
    "I have no {complaints|concerns} about {kw}.",
    "If you're {considering|looking into} {kw}, this is a {sensible|solid} place to start.",
    "I was happy with how they handled {kw}.",
    "The follow-up after {kw} was {thorough|genuinely good}.",
    "It was a {straightforward|smooth} experience with {kw}.",
    "I went in for {kw} and left knowing exactly what {had been done|to expect next}.",
    "Nothing about {kw} felt rushed.",
    "They answered every question I had about {kw}.",
    "They were {clear|honest} about what {kw} would and would not do.",
    "I booked {kw} and the whole thing ran {on time|to schedule}.",
    "It was {simple|easy} to get started with {kw}.",
    "They were {upfront|clear} about {kw} from the start.",
    "There were {no surprises|no hold-ups} with {kw}.",
    "Everything about {kw} was {explained in plain terms|easy to follow}.",
    "I'm {glad|happy} I went to them for {kw}.",
    "They made {kw} straightforward.",
    "I would go back to them for {kw}.",
    "They knew what they were doing with {kw}.",
    "Their pricing for {kw} was {fair|sensible}.",
    "They delivered {kw} without any delays.",
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
  // A1 (2026-08-18): the verbless frames are gone — "Solid choice for X.",
  // "My go-to for X now.", "Sets the bar for X.", "Top of my list for X.",
  // "Worth the trip for X.", "The one I keep recommending for X.", "Exactly
  // what I needed for X." Every survivor has a subject and a finite verb.
  "This is a {solid|reliable} choice for {kw}.",
  // "As far as X goes" forces singular agreement, and keywords are routinely
  // plural ("naturally dyed rugs") -> "As far as ... rugs in Cappadocia goes"
  // is a visible grammar error (owner read-through 2026-08-07). "When it comes
  // to X" is agreement-free.
  "When it comes to {kw}, this is {the place|the spot|the one to know}.",
  "For {kw}, this is {my pick|the spot|where I'd send people}.",
  "If you're after {kw}, {this is it|look no further|start here}.",
  "This is my {go-to|first stop} for {kw} now.",
  "You won't {do|find} much better for {kw}.",
  "They set the {bar|standard} for {kw}.",
  "When someone asks about {kw}, this is {my answer|the name I give|where I point them}.",
  // "Ticks the boxes" is British-marked; "checks" reads neutral to a US ear.
  // Pitfire's management is a US native speaker (owner note 2026-08-07).
  // "Checks all the boxes FOR X" wants X to be a need or an occasion ("for a
  // family dinner"). Store keywords are product+place phrases ("pizza in
  // Dubai"), which makes the "for" reading abstract and slightly off. The
  // conditional frame takes any noun phrase (owner questioned it twice:
  // 2026-08-07, first as "Ticks every box for natural dye rugs in Cappadocia").
  "If you're {after|looking for} {kw}, this {checks every box|checks all the boxes}.",
  "For {kw}, I would {start here|look here first}.",
  "They're top of my list for {kw}.",
  "Anyone {hunting|searching} for {kw} should {look here|start here}.",
  "That {ended|settled} my search for {kw}.",
  "I'd {bookmark|save|note} {this one|this place} for {kw}.",
  "Whenever someone asks about {kw}, I {point them here|send them here}.",
  "I stopped {looking|searching} for {kw} once I found this place.",
  "It's worth going to them for {kw}.",
  "They were {exactly|just} what I needed for {kw}.",
  // "They're the one I recommend" clashed they(plural)/one(singular) — gate
  // reject run B, 2026-09-01, live 1004 Gourmet. "the place" is number-safe.
  "This is the place I recommend for {kw}.",
  "They're worth the trip if you want {kw}.",
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
/**
 * "Is this phrase written in Latin script?" — NOT "is it ASCII".
 *
 * The ASCII test dropped every accented menu name from English reviews:
 * "Brûlée Me Away" vanished from 60 of 60 Let It Dough! drafts, so a guest
 * who tapped it published a review that never mentions it. Dubai menus are
 * full of these (crème, jalapeño, açaí, Zaʼatar), and the guarantee the
 * product sells is that the tapped phrase appears verbatim.
 *
 * What the callers actually mean is "a reader of this locale can read it",
 * so the test is by SCRIPT: Latin (with diacritics) passes, CJK / Hangul /
 * Arabic / Cyrillic / Hebrew / Greek / Thai do not.
 */
const NON_LATIN_SCRIPT =
  /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

const isLatinText = (k: string): boolean => !NON_LATIN_SCRIPT.test(k);

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
      if (!isLatinText(k)) return;
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
      if (t && t !== "item" && isLatinText(k)) return;
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
    filterRetailVoice(
      filterMedicalVoice(resolvePoolSet(locale, vertical), locale, vertical),
      locale,
      vertical,
    ),
    forkRng(seed, 0xc401ce),
  );
  const name =
    store.trim() ||
    (locale === "ja" ? "こちらのお店" : locale === "ar" ? "هذا المكان" : "this establishment");
  const allKeywords = [...new Set(kws.map((k) => k.trim()).filter(Boolean))];
  // Constant slots only. The keyword slots have to carry the keyword; it is the
  // BODY that must not say it a second time in its own words.
  for (const slot of ["bridgesLong", "bridgesShort", "fillers", "noKeywordMid"] as const) {
    pool[slot] = dropKeywordEchoes(pool[slot], allKeywords, locale);
  }

  if (allKeywords.length === 0) {
    const cfg0 = { ...LOCALE_CFG[locale], ...pickLenBucket(locale, seed, rating, 0) };
    let t0 = reviewNoKeywords(name, pool, cfg0, seed, locale);
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
  // Only an EXPLICIT type counts here. classifyKeyword falls back to a guess
  // for an untyped store, and the guess must not be allowed to put an article
  // in front of a proper name.
  const isDeclaredItem = (k: string) => (keywordTypes?.[k.trim()] ?? "") === "item";
  const geoAll = locale === "en" ? keywords.filter((k) => typeOf(k) === "geo") : [];
  // Each geo phrase gets its own dedicated sentence, and nothing capped how
  // many. Cinar Istanbul types eight of them, the guest picker has no
  // selection limit, and a guest who taps them all published a review made of
  // eight "<what> in <where>" sentences — a keyword list, not a review, and
  // two of the geo frames landed 14x per 100 on the store's page (bench,
  // 2026-08-10). Two dedicated sentences max; the rest still appear verbatim
  // through the ordinary tails. The window rotates with the seed so the page
  // shows every search phrase across reviews instead of the same first two.
  const GEO_SENTENCE_CAP = 2;
  const geoOffset = geoAll.length ? Math.floor(forkRng(seed, 0x6e00)() * geoAll.length) : 0;
  const geoKws =
    geoAll.length <= GEO_SENTENCE_CAP
      ? geoAll
      : Array.from({ length: GEO_SENTENCE_CAP }, (_, i) => geoAll[(geoOffset + i) % geoAll.length]!);
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
  // Owners routinely type overlapping phrases ("72-hour dough" AND "72-hour
  // artisan dough"). Side by side in one list sentence they read as a stutter:
  // "I came in curious about the 72-hour dough and the 72-hour artisan dough
  // and left convinced." (gate reject, 2026-08-18, live Pitfire config). Both
  // still appear verbatim - the second leaves through an ordinary tail, a
  // sentence away, where the overlap is invisible.
  const contentWords = (k: string) =>
    new Set(k.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5));
  const coreKws: string[] = [];
  for (const cand of coreNouns) {
    if (coreKws.length >= coreCount) break;
    const cw = contentWords(cand);
    const overlaps = coreKws.some((chosen) => {
      for (const w of contentWords(chosen)) if (cw.has(w)) return true;
      return false;
    });
    if (!overlaps) coreKws.push(cand);
  }
  const longPhrases =
    coreKws.reduce((n, k) => n + k.length, 0) > 90 ||
    coreKws.some((k) => k.split(/\s+/).length > 5);
  // A short-bucket review needs the compact template set (short openers/cores/
  // closers) or the assembled baseline alone overshoots the bucket ceiling.
  const compact = longPhrases || bucket.kind === "short";

  // Every keyword is attribute-shaped → no noun exists for the core sentence.
  // Build the keyword-free skeleton instead; the tails carry all the phrases.
  // Pre-shape the core phrases so the declared type reaches the {list} slot:
  // joinListEn would otherwise run the guess-only withArt and send a typed
  // dish out bare. withArt is idempotent, so running again inside joinListEn
  // changes nothing.
  const coreDisplay =
    locale === "en" ? coreKws.map((k) => withArt(k, isDeclaredItem(k))) : coreKws;
  let text =
    coreKws.length === 0
      ? reviewNoKeywords(name, pool, cfg, seed, locale)
      : buildInner(name, coreDisplay, pool, cfg, compact, seed, locale);
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
  const slots: { text: string; attr: boolean; n: number; shape?: AttrShape }[] = [];
  const pushGroup = (group: string[], attr: boolean) => {
    if (group.length >= 4 && !attr) {
      for (let i = 0; i < group.length; i += 2) {
        const pair = group.slice(i, i + 2);
        slots.push({
          attr,
          n: pair.length,
          text:
            pair.length === 2
              ? cfg.joinList(
                  locale === "en" ? pair.map((k) => withArt(k, isDeclaredItem(k))) : pair,
                  forkRng(seed, 0x7c00 + i),
                )
              : locale === "en" ? withArt(pair[0]!, isDeclaredItem(pair[0]!)) : pair[0]!,
        });
      }
      return;
    }
    for (const kw of group) {
      if (!attr) {
        slots.push({ attr, n: 1, text: locale === "en" ? withArt(kw, isDeclaredItem(kw)) : kw });
        continue;
      }
      const shape = locale === "en" ? attributeShape(kw) : "predicate";
      // A noun-shaped attribute takes its article exactly like an object tail;
      // negative and predicate pills must stay bare.
      slots.push({ attr, n: 1, shape, text: shape === "noun" && locale === "en" ? withArt(kw) : kw });
    }
  };
  pushGroup(nounLeft, false);
  // Attribute pills normally get one sentence each: their frames read as an
  // aside, and joining two clause-shaped pills produced "Another plus: the
  // perfect for gifts plus the no artificial colors" (2026-08-02).
  //
  // Quality noun phrases are the exception — they conjoin bare and cleanly.
  // Without this, a store whose whole list is that shape ("good value",
  // "quick service", "friendly staff", "cozy atmosphere") emits one "Also X."
  // sentence PER keyword, and the review ends in a stack of four afterthoughts
  // (owner read of live output, 2026-08-13). Joined by hand, not by joinList:
  // that runs withArt, and an attribute must never take an article.
  // Only NOUN-shaped pills conjoin, and each half keeps its own article:
  // "the cozy atmosphere and the quick service". Joined bare they produced
  // "credit for cozy atmosphere and quick service" (2026-08-18 exhaustive run).
  const conjoinable = locale === "en" ? attrLeft.filter((k) => attributeShape(k) === "noun") : [];
  for (let i = 0; i < conjoinable.length; i += 2) {
    const pair = conjoinable.slice(i, i + 2);
    slots.push({
      attr: true,
      n: pair.length,
      shape: "noun",
      text: locale === "en" ? pair.map((k) => withArt(k)).join(" and ") : pair.join(" and "),
    });
  }
  pushGroup(attrLeft.filter((k) => !conjoinable.includes(k)), true);

  // Attribute tails bypass the PoolSet, so expandPoolChoices never sees them —
  // resolve their choice groups here or the raw "{a|b}" braces reach the guest
  // (caught 2026-08-03: the diversity gate printed an unexpanded group).
  const attrChoiceRng = forkRng(seed, 0x7a2c);
  const attrOrderFor = (shape: AttrShape | undefined): string[] => {
    const key =
      locale !== "en"
        ? locale
        : shape === "negative"
          ? "enNegative"
          : shape === "predicate"
            ? "enPredicate"
            : shape === "offering"
              ? "enOffering"
              : "en";
    return shuffle(
      ATTRIBUTE_TAILS[key].map((t) => expandChoices(t, attrChoiceRng)),
      forkRng(seed, 0x7a22),
    );
  };
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
  // 🔑 A2 (owner decision 2026-08-18) — the composition rule for ONE review.
  //
  // A1 took the colon frames out of the pools, but the DEFECT the owner reads
  // is not the punctuation, it is the move: a sentence whose only job is to
  // bolt one more item onto a review that has already been written. "Another
  // plus: X." and "I should mention X too." are the same move in different
  // clothes, and the owner's fail condition is "short set-pieces stacked up",
  // not "a colon appeared". So the cap moves from the punctuation to the move,
  // and drops from two to ONE aside per review — with two or more, the review
  // stops being one person talking and becomes a form being filled in.
  //
  // The cap never drops a keyword: when no non-aside frame is left, the aside
  // is used anyway. A verbatim phrase outranks the composition rule.
  const isColonFrame = (t: string) => /:\s/.test(t);
  let colonBeats = (text.match(/:\s/g) ?? []).length;
  // Aside = announces an addendum, either at the front ("Also X.", "Plus Y.")
  // or at the back ("… X too.", "… Y as well."). The back half is new with the
  // A1 rewrite: the replacement attribute frames are declarative sentences, so
  // they no longer OPEN as an addendum, but "I appreciated X too." is still the
  // same beat and still stacks the same way.
  const ADDITIVE_TAIL = /\b(too|as well|either|also|straight away)\s*[.!?]*$/i;
  const isAdditiveFrame = (t: string) =>
    ADDITIVE_OPEN.test(t.trim()) || ADDITIVE_TAIL.test(t.trim());
  // Seeded from what the skeleton ALREADY says, not from zero. The opener,
  // filler and closer pools contain aside beats of their own ("The value is
  // good for what you actually get, too."), and starting the count at zero let
  // a tail add a second one to a review that had already spent its allowance —
  // which is exactly the stack the rule exists to stop.
  let additiveBeats = splitSentences(text, locale, name).filter(isAdditiveFrame).length;
  const avoidColon = (tpl: string, order: string[], used?: Set<string>): string => {
    const colonBad = (t: string) => colonBeats >= 1 && isColonFrame(t);
    const addBad = (t: string) => additiveBeats >= 1 && isAdditiveFrame(t);
    if (!colonBad(tpl) && !addBad(tpl)) return tpl;
    const free = order.filter((t) => !(used?.has(t) ?? false));
    // Fall back in priority order. Asking for both at once and giving up when
    // neither exists made this WORSE: the reject path returned the original
    // colon frame and the second-colon count went UP (measured 2026-08-13).
    // The colon cap is the harder rule, so a candidate that only fixes the
    // colon still beats keeping the original.
    return free.find((t) => !colonBad(t) && !addBad(t)) ?? free.find((t) => !colonBad(t)) ?? tpl;
  };
  const countBeats = (tpl: string) => {
    if (isColonFrame(tpl)) colonBeats++;
    if (isAdditiveFrame(tpl)) additiveBeats++;
  };
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
    const orderAll = slot.attr ? attrOrderFor(slot.shape) : filterTasteVoice(tailOrder, locale, [slot.text]);
    // A pill that arrives with its own lower-case determiner ("a thoughtful
    // gift") is verbatim-protected, so capitalizeSentenceStartsEn leaves it
    // alone and a {kw}-initial frame ships a sentence starting in lower case:
    // "a thoughtful gift and the friendly service came up on the way home
    // too." (gate reject, 2026-08-18, live Let It Dough! config). Capitalising
    // it would edit a phrase we promised to reproduce exactly, so the frame
    // moves instead of the keyword.
    const order =
      locale === "en" && /^[a-z]/.test(slot.text)
        ? (orderAll.filter((t) => !t.trimStart().startsWith("{kw}")).length >= 3
            ? orderAll.filter((t) => !t.trimStart().startsWith("{kw}"))
            : orderAll)
        : orderAll;
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
    tpl = avoidColon(tpl, order, usedTails);
    usedTails.add(tpl);
    countBeats(tpl);
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
      text = appendSpread(text, fill(tpl, { kw: withSuperlativeArt(gkw, locale) }), cfg.glue, tailSpread, locale, name);
    }
  }

  // Category and service phrases: same treatment, their own frame pools. Each
  // gets one dedicated sentence, rotated, never merged into a list.
  const weaveDedicated = (
    phrases: string[],
    pool: string[],
    salt: number,
    shape: ((kw: string) => string) | undefined = undefined,
  ) => {
    if (phrases.length === 0) return;
    const choiceRng = forkRng(seed, salt);
    const order = shuffle(pool.map((t) => expandChoices(t, choiceRng)), forkRng(seed, salt + 1));
    let i = 0;
    for (const kw of phrases) {
      if (text.includes(kw)) continue;
      const shaped = shape ? shape(kw) : withSuperlativeArt(kw, locale);
      const tpl = avoidColon(order[i++ % order.length]!, order);
      countBeats(tpl);
      text = appendSpread(text, fill(tpl, { kw: shaped }), cfg.glue, tailSpread, locale, name);
    }
  };
  weaveDedicated(catKws, CATEGORY_TAILS[locale], 0x9e11);
  // A service is a countable thing you book ("the AI SEO audit"), unlike a
  // category, which is a mass/plural head ("fresh doughnuts") and stays bare.
  // Without this, every service frame read "They took the time to explain AI
  // SEO audit" (naturalness reader, 2026-08-10, live mirAIreach config).
  weaveDedicated(svcKws, serviceTailsFor(vertical, locale), 0x9e21, locale === "en" ? withServiceArt : undefined);

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
  if (locale === "en") text = capitalizeAfterBangPeriodEn(text, [...protectAll, name]);
  text = dedupeTerminators(text);
  if (locale === "en") text = capitalizeSentenceStartsEn(text, [...protectAll, name]);
  if (locale === "en") text = conjoinShortSentencesEn(text, [...protectAll, name], forkRng(seed, 0xc0a1));
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
