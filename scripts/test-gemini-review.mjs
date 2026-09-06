/**
 * Exercise the REAL guest-draft prompt (lib/review-prompt.ts), model ladder
 * (lib/review-ai.ts) and post-filter (lib/review-ai-filter.ts) against the
 * live Gemini API, the way /api/generate-review does — minus Supabase.
 *
 * Reads GEMINI_API_KEY from .env.local (never printed). Prints every draft
 * with the model, latency and the filter verdict, and can write the drafts
 * to a JSON file that scripts/gate-review-naturalness.mjs --input=<file>
 * judges with the owner's naturalness question.
 *
 * Usage:
 *   npx tsx scripts/test-gemini-review.mjs [--n=3] [--locales=en,ja,ar]
 *                                          [--case=<substr>] [--out=drafts.json]
 *                                          [--show-prompt]
 */
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? "").split("=").slice(1).join("=") || d;
const has = (k) => process.argv.includes(`--${k}`);

for (const p of [path.resolve(process.cwd(), ".env.local")]) {
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
  }
}
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY missing (.env.local)");
  process.exit(1);
}

const { buildReviewPrompt, OPENINGS } = await import("../lib/review-prompt.ts");
const { generateWithLadder, reviewModelsFromEnv } = await import("../lib/review-ai.ts");
const { cleanReviewDraft, checkReviewDraft } = await import("../lib/review-ai-filter.ts");
const { NON_VISIT_VERTICALS, resolveAudience, resolveVertical } = await import("../lib/review-pools.ts");

const N = Number(arg("n", "3"));
const LOCALES = arg("locales", "en").split(",").map((s) => s.trim()).filter(Boolean);
const ONLY = arg("case", "").toLowerCase();
const OUT = arg("out", "");
const models = reviewModelsFromEnv();

/**
 * Store shapes production actually has. Names are invented; the categories,
 * pill styles and entity fields mirror live rows.
 */
const CASES = [
  {
    store: "Let It Dough",
    category: "Doughnut shop",
    entity: { area: "WAFI Mall", city: "Dubai", noun: { en: "doughnut shop", ja: "ドーナツ店", ar: "محل دونات" } },
    keywords: ["Fresh doughnuts", "Friendly Staff", "best doughnuts in Dubai"],
    keywordTypes: { "best doughnuts in Dubai": "geo", "Friendly Staff": "attribute", "Fresh doughnuts": "item" },
    rating: 5,
    note: "the pistachio one was gone in seconds and they warmed it up for me",
  },
  {
    store: "Maison Oud",
    category: "Perfume boutique",
    entity: { area: "Dubai Mall", city: "Dubai", noun: { en: "perfume boutique", ja: "香水店", ar: "متجر عطور" } },
    keywords: ["Long lasting scent", "Oud perfume", "Personal fragrance consultation"],
    keywordTypes: { "Oud perfume": "item", "Long lasting scent": "attribute", "Personal fragrance consultation": "service" },
    rating: 5,
    note: "",
  },
  {
    store: "Maison Oud",
    category: "Perfume boutique",
    entity: { area: "Dubai Mall", city: "Dubai", noun: { en: "perfume boutique", ja: "香水店", ar: "متجر عطور" } },
    keywords: ["Oud perfume"],
    keywordTypes: { "Oud perfume": "item" },
    rating: 4,
    note: "took a while to get help on a saturday but the lady knew her stuff",
  },
  {
    store: "Harbour Dental",
    category: "Dental clinic",
    entity: { area: "Jumeirah", city: "Dubai", noun: { en: "dental clinic", ja: "歯科医院", ar: "عيادة أسنان" } },
    keywords: ["Gentle dentist", "No waiting time", "Teeth cleaning"],
    keywordTypes: { "Teeth cleaning": "service", "Gentle dentist": "attribute", "No waiting time": "attribute" },
    rating: 5,
    note: "",
  },
  {
    store: "BlueLine Movers",
    category: "Moving company, home services",
    entity: { area: "Dubai Marina", city: "Dubai", noun: { en: "moving company", ja: "引越し業者", ar: "شركة نقل أثاث" } },
    keywords: ["Packing service", "On time", "movers in Dubai Marina"],
    keywordTypes: { "movers in Dubai Marina": "geo", "Packing service": "service", "On time": "attribute" },
    rating: 5,
    note: "they finished two hours early",
  },
];

const results = [];
let okCount = 0;
let total = 0;
for (const c of CASES) {
  if (ONLY && !`${c.store} ${c.category}`.toLowerCase().includes(ONLY)) continue;
  for (const locale of LOCALES) {
    console.log(`\n### ${c.store} / ${c.category} / ${locale} / rating ${c.rating} / note=${c.note ? "yes" : "no"}`);
    for (let i = 0; i < N; i++) {
      const vertical = resolveVertical(c.category);
      const prompt = buildReviewPrompt({
        storeName: c.store,
        locale,
        rating: c.rating,
        keywords: c.keywords,
        keywordTypes: c.keywordTypes,
        note: c.note,
        categoryNoun: c.entity.noun[locale] ?? c.entity.noun.en,
        area: c.entity.area,
        city: c.entity.city,
        nonVisit: NON_VISIT_VERTICALS.has(vertical),
        visitor: resolveAudience(c.category) === "visitor",
        variant: i % OPENINGS.length,
      });
      if (has("show-prompt") && i === 0) console.log(`\n--- prompt ---\n${prompt}\n--- end prompt ---\n`);
      total++;
      const r = await generateWithLadder({ apiKey, models, prompt, budgetMs: 20000, attemptMs: 12000 });
      if (!r.ok) {
        console.log(`  [${i + 1}] FAILED ${r.reason} (${r.latencyMs} ms)`);
        results.push({ store: c.store, locale, category: c.category, taps: c.keywords, text: "", failed: r.reason });
        continue;
      }
      const text = cleanReviewDraft(r.text);
      const verdict = checkReviewDraft(text, { locale, rating: c.rating, keywords: c.keywords, storeName: c.store });
      if (verdict.ok) okCount++;
      console.log(`  [${i + 1}] ${r.model} ${r.latencyMs} ms  ${verdict.ok ? "PASS" : `REJECT ${verdict.reason}`}`);
      console.log(`      ${text}`);
      results.push({ store: c.store, locale, category: c.category, taps: c.keywords, text, model: r.model, latencyMs: r.latencyMs, verdict: verdict.ok ? "pass" : verdict.reason });
    }
  }
}

console.log(`\n${"=".repeat(70)}\ngenerated ${total}, passed filter ${okCount}, rejected/failed ${total - okCount}`);
if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify(results.filter((r) => r.text), null, 2));
  console.log(`wrote ${OUT}. Judge it with: npx tsx scripts/gate-review-naturalness.mjs --input=${OUT}`);
}
