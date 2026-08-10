/**
 * Assign a TYPE to every keyword on every live store.
 *
 * The engine can only route a keyword correctly if it knows what the keyword
 * names (see classifyKeyword). Until a keyword is typed it falls back to the
 * old guess, and the guess treats anything that is not a geo phrase or an
 * attribute as "a thing you order" — which is what produced "Big yes to
 * Japanese and Korean groceries." and "Kotobuki Clinic nailed AGA Treatment."
 *
 * The test for each type, in the words that actually decide it:
 *   item      — one specific orderable/buyable thing. A dish, a product, a
 *               named procedure. Survives into a Japanese or Arabic review,
 *               because a guest really does write the English menu name.
 *   category  — a CLASS of what the business sells ("Korean skincare",
 *               "luxury rugs"). Never survives into a non-English review: a
 *               Japanese guest writes the class in Japanese.
 *   service   — something done for the guest, or a field of practice
 *               ("regenerative medicine", "worldwide shipping").
 *   attribute — a quality or a fit, not a thing ("crispy crust", "good value").
 *   geo       — a buyer search phrase, "<what> in <where>".
 *
 * Usage: node scripts/set-keyword-types.mjs [--apply]   (default: dry run)
 */
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  // Run from either checkout: the monorepo (relative hop) or the deploy repo
  // itself, which is where the keys live.
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "../../../dev/localreach-app/.env.local"),
  ];
  const p = candidates.find((c) => fs.existsSync(c));
  if (!p) throw new Error(`env not found: ${candidates.join(" | ")}`);
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
  }
}

/** Per-store overrides. Anything not listed is typed by the rules below. */
const TYPES = {
  "Kotobuki Clinic": {
    service: ["regenerative medicine", "IV Drip", "IV Therapy", "Exosome Therapy",
              "Hydrogen Inhalation Therapy", "Peptide Therapy", "HydraFacial",
              "Acne Scar Treatment", "AGA Treatment", "Vitamin IV",
              "Diabetes & Metabolism Programme", "Weight Management Programme",
              "Medical Wellness Check", "Anti-Aging Treatment", "Skin Rejuvenation",
              "Aesthetics Therapy", "Kotobuki Scar Regenerative Formula"],
  },
  "1004 Gourmet": {
    category: ["Japanese and Korean groceries", "Korean snacks", "halal products",
               "Japanese groceries", "K-Beauty", "Korean skincare", "Korean makeup"],
  },
  "Maru Udon": {
    // Lowercase descriptive phrases are prose, not menu names — they must not
    // reach a Japanese review. The Title-Case menu names do, and should.
    category: ["sanuki-style udon", "handmade udon noodles", "vegan udon options"],
    attribute: ["sanuki-style broth"],
  },
  "Pitfire Pizza": {
    category: ["artisan pizza", "oven-fresh pizza"],
    // "Keep an eye out for the comfortable seating." — the item frames want
    // something you ordered (naturalness reader, both runs, 2026-08-10).
    attribute: ["comfortable seating", "good value", "quick service", "friendly team", "crispy crust"],
  },
  "Cinar Rugs Dubai": {
    category: ["luxury rugs", "silk rugs", "Anatolian designs", "one-of-a-kind pieces",
               "museum-quality pieces", "collector's pieces"],
    item: ["showroom visit", "signature collection"],
    service: ["bespoke design", "custom sizing", "interior advice", "worldwide shipping"],
    // A quality is not a thing you picked: "My pick: the heirloom quality."
    // (naturalness reader, both runs, 2026-08-10).
    attribute: ["heirloom quality", "intricate patterns", "master weavers"],
  },
  "Cinar Rugs Istanbul": {
    item: ["rug weaving demonstration", "showroom tour"],
    // "near THE Grand Bazaar" — the lowercase article defeats the geo regex in
    // the engine, so this phrase had been running as an item all along.
    geo: ["Turkish kilims near the Grand Bazaar"],
    category: ["silk rugs", "wool kilims", "antique rugs", "Hereke silk", "one-of-a-kind pieces",
               "museum-quality pieces", "collector's pieces", "wall hangings"],
    service: ["worldwide shipping", "custom sizing"],
    attribute: ["no pressure to buy"],
  },
  "Cinar Rugs Cappadocia": {
    category: ["silk rugs", "wool kilims", "one-of-a-kind pieces",
               "museum-quality pieces", "wall hangings"],
    item: ["rug weaving demonstration", "showroom tour"],
    service: ["worldwide shipping", "custom sizing"],
    attribute: ["no pressure to buy"],
  },
  "Let It Dough!": {
    category: ["premium doughnuts", "fresh doughnuts", "office treats"],
    // "UAE homegrown" and "Great options for drinks" were typed as items, so
    // every object slot took them: "The star of the visit was the UAE
    // homegrown, no contest." They describe the business, not a thing anyone
    // ordered (naturalness reader, 2026-08-10).
    attribute: ["no artificial colors", "perfect for gifts", "great for parties and events",
                "UAE homegrown", "Great options for drinks"],
  },
  "Ocha Cafe Sakura": {
    category: ["matcha whisk and bowl sets", "Japanese sweets in a gift box",
               "tea sets with gift wrapping"],
  },
  // Japanese-locale stores. The JA service frames assume something DONE FOR the
  // guest ("〜を受けました"), so a practice bay the guest uses is an item, not a
  // service — only the coached lessons are services.
  "Sushidokoro Tsukasa": {
    category: ["旬の魚", "デザート", "日本酒"],
    attribute: ["一人でも入りやすい", "ランチが手頃", "子連れでも入りやすい", "明朗会計"],
  },
  "Sengawa Golf": {
    service: ["プロのレッスン", "体験レッスン"],
    attribute: ["入場料無料", "65球700円", "36打席", "無料の駐車場", "駅から歩ける立地",
                "夜22時までの営業", "静かな練習環境", "ふらっと立ち寄れる気軽さ"],
  },
  "mirAIreach": {
    // Visibility and rankings are outcomes of work done, not stock you browse:
    // "Plenty of ChatGPT visibility to choose from." was the giveaway.
    service: ["local SEO work", "GEO strategy", "AIO optimization", "AI SEO audit",
              "AEO content", "AI visibility report", "Google Business Profile setup",
              "Google review management", "AI business automation", "website design",
              "structured data setup", "free AI visibility scan", "monthly reporting",
              "AI Overviews visibility", "ChatGPT visibility", "Google Maps ranking",
              "QR review system"],
    // How we sell, not what we deliver: "They took ownership of the clear flat
    // pricing and it shows." (naturalness reader, 2026-08-10).
    attribute: ["clear flat pricing", "honest measurable results", "no long contracts"],
  },
};

/** Rule fallback for anything not named above. Mirrors the engine's inference. */
function ruleType(kw) {
  if (/\b(in|near|around)\s+[A-Z]/.test(kw) && /\s/.test(kw)) return "geo";
  if (/^(great|good|perfect|ideal|nice|excellent)\s+(for|to)\b/i.test(kw)) return "attribute";
  if (/^(no|not)\s/i.test(kw)) return "attribute";
  return "item";
}

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const res = await fetch(
  `${url}/rest/v1/stores?select=id,store_name,keywords,forced_keywords&is_active=eq.true`,
  { headers },
);
if (!res.ok) throw new Error(await res.text());

for (const st of await res.json()) {
  const name = st.store_name?.en ?? Object.values(st.store_name ?? {})[0] ?? "";
  const override = TYPES[name];
  if (!override) { console.log(`skip (no map): ${name}`); continue; }
  const all = [...(st.forced_keywords ?? []), ...(st.keywords ?? [])];
  const map = {};
  for (const kw of all) {
    let t = null;
    for (const [type, list] of Object.entries(override)) if (list.includes(kw)) t = type;
    map[kw] = t ?? ruleType(kw);
  }
  const counts = Object.values(map).reduce((a, t) => ((a[t] = (a[t] ?? 0) + 1), a), {});
  console.log(`${name}: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  if (!APPLY) continue;
  const up = await fetch(`${url}/rest/v1/stores?id=eq.${st.id}`, {
    method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ keyword_types: map }),
  });
  if (!up.ok) console.log(`   FAILED: ${up.status} ${await up.text()}`);
  else console.log(`   applied`);
}
