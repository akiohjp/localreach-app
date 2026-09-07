/**
 * Gemini client for guest review drafts. Plain fetch, no Next imports, so the
 * route and scripts/test-gemini-review.mjs run the same code path.
 *
 * Budget, not retries, is the design constraint: the guest is standing at the
 * counter. Two things measured on 2026-09-07 shape this file:
 *
 *   1. Thinking is per model, not per key. gemini-flash-lite-latest REJECTS
 *      thinkingBudget:0 (HTTP 400) and answers in ~1.3 s without it;
 *      gemini-flash-latest ACCEPTS it and answers in ~1.3 s, but WITHOUT it
 *      thinks for ~7.6 s and returns a 32-word stub. One global "thinking
 *      rejected" flag (the reply route's design) therefore poisons the second
 *      model the moment the first one says 400. The flag is per model here.
 *
 *   2. Tail latency. The lite model answers in 1.1 to 1.6 s most of the time
 *      and then, some minutes, half the calls take longer than 4.5 s. A
 *      sequential ladder turns each of those into a 7.5 s wait and a template
 *      fallback. So the ladder is HEDGED: if the first model has not answered
 *      after hedgeAfterMs, the next one starts alongside it, and the first
 *      good text wins while the rest are aborted. The extra call costs a
 *      fraction of a fils and only happens on the slow tail.
 */

export const DEFAULT_REVIEW_MODELS: readonly string[] = [
  // Lite first: a guest draft is ~100 output tokens and speed matters more
  // than the last bit of prose quality. The "-latest" aliases move under us;
  // the pinned names stay as fallbacks for keys that still see them.
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
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

type AttemptOutcome =
  | { kind: "text"; text: string }
  | { kind: "retry_no_thinking" }
  | { kind: "next"; reason: string };

// Per-instance memory. Vercel keeps a warm instance around for a while, so
// what a model said about itself on the last call is usually still true.
const rejectsThinkingOff = new Map<string, boolean>();
const retired = new Set<string>();

/** Test seam: forget what the models said about themselves. */
export function resetModelMemory(): void {
  rejectsThinkingOff.clear();
  retired.clear();
}

async function fetchOnce(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs: number,
  outer: AbortSignal | undefined,
  temperature: number,
  thinkingOff: boolean,
): Promise<AttemptOutcome> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onOuterAbort = () => ctrl.abort();
  outer?.addEventListener("abort", onOuterAbort, { once: true });
  try {
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
              ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
          signal: ctrl.signal,
        },
      );
    } catch (e) {
      if (outer?.aborted) return { kind: "next", reason: `${model}:aborted` };
      if (timedOut) return { kind: "next", reason: `${model}:timeout` };
      const name = (e as { name?: string })?.name ?? "error";
      return { kind: "next", reason: `${model}:${/abort/i.test(name) ? "timeout" : "network"}` };
    }
    if (res.status === 400 && thinkingOff) return { kind: "retry_no_thinking" };
    if (!res.ok) return { kind: "next", reason: `${model}:http_${res.status}` };
    const data = (await res.json().catch(() => null)) as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    } | null;
    const cand = data?.candidates?.[0];
    const text = cand?.content?.parts?.map((x) => x.text ?? "").join("").trim();
    if (text) return { kind: "text", text };
    return { kind: "next", reason: `${model}:empty_${cand?.finishReason ?? "unknown"}` };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }
}

/** One model, with what we know about it: thinking off unless it refuses. */
async function attemptModel(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs: number,
  outer: AbortSignal,
  temperature: number,
): Promise<AttemptOutcome> {
  const started = Date.now();
  const thinkingOff = !rejectsThinkingOff.get(model);
  let out = await fetchOnce(apiKey, model, prompt, timeoutMs, outer, temperature, thinkingOff);
  if (out.kind === "retry_no_thinking") {
    rejectsThinkingOff.set(model, true);
    const left = timeoutMs - (Date.now() - started);
    out = left > 300
      ? await fetchOnce(apiKey, model, prompt, left, outer, temperature, false)
      : { kind: "next", reason: `${model}:timeout` };
  }
  if (out.kind === "next" && out.reason.endsWith(":http_404")) retired.add(model);
  return out;
}

/**
 * Hedged ladder inside a total time budget: the first model starts at once,
 * the next one joins after hedgeAfterMs of silence (or immediately if the
 * previous one failed fast), and the first non-empty text wins. Everything
 * else is aborted. The caller decides whether the text is acceptable.
 */
export async function generateWithLadder(opts: {
  apiKey: string;
  models: readonly string[];
  prompt: string;
  /** Total wall-clock allowance for every attempt together. */
  budgetMs: number;
  /** Per-attempt ceiling; a later attempt gets whatever budget remains. */
  attemptMs: number;
  /** Silence before the next model is started alongside the running one. */
  hedgeAfterMs?: number;
  temperature?: number;
  /** Do not start an attempt with less than this left. */
  minAttemptMs?: number;
}): Promise<LadderResult> {
  const started = Date.now();
  const models = opts.models.filter((m) => !retired.has(m));
  const hedgeAfter = opts.hedgeAfterMs ?? 1800;
  const minAttempt = opts.minAttemptMs ?? 1500;
  const temperature = opts.temperature ?? 1.0;
  const reasons: string[] = [];
  const controllers: AbortController[] = [];
  const inflight = new Map<number, Promise<{ idx: number; out: AttemptOutcome }>>();
  let next = 0;

  const launch = (): boolean => {
    if (next >= models.length) return false;
    const remaining = opts.budgetMs - (Date.now() - started);
    if (remaining < minAttempt) return false;
    const idx = next++;
    const ctrl = new AbortController();
    controllers.push(ctrl);
    inflight.set(
      idx,
      attemptModel(opts.apiKey, models[idx]!, opts.prompt, Math.min(opts.attemptMs, remaining), ctrl.signal, temperature)
        .then((out) => ({ idx, out })),
    );
    return true;
  };

  if (!launch()) return { ok: false, reason: models.length ? "budget" : "no_models", latencyMs: 0 };

  while (inflight.size > 0) {
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
    const hedge = new Promise<{ idx: -1; out: null }>((resolve) => {
      hedgeTimer = setTimeout(() => resolve({ idx: -1, out: null }), hedgeAfter);
    });
    const settled = await Promise.race([...inflight.values(), hedge]);
    clearTimeout(hedgeTimer);
    if (settled.idx === -1) {
      // Silence: bring the next model in alongside. If none is left, keep waiting.
      launch();
      continue;
    }
    inflight.delete(settled.idx);
    const out = settled.out as AttemptOutcome;
    if (out.kind === "text") {
      for (const c of controllers) c.abort();
      return { ok: true, text: out.text, model: models[settled.idx]!, latencyMs: Date.now() - started };
    }
    reasons.push(out.kind === "next" ? out.reason : `${models[settled.idx]}:thinking`);
    if (inflight.size === 0) launch();
  }
  return { ok: false, reason: reasons.join("|") || "budget", latencyMs: Date.now() - started };
}
