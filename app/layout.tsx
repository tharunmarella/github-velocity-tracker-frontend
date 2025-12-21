import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Velocity Radar | GitHub Trend Radar & Open Source Analytics",
  description: "Spot high-momentum open source projects before they go viral. AI-powered developer intent analysis and GitHub repository velocity tracking.",
  keywords: ["github trends", "open source analytics", "velocity tracker", "developer intent", "trending repositories", "market intelligence", "ai repo analysis"],
  authors: [{ name: "Velocity Team" }],
  openGraph: {
    title: "Velocity Radar | GitHub Trend Radar",
    description: "Spot high-momentum open source projects before they go viral.",
    url: "https://velocityradar.io",
    siteName: "Velocity Radar",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Velocity Radar Dashboard Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Velocity Radar | GitHub Trend Radar",
    description: "Spot high-momentum open source projects before they go viral.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
