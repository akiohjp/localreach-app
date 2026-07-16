/**
 * Debugger audit of CUSTOMER review generation quality.
 * Checks: length distribution (pattern tell), opener variety, keyword coverage,
 * uniqueness, dash leaks — with Let It Dough-like config.
 */
async function main() {
  const { generateReview, createReviewNonce } = await import("../lib/assembler.ts");

  const store = "Let It Dough";
  const forced = ["fresh doughnuts", "best doughnuts in Dubai"];
  const guest = ["Boston Cream", "gift box", "Karak and doughnuts"];
  const kws = [...forced, ...guest];
  const opts = () => ({ nonce: createReviewNonce(), outletKey: "audit|cafe|#f97316", locale: "en", category: "cafe", forcedCount: forced.length });

  const N = 300;
  const lens = [];
  const openers = {};
  const set = new Set();
  let dashLeak = 0, kwMiss = 0, nameOver = 0;
  for (let i = 0; i < N; i++) {
    const t = generateReview(store, kws, opts());
    const words = t.split(/\s+/).filter(Boolean).length;
    lens.push(words);
    const first3 = t.split(/\s+/).slice(0, 3).join(" ");
    openers[first3] = (openers[first3] || 0) + 1;
    set.add(t);
    if (/[—–]/.test(t)) dashLeak++;
    for (const k of forced) if (!t.toLowerCase().includes(k.toLowerCase())) { kwMiss++; break; }
    if (t.split(store).length - 1 > 2) nameOver++;
  }
  lens.sort((a, b) => a - b);
  const pct = (p) => lens[Math.floor((lens.length - 1) * p)];
  const spread = pct(0.9) - pct(0.1);
  console.log(`words: min=${lens[0]} p10=${pct(0.1)} p50=${pct(0.5)} p90=${pct(0.9)} max=${lens[lens.length - 1]}`);
  console.log(`spread p90-p10 = ${spread} words  (real reviews vary WIDELY: 20~150)`);
  console.log(`unique: ${set.size}/${N}   dashLeak=${dashLeak}   forcedKw missing=${kwMiss}   nameMentions>2: ${nameOver}`);
  const topOpeners = Object.entries(openers).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log("top openers:", topOpeners.map(([k, v]) => `"${k}"×${v}`).join("  "));

  // 4★ vs 5★ average length (4★ should read shorter/more measured)
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const l4 = [], l5 = [];
  for (let i = 0; i < 150; i++) {
    l4.push(generateReview(store, kws.slice(0, 3), { ...opts(), rating: 4 }).split(/\s+/).length);
    l5.push(generateReview(store, kws.slice(0, 3), { ...opts(), rating: 5 }).split(/\s+/).length);
  }
  console.log(`4★ avg=${avg(l4)} words vs 5★ avg=${avg(l5)} words (4★ should be shorter)`);

  // ---- naturalness guards (the human-ness checks the old audit lacked) ----
  // These catch the two complaints that "ALL PASS" used to miss: keyword-dump
  // comma-lists, and meta / AI-tell phrases. A sentence with >2 commas is the
  // signature of "A, B, C, D and E" stuffing.
  const BANNED = [
    "bolted on", "sound fake", "reviews all sound", "write an essay",
    "honest shorthand", "framed the start", "finished the impression", "quiet wins",
  ];
  const maxCommasInSentence = (t) =>
    Math.max(0, ...t.split(/[.!?\n]+/).map((s) => (s.match(/,/g) || []).length));
  let commaDump = 0, bannedHits = 0;
  for (let i = 0; i < N; i++) {
    const t = generateReview(store, kws, opts());
    if (maxCommasInSentence(t) > 2) commaDump++;
    const low = t.toLowerCase();
    if (BANNED.some((b) => low.includes(b))) bannedHits++;
  }
  // Cross-locale meta-phrase scan (JA/AR pools carried the same tells).
  const scanLocale = (locale, cat, kwset, banned) => {
    let hits = 0;
    for (let i = 0; i < 120; i++) {
      const t = generateReview(store, kwset, { nonce: createReviewNonce(), outletKey: `a|${cat}|#000`, locale, category: cat });
      if (banned.some((b) => t.includes(b))) hits++;
    }
    return hits;
  };
  const jaHits = scanLocale("ja", "restaurant", ["新鮮なネタ", "落ち着いた雰囲気"], ["取ってつけた", "当てにならない", "素直なメモ", "話半分", "削ぎ落と"]);
  const arHits = scanLocale("ar", "restaurant", ["مذاق رائع", "أجواء هادئة"], ["مقحم", "منمّق", "مزيف", "لست هنا لأكتب"]);

  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error("  ✗", m); fail++; } else console.log("  ✓", m); };
  assert(spread >= 30, `length spread >= 30 (got ${spread})`);
  assert(kwMiss === 0, "forced keywords always present");
  assert(nameOver === 0, "store name never mentioned more than twice");
  assert(dashLeak === 0, "no typographic dashes");
  assert(set.size === N, "all unique");
  assert(avg(l4) < avg(l5), "4★ reads shorter than 5★");
  assert(commaDump === 0, `EN: no sentence crams >2 comma items i.e. keyword-dump (got ${commaDump})`);
  assert(bannedHits === 0, `EN: no meta/AI-tell phrases (got ${bannedHits})`);
  assert(jaHits === 0, `JA: no meta/AI-tell phrases (got ${jaHits})`);
  assert(arHits === 0, `AR: no meta/AI-tell phrases (got ${arHits})`);
  console.log(fail === 0 ? "ALL PASS ✅" : `${fail} FAILURES ❌`);
  process.exitCode = fail === 0 ? 0 : 1;

  console.log("\n── EN samples ──");
  for (let i = 0; i < 4; i++) console.log(`\n[${i + 1}]`, generateReview(store, kws, opts()));

  const jaOpts = () => ({ nonce: createReviewNonce(), outletKey: "a|restaurant|#000", locale: "ja", category: "restaurant", forcedCount: 1 });
  console.log("\n── JA samples ──");
  for (let i = 0; i < 3; i++) console.log(`\n[${i + 1}]`, generateReview("桜寿司", ["新鮮なネタ", "落ち着いた雰囲気", "接客"], jaOpts()));

  const arOpts = () => ({ nonce: createReviewNonce(), outletKey: "a|restaurant|#000", locale: "ar", category: "restaurant", forcedCount: 1 });
  console.log("\n── AR samples ──");
  for (let i = 0; i < 3; i++) console.log(`\n[${i + 1}]`, generateReview("مطعم الساكورا", ["مذاق رائع", "أجواء هادئة", "خدمة ممتازة"], arOpts()));
}
main().catch((e) => { console.error(e); process.exit(1); });
