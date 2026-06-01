'use client';

export function GlassCard({
  C,
  children,
  style = {},
  onClick,
}: {
  C: Record<string, string>;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, ...style }}
    >
      {children}
    </div>
  );
}
