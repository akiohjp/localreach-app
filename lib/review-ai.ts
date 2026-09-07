/**
 * Gemini client for guest review drafts. Plain fetch, no Next imports, so the
 * route and scripts/test-gemini-review.mjs run the same code path.
 *
 * Budget, not retries, is the design constraint: the guest is standing at the
 * counter. Each attempt gets a short timeout, the ladder stops when the total
 * budget is spent, and the caller falls back to the template engine.
 */

export const DEFAULT_REVIEW_MODELS: readonly string[] = [
  // Lite first: a guest draft is ~100 output tokens and speed matters more
  // than the last bit of prose quality. The "-latest" aliases move under us;
  // the pinned names stay as fallbacks for keys that still see them.
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash",
];

/** GEMINI_REVIEW_MODELS (csv) wins; else GEMINI_MODEL is prepended to the default ladder. */
export function reviewModelsFromEnv(env: Record<string, string | undefined> = process.env): string[] {
  const csv = (env.GEMINI_REVIEW_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (csv.length) return csv;
  const single = (env.GEMINI_MODEL ?? "").trim();
  return single ? [single, ...DEFAULT_REVIEW_MODELS] : [...DEFAULT_REVIEW_MODELS];
}

export type LadderResult =
  | { ok: true; text: string; model: string; latencyMs: number }
  | { ok: false; reason: string; latencyMs: number };

// gemini-3.x rejects thinkingBudget:0 with HTTP 400; 2.5-era thinking models
// need it or thinking eats the output budget. Adaptive, same as the reply route.
let thinkingRejected = false;

type AttemptOutcome =
  | { kind: "text"; text: string }
  | { kind: "retry_no_thinking" }
  | { kind: "next"; reason: string };

async function attempt(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs: number,
  disableThinking: boolean,
  temperature: number,
): Promise<AttemptOutcome> {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            topP: 0.95,
            maxOutputTokens: 1024,
            ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "error";
    return { kind: "next", reason: `${model}:${/timeout|abort/i.test(name) ? "timeout" : "network"}` };
  }
  if (res.status === 400 && disableThinking) return { kind: "retry_no_thinking" };
  if (!res.ok) return { kind: "next", reason: `${model}:http_${res.status}` };
  const data = (await res.json().catch(() => null)) as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
  } | null;
  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.map((x) => x.text ?? "").join("").trim();
  if (text) return { kind: "text", text };
  return { kind: "next", reason: `${model}:empty_${cand?.finishReason ?? "unknown"}` };
}

/**
 * Walk the model ladder inside a total time budget. Returns the first non-empty
 * text; the caller decides whether the text is acceptable.
 */
export async function generateWithLadder(opts: {
  apiKey: string;
  models: readonly string[];
  prompt: string;
  /** Total wall-clock allowance for every attempt together. */
  budgetMs: number;
  /** Per-attempt ceiling; the last attempt gets whatever budget remains. */
  attemptMs: number;
  temperature?: number;
  /** Do not start an attempt with less than this left. */
  minAttemptMs?: number;
}): Promise<LadderResult> {
  const started = Date.now();
  const minAttempt = opts.minAttemptMs ?? 1500;
  const reasons: string[] = [];
  for (const model of opts.models) {
    let disableThinking = !thinkingRejected;
    for (let pass = 0; pass < 2; pass++) {
      const remaining = opts.budgetMs - (Date.now() - started);
      if (remaining < minAttempt) {
        reasons.push("budget");
        return { ok: false, reason: reasons.join("|"), latencyMs: Date.now() - started };
      }
      const out = await attempt(
        opts.apiKey,
        model,
        opts.prompt,
        Math.min(opts.attemptMs, remaining),
        disableThinking,
        opts.temperature ?? 1.0,
      );
      if (out.kind === "text") {
        return { ok: true, text: out.text, model, latencyMs: Date.now() - started };
      }
      if (out.kind === "retry_no_thinking") {
        thinkingRejected = true;
        disableThinking = false;
        continue;
      }
      reasons.push(out.reason);
      break;
    }
  }
  return { ok: false, reason: reasons.join("|") || "no_models", latencyMs: Date.now() - started };
}
