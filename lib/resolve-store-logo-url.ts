import { createAdminClient } from "@/utils/supabase/admin";

const BUCKET = "store-logos";
const SIGNED_TTL_SEC = 60 * 60 * 24; // 24h — refresh on navigation

/** Full legacy public URLs or normalized storage path under store-logos. */
export function normalizeStoreLogoPath(logoUrlOrPath: string | null): string | null {
  const raw = logoUrlOrPath?.trim();
  if (!raw) return null;

  const marker = "/object/public/store-logos/";
  const i = raw.indexOf(marker);
  if (i !== -1) {
    try {
      return decodeURIComponent(raw.slice(i + marker.length).split("?")[0] ?? "").trim() || null;
    } catch {
      return raw.slice(i + marker.length).split("?")[0]?.trim() || null;
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const parts = u.pathname.split("/storage/v1/object/public/store-logos/");
      if (parts[1]) return decodeURIComponent(parts[1].split("?")[0] ?? "").trim() || null;
    } catch {
      return null;
    }
    return null;
  }

  return raw.replace(/^\/+/, "").trim() || null;
}

/**
 * Browser-safe URL for logos after bucket is non-public — requires service role signing.
 */
export async function resolveStoreLogoForViewer(
  logoUrlOrPath: string | null,
): Promise<string | null> {
  const path = normalizeStoreLogoPath(logoUrlOrPath);
  if (!path) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL_SEC);

    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    /* missing env in broken dev setups */
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  if (!base) return null;

  /** Dev fallback — stops working once the bucket is private */
  return `${base}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;
}
