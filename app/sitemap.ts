import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw?.startsWith("http")) return [];
  try {
    const url = raw.replace(/\/$/, "");
    return [{ url, lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
  } catch {
    return [];
  }
}
