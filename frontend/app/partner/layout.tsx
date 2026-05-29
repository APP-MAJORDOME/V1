import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Vue partenaire — MajorDome' },
  description: 'Tâches déléguées et vue simplifiée pour le partenaire du foyer.',
  robots: { index: false, follow: false },
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
