'use client';

import React, { useEffect, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AlarmRecord, AppComponentProps, ReminderRecord } from '@/src/types/os';

export const ClockApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  const [tab, setTab] = useState<'clock' | 'stopwatch' | 'timer'>('clock');
  const [now, setNow] = useState(() => new Date());

  // Stopwatch state
  const [swRunning, setSwRunning] = useState(false);
  const [swMs, setSwMs] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  // Timer state
  const [timerSec, setTimerSec] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!swRunning) return;
    const id = setInterval(() => setSwMs((m) => m + 100), 100);
    return () => clearInterval(id);
  }, [swRunning]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimerSec((s) => {
        if (s <= 1) {
          setTimerRunning(false);
          soundEngine.playCue('alarm');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    setSoftkeys({
      leftLabel:
        tab === 'stopwatch'
          ? swRunning
            ? 'Lap'
            : 'Reset'
          : tab === 'timer'
            ? '+30s'
            : '',
      centerLabel:
        tab === 'stopwatch'
          ? swRunning
            ? language === 'id'
              ? 'Jeda'
              : 'Pause'
            : language === 'id'
              ? 'Mulai'
              : 'Start'
          : tab === 'timer'
            ? timerRunning
              ? language === 'id'
                ? 'Jeda'
                : 'Pause'
              : language === 'id'
                ? 'Mulai'
                : 'Start'
            : 'Tab',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => {
        if (tab === 'stopwatch') {
          if (swRunning) setLaps((l) => [swMs, ...l].slice(0, 6));
          else {
            setSwMs(0);
            setLaps([]);
          }
        } else if (tab === 'timer') {
          setTimerSec((s) => s + 30);
        }
      },
      onCenter: () => {
        if (tab === 'stopwatch') setSwRunning((r) => !r);
        else if (tab === 'timer') setTimerRunning((r) => !r);
        else setTab('stopwatch');
      },
      onRight: onBack,
    });
  }, [tab, swRunning, swMs, timerRunning, language]);

  const fmtSw = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    const d = Math.floor((ms % 1000) / 100);
    return `${m}:${s}.${d}`;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Jam' : 'Clock'}
        onPrev={() => setTab(tab === 'clock' ? 'timer' : tab === 'stopwatch' ? 'clock' : 'stopwatch')}
        onNext={() => setTab(tab === 'clock' ? 'stopwatch' : tab === 'stopwatch' ? 'timer' : 'clock')}
      />

      <div className="grid grid-cols-3 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-sm font-bold">
        {(['clock', 'stopwatch', 'timer'] as const).map((tKey) => (
          <button
            key={tKey}
            type="button"
            onClick={() => setTab(tKey)}
            className={`py-1 cursor-pointer ${
              tab === tKey ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
            }`}
          >
            {tKey === 'clock'
              ? language === 'id'
                ? 'Jam'
                : 'Clock'
              : tKey === 'stopwatch'
                ? 'Stopwatch'
                : 'Timer'}
          </button>
        ))}
      </div>

      {tab === 'clock' && (
        <div className="flex-1 flex flex-col justify-center items-center p-3 text-center">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-3 py-3 w-full">
            <div className="text-2xl sm:text-3xl font-bold leading-none tabular-nums">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs sm:text-sm mt-1.5">{now.toDateString()}</div>
          </div>
          <div className="w-full mt-3 space-y-1 text-xs sm:text-sm">
            <div className="flex justify-between border border-[var(--lcd-fg)] px-2 py-1">
              <span>WIB (Jakarta)</span>
              <span className="font-bold tabular-nums">
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between border border-[var(--lcd-fg)] px-2 py-1">
              <span>UTC / GMT</span>
              <span className="font-bold tabular-nums">
                {String(now.getUTCHours()).padStart(2, '0')}:{String(now.getUTCMinutes()).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === 'stopwatch' && (
        <div className="flex-1 flex flex-col p-3 gap-2">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] py-3 text-center text-2xl sm:text-3xl font-bold tabular-nums">
            {fmtSw(swMs)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSwRunning((r) => !r)}
              className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs sm:text-sm font-bold cursor-pointer"
            >
              {swRunning ? (language === 'id' ? 'Jeda' : 'Pause') : language === 'id' ? 'Mulai' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (swRunning) setLaps((l) => [swMs, ...l].slice(0, 6));
                else {
                  setSwMs(0);
                  setLaps([]);
                }
              }}
              className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs sm:text-sm font-bold cursor-pointer"
            >
              {swRunning ? 'Lap' : 'Reset'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll space-y-1">
            {laps.map((lap, idx) => (
              <div key={idx} className="flex justify-between border border-[var(--lcd-fg)] px-2 py-0.5 text-xs tabular-nums">
                <span>Lap #{laps.length - idx}</span>
                <span className="font-bold">{fmtSw(lap)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'timer' && (
        <div className="flex-1 flex flex-col justify-between p-3">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] py-4 text-center text-3xl font-bold tabular-nums">
            {String(Math.floor(timerSec / 60)).padStart(2, '0')}:{String(timerSec % 60).padStart(2, '0')}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[15, 60, 180].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSec(sec);
                }}
                className="py-1 border-2 border-[var(--lcd-fg)] text-xs sm:text-sm font-bold hover:bg-[var(--lcd-sec)] cursor-pointer"
              >
                {sec < 60 ? `${sec}s` : `${sec / 60}m`}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTimerRunning((r) => !r)}
            className="w-full py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs sm:text-sm font-bold cursor-pointer"
          >
            {timerRunning ? (language === 'id' ? 'Jeda Timer' : 'Pause Timer') : language === 'id' ? 'Mulai Timer' : 'Start Timer'}
          </button>
        </div>
      )}
    </div>
  );
};

export const AlarmApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [timeInput, setTimeInput] = useState('07:00');
  const [labelInput, setLabelInput] = useState('');

  const load = async () => {
    setAlarms(await db.alarms.toArray());
  };

  useEffect(() => {
    let active = true;
    db.alarms.toArray().then((rows) => {
      if (active) setAlarms(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const addAlarm = async () => {
    await db.alarms.add({
      time: timeInput,
      label: labelInput.trim() || 'Alarm',
      enabled: true,
      days: language === 'id' ? 'Setiap Hari' : 'Daily',
    });
    soundEngine.playCue('select');
    setAdding(false);
    setLabelInput('');
    load();
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: adding ? '' : language === 'id' ? 'Tes' : 'Test',
      centerLabel: adding ? (language === 'id' ? 'Simpan' : 'Save') : language === 'id' ? 'Tambah' : 'Add',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => {
        soundEngine.playCue('alarm');
        showToast(language === 'id' ? 'Bunyi alarm dites!' : 'Alarm ring tested!');
      },
      onCenter: () => {
        if (adding) addAlarm();
        else setAdding(true);
      },
      onRight: () => {
        if (adding) setAdding(false);
        else onBack();
      },
    });
  }, [adding, timeInput, labelInput, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title="Alarm" showChevrons={false} />
      {adding ? (
        <div className="p-3 space-y-2.5">
          <input
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-2xl font-bold"
          />
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder={language === 'id' ? 'Label alarm...' : 'Alarm label...'}
            className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1 text-base"
          />
          <button
            type="button"
            onClick={addAlarm}
            className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-lg font-bold cursor-pointer"
          >
            {language === 'id' ? 'Simpan Alarm' : 'Save Alarm'}
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
          {alarms.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-2.5 py-2">
              <div>
                <div className="text-2xl font-bold leading-none tabular-nums">{a.time}</div>
                <div className="text-sm opacity-80">
                  {a.label} · {a.days}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    if (!a.id) return;
                    await db.alarms.update(a.id, { enabled: !a.enabled });
                    soundEngine.playCue('click');
                    load();
                  }}
                  className={`px-2 py-0.5 border-2 border-[var(--lcd-fg)] text-sm font-bold cursor-pointer ${
                    a.enabled ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                  }`}
                >
                  {a.enabled ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!a.id) return;
                    await db.alarms.delete(a.id);
                    load();
                  }}
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] text-sm font-bold cursor-pointer"
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const RemindersApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  const [items, setItems] = useState<ReminderRecord[]>([]);
  const [text, setText] = useState('');

  const load = async () => {
    setItems(await db.reminders.toArray());
  };

  useEffect(() => {
    let active = true;
    db.reminders.toArray().then((rows) => {
      if (active) setItems(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const addItem = async () => {
    if (!text.trim()) return;
    await db.reminders.add({
      text: text.trim(),
      done: false,
      due: language === 'id' ? 'Hari ini' : 'Today',
    });
    soundEngine.playCue('select');
    setText('');
    load();
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: language === 'id' ? 'Tambah' : 'Add',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: addItem,
      onRight: onBack,
    });
  }, [text, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Pengingat' : 'Reminders'} showChevrons={false} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addItem();
        }}
        className="flex gap-1 p-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)]"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={language === 'id' ? 'Tambah tugas...' : 'Add reminder...'}
          className="flex-1 min-w-0 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-0.5 text-base outline-none"
        />
        <button type="submit" className="px-2.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer">
          +
        </button>
      </form>
      <div className="flex-1 overflow-y-auto lcd-scroll divide-y border-[var(--lcd-fg)]">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-2 py-1.5">
            <button
              type="button"
              onClick={async () => {
                if (!item.id) return;
                await db.reminders.update(item.id, { done: !item.done });
                soundEngine.playCue('click');
                load();
              }}
              className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
            >
              <span className="w-5 h-5 border-2 border-[var(--lcd-fg)] flex items-center justify-center shrink-0">
                {item.done && <PixelIcon name="check" size={14} />}
              </span>
              <span className={`text-base truncate ${item.done ? 'line-through opacity-60' : 'font-bold'}`}>
                {item.text}
              </span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!item.id) return;
                await db.reminders.delete(item.id);
                load();
              }}
              className="px-1.5 text-sm font-bold cursor-pointer"
            >
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
