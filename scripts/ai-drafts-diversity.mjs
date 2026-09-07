/**
 * Diversity audit of the AI drafts guests actually received: per store, do
 * the openings repeat, and does any pair of drafts read like one another?
 *
 * The owner's rule (2026-09-07): fifty reviews of one place must not look
 * like one person wrote them, and the opening is what a reader compares
 * first. The route steers and filters against the last 20 drafts; this reads
 * the whole history so drift over weeks is caught too.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 * Usage: npx tsx scripts/ai-drafts-diversity.mjs [--store=<substr>] [--n=200]
 * Exit 1 when any store has a repeated opening or a pair above the similarity cap.
 */
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? "").split("=").slice(1).join("=") || d;

for (const p of [path.resolve(process.cwd(), ".env.local")]) {
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (.env.local)");
  process.exit(1);
}

const { openingKey, ngramOverlap, SIMILARITY_MAX } = await import("../lib/review-ai-filter.ts");

const ONLY = arg("store", "").toLowerCase();
const N = Number(arg("n", "200"));

const res = await fetch(
  `${url}/rest/v1/ai_review_drafts?select=store_id,draft,created_at,stores(store_name)&outcome=eq.ai&order=created_at.desc&limit=2000`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();

const byStore = new Map();
for (const r of rows) {
  if (!r.draft) continue;
  const name = r.stores?.store_name?.en ?? Object.values(r.stores?.store_name ?? {})[0] ?? r.store_id;
  if (ONLY && !String(name).toLowerCase().includes(ONLY)) continue;
  if (!byStore.has(name)) byStore.set(name, []);
  const list = byStore.get(name);
  if (list.length < N) list.push(r.draft);
}

let failures = 0;
for (const [name, drafts] of [...byStore.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const openings = new Map();
  for (const d of drafts) {
    const k = openingKey(d);
    openings.set(k, (openings.get(k) ?? 0) + 1);
  }
  const repeated = [...openings.entries()].filter(([, c]) => c > 1);
  let worst = 0;
  let worstPair = null;
  for (let i = 0; i < drafts.length; i++) {
    for (let j = i + 1; j < drafts.length; j++) {
      const o = ngramOverlap(drafts[i], drafts[j]);
      if (o > worst) {
        worst = o;
        worstPair = [drafts[i], drafts[j]];
      }
    }
  }
  const bad = repeated.length > 0 || worst > SIMILARITY_MAX;
  if (bad) failures++;
  console.log(`\n### ${name}: ${drafts.length} drafts, ${openings.size} distinct openings, worst pair ${Math.round(worst * 100)}% shared 4-grams ${bad ? "  <-- FIX" : ""}`);
  for (const [k, c] of repeated) console.log(`  opening x${c}: "${k} ..."`);
  if (worst > SIMILARITY_MAX && worstPair) {
    console.log(`  most similar pair (${Math.round(worst * 100)}%):`);
    console.log(`    A: ${worstPair[0]}`);
    console.log(`    B: ${worstPair[1]}`);
  }
}

console.log(`\n${"=".repeat(70)}`);
console.log(`stores checked: ${byStore.size}, with a repeat or a pair above ${Math.round(SIMILARITY_MAX * 100)}%: ${failures}`);
process.exitCode = failures ? 1 : 0;
