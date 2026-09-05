/**
 * The ship gate. One question, asked about ONE WHOLE REVIEW at a time:
 *
 *     "A guest is about to paste this on Google. Is it natural?"
 *
 * That is the owner's definition of passing, fixed 2026-08-18: not a score,
 * not a count of distinct sentences, not a list of banned words — a person
 * reads one review start to finish and says yes or no.
 *
 * Why this is not read-naturalness.mjs with a bigger prompt
 * --------------------------------------------------------
 * read-naturalness.mjs de-duplicates the reviews down to DISTINCT SENTENCES
 * and asks about those. Every sentence it sends can be fine while the review
 * they came from is not: "Underrated: the good value." is only obviously wrong
 * next to the three other one-line asides it landed beside. De-duplication
 * destroys exactly the information the owner is judging — the combination
 * inside one review. So that script stays (it is good at grammar and at
 * register), and this one owns the ship decision.
 *
 * Two runs, and only what survives both
 * -------------------------------------
 * The instrument is a language model, and it drifts: run the same 30 reviews
 * twice and the second run flags things the first did not. A one-run finding
 * is therefore not evidence. Every review is judged twice, in independent
 * calls with different batch groupings, and a review counts as unnatural ONLY
 * if both runs flag it. Anything flagged once is printed as UNSTABLE so a
 * human can look, and does not fail the build.
 *
 * This gate reports REJECTS ONLY. A clean run does NOT mean "ship it" — it
 * means this instrument found nothing, which is a much smaller claim. The ship
 * decision needs a human reading 20 whole reviews (Client_Onboarding_Kit).
 *
 * Usage:
 *   npx tsx scripts/gate-review-naturalness.mjs [--store=<substr>] [--n=30]
 *                                               [--locale=en] [--all-locales]
 * Env: GEMINI_API_KEY + the Supabase pair, from .env.local.
 */
import fs from "node:fs";
import path from "node:path";

const { generateReview } = await import("../lib/assembler.ts");
const { ENABLED_LOCALES } = await import("../lib/guest-locales.ts");

const arg = (k, d) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? "").split("=").slice(1).join("=") || d;
const has = (k) => process.argv.includes(`--${k}`);

const ONLY = arg("store", "");
const N = Number(arg("n", "30"));
const ONLY_LOCALE = arg("locale", "");
const ALL_LOCALES = has("all-locales");
// S3: judge EVERY selection a guest can reach instead of N rotating ones. Only
// honest on a store narrowed to a handful of pills (the sales demo store) —
// with sixteen pills this is 65,536 cases, not a check.
const EXHAUSTIVE = has("exhaustive");
// 10 whole reviews per call. The unit of JUDGEMENT is still one review — each
// is delimited and answered separately — but the unit of BILLING is the call,
// and the free tier counts calls, not reviews. At 6 a 30-review run cost 10
// calls per pass and burned the daily quota in two runs.
const BATCH = 10;

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "../../../dev/localreach-app/.env.local"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line);
      if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
    }
  }
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"]) {
    if (!process.env[k]) throw new Error(`missing env: ${k}`);
  }
}
loadEnv();

// The free tier is 20 requests PER DAY PER MODEL, not per project — which is
// the real constraint on this gate, and the reason it is written to spread
// calls across models rather than hammer one. Two consequences, both learned
// the hard way on 2026-08-18:
//   - gemini-2.0-flash is retired and answers 404 for every key. It was still
//     the last rung of this ladder (and of the production reply route), so the
//     ladder had quietly rotted from the bottom.
//   - a 429 here is a DAILY cap, not a burst. Sleeping and retrying the same
//     model spends minutes to earn another 429; the next model is the fix.
// Different models judging different batches is not a problem for this gate —
// the two runs are meant to be independent instruments, and two different
// models disagreeing is exactly the drift the both-runs rule filters out.
const MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
];
const exhausted = new Set();
let nextModel = 0;
let thinkingRejected = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastFailure = "";
async function callGemini(prompt, temperature) {
  const usable = () => MODELS.filter((m) => !exhausted.has(m));
  for (let round = 0; round < 3; round++) {
    const pool = usable();
    if (pool.length === 0) { lastFailure = "every model is out of free-tier quota for today"; return null; }
    for (let n = 0; n < pool.length; n++) {
      const model = pool[(nextModel + n) % pool.length];
      const attempts = thinkingRejected ? [false] : [true, false];
      for (let i = 0; i < attempts.length; i++) {
        let res;
        try {
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature,
                  maxOutputTokens: 8192,
                  ...(attempts[i] ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
                },
              }),
              signal: AbortSignal.timeout(120000),
            },
          );
        } catch (e) {
          lastFailure = `${model}: network ${e?.name ?? e}`;
          break;
        }
        if (res.status === 400 && attempts[i]) { thinkingRejected = true; continue; }
        if (res.status === 429) {
          const body = await res.text();
          // A per-DAY violation retires the model for this run; a burst limit
          // is worth one short wait.
          if (/PerDay/i.test(body)) { exhausted.add(model); lastFailure = `${model}: daily free-tier quota spent`; }
          else { lastFailure = `${model}: rate limited`; await sleep(20000); }
          break;
        }
        if (res.status === 404) { exhausted.add(model); lastFailure = `${model}: 404 (model retired)`; break; }
        if (!res.ok) { lastFailure = `${model}: http ${res.status}`; break; }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("").trim();
        if (text) { nextModel = (nextModel + n + 1) % Math.max(1, usable().length); return text; }
        lastFailure = `${model}: empty response (${data.candidates?.[0]?.finishReason ?? "no reason"})`;
      }
    }
  }
  return null;
}

const LANG = { en: "English", ja: "Japanese", ar: "Arabic" };

/**
 * The whole definition of failing, in the owner's words (2026-08-18), and
 * nothing else. The exclusion list is longer than the inclusion list for the
 * same reason as in read-naturalness.mjs: a gate asked for "anything that
 * could be better" returns every review and stops being read.
 *
 * The single most important exclusion is REPETITION. It was taken out of the
 * pass/fail on purpose, and a judge that quietly puts it back would re-create
 * the pressure that put the inverted and verbless frames in the pools.
 */
function buildPrompt(store, locale, category, batch) {
  const listed = batch
    .map((r, i) => `<<<REVIEW ${i + 1}>>>\n${r.text}\n<<<END ${i + 1}>>>`)
    .join("\n\n");
  return [
    `You are a native ${LANG[locale]} speaker reading Google reviews of "${store}", a ${category || "local business"}.`,
    "",
    "For each review below, answer ONE question: would a real person have written this, start to finish?",
    "",
    "Answer NO if any of these is true:",
    "- a sentence is not a sentence: no verb, just a noun phrase or a label",
    '- a sentence uses a colon as a label ("Underrated: the coffee.", "Short version:")',
    '- a sentence puts the topic first and then restarts ("The coffee, that\'s why I\'ll be back.")',
    "- a sentence has a grammar error a native speaker would not make",
    "- the review does not hold together as one message: it jumps between unrelated points, or it is a stack of short one-line taglines like advertising copy",
    "",
    "Answer YES otherwise. In particular these are NOT reasons to answer NO:",
    "- the review is generic, enthusiastic, plain or dull",
    "- sentences or phrasing you would expect to see in other reviews of the same place (repetition between reviews is not being judged here — you are reading one review on its own)",
    "- short sentences, informal wording, a dropped subject at the start of a sentence",
    "- brand names, menu names, place names, product names, or a search-style phrase like a product plus a district",
    "- anything you merely find stylistically weak but a person could write",
    "",
    'For every review answer with an object: {"n": <number>, "natural": true|false, "sentence": "<the exact sentence that fails, or empty>", "why": "<short clause, or empty>"}.',
    "Return one JSON array covering every review, in order. JSON only, no prose, no code fence.",
    "",
    listed,
  ].join("\n");
}

async function fetchStores() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Every field production reads. A bench that omits one measures a path
  // production does not take — which is how keyword_types went unmeasured for
  // a week (see the note at the top of bench-live-stores.mjs).
  const res = await fetch(
    `${url}/rest/v1/stores?select=id,store_name,keywords,forced_keywords,business_category,entity_area,entity_city,entity_category_label,default_language,keyword_types,brand_color,greeting_text&is_active=eq.true&order=created_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * The guest selection production actually produces (ReviewFlow.rotateForced):
 * at most two core phrases are OFFERED, at most one of them a geo search
 * phrase, and the guest's own pills sit on top. Deterministic here so a fail
 * is reproducible and a fix is provable.
 */
const GEO_RE = /\b(in|near|around)\s+(the\s+)?[A-Z]/;
function tapsFor(forced, guest, i, keywordTypes) {
  const picked = [];
  let geoTaken = false;
  for (let k = 0; k < forced.length && picked.length < 2; k++) {
    const cand = forced[(i + k) % forced.length];
    if (!cand || picked.includes(cand)) continue;
    const isGeo =
      keywordTypes?.[cand.trim()] === "geo" || (/^[\x20-\x7E]+$/.test(cand) && GEO_RE.test(cand));
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

const rows = await fetchStores();
const stores = rows
  .map((s) => {
    const name = s.store_name?.en ?? Object.values(s.store_name ?? {})[0] ?? "";
    const filled = new Set([s.default_language]);
    for (const src of [s.store_name, s.greeting_text]) {
      for (const [k, v] of Object.entries(src ?? {})) if (typeof v === "string" && v.trim()) filled.add(k);
    }
    const shipped = ["en", "ja", "ar"].filter(
      (l) => filled.has(l) && (ENABLED_LOCALES.includes(l) || l === s.default_language),
    );
    return { row: s, name, shipped: ALL_LOCALES ? ["en", "ja", "ar"].filter((l) => filled.has(l)) : shipped };
  })
  .filter((s) => s.name && ((s.row.keywords ?? []).length || (s.row.forced_keywords ?? []).length))
  .filter((s) => !ONLY || s.name.toLowerCase().includes(ONLY.toLowerCase()));

if (stores.length === 0) {
  console.log(`no live store matched --store=${ONLY}`);
  process.exitCode = 1;
}

/** One judging pass over every batch. Returns Map<index, {sentence, why}>. */
async function judge(name, locale, category, reviews, offset, temperature) {
  const flagged = new Map();
  let unavailable = 0;
  for (let b = offset; b < reviews.length + offset; b += BATCH) {
    const batch = [];
    for (let k = 0; k < BATCH; k++) {
      const idx = (b + k) % reviews.length;
      if (b + k >= reviews.length + offset) break;
      batch.push(reviews[idx]);
    }
    if (batch.length === 0) continue;
    const raw = await callGemini(buildPrompt(name, locale, category, batch), temperature);
    if (!raw) { unavailable++; console.log(`  !! batch not checked: ${lastFailure}`); continue; }
    // Pace the next call so a burst limit does not eat a batch.
    await sleep(4000);
    let items;
    try {
      items = JSON.parse(raw.replace(/^[`]{3}(?:json)?/i, "").replace(/[`]{3}$/, "").trim());
    } catch {
      unavailable++;
      console.log(`  !! batch not checked: model returned unparseable JSON`);
      continue;
    }
    if (!Array.isArray(items)) { unavailable++; console.log(`  !! batch not checked: model did not return an array`); continue; }
    for (const it of items) {
      const pos = Number(it?.n) - 1;
      const review = batch[pos];
      if (!review || it?.natural !== false) continue;
      flagged.set(review.i, { sentence: String(it.sentence ?? "").trim(), why: String(it.why ?? "").trim() });
    }
  }
  return { flagged, unavailable };
}

let confirmed = 0;
let unstable = 0;
let unchecked = 0;
let readTotal = 0;

for (const st of stores) {
  const s = st.row;
  const guest = (s.keywords ?? []).filter(Boolean);
  const forced = (s.forced_keywords ?? []).filter(Boolean);
  const locales = st.shipped.filter((l) => !ONLY_LOCALE || l === ONLY_LOCALE);

  for (const locale of locales) {
    const pills = [...new Set([...forced, ...guest])];
    let cases;
    if (EXHAUSTIVE) {
      cases = [[]];
      for (const pill of pills) {
        const len = cases.length;
        for (let j = 0; j < len; j++) cases.push([...cases[j], pill]);
      }
      if (cases.length > 128) {
        console.log(`
!! ${st.name}: ${pills.length} pills = ${cases.length} reachable selections — too many to judge exhaustively. Narrow the store first (scripts/demo-store-narrow.mjs).
`);
        process.exitCode = 1;
        continue;
      }
    } else {
      cases = Array.from({ length: N }, (_, i) => [...new Set(tapsFor(forced, guest, i, s.keyword_types ?? null))]);
    }

    const reviews = [];
    for (let i = 0; i < cases.length; i++) {
      const taps = cases[i];
      reviews.push({
        i,
        taps,
        text: generateReview(st.name, taps, {
          // Deterministic so a fail is reproducible; the shape of every other
          // option matches ReviewFlow.proceedToGenerate exactly.
          nonce: `gate|${st.name}|${locale}|${i}`,
          outletKey: `${s.id}|${s.business_category ?? ""}|${s.brand_color ?? ""}`,
          locale,
          category: s.business_category ?? undefined,
          rating: i % 6 === 0 ? 4 : 5,
          entity: {
            area: s.entity_area,
            city: s.entity_city,
            categoryLabel: s.entity_category_label ?? {},
          },
          keywordTypes: s.keyword_types ?? null,
        }),
      });
    }
    readTotal += reviews.length;

    // Two independent passes. The batch grouping is offset and the temperature
    // differs, so run B is not run A with the same context re-scored.
    const a = await judge(st.name, locale, s.business_category, reviews, 0, 0.1);
    const b = await judge(st.name, locale, s.business_category, reviews, 3, 0.4);
    unchecked += a.unavailable + b.unavailable;

    const both = [...a.flagged.keys()].filter((k) => b.flagged.has(k));
    const once = [...new Set([...a.flagged.keys(), ...b.flagged.keys()])].filter((k) => !both.includes(k));
    confirmed += both.length;
    unstable += once.length;

    console.log(`\n### ${st.name} / ${locale} — ${reviews.length} reviews read`);
    if (a.unavailable + b.unavailable > 0) {
      console.log(`  !! ${a.unavailable + b.unavailable} batch(es) NOT CHECKED (model unavailable or unparseable)`);
    }
    if (both.length === 0) console.log(`  no review was rejected by both runs`);
    for (const k of both.sort((x, y) => x - y)) {
      const r = reviews.find((x) => x.i === k);
      console.log(`\n  REJECT #${k + 1}  taps: ${JSON.stringify(r.taps)}`);
      console.log(`    run A: ${a.flagged.get(k).why} -> "${a.flagged.get(k).sentence}"`);
      console.log(`    run B: ${b.flagged.get(k).why} -> "${b.flagged.get(k).sentence}"`);
      console.log(r.text.split("\n").map((l) => `      ${l}`).join("\n"));
    }
    for (const k of once.sort((x, y) => x - y)) {
      const f = a.flagged.get(k) ?? b.flagged.get(k);
      console.log(`  unstable #${k + 1} (one run only): ${f.why} -> "${f.sentence}"`);
    }
  }
}

console.log(`\n${"=".repeat(70)}`);
console.log(`read      : ${readTotal} whole reviews`);
console.log(`REJECTED  : ${confirmed}   (flagged by BOTH runs — these are the ones to fix)`);
console.log(`unstable  : ${unstable}   (one run only — look, but not a failure)`);
console.log(`not checked: ${unchecked} batch(es)`);
// Deliberately no "PASS" line. This gate can only ever say "I did not reject
// anything", which is not the same claim as "this is ready for a customer".
console.log(
  confirmed || unchecked
    ? `\nSENT BACK. Fix the rejects above, or re-run the batches that did not check.\n`
    : `\nNothing rejected. That is not a ship approval — a human still reads 20 whole reviews.\n`,
);
process.exitCode = confirmed || unchecked ? 1 : 0;
