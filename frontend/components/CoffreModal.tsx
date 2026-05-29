'use client';

import type { RefObject } from 'react';
import {
  DOC_CATEGORY_FILTER_IDS,
  DocGlyphPicker,
  docMatchesCategoryFilter,
  IconAlertOutline,
  IconCamera,
  IconMail,
  IconPaperclip,
  IconSearch,
  InlineDocGlyph,
} from './md-icons';
import { DOC_COFFRE_CATEGORIES, formatDocStorageShort } from '../lib/documentsUi';

export type DocVaultItem = {
  id: number;
  icon: string;
  name: string;
  cat: string;
  date: string;
  exp?: string;
  who: string;
  urgent?: boolean;
  notes?: string;
  attachmentOriginalName?: string | null;
  attachmentSizeBytes?: number | null;
};

export type DocEditDraft = {
  id: number;
  icon: string;
  name: string;
  category: string;
  date_label: string;
  who: string;
  notes: string;
  expires_date: string;
};

export function CoffreModal({
  C,
  open,
  token,
  loading,
  prenom,
  docVault,
  docStorageSummary,
  docCat,
  onDocCatChange,
  docSearch,
  onDocSearchChange,
  docAddedFlash,
  docEdit,
  onDocEditChange,
  docEditSaving,
  docAttachmentReplaceRef,
  docPhotoInputRef,
  onClose,
  onRefresh,
  onQuickAdd,
  onOpenDocEdit,
  onSaveDocEdit,
  onDownloadAttachment,
  onUploadAttachment,
  onRemoveAttachment,
  onToggleUrgent,
  onDeleteDoc,
  onCreateFromPhoto,
  onOpenDocEmailDraft,
}: {
  C: Record<string, string>;
  open: boolean;
  token: string | null;
  loading: boolean;
  prenom: string;
  docVault: DocVaultItem[];
  docStorageSummary: { used_bytes: number; quota_bytes: number | null } | null;
  docCat: string;
  onDocCatChange: (cat: string) => void;
  docSearch: string;
  onDocSearchChange: (q: string) => void;
  docAddedFlash: boolean;
  docEdit: DocEditDraft | null;
  onDocEditChange: (updater: (prev: DocEditDraft | null) => DocEditDraft | null) => void;
  docEditSaving: boolean;
  docAttachmentReplaceRef: RefObject<HTMLInputElement>;
  docPhotoInputRef: RefObject<HTMLInputElement>;
  onClose: () => void;
  onRefresh: () => void;
  onQuickAdd: () => void | Promise<void>;
  onOpenDocEdit: (doc: DocVaultItem) => void;
  onSaveDocEdit: () => void | Promise<void>;
  onDownloadAttachment: (docId: number) => void | Promise<void>;
  onUploadAttachment: (docId: number, file: File) => void | Promise<void>;
  onRemoveAttachment: (docId: number) => void | Promise<void>;
  onToggleUrgent: (doc: DocVaultItem) => void | Promise<void>;
  onDeleteDoc: (doc: DocVaultItem) => void | Promise<void>;
  onCreateFromPhoto: (file: File) => void | Promise<void>;
  onOpenDocEmailDraft: () => void;
}) {
  if (!open) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 46, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
  <button type="button" aria-label="Fermer" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }} />
  <div style={{ position: 'relative', width: '100%', maxHeight: '88%', background: C.white, borderRadius: '22px 22px 0 0', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 12px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0 }}>Coffre famille</h3>
          <p style={{ fontSize: 11, color: C.text2, margin: 0 }}>{docVault.length} documents</p>
          {token && docStorageSummary ? (
            <p style={{ fontSize: 10, color: C.text2, margin: '6px 0 0', lineHeight: 1.35 }}>
              {formatDocStorageShort(docStorageSummary.used_bytes, docStorageSummary.quota_bytes)}
            </p>
          ) : null}
          {!token ? <p style={{ fontSize: 10, color: C.terra, margin: '6px 0 0' }}>Connecte-toi pour synchroniser le coffre sur le serveur.</p> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', flexShrink: 0 }}>
          <button
            type="button"
            disabled={!token || loading}
            onClick={() => token && onRefresh()}
            style={{
              padding: '6px 12px',
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: C.white,
              fontSize: 11,
              fontWeight: 700,
              color: C.text2,
              opacity: !token ? 0.5 : 1,
            }}
          >
            Rafraîchir
          </button>
          <button
            type="button"
            disabled={!token}
            onClick={() => void onQuickAdd()}
            style={{ padding: '6px 12px', borderRadius: 12, background: C.terraXL, color: C.terra, border: 'none', fontSize: 11, fontWeight: 700, opacity: !token ? 0.5 : 1 }}
          >
            + Ajouter
          </button>
        </div>
      </div>
      {docVault.filter((d) => d.urgent).length > 0 ? (
        <div style={{ background: C.redL, borderRadius: 12, padding: '10px 12px', marginBottom: 8, fontSize: 12, color: C.red, fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <IconAlertOutline size={18} color={C.red} strokeWidth={1.65} />
            Documents à renouveler
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontWeight: 500, lineHeight: 1.5 }}>
            {docVault
              .filter((d) => d.urgent)
              .map((d) => (
                <li key={d.id}>
                  {d.name}
                  {d.exp ? ` — échéance ${d.exp}` : ''}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {docAddedFlash ? (
        <div style={{ background: C.greenL, borderRadius: 12, padding: '8px 10px', marginBottom: 8, fontSize: 12, color: C.green, fontWeight: 600 }}>Référence enregistrée — tu pourras ajouter une pièce jointe ensuite.</div>
      ) : null}
      <div style={{ background: C.surface, borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <IconSearch size={18} color={C.text3} strokeWidth={1.65} />
        <input value={docSearch} onChange={(e) => onDocSearchChange(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher dans le coffre" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13 }} />
      </div>
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4 }}>
        {DOC_CATEGORY_FILTER_IDS.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => onDocCatChange(c)}
            style={{
              flexShrink: 0,
              padding: '5px 10px',
              borderRadius: 20,
              border: `1.5px solid ${docCat === c ? C.terra : C.border}`,
              background: docCat === c ? C.terra : C.white,
              color: docCat === c ? '#fff' : C.text2,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px 24px' }}>
      {docVault
        .filter((d) => docMatchesCategoryFilter(docCat, d) && (docSearch === '' || d.name.toLowerCase().includes(docSearch.toLowerCase())))
        .map((d) => {
          const editing = docEdit?.id === d.id;
          const catSelectOptions = [...new Set([...DOC_COFFRE_CATEGORIES, docEdit?.category || 'Divers'])];
          return (
            <div
              key={d.id}
              style={{
                borderRadius: 14,
                border: `1.5px solid ${editing ? C.terra : d.urgent ? `${C.red}33` : C.border}`,
                marginBottom: 8,
                background: editing ? C.white : d.urgent ? C.redL : C.surface,
                overflow: 'hidden',
              }}
            >
              {editing && docEdit ? (
                <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.text }}>Modifier</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                      <InlineDocGlyph icon={docEdit.icon.trim() || 'g:doc'} size={26} color={C.terra} />
                    </span>
                    <input
                      value={docEdit.icon}
                      onChange={(e) => onDocEditChange((p) => (p ? { ...p, icon: e.target.value.slice(0, 16) } : null))}
                      placeholder="Code picto (ex. g:doc)"
                      maxLength={16}
                      aria-label="Icône du document"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                    />
                  </div>
                  <DocGlyphPicker value={docEdit.icon} onPick={(v) => onDocEditChange((p) => (p ? { ...p, icon: v } : null))} terra={C.terra} border={C.border} terraXL={C.terraXL} />
                  <input
                    value={docEdit.name}
                    onChange={(e) => onDocEditChange((p) => (p ? { ...p, name: e.target.value } : null))}
                    placeholder="Nom du document"
                    aria-label="Nom du document"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                  />
                  <select
                    value={docEdit.category}
                    onChange={(e) => onDocEditChange((p) => (p ? { ...p, category: e.target.value } : null))}
                    aria-label="Catégorie du document"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, background: C.white }}
                  >
                    {catSelectOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    value={docEdit.date_label}
                    onChange={(e) => onDocEditChange((p) => (p ? { ...p, date_label: e.target.value } : null))}
                    placeholder="Date (texte libre, ex. Jan. 2024)"
                    aria-label="Date du document (texte libre)"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                  />
                  <label style={{ fontSize: 10, color: C.text2 }}>
                    Échéance (optionnel)
                    <input
                      type="date"
                      value={docEdit.expires_date}
                      onChange={(e) => onDocEditChange((p) => (p ? { ...p, expires_date: e.target.value } : null))}
                      aria-label="Date d'échéance du document"
                      style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                    />
                  </label>
                  <input
                    value={docEdit.who}
                    onChange={(e) => onDocEditChange((p) => (p ? { ...p, who: e.target.value } : null))}
                    placeholder="Qui (vide = Famille)"
                    aria-label="Personne concernée par le document"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                  />
                  <textarea
                    value={docEdit.notes}
                    onChange={(e) => onDocEditChange((p) => (p ? { ...p, notes: e.target.value } : null))}
                    placeholder="Notes internes"
                    aria-label="Notes internes sur le document"
                    rows={3}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <input
                    ref={docAttachmentReplaceRef}
                    type="file"
                    accept="image/*,application/pdf"
                    aria-label="Pièce jointe du document"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f && docEdit && token) void onUploadAttachment(docEdit.id, f);
                    }}
                  />
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.text2 }}>Pièce jointe (serveur)</div>
                  {(() => {
                    const pj = docVault.find((x) => x.id === docEdit.id);
                    const has = pj?.attachmentSizeBytes != null && pj.attachmentSizeBytes > 0;
                    return has ? (
                      <div style={{ fontSize: 11, color: C.text, padding: '10px 12px', borderRadius: 12, background: C.surface2, border: `1px solid ${C.border}` }}>
                        <div style={{ fontWeight: 700 }}>{pj?.attachmentOriginalName || 'Fichier'}</div>
                        <div style={{ fontSize: 10, color: C.text2 }}>{Math.max(1, Math.round((pj?.attachmentSizeBytes || 0) / 1024))} Ko</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            disabled={!token}
                            onClick={() => void onDownloadAttachment(docEdit.id)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 10,
                              border: `1px solid ${C.sage}`,
                              background: C.sageL,
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.sage,
                            }}
                          >
                            Télécharger
                          </button>
                          <button
                            type="button"
                            disabled={!token}
                            onClick={() => docAttachmentReplaceRef.current?.click()}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 10,
                              border: `1px solid ${C.border}`,
                              background: C.white,
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.text2,
                            }}
                          >
                            Remplacer
                          </button>
                          <button
                            type="button"
                            disabled={!token}
                            onClick={() => void onRemoveAttachment(docEdit.id)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 10,
                              border: 'none',
                              background: C.redL,
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.red,
                            }}
                          >
                            Supprimer PJ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!token}
                        onClick={() => docAttachmentReplaceRef.current?.click()}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: `1px dashed ${C.border}`,
                          background: C.white,
                          fontSize: 12,
                          fontWeight: 700,
                          color: C.text2,
                          textAlign: 'center',
                        }}
                      >
                        + Ajouter fichier (image ou PDF)
                      </button>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      disabled={docEditSaving}
                      onClick={() => onDocEditChange(() => null)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.text2,
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={!token || docEditSaving}
                      onClick={() => void onSaveDocEdit()}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: 'none',
                        background: C.terra,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#fff',
                      }}
                    >
                      {docEditSaving ? '…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.terraXL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <InlineDocGlyph icon={d.icon} size={22} color={C.terra} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>
                      {d.who} · {d.date}
                      {d.exp ? ` → exp. ${d.exp}` : ''}
                    </div>
                    {d.notes?.trim() ? <div style={{ fontSize: 10, color: C.text3, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.notes.trim()}</div> : null}
                    {d.attachmentSizeBytes ? (
                      <button
                        type="button"
                        disabled={!token}
                        onClick={() => void onDownloadAttachment(d.id)}
                        style={{
                          marginTop: 6,
                          padding: '5px 10px',
                          borderRadius: 10,
                          border: `1px solid ${C.sage}`,
                          background: C.sageL,
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.sage,
                          cursor: token ? 'pointer' : 'default',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <IconPaperclip size={13} color={C.sage} strokeWidth={1.75} />
                          Fichier ({Math.max(1, Math.round(d.attachmentSizeBytes / 1024))} Ko)
                        </span>
                      </button>
                    ) : null}
                  </div>
                  {d.urgent ? (
                    <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-label="Urgent">
                      <IconAlertOutline size={18} color={C.red} strokeWidth={1.65} />
                    </span>
                  ) : null}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={!token}
                      onClick={() => onOpenDocEdit(d)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: `1px solid ${C.terra}`,
                        background: C.terraXL,
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.terra,
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      disabled={!token}
                      onClick={() => void onToggleUrgent(d)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.text2,
                      }}
                    >
                      {d.urgent ? 'Pas urgent' : 'Urgent'}
                    </button>
                    <button
                      type="button"
                      disabled={!token}
                      onClick={() => void onDeleteDoc(d)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: 'none',
                        background: C.redL,
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.red,
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text2, marginBottom: 6 }}>AJOUTER DEPUIS</div>
        <input
          ref={docPhotoInputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          aria-label="Importer un document depuis la caméra ou les fichiers"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onCreateFromPhoto(f);
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={!token}
            onClick={() => {
              if (!token) return;
              docPhotoInputRef.current?.click();
            }}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 12,
              border: `1.5px solid ${C.border}`,
              background: C.white,
              fontSize: 11,
              fontWeight: 600,
              color: token ? C.text : C.text3,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <IconCamera size={14} color={C.text} strokeWidth={1.65} />
              Photo
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenDocEmailDraft}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 12,
              border: `1.5px solid ${C.border}`,
              background: C.white,
              fontSize: 11,
              fontWeight: 600,
              color: C.text2,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <IconMail size={14} color={C.text2} strokeWidth={1.65} />
              Email
            </span>
          </button>
        </div>
        <p style={{ fontSize: 9, color: C.text3, margin: '8px 0 0', lineHeight: 1.35 }}>
          Image ou PDF : la fiche est créée puis le fichier est enregistré sur le serveur (stockage isolé par foyer, volume Docker majordome_uploads). La taille max est définie côté API (MAJORDOME_ATTACHMENT_MAX_MB).
        </p>
      </div>
    </div>
  </div>
  </div>
  );
}
