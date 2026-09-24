import './globals.css';
import type { Metadata } from 'next';
import { getAnalyzeSiteConfig } from '../lib/siteConfig';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const site = getAnalyzeSiteConfig();
    return {
      title: site.metadataTitle,
      description: site.description,
    };
  } catch {
    return {
      title: 'Siteni Analiz Et',
      description: 'Gerçek zamanlı trafik analiz paneli',
    };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
