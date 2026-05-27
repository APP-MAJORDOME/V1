import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
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
  },
  twitter: {
    card: 'summary',
    title: 'MajorDome',
    description: 'Ton majordome numérique pour le quotidien familial.',
  },
  robots: { index: false, follow: false },
  icons: {
    icon: '/majordome-icon.svg',
    apple: '/majordome-icon.svg',
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
