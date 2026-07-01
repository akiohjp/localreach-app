import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw?.startsWith("http")) return [];
  try {
    const base = raw.replace(/\/$/, "");
    const lastModified = new Date();
    return [
      { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
      { url: `${base}/local-reach-lp`, lastModified, changeFrequency: "monthly", priority: 0.8 },
      { url: `${base}/local-reach-detail`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    ];
  } catch {
    return [];
  }
}
