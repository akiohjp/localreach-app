import type { MetadataRoute } from "next";

/**
 * PWA manifest (served at /manifest.webmanifest).
 * Next.js auto-injects <link rel="manifest"> from this file convention.
 *
 * Brand: amber/gold. theme_color drives the mobile browser chrome;
 * background_color is the launch splash behind the centered icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LocalReach — Reviews & Local Growth",
    short_name: "LocalReach",
    description:
      "Guided Google review flow for your venue — multilingual copy, keywords, and QR routing that lifts your local ranking.",
    id: "/",
    // The only person who ever installs this is the STORE OWNER — a guest scans
    // a QR once and leaves. So the installed app must open on the dashboard,
    // not the public demo page. Unauthenticated /admin redirects to login, then
    // straight into the store, which is exactly the owner's path.
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#f59e0b",
    lang: "en",
    dir: "ltr",
    categories: ["business", "productivity", "marketing"],
    shortcuts: [
      {
        name: "Owner Dashboard",
        short_name: "Dashboard",
        description: "Manage your store, QR code and reviews",
        url: "/admin",
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
