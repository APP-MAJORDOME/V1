'use client';

import { useMemo, useState } from 'react';
import { IconCalendar } from './md-icons';
import { useIsClient } from '../hooks/useIsClient';
import {
  addDays,
  formatTimeFr,
  formatWeekRangeLabel,
  frDayShort,
  groupEntriesByLocalDate,
  localIsoDate,
  mergeCalendarEntries,
  mondayOfWeek,
  parseLocalIsoDate,
  providerVisual,
  type CalendarEntry,
  weekDatesFromMonday,
} from '../lib/calendarVisual';

export type VisualFamilyCalendarProps = {
  C: Record<string, string>;
  events: Array<{ id: number; title: string; starts_at: string; ends_at?: string | null; source_provider?: string | null }>;
  tasks: Array<{ id: number; title: string; due_at?: string | null }>;
  selectedDay: string;
  onSelectedDayChange: (isoDate: string) => void;
  googleConnected: boolean;
  microsoftConnected: boolean;
  appleConnected: boolean;
  conflictCount: number;
  onOpenIntegrations: () => void;
  onSyncCalendars: () => void;
  calendarSyncBusy: boolean;
  onSelectEvent?: (eventId: number) => void;
  onSelectTask?: (taskId: number) => void;
};

export function VisualFamilyCalendar({
  C,
  events,
  tasks,
  selectedDay,
  onSelectedDayChange,
  googleConnected,
  microsoftConnected,
  appleConnected,
  conflictCount,
  onOpenIntegrations,
  onSyncCalendars,
  calendarSyncBusy,
  onSelectEvent,
  onSelectTask,
}: VisualFamilyCalendarProps) {
  const client = useIsClient();
  const todayIso = client ? localIsoDate(new Date()) : selectedDay || '';
  const initialMonday = mondayOfWeek(selectedDay ? parseLocalIsoDate(selectedDay) : new Date());
  const [weekMonday, setWeekMonday] = useState(initialMonday);

  const entries = useMemo(() => mergeCalendarEntries(events, tasks), [events, tasks]);
  const byDate = useMemo(() => groupEntriesByLocalDate(entries), [entries]);
  const weekDays = useMemo(() => weekDatesFromMonday(weekMonday), [weekMonday]);

  const selectedEntries = useMemo(() => {
    const day = selectedDay || todayIso;
    return (byDate.get(day) ?? []).slice().sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [byDate, selectedDay, todayIso]);

  const anyConnected = googleConnected || microsoftConnected || appleConnected;

  function shiftWeek(delta: number) {
    setWeekMonday((m) => addDays(m, delta * 7));
  }

  function handleEntryClick(entry: CalendarEntry) {
    if (entry.kind === 'event') onSelectEvent?.(entry.numericId);
    else onSelectTask?.(entry.numericId);
  }

  return (
    <div
      style={{
        borderRadius: 20,
        border: `1.5px solid ${C.border}`,
        background: C.white,
        padding: 14,
        marginBottom: 12,
        boxShadow: '0 4px 20px rgba(44,31,26,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCalendar size={22} color={C.terra} strokeWidth={1.65} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Vue semaine</div>
            <div style={{ fontSize: 11, color: C.text2 }} suppressHydrationWarning>
              {formatWeekRangeLabel(weekMonday, client)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => shiftWeek(-1)} aria-label="Semaine précédente" style={navBtn(C)}>
            ←
          </button>
          <button
            type="button"
            onClick={() => {
              const m = mondayOfWeek(new Date());
              setWeekMonday(m);
              onSelectedDayChange(localIsoDate(new Date()));
            }}
            style={{ ...navBtn(C), fontSize: 11, fontWeight: 700, padding: '6px 10px' }}
          >
            Auj.
          </button>
          <button type="button" onClick={() => shiftWeek(1)} aria-label="Semaine suivante" style={navBtn(C)}>
            →
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
        {weekDays.map((d) => {
          const iso = localIsoDate(d);
          const dayEntries = byDate.get(iso) ?? [];
          const isToday = iso === todayIso;
          const isSelected = iso === (selectedDay || todayIso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectedDayChange(iso)}
              style={{
                border: isSelected ? `2px solid ${C.terra}` : `1.5px solid ${isToday ? C.alex + '88' : C.border}`,
                borderRadius: 14,
                padding: '8px 4px',
                background: isSelected ? C.terraXL : isToday ? C.alexXL : C.surface,
                cursor: 'pointer',
                minHeight: 72,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: C.text2, textTransform: 'uppercase' }} suppressHydrationWarning>
                {frDayShort(d)}
              </span>
              <span style={{ fontSize: 17, fontWeight: 800, color: isSelected ? C.terra : C.text }} suppressHydrationWarning>
                {d.getDate()}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', minHeight: 14 }}>
                {dayEntries.slice(0, 4).map((e) => {
                  const vis = providerVisual(e.sourceProvider, e.kind);
                  return (
                    <span
                      key={e.id}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: vis.color,
                      }}
                    />
                  );
                })}
                {dayEntries.length > 4 ? (
                  <span style={{ fontSize: 8, fontWeight: 800, color: C.text2 }}>+{dayEntries.length - 4}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        {microsoftConnected ? <SourceChip label="Outlook" bg={C.lilacL} color={C.lilac} /> : null}
        {googleConnected ? <SourceChip label="Google" bg={C.terraXL} color={C.terra} /> : null}
        {appleConnected ? <SourceChip label="Apple" bg={C.sageL} color={C.sage} /> : null}
        <SourceChip label="MajorDome" bg={C.alexXL} color={C.alex} />
        <SourceChip label="Tâches" bg="#FFF8E8" color="#B8860B" />
        {!anyConnected ? (
          <button
            type="button"
            onClick={onOpenIntegrations}
            style={{
              marginLeft: 'auto',
              border: 'none',
              background: 'transparent',
              color: C.terra,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            + Gmail / Outlook
          </button>
        ) : (
          <button
            type="button"
            disabled={calendarSyncBusy}
            onClick={onSyncCalendars}
            style={{
              marginLeft: 'auto',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '4px 10px',
              background: C.white,
              fontSize: 10,
              fontWeight: 700,
              color: C.alex,
              cursor: calendarSyncBusy ? 'wait' : 'pointer',
            }}
          >
            {calendarSyncBusy ? 'Sync…' : '↻ Sync'}
          </button>
        )}
      </div>

      {conflictCount > 0 ? (
        <div style={{ fontSize: 11, color: C.red, background: C.redL, borderRadius: 10, padding: '8px 10px', marginBottom: 10 }}>
          {conflictCount} chevauchement(s) détecté(s) cette semaine — vérifie les créneaux.
        </div>
      ) : null}

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
        {selectedDay || todayIso ? (
          <span suppressHydrationWarning>
            {parseLocalIsoDate(selectedDay || todayIso).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
        ) : (
          'Journée'
        )}
      </div>

      {selectedEntries.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            border: `1.5px dashed ${C.border}`,
            textAlign: 'center',
            color: C.text2,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Rien de planifié ce jour.
          {!anyConnected ? (
            <>
              <br />
              Connecte Google ou Outlook pour importer tes rendez-vous.
            </>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {selectedEntries.map((entry) => {
            const vis = providerVisual(entry.sourceProvider, entry.kind);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleEntryClick(entry)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '52px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  textAlign: 'left',
                  border: `1.5px solid ${vis.border}`,
                  borderLeft: `4px solid ${vis.color}`,
                  borderRadius: 14,
                  padding: '10px 12px',
                  background: vis.bg,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: vis.color }} suppressHydrationWarning>
                  {formatTimeFr(entry.startsAt, client)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.35 }}>{entry.title}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: vis.color, background: C.white, borderRadius: 8, padding: '3px 6px' }}>
                  {vis.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function navBtn(C: Record<string, string>): React.CSSProperties {
  return {
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '6px 12px',
    background: C.white,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
  };
}

function SourceChip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 10, background: bg, color }}>
      {label}
    </span>
  );
}
