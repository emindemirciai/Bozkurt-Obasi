import "./globals.css";
import type { Metadata } from "next";
import { getAnalyzeSiteConfig } from "../lib/siteConfig";

const themeBootstrap = '(function(){var stored;try{stored=localStorage.getItem("bozkurt-analyze-theme")}catch(e){}var theme=stored==="dark"||stored==="light"?stored:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme})()';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const site = getAnalyzeSiteConfig();
    return {
      title: site.metadataTitle,
      description: site.description,
    };
  } catch {
    return {
      title: "Siteni Analiz Et",
      description: "Gerçek zamanlı trafik analiz paneli",
    };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <meta name="copyright" content="Copyright © 2026 Emin DEMİRCİ. Licensed under MIT; retain the copyright and license notice on reuse." />
        <meta name="license" content="MIT — https://opensource.org/license/mit" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
