'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconCamera } from './md-icons';

const LS_KEY = 'majordome.v1.albums';

export type AlbumRow = { id: string; title: string; cover: string; count: number; date: string };

const DEFAULT_ALBUMS: AlbumRow[] = [
  { id: 'a1', title: 'Vacances été', cover: '🏖️', count: 42, date: '2025-08-01' },
  { id: 'a2', title: 'École & sport', cover: '🎒', count: 28, date: '2026-01-10' },
  { id: 'a3', title: 'Anniversaires', cover: '🎂', count: 15, date: '2025-11-20' },
];

function loadAlbums(): AlbumRow[] {
  if (typeof window === 'undefined') return DEFAULT_ALBUMS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_ALBUMS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ALBUMS;
    return parsed.filter((x): x is AlbumRow => x && typeof x === 'object' && typeof (x as AlbumRow).title === 'string');
  } catch {
    return DEFAULT_ALBUMS;
  }
}

export function AlbumsPanel({ C }: { C: Record<string, string> }) {
  const [albums, setAlbums] = useState<AlbumRow[]>(DEFAULT_ALBUMS);

  useEffect(() => {
    setAlbums(loadAlbums());
  }, []);

  const persist = useCallback((next: AlbumRow[]) => {
    setAlbums(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  function addAlbum() {
    const title = window.prompt('Nom de l’album ?');
    if (!title?.trim()) return;
    persist([
      ...albums,
      {
        id: `a-${Date.now()}`,
        title: title.trim(),
        cover: '📷',
        count: 0,
        date: new Date().toISOString().slice(0, 10),
      },
    ]);
  }

  const gradients = [
    [C.terraXL, C.blush],
    [C.lilacL, C.terraXL],
    [C.sageL, C.alexL],
    [C.alexXL, C.lilacL],
  ];

  return (
    <div style={{ padding: '14px 18px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCamera size={26} color={C.lilac} strokeWidth={1.65} />
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.5 }}>SOUVENIRS</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
              Albums locaux — upload cloud / partage à brancher ensuite.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addAlbum}
          style={{
            flexShrink: 0,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            padding: '8px 12px',
            background: C.white,
            fontSize: 11,
            fontWeight: 800,
            color: C.text,
            cursor: 'pointer',
          }}
        >
          + Album
        </button>
      </div>

      <div style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 16, border: `1.5px solid ${C.border}` }}>
        <div
          style={{
            height: 160,
            background: `linear-gradient(135deg, ${C.lilacL}, ${C.terraXL})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 56,
          }}
        >
          🦊
        </div>
        <div style={{ padding: 12, background: C.white }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>À la une</div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>Exemple — tes vrais médias iront ici.</div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, marginBottom: 8 }}>ALBUMS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {albums.map((a, i) => {
          const [g0, g1] = gradients[i % gradients.length];
          return (
            <div key={a.id} style={{ borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', background: C.white }}>
              <div
                style={{
                  height: 100,
                  background: `linear-gradient(135deg, ${g0}, ${g1})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                }}
              >
                {a.cover}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{a.title}</div>
                <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>
                  {a.count} médias ·{' '}
                  {new Date(a.date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
