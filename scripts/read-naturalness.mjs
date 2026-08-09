/**
 * The instrument that did not exist.
 *
 * Every gate in this repo measures STRUCTURE — banned words, keyword pile-up,
 * repetition, Title-Case, uniqueness, terminators. Not one of them can answer
 * the only question that has ever caught a real defect on a customer's phone:
 * "would a person write this sentence?"
 *
 * Between 2026-08-07 and 2026-08-09 the owner caught four separate unnatural
 * frames by reading a live QR, with every gate green the whole time. They were
 * green by construction: every naturalness rule in the engine is a denylist
 * appended the last time a human found something, so the suite can only test
 * for defects that are already known. Naturalness had exactly one instrument,
 * and it was the owner's eyes.
 *
 * This is the second instrument. It generates reviews from the LIVE store
 * configs and asks a native-speaker model to name only the sentences a native
 * speaker would not write. It is deliberately biased toward silence: a gate
 * that cries wolf stops being read (learned on 2026-08-07, when the Title-Case
 * gate produced 120 false positives on its first run).
 *
 * Usage: node scripts/read-naturalness.mjs [runsPerLocale] [--store=<substr>]
 * Env: GEMINI_API_KEY + the Supabase pair, read from
 *      ../../../dev/localreach-app/.env.local when not already set.
 */
import fs from "node:fs";
import path from "node:path";

const { generateReview } = await import("../lib/assembler.ts");

const RUNS = Number(process.argv[2]?.startsWith("--") ? 24 : process.argv[2] ?? 24);
const ONLY = (process.argv.find((a) => a.startsWith("--store=")) ?? "").split("=")[1] ?? "";

function loadEnv() {
  const p = path.resolve(process.cwd(), "../../../dev/localreach-app/.env.local");
  if (fs.existsSync(p)) {
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

// Same fallback chain and thinking-mode dance as app/api/generate-reply: keys
// issued after mid-2026 404 on the pinned 2.5 model, and gemini-3.x rejects
// thinkingBudget:0 with a 400 while 2.5-era models need it or return empty.
const MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
let thinkingRejected = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(prompt) {
  for (const model of MODELS) {
    const attempts = thinkingRejected ? [false] : [true, false];
    for (let i = 0; i < attempts.length; i++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 8192,
              ...(attempts[i] ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
          signal: AbortSignal.timeout(90000),
        },
      );
      if (res.status === 400 && attempts[i]) { thinkingRejected = true; continue; }
      if (res.status === 429 || res.status >= 500) { await sleep(2000); continue; }
      if (!res.ok) break;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("").trim();
      if (text) return text;
    }
  }
  return null;
}

const LANG = { en: "English", ja: "Japanese", ar: "Arabic" };

/**
 * The exclusion list is longer than the inclusion list on purpose. Asked for
 * "anything that could be better", a model returns every sentence and the
 * report becomes noise; asked for the specific ways a sentence stops being
 * something a person would write, it returns the four defects we already know
 * were real, and stays quiet otherwise.
 */
function buildPrompt(store, locale, category, sentences) {
  const listed = sentences.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return [
    `You are a native ${LANG[locale]} speaker. Below are DISTINCT sentences taken from draft Google reviews for "${store}", a ${category || "local business"}. Each line is one sentence; they come from different reviews, so read each on its own.`,
    "",
    "List ONLY sentences a native speaker would NOT write. For each, say what is wrong in one short clause.",
    "",
    "Report:",
    "- grammar errors (agreement, articles, tense, particles)",
    "- an idiom used with the wrong kind of object",
    "- register that does not fit this business type (e.g. ranking a medical treatment like a dish)",
    "- words or phrases left in another language",
    "- a phrase that is simply unclear on first read",
    "",
    "Do NOT report:",
    "- repetition between reviews, or short sentences",
    "- marketing tone, enthusiasm, or being generically positive",
    "- brand names, menu names, place names, product names",
    "- anything you merely find stylistically weak but a person could write",
    "",
    "If every sentence is fine, return an empty JSON array.",
    "Return at most 20 items, worst first. JSON only, no prose, no code fence:",
    `[{"sentence": "<exact sentence>", "problem": "<short clause>", "severity": "high|low"}]`,
    "",
    "SENTENCES:",
    listed,
  ].join("\n");
}

/**
 * Reviews repeat themselves by design (one template, many fillings), so sending
 * whole reviews spends most of the budget re-reading sentences the model has
 * already judged — and the answer then gets truncated mid-JSON, which is how
 * the first run of this script reported "unparseable" for every store. Sending
 * the DISTINCT sentences instead covers more of the surface for fewer tokens.
 */
function distinctSentences(reviews, locale) {
  const re = locale === "ja" ? /[^。]*。|[^。]+$/g : /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  const seen = new Set();
  for (const r of reviews) {
    for (const s of r.replace(/\n+/g, " ").match(re) ?? []) {
      const t = s.trim();
      if (t) seen.add(t);
    }
  }
  return [...seen];
}

async function fetchStores() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(
    `${url}/rest/v1/stores?select=store_name,keywords,forced_keywords,business_category,entity_area,entity_city,entity_category_label,default_language,keyword_types&is_active=eq.true`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const stores = (await fetchStores()).filter((s) => {
  const n = s.store_name?.en ?? Object.values(s.store_name ?? {})[0] ?? "";
  if (ONLY && !n.toLowerCase().includes(ONLY.toLowerCase())) return false;
  return (s.keywords ?? []).length > 0 || (s.forced_keywords ?? []).length > 0;
});

let findings = 0;
let unavailable = 0;
for (const st of stores) {
  const name = st.store_name?.en ?? Object.values(st.store_name ?? {})[0] ?? "";
  const kws = st.keywords ?? [];
  const forced = st.forced_keywords ?? [];
  const catLabels = st.entity_category_label ?? {};
  const locales = [...new Set([st.default_language ?? "en", ...Object.keys(catLabels)])]
    .filter((l) => ["en", "ja", "ar"].includes(l));

  for (const locale of locales) {
    const reviews = [];
    for (let i = 0; i < RUNS; i++) {
      // Rotate which phrases the guest tapped, so the sample reaches every
      // frame family instead of whatever the first keyword happens to hit.
      const picks = [
        forced[i % Math.max(1, forced.length)],
        kws[i % Math.max(1, kws.length)],
        kws[(i * 5 + 2) % Math.max(1, kws.length)],
      ].filter(Boolean);
      const uniq = [...new Set(picks)];
      reviews.push(generateReview(name, uniq, {
        nonce: `nat|${name}|${locale}|${i}`,
        outletKey: `nat|${name}`,
        locale,
        category: st.business_category ?? undefined,
        rating: i % 6 === 0 ? 4 : 5,
        entity: { area: st.entity_area, city: st.entity_city, categoryLabel: catLabels },
        keywordTypes: st.keyword_types ?? null,
      }));
    }
    const sentences = distinctSentences(reviews, locale);
    const raw = await callGemini(buildPrompt(name, locale, st.business_category, sentences));
    // A model that never answered is NOT a pass. Saying so out loud is the
    // difference between this gate and one that goes quiet when it breaks.
    if (!raw) { unavailable++; console.log(`\n### ${name} / ${locale}: MODEL UNAVAILABLE — not checked`); continue; }
    let items;
    try {
      items = JSON.parse(raw.replace(/^[`]{3}(?:json)?/i, "").replace(/[`]{3}$/, "").trim());
    } catch {
      unavailable++;
      console.log(`\n### ${name} / ${locale}: unparseable model output — not checked`);
      console.log(raw.slice(0, 300));
      continue;
    }
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`\n### ${name} / ${locale}: clean (${sentences.length} distinct sentences)`);
      continue;
    }
    findings += items.length;
    console.log(`\n### ${name} / ${locale}: ${items.length} flagged of ${sentences.length} distinct sentences`);
    for (const it of items) {
      console.log(`  [${it.severity ?? "?"}] ${it.sentence}`);
      console.log(`         -> ${it.problem}`);
    }
  }
}
console.log(`\n${findings} sentence(s) flagged, ${unavailable} check(s) did not run`);
process.exitCode = findings || unavailable ? 1 : 0;
