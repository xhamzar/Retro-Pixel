'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps } from '@/src/types/os';

export type TVChannelStatus = 'online' | 'limit' | 'check' | 'offline';

export interface TVChannel {
  id: string;
  num: string;
  name: string;
  group: 'MNC' | 'TRANSMEDIA' | 'EMTEK' | 'BERITA';
  url: string;
  status: TVChannelStatus;
  noteId: string;
  noteEn: string;
}

const TV_CHANNELS: TVChannel[] = [
  // Online (11)
  {
    id: 'rcti',
    num: '01',
    name: 'RCTI',
    group: 'MNC',
    url: 'https://sindikasi.inews.id/embed/video/YWdlbnQ9ZGVza3RvcCZ1cmw9aHR0cHMlM0ElMkYlMkZlbWJlZC5yY3RpcGx1cy5jb20lMkZsaXZlJTJGcmN0aSUyRmluZXdzaWQmaGVpZ2h0PTEwMCUyNSZ3aWR0aD0xMDAlMjU=',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'gtv',
    num: '02',
    name: 'GTV',
    group: 'MNC',
    url: 'https://sindikasi.inews.id/embed/video/YWdlbnQ9ZGVza3RvcCZ1cmw9aHR0cHMlM0ElMkYlMkZlbWJlZC5yY3RpcGx1cy5jb20lMkZsaXZlJTJGZ3R2JTJGaW5ld3NpZCZoZWlnaHQ9MTAwJTI1JndpZHRoPTEwMCUyNQ==',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'inews',
    num: '03',
    name: 'iNews',
    group: 'MNC',
    url: 'https://sindikasi.inews.id/embed/video/YWdlbnQ9ZGVza3RvcCZ1cmw9aHR0cHMlM0ElMkYlMkZlbWJlZC5yY3RpcGx1cy5jb20lMkZsaXZlJTJGaW5ld3MlMkZpbmV3c2lkJmhlaWdodD0xMDAlMjUmd2lkdGg9MTAwJTI1',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'mnctv',
    num: '04',
    name: 'MNCTV',
    group: 'MNC',
    url: 'https://sindikasi.inews.id/embed/video/YWdlbnQ9ZGVza3RvcCZ1cmw9aHR0cHMlM0ElMkYlMkZlbWJlZC5yY3RpcGx1cy5jb20lMkZsaXZlJTJGbW5jdHYlMkZpbmV3c2lkJmhlaWdodD0xMDAlMjUmd2lkdGg9MTAwJTI1',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'idx',
    num: '05',
    name: 'IDX Channel',
    group: 'MNC',
    url: 'https://sindikasi.inews.id/embed/video/YWdlbnQ9ZGVza3RvcCZ1cmw9aHR0cHMlM0ElMkYlMkZjZG4tbGl2ZXR2LXN0dWRpby5tZXR1YmUuaWQlMkZpZHhjaGFubmVsLm0zdTgmaGVpZ2h0PTEwMCUyNSZ3aWR0aD0xMDAlMjU=',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'mncnews',
    num: '06',
    name: 'MNCNEWS',
    group: 'MNC',
    url: 'https://sindikasi.inews.id/embed/video/YWdlbnQ9ZGVza3RvcCZ1cmw9aHR0cHMlM0ElMkYlMkZjZG4tbGl2ZXR2LXN0dWRpby5tZXR1YmUuaWQlMkZtbmNuZXdzLm0zdTgmaGVpZ2h0PTEwMCUyNSZ3aWR0aD0xMDAlMjU=',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'trans7',
    num: '07',
    name: 'TRANS7',
    group: 'TRANSMEDIA',
    url: 'https://20.detik.com/watch/livestreaming-trans7',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'transtv',
    num: '08',
    name: 'TRANS TV',
    group: 'TRANSMEDIA',
    url: 'https://20.detik.com/watch/livestreaming-transtv',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'cnn',
    num: '09',
    name: 'CNN INDONESIA',
    group: 'TRANSMEDIA',
    url: 'https://www.cnnindonesia.com/tv/embed?ref=transmedia',
    status: 'online',
    noteId: 'Online · No Limit',
    noteEn: 'Online · No Limit',
  },
  {
    id: 'cnbc',
    num: '10',
    name: 'CNBC INDONESIA',
    group: 'TRANSMEDIA',
    url: 'https://www.cnbcindonesia.com/embed/tv?ref=transmedia',
    status: 'online',
    noteId: 'Online · Live Embed',
    noteEn: 'Online · Live Embed',
  },
  {
    id: 'sctv',
    num: '11',
    name: 'SCTV',
    group: 'EMTEK',
    url: 'https://www.vidio.com/live/204-sctv-tv-stream/embed?autoplay=true&player_only=true&live_chat=false&mute=false&',
    status: 'limit',
    noteId: 'Limit (stream berhenti otomatis berkala, klik Muat Ulang jika berhenti)',
    noteEn: 'Limit (stream auto-stops periodically, tap Reload if paused)',
  },
  // Perlu dicek di browser (2)
  {
    id: 'metrotv',
    num: '12',
    name: 'METRO TV',
    group: 'BERITA',
    url: 'https://www.dailymotion.com/embed/video/k236ofBIxajxDiti8CY?autoPlay=1&queue-enable=false',
    status: 'check',
    noteId: 'Dailymotion Embed (perlu cek di browser)',
    noteEn: 'Dailymotion Embed (browser check)',
  },
  {
    id: 'kompastv',
    num: '13',
    name: 'KOMPAS TV',
    group: 'BERITA',
    url: 'https://www.dailymotion.com/embed/video/k46igSmSMGBIiWsXtWk?autoplay=1',
    status: 'check',
    noteId: 'Dailymotion Embed (perlu cek di browser)',
    noteEn: 'Dailymotion Embed (browser check)',
  },
  // Tidak bisa dibuka (1)
  {
    id: 'beritasatu',
    num: '14',
    name: 'BERITA SATU',
    group: 'BERITA',
    url: 'https://beritasatu.tv/playstream.php',
    status: 'offline',
    noteId: 'Offline · Koneksi server gagal (000)',
    noteEn: 'Offline · Server unreachable (000)',
  },
];

const LAST_CHANNEL_KEY = 'retro_tv_last_channel';

export const TVApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const subscribeKey = useOSStore((s) => s.subscribeKey);
  const showToast = useOSStore((s) => s.showToast);
  const openApp = useOSStore((s) => s.openApp);

  const [channelIdx, setChannelIdx] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const savedId = window.localStorage.getItem(LAST_CHANNEL_KEY);
    const found = TV_CHANNELS.findIndex((c) => c.id === savedId);
    return found >= 0 ? found : 0;
  });

  const [view, setView] = useState<'player' | 'guide'>('player');
  const [filter, setFilter] = useState<'all' | 'online' | 'other'>('all');
  const [lcdMode, setLcdMode] = useState(false);
  const [staticBurst, setStaticBurst] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const currentChannel = TV_CHANNELS[channelIdx] ?? TV_CHANNELS[0];

  const filteredChannels = useMemo(() => {
    if (filter === 'online') return TV_CHANNELS.filter((c) => c.status === 'online' || c.status === 'limit');
    if (filter === 'other') return TV_CHANNELS.filter((c) => c.status === 'check' || c.status === 'offline');
    return TV_CHANNELS;
  }, [filter]);

  const selectChannel = useCallback(
    (idx: number, switchToPlayer = false) => {
      const normalized = (idx + TV_CHANNELS.length) % TV_CHANNELS.length;
      const ch = TV_CHANNELS[normalized];
      soundEngine.playCue('click');
      setChannelIdx(normalized);
      setStaticBurst(true);
      setReloadNonce((n) => n + 1);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_CHANNEL_KEY, ch.id);
      }
      if (switchToPlayer) {
        setView('player');
      }
      showToast(`CH ${ch.num} · ${ch.name}`);
      setTimeout(() => setStaticBurst(false), 260);
    },
    [showToast]
  );

  const stepChannel = useCallback(
    (delta: number) => {
      selectChannel(channelIdx + delta, false);
    },
    [channelIdx, selectChannel]
  );

  // D-Pad & physical keypad channel surfing
  useEffect(() => {
    return subscribeKey((cmd) => {
      if (view !== 'player') return false;
      if (cmd === 'LEFT' || cmd === 'UP') {
        stepChannel(-1);
        return true;
      }
      if (cmd === 'RIGHT' || cmd === 'DOWN') {
        stepChannel(1);
        return true;
      }
      if (cmd === 'OK') {
        setReloadNonce((n) => n + 1);
        soundEngine.playCue('click');
        return true;
      }
      return false;
    });
  }, [subscribeKey, stepChannel, view]);

  useEffect(() => {
    if (view === 'guide') {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Pemutar' : 'Player',
        centerLabel: 'OK',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => setView('player'),
        onRight: () => setView('player'),
      });
      return;
    }

    setSoftkeys({
      leftLabel: language === 'id' ? 'Saluran' : 'Channels',
      centerLabel: language === 'id' ? 'Muat' : 'Reload',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => {
        soundEngine.playCue('click');
        setView('guide');
      },
      onCenter: () => {
        soundEngine.playCue('click');
        setStaticBurst(true);
        setReloadNonce((n) => n + 1);
        setTimeout(() => setStaticBurst(false), 240);
      },
      onRight: onBack,
    });
  }, [view, language, onBack, setSoftkeys]);

  const statusBadge = (status: TVChannelStatus) => {
    switch (status) {
      case 'online':
        return 'LIVE';
      case 'limit':
        return 'LIMIT';
      case 'check':
        return 'CEK';
      case 'offline':
        return 'OFF';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={
          view === 'guide'
            ? language === 'id'
              ? 'Daftar Saluran TV (14)'
              : 'TV Channel Guide (14)'
            : `TV · CH ${currentChannel.num} ${currentChannel.name}`
        }
        showChevrons={false}
      />

      {view === 'player' ? (
        <div className="flex-1 flex flex-col p-1.5 gap-1.5 min-h-0">
          {/* OSD Status Strip */}
          <div className="flex items-center justify-between gap-1 px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <PixelIcon name="tv" size={16} />
              <span className="font-bold truncate">
                {currentChannel.num}. {currentChannel.name}
              </span>
              <span className="px-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold text-[9px] shrink-0">
                {statusBadge(currentChannel.status)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                setLcdMode((m) => !m);
              }}
              className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] font-bold text-[9px] cursor-pointer shrink-0 ${
                lcdMode ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
              }`}
              title={language === 'id' ? 'Ubah mode warna / LCD monokrom' : 'Toggle Color / Monochrome LCD'}
            >
              {lcdMode ? 'LCD 2-BIT' : 'WARNA'}
            </button>
          </div>

          {/* Broadcast Viewport */}
          <div className="relative flex-1 min-h-0 border-2 border-[var(--lcd-fg)] bg-black overflow-hidden">
            {staticBurst ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--lcd-fg)] text-[var(--lcd-bg)] p-3 text-center">
                <div className="w-full h-full opacity-35 bg-[radial-gradient(#D8FF9A_1px,transparent_1px)] [background-size:4px_4px] absolute inset-0 pointer-events-none" />
                <div className="relative z-10 border-2 border-[var(--lcd-bg)] bg-[var(--lcd-fg)] px-3 py-2">
                  <div className="text-xs font-bold tracking-wider">TUNING CH {currentChannel.num}</div>
                  <div className="text-sm font-bold mt-0.5">{currentChannel.name}</div>
                </div>
              </div>
            ) : currentChannel.status === 'offline' ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--lcd-fg)] text-[var(--lcd-bg)] p-3 text-center gap-2">
                <PixelIcon name="tv" size={32} />
                <div className="text-xs font-bold">
                  {language === 'id' ? 'SINYAL TIDAK TERSEDIA (000)' : 'NO SIGNAL (000)'}
                </div>
                <p className="text-[10px] opacity-85 max-w-[240px]">
                  {language === 'id'
                    ? 'Server BERITA SATU gagal merespons (HTTP 000). Anda tetap dapat mencoba muat ulang atau membuka lewat Browser OS.'
                    : 'BERITA SATU server failed to connect (HTTP 000). You can try reloading or opening via OS Browser.'}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => openApp('browser', { url: currentChannel.url })}
                    className="px-2 py-1 border border-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer hover:bg-[var(--lcd-bg)] hover:text-[var(--lcd-fg)]"
                  >
                    {language === 'id' ? 'Buka di Browser' : 'Open in Browser'}
                  </button>
                  <button
                    type="button"
                    onClick={() => stepChannel(1)}
                    className="px-2 py-1 bg-[var(--lcd-bg)] text-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Saluran Berikutnya' : 'Next Channel'}
                  </button>
                </div>
              </div>
            ) : (
              <iframe
                key={`${currentChannel.id}-${reloadNonce}`}
                src={currentChannel.url}
                title={`TV Live ${currentChannel.name}`}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
                className={`w-full h-full border-0 bg-black ${
                  lcdMode ? 'grayscale contrast-150 brightness-105' : ''
                }`}
              />
            )}
          </div>

          {/* Note / Hint for Limit or Browser Check channels */}
          {currentChannel.status !== 'online' && (
            <div className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[9px] flex items-center justify-between gap-2 shrink-0">
              <span className="truncate">
                {language === 'id' ? currentChannel.noteId : currentChannel.noteEn}
              </span>
              <button
                type="button"
                onClick={() => openApp('browser', { url: currentChannel.url })}
                className="underline font-bold cursor-pointer shrink-0"
              >
                {language === 'id' ? 'Browser' : 'Browser'}
              </button>
            </div>
          )}

          {/* Quick Channel Strip */}
          <div className="flex items-center gap-1 overflow-x-auto lcd-scroll pb-0.5 shrink-0">
            {TV_CHANNELS.map((ch, idx) => {
              const active = idx === channelIdx;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectChannel(idx, false)}
                  className={`px-1.5 py-0.5 border-2 border-[var(--lcd-fg)] text-[10px] font-bold shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'bg-[var(--lcd-sec)] text-[var(--lcd-fg)] hover:bg-[var(--lcd-bg)]'
                  }`}
                >
                  {ch.num}.{ch.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Physical-style Channel Surf Controls */}
          <div className="grid grid-cols-4 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => stepChannel(-1)}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
            >
              ◀ CH-
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                setView('guide');
              }}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
            >
              {language === 'id' ? 'DAFTAR' : 'GUIDE'}
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                setStaticBurst(true);
                setReloadNonce((n) => n + 1);
                setTimeout(() => setStaticBurst(false), 240);
              }}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
            >
              {language === 'id' ? 'MUAT' : 'RELOAD'}
            </button>
            <button
              type="button"
              onClick={() => stepChannel(1)}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              CH+ ▶
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Filter Tabs */}
          <div className="grid grid-cols-3 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold shrink-0">
            {[
              { id: 'all', label: language === 'id' ? `Semua (${TV_CHANNELS.length})` : `All (${TV_CHANNELS.length})` },
              { id: 'online', label: 'Online (11)' },
              { id: 'other', label: language === 'id' ? 'Cek/Off (3)' : 'Check/Off (3)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as 'all' | 'online' | 'other')}
                className={`py-1.5 border-r last:border-r-0 border-[var(--lcd-fg)] cursor-pointer ${
                  filter === tab.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Channel List */}
          <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
            {filteredChannels.map((ch) => {
              const globalIdx = TV_CHANNELS.findIndex((item) => item.id === ch.id);
              const isCurrent = globalIdx === channelIdx;
              return (
                <div
                  key={ch.id}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 ${
                    isCurrent ? 'bg-[var(--lcd-sec)]' : 'hover:bg-[var(--lcd-sec)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectChannel(globalIdx, true)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 border border-[var(--lcd-fg)] text-[10px] font-bold shrink-0">
                        {ch.num}
                      </span>
                      <span className="text-xs font-bold truncate">{ch.name}</span>
                      <span
                        className={`px-1 text-[9px] font-bold border border-[var(--lcd-fg)] shrink-0 ${
                          ch.status === 'online'
                            ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                            : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {statusBadge(ch.status)}
                      </span>
                    </div>
                    <div className="text-[10px] opacity-80 truncate mt-0.5">
                      {ch.group} · {language === 'id' ? ch.noteId : ch.noteEn}
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => selectChannel(globalIdx, true)}
                      className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                    >
                      {language === 'id' ? 'TONTON' : 'WATCH'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openApp('browser', { url: ch.url })}
                      className="px-1.5 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                      title={language === 'id' ? 'Buka di Browser' : 'Open in Browser'}
                    >
                      WEB
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
