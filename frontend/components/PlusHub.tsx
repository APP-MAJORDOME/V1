'use client';

import Link from 'next/link';
import { LocalDataNotice } from './PrivacyLinks';
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

/** Catalogue hub (partagé avec la personnalisation de l'accueil). */
export const PLUS_HUB_ITEMS: {
  id: HubKey;
  label: string;
  hint: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  { id: 'maison', label: 'Maison', hint: 'Domotique · jardin', Icon: IconHouseCare },
  { id: 'courses', label: 'Courses & Frigo', hint: 'Liste · DLC · fidélité', Icon: IconCart },
  { id: 'recettes', label: 'Recettes', hint: 'Boîte famille · liste', Icon: IconKitchen },
  { id: 'routines', label: 'Routines', hint: 'Quotidien · semaine', Icon: IconBoltSoft },
  { id: 'famille', label: 'Famille & équité', hint: 'Foyer · partenaire', Icon: IconPeopleOutline },
  { id: 'messages', label: 'Salon foyer', hint: 'Conversation · captures Alfred', Icon: IconMessageBubble },
  { id: 'documents', label: 'Coffre', hint: 'Documents foyer', Icon: IconFolderVault },
  { id: 'courrier', label: 'Courrier IA', hint: 'École · santé · admin', Icon: IconMail },
  { id: 'anniversaires', label: 'Anniversaires', hint: 'Calendrier · cadeaux', Icon: IconGift },
  { id: 'poubelles', label: 'Poubelles', hint: 'Collecte · rappels', Icon: IconTrash },
  { id: 'albums', label: 'Souvenirs', hint: 'Albums famille', Icon: IconCamera },
  { id: 'notifs', label: 'Notifications', hint: 'Centre alertes', Icon: IconBellRing },
  { id: 'integrations', label: 'Intégrations', hint: 'Doctolib, ENT, connexions', Icon: IconLink },
];

/** Modules affichés dans la section « Bientôt disponible » (non interactifs). */
export const COMING_SOON_HUB_IDS: HubKey[] = [];

const HUB_CATEGORIES: { title: string; ids: HubKey[] }[] = [
  {
    title: 'Quotidien',
    ids: ['courses', 'recettes', 'routines', 'maison', 'poubelles'],
  },
  {
    title: 'Foyer',
    ids: ['famille', 'documents', 'courrier', 'albums', 'anniversaires'],
  },
  {
    title: 'Outils',
    ids: ['notifs', 'integrations'],
  },
];

export const ALL_HUB_KEYS: HubKey[] = PLUS_HUB_ITEMS.map((i) => i.id);

export function PlusHub({
  onOpen,
  C,
  userFirstName,
  alfredNoteCount = 0,
  embedded = false,
}: {
  onOpen: (id: HubKey) => void;
  C: Record<string, string>;
  /** Carte type V9 « Bonjour … » */
  userFirstName?: string;
  alfredNoteCount?: number;
  /** Intégré dans l’onglet Moi (sans doublon compte / padding plein écran). */
  embedded?: boolean;
}) {
  const byId = Object.fromEntries(PLUS_HUB_ITEMS.map((i) => [i.id, i])) as Record<HubKey, (typeof PLUS_HUB_ITEMS)[number]>;

  return (
    <div
      style={
        embedded
          ? { padding: '0 0 8px' }
          : { padding: '14px 18px 100px', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <IconDotsGrid size={embedded ? 22 : 26} color={C.terra} strokeWidth={1.65} />
        <div>
          <h2 style={{ margin: 0, fontSize: embedded ? 18 : 22, color: C.text }}>
            {embedded ? 'Modules du foyer' : "Tout l'univers"}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            {embedded
              ? 'Courses, maison, documents, intégrations — tout le foyer depuis ton espace.'
              : 'Tous les modules du foyer — agenda, courses, documents, bien-être et plus.'}
          </p>
        </div>
      </div>
      {HUB_CATEGORIES.map((cat) => (
        <section key={cat.title} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.text2,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {cat.title}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            {cat.ids.map((id) => {
              const i = byId[id];
              if (!i) return null;
              return (
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
                    minHeight: 100,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <i.Icon size={22} color={C.terra} strokeWidth={1.65} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{i.label}</div>
                  <div style={{ fontSize: 10, color: C.text3, marginTop: 4, lineHeight: 1.35 }}>{i.hint}</div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <section style={{ marginBottom: 18 }} aria-labelledby="plus-hub-coming-soon">
        <h2
          id="plus-hub-coming-soon"
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.text2,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            margin: '0 0 8px',
          }}
        >
          Bientôt disponible
        </h2>
        <p style={{ fontSize: 10, color: C.text3, margin: '0 0 10px', lineHeight: 1.45 }}>
          Ces modules arrivent prochainement — pas encore utilisables.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {COMING_SOON_HUB_IDS.map((id) => {
            const i = byId[id];
            if (!i) return null;
            return (
              <div
                key={i.id}
                style={{
                  textAlign: 'left',
                  padding: 14,
                  borderRadius: 18,
                  border: `1.5px dashed ${C.border}`,
                  background: C.surface2,
                  minHeight: 100,
                  opacity: 0.85,
                }}
                aria-disabled="true"
              >
                <div style={{ marginBottom: 8 }}>
                  <i.Icon size={22} color={C.text3} strokeWidth={1.65} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text2 }}>{i.label}</div>
                <div style={{ fontSize: 10, color: C.text3, marginTop: 4, lineHeight: 1.35 }}>{i.hint}</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: C.terra, marginTop: 8, letterSpacing: 0.3 }}>À VENIR</div>
              </div>
            );
          })}
        </div>
      </section>
      {!embedded ? (
        <section style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.text2,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Compte
          </div>
          <Link
            href="/settings"
            style={{
              display: 'block',
              padding: 14,
              borderRadius: 18,
              border: `1.5px solid ${C.border}`,
              background: C.surface,
              textDecoration: 'none',
              color: C.text,
              minHeight: 100,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800 }}>Réglages</div>
            <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>Connexions · compte</div>
          </Link>
        </section>
      ) : null}
      {!embedded && userFirstName ? (
        <div
          style={{
            marginTop: 4,
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
              ? 'Mémoire du foyer vide pour l\'instant.'
              : alfredNoteCount === 1
                ? '1 fait mémorisé dans la mémoire du foyer.'
                : `${alfredNoteCount} faits mémorisés dans la mémoire du foyer.`}
          </div>
          <LocalDataNotice C={C} compact />
        </div>
      ) : null}
    </div>
  );
}
