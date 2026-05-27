import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'MajorDome — Majordome familial',
    template: '%s — MajorDome',
  },
  description:
    'MajorDome aide les familles à réduire la charge mentale : agenda, tâches, courses, documents et assistant Alfred.',
  openGraph: {
    title: 'MajorDome',
    description: 'Ton majordome numérique pour le quotidien familial.',
    type: 'website',
    locale: 'fr_FR',
  },
  robots: { index: false, follow: false },
  icons: {
    icon: '/majordome-picto.png',
    apple: '/majordome-picto.png',
  },
};

/** iOS / encoches : permet env(safe-area-inset-*) pour barres UI et recherche. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
