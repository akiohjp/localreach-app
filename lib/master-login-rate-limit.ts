/**
 * Best-effort in-memory lockout for the master (親) console login.
 *
 * IMPORTANT: On Vercel/serverless the app runs as multiple isolated instances
 * and this Map is per-instance and reset on cold start. It is therefore a speed
 * bump against brute force, not a hard global guarantee. For a strict limit,
 * back this with a shared store (a Supabase table or KV). It still meaningfully
 * throttles single-instance and local abuse and pairs with the constant-time
 * password check in {@link file://./master-session.ts}.
 */

const WINDOW_MS = 15 * 60 * 1000; // rolling window over which failures accumulate
const MAX_FAILURES = 5; // failures within the window before a lockout kicks in
const LOCKOUT_MS = 15 * 60 * 1000; // how long a lockout lasts
const MAX_KEYS = 5000; // cap map size to bound memory under key-flooding

type Entry = { failures: number; firstAt: number; lockedUntil: number };

const attempts = new Map<string, Entry>();

/** Drop stale entries once the map grows large, to bound memory. */
function sweep(now: number): void {
  if (attempts.size < MAX_KEYS) return;
  for (const [k, e] of attempts) {
    if (e.lockedUntil < now && now - e.firstAt > WINDOW_MS) attempts.delete(k);
  }
}

export function checkMasterLoginAllowed(key: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const e = attempts.get(key);
  if (e && e.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((e.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordMasterLoginFailure(key: string): void {
  const now = Date.now();
  sweep(now);
  const e = attempts.get(key);
  if (!e || now - e.firstAt > WINDOW_MS) {
    // First failure, or the previous window has elapsed — start a fresh window.
    attempts.set(key, { failures: 1, firstAt: now, lockedUntil: 0 });
    return;
  }
  e.failures += 1;
  if (e.failures >= MAX_FAILURES) {
    e.lockedUntil = now + LOCKOUT_MS;
  }
}

export function resetMasterLoginFailures(key: string): void {
  attempts.delete(key);
}
