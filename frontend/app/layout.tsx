import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import { NativeShellSync } from '../components/NativeShellSync';
import { NATIVE_SHELL_BOOT_SCRIPT } from '../lib/nativeShell';
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
    images: [{ url: '/majordome-logo-horizontal.png', width: 1400, height: 347, alt: 'MajorDome' }],
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
    icon: '/majordome-app-icon.png',
    apple: '/majordome-app-icon.png',
  },
};

/** iOS / encoches : permet env(safe-area-inset-*) pour barres UI et recherche. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#C96B4A',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NATIVE_SHELL_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        <NativeShellSync />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
