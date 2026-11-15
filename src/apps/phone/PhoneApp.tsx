'use client';

import React, { useEffect, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, CallLogRecord } from '@/src/types/os';

export const PhoneApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const openApp = useOSStore((s) => s.openApp);

  const [tab, setTab] = useState<'history' | 'dialer' | 'contacts'>('history');
  const [logs, setLogs] = useState<CallLogRecord[]>([]);
  const [dialInput, setDialInput] = useState(() =>
    params?.phoneNumber ? String(params.phoneNumber) : ''
  );
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Active call simulation
  const [inCall, setInCall] = useState(false);
  const [callTarget, setCallTarget] = useState({ name: '', phone: '' });
  const [callSeconds, setCallSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  const loadLogs = async () => {
    const rows = await db.callLogs.orderBy('timestamp').reverse().toArray();
    setLogs(rows);
  };

  const startCall = async (phone: string, explicitName?: string) => {
    const clean = phone.trim();
    if (!clean) {
      soundEngine.playCue('error');
      return;
    }
    const contact = await db.contacts.where('phone').equals(clean).first();
    const displayName = explicitName || contact?.name || clean;
    setCallTarget({ name: displayName, phone: clean });
    setCallSeconds(0);
    setMuted(false);
    setSpeaker(false);
    setInCall(true);
    soundEngine.playCue('open');
  };

  useEffect(() => {
    let active = true;
    db.callLogs
      .orderBy('timestamp')
      .reverse()
      .toArray()
      .then((rows) => {
        if (active) setLogs(rows);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!params?.phoneNumber) return;
    const num = String(params.phoneNumber);
    let active = true;
    db.contacts
      .where('phone')
      .equals(num)
      .first()
      .then((contact) => {
        if (!active) return;
        setDialInput(num);
        setCallTarget({ name: contact?.name || num, phone: num });
        setCallSeconds(0);
        setMuted(false);
        setSpeaker(false);
        setInCall(true);
        soundEngine.playCue('open');
      });
    return () => {
      active = false;
    };
  }, [params?.phoneNumber]);

  useEffect(() => {
    if (!inCall) return;
    const id = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [inCall]);

  const endCall = async () => {
    soundEngine.playCue('back');
    await db.callLogs.add({
      contactName: callTarget.name,
      phone: callTarget.phone,
      direction: 'outgoing',
      durationSec: callSeconds,
      timestamp: Date.now(),
    });
    setInCall(false);
    await loadLogs();
  };

  useEffect(() => {
    if (inCall) {
      setSoftkeys({
        leftLabel: muted ? (language === 'id' ? 'Bunyi' : 'Unmute') : (language === 'id' ? 'Bisu' : 'Mute'),
        centerLabel: speaker ? 'Ear' : 'Speaker',
        rightLabel: language === 'id' ? 'Tutup' : 'End',
        onLeft: () => setMuted((m) => !m),
        onCenter: () => setSpeaker((sp) => !sp),
        onRight: endCall,
      });
    } else if (tab === 'dialer') {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Hapus' : 'Clear',
        centerLabel: language === 'id' ? 'Panggil' : 'Call',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => setDialInput((d) => d.slice(0, -1)),
        onCenter: () => startCall(dialInput),
        onRight: onBack,
      });
    } else {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Papan' : 'Dialer',
        centerLabel: language === 'id' ? 'Panggil' : 'Call',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => setTab('dialer'),
        onCenter: () => {
          const log = logs[selectedIdx];
          if (log) startCall(log.phone, log.contactName);
        },
        onRight: onBack,
      });
    }
  }, [inCall, muted, speaker, tab, dialInput, logs, selectedIdx, callSeconds, language]);

  const formatDuration = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const formatLogDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()} Nov, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const showToast = useOSStore((s) => s.showToast);

  const saveNumberToContacts = async () => {
    const clean = dialInput.trim();
    if (!clean) return;
    const exists = await db.contacts.where('phone').equals(clean).first();
    if (exists) {
      showToast(language === 'id' ? `Sudah ada: ${exists.name}` : `Exists: ${exists.name}`);
      return;
    }
    await db.contacts.add({
      name: clean,
      phone: clean,
      group: 'Umum',
    });
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Nomor disimpan ke Kontak' : 'Saved to Contacts');
  };

  const deleteLog = async (id?: number) => {
    if (!id) return;
    await db.callLogs.delete(id);
    soundEngine.playCue('back');
    loadLogs();
  };

  if (inCall) {
    return (
      <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
        <AppHeader title={language === 'id' ? 'Panggilan Aktif' : 'Active Call'} showChevrons={false} />
        <div className="flex-1 flex flex-col items-center justify-between p-4 text-center">
          <div className="mt-2">
            <div className="inline-block p-3 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)]">
              <PixelIcon name="phone" size={44} />
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-2">{callTarget.name}</h3>
            <p className="text-xs sm:text-sm opacity-85 tabular-nums">{callTarget.phone}</p>
          </div>

          <div className="border-2 border-[var(--lcd-fg)] px-4 py-1.5 bg-[var(--lcd-sec)]">
            <div className="text-[10px] uppercase">
              {callSeconds < 2
                ? language === 'id'
                  ? 'Memanggil...'
                  : 'Dialing...'
                : language === 'id'
                  ? 'Terhubung'
                  : 'Connected'}
            </div>
            <div className="text-xl sm:text-2xl font-bold tabular-nums leading-none mt-1">
              {formatDuration(callSeconds)}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className={`flex-1 border-2 border-[var(--lcd-fg)] py-1.5 text-xs sm:text-sm font-bold cursor-pointer ${
                  muted ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                }`}
              >
                {muted ? (language === 'id' ? 'Dibisukan' : 'Muted') : language === 'id' ? 'Bisu' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={endCall}
                className="flex-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] py-1.5 text-xs sm:text-sm font-bold cursor-pointer"
              >
                {language === 'id' ? 'Akhiri' : 'End Call'}
              </button>
            </div>
            <a
              href={`tel:${encodeURIComponent(callTarget.phone)}`}
              className="w-full border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] py-1 text-[11px] font-bold text-center"
            >
              {language === 'id' ? 'Buka di Telepon Perangkat (tel:)' : 'Call via Device Phone (tel:)'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Panggilan' : 'Phone'}
        onPrev={() => setTab(tab === 'history' ? 'dialer' : 'history')}
        onNext={() => setTab(tab === 'history' ? 'dialer' : 'history')}
      />

      {/* Top icon tabs */}
      <div className="grid grid-cols-3 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)]">
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex items-center justify-center py-1.5 cursor-pointer ${
            tab === 'history' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
          }`}
          title={language === 'id' ? 'Riwayat' : 'History'}
        >
          <PixelIcon name="phone" size={22} />
        </button>
        <button
          type="button"
          onClick={() => setTab('dialer')}
          className={`flex items-center justify-center py-1.5 border-x-2 border-[var(--lcd-fg)] cursor-pointer text-base font-bold ${
            tab === 'dialer' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
          }`}
          title={language === 'id' ? 'Papan Nomor' : 'Dial Pad'}
        >
          123
        </button>
        <button
          type="button"
          onClick={() => openApp('contacts')}
          className="flex items-center justify-center py-1.5 hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
          title={language === 'id' ? 'Kontak' : 'Contacts'}
        >
          <PixelIcon name="contacts" size={22} />
        </button>
      </div>

      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-xs opacity-75">
              {language === 'id' ? 'Riwayat panggilan kosong.' : 'No call history.'}
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={log.id ?? idx}
                className={`flex items-center justify-between px-2 py-1.5 ${
                  idx === selectedIdx ? 'bg-[var(--lcd-sec)]' : 'hover:bg-[var(--lcd-sec)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIdx(idx);
                    startCall(log.phone, log.contactName);
                  }}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                >
                  <span className="text-base font-bold">
                    {log.direction === 'outgoing' ? '↗' : log.direction === 'incoming' ? '↙' : '✕'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold leading-none truncate">{log.contactName}</div>
                    <div className="text-[10px] opacity-80 mt-1">
                      {formatLogDate(log.timestamp)} · {formatDuration(log.durationSec)}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteLog(log.id)}
                  className="ml-2 px-1.5 py-0.5 border border-[var(--lcd-fg)] text-xs font-bold cursor-pointer"
                  title={language === 'id' ? 'Hapus' : 'Delete'}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'dialer' && (
        <div className="flex-1 flex flex-col p-2 gap-1.5">
          <div className="flex items-center justify-between gap-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-2 py-1 min-h-[36px]">
            <span className="text-base sm:text-lg font-bold tracking-wider truncate tabular-nums">
              {dialInput || (language === 'id' ? 'Masukkan nomor...' : 'Enter number...')}
            </span>
            {dialInput && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={saveNumberToContacts}
                  className="px-1.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
                  title={language === 'id' ? 'Simpan ke Kontak' : 'Save Contact'}
                >
                  +K
                </button>
                <button
                  type="button"
                  onClick={() => setDialInput((d) => d.slice(0, -1))}
                  className="px-1.5 border border-[var(--lcd-fg)] text-xs font-bold cursor-pointer"
                >
                  DEL
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1 flex-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  soundEngine.playDtmf(key);
                  setDialInput((prev) => prev + key);
                }}
                className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-sec)] active:bg-[var(--lcd-fg)] active:text-[var(--lcd-bg)] text-base font-bold cursor-pointer"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => startCall(dialInput)}
              className="flex-1 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PixelIcon name="phone" size={18} />
              <span>{language === 'id' ? 'Panggil' : 'Call'}</span>
            </button>
            {dialInput.trim() && (
              <a
                href={`tel:${encodeURIComponent(dialInput.trim())}`}
                className="px-2.5 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold flex items-center"
              >
                tel:
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

