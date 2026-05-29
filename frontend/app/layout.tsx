import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://majordom.eu'),
  title: {
    default: 'MajorDome — Majordome familial',
    template: '%s — MajorDome',
  },
  description:
    'MajorDome aide les familles à réduire la charge mentale : agenda, tâches, courses, documents et assistant Alfred.',
  applicationName: 'MajorDome',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MajorDome',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'MajorDome',
    description: 'Ton majordome numérique pour le quotidien familial.',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'MajorDome',
    images: [{ url: '/majordome-mark.png', width: 512, height: 512, alt: 'MajorDome' }],
  },
  alternates: {
    canonical: 'https://majordom.eu/',
  },
  twitter: {
    card: 'summary',
    title: 'MajorDome',
    description: 'Ton majordome numérique pour le quotidien familial.',
  },
  robots: { index: false, follow: false },
  icons: {
    icon: '/majordome-mark.png',
    apple: '/majordome-mark.png',
  },
};

/** iOS / encoches : permet env(safe-area-inset-*) pour barres UI et recherche. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#C96B4A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
