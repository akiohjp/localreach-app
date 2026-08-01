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
  let commaDump = 0, bannedHits = 0, doubleThe = 0;
  for (let i = 0; i < N; i++) {
    const t = generateReview(store, kws, opts());
    if (maxCommasInSentence(t) > 2) commaDump++;
    const low = t.toLowerCase();
    if (BANNED.some((b) => low.includes(b))) bannedHits++;
    if (/\bthe the\b/i.test(t)) doubleThe++;
  }
  // Article grammar with PROPER-NOUN / capitalized keywords ("Dubai Marina",
  // "Friendly Staff"): templates must not hardcode "the" before a slot — the
  // engine adds it only for lowercase phrases. Probe the capitalized set.
  const PROPER = ["Omakase", "Friendly Staff", "Dubai Marina", "Michelin Quality"];
  let badArticle = 0;
  for (let i = 0; i < 150; i++) {
    const t = generateReview("Marina Sushi", PROPER, { nonce: createReviewNonce(), outletKey: "art|restaurant|#000", locale: "en", category: "restaurant" });
    if (/\bthe (Omakase|Friendly Staff|Dubai Marina|Michelin Quality)\b/.test(t) || /\bthe the\b/i.test(t)) badArticle++;
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

  // ---- SEO / GEO / AIO signal (must SURVIVE the naturalness rework) ----
  // Naturalness must not cost discoverability: every review must still carry the
  // business name + all forced GEO keywords verbatim, and guest keywords must
  // rotate across reviews so the whole keyword set surfaces (AIO breadth).
  let nameMissing = 0;
  const kwFreq = Object.fromEntries(kws.map((k) => [k, 0]));
  for (let i = 0; i < N; i++) {
    const t = generateReview(store, kws, opts());
    if (!t.includes(store)) nameMissing++;
    for (const k of kws) if (t.includes(k)) kwFreq[k]++;
  }
  console.log("kw surfacing /" + N + ":", Object.entries(kwFreq).map(([k, v]) => `"${k}"=${v}`).join("  "));

  // ---- selection completeness (real-store bug: guest's picks vanished) ----
  // A guest who taps several pills must see ALL of them in the draft, not a
  // random subset. Probe a heavy 7-keyword selection.
  const selForced = ["fresh doughnuts", "best doughnuts in Dubai"];
  const selGuest = ["Boston Cream", "gift box", "Karak and doughnuts", "matcha latte", "cinnamon roll"];
  const selKws = [...selForced, ...selGuest];
  let selDrop = 0;
  for (let i = 0; i < 150; i++) {
    const t = generateReview(store, selKws, { nonce: createReviewNonce(), outletKey: "sel|cafe|#f97316", locale: "en", category: "cafe", forcedCount: selForced.length });
    if (!selKws.every((k) => t.includes(k))) selDrop++;
  }

  // ---- entity layer (AI visibility, 2026-07-29) ----
  // Every review must carry the entity ONCE via a dedicated sentence: the area
  // and the category noun present, never routed through the {kw} object slots
  // ("Definitely try Motor City" was the live-store bug), city ~1/3 of the
  // time, and no duplicate mention of area/cat from double weaving.
  const ENT = { area: "Motor City", city: "Dubai", categoryLabel: { en: "udon restaurant", ja: "うどん店", ar: "مطعم ياباني" } };
  const entOpts = (locale, extra = {}) => ({
    nonce: createReviewNonce(), outletKey: "ent|restaurant|#000", locale,
    category: "restaurant", entity: ENT, ...extra,
  });
  // {kw}-slot misuse detector: the object templates that made place names absurd.
  const KW_MISUSE = [
    /Definitely try (the )?Motor City/i, /No notes on (the )?Motor City/i,
    /Ask (about|them about) (the )?Motor City/i, /try (the )?Dubai\b/i,
    /Definitely try (the )?udon restaurant\b/i,
  ];
  let entAreaMiss = 0, entCatMiss = 0, entDupe = 0, entMisuse = 0, entCity = 0;
  const entSet = new Set();
  for (let i = 0; i < N; i++) {
    const t = generateReview("Maru Udon", ["handmade udon", "tempura"], entOpts("en"));
    entSet.add(t);
    if (!t.includes("Motor City")) entAreaMiss++;
    if (!t.includes("udon restaurant")) entCatMiss++;
    if (t.split("Motor City").length - 1 > 1) entDupe++;
    if (KW_MISUSE.some((re) => re.test(t))) entMisuse++;
    if (t.includes("Dubai")) entCity++;
  }
  // Dedupe guard: a forced keyword already carrying the area must NOT produce a
  // second area mention from the entity layer.
  let entForcedDupe = 0;
  for (let i = 0; i < 120; i++) {
    const t = generateReview("Maru Udon", ["best udon in Motor City", "tempura"], entOpts("en", { forcedCount: 1 }));
    if (t.split("Motor City").length - 1 > 1) entForcedDupe++;
  }
  // JA + AR: locale label used (not the EN one), area present.
  let entJaMiss = 0, entArMiss = 0;
  for (let i = 0; i < 120; i++) {
    const tj = generateReview("Maru Udon", ["手打ちうどん"], entOpts("ja"));
    if (!tj.includes("Motor City") || !tj.includes("うどん店")) entJaMiss++;
    const ta = generateReview("Maru Udon", ["أودون طازج"], entOpts("ar"));
    if (!ta.includes("Motor City") || !ta.includes("مطعم ياباني")) entArMiss++;
  }
  // No-keyword stores (zero pills configured) still get the entity.
  let entNoKw = 0;
  for (let i = 0; i < 120; i++) {
    const t = generateReview("Maru Udon", [], entOpts("en"));
    if (!t.includes("Motor City") || !t.includes("udon restaurant")) entNoKw++;
  }
  // Stores WITHOUT entity fields behave exactly as before (no leakage).
  let entLeak = 0;
  for (let i = 0; i < 120; i++) {
    const t = generateReview(store, kws, opts());
    if (/Motor City|udon restaurant/.test(t)) entLeak++;
  }

  // ---- store names ending in sentence punctuation (live client "Let It Dough!") ----
  // The "!" belongs to the NAME, not to a sentence, so a word CONTINUING that
  // sentence must stay lowercase ("Came to Let It Dough! for the first time").
  //
  // The word list is deliberately function words only. It used to include The /
  // A / Absolutely, which made this a false positive once the engine started
  // dropping the redundant terminator ("Let It Dough!." -> "Let It Dough!",
  // 2026-08-01): after that, a filler genuinely DOES open a new sentence there
  // ("...my next visit to Let It Dough! The kind of place you want to tell
  // people about."), which is correct English, not the bug. Function words can
  // never begin a pool sentence, so they still isolate the real defect.
  let punctName = 0;
  const PUNCT_AFTER =
    /(Let It Dough!|Smith & Co\.)\s+(For|On|And|Has|With|At|To|In|Was|Were|But|So|Then|Which|That)\b/;
  for (let i = 0; i < 400; i++) {
    for (const nm of ["Let It Dough!", "Smith & Co."]) {
      const t = generateReview(nm, ["premium doughnuts", "Boston Cream"], {
        nonce: createReviewNonce(), outletKey: "punct|cafe|#000", locale: "en", category: "cafe", forcedCount: 1,
      });
      if (PUNCT_AFTER.test(t)) punctName++;
      // The name is verbatim-protected; its own terminator must never be doubled.
      if (/[.!?]\s*[.!?]/.test(t)) punctName++;
    }
  }
  // Arabic entity join must not double the preposition ("في X في Y").
  let arDoubleFi = 0;
  for (let i = 0; i < 150; i++) {
    const t = generateReview("Pitfire Pizza", ["Pitfire Primo"], {
      nonce: createReviewNonce(), outletKey: "ar|restaurant|#000", locale: "ar", category: "restaurant",
      entity: { area: "Souk Al Bahar", city: "Dubai", categoryLabel: { ar: "مطعم بيتزا" } },
    });
    if (/في\s+\S+[^.]*?\s+في\s+Dubai/.test(t)) arDoubleFi++;
  }

  // ---- attribute-shaped keywords (owners type these; engine must absorb) ----
  // "great for groups" / "family friendly" / "clean and comfortable" are
  // descriptions, not things: they must never land in an object slot
  // ("Definitely try the family friendly") and must still appear verbatim.
  const ATTR_KWS = ["great for groups", "family friendly", "clean and comfortable", "no artificial colors"];
  const ATTR_BAD = [
    /\btry (the )?(great for|family friendly|clean and comfortable|no artificial)/i,
    /\bnotes on (the )?(great for|family friendly|clean and comfortable|no artificial)/i,
    /\bAsk (about|them about) (the )?(great for|family friendly|clean and comfortable|no artificial)/i,
    /\b(the )?(great for groups|family friendly|clean and comfortable|no artificial colors) (lived up|stood out|turned out|really stood)/i,
    /\bnailed the (great for|family friendly|clean and)/i,
    /\bWorth going back for (the )?(family friendly|clean and comfortable) alone/i,
  ];
  let attrMisuse = 0, attrMissing = 0;
  for (let i = 0; i < N; i++) {
    const t = generateReview("Marina Bistro", ["grilled seabass", ...ATTR_KWS], {
      nonce: createReviewNonce(), outletKey: "attr|restaurant|#000", locale: "en", category: "restaurant",
    });
    if (ATTR_BAD.some((re) => re.test(t))) attrMisuse++;
    if (!ATTR_KWS.every((k) => t.includes(k))) attrMissing++;
  }

  // ---- non-visit verticals get B2B entity lines, not "pop in" wording ----
  const VISIT_SHAPED = /(if you're near|stop by|worth the trip|pop in|nice to have a place)/i;
  let b2bVisit = 0, b2bMissing = 0;
  for (let i = 0; i < 200; i++) {
    const t = generateReview("mirAIreach", ["GEO strategy", "AI visibility report"], {
      nonce: createReviewNonce(), outletKey: "b2b|agency|#000", locale: "en", category: "agency",
      entity: { area: null, city: "Dubai", categoryLabel: { en: "AI SEO agency" } },
    });
    if (VISIT_SHAPED.test(t)) b2bVisit++;
    if (!t.includes("AI SEO agency") || !t.includes("Dubai")) b2bMissing++;
  }

  // ---- every vertical's STARTER KEYWORDS must generate cleanly ----
  // The presets ship to every new customer, so a bad phrase there is a defect in
  // every store of that industry. Each vertical x locale is generated with its
  // own preset list and checked for object-slot misuse + verbatim survival.
  const { keywordPresetsFor } = await import("../lib/keyword-presets.ts");
  const { resolveVertical } = await import("../lib/review-pools.ts");
  const VERT_CATS = [
    "restaurant", "cafe", "hair salon", "aesthetic clinic", "dental clinic", "medical clinic",
    "real estate agency", "law firm", "renovation contractor", "language school",
    "veterinary clinic", "boutique shop", "gym", "hotel", "car garage", "agency", "cleaning service", "",
  ];
  let presetMisuse = 0, presetDrop = 0, presetAttr = 0, presetCases = 0;
  const badPresetSamples = [];
  for (const cat of VERT_CATS) {
    const v = resolveVertical(cat);
    for (const loc of ["en", "ja", "ar"]) {
      const kws = keywordPresetsFor(v, loc);
      if (kws.length === 0) { presetDrop++; continue; }
      // Attribute-shaped presets would be our own authoring mistake.
      for (const k of kws) {
        if (loc === "en" && /^(great|good|perfect|ideal|nice)\s+(for|to)\b/i.test(k)) presetAttr++;
      }
      for (let i = 0; i < 12; i++) {
        presetCases++;
        const picked = kws.slice(i % 3, (i % 3) + 3);
        const t = generateReview("Test Business", picked, {
          nonce: createReviewNonce(), outletKey: `preset|${v}|${loc}`, locale: loc, category: cat,
          entity: { area: "Business Bay", city: "Dubai", categoryLabel: { en: "local business" } },
        });
        if (!picked.every((k) => t.includes(k))) { presetDrop++; if (badPresetSamples.length < 3) badPresetSamples.push(`${v}/${loc}: ${t.slice(0, 120)}`); }
        if (/\bthe the\b/i.test(t)) { presetMisuse++; if (badPresetSamples.length < 3) badPresetSamples.push(`${v}/${loc}: ${t.slice(0, 120)}`); }
      }
    }
  }
  if (badPresetSamples.length) console.log("preset problem samples:\n  " + badPresetSamples.join("\n  "));

  let fail = 0;
  const assert = (c, m) => { if (!c) { console.error("  ✗", m); fail++; } else console.log("  ✓", m); };
  assert(presetAttr === 0, `presets: no attribute-shaped starter keywords authored (got ${presetAttr})`);
  assert(presetDrop === 0, `presets: every starter keyword survives verbatim across ${presetCases} cases (got ${presetDrop})`);
  assert(presetMisuse === 0, `presets: no double-article breakage (got ${presetMisuse})`);
  assert(b2bVisit === 0, `B2B verticals: no visit-shaped entity wording (got ${b2bVisit})`);
  assert(b2bMissing === 0, `B2B verticals: entity still woven every time (missing ${b2bMissing})`);
  assert(attrMisuse === 0, `EN: attribute keywords never land in an object slot (got ${attrMisuse})`);
  assert(attrMissing === 0, `EN: attribute keywords still appear verbatim (missing in ${attrMissing})`);
  assert(punctName === 0, `EN: store name ending in "!"/"." does not capitalize the next word (got ${punctName})`);
  assert(arDoubleFi === 0, `AR: entity location never doubles "في" (got ${arDoubleFi})`);
  assert(entAreaMiss === 0, `entity: area in every review (missing ${entAreaMiss})`);
  assert(entCatMiss === 0, `entity: category noun in every review (missing ${entCatMiss})`);
  assert(entDupe === 0, `entity: area never mentioned twice (got ${entDupe})`);
  assert(entMisuse === 0, `entity: never routed through {kw} object templates (got ${entMisuse})`);
  // EN no longer pairs area + city: "in Dubai Hills, Dubai" reads like a
  // directory entry, not a guest (owner eye-check 2026-07-31). The area alone
  // carries the local signal; the city rides along only in JA, where "ドバイの
  // モーターシティ" is how people actually speak.
  assert(entCity === 0, `EN entity: city never appended to the area (got ${entCity}/${N})`);
  assert(entForcedDupe === 0, `entity: forced keyword carrying the area → no double mention (got ${entForcedDupe})`);
  assert(entJaMiss === 0, `entity JA: area + JA category label woven (missed ${entJaMiss})`);
  assert(entArMiss === 0, `entity AR: area + AR category label woven (missed ${entArMiss})`);
  assert(entNoKw === 0, `entity: woven even with zero keywords configured (missed ${entNoKw})`);
  assert(entLeak === 0, `entity: no leakage into stores without entity fields (got ${entLeak})`);
  assert(entSet.size === N, `entity: reviews still all unique (${entSet.size}/${N})`);
  assert(nameMissing === 0, `SEO: store name present in every review (missing ${nameMissing})`);
  assert(forced.every((k) => kwFreq[k] === N), `SEO: forced GEO keywords woven in 100% of reviews`);
  assert(guest.every((k) => kwFreq[k] === N), `selection: every guest-selected keyword appears in EVERY review (no vanishing)`);
  assert(selDrop === 0, `selection: all 7 of a heavy selection present every time (got ${selDrop} with drops)`);
  assert(spread >= 30, `length spread >= 30 (got ${spread})`);
  assert(kwMiss === 0, "forced keywords always present");
  assert(nameOver === 0, "store name never mentioned more than twice");
  assert(dashLeak === 0, "no typographic dashes");
  assert(set.size === N, "all unique");
  assert(avg(l4) < avg(l5), "4★ reads shorter than 5★");
  assert(commaDump === 0, `EN: no sentence crams >2 comma items i.e. keyword-dump (got ${commaDump})`);
  assert(doubleThe === 0, `EN: no "the the" double article (got ${doubleThe})`);
  assert(badArticle === 0, `EN: no "the <ProperNoun>" bad article with capitalized keywords (got ${badArticle})`);
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
