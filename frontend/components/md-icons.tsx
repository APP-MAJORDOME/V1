'use client';

import type { CSSProperties, ComponentType, ReactNode } from 'react';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  title?: string;
};

function Svg({
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.5,
  style,
  title,
  children,
  viewBox,
}: IconProps & { children: ReactNode; viewBox: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

/** Marque : deux flèches courbes entrelacées (picto seul, sans mot). */
export function LogoMarkArrows({ size = 28, color = '#D96B52', strokeWidth = 1.35 }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 40 40">
      <path d="M8 22c0-6 5-11 11-11h6M33 18l-4-4m4 4l-4 4" />
      <path d="M32 18c0 6-5 11-11 11h-6M7 22l4 4m-4-4l4-4" />
    </Svg>
  );
}

export function IconHome({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </Svg>
  );
}

/** Grille 2×2 (entrée « Plus » / hub modules). */
export function IconDotsGrid({ size = 22, color = 'currentColor', style }: IconProps) {
  const fill = color;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden
    >
      <circle cx="8" cy="8" r="2.25" fill={fill} />
      <circle cx="16" cy="8" r="2.25" fill={fill} />
      <circle cx="8" cy="16" r="2.25" fill={fill} />
      <circle cx="16" cy="16" r="2.25" fill={fill} />
    </svg>
  );
}

export function IconCalendar({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function IconCart({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M6 6h15l-1.5 9H7.5L6 6zm0 0L5 3H3" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
    </Svg>
  );
}

/** Maison + entretien (routines, jardin). */
export function IconHouseCare({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 11 12 5l8 6v10h-5v-5a2 2 0 0 0-4 0v5H4V11z" />
      <path d="M12 11v3M10 13h4" />
    </Svg>
  );
}

/** Domotique : foyer connecté, équipements, scènes. */
export function IconSmartHome({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M3 11 12 4l9 7v10h-5v-5a2.5 2.5 0 0 0-5 0v5H3V11z" />
      <path d="M17 7h6v7h-6V7zM18 11h4M18 9v5" opacity={0.95} />
    </Svg>
  );
}

export function IconLeaf({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 21c-4.5-4-8-8.5-8-14a8 8 0 0 1 14 4c0 5.5-3.5 10-6 10z" />
      <path d="M12 21V11" />
    </Svg>
  );
}

export function IconFolderVault({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
      <path d="M8 13h8M8 17h5" opacity={0.85} />
    </Svg>
  );
}

export function IconUserHeart({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
      <path d="M16.5 6.5l-.9 1M18 8l-1 .5M17 5l.5 1.5" strokeWidth={1.25} />
    </Svg>
  );
}

export function IconSparkleAI({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="m6 6 2.2 2.2M15.8 15.8 18 18M18 6l-2.2 2.2M8.2 15.8 6 18" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

export function IconPaperclip({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M8.5 7.5 15 14a3 3 0 0 1-4.24 4.24L6 13.5a5 5 0 0 1 7.07-7.07l5.66 5.66a7 7 0 1 1-9.9 9.9L4 15" />
    </Svg>
  );
}

export function IconSearch({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M16 16l5 5" />
    </Svg>
  );
}

export function IconAlertOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 8v5M12 17h.01" />
      <path d="M10.3 4.5h3.4l7.8 13.5a1 1 0 0 1-.86 1.5H3.36a1 1 0 0 1-.86-1.5L10.3 4.5z" />
    </Svg>
  );
}

export function IconRefresh({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 9a8 8 0 0 1 14.5-3M20 15a8 8 0 0 1-14.5 3" />
      <path d="M18.5 3v5h-5M5.5 21v-5h5" />
    </Svg>
  );
}

export function IconCheckSmall({ size = 14, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M5 13l4 4L19 7" />
    </Svg>
  );
}

export function IconCircleOutline({ size = 14, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
    </Svg>
  );
}

export function IconScale({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 3v18M5 8l7-5 7 5M7 14h10" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </Svg>
  );
}

export function IconBellRing({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7M10 20h4" />
    </Svg>
  );
}

export function IconUserOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <circle cx="12" cy="9" r="3.5" />
      <path d="M6 20a6 6 0 0 1 12 0" />
    </Svg>
  );
}

export function IconSparkleSmall({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 3v2M12 19v2M19 12h2M3 12h2M16.2 7.8l1.4-1.4M6.4 17.8l1.4-1.4M7.8 7.8 6.4 6.4M17.8 17.8l-1.4-1.4" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  );
}

export function IconWallet({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M17 12h3v4h-3a2 2 0 1 1 0-4z" />
    </Svg>
  );
}

export function IconCoupon({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 8h16v3a2 2 0 1 0 0 4v3H4V8z" />
      <path d="M10 12h4" />
    </Svg>
  );
}

export function IconMoon({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M18 14a7 7 0 1 1-8-10 7 7 0 0 0 8 10z" />
    </Svg>
  );
}

export function IconPenLine({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </Svg>
  );
}

export function IconChart({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 19h17M7 16v-5M12 16V8M17 16v-9" />
    </Svg>
  );
}

export function IconLink({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
    </Svg>
  );
}

export function IconMeal({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M6 3v9a4 4 0 0 0 4 4h1M6 3h5M11 3v14a3 3 0 0 0 6 0V11" />
      <path d="M18 11V3M18 11v10" />
    </Svg>
  );
}

export function IconBrainOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M11 4a3 3 0 0 0-3 3 3 3 0 0 0-3 3v1a3 3 0 0 0 2 2.83V17a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3v-3.17A3 3 0 0 0 19 11v-1a3 3 0 0 0-3-3 3 3 0 0 0-3-3h-2z" />
      <path d="M9 14h6M10 10h4" opacity={0.75} />
    </Svg>
  );
}

export function IconGift({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 8v13M4 12v8h16v-8M4 12h16M8 8h8a4 4 0 1 0 0-4h1a3 3 0 0 1 0 6H8a3 3 0 1 1 0-6h1a4 4 0 1 0 0 4z" />
    </Svg>
  );
}

export function IconChild({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="3" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M12 11v3" />
    </Svg>
  );
}

export function IconMic({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 19v3" />
    </Svg>
  );
}

export function IconSpeaker({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M5 10v4h3l4 3V7l-4 3H5zM16 9a4 4 0 0 1 0 6M18 7a7 7 0 0 1 0 10" />
    </Svg>
  );
}

export function IconCamera({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 8h4l2-2h4l2 2h4v11H4V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function IconMail({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </Svg>
  );
}

/** Bulle message (hub Messagerie famille). */
export function IconMessageBubble({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M8 10h8M8 13h5" />
    </Svg>
  );
}

export function IconTrash({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V5h6v2" />
    </Svg>
  );
}

export function IconWrench({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M14.7 6.3a6 6 0 0 1 .7 7.7l-7 7-4-4 7-7a6 6 0 0 1 7.3-.7l-3 3M11 13l2 2" />
    </Svg>
  );
}

export function IconSchoolBag({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 9h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z" />
      <path d="M12 13v3" />
    </Svg>
  );
}

export function IconBoltSoft({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6z" />
    </Svg>
  );
}

export function IconPartyOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 20 14 10l4 4L8 24H4v-4zM14 10l3-7 7 3-3 7" />
      <path d="M7 9v.01M17 4v.01M21 14v.01" strokeWidth={1.25} />
    </Svg>
  );
}

export function IconTarget({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </Svg>
  );
}

export function IconFlowerOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <circle cx="12" cy="11" r="2.5" />
      <path d="M12 8V6M12 16v2M8 11H6M18 11h-2M9.2 8.2 7.8 6.8M16.2 15.2l-1.4-1.4M9.2 13.8l-1.4 1.4M14.8 8.2l1.4-1.4" />
      <path d="M12 18v3M10 21h4" />
    </Svg>
  );
}

export function IconPeopleOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M4 19a5 5 0 0 1 9.5-2M14 19a4 4 0 0 1 6-3.5" />
    </Svg>
  );
}

export function IconHeartOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 21s-7-4.8-7-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6.2-7 11-7 11z" />
    </Svg>
  );
}

export function IconLifebuoy({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </Svg>
  );
}

export function IconKitchen({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M8 3v5M16 3v5M5 8h14v13H5V8zM10 14h4" />
    </Svg>
  );
}

export function IconShirt({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M9 3h6l2 3h4l-3 5v11H6V11L3 6h4l2-3zM12 3v4" />
    </Svg>
  );
}

export function IconHealthCross({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <rect x="5" y="5" width="14" height="14" rx="2.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Svg>
  );
}

export function IconCarOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 15 6 9h12l2 6v3H4v-3zM7 18h10" />
      <circle cx="8" cy="18" r="1.5" />
      <circle cx="16" cy="18" r="1.5" />
    </Svg>
  );
}

export function IconShieldOutline({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 21s8-4 8-10V6l-8-3-8 3v5c0 6 8 10 8 10z" />
    </Svg>
  );
}

export function IconBuilding({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M6 21V8l6-3 6 3v13M6 21h12M9 21v-5h2v5M13 21v-5h2v5M10 12h1M13 12h1M10 15h1M13 15h1" />
    </Svg>
  );
}

export function IconDocFile({ size, color, strokeWidth }: IconProps) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M14 3H7v18h10V7l-3-4z" />
      <path d="M14 3v4h4M9 13h6M9 17h4" />
    </Svg>
  );
}

export const DOC_GLYPH_PICKER_ORDER = [
  'g:doc',
  'g:clip',
  'g:health',
  'g:school',
  'g:id',
  'g:money',
  'g:home',
  'g:list',
  'g:pill',
  'g:shield',
  'g:car',
  'g:idcard',
] as const;

const DOC_GLYPHS: Record<string, ComponentType<IconProps>> = {
  'g:doc': IconDocFile,
  'g:clip': IconPaperclip,
  'g:health': IconHealthCross,
  'g:school': IconBuilding,
  'g:id': IconUserOutline,
  'g:money': IconWallet,
  'g:home': IconHome,
  'g:list': IconChart,
  'g:pill': IconLifebuoy,
  'g:shield': IconShieldOutline,
  'g:car': IconCarOutline,
  'g:idcard': IconDocFile,
  'g:bin': IconTrash,
  'g:shop': IconCart,
  'g:bag': IconSchoolBag,
  'g:wrench': IconWrench,
  'g:meal': IconMeal,
};

export function DocGlyphBubble({
  icon,
  size = 22,
  color = '#D96B52',
  bg = '#FDEAE5',
}: {
  icon: string;
  size?: number;
  color?: string;
  bg?: string;
}) {
  const G = DOC_GLYPHS[icon.trim()];
  if (G) {
    return (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <G size={size} color={color} strokeWidth={1.6} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}
    >
      {icon.trim() || '·'}
    </div>
  );
}

export function DocGlyphPicker({
  value,
  onPick,
  terra,
  border,
  terraXL,
}: {
  value: string;
  onPick: (v: string) => void;
  terra: string;
  border: string;
  terraXL: string;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {DOC_GLYPH_PICKER_ORDER.map((k) => {
        const G = DOC_GLYPHS[k];
        const on = value.trim() === k;
        return (
          <button
            key={k}
            type="button"
            title={k.replace('g:', '')}
            onClick={() => onPick(k)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1.5px solid ${on ? terra : border}`,
              background: on ? terraXL : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <G size={18} color={on ? terra : '#9A8882'} strokeWidth={1.6} />
          </button>
        );
      })}
    </div>
  );
}

/** Normalise une catégorie API (ex. "🏥 Santé" → "Santé") pour filtres / puces. */
export function docCategoryLabel(raw: string): string {
  const s = raw.replace(/^[\s\p{Extended_Pictographic}\uFE0F]+/u, '').trim();
  return s || raw;
}

export const DOC_CATEGORY_FILTER_IDS = ['Tous', 'Santé', 'École', 'Admin', 'Finance', 'Maison', 'Identité', 'Divers'] as const;

export function docMatchesCategoryFilter(docCat: string, d: { cat: string }): boolean {
  if (docCat === 'Tous') return true;
  const norm = docCategoryLabel(d.cat);
  if (docCat === 'Divers') return norm === 'Divers' || norm === '';
  return norm === docCat;
}

/** Glyphe compact pour listes (tâches Alex, etc.). */
export function InlineDocGlyph({ icon, size = 18, color = '#6BA898' }: { icon: string; size?: number; color?: string }) {
  const G = DOC_GLYPHS[icon.trim()];
  if (G) return <G size={size} color={color} strokeWidth={1.65} />;
  return <span style={{ fontSize: size * 0.95, lineHeight: 1 }}>{icon}</span>;
}

const EQUITY_ICON: Record<string, ComponentType<IconProps>> = {
  kitchen: IconKitchen,
  shirt: IconShirt,
  school: IconSchoolBag,
  cart: IconCart,
  clean: IconHouseCare,
  admin: IconDocFile,
  health: IconHealthCross,
};

export function EquityGlyphIcon({ glyph, size = 14, color = '#2C1F1A' }: { glyph: string; size?: number; color?: string }) {
  const I = EQUITY_ICON[glyph];
  return I ? <I size={size} color={color} strokeWidth={1.5} /> : null;
}
