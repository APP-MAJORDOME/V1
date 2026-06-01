'use client';

/** Logo officiel — fichier dans /public (URL stable, pas de hash webpack). */
export const HORIZONTAL_LOGO_SRC = '/majordome-logo-horizontal.png';
/** Ratio largeur / hauteur (1400×347). */
export const HORIZONTAL_LOGO_ASPECT = 1400 / 347;

type LogoProps = {
  maxHeight?: number;
  className?: string;
};

function HorizontalLogoImg({ maxHeight = 40, className }: LogoProps) {
  const width = Math.round(maxHeight * HORIZONTAL_LOGO_ASPECT);
  return (
    <img
      src={HORIZONTAL_LOGO_SRC}
      alt="MAJORDOME"
      width={width}
      height={maxHeight}
      className={className}
      decoding="async"
      style={{
        height: maxHeight,
        width: 'auto',
        minWidth: Math.min(width, 160),
        maxWidth: '100%',
        objectFit: 'contain',
        objectPosition: 'left center',
        display: 'block',
        background: 'transparent',
      }}
    />
  );
}

/** Logo horizontal — accueil, connexion, onboarding, chargement. */
export function MajordomeHomeLogo({ maxHeight = 40 }: LogoProps) {
  return (
    <div className="home-brand-mark-wrap">
      <HorizontalLogoImg maxHeight={maxHeight} className="home-brand-mark" />
    </div>
  );
}

/** Alias (même fichier). */
export function MajordomeWordmark(props: LogoProps & { animated?: boolean }) {
  return <HorizontalLogoImg maxHeight={props.maxHeight ?? 40} className={props.className} />;
}

/** Chargement (refresh, session). */
export function BrandLoadingLogo({
  maxHeight = 44,
  compact = false,
}: {
  maxHeight?: number;
  compact?: boolean;
}) {
  const h = compact ? Math.min(maxHeight, 38) : maxHeight;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chargement"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? 12 : 24,
      }}
    >
      <MajordomeHomeLogo maxHeight={h} />
    </div>
  );
}

/** Loader plein écran. */
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
      <BrandLoadingLogo maxHeight={compact ? 40 : 48} compact={compact} />
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
