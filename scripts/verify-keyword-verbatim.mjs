/**
 * The verbatim guarantee, checked against every live store config.
 *
 * Every phrase a guest leaves switched on must appear in the draft EXACTLY as
 * the owner typed it — that is the product promise and the SEO mechanism at
 * once. Composition rules are allowed to move a phrase to a different sentence
 * (see the core-list overlap rule and the aside cap in review-engine); none of
 * them may drop one. This exists so that "the rule only changes grouping" is a
 * measured claim rather than an intention.
 *
 * Usage: npx tsx scripts/verify-keyword-verbatim.mjs
 */
import fs from "node:fs";
const { generateReview } = await import("../lib/assembler.ts");
for (const line of fs.readFileSync(".env.local","utf8").split(/\r?\n/)) { const m=/^([A-Z_]+)=(.*)$/.exec(line); if(m) process.env[m[1]] ??= m[2].replace(/^"|"$/g,""); }
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const rows = await (await fetch(`${url}/rest/v1/stores?select=id,store_name,keywords,forced_keywords,business_category,entity_area,entity_city,entity_category_label,default_language,keyword_types,brand_color&is_active=eq.true`,{headers:{apikey:key,Authorization:`Bearer ${key}`}})).json();
let checked=0, lost=0;
for (const s of rows) {
  const name = s.store_name?.en ?? Object.values(s.store_name??{})[0] ?? ""; if(!name) continue;
  const all=[...new Set([...(s.forced_keywords??[]),...(s.keywords??[])].filter(Boolean))];
  if(!all.length) continue;
  const locale = s.default_language ?? "en";
  for (let i=0;i<200;i++){
    const n = 1 + (i % Math.min(5, all.length));
    const taps = Array.from({length:n},(_,k)=>all[(i*7+k)%all.length]);
    const uniq=[...new Set(taps)];
    const t = generateReview(name, uniq, { nonce:`v|${i}`, outletKey:`${s.id}|${s.business_category??""}|${s.brand_color??""}`, locale, category:s.business_category??undefined, rating:i%6===0?4:5, entity:{area:s.entity_area,city:s.entity_city,categoryLabel:s.entity_category_label??{}}, keywordTypes:s.keyword_types??null });
    checked++;
    for (const kw of uniq) if(!t.includes(kw)){ lost++; if(lost<=5) console.log(`LOST "${kw}" | ${name} | taps=${JSON.stringify(uniq)}\n  ${t}\n`); }
  }
}
console.log(`verbatim check: ${checked} reviews, ${lost} lost keyword(s)`);
process.exitCode = lost ? 1 : 0;
