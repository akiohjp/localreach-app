/**
 * Read N generated reviews for one live store, in full, as a human would.
 *
 * The automated gate (bench-db-stores.mjs) catches banned words, casing and
 * pile-up, but it cannot judge whether a sentence makes sense. Some defects
 * only surface on a read-through: "Save room for the silk rugs." (a food idiom
 * that sat in the shared pool) and "As far as naturally dyed rugs goes"
 * (singular agreement on a plural keyword) were both found this way, not by a
 * gate. Run this before sending a demo to a prospect.
 *
 * Usage: npx tsx scripts/read-store-reviews.mjs <store-name-substring> [count]
 */
import fs from "node:fs";
const { generateReview } = await import("../lib/assembler.ts");
const env = fs.readFileSync("../../../dev/localreach-app/.env.local","utf8");
const U = /^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)[1].trim();
const K = /^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m.exec(env)[1].trim();
const target = process.argv[2], N = Number(process.argv[3] ?? 24);
const res = await fetch(`${U}/rest/v1/stores?select=store_name,keywords,forced_keywords,business_category,entity_area,entity_city,entity_category_label,keyword_types&is_active=eq.true`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } });
const s = (await res.json()).find(x => (x.store_name?.en ?? "").toLowerCase().includes(target.toLowerCase()));
if (!s) { console.log("not found"); process.exit(1); }
const name = s.store_name.en, forced = s.forced_keywords ?? [];
const guest = (s.keywords ?? []).filter(k => !forced.includes(k));
const entity = { area: s.entity_area, city: s.entity_city, categoryLabel: s.entity_category_label };
console.log(`### ${name}\n`);
for (let i = 0; i < N; i++) {
  const picks = guest.slice(i % Math.max(1, guest.length)).slice(0, i % 6);
  const t = generateReview(name, [...forced, ...picks.filter(g => !forced.includes(g))], {
    nonce: `read|${name}|${i}`, outletKey: `read|${name}`, locale: "en",
    category: s.business_category ?? "", forcedCount: forced.length, keywordTypes: s.keyword_types ?? null,
    rating: i % 7 === 0 ? 4 : 5, entity });
  console.log(`[${String(i).padStart(2,"0")}] ${t.replace(/\n+/g," ")}\n`);
}
