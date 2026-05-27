'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  IconCart,
  IconHouseCare,
  IconFolderVault,
  IconPeopleOutline,
  IconWallet,
  IconGift,
  IconTrash,
  IconBellRing,
  IconDotsGrid,
  IconKitchen,
  IconBoltSoft,
  IconMail,
  IconCamera,
  IconMessageBubble,
  IconLink,
} from './md-icons';

export type HubKey =
  | 'courses'
  | 'maison'
  | 'documents'
  | 'famille'
  | 'messages'
  | 'wallet'
  | 'anniversaires'
  | 'poubelles'
  | 'notifs'
  | 'recettes'
  | 'routines'
  | 'courrier'
  | 'albums'
  | 'integrations';

/** Catalogue hub (partagé avec la personnalisation de l’accueil). */
export const PLUS_HUB_ITEMS: {
  id: HubKey;
  label: string;
  hint: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  { id: 'maison', label: 'Maison', hint: 'Domotique · jardin', Icon: IconHouseCare },
  { id: 'courses', label: 'Courses & Frigo', hint: 'Liste · DLC · wallet', Icon: IconCart },
  { id: 'recettes', label: 'Recettes', hint: 'Boîte famille · liste', Icon: IconKitchen },
  { id: 'routines', label: 'Routines', hint: 'Quotidien · semaine', Icon: IconBoltSoft },
  { id: 'famille', label: 'Famille & équité', hint: 'Foyer · partenaire', Icon: IconPeopleOutline },
  { id: 'messages', label: 'Famille temps réel', hint: 'Messagerie · lieux (À venir)', Icon: IconMessageBubble },
  { id: 'wallet', label: 'Wallet', hint: 'Fidélité · coupons', Icon: IconWallet },
  { id: 'documents', label: 'Coffre', hint: 'Documents foyer', Icon: IconFolderVault },
  { id: 'courrier', label: 'Courrier IA', hint: 'École · santé · admin', Icon: IconMail },
  { id: 'anniversaires', label: 'Anniversaires', hint: 'Calendrier · cadeaux', Icon: IconGift },
  { id: 'poubelles', label: 'Poubelles', hint: 'Collecte · rappels', Icon: IconTrash },
  { id: 'albums', label: 'Souvenirs', hint: 'Albums famille', Icon: IconCamera },
  { id: 'notifs', label: 'Notifications', hint: 'Centre alertes', Icon: IconBellRing },
  { id: 'integrations', label: 'Intégrations', hint: 'Doctolib, ENT, connexions', Icon: IconLink },
];

export const ALL_HUB_KEYS: HubKey[] = PLUS_HUB_ITEMS.map((i) => i.id);

export function PlusHub({
  onOpen,
  C,
  userFirstName,
  alfredNoteCount = 0,
}: {
  onOpen: (id: HubKey) => void;
  C: Record<string, string>;
  /** Carte type V9 « Bonjour … » */
  userFirstName?: string;
  alfredNoteCount?: number;
}) {
  return (
    <div style={{ padding: '14px 18px 100px', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <IconDotsGrid size={26} color={C.terra} strokeWidth={1.65} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: C.text }}>Tout l&apos;univers</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Tous les modules du foyer — agenda, courses, documents, bien-être et plus.
          </p>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {PLUS_HUB_ITEMS.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => onOpen(i.id)}
            style={{
              textAlign: 'left',
              padding: 14,
              borderRadius: 18,
              border: `1.5px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <i.Icon size={22} color={C.terra} strokeWidth={1.65} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{i.label}</div>
            <div style={{ fontSize: 10, color: C.text3, marginTop: 4, lineHeight: 1.35 }}>{i.hint}</div>
          </button>
        ))}
        <Link
          href="/settings"
          style={{
            padding: 14,
            borderRadius: 18,
            border: `1.5px solid ${C.border}`,
            background: C.surface,
            textDecoration: 'none',
            color: C.text,
            display: 'block',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800 }}>Réglages</div>
          <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>Connexions · compte</div>
        </Link>
      </div>
      {userFirstName ? (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${C.surface}, ${C.lilacL})`,
            border: `1px solid ${C.lilac}44`,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, color: C.lilac, letterSpacing: 0.5 }}>FOYER</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginTop: 6, lineHeight: 1.4 }}>
            Bonjour {userFirstName}.{' '}
            {alfredNoteCount === 0
              ? 'Aucune note mémorisée par Alfred sur cet appareil.'
              : alfredNoteCount === 1
                ? '1 note mémorisée par Alfred sur cet appareil.'
                : `${alfredNoteCount} notes mémorisées par Alfred sur cet appareil.`}
          </div>
        </div>
      ) : null}
      <div style={{ marginTop: 16, padding: 14, borderRadius: 18, background: C.lilacL, border: `1px solid ${C.lilac}44` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.lilac, marginBottom: 6 }}>ASTUCE</div>
        <p style={{ margin: 0, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
          Les écrans ouverts depuis ici se ferment avec « Retour » — tes données restent synchronisées avec le serveur (login requis pour la plupart des actions).
        </p>
      </div>
    </div>
  );
}
