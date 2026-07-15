/**
 * Live check: the REAL prompt (lib/reply-prompt.ts) on rating-only reviews.
 * Reads GEMINI_API_KEY from .env.local (never printed). Prints replies only.
 */
import { readFileSync } from "node:fs";
import { buildPrompt, LANGUAGE_NAME } from "@/lib/reply-prompt";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const key = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { console.error("no key"); process.exit(1); }

async function gen(rating, locale) {
  const prompt = buildPrompt({
    storeName: "Let it dough", rating, reviewText: "",
    language: LANGUAGE_NAME[locale], tone: "warm",
    geoPhrase: "Dubai Marina",
    geoKeywords: ["best doughnuts in Dubai", "artisan bakery Dubai Marina"],
    signature: "",
  });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.05, topP: 0.95, maxOutputTokens: 4096 } }) },
  );
  if (!res.ok) return `HTTP ${res.status}`;
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("").trim() ?? "(empty)";
}

for (const [rating, locale] of [[5, "en"], [3, "en"], [1, "en"], [5, "ja"], [1, "ja"]]) {
  console.log(`\n═══ ${rating}★ rating-only (${locale}) ═══`);
  console.log(await gen(rating, locale));
  await new Promise((r) => setTimeout(r, 4000)); // free-tier RPM headroom
}
