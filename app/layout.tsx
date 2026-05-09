import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthHashRedirect } from "@/components/AuthHashRedirect";
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
  title: {
    default: "LocalReach",
    template: "%s — LocalReach",
  },
  description:
    "Guided review flow for Google Business Profile — keywords, multilingual copy, QR for your venue.",
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
        {children}
      </body>
    </html>
  );
}
