import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getMetadataBase, siteMetadata } from "@/lib/site-metadata";
import { getWebApplicationJsonLd } from "@/lib/structured-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: siteMetadata.title,
  description: siteMetadata.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteMetadata.title,
    description: siteMetadata.description,
    siteName: siteMetadata.name,
    locale: "ja_JP",
    type: "website",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: siteMetadata.title,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteMetadata.title,
    description: siteMetadata.description,
    images: ["/og.png"],
  },
  applicationName: siteMetadata.name,
  verification: {
    google: "7fPwEgVdd4XychUawn3dhUgNBMjppQA8NRHLVBVs__I",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = getWebApplicationJsonLd();

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen text-[var(--foreground)] selection:bg-violet-500/30`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* 背景のダイナミック・オーロラメッシュ (アクセントカラーに連動して発光色が変わる究極のグラスモーフィズム) */}
        <div className="fixed inset-0 -z-50 overflow-hidden bg-[var(--background)] pointer-events-none transition-colors duration-300">
          {/* ボール1: アカデミック・アクセント */}
          <div 
            className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] rounded-full blur-[120px] animate-aurora-1 transition-colors duration-500" 
            style={{ backgroundColor: "var(--orb-color-1)" }}
          />
          {/* ボール2: 色相シフト+40° */}
          <div 
            className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] animate-aurora-2 transition-colors duration-500" 
            style={{ backgroundColor: "var(--orb-color-2)" }}
          />
          {/* ボール3: 色相シフト-40° */}
          <div 
            className="absolute top-[25%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[100px] animate-aurora-3 transition-colors duration-500" 
            style={{ backgroundColor: "var(--orb-color-3)" }}
          />
          
          {/* グリッド風の極細オーバーレイで高級感を補強 */}
          <div 
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}
          />
        </div>
        
        {/* メインコンテンツ */}
        <main className="relative min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
