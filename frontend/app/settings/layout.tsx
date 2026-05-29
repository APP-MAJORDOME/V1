import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Paramètres — MajorDome' },
  description: 'Connexions agenda, Alfred, sécurité et compte MajorDome.',
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
