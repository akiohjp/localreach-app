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
 *   npx tsx scripts/test-gemini-review.mjs --live=<store name substr> [--n=3]
 *     Reads the matching ACTIVE stores from Supabase (service key in .env.local)
 *     and drafts from their real pills, entity fields and keyword types, with
 *     the same rotating tap selection the naturalness gate uses. This is the
 *     read to do before switching a store's AI Draft on.
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

/**
 * --live: real store rows instead of the fixtures. Tap selection mirrors
 * ReviewFlow.rotateForced + a guest picking 1-3 pills (same as the gate's
 * tapsFor), so the drafts are the ones a guest could actually receive.
 */
const LIVE = arg("live", "");
const GEO_RE = /\b(in|near|around)\s+(the\s+)?[A-Z]/;
function tapsFor(forced, guest, i, keywordTypes) {
  const picked = [];
  let geoTaken = false;
  for (let k = 0; k < forced.length && picked.length < 2; k++) {
    const cand = forced[(i + k) % forced.length];
    if (!cand || picked.includes(cand)) continue;
    const isGeo = keywordTypes?.[cand.trim()] === "geo" || (/^[\x20-\x7E]+$/.test(cand) && GEO_RE.test(cand));
    if (isGeo && geoTaken) continue;
    if (isGeo) geoTaken = true;
    picked.push(cand);
  }
  const nGuest = 1 + (i % 3);
  const start = guest.length ? (i * 5) % guest.length : 0;
  for (let k = 0; k < nGuest && guest.length; k++) {
    const g = guest[(start + k) % guest.length];
    if (g && !picked.includes(g)) picked.push(g);
  }
  return picked;
}

let cases = CASES;
if (LIVE) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("--live needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const res = await fetch(
    `${url}/rest/v1/stores?select=id,store_name,business_category,entity_area,entity_city,entity_category_label,keywords,forced_keywords,keyword_types,default_language&is_active=eq.true&order=created_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) { console.error(`stores: HTTP ${res.status} ${await res.text()}`); process.exit(1); }
  const rows = (await res.json()).filter((r) => JSON.stringify(r.store_name ?? {}).toLowerCase().includes(LIVE.toLowerCase()));
  if (rows.length === 0) { console.error(`no active store matches --live=${LIVE}`); process.exit(1); }
  cases = [];
  for (const r of rows) {
    const name = r.store_name?.en ?? Object.values(r.store_name ?? {})[0] ?? "?";
    const forced = (r.forced_keywords ?? []).filter(Boolean);
    const guest = (r.keywords ?? []).filter((k) => k && !forced.includes(k));
    // One case per draft so each gets its own tap selection; N is applied per case below.
    for (let i = 0; i < N; i++) {
      cases.push({
        store: name,
        category: r.business_category ?? "",
        entity: { area: r.entity_area ?? "", city: r.entity_city ?? "", noun: r.entity_category_label ?? {} },
        keywords: [...new Set(tapsFor(forced, guest, i, r.keyword_types ?? null))],
        keywordTypes: r.keyword_types ?? null,
        rating: i % 4 === 3 ? 4 : 5,
        note: "",
        perCase: 1,
      });
    }
  }
}

const results = [];
let okCount = 0;
let total = 0;
for (const c of cases) {
  if (ONLY && !`${c.store} ${c.category}`.toLowerCase().includes(ONLY)) continue;
  for (const locale of LOCALES) {
    console.log(`\n### ${c.store} / ${c.category} / ${locale} / rating ${c.rating} / note=${c.note ? "yes" : "no"}${LIVE ? ` / taps=${JSON.stringify(c.keywords)}` : ""}`);
    for (let i = 0; i < (c.perCase ?? N); i++) {
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
        variant: (LIVE ? cases.indexOf(c) : i) % OPENINGS.length,
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
