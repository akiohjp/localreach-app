/**
 * Offline read-through and gate for the story-frame path, against the live EN
 * store configs snapshotted in scripts/fixtures/live-stores-en.json (no DB,
 * no API key needed).
 *
 *   npx tsx scripts/sample-stories.mjs                 # 3 drafts per store to read
 *   npx tsx scripts/sample-stories.mjs --n=6 --store=RMK
 *   npx tsx scripts/sample-stories.mjs --check         # 200 drafts per store, invariants only
 *
 * --check fails on: a tapped phrase missing (in its reviewKeywordForm), the
 * store name missing, leftover template syntax ("{", "[", "]"), doubled
 * spaces or punctuation seams, a sentence-cased attribute reproduced with its
 * capital mid-sentence, length outside the engine band, and a single sentence
 * carrying more than 12 of 100 drafts.
 */
import fs from "node:fs";
import path from "node:path";

const { generateReview, createReviewNonce, reviewKeywordForm } = await import("../lib/assembler.ts");

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? "").split("=").slice(1).join("=") || d;
const has = (k) => process.argv.includes(`--${k}`);
const N = Number(arg("n", has("check") ? "200" : "3"));
const ONLY = arg("store", "");
const CHECK = has("check");

const stores = JSON.parse(fs.readFileSync(path.resolve("scripts/fixtures/live-stores-en.json"), "utf8"))
  .filter((s) => !ONLY || s.name.toLowerCase().includes(ONLY.toLowerCase()));

const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const sentences = (t) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 8);

let fails = 0;
const fail = (store, msg, t) => {
  fails++;
  if (fails <= 25) console.log(`✗ ${store}: ${msg}\n   ${t}`);
};

for (const s of stores) {
  const all = [...s.forced, ...s.keywords];
  const sentenceCount = new Map();
  const seen = new Set();
  const lens = [];
  if (!CHECK) console.log(`\n══════ ${s.name}  (${s.category} · ${s.catLabel} · ${s.area ?? ""} ${s.city ?? ""})`);
  for (let i = 0; i < N; i++) {
    // Sample the way production does: 1-5 guest taps on top of the forced set.
    const taps = 1 + (i % 5);
    const guest = [];
    for (let k = 0; k < taps; k++) guest.push(s.keywords[(i * 7 + k * 3) % s.keywords.length]);
    const picked = [...new Set([...s.forced, ...guest])];
    const rating = i % 6 === 5 ? 4 : 5;
    const t = generateReview(s.name, picked, {
      nonce: CHECK ? `chk|${i}` : createReviewNonce(),
      outletKey: `${s.name}|${s.category}|${s.brand}`,
      locale: "en",
      category: s.category,
      forcedCount: s.forced.length,
      rating,
      entity: { area: s.area, city: s.city, categoryLabel: { en: s.catLabel } },
      keywordTypes: s.types,
    });
    if (!CHECK) {
      console.log(`\n[${rating}★ · taps: ${guest.join(" / ")}]  (${words(t)} words)\n${t}`);
      continue;
    }
    lens.push(words(t));
    seen.add(t);
    if (!t.includes(s.name)) fail(s.name, "store name missing", t);
    for (const kw of guest) {
      // A tap that is also a core phrase rotates with the core set by design.
      if (s.forced.includes(kw)) continue;
      const shown = reviewKeywordForm(kw, s.types[kw]);
      if (!t.includes(shown)) fail(s.name, `guest phrase missing: "${shown}"`, t);
    }
    if (/[{}\[\]]/.test(t)) fail(s.name, "template syntax leaked", t);
    if (/\s{2,}|\s[,.;:]|,,|\.\.|;\.|,\./.test(t)) fail(s.name, "spacing or punctuation seam", t);
    if (/\n/.test(t)) fail(s.name, "paragraph break", t);
    for (const kw of all) {
      const shown = reviewKeywordForm(kw, s.types[kw]);
      if (shown !== kw && t.includes(kw) && !t.includes(shown)) fail(s.name, `sentence-cased phrase kept its capital: "${kw}"`, t);
    }
    const n = words(t);
    if (n < 18 || n > 155) fail(s.name, `length ${n} outside band`, t);
    for (const sent of sentences(t)) {
      const key = sent.toLowerCase().replace(/\s+/g, " ");
      sentenceCount.set(key, (sentenceCount.get(key) ?? 0) + 1);
    }
  }
  if (CHECK) {
    lens.sort((a, b) => a - b);
    const pct = (p) => lens[Math.floor((lens.length - 1) * p)];
    const top = [...sentenceCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topRate = top.length ? (top[0][1] / N) * 100 : 0;
    console.log(`${s.name.padEnd(28)} unique ${seen.size}/${N}  words p10=${pct(0.1)} p50=${pct(0.5)} p90=${pct(0.9)}  top sentence ${topRate.toFixed(0)}/100: "${top[0]?.[0].slice(0, 70) ?? ""}"`);
    if (topRate > 12) fail(s.name, `one sentence carries ${topRate.toFixed(0)} of 100 drafts`, top[0][0]);
    if (seen.size < N * 0.97) fail(s.name, `only ${seen.size}/${N} distinct drafts`, "");
  }
}
if (CHECK) {
  console.log(fails ? `\n${fails} problem(s)` : "\nOK: story path holds every invariant across the live EN configs");
  process.exitCode = fails ? 1 : 0;
}
