'use client';

export function OverlayChrome({
  title,
  onBack,
  children,
  white,
  border,
  text,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
  white: string;
  border: string;
  text: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderBottom: `1px solid ${border}`,
          background: white,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          style={{
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: '8px 12px',
            background: white,
            fontSize: 13,
            fontWeight: 700,
            color: text,
            cursor: 'pointer',
          }}
        >
          ← Retour
        </button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: text, flex: 1 }}>{title}</h2>
      </header>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>{children}</div>
    </div>
  );
}
