'use client';

import { useEffect } from 'react';

export type AppMainTab = 'home' | 'salon' | 'alfred' | 'modules' | 'moi' | 'agenda';

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

const OVERLAY_TITLES: Record<AppOverlayId, string> = {
  courses: 'Courses & Frigo',
  documents: 'Coffre famille',
  assistant: 'Alfred',
  plus: 'Modules du foyer',
  routines: 'Routines',
  recettes: 'Recettes',
  courrier: 'Courrier IA',
  famille: 'Famille & équité',
  integrations: 'Intégrations',
  maison: 'Maison',
  anniversaires: 'Anniversaires',
  poubelles: 'Poubelles',
  notifs: 'Notifications',
  messages: 'Salon',
  albums: 'Souvenirs',
};

const TAB_TITLES: Record<AppMainTab, string> = {
  home: "Aujourd'hui",
  salon: 'Salon',
  alfred: 'Alfred',
  modules: 'Modules du foyer',
  moi: 'Foyer',
  agenda: 'Agenda',
};

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
    let title: string;
    if (opts.overlay) {
      title = opts.overlay === 'assistant' ? opts.aiName : OVERLAY_TITLES[opts.overlay];
    } else {
      title = opts.mainTab === 'alfred' ? opts.aiName : TAB_TITLES[opts.mainTab];
    }
    document.title = `${title} — MajorDome`;
  }, [opts.clientReady, opts.token, opts.overlay, opts.mainTab, opts.aiName]);
}
