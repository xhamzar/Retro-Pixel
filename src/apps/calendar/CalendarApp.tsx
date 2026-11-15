'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, CalendarEventRecord } from '@/src/types/os';

export const CalendarApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [viewDate, setViewDate] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [timeInput, setTimeInput] = useState('09:00');
  const [descInput, setDescInput] = useState('');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const selectedKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const todayKey = new Date().toISOString().slice(0, 10);

  const loadEvents = async () => {
    const all = await db.events.toArray();
    setEvents(all);
  };

  useEffect(() => {
    let active = true;
    db.events.toArray().then((all) => {
      if (active) setEvents(all);
    });
    return () => {
      active = false;
    };
  }, []);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const monthNames =
    language === 'id'
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayHeaders =
    language === 'id'
      ? ['M', 'S', 'S', 'R', 'K', 'J', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const dayEvents = useMemo(
    () => events.filter((e) => e.dateKey === selectedKey),
    [events, selectedKey]
  );

  const addEvent = async () => {
    if (!titleInput.trim()) {
      soundEngine.playCue('error');
      return;
    }
    await db.events.add({
      dateKey: selectedKey,
      title: titleInput.trim(),
      time: timeInput || '09:00',
      description: descInput.trim() || undefined,
    });
    soundEngine.playCue('select');
    setTitleInput('');
    setDescInput('');
    setAdding(false);
    showToast(language === 'id' ? 'Acara ditambahkan' : 'Event saved');
    loadEvents();
  };

  useEffect(() => {
    if (adding) {
      setSoftkeys({
        leftLabel: '',
        centerLabel: language === 'id' ? 'Simpan' : 'Save',
        rightLabel: language === 'id' ? 'Batal' : 'Cancel',
        onCenter: addEvent,
        onRight: () => setAdding(false),
      });
    } else {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Hari Ini' : 'Today',
        centerLabel: language === 'id' ? 'Tambah' : 'Add',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => {
          const now = new Date();
          setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
          setSelectedDay(now.getDate());
        },
        onCenter: () => setAdding(true),
        onRight: onBack,
      });
    }
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={`${monthNames[month]} ${year}`}
        onPrev={() => setViewDate(new Date(year, month - 1, 1))}
        onNext={() => setViewDate(new Date(year, month + 1, 1))}
      />

      {adding ? (
        <div className="flex-1 p-3 space-y-2">
          <div className="text-sm font-bold border-b-2 border-[var(--lcd-fg)] pb-1">
            {language === 'id' ? `Acara baru (${selectedKey})` : `New event (${selectedKey})`}
          </div>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder={language === 'id' ? 'Judul acara...' : 'Event title...'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-sm outline-none"
          />
          <input
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-sm outline-none"
          />
          <input
            type="text"
            value={descInput}
            onChange={(e) => setDescInput(e.target.value)}
            placeholder={language === 'id' ? 'Catatan (opsional)...' : 'Description (optional)...'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-sm outline-none"
          />
          <button
            type="button"
            onClick={addEvent}
            className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-base font-bold cursor-pointer"
          >
            {language === 'id' ? 'Simpan Acara' : 'Save Event'}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 p-1.5">
          <div className="grid grid-cols-7 text-center font-bold text-sm border-b-2 border-[var(--lcd-fg)] pb-0.5">
            {dayHeaders.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 py-1 text-center text-sm">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasEvent = events.some((e) => e.dateKey === k);
              const isSelected = day === selectedDay;
              const isToday = k === todayKey;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    soundEngine.playCue('click');
                  }}
                  className={`relative py-0.5 leading-tight font-bold cursor-pointer tabular-nums ${
                    isSelected
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : isToday
                        ? 'border border-[var(--lcd-fg)] bg-[var(--lcd-sec)]'
                        : 'hover:bg-[var(--lcd-sec)]'
                  }`}
                >
                  {day}
                  {hasEvent && (
                    <span
                      className={`block mx-auto w-1.5 h-[2px] ${
                        isSelected ? 'bg-[var(--lcd-bg)]' : 'bg-[var(--lcd-fg)]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Events for selected date */}
          <div className="flex-1 overflow-y-auto lcd-scroll border-t-2 border-[var(--lcd-fg)] pt-1 space-y-1">
            {dayEvents.length === 0 ? (
              <div className="text-sm opacity-75 text-center py-2">
                {language === 'id' ? 'Tidak ada acara hari ini.' : 'No events on this date.'}
              </div>
            ) : (
              dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-2 py-0.5 text-sm"
                >
                  <span className="truncate font-bold">
                    {ev.time} · {ev.title}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (ev.id) await db.events.delete(ev.id);
                      loadEvents();
                    }}
                    className="ml-2 px-1 font-bold hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
                  >
                    X
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
