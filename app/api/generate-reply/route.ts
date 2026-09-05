import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { bannedTermsFor, findBannedTerm, stripBannedSentences } from "@/lib/banned-terms";
import { buildPrompt, clip, LANGUAGE_NAME } from "@/lib/reply-prompt";
import { paragraphize } from "@/lib/reply-format";
import { checkRateLimit } from "@/lib/api-rate-limit";

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
  categoryNoun?: string;  // natural business noun, e.g. "udon restaurant"
  signature?: string;     // custom sign-off ({store} replaced client-side display)
};

// flash-latest FIRST: keys issued after mid-2026 get 404 "no longer available
// to new users" on gemini-2.5-flash and 429 (zero quota) on gemini-2.0-flash —
// with the old order every AI reply silently fell back to the template engine.
// The pinned models stay as fallbacks for older keys.
// gemini-2.0-flash was retired: it now answers 404 "no longer available" for
// every key, so the last rung of the ladder had quietly rotted away and an AI
// reply fell through to the template engine whenever the first two were rate
// -limited (found 2026-08-18 while building the naturalness gate). Named
// versions are what actually exist; a "-latest" alias moves under us.
const MODELS = ["gemini-flash-latest", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

// gemini-3.x (what flash-latest resolves to since 2026-07) rejects
// thinkingBudget:0 with HTTP 400; 2.5-era thinking models NEED it or thinking
// eats the output budget and the reply comes back empty (finish=MAX_TOKENS).
// Adaptive: try thinking-off first, remember a 400 so later calls go direct.
let thinkingRejected = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string | null> {
  const attempts = thinkingRejected ? [false] : [true, false];
  let retriedTransient = false;
  for (let i = 0; i < attempts.length; i++) {
    const disableThinking = attempts[i]!;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.05,
            topP: 0.95,
            maxOutputTokens: 4096,
            ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        // A hung upstream should fail fast so the client can fall back.
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (res.status === 400 && disableThinking) {
      thinkingRejected = true;
      continue;
    }
    // One short retry on a transient upstream blip (429/5xx) before giving this
    // model up — a lone 503 on the primary model otherwise cascades into dead
    // fallbacks and a template reply (live repro 2026-07-25).
    if ((res.status === 429 || res.status >= 500) && !retriedTransient) {
      retriedTransient = true;
      await sleep(1200);
      i--; // redo the same thinking mode
      continue;
    }
    if (!res.ok) {
      console.error(`generate-reply: ${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    };
    const cand = data.candidates?.[0];
    const text = cand?.content?.parts?.map((x) => x.text ?? "").join("").trim();
    if (text) return text;
    console.error(`generate-reply: ${model} empty reply (finishReason=${cand?.finishReason ?? "?"})`);
    return null;
  }
  return null;
}

/** Strip markdown/quotes the model occasionally adds despite instructions. */
function cleanReply(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/```$/m, "").trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("“") && t.endsWith("”"))) {
    t = t.slice(1, -1).trim();
  }
  t = t.replace(/—/g, ", ").replace(/–/g, "-");
  // The prompt asks for paragraphs; this enforces them when the model answers in
  // one block anyway, so the owner never has to break the text up by hand.
  return paragraphize(t.trim());
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });

  // Global per-user ceiling (shared across instances): a burst window for
  // regenerate-mashing and an hourly cap against cost abuse from a leaked or
  // shared owner login. 429 → the client falls back to the template engine, so
  // the owner still gets a draft instantly.
  const [burst, hourly] = await Promise.all([
    checkRateLimit(`reply:m:${user.id}`, 60, 10),
    checkRateLimit(`reply:h:${user.id}`, 3600, 60),
  ]);
  const limited = !burst.allowed ? burst : !hourly.allowed ? hourly : null;
  if (limited) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: GenerateReplyRequest;
  try {
    body = (await req.json()) as GenerateReplyRequest;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 5)));
  const storeName = clip(body.storeName, 120) || "our shop";
  const prompt = buildPrompt({
    storeName,
    rating,
    reviewText: clip(body.reviewText, 4000),
    language: LANGUAGE_NAME[clip(body.locale, 5)] ?? LANGUAGE_NAME.en,
    tone: clip(body.tone, 20),
    geoPhrase: clip(body.geoPhrase, 120),
    categoryNoun: clip(body.categoryNoun, 60),
    geoKeywords: Array.isArray(body.geoKeywords)
      ? body.geoKeywords.map((k) => clip(k, 80)).filter(Boolean).slice(0, 8)
      : [],
    signature: clip(body.signature, 120),
    bannedTerms: bannedTermsFor(storeName),
  });

  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...MODELS] : MODELS;
  for (const model of models) {
    try {
      const text = await callGemini(apiKey, model, prompt);
      if (text) {
        // Hard guard behind the prompt's FORBIDDEN WORDS line: a guest review
        // that uses a banned term ("Persian" on a Cinar store) tempts the model
        // to echo it. Drop the offending sentences; if nothing usable is left,
        // fall through — a 502 sends the client to the (also filtered)
        // template engine rather than shipping the word to the owner's phone.
        let reply = cleanReply(text);
        if (findBannedTerm(storeName, reply)) {
          reply = stripBannedSentences(storeName, reply);
          if (!reply || findBannedTerm(storeName, reply)) continue;
        }
        return NextResponse.json({ reply, model });
      }
    } catch {
      /* try next model */
    }
  }
  return NextResponse.json({ error: "ai_failed" }, { status: 502 });
}
