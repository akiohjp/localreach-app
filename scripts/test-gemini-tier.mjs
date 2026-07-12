/**
 * One-off: determine if GEMINI_API_KEY is FREE tier (~10 RPM → 429s in a burst)
 * or PAID Tier 1 (1000+ RPM → all pass). 14 tiny requests, ~5 tokens each.
 */
import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const key = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { console.error("no key"); process.exit(1); }

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
let ok = 0, r429 = 0, other = 0, firstErr = "";
for (let i = 1; i <= 14; i++) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }], generationConfig: { maxOutputTokens: 5 } }),
  });
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
console.log(`\n\nRESULT: ok=${ok} 429=${r429} other=${other}`);
console.log(r429 > 0 ? `VERDICT: FREE tier (throttled within a 14-req burst)\nquota detail: ${firstErr}` : "VERDICT: PAID tier behaviour (no throttle at burst; free tier is ~10 RPM)");
