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

  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error("  ✗", m); fail++; } else console.log("  ✓", m); };
  assert(spread >= 30, `length spread >= 30 (got ${spread})`);
  assert(kwMiss === 0, "forced keywords always present");
  assert(nameOver === 0, "store name never mentioned more than twice");
  assert(dashLeak === 0, "no typographic dashes");
  assert(set.size === N, "all unique");
  assert(avg(l4) < avg(l5), "4★ reads shorter than 5★");
  console.log(fail === 0 ? "ALL PASS ✅" : `${fail} FAILURES ❌`);
  process.exitCode = fail === 0 ? 0 : 1;

  console.log("\n── 3 samples ──");
  for (let i = 0; i < 3; i++) console.log(`\n[${i + 1}]`, generateReview(store, kws, opts()));

  console.log("\n── JA sample ──");
  console.log(generateReview("桜寿司", ["新鮮なネタ", "落ち着いた雰囲気"], { nonce: createReviewNonce(), outletKey: "a|restaurant|#000", locale: "ja", category: "restaurant", forcedCount: 1 }));
}
main().catch((e) => { console.error(e); process.exit(1); });
