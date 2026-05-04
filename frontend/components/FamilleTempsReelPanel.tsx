'use client';

import { IconMessageBubble, IconTarget } from './md-icons';

/**
 * Stub produit : messagerie groupe + lieux intelligents (roadmap benchmark FamilyWall / ClanPlan).
 */
export function FamilleTempsReelPanel({
  C,
  partenaire,
  enfant,
}: {
  C: Record<string, string>;
  partenaire: string;
  enfant: string;
}) {
  return (
    <div style={{ padding: '18px 18px 40px' }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconMessageBubble size={22} color={C.terra} strokeWidth={1.65} />
          Messagerie famille
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
          Chat de groupe chiffré, pièces jointes et mémos vocaux : <strong>À venir</strong>. Objectif : centraliser les échanges avec le contexte des tâches et du calendrier, sans remplacer WhatsApp du jour au lendemain.
        </p>
      </div>
      <div
        style={{
          background: C.terraXL,
          borderRadius: 16,
          padding: 14,
          marginBottom: 18,
          border: `1px solid ${C.border}`,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 6 }}>Première étape prévue</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.text2, lineHeight: 1.55 }}>
          <li>Salon « Foyer » + notifications opt-in</li>
          <li>Réactions rapides (« Je m&apos;en occupe » liées à une tâche)</li>
          <li>Pièces jointes photos limitées en taille (quota foyer)</li>
        </ul>
      </div>

      <div style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconTarget size={22} color={C.sun} strokeWidth={1.65} />
          Lieux & alertes
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
          Partage de position en temps réel (opt-in) et alertes du type « {enfant} est arrivée à l&apos;école » : <strong>À venir</strong>. Confidentialité et consentement explicites pour chaque membre et chaque lieu enregistré.
        </p>
      </div>
      <p style={{ fontSize: 11, color: C.text3, margin: '16px 0 0', lineHeight: 1.45 }}>
        En attendant : utilise les raccourcis Alfred pour préparer un message à {partenaire} ou les intégrations marquées « web » dans Moi → Intégrations tierces.
      </p>
    </div>
  );
}
