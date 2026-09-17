/**
 * Who opened a guest page, and who only opened it.
 *
 * ai_review_drafts starts at the "write my review" tap, so a demo that was
 * opened and put down looked exactly like a link nobody ever tapped. store_views
 * (migration 20260917120000) records the open itself; this prints both numbers
 * side by side, newest activity first. Times are Dubai.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 * Usage:
 *   npx tsx scripts/read-store-views.mjs [--days=14]
 *   npx tsx scripts/read-store-views.mjs --store=<name substr|slug> [--days=30]
 *     Every open of that store: when, on what kind of device, from which
 *     network (/24) and whether it was a device seen before.
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

const DAYS = Number(arg("days", "14"));
const ONLY = arg("store", "").toLowerCase();
const since = new Date(Date.now() - DAYS * 86400_000).toISOString();

const get = async (table, params) => {
  const res = await fetch(`${url}/rest/v1/${table}?${new URLSearchParams(params)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status} on ${table}: ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
};

const dubai = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const nameOf = (s) => s?.store_name?.en ?? Object.values(s?.store_name ?? {})[0] ?? "?";

const [views, drafts] = await Promise.all([
  get("store_views", {
    select: "opened_at,entry,device,ip_prefix,ip_hash,session_id,referrer_host,store_id,stores(store_name,slug)",
    order: "opened_at.desc",
    opened_at: `gte.${since}`,
    limit: "2000",
  }),
  get("ai_review_drafts", {
    select: "created_at,store_id",
    order: "created_at.desc",
    created_at: `gte.${since}`,
    limit: "2000",
  }),
]);

if (!views.length) {
  console.log(`No page opens in the last ${DAYS} days.`);
  console.log("(store_views starts the day /api/view ships; nothing before that was ever recorded.)");
  process.exit(0);
}

const byStore = new Map();
for (const v of views) {
  const k = v.store_id;
  if (!byStore.has(k))
    byStore.set(k, { name: nameOf(v.stores), slug: v.stores?.slug ?? "", rows: [], taps: 0 });
  byStore.get(k).rows.push(v);
}
for (const d of drafts) if (byStore.has(d.store_id)) byStore.get(d.store_id).taps++;

if (ONLY) {
  const hit = [...byStore.values()].find(
    (s) => s.name.toLowerCase().includes(ONLY) || s.slug.toLowerCase() === ONLY,
  );
  if (!hit) {
    console.log(`No opens for "${ONLY}" in the last ${DAYS} days.`);
    process.exit(0);
  }
  console.log(`\n${hit.name}  (${hit.slug})  last ${DAYS} days\n`);
  const seen = new Set();
  for (const v of [...hit.rows].reverse()) {
    const known = seen.has(v.ip_hash);
    seen.add(v.ip_hash);
    console.log(
      [
        dubai(v.opened_at),
        (v.device ?? "?").padEnd(7),
        (v.ip_prefix ?? "?").padEnd(16),
        known ? "same device as before" : "NEW device",
        v.entry === "store" ? "old /store link" : "",
        v.referrer_host ? `via ${v.referrer_host}` : "",
      ]
        .filter(Boolean)
        .join("  "),
    );
  }
  console.log(`\n${hit.rows.length} opens, ${seen.size} devices, ${hit.taps} review taps.`);
  process.exit(0);
}

const rows = [...byStore.values()].sort(
  (a, b) => new Date(b.rows[0].opened_at) - new Date(a.rows[0].opened_at),
);
console.log(`\nPage opens, last ${DAYS} days (Dubai time)\n`);
console.log("store                            opens  devices  taps  last open");
for (const s of rows) {
  const devices = new Set(s.rows.map((v) => v.ip_hash)).size;
  console.log(
    `${s.name.slice(0, 30).padEnd(32)}${String(s.rows.length).padStart(5)}${String(devices).padStart(9)}${String(s.taps).padStart(6)}  ${dubai(s.rows[0].opened_at)}`,
  );
}
console.log(
  `\nopens = the page was loaded. taps = a review was generated. opens with 0 taps is "looked and left".`,
);
