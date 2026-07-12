/**
 * One-off: validate GEMINI_API_KEY + the reply prompt end-to-end.
 * Reads the key from .env.local (never printed). Prints only generated replies.
 * Run: node scripts/test-gemini-reply.mjs
 */
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const key = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { console.error("no key"); process.exit(1); }

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

function buildPrompt(p) {
  const sentiment = p.rating >= 4 ? "positive" : p.rating <= 2 ? "negative" : "mixed";
  const kwList = p.geoKeywords.map((k) => `"${k}"`).join(", ");
  return `You are the owner of "${p.storeName}", a small local business, personally replying to a customer's public Google review. Write ONE reply.

THE REVIEW (${p.rating}/5 stars):
"""
${p.reviewText || "(The guest left a rating but no text.)"}
"""

HOW TO WRITE IT:
- READ the review carefully and respond to its actual content. Reference the specific things the guest mentioned (dishes, staff moments, complaints, details) in your own words. Never write a reply that could be pasted under a different review.
- Voice: a real human owner. Warm, personal, lightly conversational. Use contractions. Vary sentence length. No corporate boilerplate ("we strive to", "your satisfaction is our priority"), no exclamation spam, and DO NOT start with "Thank you for" or "Thanks for" (start some other natural way).
- Length: 4 to 7 sentences (${sentiment === "negative" ? "keep it focused and sincere" : "substantial, not a two-liner"}).
- Never use em dashes or en dashes.
${sentiment === "negative"
    ? `- This is an apology: acknowledge the specific failures plainly, take responsibility without excuses, and invite the guest to contact you directly to make it right. Do NOT include marketing phrases, keywords, or the neighbourhood. Stay humble.`
    : `- Local SEO (weave these in NATURALLY, never as a list, never forced):
  * Mention the business name "${p.storeName}" once inside the body text.
  * Mention the area "${p.geoPhrase}" once, in a natural place-framed way.
  * Work in exactly ONE of these brand phrases, quoted or unquoted, where it fits naturally: ${kwList}.
  * If any of these would read awkwardly in context, prioritise natural flow over inclusion.
- End the body by inviting them back (vary the wording; not always "see you soon").`}
- Language: ${p.language}.
- Output ONLY the reply body text. No sign-off line (it is appended separately), no quotes around the whole thing, no markdown, no explanations.`;
}

async function gen(p) {
  const prompt = buildPrompt(p);
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 1.05, topP: 0.95, maxOutputTokens: 4096 } }),
    });
    if (!res.ok) { console.error(`  [${model} -> HTTP ${res.status}]`); continue; }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("").trim();
    if (text) return { model, text };
  }
  return null;
}

const base = {
  storeName: "Let It Dough",
  geoPhrase: "WAFI Mall, Dubai",
  geoKeywords: ["best doughnuts in Dubai", "fresh doughnuts", "UAE homegrown"],
  language: "English",
};

const cases = [
  { ...base, rating: 5, reviewText: "Came here after a friend recommended it. The pistachio doughnut was unreal, still thinking about it. The lady at the counter remembered my order from last time which blew my mind. Only wish they had more seating." },
  { ...base, rating: 5, reviewText: "Came here after a friend recommended it. The pistachio doughnut was unreal, still thinking about it. The lady at the counter remembered my order from last time which blew my mind. Only wish they had more seating." },
  { ...base, rating: 3, reviewText: "Doughnuts themselves are genuinely great, especially the Boston Cream. But we waited almost 20 minutes and my coffee came out lukewarm. Might give it one more shot." },
  { ...base, rating: 1, reviewText: "Ordered a birthday box for pickup at 5pm, wasn't ready until 5:40 and two flavours were wrong. Ruined the surprise. Very disappointed." },
  { ...base, rating: 5, language: "Japanese (natural, warm 丁寧語 — not stiff business keigo)", reviewText: "ピスタチオのドーナツが本当に美味しかったです。店員さんが前回の注文を覚えていてくれて感動しました。席がもう少しあれば嬉しいです。" },
];

for (const [i, c] of cases.entries()) {
  const out = await gen(c);
  console.log(`\n═══ CASE ${i + 1} (${c.rating}★${c.language.startsWith("Jap") ? " JA" : ""}) ═══`);
  console.log(out ? `[${out.model}]\n${out.text}` : "FAILED");
}
