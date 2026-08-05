/**
 * Real-config naturalness bench.
 *
 * The audit suite uses synthetic stores. This one runs the ACTUAL live store
 * configs (pulled from production) through the engine with realistic guest
 * selections, and flags the things a human reader notices but no existing gate
 * catches — above all KEYWORD PILE-UP, where several protected phrases land in
 * one sentence and the review stops sounding like a person:
 *
 *   "Japanese aesthetic medicine in Dubai plus Diabetes & Metabolism Programme
 *    plus IV Drip and the aesthetic treatments in Dubai lived up to the hype."
 *
 * (owner eye-check 2026-08-02, live Kotobuki demo)
 *
 * Usage: npx tsx scripts/bench-live-stores.mjs [runsPerCase]
 */

const { generateReview, createReviewNonce } = await import("../lib/assembler.ts");

const RUNS = Number(process.argv[2] ?? 60);
/** Optional experiment: cap how many forced phrases each store contributes. */
const FORCED_CAP = process.env.FORCED_CAP ? Number(process.env.FORCED_CAP) : Infinity;

/** Live production stores (is_active), pulled 2026-08-02. Demo/test rows kept
 *  out except where they are what we actually send to a prospect. */
const STORES = [
  {
    name: "Kotobuki Clinic", locale: ["en", "ja", "ar"], category: "aesthetic clinic",
    keywords: ["IV Drip","IV Therapy","Exosome Therapy","Hydrogen Inhalation Therapy","Peptide Therapy","HydraFacial","Acne Scar Treatment","Regenerative Medicine","AGA Treatment","Vitamin IV","Diabetes & Metabolism Programme","Weight Management Programme","Medical Wellness Check","Anti-Aging Treatment"],
    forced: ["Japanese aesthetic medicine in Dubai","aesthetic treatments in Dubai","regenerative medicine"],
    entity: { area: "Trade Centre", city: "Dubai", categoryLabel: { en: "Japanese aesthetic clinic", ja: "美容・再生医療クリニック", ar: "عيادة تجميل يابانية" } },
  },
  {
    name: "1004 Gourmet", locale: ["en", "ja", "ar"], category: "Asian grocery store",
    keywords: ["Korean ramen","Shin Ramyun","Bibigo dumplings","Kimchi","CJ Kimchi","Korean BBQ sauces","Binggrae Banana Milk","Korean snacks","Mochi","Korean porridge","Cold noodle broth","Frozen dumplings","Halal products","Korean bread","Japanese groceries","Wasabi paste"],
    forced: ["Korean groceries in Dubai","Asian groceries in Dubai","halal Asian groceries"],
    entity: { area: "Deira", city: "Dubai", categoryLabel: { en: "Asian supermarket", ja: "アジア食材店", ar: "سوبرماركت آسيوي" } },
  },
  {
    name: "Pitfire Pizza", locale: ["en", "ar"], category: "pizza restaurant",
    keywords: ["Garlic Knots","Hot Honey Margherita","Black Truffle Cream Linguine","Buffalo Chicken Wings","Korean Style Wings","Bresaola & Rocket","Truffle Pasta","Chicken Penne Alfredo","Spinach & Artichoke Dip","Herby Chicken Caesar","Chocolate Chip Cookie Brownie","72-hour artisan dough","crispy crust","oven-fresh pizza","quick service","friendly team","comfortable seating","good value"],
    forced: ["pizza in Dubai","artisan pizza","72-hour dough"],
    entity: { area: "Dubai Hills", city: "Dubai", categoryLabel: { en: "pizza restaurant", ar: "مطعم بيتزا" } },
  },
  {
    name: "Maru Udon", locale: ["en", "ja", "ar"], category: "japanese restaurant",
    keywords: ["Niku Beef udon","Hokkaido Curry","Karamiso Spice","Paitan Chicken","Tan Tan Shezuan","Katsu Curry Udon","Kake Classic","Zaru Dipping","Premium Wagyu Beef Gyudon","Karaage Don","Tempura Don","Shrimp Gyoza","shrimp tempura","onigiri rice balls","Udonut dessert","handmade udon noodles","sanuki-style broth","vegan udon options"],
    forced: ["udon in Dubai","sanuki-style udon","handmade udon noodles"],
    entity: { area: "Motor City", city: "Dubai", categoryLabel: { en: "udon restaurant", ja: "うどん店", ar: "مطعم ياباني" } },
  },
  {
    name: "Let It Dough!", locale: ["en", "ja", "ar"], category: "cafe",
    keywords: ["fresh doughnuts","best doughnuts in Dubai","UAE homegrown","globally-inspired flavors","Boston Cream","Za'atar & Labneh","Brûlée Me Away","natural ingredients","no artificial colors","gift box","perfect for gifts","great for parties and events","office treats","birthday doughnut box","a thoughtful gift","Karak and doughnuts","Japanese tea","Best V60 in Dubai","Great options for drinks"],
    forced: ["premium doughnuts","doughnuts made fresh daily","doughnuts in Dubai","friendly service"],
    entity: { area: "WAFI Mall", city: "Dubai", categoryLabel: { en: "doughnut shop", ja: "ドーナツ店", ar: "متجر دونات" } },
  },
  {
    name: "Sushidokoro Tsukasa", locale: ["ja", "en"], category: "sushi restaurant",
    keywords: ["漬けカンパチ月見丼","握り寿司","ランチの握り","旬の魚","新鮮なネタ","真妻わさび","赤出汁","茶碗蒸し","デザート","日本酒","気軽に行けるカウンター","一人でも入りやすい","気さくな大将","丁寧な接客","明朗会計","リーズナブル","ランチが手頃","落ち着いた雰囲気","清潔感のある店内","子連れでも入りやすい"],
    forced: [],
    entity: { area: "渡鹿", city: "熊本市", categoryLabel: { en: "sushi restaurant", ja: "寿司店" } },
  },
  {
    name: "Sengawa Golf", locale: ["ja", "en"], category: "fitness",
    keywords: ["入場料無料","65球700円","お得な回数券","36打席","左打席","レンタルクラブ","無料の駐車場","駅から歩ける立地","早朝からの練習","仕事帰りの練習","夜22時までの営業","打ちっぱなしの練習","初心者の練習","アイアンの練習","ドライバーの練習","2階のゴルフスクール","プロのレッスン","体験レッスン","静かな練習環境","ふらっと立ち寄れる気軽さ"],
    forced: [],
    entity: { area: "三鷹", city: "東京", categoryLabel: { en: "golf driving range", ja: "ゴルフ練習場" } },
  },
  {
    name: "Ocha Cafe Sakura", locale: ["en", "ja", "ar"], category: "japanese tea house",
    keywords: ["Matcha latte","Hojicha latte","Ceremonial matcha","Matcha Suruga RG","Fukamushi sencha","Genmaicha","Hojicha","Japanese tea gift set","Gift-wrapped tea set","Matcha bowl and whisk set","Assorted sweets box","Gift cheesecake","Tea and sweets gift box","Matcha roll cake","Hojicha roll cake","Souffle cheesecake","Matcha cheesecake","Yuzu cheesecake","Dates cheesecake","Strawberry daifuku","Fruit daifuku","Kinako mochi"],
    forced: ["matcha gift sets in Abu Dhabi","Japanese tea gift boxes in Abu Dhabi","ceremonial matcha in Abu Dhabi","matcha whisk and bowl sets","Japanese sweets in a gift box","tea sets with gift wrapping"],
    entity: { area: "Al Maryah Island", city: "Abu Dhabi", categoryLabel: { en: "Japanese tea house", ja: "日本茶専門店", ar: "مقهى شاي ياباني" } },
  },
  {
    name: "mirAIreach", locale: ["en"], category: "agency",
    keywords: ["local SEO work","GEO strategy","AIO optimization","AI SEO audit","AEO content","AI visibility report","AI Overviews visibility","ChatGPT visibility","Google Business Profile setup","Google Maps ranking","Google review management","QR review system","AI business automation","website design","structured data setup","free AI visibility scan","monthly reporting","clear flat pricing","fast WhatsApp support","honest measurable results"],
    forced: [],
    entity: { area: null, city: "Dubai", categoryLabel: { en: "AI SEO agency" } },
  },
];

// ------------------------------------------------------------- detectors ----

function splitSentences(text, locale) {
  const re = locale === "ja" ? /[^。]*。|[^。]+$/g : /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  return (text.replace(/\n+/g, " ").match(re) ?? []).map((s) => s.trim()).filter(Boolean);
}

/** How many protected phrases sit inside one sentence. 3+ = pile-up. */
function maxPhrasesPerSentence(text, locale, phrases) {
  let worst = 0, worstSentence = "";
  for (const s of splitSentences(text, locale)) {
    // Count only phrases that are not contained inside a longer counted one,
    // so "regenerative medicine" inside "Japanese aesthetic medicine in Dubai"
    // is not double-counted.
    const hits = phrases.filter((p) => p && s.includes(p));
    const maximal = hits.filter((p) => !hits.some((q) => q !== p && q.includes(p)));
    if (maximal.length > worst) { worst = maximal.length; worstSentence = s; }
  }
  return { worst, worstSentence };
}

const DETECTORS = [
  { key: "pileup3", label: "3+ keywords crammed into ONE sentence",
    test: (t, loc, ph) => maxPhrasesPerSentence(t, loc, ph).worst >= 3 },
  { key: "doublePlus", label: '"A plus B plus C" chain',
    test: (t) => /\bplus\b[^.!?]*\bplus\b/i.test(t) },
  // NOTE: a prose-based "and ... and" detector lived here and was removed on
  // 2026-08-02. It fired on ordinary English ("the visit was easier and
  // friendlier than I expected", "the artisan pizza and Chicken Penne Alfredo
  // done with care") because it measured sentence style rather than keyword
  // stuffing. pileup3 counts the actual verbatim phrases, which is the thing
  // that matters; the prose test only added noise. Every one of its surviving
  // samples was hand-checked as natural before deleting it.
  { key: "commaList3", label: "comma-list of 3+ keywords",
    test: (t, loc, ph) => splitSentences(t, loc).some((s) => {
      const hits = ph.filter((p) => p && s.includes(p));
      const maximal = hits.filter((p) => !hits.some((q) => q !== p && q.includes(p)));
      return maximal.length >= 3 && (s.match(/,/g) ?? []).length >= 2;
    }) },
  { key: "jaSpace", label: "JA: stray halfwidth space",
    // Mask Latin/number runs first — a store name like "1004 Gourmet" legitimately
    // contains a space, and matching only [A-Za-z] left the digits behind and
    // reported it as a stray space (false positive, 2026-08-02).
    test: (t, loc) => loc === "ja" && /[ 　]/.test(t.replace(/[A-Za-z0-9][A-Za-z0-9 .&'\-]*[A-Za-z0-9]/g, "X")) },
  { key: "dupTerm", label: "doubled sentence terminator",
    test: (t) => /[.!?]\s*[.!?]/.test(t) || /。。/.test(t) },
  { key: "orphanFrag", label: "orphan fragment (comma/period start)",
    test: (t) => /(^|[.!?]\s),/.test(t) },
];

// ------------------------------------------------------------------ run ----

let totalCases = 0;
const failures = new Map();
const samples = new Map();

for (const store of STORES) {
  for (const locale of store.locale) {
    // Realistic guest behaviour: 1-4 taps.
    for (let picks = 1; picks <= 4; picks++) {
      for (let i = 0; i < RUNS; i++) {
        totalCases++;
        const start = (i * 3 + picks) % Math.max(1, store.keywords.length);
        const guest = [];
        for (let k = 0; k < picks; k++) guest.push(store.keywords[(start + k) % store.keywords.length]);
        const forcedUsed = store.forced.slice(0, FORCED_CAP);
        const merged = [...forcedUsed, ...guest.filter((g) => !forcedUsed.includes(g))];
        const text = generateReview(store.name, merged, {
          nonce: createReviewNonce(),
          outletKey: `${store.name}|${locale}`,
          locale,
          category: store.category,
          forcedCount: forcedUsed.length,
          rating: i % 7 === 0 ? 4 : 5,
          entity: store.entity,
        });
        const protectedPhrases = [...merged, store.entity?.area, store.entity?.categoryLabel?.[locale]].filter(Boolean);
        for (const d of DETECTORS) {
          if (d.test(text, locale, protectedPhrases)) {
            const k = `${d.key}`;
            failures.set(k, (failures.get(k) ?? 0) + 1);
            const sk = `${d.key}|${store.name}|${locale}`;
            if (!samples.has(sk)) samples.set(sk, { picks, text });
          }
        }
      }
    }
  }
}

console.log(`\nreal-config bench — ${totalCases} reviews across ${STORES.length} live stores\n`);
let fail = 0;
for (const d of DETECTORS) {
  const n = failures.get(d.key) ?? 0;
  if (n) fail++;
  const pct = ((n / totalCases) * 100).toFixed(1);
  console.log(`  ${n ? "✗" : "✓"} ${d.label}: ${n} (${pct}%)`);
}
if (fail) {
  console.log("\n─── worst samples ───");
  for (const d of DETECTORS) {
    const entries = [...samples.entries()].filter(([k]) => k.startsWith(d.key + "|")).slice(0, 3);
    if (!entries.length) continue;
    console.log(`\n[${d.label}]`);
    for (const [k, v] of entries) {
      const [, store, locale] = k.split("|");
      console.log(`  ${store} / ${locale} / ${v.picks} taps:\n    ${v.text.replace(/\n+/g, " ⏎ ")}`);
    }
  }
}
// -------------------------------------------------- diversity gate (100) ----
// "A store's page must survive being READ" — 100 consecutive reviews of one
// store, and no sentence may become a visible refrain. Owner requirement
// 2026-08-03 ("50件で同じパターンが戻ってくると弱すぎる。100件かぶらなければ").
//
// Classification insight (2026-08-03, second iteration): {store}/{loc}/{cat}
// are the SAME VALUE in every review of one store, so an entity sentence like
// "A proper udon restaurant, right here in Motor City." is a CONSTANT on that
// store's page even though it's templated in the source. Only guest/core
// KEYWORDS actually vary between reviews. The gate therefore masks keywords
// alone; store name, area and category stay literal, and repeats are judged as
// what the reader actually sees.
//
// Thresholds are LENGTH-AWARE, because repetition visibility scales with how
// distinctive the sentence is:
//  - LONG constant repeated 9+ times = the classic bot refrain. Cap 8.
//  - SHORT constant ("Zero hassle.", "また来ます。") repeating is what real
//    review pages do — "great service" appears dozens of times on any genuine
//    page. Cap 12.
//  - KEYWORD-VARYING sentences read differently each time (different dish /
//    treatment inside). Cap 12.
// Floors: >=200 distinct sentences and >=25 distinct openers per 100 reviews
// (agency runs an exclusive pool, so the floor sits below the generic-pool
// stores' typical 350+).
const GATE = { longConstantMax: 8, shortConstantMax: 12, keywordVaryingMax: 12, minDistinct: 200, minOpeners: 25 };
const LONG_LEN = { en: 45, ja: 22, ar: 40 };

function normalizeForGate(s, phrases) {
  let t = s;
  for (const p of phrases) if (p) t = t.split(p).join("‹›");
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

let gateFail = 0;
// EVERY locale the store offers, not just the primary one. Gating only the
// primary locale is how Arabic went un-measured for months: the tab is right
// there on the page, a guest can pick it, and nothing ever checked whether its
// hundredth review still read fresh. A locale we ship is a locale we gate.
console.log("─── diversity gate: 100 reviews per store × every locale offered ───");
for (const store of STORES) for (const locale of store.locale) {
  // Keywords are the only content that varies between one store's reviews —
  // they get masked to ‹›. The store name is replaced with a punctuation-free
  // token purely so names like "Let It Dough!" don't break sentence splitting;
  // it still counts as constant text, which is what it is to the reader.
  const kwPhrases = [...store.forced, ...store.keywords].filter(Boolean);
  const constPhrases = [
    [store.name, "STORENAME"],
  ].filter(([p]) => Boolean(p));
  // Arabic closes sentences with "." but asks with "؟" (U+061F), which the
  // Latin split would swallow into the next sentence.
  const splitRe = locale === "ja"
    ? /[^。]*。|[^。]+$/g
    : locale === "ar"
      ? /[^.!?؟]*[.!?؟]+(?:\s|$)|[^.!?؟]+$/g
      : /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  // Mask BEFORE splitting: a store name ending in "!" ("Let It Dough!") would
  // otherwise split mid-sentence here and each half would register as its own
  // repeated refrain — a bench artifact; the engine itself handles punctuated
  // names correctly (it received the same fix on 2026-08-02).
  const preMask = (t) => {
    let out = t;
    for (const [p, token] of constPhrases) out = out.split(p).join(token);
    for (const p of kwPhrases) out = out.split(p).join("‹›");
    return out;
  };
  const sentCount = new Map();
  const openerSet = new Set();
  for (let i = 0; i < 100; i++) {
    const taps = 1 + (i % 3);
    const start = (i * 5) % Math.max(1, store.keywords.length);
    const guest = [];
    for (let k = 0; k < taps; k++) guest.push(store.keywords[(start + k) % store.keywords.length]);
    // Mirror production: up to two rotating core phrases offered, but at most
    // ONE geo search phrase per guest (ReviewFlow.rotateForced caps it — two
    // geo sentences per review read as spam and repeat across the page).
    const GEO_RE = /\b(in|near|around)\s+[A-Z]/;
    const f = [];
    if (store.forced.length) {
      let geoTaken = false;
      for (let k = 0; k < store.forced.length && f.length < 2; k++) {
        const cand = store.forced[(i + k) % store.forced.length];
        const isGeo = GEO_RE.test(cand);
        if (isGeo && geoTaken) continue;
        if (f.includes(cand)) continue;
        if (isGeo) geoTaken = true;
        f.push(cand);
      }
    }
    const text = generateReview(store.name, [...f, ...guest.filter((g) => !f.includes(g))], {
      // Deterministic nonce: the gate measures the same 100 reviews every run,
      // so a pass is a stable guarantee rather than a lucky draw from the
      // balls-in-bins tail (and a fail is always reproducible).
      nonce: `gate|${store.name}|${i}`, outletKey: `gate|${store.name}`, locale,
      category: store.category, rating: i % 6 === 0 ? 4 : 5, entity: store.entity,
    });
    const sents = (preMask(text.replace(/\n+/g, " ")).match(splitRe) ?? []).map((s) => s.trim()).filter(Boolean);
    sents.forEach((s, idx) => {
      const key = s.replace(/\s+/g, " ").trim().toLowerCase();
      if (!key || key === "‹›" || key === "‹›。") return;
      sentCount.set(key, (sentCount.get(key) ?? 0) + 1);
      if (idx === 0) openerSet.add(key);
    });
  }
  const longLen = LONG_LEN[locale] ?? 45;
  const offenders = [...sentCount.entries()].filter(([s, n]) => {
    if (s.includes("‹›")) return n > GATE.keywordVaryingMax;
    return n > (s.length >= longLen ? GATE.longConstantMax : GATE.shortConstantMax);
  });
  const ok = offenders.length === 0 && sentCount.size >= GATE.minDistinct && openerSet.size >= GATE.minOpeners;
  if (!ok) gateFail++;
  console.log(`  ${ok ? "✓" : "✗"} ${store.name} / ${locale}: distinct=${sentCount.size} openers=${openerSet.size}${offenders.length ? " offenders: " + offenders.slice(0, 3).map(([s, n]) => `${n}x "${s.slice(0, 48)}"`).join(" | ") : ""}`);
}

const anyFail = fail + gateFail;
console.log(anyFail ? `\n${fail} DETECTOR(S) + ${gateFail} DIVERSITY GATE(S) FIRING ❌\n` : "\nALL CLEAN ✅\n");
process.exitCode = anyFail ? 1 : 0;

