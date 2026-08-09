/**
 * Read the SEO layer, sentence by sentence.
 *
 * The existing gates are structural: banned words, keyword pile-up, repetition,
 * uniqueness. None of them can tell whether a sentence is ENGLISH a person
 * would write — which is the only defect the owner has actually caught on a
 * live phone (four times between 2026-08-07 and 2026-08-09: "As far as X goes"
 * number disagreement, "Ticks every box for X" twice, "Hard to beat for X").
 *
 * Every one of those sat in the same place: the dedicated sentence that carries
 * a buyer-search phrase or the entity (category + area). Those frames are a
 * small closed set, so the whole risk surface can simply be PRINTED and read.
 *
 * Usage: npx tsx scripts/read-seo-sentences.mjs [runs] [--store=<substring>]
 */
import fs from "node:fs";
import path from "node:path";

const { generateReview } = await import("../lib/assembler.ts");

const RUNS = Number(process.argv[2]?.startsWith("--") ? 150 : process.argv[2] ?? 150);
const ONLY = (process.argv.find((a) => a.startsWith("--store=")) ?? "").split("=")[1] ?? "";

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
    `${url}/rest/v1/stores?select=store_name,keywords,forced_keywords,business_category,entity_area,entity_city,entity_category_label,default_language,keyword_types&is_active=eq.true`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(`stores query failed: ${res.status}`);
  return res.json();
}

const splitSentences = (t) =>
  (t.replace(/\n+/g, " ").match(/[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
const splitJa = (t) => (t.replace(/\n+/g, " ").match(/[^。]*。|[^。]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);

const stores = (await fetchStores()).filter((s) => {
  const n = s.store_name?.en ?? Object.values(s.store_name ?? {})[0] ?? "";
  return !ONLY || n.toLowerCase().includes(ONLY.toLowerCase());
});

for (const st of stores) {
  const name = st.store_name?.en ?? Object.values(st.store_name ?? {})[0] ?? "";
  const kws = st.keywords ?? [];
  const kt = st.keyword_types ?? {};
  const forced = st.forced_keywords ?? [];
  if (kws.length === 0 && forced.length === 0) continue;
  const catLabels = st.entity_category_label ?? {};
  const locales = [...new Set([st.default_language ?? "en", ...Object.keys(catLabels)])].filter((l) =>
    ["en", "ja", "ar"].includes(l),
  );

  for (const locale of locales) {
    const entity = {
      area: st.entity_area,
      city: st.entity_city,
      categoryLabel: catLabels,
    };
    // The sentences we want to read are the ones carrying a forced phrase or
    // the entity terms. Collect distinct renderings, with how often each fired.
    const geo = new Map();
    const ent = new Map();
    const entTerms = [catLabels[locale], catLabels.en, st.entity_area, st.entity_city].filter(Boolean);
    // Every phrase that gets a DEDICATED sentence — geo, category, service —
    // plus the forced set, because those are the ones the reader must judge.
    const allPhrases = [...new Set([...forced, ...kws.filter((k) => ["geo", "category", "service"].includes(kt[k]))])];
    for (let i = 0; i < RUNS; i++) {
      const picks = [
        forced[i % Math.max(1, forced.length)],
        kws[i % Math.max(1, kws.length)],
        kws[(i * 3 + 1) % Math.max(1, kws.length)],
      ].filter(Boolean);
      const text = generateReview(name, picks, {
        nonce: `seo|${name}|${locale}|${i}`,
        outletKey: `seo|${name}`,
        locale,
        category: st.business_category ?? undefined,
        rating: i % 6 === 0 ? 4 : 5,
        entity,
        keywordTypes: st.keyword_types ?? null,
      });
      for (const s of locale === "ja" ? splitJa(text) : splitSentences(text)) {
        const hitGeo = allPhrases.find((f) => f && s.includes(f));
        if (hitGeo) {
          const key = s.split(hitGeo).join("⟦kw⟧");
          const cur = geo.get(key) ?? { n: 0, ex: new Set() };
          cur.n++; cur.ex.add(s);
          geo.set(key, cur);
          continue;
        }
        if (entTerms.some((t) => s.includes(t))) ent.set(s, (ent.get(s) ?? 0) + 1);
      }
    }
    console.log(`\n=== ${name} / ${locale} — ${RUNS} reviews ===`);
    console.log(`-- SEO phrase sentences (${geo.size} distinct frames) --`);
    for (const [, v] of [...geo.entries()].sort((a, b) => b[1].n - a[1].n))
      console.log(`  ${String(v.n).padStart(3)}x ${[...v.ex][0]}`);
    console.log(`-- entity sentences (${ent.size} distinct) --`);
    for (const [s, n] of [...ent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${String(n).padStart(3)}x ${s}`);
  }
}
