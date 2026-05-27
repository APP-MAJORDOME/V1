'use client';

/** Pictogramme nœud papillon (asset officiel). */
export function MajordomeMark({
  size = 72,
  className,
  animated = false,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  return (
    <img
      src="/majordome-mark.png"
      alt=""
      aria-hidden
      className={animated ? `majordome-loader-mark ${className ?? ''}`.trim() : className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );
}

/** Wordmark horizontal MAJORDOME (asset officiel). */
export function MajordomeWordmark({
  maxHeight = 28,
  className,
}: {
  maxHeight?: number;
  className?: string;
}) {
  return (
    <img
      src="/majordome-wordmark.png"
      alt="MAJORDOME"
      className={className}
      style={{
        height: maxHeight,
        width: 'auto',
        maxWidth: 'min(300px, 85vw)',
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );
}

/** Loader plein écran ou inline. */
export function AppLoader({
  label = 'Chargement…',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className="app-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 10 : 16,
        padding: compact ? 12 : 24,
        minHeight: compact ? undefined : 200,
      }}
    >
      <MajordomeMark size={compact ? 48 : 72} animated />
      {label ? (
        <p
          style={{
            margin: 0,
            fontSize: compact ? 12 : 14,
            fontWeight: 600,
            color: 'var(--color-text-sub, #7a6a5a)',
          }}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
