/**
 * Read what guests actually received from /api/generate-review, newest first,
 * so a human can do the 20-review read the ship decision requires, and see
 * why the route fell back when it did.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 * Usage: npx tsx scripts/read-ai-drafts.mjs [--n=50] [--store=<uuid>]
 *                                            [--outcome=ai|fallback] [--out=drafts.json]
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

const N = Number(arg("n", "50"));
const STORE = arg("store", "");
const OUTCOME = arg("outcome", "");
const OUT = arg("out", "");

const q = new URLSearchParams({
  select: "id,created_at,outcome,model,locale,rating,keywords,guest_note,draft,reason,latency_ms,stores(store_name,business_category)",
  order: "created_at.desc",
  limit: String(N),
});
if (STORE) q.set("store_id", `eq.${STORE}`);
if (OUTCOME) q.set("outcome", `eq.${OUTCOME}`);

const res = await fetch(`${url}/rest/v1/ai_review_drafts?${q}`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();
let ai = 0;
const reasons = new Map();
for (const r of rows) {
  const name = r.stores?.store_name?.en ?? Object.values(r.stores?.store_name ?? {})[0] ?? "?";
  if (r.outcome === "ai") ai++;
  else reasons.set(r.reason ?? "?", (reasons.get(r.reason ?? "?") ?? 0) + 1);
  const meta = [r.locale, `rating ${r.rating}`, r.outcome, r.model, r.latency_ms != null ? `${r.latency_ms} ms` : null]
    .filter(Boolean)
    .join(" / ");
  console.log(`\n[${r.created_at.slice(0, 16)}] ${name} / ${meta}`);
  console.log(`  taps: ${JSON.stringify(r.keywords)}${r.guest_note ? `\n  note: ${r.guest_note}` : ""}`);
  if (r.reason) console.log(`  reason: ${r.reason}`);
  if (r.draft) console.log(`  ${r.draft}`);
}
console.log(`\n${"=".repeat(70)}\n${rows.length} rows / ai ${ai} / fallback ${rows.length - ai}`);
for (const [reason, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${reason}`);
if (OUT) {
  const items = rows
    .filter((r) => r.outcome === "ai" && r.draft)
    .map((r) => ({
      store: r.stores?.store_name?.en ?? Object.values(r.stores?.store_name ?? {})[0] ?? "?",
      locale: r.locale,
      category: r.stores?.business_category ?? null,
      taps: r.keywords ?? [],
      text: r.draft,
    }));
  fs.writeFileSync(OUT, JSON.stringify(items, null, 2));
  console.log(`wrote ${OUT} (${items.length} shipped drafts). Judge with scripts/gate-review-naturalness.mjs --input=${OUT}`);
}
