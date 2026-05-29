'use client';

import { useEffect, useState } from 'react';

export type ClientCalendar = {
  ready: boolean;
  todayIso: string;
  dayOfWeekIndex: number;
  hour: number;
  todayLabel: string;
};

const EMPTY: ClientCalendar = {
  ready: false,
  todayIso: '',
  dayOfWeekIndex: 0,
  hour: 12,
  todayLabel: '',
};

export function useClientCalendar(): ClientCalendar {
  const [cal, setCal] = useState<ClientCalendar>(EMPTY);

  useEffect(() => {
    const d = new Date();
    setCal({
      ready: true,
      todayIso: d.toISOString().slice(0, 10),
      dayOfWeekIndex: d.getDay(),
      hour: d.getHours(),
      todayLabel: d.toLocaleDateString('fr-FR'),
    });
  }, []);

  return cal;
}
