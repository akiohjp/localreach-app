import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildPrompt, clip, LANGUAGE_NAME } from "@/lib/reply-prompt";

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
