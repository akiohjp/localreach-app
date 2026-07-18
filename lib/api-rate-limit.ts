/**
 * Global fixed-window rate limiter backed by the api_rate_limits table
 * (migration 20260719120000). Unlike the in-memory master-login limiter, this
 * window is shared across all Vercel instances and survives cold starts, so it
 * is a real ceiling — the right shape for cost-bearing endpoints like
 * /api/generate-reply where each call fans out to Gemini.
 *
 * FAIL-OPEN: if the RPC itself errors (migration not applied yet, transient DB
 * issue), the caller is allowed through and the error is logged. Availability
 * of a paid feature beats strictness here; the Gemini quota is the backstop.
 */

import { createAdminClient } from "@/utils/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfterSec: number;
};

export async function checkRateLimit(
  key: string,
  windowSeconds: number,
  max: number,
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("bump_rate_limit", {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("bump_rate_limit returned no row");
    return {
      allowed: Boolean(row.allowed),
      retryAfterSec: Number(row.retry_after_seconds) || 0,
    };
  } catch (e) {
    console.error("[rate-limit] check failed for", key, e);
    return { allowed: true, retryAfterSec: 0 };
  }
}
