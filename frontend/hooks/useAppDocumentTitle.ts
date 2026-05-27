'use client';

import { useEffect } from 'react';

export type AppMainTab = 'home' | 'alfred' | 'modules' | 'moi' | 'agenda';

export type AppOverlayId =
  | 'plus'
  | 'courses'
  | 'maison'
  | 'documents'
  | 'assistant'
  | 'famille'
  | 'anniversaires'
  | 'poubelles'
  | 'notifs'
  | 'messages'
  | 'recettes'
  | 'routines'
  | 'courrier'
  | 'albums'
  | 'integrations';

export function useAppDocumentTitle(opts: {
  clientReady: boolean;
  token: string;
  overlay: AppOverlayId | null;
  mainTab: AppMainTab;
  aiName: string;
}) {
  useEffect(() => {
    if (!opts.clientReady) return;
    if (!opts.token) {
      document.title = 'Connexion — MajorDome';
      return;
    }
    const overlayTitles: Partial<Record<AppOverlayId, string>> = {
      courses: 'Courses & Frigo',
      documents: 'Coffre famille',
      assistant: opts.aiName,
      plus: 'Modules',
      routines: 'Routines',
      recettes: 'Recettes',
      courrier: 'Courrier IA',
      famille: 'Famille & équité',
      integrations: 'Intégrations',
    };
    const tabTitles: Record<AppMainTab, string> = {
      home: "Aujourd'hui",
      alfred: opts.aiName,
      modules: 'Modules',
      moi: 'Moi',
      agenda: 'Agenda',
    };
    const title = opts.overlay
      ? overlayTitles[opts.overlay] ?? 'MajorDome'
      : tabTitles[opts.mainTab] ?? 'MajorDome';
    document.title = `${title} — MajorDome`;
  }, [opts.clientReady, opts.token, opts.overlay, opts.mainTab, opts.aiName]);
}
