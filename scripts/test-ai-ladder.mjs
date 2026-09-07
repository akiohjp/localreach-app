/**
 * Unit checks for the hedged model ladder (lib/review-ai.ts) with a fake
 * fetch: no network, no keys. Runs inside `npm run audit:all`.
 *
 * Usage: npx tsx scripts/test-ai-ladder.mjs
 */
import assert from "node:assert/strict";

const { generateWithLadder, resetModelMemory } = await import("../lib/review-ai.ts");

let passed = 0;
async function t(name, fn) {
  resetModelMemory();
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const ok = (text) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const modelOf = (url) => /models\/([^:]+):/.exec(String(url))?.[1] ?? "?";

/**
 * Fake Gemini: `plan[model]` is a function(body, signal) → Response promise.
 * A "slow" model resolves after ms unless aborted first.
 */
function install(plan) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const model = modelOf(url);
    const body = JSON.parse(init.body);
    const thinkingOff = Boolean(body.generationConfig?.thinkingConfig);
    calls.push({ model, thinkingOff });
    return plan[model](body, init.signal, thinkingOff);
  };
  return calls;
}
const sleepOrAbort = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      const e = new Error("aborted");
      e.name = "AbortError";
      reject(e);
    });
  });

const base = { apiKey: "k", prompt: "p", budgetMs: 3000, attemptMs: 2000, hedgeAfterMs: 120, minAttemptMs: 50 };

await t("fast primary wins on its own; nothing else is called", async () => {
  const calls = install({
    "lite": async () => ok("draft from lite"),
    "flash": async () => ok("draft from flash"),
  });
  const r = await generateWithLadder({ ...base, models: ["lite", "flash"] });
  assert.equal(r.ok, true);
  assert.equal(r.model, "lite");
  assert.deepEqual(calls.map((c) => c.model), ["lite"]);
});

await t("slow primary is hedged: the backup answers first and the primary is aborted", async () => {
  let primaryAborted = false;
  const calls = install({
    "lite": async (_b, signal) => {
      try { await sleepOrAbort(1500, signal); } catch { primaryAborted = true; throw Object.assign(new Error("x"), { name: "AbortError" }); }
      return ok("late lite");
    },
    "flash": async () => ok("draft from flash"),
  });
  const started = Date.now();
  const r = await generateWithLadder({ ...base, models: ["lite", "flash"] });
  const took = Date.now() - started;
  assert.equal(r.ok, true);
  assert.equal(r.model, "flash");
  assert.ok(took < 900, `took ${took} ms`);
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(primaryAborted, true);
  assert.deepEqual(calls.map((c) => c.model), ["lite", "flash"]);
});

await t("thinking is remembered per model: lite refuses budget 0, flash keeps it", async () => {
  const calls = install({
    "lite": async (_b, _s, thinkingOff) => (thinkingOff ? new Response("bad", { status: 400 }) : ok("lite without thinking")),
    "flash": async () => ok("flash"),
  });
  const r1 = await generateWithLadder({ ...base, models: ["lite", "flash"] });
  assert.equal(r1.ok, true);
  assert.equal(r1.text, "lite without thinking");
  assert.deepEqual(calls.map((c) => `${c.model}:${c.thinkingOff}`), ["lite:true", "lite:false"]);
  calls.length = 0;
  const r2 = await generateWithLadder({ ...base, models: ["lite", "flash"] });
  assert.equal(r2.ok, true);
  assert.deepEqual(calls.map((c) => `${c.model}:${c.thinkingOff}`), ["lite:false"]);
  // A different model is not tarred with lite's refusal.
  calls.length = 0;
  const r3 = await generateWithLadder({ ...base, models: ["flash"] });
  assert.equal(r3.ok, true);
  assert.deepEqual(calls.map((c) => `${c.model}:${c.thinkingOff}`), ["flash:true"]);
});

await t("a 404 model is retired for the instance and skipped next time", async () => {
  const calls = install({
    "dead": async () => new Response("gone", { status: 404 }),
    "flash": async () => ok("flash"),
  });
  const r1 = await generateWithLadder({ ...base, models: ["dead", "flash"] });
  assert.equal(r1.ok, true);
  assert.equal(r1.model, "flash");
  calls.length = 0;
  const r2 = await generateWithLadder({ ...base, models: ["dead", "flash"] });
  assert.equal(r2.ok, true);
  assert.deepEqual(calls.map((c) => c.model), ["flash"]);
});

await t("everything failing reports every reason and stays inside the budget", async () => {
  install({
    "lite": async (_b, signal) => { await sleepOrAbort(5000, signal); return ok("never"); },
    "flash": async () => new Response("down", { status: 503 }),
  });
  const started = Date.now();
  const r = await generateWithLadder({ ...base, models: ["lite", "flash"], budgetMs: 700, attemptMs: 700 });
  assert.equal(r.ok, false);
  assert.ok(/lite:timeout/.test(r.reason) && /flash:http_503/.test(r.reason), r.reason);
  assert.ok(Date.now() - started < 1200);
});

console.log(`\nai ladder: ${passed} checks passed`);
