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
console.log(fail ? `\n${fail} DETECTOR(S) FIRING ❌\n` : "\nALL CLEAN ✅\n");
process.exit(fail ? 1 : 0);
