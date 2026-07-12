import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * AI review-reply generation (Gemini) — owner-authed.
 *
 * The zero-API template engine (lib/reply-engine.ts) remains the instant,
 * offline fallback; this route is the primary path because the owner requires
 * replies that genuinely READ the review and respond to its specifics.
 *
 * - Auth: any signed-in store owner (session cookie). 401 otherwise.
 * - No DB writes. Nothing is auto-posted (human-gated in the UI).
 * - GEMINI_API_KEY absent → 503 so the client silently falls back to the
 *   template engine (feature still works without the key).
 */

type GenerateReplyRequest = {
  storeName?: string;
  rating?: number;
  reviewText?: string;
  locale?: string;        // 'en' | 'ja' | 'ar'
  tone?: string;          // 'warm' | 'professional'
  geoPhrase?: string;     // neighbourhood, e.g. "WAFI Mall, Dubai"
  geoKeywords?: string[]; // forced GEO keywords
  signature?: string;     // custom sign-off ({store} replaced client-side display)
};

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  ja: "Japanese (natural, warm 丁寧語 — not stiff business keigo)",
  ar: "Arabic (Modern Standard, friendly)",
};

function clip(s: unknown, max: number): string {
  return typeof s === "string" ? s.slice(0, max) : "";
}

function buildPrompt(p: {
  storeName: string; rating: number; reviewText: string; language: string;
  tone: string; geoPhrase: string; geoKeywords: string[]; signature: string;
}): string {
  const sentiment = p.rating >= 4 ? "positive" : p.rating <= 2 ? "negative" : "mixed";
  const kwList = p.geoKeywords.slice(0, 8).map((k) => `"${k}"`).join(", ");

  return `You are the owner of "${p.storeName}", a small local business, personally replying to a customer's public Google review. Write ONE reply.

THE REVIEW (${p.rating}/5 stars):
"""
${p.reviewText || "(The guest left a rating but no text.)"}
"""

HOW TO WRITE IT:
- READ the review carefully and respond to its actual content. Reference the specific things the guest mentioned (dishes, staff moments, complaints, details) in your own words. Never write a reply that could be pasted under a different review.
- Voice: a real human owner. ${p.tone === "professional" ? "Courteous and composed, but still personal." : "Warm, personal, lightly conversational."} Use contractions. Vary sentence length. No corporate boilerplate ("we strive to", "your satisfaction is our priority"), no exclamation spam, and DO NOT start with "Thank you for" or "Thanks for" (start some other natural way).
- Length: 4 to 7 sentences (${sentiment === "negative" ? "keep it focused and sincere" : "substantial, not a two-liner"}).
- Never use em dashes or en dashes.
${sentiment === "negative"
    ? `- This is an apology: acknowledge the specific failures plainly, take responsibility without excuses, and invite the guest to contact you directly to make it right. Do NOT include marketing phrases, keywords, or the neighbourhood. Stay humble.`
    : `- Local SEO (weave these in NATURALLY, never as a list, never forced):
  * Mention the business name "${p.storeName}" once inside the body text.
${p.geoPhrase ? `  * Mention the area "${p.geoPhrase}" once, in a natural place-framed way.` : ""}
${kwList ? `  * Work in exactly ONE of these brand phrases, quoted or unquoted, where it fits naturally: ${kwList}.` : ""}
  * If any of these would read awkwardly in context, prioritise natural flow over inclusion.
- End the body by inviting them back (vary the wording; not always "see you soon").`}
- Language: ${p.language}.
- Output ONLY the reply body text. No sign-off line (it is appended separately), no quotes around the whole thing, no markdown, no explanations.`;
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.05, topP: 0.95, maxOutputTokens: 4096 },
      }),
      // A hung upstream should fail fast so the client can fall back.
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("").trim();
  return text || null;
}

/** Strip markdown/quotes the model occasionally adds despite instructions. */
function cleanReply(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/```$/m, "").trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("“") && t.endsWith("”"))) {
    t = t.slice(1, -1).trim();
  }
  t = t.replace(/—/g, ", ").replace(/–/g, "-");
  return t.trim();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });

  let body: GenerateReplyRequest;
  try {
    body = (await req.json()) as GenerateReplyRequest;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 5)));
  const prompt = buildPrompt({
    storeName: clip(body.storeName, 120) || "our shop",
    rating,
    reviewText: clip(body.reviewText, 4000),
    language: LANGUAGE_NAME[clip(body.locale, 5)] ?? LANGUAGE_NAME.en,
    tone: clip(body.tone, 20),
    geoPhrase: clip(body.geoPhrase, 120),
    geoKeywords: Array.isArray(body.geoKeywords)
      ? body.geoKeywords.map((k) => clip(k, 80)).filter(Boolean).slice(0, 8)
      : [],
    signature: clip(body.signature, 120),
  });

  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...MODELS] : MODELS;
  for (const model of models) {
    try {
      const text = await callGemini(apiKey, model, prompt);
      if (text) return NextResponse.json({ reply: cleanReply(text), model });
    } catch {
      /* try next model */
    }
  }
  return NextResponse.json({ error: "ai_failed" }, { status: 502 });
}
