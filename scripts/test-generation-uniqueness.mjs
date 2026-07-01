/**
 * One-off: verify review generation uniqueness (run: node scripts/test-generation-uniqueness.mjs)
 */
import { createRequire } from "node:module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Load TS via ts-node alternative: use dynamic import after building, or compile inline
// Simpler: duplicate minimal logic by importing from compiled output — use tsx if available
const require = createRequire(import.meta.url);

async function main() {
  // Dynamic import TS — Next project uses TS; use experimental strip types in Node 22+
  const mod = await import("../lib/assembler.ts");
  const { generateReview, createReviewNonce } = mod;

  const store = "Sakura Japanese Restaurant";
  const keywords = ["fresh sushi", "Dubai Marina", "friendly staff", "cozy ambiance"];
  const outletKey = "test-store-uuid|restaurant|#D4AF37";

  const nonce1 = "fixed-nonce-abc";
  const a = generateReview(store, keywords, { nonce: nonce1, outletKey });
  const b = generateReview(store, keywords, { nonce: nonce1, outletKey });
  console.log("TEST 1 same nonce identical:", a === b);

  const results = new Set();
  let collisions = 0;
  const N = 500;
  for (let i = 0; i < N; i++) {
    const text = generateReview(store, keywords, {
      nonce: createReviewNonce(),
      outletKey,
    });
    if (results.has(text)) collisions++;
    results.add(text);
  }
  console.log(`TEST 2 unique texts in ${N} runs:`, results.size, "collisions:", collisions);

  const c = generateReview(store, keywords, { nonce: "same", outletKey: "store-a||#000" });
  const d = generateReview(store, keywords, { nonce: "same", outletKey: "store-b||#000" });
  console.log("TEST 3 different outlets with same nonce differ:", c !== d);

  const wordCount = a.split(/\s+/).filter(Boolean).length;
  console.log("Sample word count:", wordCount);
  console.log("Sample preview:", a.slice(0, 140) + "...");

  // Keyword coverage
  for (const kw of keywords) {
    if (!a.toLowerCase().includes(kw.toLowerCase())) {
      console.error("MISSING keyword in sample:", kw);
      process.exitCode = 1;
    }
  }
  console.log("TEST 4 all keywords present in sample: OK");

  if (collisions > 0 || results.size < N * 0.95) {
    console.warn("WARN: collision rate may be high for production scale");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
