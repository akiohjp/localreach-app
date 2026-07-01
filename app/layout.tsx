import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthHashRedirect } from "@/components/AuthHashRedirect";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const metadataBase =
  appUrl?.startsWith("http") ? new URL(appUrl) : undefined;

export const metadata: Metadata = {
  metadataBase,
  applicationName: "LocalReach",
  title: {
    default: "LocalReach",
    template: "%s — LocalReach",
  },
  description:
    "Guided review flow for Google Business Profile — keywords, multilingual copy, QR for your venue.",
  openGraph: {
    type: "website",
    siteName: "LocalReach",
    title: "LocalReach — Reviews & Local Growth",
    description:
      "Turn happy guests into 5-star Google reviews — a guided multilingual review flow with QR routing for your venue.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LocalReach" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LocalReach — Reviews & Local Growth",
    description:
      "Turn happy guests into 5-star Google reviews — a guided multilingual review flow with QR routing for your venue.",
    images: ["/og.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LocalReach",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Stop iOS Safari from auto-linking phone numbers / addresses in the UI chrome.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Extend under the notch / home indicator; pages opt in via env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f59e0b" },
    { media: "(prefers-color-scheme: dark)", color: "#b45309" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthHashRedirect />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
