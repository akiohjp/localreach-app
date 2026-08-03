import { NextResponse } from "next/server";
import { captureAllStores } from "@/lib/review-stats";

/**
 * Daily snapshot of every active store's public Google rating + review count.
 * Invoked by Vercel Cron (see vercel.json). Vercel sends
 * "Authorization: Bearer <CRON_SECRET>" automatically when the CRON_SECRET env
 * var exists, so the same check covers both the scheduler and a manual seed
 * call with the secret.
 */
export const dynamic = "force-dynamic";
// Sequential Places calls for the whole fleet: give it room beyond the
// default so a slow Google day doesn't truncate the run halfway through.
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed AND loudly: an unset secret silently skipping forever is the
    // "exit 0 worker" failure mode.
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await captureAllStores();
    // Partial failures are reported, not swallowed: the response is the audit
    // trail for "did every store get its snapshot today".
    return NextResponse.json({ ok: summary.failed.length === 0, ...summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
