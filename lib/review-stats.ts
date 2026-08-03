import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Results reporting: capture a store's public Google rating and review count
 * into review_stats (one row per store per day).
 *
 * Why this exists as a product feature: the retention argument for a monthly
 * fee is "reviews actually went up", and until now the product could not say
 * that about itself — the Let It Dough 29→42 case study had to be assembled by
 * hand from GBP screenshots. A daily snapshot makes the delta a fact the
 * dashboard states, not a claim sales has to reconstruct.
 *
 * Deliberately NOT stored: individual reviews or reviewer data. The snapshot
 * is two public aggregate numbers from the store's own listing.
 */

export type CaptureResult =
  | { ok: true; storeId: string; rating: number | null; reviewCount: number }
  | { ok: false; storeId: string; reason: string };

type PlaceDetails = {
  status?: string;
  result?: { rating?: number; user_ratings_total?: number };
  error_message?: string;
};

/**
 * Fetch rating + review count for one place id. Places Details with two
 * fields — the cheapest call in the API tier list.
 */
async function fetchPlaceStats(
  placeId: string,
  apiKey: string,
): Promise<{ rating: number | null; reviewCount: number } | { error: string }> {
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total&key=${apiKey}`;
  let json: PlaceDetails;
  try {
    const res = await fetch(url, { cache: "no-store" });
    json = (await res.json()) as PlaceDetails;
  } catch (e) {
    return { error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (json.status !== "OK" || !json.result) {
    return { error: `places status ${json.status ?? "unknown"}${json.error_message ? `: ${json.error_message}` : ""}` };
  }
  return {
    rating: typeof json.result.rating === "number" ? json.result.rating : null,
    // A listing with no reviews returns no user_ratings_total at all — that is
    // a real zero, not missing data.
    reviewCount: json.result.user_ratings_total ?? 0,
  };
}

/** Capture today's snapshot for one store. Upsert, so re-runs are harmless. */
export async function captureStoreStats(
  storeId: string,
  placeId: string,
): Promise<CaptureResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { ok: false, storeId, reason: "GOOGLE_MAPS_API_KEY not configured" };

  const stats = await fetchPlaceStats(placeId, apiKey);
  if ("error" in stats) return { ok: false, storeId, reason: stats.error };

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await admin.from("review_stats").upsert(
    {
      store_id: storeId,
      captured_on: today,
      rating: stats.rating,
      review_count: stats.reviewCount,
    },
    { onConflict: "store_id,captured_on" },
  );
  if (error) return { ok: false, storeId, reason: `db upsert: ${error.message}` };
  return { ok: true, storeId, rating: stats.rating, reviewCount: stats.reviewCount };
}

/**
 * Capture every active store that has a place id. Partial-success by design:
 * one store's bad place id must not stop the rest, and the summary reports
 * exactly which stores failed and why (a silent all-green that skipped half
 * the fleet is the failure mode this codebase keeps re-learning to avoid).
 */
export async function captureAllStores(): Promise<{
  captured: number;
  failed: { storeId: string; reason: string }[];
  skippedNoPlaceId: number;
}> {
  const admin = createAdminClient();
  const { data: stores, error } = await admin
    .from("stores")
    .select("id, google_place_id, is_active")
    .eq("is_active", true);
  if (error) throw new Error(`stores query failed: ${error.message}`);

  const withPid = (stores ?? []).filter(
    (s): s is { id: string; google_place_id: string; is_active: boolean } =>
      typeof s.google_place_id === "string" && s.google_place_id.length > 0,
  );
  const skippedNoPlaceId = (stores ?? []).length - withPid.length;

  const failed: { storeId: string; reason: string }[] = [];
  let captured = 0;
  // Sequential on purpose: ~10-20 stores, and a burst of parallel Places calls
  // buys nothing except a rate-limit risk on a shared key.
  for (const s of withPid) {
    const r = await captureStoreStats(s.id, s.google_place_id);
    if (r.ok) captured++;
    else failed.push({ storeId: r.storeId, reason: r.reason });
  }
  return { captured, failed, skippedNoPlaceId };
}
