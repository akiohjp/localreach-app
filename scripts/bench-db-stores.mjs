/**
 * Live-DB naturalness + safety gate.
 *
 * Why this exists: on 2026-08-07 a banned term ("Persian") reached a CLIENT'S
 * PHONE during a meeting. The pre-ship check at the time was "read the keyword
 * list", which cannot catch what the engine actually emits — a phrase only
 * becomes wrong once it is woven into a sentence. `bench-live-stores.mjs`
 * hardcodes store configs from a snapshot date, so any store added afterwards
 * is invisible to it. This one pulls EVERY active store from production and
 * reads the generated text.
 *
 * Checks, per store x locale:
 *   1. BANNED  — per-store forbidden vocabulary (config below). Hard fail.
 *   2. CASE    — a Title-Case common noun mid-sentence ("about Wool kilim"),
 *                which reads as a proper noun. Keywords are verbatim-protected
 *                by design, so the defect is always in the stored data.
 *   3. PILEUP  — 3+ protected phrases inside one sentence.
 *   4. DUPE    — identical output across runs (template exhaustion).
 *
 * Usage:
 *   node scripts/bench-db-stores.mjs [runsPerStore] [--store=<substring>] [--print=N]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (read from
 * ../../../dev/localreach-app/.env.local if not already set).
 */

import fs from "node:fs";
import path from "node:path";

const { generateReview } = await import("../lib/assembler.ts");

const RUNS = Number(process.argv[2]?.startsWith("--") ? 40 : process.argv[2] ?? 40);
const ONLY = (process.argv.find((a) => a.startsWith("--store=")) ?? "").split("=")[1] ?? "";
const PRINT = Number((process.argv.find((a) => a.startsWith("--print=")) ?? "").split("=")[1] ?? 2);

/** Words that must never appear, per store-name substring. "*" applies to all. */
const BANNED = {
  Cinar: [
    "persian", "iranian", "oriental", "kashmir", "afghan", "moroccan",
    "tabriz", "isfahan", "qom", "carpet", "nuruosmaniye", "antalya",
  ],
};

/** Proper nouns that legitimately keep a capital letter mid-sentence. */
const PROPER = /^(Turkish|Hereke|Anatolian|Japanese|Korean|Cappadocia|Avanos|Istanbul|Dubai|Nevsehir|Fatih|Sultanahmet|Grand|Al|Abu|Boston|Karak|Shin|Bibigo|CJ|Binggrae|IV|HydraFacial|AGA)/;

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const p = path.resolve(process.cwd(), "../../../dev/localreach-app/.env.local");
  if (!fs.existsSync(p)) throw new Error(`env not found: ${p}`);
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
  }
}

async function fetchStores() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(
    `${url}/rest/v1/stores?select=store_name,keywords,forced_keywords,business_category,entity_area,entity_city,entity_category_label,default_language,keyword_types,is_active&is_active=eq.true`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(`stores query failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function splitSentences(text, locale) {
  const re = locale === "ja" ? /[^。]*。|[^。]+$/g : /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  return (text.replace(/\n+/g, " ").match(re) ?? []).map((s) => s.trim()).filter(Boolean);
}

function maxPhrasesPerSentence(text, locale, phrases) {
  let worst = 0;
  for (const s of splitSentences(text, locale)) {
    let n = 0;
    for (const p of phrases) if (p && s.includes(p)) n++;
    worst = Math.max(worst, n);
  }
  return worst;
}

const CALENDAR = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)$/;

/**
 * Title-Case common noun that is NOT at a sentence start.
 *
 * Anything that is legitimately capitalised must be excluded or the gate cries
 * wolf and stops being read: the store's own name, its area/city, weekday and
 * month names, and the PROPER list. A gate with false positives is worse than
 * no gate (2026-08-07).
 */
function caseOffenders(text, locale, allow) {
  if (locale !== "en") return [];
  const out = [];
  for (const s of splitSentences(text, locale)) {
    // skip the first word of the sentence
    const words = s.split(/\s+/).slice(1);
    for (const w of words) {
      // NB: strip possessive ('s) but never a bare trailing "s" — doing that
      // turned "Rugs"/"Avanos" into "Rug"/"Avano" and the allow-list missed
      // them, which is how this gate produced 120 false positives on its first
      // run (2026-08-07).
      const clean = w.replace(/^[("']+/, "").replace(/['’]s$/, "").replace(/[.,!?;:)"'’]+$/g, "");
      if (!/^[A-Z][a-z]{2,}$/.test(clean)) continue;
      if (PROPER.test(clean) || CALENDAR.test(clean)) continue;
      if (allow.has(clean.toLowerCase())) continue;
      out.push(clean);
    }
  }
  return [...new Set(out)];
}

const stores = (await fetchStores()).filter((s) => {
  const n = s.store_name?.en ?? Object.values(s.store_name ?? {})[0] ?? "";
  return !ONLY || n.toLowerCase().includes(ONLY.toLowerCase());
});

let hardFail = 0;
console.log(`stores: ${stores.length} · runs each: ${RUNS}\n`);

for (const s of stores) {
  const name = s.store_name?.en ?? Object.values(s.store_name ?? {})[0] ?? "(unnamed)";
  const forced = s.forced_keywords ?? [];
  const guest = (s.keywords ?? []).filter((k) => !forced.includes(k));
  const locales = [...new Set(Object.keys(s.store_name ?? { en: 1 }))];
  const banned = Object.entries(BANNED)
    .filter(([k]) => k === "*" || name.includes(k))
    .flatMap(([, v]) => v);

  const entity = {
    area: s.entity_area ?? null,
    city: s.entity_city ?? null,
    categoryLabel: s.entity_category_label ?? {},
  };

  // Words that are capitalised for a legitimate reason for THIS store.
  const allowCase = new Set(
    [name, s.entity_area ?? "", s.entity_city ?? ""]
      .join(" ")
      .split(/[^A-Za-zÀ-ɏ]+/)
      .filter(Boolean)
      .map((w) => w.toLowerCase()),
  );

  for (const locale of locales) {
    const seen = new Set();
    const hits = { banned: new Map(), case: new Map(), caseCtx: new Map(), pileup: 0, dupe: 0 };
    const samples = [];

    for (let i = 0; i < RUNS; i++) {
      // Realistic guest behaviour: 0-5 pills tapped, forced set always offered.
      const take = i % 6;
      const picks = guest.slice(i % Math.max(1, guest.length)).slice(0, take);
      const merged = [...forced, ...picks.filter((g) => !forced.includes(g))];
      let text;
      try {
        text = generateReview(name, merged, {
          nonce: `dbgate|${name}|${locale}|${i}`,
          outletKey: `dbgate|${name}`,
          locale,
          category: s.business_category ?? "",
          forcedCount: forced.length,
          rating: i % 7 === 0 ? 4 : 5,
          entity,
          keywordTypes: s.keyword_types ?? null,
        });
      } catch (e) {
        console.log(`  ${name} [${locale}] run ${i}: THREW ${e.message}`);
        hardFail++;
        continue;
      }
      if (seen.has(text)) hits.dupe++;
      seen.add(text);
      if (samples.length < PRINT) samples.push(text);

      const low = text.toLowerCase();
      for (const b of banned) {
        if (new RegExp(`\\b${b}\\b`, "i").test(low)) {
          hits.banned.set(b, (hits.banned.get(b) ?? 0) + 1);
        }
      }
      for (const c of caseOffenders(text, locale, allowCase)) {
        hits.case.set(c, (hits.case.get(c) ?? 0) + 1);
        // Keep one example sentence per offender: a bare word list is not
        // actionable — you cannot tell a menu name from an engine bug without
        // seeing where it sits.
        if (!hits.caseCtx.has(c)) {
          const sent = splitSentences(text, locale).find((x) => new RegExp(`\b${c}\b`).test(x));
          if (sent) hits.caseCtx.set(c, sent);
        }
      }
      if (maxPhrasesPerSentence(text, locale, merged) >= 3) hits.pileup++;
    }

    const bannedList = [...hits.banned.entries()];
    const caseList = [...hits.case.entries()].sort((a, b) => b[1] - a[1]);
    const status = bannedList.length ? "FAIL" : caseList.length || hits.pileup ? "WARN" : "OK";
    if (bannedList.length) hardFail++;

    console.log(`[${status}] ${name} · ${locale}`);
    if (bannedList.length) console.log(`   BANNED  ${bannedList.map(([w, n]) => `${w}×${n}`).join(", ")}`);
    if (caseList.length) {
      console.log(`   CASE    ${caseList.slice(0, 6).map(([w, n]) => `${w}×${n}`).join(", ")}`);
      for (const [w] of caseList.slice(0, 3)) {
        const ctx = hits.caseCtx.get(w);
        if (ctx) console.log(`           ${w}: "${ctx.slice(0, 130)}"`);
      }
    }
    if (hits.pileup) console.log(`   PILEUP  ${hits.pileup}/${RUNS} reviews with 3+ phrases in one sentence`);
    if (hits.dupe) console.log(`   DUPE    ${hits.dupe}/${RUNS} identical repeats`);
    for (const t of samples) console.log(`   · ${t.replace(/\n+/g, " ").slice(0, 190)}`);
  }
}

console.log(`\n${hardFail ? `HARD FAILURES: ${hardFail}` : "no banned-word failures"}`);
process.exit(hardFail ? 1 : 0);
