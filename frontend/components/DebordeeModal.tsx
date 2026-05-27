'use client';

import {
  IconBoltSoft,
  IconBrainOutline,
  IconLifebuoy,
  IconSparkleAI,
} from './md-icons';
import { TaskAssignSelect, TaskDoneButton } from './taskUi';

export type DebordeeResult = {
  critique: string[];
  deleguer: string[];
  supprimer: string[];
  message: string;
};

export type DebordeeModalPhase = 'closed' | 'confirm' | 'loading' | 'result';

type OpenTask = {
  id: number;
  title: string;
  assigned_member_id?: number | null;
};

type HouseholdMember = { id: number; display_name: string };

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {children}
    </span>
  );
}

export function DebordeeModal({
  C,
  phase,
  openTasks,
  debordeeResult,
  prenom,
  partenaire,
  enfant,
  primaryMemberId,
  partnerMemberId,
  childMemberId,
  householdMembers,
  token,
  taskAssignBusyId,
  taskCompleteBusyId,
  onClose,
  onLaunch,
  onAssign,
  onDone,
}: {
  C: Record<string, string>;
  phase: DebordeeModalPhase;
  openTasks: OpenTask[];
  debordeeResult: DebordeeResult | null;
  prenom: string;
  partenaire: string;
  enfant: string;
  primaryMemberId: number | null;
  partnerMemberId: number | null;
  childMemberId: number | null;
  householdMembers: HouseholdMember[];
  token: string | null;
  taskAssignBusyId: number | null;
  taskCompleteBusyId: number | null;
  onClose: () => void;
  onLaunch: () => void;
  onAssign: (taskId: number, memberId: number | null) => void;
  onDone: (taskId: number) => void;
}) {
  if (phase === 'closed') return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer' }}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: '82%',
          background: C.white,
          borderRadius: '22px 22px 0 0',
          padding: '20px 18px 28px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 16px' }} />
        {phase === 'confirm' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <IconLifebuoy size={44} color={C.red} strokeWidth={1.55} />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: C.red, margin: '0 0 8px' }}>Mode « Je suis débordée »</h3>
              <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
                Alfred analyse ta liste complète : garde le <strong>critique</strong> pour aujourd&apos;hui, propose du relais
                vers {partenaire}, et allège le reste.
              </p>
            </div>
            <div style={{ background: C.redL, borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: 0.4, marginBottom: 6 }}>
                TA LISTE ({openTasks.length} tâches)
              </div>
              {openTasks.slice(0, 8).map((u, i) => (
                <div
                  key={u.id}
                  style={{
                    fontSize: 12,
                    color: C.text,
                    padding: '4px 0',
                    borderBottom: i < Math.min(7, openTasks.length - 1) ? `1px solid ${C.red}22` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  <span>• {u.title}</span>
                  {primaryMemberId != null && u.assigned_member_id === primaryMemberId ? (
                    <Pill bg={C.terraXL} color={C.terra}>
                      → {prenom}
                    </Pill>
                  ) : null}
                  {partnerMemberId != null && u.assigned_member_id === partnerMemberId ? (
                    <Pill bg={C.alexXL} color={C.alex}>
                      → {partenaire}
                    </Pill>
                  ) : null}
                  {childMemberId != null && u.assigned_member_id === childMemberId ? (
                    <Pill bg="#FFF8E8" color="#B8860B">
                      → {enfant}
                    </Pill>
                  ) : null}
                  <TaskAssignSelect
                    C={C}
                    taskId={u.id}
                    assigned_member_id={u.assigned_member_id}
                    members={householdMembers}
                    token={token ?? ''}
                    busy={taskAssignBusyId === u.id}
                    onAssign={onAssign}
                    compact
                  />
                  <TaskDoneButton C={C} taskId={u.id} token={token ?? ''} busyDone={taskCompleteBusyId === u.id} onDone={onDone} />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onLaunch}
              style={{
                width: '100%',
                padding: 14,
                fontSize: 14,
                fontWeight: 800,
                border: 'none',
                borderRadius: 14,
                background: C.red,
                color: '#fff',
              }}
            >
              Lancer le triage Alfred
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ width: '100%', marginTop: 10, padding: 12, border: 'none', background: 'transparent', color: C.text3, fontSize: 13 }}
            >
              Annuler
            </button>
          </>
        ) : null}
        {phase === 'loading' ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
              <IconBrainOutline size={44} color={C.text} strokeWidth={1.45} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>Alfred analyse ta liste…</div>
            <div style={{ fontSize: 13, color: C.text2 }}>Urgences, délégations, ce qui peut attendre.</div>
          </div>
        ) : null}
        {phase === 'result' && debordeeResult ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                <IconSparkleAI size={34} color={C.terra} strokeWidth={1.55} />
              </div>
              <div style={{ fontSize: 14, color: C.terra, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.45 }}>
                &quot;{debordeeResult.message}&quot;
              </div>
            </div>
            {debordeeResult.critique.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: 0.4, marginBottom: 6 }}>
                  CRITIQUE — aujourd&apos;hui
                </div>
                {debordeeResult.critique.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: C.redL,
                      border: `1.5px solid ${C.red}33`,
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 2 }}>
                      <IconBoltSoft size={16} color={C.red} strokeWidth={1.55} />
                    </span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {debordeeResult.deleguer.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.alex, letterSpacing: 0.4, marginBottom: 6 }}>
                  DÉLÉGUÉ — à suivre
                </div>
                {debordeeResult.deleguer.map((t, i) => {
                  const [task, who] = t.split(':');
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: C.alexL,
                        border: `1.5px solid ${C.alex}33`,
                        marginBottom: 6,
                        fontSize: 13,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>{task.trim()}</span>
                      <Pill color={C.alex} bg={C.alexXL}>
                        → {who?.trim() || partenaire}
                      </Pill>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {debordeeResult.supprimer.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: 0.4, marginBottom: 6 }}>
                  REPORTÉ — pas urgent
                </div>
                {debordeeResult.supprimer.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: C.surface2,
                      marginBottom: 6,
                      fontSize: 13,
                      color: C.text3,
                      textDecoration: 'line-through',
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: 13,
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                borderRadius: 14,
                background: C.terra,
                color: '#fff',
              }}
            >
              Parfait, je gère ça
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
