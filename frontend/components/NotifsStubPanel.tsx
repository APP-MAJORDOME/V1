'use client';

import { IconBellRing } from './md-icons';

export function NotifsStubPanel({ C }: { C: Record<string, string> }) {
  return (
    <div style={{ padding: '24px 18px 40px', textAlign: 'center' }}>
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
        <IconBellRing size={48} color={C.lilac} strokeWidth={1.55} />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: C.text }}>Centre de notifications</h3>
      <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.55, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
        Les alertes push, relances partenaire et rappels DLC seront regroupés ici lorsque le canal notifications sera branché sur le backend.
      </p>
    </div>
  );
}
