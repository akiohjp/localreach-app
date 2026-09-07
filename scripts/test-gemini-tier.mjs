/**
 * One-off: determine if GEMINI_API_KEY is FREE tier (~10 RPM → 429s in a burst)
 * or PAID (1000+ RPM → all pass). 20 tiny requests, ~5 tokens each: the lite
 * models allow 15 RPM on the free tier, so a burst of 14 proves nothing.
 *
 * Probes a model ladder first: keys issued after mid-2026 answer 404 on the
 * pinned 2.5 names, and a burst of 404s says nothing about the tier (the
 * original single-model version read that as PAID on 2026-09-06).
 */
import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const key = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { console.error("no key"); process.exit(1); }

const MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"];
const call = (model) =>
  fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }], generationConfig: { maxOutputTokens: 5 } }),
  });

let model = null;
for (const m of MODELS) {
  const res = await call(m);
  process.stdout.write(`probe ${m}: ${res.status}\n`);
  if (res.status !== 404) { model = m; break; }
}
if (!model) {
  console.log("\nVERDICT: INCONCLUSIVE, every model in the ladder answered 404 for this key");
  process.exit(2);
}

let ok = 0, r429 = 0, other = 0, firstErr = "";
for (let i = 1; i <= 20; i++) {
  const res = await call(model);
  if (res.ok) ok++;
  else if (res.status === 429) {
    r429++;
    if (!firstErr) {
      const j = await res.json().catch(() => null);
      firstErr = JSON.stringify(j?.error?.details?.find?.((d) => d["@type"]?.includes("QuotaFailure")) ?? j?.error?.message ?? "").slice(0, 300);
    }
  } else other++;
  process.stdout.write(`${i}:${res.status} `);
}
console.log(`\n\nRESULT (${model}): ok=${ok} 429=${r429} other=${other}`);
if (r429 > 0) console.log(`VERDICT: FREE tier (throttled within a 20-req burst)\nquota detail: ${firstErr}`);
else if (ok >= 16) console.log("VERDICT: PAID tier behaviour (20 requests in one burst, no throttle; free tier is 10 to 15 RPM)");
else console.log("VERDICT: INCONCLUSIVE (requests failed for a reason other than quota)");
