'use client';

import { IconMail } from './md-icons';

const SAMPLES = [
  {
    id: 'm1',
    from: 'École Jean Jaurès',
    subject: 'Sortie scolaire au musée — vendredi',
    icon: '🎒',
    tasks: ['Signer autorisation parentale', 'Préparer pique-nique', 'Cartable + ciré'],
  },
  {
    id: 'm2',
    from: 'Cabinet pédiatrique',
    subject: 'Confirmation RDV jeudi 14h30',
    icon: '🩺',
    tasks: ['Carnet de santé', 'Noter symptômes récents'],
  },
  {
    id: 'm3',
    from: 'Club sportif',
    subject: 'Tournoi week-end',
    icon: '⚽',
    tasks: ['Maillot propre', 'Goûter à apporter'],
  },
  {
    id: 'm4',
    from: 'Assurance habitation',
    subject: 'Échéance contrat à venir',
    icon: '🏠',
    tasks: ['Comparer 2 devis', 'Vérifier garanties'],
  },
] as const;

export function CourrierPanel({
  C,
  token,
  busy,
  onImportTasks,
}: {
  C: Record<string, string>;
  token: string | null;
  busy: boolean;
  onImportTasks: (titles: string[]) => void | Promise<void>;
}) {
  return (
    <div style={{ padding: '14px 18px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <IconMail size={26} color={C.alex} strokeWidth={1.65} />
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.5 }}>COURRIER IA</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Aperçu : connecte ta boîte mail dans Paramètres pour analyser ton courrier réel.
          </p>
        </div>
      </div>

      {!token ? (
        <p style={{ fontSize: 12, color: C.sun, marginBottom: 14, padding: 12, borderRadius: 12, background: '#FFF8E6', border: `1px solid ${C.border}` }}>
          Connecte-toi pour créer les tâches dans ton foyer à partir du courrier.
        </p>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SAMPLES.map((m) => (
          <div
            key={m.id}
            style={{
              borderRadius: 16,
              border: `1.5px solid ${C.border}`,
              padding: 14,
              background: C.white,
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 28 }}>{m.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.text3 }}>{m.from}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 4 }}>{m.subject}</div>
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                  {m.tasks.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!token || busy}
                  onClick={() => void onImportTasks(m.tasks.map((t) => `${m.from.split(' ')[0]} — ${t}`))}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    padding: '10px 12px',
                    background: token ? C.alex : C.surface3,
                    color: token ? '#fff' : C.text3,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: !token || busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy ? 'Import…' : `Importer ${m.tasks.length} tâche(s)`}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
