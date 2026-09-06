import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isValidUuid } from "@/lib/is-valid-uuid";
import { isStoreCurrentlyActive } from "@/lib/subscription";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { bannedTermsFor, findBannedTerm, stripBannedSentences } from "@/lib/banned-terms";
import { buildReviewPrompt, OPENINGS } from "@/lib/review-prompt";
import { checkReviewDraft, cleanReviewDraft, sanitizeGuestNote } from "@/lib/review-ai-filter";
import { generateWithLadder, reviewModelsFromEnv } from "@/lib/review-ai";
import { NON_VISIT_VERTICALS, resolveAudience, resolveVertical } from "@/lib/review-pools";
import { getLocalizedText, type SupportedLocale } from "@/types/database";

/**
 * AI guest review draft (Gemini) — public, per-store opt-in.
 *
 * The template engine (lib/assembler.ts) stays the floor: the client calls this
 * route only for stores with ai_review_enabled, and falls back to the template
 * engine on ANY non-2xx or timeout, so the guest always gets a draft.
 *
 * What the model may know is exactly what the template engine knows: the
 * store, the phrases the guest left switched on (validated against the store's
 * own pill list — nothing the guest was never shown can reach the draft), the
 * guest's optional own words, and the entity layer. Every draft passes
 * lib/review-ai-filter before it is returned; a rejected draft is retried once
 * and then the route gives up (502) rather than ship it.
 *
 * Cost controls, all before the model is called: origin check, per-IP burst
 * and hourly windows, per-store hourly window, a global daily ceiling.
 */

export const maxDuration = 15;

type Body = {
  storeId?: unknown;
  keywords?: unknown;
  locale?: unknown;
  rating?: unknown;
  note?: unknown;
  attempt?: unknown;
};

/** Total wall-clock budget for the model ladder; the client aborts at 9 s. */
const BUDGET_MS = 7500;
const ATTEMPT_MS = 4500;
const MAX_GENERATIONS = 2;
const DAILY_CAP = Math.max(50, Number(process.env.AI_REVIEW_DAILY_CAP) || 2000);

function json(body: Record<string, unknown>, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || "unknown";
}

/**
 * A cross-site page must not be able to spend the platform's Gemini quota
 * through a guest's browser. Same-origin fetches and in-app browsers either
 * send our own origin or none; only a foreign Origin is refused.
 */
function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    const app = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : "";
    if (app && host === app) return true;
    if (host.endsWith(".vercel.app")) return true;
    if (host === "localhost" || host === "127.0.0.1") return true;
  } catch {
    return false;
  }
  return false;
}

function cleanKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const t = v.trim().slice(0, 80);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}

type DraftLog = {
  store_id: string;
  outcome: "ai" | "fallback";
  model: string | null;
  locale: string;
  rating: number;
  keywords: string[];
  guest_note: string | null;
  draft: string | null;
  reason: string | null;
  latency_ms: number | null;
};

/** Written after the response is sent, so logging never delays the guest. */
function logDraft(row: DraftLog) {
  after(async () => {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("ai_review_drafts").insert(row);
      if (error) console.error("[generate-review] log failed", error.message);
    } catch (e) {
      console.error("[generate-review] log failed", e);
    }
  });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: "forbidden_origin" }, 403);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: "ai_unavailable" }, 503);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  if (!isValidUuid(storeId)) return json({ error: "bad_request" }, 400);
  const locale: SupportedLocale = body.locale === "ja" ? "ja" : body.locale === "ar" ? "ar" : "en";
  const rating = Math.round(Number(body.rating));
  if (rating !== 4 && rating !== 5) return json({ error: "bad_request" }, 400);
  const requested = cleanKeywords(body.keywords);
  const note = sanitizeGuestNote(body.note);
  const attempt = Math.min(5, Math.max(0, Math.trunc(Number(body.attempt)) || 0));

  const admin = createAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select(
      "id, store_name, default_language, is_active, subscription_expires_at, ai_review_enabled, business_category, entity_area, entity_city, entity_category_label, keywords, forced_keywords, keyword_types",
    )
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) {
    console.error("[generate-review] store lookup failed", storeError.message);
    return json({ error: "ai_failed" }, 502);
  }
  if (!store || !isStoreCurrentlyActive(store)) return json({ error: "inactive_or_unknown_store" }, 404);
  if (!store.ai_review_enabled) return json({ error: "ai_disabled" }, 403);

  // Only phrases the guest could actually have been shown. Anything else is
  // either a stale client or someone probing the endpoint.
  const configured = new Set(
    [...(store.forced_keywords ?? []), ...(store.keywords ?? [])].map((k) => String(k).trim()).filter(Boolean),
  );
  const keywords = requested.filter((k) => configured.has(k));
  if (keywords.length === 0 && !note) return json({ error: "nothing_to_write" }, 400);

  // Venue Wi-Fi puts every guest behind one IP, so the per-IP windows are
  // sized for a busy counter, not a single phone; the per-store and global
  // windows are the cost ceilings.
  const ip = clientIp(req);
  const [burst, hourly, perStore, global] = await Promise.all([
    checkRateLimit(`airev:ip:${ip}`, 60, 10),
    checkRateLimit(`airev:iph:${ip}`, 3600, 60),
    checkRateLimit(`airev:s:${store.id}`, 3600, 150),
    checkRateLimit("airev:global:day", 86400, DAILY_CAP),
  ]);
  const limited = [burst, hourly, perStore, global].find((r) => !r.allowed);
  if (limited) {
    logDraft({
      store_id: store.id,
      outcome: "fallback",
      model: null,
      locale,
      rating,
      keywords,
      guest_note: note || null,
      draft: null,
      reason: "rate_limited",
      latency_ms: null,
    });
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(limited.retryAfterSec) });
  }

  const storeName = getLocalizedText(store.store_name ?? {}, locale, store.default_language) || "this place";
  const vertical = resolveVertical(store.business_category);
  const categoryNoun = getLocalizedText(store.entity_category_label ?? {}, locale, store.default_language) || null;
  const bannedTerms = bannedTermsFor(storeName);
  const models = reviewModelsFromEnv();
  const started = Date.now();

  let lastReason = "no_attempt";
  let lastCandidate: string | null = null;
  let lastModel: string | null = null;

  for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
    const remaining = BUDGET_MS - (Date.now() - started);
    if (remaining < 1500) {
      lastReason = "budget";
      break;
    }
    const prompt = buildReviewPrompt({
      storeName,
      locale,
      rating,
      keywords,
      keywordTypes: (store.keyword_types as Record<string, string> | null) ?? null,
      note,
      categoryNoun,
      area: store.entity_area,
      city: store.entity_city,
      nonVisit: NON_VISIT_VERTICALS.has(vertical),
      visitor: resolveAudience(store.business_category) === "visitor",
      // Random so two guests with the same taps do not get the same skeleton;
      // the attempt offset guarantees "try another wording" moves.
      variant: (Math.floor(Math.random() * OPENINGS.length) + attempt + gen) % OPENINGS.length,
      bannedTerms,
    });
    const result = await generateWithLadder({
      apiKey,
      models,
      prompt,
      budgetMs: remaining,
      attemptMs: ATTEMPT_MS,
    });
    if (!result.ok) {
      lastReason = result.reason;
      break;
    }
    lastModel = result.model;
    let text = cleanReviewDraft(result.text);
    if (findBannedTerm(storeName, text)) text = stripBannedSentences(storeName, text);
    const verdict = checkReviewDraft(text, { locale, rating, keywords, storeName });
    if (!verdict.ok) {
      lastReason = verdict.reason;
      lastCandidate = text;
      continue;
    }
    logDraft({
      store_id: store.id,
      outcome: "ai",
      model: result.model,
      locale,
      rating,
      keywords,
      guest_note: note || null,
      draft: verdict.text,
      reason: null,
      latency_ms: Date.now() - started,
    });
    return json({ review: verdict.text, model: result.model, source: "ai" }, 200);
  }

  logDraft({
    store_id: store.id,
    outcome: "fallback",
    model: lastModel,
    locale,
    rating,
    keywords,
    guest_note: note || null,
    draft: lastCandidate,
    reason: lastReason,
    latency_ms: Date.now() - started,
  });
  return json({ error: "ai_failed", reason: lastReason }, 502);
}
