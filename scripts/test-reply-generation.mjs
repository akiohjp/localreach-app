/**
 * One-off: verify owner-reply generation (run: node scripts/test-reply-generation.mjs)
 * Requires Node 22+ (native TS import). Checks sentiment, theme detection,
 * variation across regenerations, no em/en dashes, and store/sign-off presence.
 */

async function main() {
  const { generateReply, createReplyNonce, sentimentForRating, detectThemes } =
    await import("../lib/reply-engine.ts");

  let fail = 0;
  const assert = (cond, msg) => {
    if (!cond) { console.error("  ✗", msg); fail++; }
    else console.log("  ✓", msg);
  };

  const store = "Sakura Japanese Restaurant";

  console.log("\nTEST 1 — sentiment mapping");
  assert(sentimentForRating(5) === "positive", "5★ → positive");
  assert(sentimentForRating(4) === "positive", "4★ → positive");
  assert(sentimentForRating(3) === "mixed", "3★ → mixed");
  assert(sentimentForRating(2) === "negative", "2★ → negative");
  assert(sentimentForRating(1) === "negative", "1★ → negative");

  console.log("\nTEST 2 — theme detection (en)");
  assert(detectThemes("The staff were so friendly", "en")[0] === "staff", "staff detected");
  assert(detectThemes("food was cold and the wait was long", "en").includes("wait"), "wait detected");
  assert(detectThemes("", "en").length === 0, "empty → no theme");

  console.log("\nTEST 3 — no typographic dashes, has store + double newline");
  for (const rating of [5, 3, 1]) {
    for (const locale of ["en", "ja", "ar"]) {
      const txt = generateReply(store, {
        rating,
        reviewText: "great service and food, friendly staff",
        locale,
        nonce: "fixed",
      });
      assert(!/[—–]/.test(txt), `${locale} ${rating}★ no em/en dash`);
      assert(txt.includes(store), `${locale} ${rating}★ contains store name`);
      assert(txt.includes("\n\n"), `${locale} ${rating}★ has sign-off break`);
    }
  }

  console.log("\nTEST 4 — determinism + variation");
  const a = generateReply(store, { rating: 5, reviewText: "amazing food", locale: "en", nonce: "n1" });
  const b = generateReply(store, { rating: 5, reviewText: "amazing food", locale: "en", nonce: "n1" });
  assert(a === b, "same nonce → identical");
  const set = new Set();
  for (let i = 0; i < 200; i++) {
    set.add(generateReply(store, { rating: 5, reviewText: "amazing food and great service", locale: "en", nonce: createReplyNonce() }));
  }
  assert(set.size > 40, `200 regenerations → ${set.size} distinct drafts`);

  console.log("\nTEST 5 — negative reply invites direct contact (make-it-right)");
  const neg = generateReply(store, { rating: 1, reviewText: "rude staff, terrible service", locale: "en", nonce: "neg" });
  assert(/reach out|contact us|get in touch|contact us directly/i.test(neg), "negative invites direct contact");

  console.log("\nTEST 6 — GEO weave (Local SEO)");
  let geoHits = 0;
  for (let i = 0; i < 100; i++) {
    const r = generateReply(store, { rating: 5, reviewText: "lovely food", locale: "en", geoPhrase: "Dubai Marina", nonce: createReplyNonce() });
    if (r.includes("Dubai Marina")) geoHits++;
  }
  assert(geoHits > 50 && geoHits < 100, `positive replies weave locality ~72% of the time (${geoHits}/100)`);
  const negGeo = generateReply(store, { rating: 1, reviewText: "cold food", locale: "en", geoPhrase: "Dubai Marina", nonce: "x" });
  assert(!negGeo.includes("Dubai Marina"), "apology never weaves locality");
  const off = generateReply(store, { rating: 5, reviewText: "great", locale: "en", geoPhrase: "Dubai Marina", weaveGeo: false, nonce: "y" });
  assert(!off.includes("Dubai Marina"), "weaveGeo:false suppresses locality");

  console.log("\nTEST 7 — anti-AI: opener variety + length variation");
  const openers = {};
  const lengths = new Set();
  for (let i = 0; i < 200; i++) {
    const r = generateReply(store, { rating: 5, reviewText: "amazing food and friendly staff", locale: "en", geoPhrase: "Dubai Marina", nonce: createReplyNonce() });
    const firstWord = r.split(/\s+/)[0];
    openers[firstWord] = (openers[firstWord] || 0) + 1;
    lengths.add(r.split(/\s+/).length);
  }
  const topOpenerShare = Math.max(...Object.values(openers)) / 200;
  assert(topOpenerShare < 0.5, `no single opening word dominates (top ${(topOpenerShare * 100).toFixed(0)}%)`);
  assert(lengths.size > 8, `reply length varies (${lengths.size} distinct word counts)`);

  console.log("\n─── SAMPLES ───");
  const g = "Dubai Marina";
  console.log("\n[5★ warm, EN +geo]\n" + generateReply(store, { rating: 5, reviewText: "The sushi was incredibly fresh and the staff were lovely.", locale: "en", tone: "warm", geoPhrase: g, nonce: "s1" }));
  console.log("\n[5★ warm, EN +geo, alt]\n" + generateReply(store, { rating: 5, reviewText: "The sushi was incredibly fresh and the staff were lovely.", locale: "en", tone: "warm", geoPhrase: g, nonce: "s1b" }));
  console.log("\n[3★ pro, EN +geo]\n" + generateReply(store, { rating: 3, reviewText: "Food was good but we waited far too long.", locale: "en", tone: "professional", geoPhrase: g, nonce: "s2" }));
  console.log("\n[1★ pro, EN]\n" + generateReply(store, { rating: 1, reviewText: "Cold food and the place wasn't clean.", locale: "en", tone: "professional", geoPhrase: g, nonce: "s3" }));
  console.log("\n[5★ warm, JA +geo]\n" + generateReply("桜寿司", { rating: 5, reviewText: "お料理がとても美味しく、スタッフの対応も丁寧でした。", locale: "ja", tone: "warm", geoPhrase: "ドバイ・マリーナ", nonce: "s4" }));
  console.log("\n[2★ pro, JA]\n" + generateReply("桜寿司", { rating: 2, reviewText: "料理は良かったが、待ち時間が長すぎた。", locale: "ja", tone: "professional", geoPhrase: "ドバイ・マリーナ", nonce: "s5" }));

  console.log(fail === 0 ? "\nALL PASS ✅" : `\n${fail} FAILURES ❌`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
