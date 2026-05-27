'use client';

import { IconCheckSmall, IconPartyOutline, IconUserOutline, InlineDocGlyph } from './md-icons';
import { TaskAssignSelect, TaskDoneButton } from './taskUi';

export type AlexTaskItem = {
  id: number;
  icon: string;
  label: string;
  urgency: string;
  color: string;
  assigned_member_id?: number | null;
};

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

export function AlexModal({
  C,
  open,
  prenom,
  partenaire,
  enfant,
  tasks,
  doneIds,
  notified,
  primaryMemberId,
  partnerMemberId,
  childMemberId,
  householdMembers,
  token,
  taskAssignBusyId,
  taskCompleteBusyId,
  onClose,
  onToggleDone,
  onAssign,
  onDone,
  onNotifyPrimary,
}: {
  C: Record<string, string>;
  open: boolean;
  prenom: string;
  partenaire: string;
  enfant: string;
  tasks: AlexTaskItem[];
  doneIds: number[];
  notified: boolean;
  primaryMemberId: number | null;
  partnerMemberId: number | null;
  childMemberId: number | null;
  householdMembers: { id: number; display_name: string }[];
  token: string | null;
  taskAssignBusyId: number | null;
  taskCompleteBusyId: number | null;
  onClose: () => void;
  onToggleDone: (taskId: number) => void;
  onAssign: (taskId: number, memberId: number | null) => void;
  onDone: (taskId: number) => void;
  onNotifyPrimary: () => void | Promise<void>;
}) {
  if (!open) return null;

  const progressPct = Math.round((doneIds.length / Math.max(tasks.length, 1)) * 100);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
  <button type="button" aria-label="Fermer" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }} />
  <div style={{ position: 'relative', width: '100%', maxHeight: '90%', background: C.white, borderRadius: '22px 22px 0 0', overflowY: 'auto' }}>
    <div style={{ background: `linear-gradient(135deg, ${C.alex}, #3A5A9C)`, padding: '18px 18px 20px', borderRadius: '22px 22px 0 0' }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.35)', margin: '0 auto 14px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 50, height: 50, borderRadius: 16, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconUserOutline size={28} color="#fff" strokeWidth={1.65} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>VUE PARTENAIRE</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Bonjour {partenaire}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{prenom} a préparé ta liste</div>
        </div>
      </div>
      <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>Tâches du jour</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{progressPct}%</span>
        </div>
        <div style={{ height: 7, background: 'rgba(255,255,255,0.2)', borderRadius: 7, overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: '#fff', borderRadius: 7 }} />
        </div>
      </div>
    </div>
    <div style={{ padding: '16px 18px 28px' }}>
      {!notified ? (
        <div style={{ background: C.alexL, borderRadius: 14, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: C.alex, lineHeight: 1.5 }}>
          « {prenom} a besoin de toi aujourd&apos;hui. Voici 5 choses qui feraient vraiment la différence. »
        </div>
      ) : null}
      {tasks.map((t) => {
        const done = doneIds.includes(t.id);
        
        const aid = t.assigned_member_id;
        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 10px',
              borderRadius: 14,
              border: `1.5px solid ${done ? C.green + '55' : C.border}`,
              background: done ? C.greenL : C.surface,
              marginBottom: 8,
            }}
          >
            <button
              type="button"
              onClick={() => onToggleDone(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
              }}
            >
              <span style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                <InlineDocGlyph icon={t.icon} size={22} color={C.alex} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: done ? C.green : C.text,
                      textDecoration: done ? 'line-through' : 'none',
                    }}
                  >
                    {t.label}
                  </span>
                  {primaryMemberId != null && aid === primaryMemberId ? (
                    <Pill bg={C.terraXL} color={C.terra}>
                      {prenom}
                    </Pill>
                  ) : null}
                  {partnerMemberId != null && aid === partnerMemberId ? (
                    <Pill bg={C.alexXL} color={C.alex}>
                      Pour toi
                    </Pill>
                  ) : null}
                  {childMemberId != null && aid === childMemberId ? (
                    <Pill bg="#FFF8E8" color="#B8860B">
                      {enfant}
                    </Pill>
                  ) : null}
                </div>
                <div style={{ fontSize: 10, color: done ? C.green : t.color, fontWeight: 600, marginTop: 2 }}>{t.urgency}</div>
              </div>
            </button>
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}
            >
              <TaskAssignSelect
                C={C}
                taskId={t.id}
                assigned_member_id={aid}
                members={householdMembers}
                token={token ?? ''}
                busy={taskAssignBusyId === t.id}
                onAssign={onAssign}
                compact
              />
              <TaskDoneButton C={C} taskId={t.id} token={token ?? ''} busyDone={taskCompleteBusyId === t.id} onDone={onDone} />
            </div>
            <button
              type="button"
              aria-label={done ? 'Annuler fait' : 'Marquer fait'}
              onClick={() => onToggleDone(t.id)}
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: 11,
                border: `2px solid ${done ? C.green : C.text3}`,
                background: done ? C.green : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {done ? <IconCheckSmall size={11} color="#fff" strokeWidth={2.5} /> : null}
            </button>
          </div>
        );
      })}
      {doneIds.length > 0 && !notified ? (
        <button
          type="button"
          onClick={() => void onNotifyPrimary()}
          style={{ width: '100%', marginTop: 6, padding: 13, borderRadius: 14, border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 800 }}
        >
          Signaler à {prenom} : {doneIds.length} tâche(s) faite(s)
        </button>
      ) : null}
      {notified ? (
        <div style={{ background: C.greenL, borderRadius: 14, padding: '12px 14px', textAlign: 'center', marginTop: 8 }}>
          <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
            <IconPartyOutline size={28} color={C.green} strokeWidth={1.55} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{prenom} a été notifiée</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>Merci {partenaire}</div>
        </div>
      ) : null}
      <button type="button" onClick={onClose} style={{ width: '100%', marginTop: 12, padding: 10, border: 'none', background: 'transparent', color: C.text3, fontSize: 13 }}>
        ← Retour
      </button>
    </div>
  </div>
  </div>
  );
}
