import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MajorDome',
  icons: {
    icon: '/majordome-picto.png',
    apple: '/majordome-picto.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
