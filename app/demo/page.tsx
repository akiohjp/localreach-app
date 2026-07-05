import type { Metadata } from "next";
import { qrPngDataUrl } from "@/lib/qr";
import DemoGuide from "./DemoGuide";

export const metadata: Metadata = {
  title: "Demo — LocalReach",
  description: "Presentation flow: guest review journey & admin controls.",
};

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export default async function DemoPage() {
  const base = baseUrl();
  const demoStoreId = process.env.NEXT_PUBLIC_DEMO_STORE_ID?.trim() ?? "";
  const customerUrl = demoStoreId ? `${base}/store/${demoStoreId}` : `${base}/`;
  const adminUrl = `${base}/admin/login`;
  const masterUrl = `${base}/master-admin/login`;
  const lpUrl = `${base}/local-reach-lp`;
  // Generated server-side — the demo store URL is never sent to a third-party QR API.
  const qrDataUrl = await qrPngDataUrl(customerUrl, 220);

  return (
    <DemoGuide
      customerUrl={customerUrl}
      adminUrl={adminUrl}
      masterUrl={masterUrl}
      lpUrl={lpUrl}
      qrDataUrl={qrDataUrl}
      hasDemoStore={Boolean(demoStoreId)}
    />
  );
}
