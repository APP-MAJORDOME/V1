'use client';

import { DocGlyphBubble, docCategoryLabel, IconFolderVault, IconPaperclip } from './md-icons';
import { formatDocStorageShort } from '../lib/documentsUi';

type DocPreview = {
  id: number;
  icon: string;
  name: string;
  cat: string;
  attachmentSizeBytes?: number | null;
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

export function DocumentsTabPanel({
  C,
  token,
  docVault,
  docStorageSummary,
  onOpenVault,
  onOpenDoc,
  onDownloadAttachment,
}: {
  C: Record<string, string>;
  token: string | null;
  docVault: DocPreview[];
  docStorageSummary: { used_bytes: number; quota_bytes: number | null } | null;
  onOpenVault: () => void;
  onOpenDoc: (docId: number) => void;
  onDownloadAttachment: (docId: number) => void | Promise<void>;
}) {
  return (
    <div
      style={{
        padding: '14px 18px',
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        minHeight: 0,
        touchAction: 'pan-y',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: C.sageL,
            border: `1px solid ${C.sage}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconFolderVault size={28} color={C.sage} strokeWidth={1.65} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
            Stockage des références foyer (contrats, santé, identité). Ce n&apos;est pas Google Drive : tout reste dans
            MajorDome ; synchronisation cloud (Drive, iCloud) pourra être proposée plus tard.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenVault}
        style={{
          marginBottom: 12,
          width: '100%',
          borderRadius: 14,
          border: 'none',
          padding: '12px 14px',
          background: C.terra,
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        Ouvrir le coffre complet ({docVault.length})
      </button>
      {!token ? (
        <p style={{ fontSize: 11, color: C.text2, margin: '0 0 10px' }}>
          Connecte-toi pour synchroniser les documents du foyer.
        </p>
      ) : null}
      {docVault.slice(0, 12).map((d) => (
        <div
          key={d.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: `1px solid ${C.border}`,
            padding: '10px 0',
          }}
        >
          <DocGlyphBubble icon={d.icon} />
          <button
            type="button"
            onClick={() => {
              onOpenVault();
              onOpenDoc(d.id);
            }}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              minWidth: 0,
              border: 'none',
              padding: 0,
              background: 'transparent',
              cursor: token ? 'pointer' : 'default',
              textAlign: 'left',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {d.name}
            </span>
            <Pill bg={C.surface} color={C.sage}>
              {docCategoryLabel(d.cat)}
            </Pill>
          </button>
          {d.attachmentSizeBytes && token ? (
            <button
              type="button"
              aria-label="Télécharger la pièce jointe"
              title="Télécharger"
              onClick={(e) => {
                e.stopPropagation();
                void onDownloadAttachment(d.id);
              }}
              style={{
                flexShrink: 0,
                width: 38,
                height: 38,
                borderRadius: 11,
                border: `1px solid ${C.sage}`,
                background: C.white,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconPaperclip size={18} color={C.sage} strokeWidth={1.65} />
            </button>
          ) : null}
        </div>
      ))}
      {token && docStorageSummary ? (
        <p style={{ fontSize: 11, color: C.text3, marginTop: 14, textAlign: 'center' }}>
          {formatDocStorageShort(docStorageSummary.used_bytes, docStorageSummary.quota_bytes)}
        </p>
      ) : null}
    </div>
  );
}
