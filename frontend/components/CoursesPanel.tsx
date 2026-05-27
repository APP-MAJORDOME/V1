'use client';

import { IconCheckSmall, IconCoupon, IconWallet } from './md-icons';
import { SwipeableCourseRow } from './SwipeableCourseRow';
import { fridgeExpiryTone } from '../lib/expiry';

export type CourseItem = { id: number; label: string; done: boolean; delegated?: boolean };
type FridgeItem = { id: number; label: string; expires_at: string; qty: number };
type Coupon = { id: number; label: string; expires_at: string; discount: string };
type WalletCard = { id: number; brand: string; points: number; color: string };

function PillTab({
  active,
  label,
  badge,
  onClick,
  C,
}: {
  active: boolean;
  label: string;
  badge?: string;
  onClick: () => void;
  C: Record<string, string>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        border: 'none',
        borderRadius: 20,
        padding: '10px 8px',
        background: active ? C.terra : 'transparent',
        color: active ? '#fff' : C.text2,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {label}
      {badge ? (
        <span
          style={{
            marginLeft: 4,
            fontSize: 9,
            fontWeight: 800,
            background: active ? 'rgba(255,255,255,0.25)' : C.redL,
            color: active ? '#fff' : C.red,
            borderRadius: 8,
            padding: '1px 5px',
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function CoursesPanel({
  C,
  coursesTab,
  setCoursesTab,
  courses,
  newCourse,
  setNewCourse,
  doneCourses,
  fridgeSorted,
  fridgeAlertsCount,
  fridgeExpiredCount,
  activeCoupons,
  expiredCoupons,
  walletCards,
  partnerName,
  onAddCourse,
  onToggleCourse,
  onRemoveCourse,
  onDelegateCourse,
  onClearDoneCourses,
  onRemoveFridgeItem,
  pushToast,
}: {
  C: Record<string, string>;
  coursesTab: 'liste' | 'frigo' | 'wallet';
  setCoursesTab: (t: 'liste' | 'frigo' | 'wallet') => void;
  courses: CourseItem[];
  newCourse: string;
  setNewCourse: (v: string) => void;
  doneCourses: number;
  fridgeSorted: FridgeItem[];
  fridgeAlertsCount: number;
  fridgeExpiredCount: number;
  activeCoupons: Coupon[];
  expiredCoupons: Coupon[];
  walletCards: WalletCard[];
  partnerName: string;
  onAddCourse: () => void;
  onToggleCourse: (id: number, nextDone: boolean) => void;
  onRemoveCourse: (id: number) => void;
  onDelegateCourse: (id: number) => void;
  onClearDoneCourses: () => void;
  onRemoveFridgeItem: (id: number) => void;
  pushToast: (kind: 'success' | 'error' | 'info', text: string) => void;
}) {
  const openCount = courses.filter((c) => !c.done).length;

  return (
    <div style={{ padding: '14px 16px 28px', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 14,
          padding: 4,
          background: C.surface2,
          borderRadius: 24,
        }}
      >
        <PillTab active={coursesTab === 'liste'} label="Liste" onClick={() => setCoursesTab('liste')} C={C} />
        <PillTab
          active={coursesTab === 'frigo'}
          label="Frigo"
          badge={fridgeExpiredCount > 0 ? String(fridgeExpiredCount) : fridgeAlertsCount > 0 ? '!' : undefined}
          onClick={() => setCoursesTab('frigo')}
          C={C}
        />
        <PillTab active={coursesTab === 'wallet'} label="Wallet" onClick={() => setCoursesTab('wallet')} C={C} />
      </div>

      {coursesTab === 'liste' ? (
        <>
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: C.bg,
              paddingBottom: 10,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <label htmlFor="new-course-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
                Ajouter un article
              </label>
              <input
                id="new-course-input"
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAddCourse();
                }}
                placeholder="Ajouter un article…"
                style={{
                  flex: 1,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  padding: '12px 14px',
                  fontSize: 16,
                  background: C.white,
                }}
              />
              <button
                type="button"
                aria-label="Ajouter à la liste"
                onClick={onAddCourse}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  background: C.terra,
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: C.text2 }}>
              Panier : <strong style={{ color: C.text }}>{doneCourses}/{courses.length}</strong>
              {openCount > 0 ? ` · ${openCount} restant(s)` : ' · tout est coché'}
            </div>
          </div>

          {courses.length === 0 ? (
            <p style={{ fontSize: 14, color: C.text2, textAlign: 'center', marginTop: 24 }}>Ta liste est vide. Ajoute un article ci-dessus.</p>
          ) : (
            courses.map((item) => (
              <SwipeableCourseRow
                key={item.id}
                label={item.label}
                done={item.done}
                delegated={item.delegated}
                C={C}
                partnerName={partnerName}
                onToggle={() => {
                  const nextDone = !item.done;
                  onToggleCourse(item.id, nextDone);
                  if (nextDone) pushToast('success', `${item.label} — c’est noté`);
                }}
                onDelete={() => {
                  if (!window.confirm(`Supprimer « ${item.label} » de la liste ?`)) return;
                  onRemoveCourse(item.id);
                  pushToast('info', 'Article retiré');
                }}
                onDelegate={() => {
                  onDelegateCourse(item.id);
                  pushToast('success', `« ${item.label} » délégué à ${partnerName || 'ton partenaire'}`);
                }}
              />
            ))
          )}

          {doneCourses > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Retirer tous les articles cochés ?')) return;
                onClearDoneCourses();
                pushToast('info', 'Articles cochés retirés');
              }}
              style={{
                marginTop: 16,
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: `1.5px dashed ${C.border}`,
                background: 'transparent',
                color: C.text2,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Vider les articles cochés ({doneCourses})
            </button>
          ) : null}
        </>
      ) : null}

      {coursesTab === 'frigo' ? (
        <>
          <div
            style={{
              padding: 12,
              marginBottom: 12,
              borderRadius: 16,
              background: fridgeExpiredCount > 0 ? C.redL : fridgeAlertsCount > 0 ? '#FFF4E8' : C.greenL,
            }}
          >
            <strong style={{ fontSize: 13, color: fridgeExpiredCount > 0 ? C.red : fridgeAlertsCount > 0 ? C.sun : C.green }}>
              {fridgeExpiredCount > 0
                ? `${fridgeExpiredCount} produit(s) périmé(s)`
                : fridgeAlertsCount > 0
                  ? `${fridgeAlertsCount} alerte(s) DLC`
                  : 'Frigo OK — aucune alerte'}
            </strong>
          </div>
          {fridgeSorted.map((f) => {
            const tone = fridgeExpiryTone(f.expires_at);
            const toneColor = tone === 'expired' ? C.red : tone === 'urgent' ? C.red : tone === 'soon' ? C.sun : C.green;
            return (
              <div
                key={f.id}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 16,
                  background: C.white,
                  border: tone === 'expired' ? `1.5px solid ${C.red}` : `1.5px solid ${C.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {tone === 'expired' ? '⚠️ ' : ''}
                      {f.label}
                    </div>
                    <div style={{ fontSize: 12, color: toneColor }}>
                      DLC {new Date(f.expires_at).toLocaleDateString('fr-FR')} · Qté {f.qty}
                      {tone === 'expired' ? ' · Périmé' : tone === 'urgent' ? ' · Urgent' : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Retirer ${f.label}`}
                    onClick={() => {
                      if (!window.confirm(`Retirer « ${f.label} » du frigo ?`)) return;
                      onRemoveFridgeItem(f.id);
                      pushToast('info', `${f.label} retiré du frigo`);
                    }}
                    style={{
                      border: 'none',
                      background: C.terraXL,
                      color: C.terra,
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Retirer
                  </button>
                </div>
              </div>
            );
          })}
        </>
      ) : null}

      {coursesTab === 'wallet' ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconWallet size={15} color={C.text} strokeWidth={1.65} />
            Cartes fidélité
          </div>
          {walletCards.map((c) => (
            <div key={c.id} style={{ borderRadius: 14, background: c.color, color: '#fff', padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.brand}</div>
              <div style={{ fontSize: 12 }}>{c.points} points</div>
            </div>
          ))}
          <div style={{ fontSize: 12, fontWeight: 700, margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCoupon size={15} color={C.text} strokeWidth={1.65} />
            Coupons actifs ({activeCoupons.length})
          </div>
          {activeCoupons.length === 0 ? (
            <p style={{ fontSize: 13, color: C.text2 }}>Aucun coupon actif.</p>
          ) : (
            activeCoupons.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: C.text2 }}>Expire {new Date(c.expires_at).toLocaleDateString('fr-FR')}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.terra }}>{c.discount}</span>
              </div>
            ))
          )}
          {expiredCoupons.length > 0 ? (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12, color: C.text2, cursor: 'pointer' }}>
                {expiredCoupons.length} coupon(s) expiré(s)
              </summary>
              {expiredCoupons.map((c) => (
                <div key={c.id} style={{ padding: '6px 0', opacity: 0.6, fontSize: 12 }}>
                  {c.label}
                </div>
              ))}
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
