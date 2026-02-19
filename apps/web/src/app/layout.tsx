import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "AyurVeda — Pure. Natural. Authentic.",
    template: "%s | AyurVeda",
  },
  description:
    "Discover authentic Ayurvedic products handcrafted with traditional wisdom. Shop oils, herbs, skincare, and wellness products.",
  keywords: ["ayurveda", "herbal", "natural", "wellness", "organic", "skincare"],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "AyurVeda",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
