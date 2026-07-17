// CANONICAL root layout for PortalPulse. Fonts, metadata, and viewport live here.
import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const displayFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: 'PortalPulse: every GC portal deadline on one calendar',
    template: '%s | PortalPulse',
  },
  description:
    'Forward GC portal emails to your PortalPulse address. AI pulls COI renewals, pay app windows, and lien waiver deadlines into one calendar across GCPay, Oracle Textura, Procore, and Buildbite.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'PortalPulse: every GC portal deadline on one calendar',
    description:
      'Forward GC portal emails to your PortalPulse address. AI pulls COI renewals, pay app windows, and lien waiver deadlines into one calendar across GCPay, Oracle Textura, Procore, and Buildbite.',
    url: '/',
    siteName: 'PortalPulse',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'PortalPulse — every GC portal deadline on one calendar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PortalPulse: every GC portal deadline on one calendar',
    description:
      'AI pulls COI renewals, pay app windows, and lien waiver deadlines from GC portal emails into one unified calendar.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
