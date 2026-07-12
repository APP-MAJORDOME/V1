'use client';

/** Indique que les pièces jointes du coffre sont chiffrées au repos sur le serveur. */
export function VaultEncryptionBadge({
  C,
  encryptionAtRest,
  style,
}: {
  C: Record<string, string>;
  encryptionAtRest?: boolean;
  style?: React.CSSProperties;
}) {
  if (!encryptionAtRest) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        color: C.green,
        background: C.greenL,
        border: `1px solid ${C.green}33`,
        borderRadius: 12,
        padding: '4px 10px',
        ...style,
      }}
    >
      Coffre chiffré et sécurisé
    </span>
  );
}
