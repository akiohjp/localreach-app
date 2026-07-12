/**
 * Verify owner-reply generation (run: node --import ./scripts/register-hook.mjs scripts/test-reply-generation.mjs)
 * Checks sentiment, specific-phrase extraction/reaction, GEO weave, variation,
 * length, no em/en dashes, store presence.
 */

async function main() {
  const { generateReply, createReplyNonce, sentimentForRating, detectThemes } =
    await import("../lib/reply-engine.ts");

  let fail = 0;
  const assert = (cond, msg) => { if (!cond) { console.error("  ✗", msg); fail++; } else console.log("  ✓", msg); };
  const store = "Let It Dough";

  console.log("\nTEST 1 — sentiment mapping");
  assert(sentimentForRating(5) === "positive", "5★ positive");
  assert(sentimentForRating(3) === "mixed", "3★ mixed");
  assert(sentimentForRating(1) === "negative", "1★ negative");

  console.log("\nTEST 2 — reacts to the SPECIFIC thing named");
  const r5 = generateReply(store, { rating: 5, reviewText: "The matcha croissant was amazing and the staff were so friendly.", locale: "en", nonce: "a" });
  assert(/matcha croissant|staff/.test(r5), "positive reply names a specific the guest praised: \n     " + r5.split("\n")[0]);
  const r1 = generateReply(store, { rating: 1, reviewText: "The coffee was cold and we waited far too long.", locale: "en", nonce: "b" });
  assert(/coffee|wait/.test(r1), "negative reply names the specific problem: \n     " + r1.split("\n")[0]);
  const r3 = generateReply(store, { rating: 3, reviewText: "The pastries were delicious but the service was slow.", locale: "en", nonce: "c" });
  assert(/pastries|service|slow/.test(r3), "mixed reply references praise and/or gripe");

  console.log("\nTEST 3 — no dashes, store present, sign-off break, all locales");
  for (const rating of [5, 3, 1]) for (const locale of ["en", "ja", "ar"]) {
    const txt = generateReply(store, { rating, reviewText: "great food and friendly staff, but a bit slow", locale, geoPhrase: "Dubai Marina", nonce: "fix" });
    assert(!/[—–]/.test(txt), `${locale} ${rating}★ no em/en dash`);
    assert(txt.includes(store) || locale !== "en", `${locale} ${rating}★ store present`);
    assert(txt.includes("\n\n"), `${locale} ${rating}★ sign-off break`);
  }

  console.log("\nTEST 4 — length (must NOT be short) + variation");
  const KWS = ["best doughnuts in Dubai", "fresh doughnuts", "UAE homegrown"];
  const lens = [];
  const set = new Set();
  let shortest = Infinity;
  for (let i = 0; i < 300; i++) {
    const t = generateReply(store, { rating: 5, reviewText: "amazing brownies and lovely staff, great coffee too", locale: "en", geoPhrase: "Dubai Marina", geoKeywords: KWS, nonce: createReplyNonce() });
    const n = t.replace(/\n\n[\s\S]*$/, "").split(/\s+/).length;
    lens.push(n);
    if (n < shortest) shortest = n;
    set.add(t);
  }
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  assert(avg >= 45, `avg body length ${avg.toFixed(0)} words (>=45; owner said too short at ~25)`);
  assert(shortest >= 28, `shortest of 300 is ${shortest} words (>=28; no more 2-line replies)`);
  assert(set.size >= 298, `300 regenerations → ${set.size} distinct drafts (>=298)`);

  console.log("\nTEST 5 — GEO/AIO signals in nearly every positive reply");
  let geoHits = 0, kwHits = 0, brandOrSig = 0, anySeo = 0;
  for (let i = 0; i < 200; i++) {
    const t = generateReply(store, { rating: 5, reviewText: "lovely cake", locale: "en", geoPhrase: "Dubai Marina", geoKeywords: KWS, nonce: createReplyNonce() });
    const hasGeo = t.includes("Dubai Marina");
    const hasKw = KWS.some((k) => t.includes(`"${k}"`));
    if (hasGeo) geoHits++;
    if (hasKw) kwHits++;
    if (t.split(store).length > 2) brandOrSig++; // store name beyond the sign-off
    if (hasGeo || hasKw) anySeo++;
  }
  assert(geoHits >= 120, `locality woven often (${geoHits}/200, target ~90% capped by 2-beat budget)`);
  assert(kwHits >= 100, `a quoted GEO keyword woven often (${kwHits}/200)`);
  assert(anySeo >= 190, `nearly every positive reply carries geo or keyword (${anySeo}/200)`);
  assert(!generateReply(store, { rating: 1, reviewText: "cold food", locale: "en", geoPhrase: "Dubai Marina", geoKeywords: KWS, nonce: "z" }).includes("Dubai Marina"), "apology never weaves locality");
  assert(!generateReply(store, { rating: 1, reviewText: "cold food", locale: "en", geoPhrase: "Dubai Marina", geoKeywords: KWS, nonce: "z2" }).includes('"best doughnuts'), "apology never weaves keywords");

  console.log("\nTEST 6 — negative invites direct contact");
  assert(/reach out|contact us|get in touch/i.test(generateReply(store, { rating: 1, reviewText: "rude and dirty", locale: "en", nonce: "n" })), "negative → make-it-right");

  console.log("\nTEST 7 — JA specific extraction (particle-safe)");
  const ja5 = generateReply("桜寿司", { rating: 5, reviewText: "お寿司がとても美味しく、スタッフの対応も丁寧でした。", locale: "ja", nonce: "j1" });
  assert(/お寿司|スタッフの対応/.test(ja5), "JA positive names the praised specific: \n     " + ja5.split("\n")[0]);
  assert(!/お寿司がとて[^も]/.test(ja5), "no particle bleed (お寿司がとて…)");
  const ja1 = generateReply("桜寿司", { rating: 1, reviewText: "待ち時間が長すぎたし、店内が汚かった。", locale: "ja", nonce: "j2" });
  assert(/待ち時間|店内/.test(ja1), "JA negative names the problem: \n     " + ja1.split("\n")[0]);

  console.log("\nTEST 8 — custom signature");
  const sig = generateReply(store, { rating: 5, reviewText: "great cakes", locale: "en", signature: "Akio, Owner of {store}", nonce: "sg" });
  assert(sig.trim().endsWith("Akio, Owner of Let It Dough"), "custom signature used verbatim with {store} replaced");

  console.log("\nTEST 9 — template inventory (owner asked for 100-200+)");
  const { REPLY_POOLS } = await import("../lib/reply-pools.ts");
  const counts = {};
  for (const [loc, pools] of Object.entries(REPLY_POOLS)) {
    counts[loc] = Object.values(pools).reduce((n, pool) => n + Object.values(pool).reduce((m, arr) => m + arr.length, 0), 0);
  }
  console.log("  templates per locale:", JSON.stringify(counts));
  assert(counts.en >= 250, `EN has ${counts.en} templates (>=250)`);
  assert(counts.ja >= 150, `JA has ${counts.ja} templates (>=150)`);
  assert(counts.ar >= 80, `AR has ${counts.ar} templates (>=80)`);

  console.log("\n─── SAMPLES (EN, warm, geo+kw like Let It Dough) ───");
  const reviews = [
    [5, "The matcha croissant was incredible and the staff were so warm. Cosy spot too."],
    [5, "Best brownies in Dubai. Coffee was excellent and the service was quick and friendly."],
    [4, "Really nice cakes and a lovely atmosphere. A touch pricey but worth it."],
    [3, "The doughnuts were delicious but we waited ages and the place was a bit noisy."],
    [2, "Coffee was cold, the counter was messy, and the staff seemed rushed."],
    [1, "Overpriced and the pastries were stale. Won't be back."],
  ];
  for (const [rating, text] of reviews) {
    console.log(`\n[${rating}★] review: "${text}"\n→ ` + generateReply(store, { rating, reviewText: text, locale: "en", tone: "warm", geoPhrase: "Dubai Marina", geoKeywords: KWS, nonce: `s${rating}${text.length}` }).replace(/\n\n/g, "\n   "));
  }
  console.log("\n─── SAMPLE (JA) ───");
  console.log(generateReply("桜寿司", { rating: 5, reviewText: "お寿司がとても新鮮で、スタッフの対応も丁寧でした。落ち着ける雰囲気も良かったです。", locale: "ja", geoPhrase: "ドバイ・マリーナ", nonce: "ja1" }));

  console.log(fail === 0 ? "\nALL PASS ✅" : `\n${fail} FAILURES ❌`);
  process.exitCode = fail === 0 ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exit(1); });
