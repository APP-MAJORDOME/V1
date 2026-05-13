import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MajorDome',
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
