'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/src/core/AppHeader';
import {
  FM_PRESETS,
  RADIO_FAVORITES_KEY,
  RADIO_RECENT_KEY,
  WORLD_FILTERS,
  radioEngine,
  readStoredRadioStations,
  writeStoredRadioStations,
  type WorldDirectoryFilter,
} from '@/src/services/radioEngine';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, OSRadioStation } from '@/src/types/os';

type RadioTab = 'tuner' | 'world' | 'search' | 'fav';

const STATIC_EQ = [28, 45, 72, 90, 64, 38, 82, 95, 58, 42, 76, 88, 52, 34, 68, 40];

export const RadioApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const volume = useOSStore((s) => s.volume);
  const setVolume = useOSStore((s) => s.setVolume);
  const radio = useOSStore((s) => s.radio);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const subscribeKey = useOSStore((s) => s.subscribeKey);

  const [tab, setTab] = useState<RadioTab>('tuner');

  // World Directory
  const [selectedFilterId, setSelectedFilterId] = useState<string>('id-all');
  const [worldStations, setWorldStations] = useState<OSRadioStation[]>([]);
  const [worldLoading, setWorldLoading] = useState<boolean>(false);
  const [worldProvider, setWorldProvider] = useState<string>('');

  // Search
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchResults, setSearchResults] = useState<OSRadioStation[]>([]);
  const [searching, setSearching] = useState<boolean>(false);

  // Favorites & Recents
  const [favorites, setFavorites] = useState<OSRadioStation[]>(() =>
    readStoredRadioStations(RADIO_FAVORITES_KEY),
  );
  const [recents, setRecents] = useState<OSRadioStation[]>(() =>
    readStoredRadioStations(RADIO_RECENT_KEY),
  );

  // Animated Pixel Equalizer phase
  const [eqTick, setEqTick] = useState<number>(0);

  const { activeStation, freq, power, status: streamStatus, sleepMinutesLeft, errorNote } = radio;

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (station: OSRadioStation) => {
      soundEngine.playCue('click');
      setFavorites((prev) => {
        const exists = prev.some((s) => s.id === station.id);
        const next = exists ? prev.filter((s) => s.id !== station.id) : [station, ...prev];
        writeStoredRadioStations(RADIO_FAVORITES_KEY, next);
        showToast(
          exists
            ? language === 'id'
              ? `Dihapus dari Favorit: ${station.name}`
              : `Removed favorite: ${station.name}`
            : language === 'id'
              ? `Disimpan ke Favorit: ${station.name}`
              : `Saved favorite: ${station.name}`,
        );
        return next;
      });
    },
    [language, showToast],
  );

  const playFromUI = useCallback((station: OSRadioStation) => {
    void radioEngine.playStation(station).then(() => {
      setRecents(readStoredRadioStations(RADIO_RECENT_KEY));
    });
  }, []);

  // Equalizer tick animation while active
  useEffect(() => {
    if (!power || (streamStatus !== 'live' && streamStatus !== 'synth')) return;
    const id = setInterval(() => {
      setEqTick((t) => (t + 1) % 64);
    }, 140);
    return () => clearInterval(id);
  }, [power, streamStatus]);

  // Load World Directory stations
  const loadWorldFilter = useCallback(async (filter: WorldDirectoryFilter) => {
    setSelectedFilterId(filter.id);
    setWorldLoading(true);
    try {
      let url = '';
      if (filter.kind === 'place') {
        url = `/api/radio/stations?mode=place&id=${encodeURIComponent(filter.value)}&city=${encodeURIComponent(
          filter.cityFallback || filter.label,
        )}`;
      } else if (filter.kind === 'tag') {
        url = `/api/radio/stations?mode=tag&tag=${encodeURIComponent(filter.value)}`;
      } else {
        url = `/api/radio/stations?mode=country&cc=${encodeURIComponent(filter.value)}`;
      }
      const resp = await fetch(url);
      const data = (await resp.json()) as { stations?: OSRadioStation[]; provider?: string };
      setWorldStations(Array.isArray(data.stations) ? data.stations : []);
      setWorldProvider(data.provider || '');
    } catch {
      setWorldStations([]);
      setWorldProvider('error');
    } finally {
      setWorldLoading(false);
    }
  }, []);

  const runSearch = useCallback(
    async (queryText: string) => {
      const q = queryText.trim();
      if (q.length < 2) {
        showToast(language === 'id' ? 'Ketik minimal 2 huruf' : 'Type at least 2 characters');
        return;
      }
      setSearching(true);
      try {
        const resp = await fetch(`/api/radio/stations?mode=search&q=${encodeURIComponent(q)}`);
        const data = (await resp.json()) as { stations?: OSRadioStation[] };
        setSearchResults(Array.isArray(data.stations) ? data.stations : []);
      } catch {
        setSearchResults([]);
        showToast(language === 'id' ? 'Gagal mencari stasiun' : 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [language, showToast],
  );

  // D-Pad controls
  useEffect(() => {
    return subscribeKey((cmd) => {
      if (tab === 'tuner') {
        if (cmd === 'LEFT') {
          radioEngine.stepFrequency(-0.1);
          return true;
        }
        if (cmd === 'RIGHT') {
          radioEngine.stepFrequency(0.1);
          return true;
        }
        if (cmd === 'UP') {
          setVolume(Math.min(1, Number((volume + 0.1).toFixed(2))));
          return true;
        }
        if (cmd === 'DOWN') {
          setVolume(Math.max(0, Number((volume - 0.1).toFixed(2))));
          return true;
        }
        if (cmd === 'OK') {
          radioEngine.togglePlayPause();
          return true;
        }
      }
      return false;
    });
  }, [setVolume, subscribeKey, tab, volume]);

  // Softkeys
  useEffect(() => {
    setSoftkeys({
      leftLabel: power ? (language === 'id' ? 'Jeda' : 'Pause') : language === 'id' ? 'Putar' : 'Play',
      centerLabel: language === 'id' ? 'Pindai' : 'Scan',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => radioEngine.togglePlayPause(),
      onCenter: () => radioEngine.scanNextPreset(),
      onRight: onBack,
    });
  });

  const eqHeights = useMemo(() => {
    return STATIC_EQ.map((base, idx) => {
      if (!power || streamStatus === 'idle' || streamStatus === 'paused' || streamStatus === 'error') return 10;
      if (streamStatus === 'connecting') return idx % 2 === eqTick % 2 ? 38 : 16;
      const wave = Math.abs(Math.sin((eqTick + idx * 1.7) * 0.65));
      return Math.max(14, Math.min(100, Math.round(base * (0.35 + wave * 0.65))));
    });
  }, [eqTick, power, streamStatus]);

  const dialPercent = useMemo(() => {
    const pct = ((freq - 87.5) / (108.0 - 87.5)) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [freq]);

  const statusBadgeText =
    streamStatus === 'live'
      ? activeStation.source === 'rg'
        ? '● LIVE RADIO GARDEN'
        : '● LIVE WORLD STREAM'
      : streamStatus === 'connecting'
        ? 'BUFFERING STREAM...'
        : streamStatus === 'synth'
          ? '♪ SYNTH / ANALOG BAND'
          : streamStatus === 'paused'
            ? language === 'id'
              ? 'TERJEDA (LATAR BELAKANG)'
              : 'PAUSED (BACKGROUND)'
            : streamStatus === 'error'
              ? 'STREAM ERROR'
              : 'STANDBY';

  const renderStationRow = (station: OSRadioStation) => {
    const active = activeStation.id === station.id && power;
    const fav = isFavorite(station.id);
    const badge = station.source === 'rg' ? 'RG' : station.source === 'synth' ? '8BIT' : 'RB';

    return (
      <div
        key={station.id}
        className={`flex items-center gap-1.5 border border-[var(--lcd-fg)] px-2 py-1.5 ${
          active ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)] hover:bg-[var(--lcd-sec)]'
        }`}
      >
        <button
          type="button"
          onClick={() => playFromUI(station)}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`px-1 text-[9px] font-bold border ${
                active
                  ? 'border-[var(--lcd-bg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)]'
                  : 'border-[var(--lcd-fg)] bg-[var(--lcd-sec)]'
              }`}
            >
              {badge}
            </span>
            <span className="text-xs font-bold truncate">{station.name}</span>
          </div>
          <div className={`text-[10px] truncate mt-0.5 ${active ? 'opacity-90' : 'opacity-75'}`}>
            {station.city}
            {station.country ? `, ${station.country}` : ''} · {station.genre}
            {station.bitrate ? ` · ${station.bitrate}k` : ''}
          </div>
        </button>

        {station.freq && (
          <span className="text-[10px] font-bold tabular-nums shrink-0">{station.freq.toFixed(1)}</span>
        )}

        <button
          type="button"
          onClick={() => toggleFavorite(station)}
          className={`px-1.5 py-0.5 border text-xs font-bold cursor-pointer shrink-0 ${
            active
              ? 'border-[var(--lcd-bg)] text-[var(--lcd-bg)]'
              : 'border-[var(--lcd-fg)] text-[var(--lcd-fg)]'
          }`}
          title={language === 'id' ? 'Simpan Favorit' : 'Toggle Favorite'}
        >
          {fav ? '★' : '☆'}
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Radio Dunia & FM' : 'World & FM Radio'} showChevrons={false} />

      {/* Top Navigation Tabs */}
      <div className="grid grid-cols-4 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
        {(
          [
            { id: 'tuner', label: 'Tuner' },
            { id: 'world', label: language === 'id' ? 'Dunia' : 'World' },
            { id: 'search', label: language === 'id' ? 'Cari' : 'Search' },
            { id: 'fav', label: `★ (${favorites.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              setTab(item.id);
              if (item.id === 'world' && worldStations.length === 0 && !worldLoading) {
                const def = WORLD_FILTERS.find((f) => f.id === selectedFilterId) || WORLD_FILTERS[0];
                void loadWorldFilter(def);
              }
              if (item.id === 'fav') {
                setRecents(readStoredRadioStations(RADIO_RECENT_KEY));
              }
            }}
            className={`py-1 text-[11px] font-bold border-r last:border-r-0 border-[var(--lcd-fg)] cursor-pointer ${
              tab === item.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Persistent Compact Now-Playing LCD Banner when outside Tuner */}
      {tab !== 'tuner' && (
        <div className="flex items-center justify-between gap-2 px-2 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase truncate">{statusBadgeText}</div>
            <div className="text-[11px] font-bold truncate">{activeStation.name}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => radioEngine.togglePlayPause()}
              className={`px-2 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                power ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
              }`}
            >
              {power ? (language === 'id' ? 'JEDA' : 'PAUSE') : language === 'id' ? 'PUTAR' : 'PLAY'}
            </button>
            {radio.sessionActive && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  radioEngine.stopCompletely();
                }}
                className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                title={language === 'id' ? 'Matikan Radio' : 'Stop Radio'}
              >
                ■
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: ANALOG TUNER + PRESETS */}
      {tab === 'tuner' && (
        <div className="flex-1 flex flex-col p-2 gap-2 min-h-0">
          {/* Retro LCD Tuner Screen */}
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 shrink-0">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase">
              <span>{statusBadgeText}</span>
              <span>
                {sleepMinutesLeft > 0 ? `SLEEP ${sleepMinutesLeft}m · ` : ''}
                VOL {Math.round(volume * 100)}%
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2 mt-1">
              <div className="text-2xl sm:text-3xl font-bold leading-none tabular-nums">
                {activeStation.freq ? `${freq.toFixed(1)} MHz` : 'LIVE STREAM'}
              </div>
              <span className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[9px] font-bold uppercase">
                {activeStation.source === 'rg'
                  ? 'Radio Garden'
                  : activeStation.source === 'synth'
                    ? 'Offline 8-Bit'
                    : 'Radio Browser'}
              </span>
            </div>

            <div className="text-xs sm:text-sm font-bold truncate mt-1">{activeStation.name}</div>
            <div className="text-[10px] opacity-80 truncate">
              {activeStation.city} · {activeStation.genre}
            </div>

            {errorNote && (
              <div className="mt-1 px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold">
                {errorNote}
              </div>
            )}

            {/* Analog Frequency Scale Ruler */}
            <div className="mt-2 relative h-5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-1 flex items-center justify-between text-[8px] font-bold select-none overflow-hidden">
              <span>88</span>
              <span>92</span>
              <span>96</span>
              <span>100</span>
              <span>104</span>
              <span>108</span>
              <div
                className="absolute top-0 bottom-0 w-1 bg-[var(--lcd-fg)] transition-all duration-100"
                style={{ left: `calc(${dialPercent}% - 2px)` }}
              />
            </div>

            {/* 16-Band Pixel Spectrum VU */}
            <div className="mt-1.5 h-6 flex items-end gap-0.5 border-t border-[var(--lcd-fg)] pt-1">
              {eqHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[var(--lcd-fg)] transition-all duration-100"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Hardware Tuner Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => radioEngine.stepFrequency(-0.1)}
              className="px-2 py-1 border-2 border-[var(--lcd-fg)] text-[11px] font-bold cursor-pointer"
            >
              -0.1
            </button>
            <button
              type="button"
              onClick={() => radioEngine.togglePlayPause()}
              className={`flex-1 py-1 border-2 border-[var(--lcd-fg)] text-xs font-bold cursor-pointer ${
                power ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
              }`}
            >
              {power ? (language === 'id' ? 'JEDA' : 'PAUSE') : language === 'id' ? 'PUTAR' : 'PLAY'}
            </button>
            {radio.sessionActive && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  radioEngine.stopCompletely();
                }}
                className="px-2 py-1 border-2 border-[var(--lcd-fg)] text-[11px] font-bold cursor-pointer"
                title={language === 'id' ? 'Hentikan Penuh' : 'Stop Background'}
              >
                ■
              </button>
            )}
            <button
              type="button"
              onClick={() => radioEngine.stepFrequency(0.1)}
              className="px-2 py-1 border-2 border-[var(--lcd-fg)] text-[11px] font-bold cursor-pointer"
            >
              +0.1
            </button>
            <button
              type="button"
              onClick={() => radioEngine.scanNextPreset()}
              className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[11px] font-bold cursor-pointer"
            >
              SCAN
            </button>
            <button
              type="button"
              onClick={() => toggleFavorite(activeStation)}
              className="px-2 py-1 border-2 border-[var(--lcd-fg)] text-xs font-bold cursor-pointer"
              title="Favorit"
            >
              {isFavorite(activeStation.id) ? '★' : '☆'}
            </button>
          </div>

          {/* Quick Presets List */}
          <div className="flex items-center justify-between text-[10px] font-bold uppercase opacity-75 shrink-0">
            <span>{language === 'id' ? 'Saluran FM & Dunia Pilihan' : 'Featured FM & World Presets'}</span>
            <span>{language === 'id' ? 'Tetap Aktif di Latar' : 'Runs in Background'}</span>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll space-y-1 min-h-0">
            {FM_PRESETS.map((s) => renderStationRow(s))}
          </div>
        </div>
      )}

      {/* TAB 2: INDONESIA & GLOBAL WORLD RADIO */}
      {tab === 'world' && (
        <div className="flex-1 flex flex-col p-2 gap-1.5 min-h-0">
          <div className="flex items-center gap-1 overflow-x-auto lcd-scroll pb-1 shrink-0">
            {WORLD_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  void loadWorldFilter(f);
                }}
                className={`px-2 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold whitespace-nowrap cursor-pointer ${
                  selectedFilterId === f.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] opacity-80 shrink-0">
            <span>
              {worldLoading
                ? language === 'id'
                  ? 'Memuat stasiun...'
                  : 'Loading stations...'
                : `${worldStations.length} ${language === 'id' ? 'stasiun ditemukan' : 'stations'}`}
            </span>
            {worldProvider && <span className="uppercase font-bold">{worldProvider}</span>}
          </div>

          <div className="flex-1 overflow-y-auto lcd-scroll space-y-1 min-h-0">
            {!worldLoading && worldStations.length === 0 ? (
              <div className="border border-dashed border-[var(--lcd-fg)] p-3 text-center text-xs">
                {language === 'id'
                  ? 'Tidak ada stasiun yang dimuat. Pastikan WiFi OS aktif atau pilih kota/genre lain.'
                  : 'No stations loaded. Check OS WiFi or pick another city/genre.'}
              </div>
            ) : (
              worldStations.map((st) => renderStationRow(st))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL SEARCH */}
      {tab === 'search' && (
        <div className="flex-1 flex flex-col p-2 gap-1.5 min-h-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(searchInput);
            }}
            className="flex gap-1 shrink-0"
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={language === 'id' ? 'Cari Prambors, Gen FM, Tokyo...' : 'Search radio stations...'}
              className="flex-1 min-w-0 px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold outline-none"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-2.5 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
            >
              {searching ? '...' : language === 'id' ? 'Cari' : 'Go'}
            </button>
          </form>

          <div className="flex items-center gap-1 overflow-x-auto lcd-scroll pb-1 shrink-0">
            {['Prambors', 'RRI', 'Delta FM', 'City Pop', 'Lo-Fi', 'BBC'].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setSearchInput(q);
                  void runSearch(q);
                }}
                className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold whitespace-nowrap cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto lcd-scroll space-y-1 min-h-0">
            {searching ? (
              <div className="border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-3 text-center text-xs font-bold">
                {language === 'id' ? 'Mencari di Radio Garden & Radio Browser...' : 'Searching directories...'}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="border border-dashed border-[var(--lcd-fg)] p-3 text-center text-xs">
                {language === 'id'
                  ? 'Ketik nama stasiun, kota, atau genre radio dunia lalu tekan Cari.'
                  : 'Enter any station name, city, or genre worldwide.'}
              </div>
            ) : (
              searchResults.map((st) => renderStationRow(st))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FAVORITES, RECENTS & SLEEP TIMER */}
      {tab === 'fav' && (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-2 min-h-0">
          {/* Sleep Timer */}
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span>{language === 'id' ? 'Timer Tidur Radio' : 'Radio Sleep Timer'}</span>
              <span>{sleepMinutesLeft > 0 ? `${sleepMinutesLeft} mnt` : 'OFF'}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              {[0, 15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('click');
                    radioEngine.setSleepMinutes(m);
                  }}
                  className={`py-1 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                    sleepMinutesLeft === m ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {m === 0 ? 'OFF' : `${m}m`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase mb-1">
              {language === 'id' ? `Favorit Tersimpan (${favorites.length})` : `Favorites (${favorites.length})`}
            </div>
            {favorites.length === 0 ? (
              <div className="border border-dashed border-[var(--lcd-fg)] p-2 text-center text-xs">
                {language === 'id' ? 'Tekan ☆ pada stasiun mana pun untuk menyimpan.' : 'Tap ☆ on any station to save.'}
              </div>
            ) : (
              <div className="space-y-1">{favorites.map((st) => renderStationRow(st))}</div>
            )}
          </div>

          {recents.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase mb-1">
                {language === 'id' ? 'Terakhir Diputar' : 'Recently Played'}
              </div>
              <div className="space-y-1">{recents.map((st) => renderStationRow(st))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
