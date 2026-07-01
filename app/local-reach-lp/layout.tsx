import type { Metadata } from "next";

// The LP page itself is a Client Component and can't export metadata, so this
// route-segment layout supplies its SEO / OG tags (title, description, canonical).
export const metadata: Metadata = {
  // Root layout applies the "%s — LocalReach" template, so keep this suffix-free.
  title: "店舗の集客を、レビューから",
  description:
    "Googleのクチコミを増やし、地域検索で上位に。多言語対応の誘導フローとQRコードで、来店客を5つ星レビューへ。",
  alternates: { canonical: "/local-reach-lp" },
  openGraph: {
    title: "店舗の集客を、レビューから — LocalReach",
    description:
      "Googleのクチコミを増やし、地域検索で上位に。多言語対応の誘導フローとQRで来店客を5つ星レビューへ。",
    url: "/local-reach-lp",
  },
};

export default function LocalReachLpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
