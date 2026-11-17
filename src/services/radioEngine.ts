'use client';

import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { OSRadioStation } from '@/src/types/os';

export interface WorldDirectoryFilter {
  id: string;
  label: string;
  kind: 'place' | 'country' | 'tag';
  value: string;
  cityFallback?: string;
}

export const FM_PRESETS: OSRadioStation[] = [
  {
    id: 'rg-NZYf7QsQ',
    source: 'rg',
    rgId: 'NZYf7QsQ',
    freq: 102.2,
    name: 'Prambors FM 102.2 Jakarta',
    city: 'Jakarta',
    country: 'Indonesia',
    genre: 'Hits / Pop Indonesia',
    secure: true,
  },
  {
    id: 'rg-8VwmM71h',
    source: 'rg',
    rgId: '8VwmM71h',
    freq: 103.4,
    name: '103.4 DFM Jakarta',
    city: 'Jakarta',
    country: 'Indonesia',
    genre: 'Dangdut / Pop Lokal',
    secure: true,
  },
  {
    id: 'preset-groovesalad',
    source: 'rb',
    freq: 88.5,
    name: 'Groove Salad (SomaFM)',
    city: 'San Francisco',
    country: 'USA',
    genre: 'Ambient / Chillout',
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    secure: true,
    bitrate: 128,
  },
  {
    id: 'preset-lush',
    source: 'rb',
    freq: 94.2,
    name: 'Lush Electronic (SomaFM)',
    city: 'San Francisco',
    country: 'USA',
    genre: 'Dreamy Electronic',
    streamUrl: 'https://ice1.somafm.com/lush-128-mp3',
    secure: true,
    bitrate: 128,
  },
  {
    id: 'preset-beatblender',
    source: 'rb',
    freq: 101.4,
    name: 'Beat Blender (SomaFM)',
    city: 'San Francisco',
    country: 'USA',
    genre: 'Downtempo / Lo-Fi',
    streamUrl: 'https://ice1.somafm.com/beatblender-128-mp3',
    secure: true,
    bitrate: 128,
  },
  {
    id: 'preset-synthwave',
    source: 'rb',
    freq: 98.7,
    name: 'DEF CON Radio (SomaFM)',
    city: 'Las Vegas',
    country: 'USA',
    genre: 'Cyberpunk / Synth',
    streamUrl: 'https://ice1.somafm.com/defcon-128-mp3',
    secure: true,
    bitrate: 128,
  },
  {
    id: 'synth-pixel-8bit',
    source: 'synth',
    freq: 104.8,
    name: 'Pixel Synth 8-Bit FM',
    city: 'Retro OS',
    country: 'Offline Band',
    genre: 'Chiptune Live Synth',
    secure: true,
    notes: [523, 659, 784, 1046, 784, 659],
  },
];

export const WORLD_FILTERS: WorldDirectoryFilter[] = [
  { id: 'id-all', label: 'Indonesia', kind: 'country', value: 'ID' },
  { id: 'rg-jkt', label: 'Jakarta', kind: 'place', value: 'q2gXIuHJ', cityFallback: 'Jakarta' },
  { id: 'rg-bdg', label: 'Bandung', kind: 'place', value: '1lHyt385', cityFallback: 'Bandung' },
  { id: 'rg-jog', label: 'Jogja', kind: 'place', value: 'fKzWcPGC', cityFallback: 'Yogyakarta' },
  { id: 'rg-sby', label: 'Surabaya', kind: 'place', value: 'GFwVR16x', cityFallback: 'Surabaya' },
  { id: 'rg-tyo', label: 'Tokyo', kind: 'place', value: 'eR8K4rBb', cityFallback: 'Tokyo' },
  { id: 'rg-lon', label: 'London', kind: 'place', value: '0eZoYyEW', cityFallback: 'London' },
  { id: 'rg-sel', label: 'Seoul', kind: 'place', value: 'kxEs9l2m', cityFallback: 'Seoul' },
  { id: 'tag-lofi', label: 'Lo-Fi', kind: 'tag', value: 'lofi' },
  { id: 'tag-jazz', label: 'Jazz', kind: 'tag', value: 'jazz' },
  { id: 'tag-rock', label: 'Rock', kind: 'tag', value: 'rock' },
  { id: 'tag-anime', label: 'Anime', kind: 'tag', value: 'anime' },
];

export const RADIO_FAVORITES_KEY = 'rpos_radio_favorites_v1';
export const RADIO_RECENT_KEY = 'rpos_radio_recent_v1';

export function readStoredRadioStations(key: string): OSRadioStation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OSRadioStation[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredRadioStations(key: string, items: OSRadioStation[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, 30)));
  } catch {
    // ignore storage quota errors
  }
}

class PersistentRadioEngine {
  private audio: HTMLAudioElement | null = null;
  private resolvedStreamCache = new Map<string, string>();
  private playNonce = 0;
  private sleepTimerId: ReturnType<typeof setInterval> | null = null;
  private storeSubscribed = false;
  private ignoreNextPauseOrError = false;

  private ensureSubscribed() {
    if (this.storeSubscribed || typeof window === 'undefined') return;
    this.storeSubscribed = true;

    let lastVol = useOSStore.getState().volume;
    let lastWifi = useOSStore.getState().wifiEnabled;

    useOSStore.subscribe((state) => {
      if (state.volume !== lastVol) {
        lastVol = state.volume;
        if (this.audio) {
          this.audio.volume = state.volume;
        }
      }
      if (state.wifiEnabled !== lastWifi) {
        lastWifi = state.wifiEnabled;
        if (!state.wifiEnabled && state.radio.power && state.radio.activeStation.source !== 'synth') {
          this.pausePlayback();
        }
      }
    });
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    this.ensureSubscribed();

    if (!this.audio) {
      const el = new Audio();
      el.preload = 'none';

      el.addEventListener('playing', () => {
        const { radio, setRadioState } = useOSStore.getState();
        if (radio.power) {
          setRadioState({ status: 'live', errorNote: null });
        }
      });

      el.addEventListener('waiting', () => {
        const { radio, setRadioState } = useOSStore.getState();
        if (radio.power && !el.paused) {
          setRadioState({ status: 'connecting' });
        }
      });

      el.addEventListener('error', () => {
        if (this.ignoreNextPauseOrError) {
          this.ignoreNextPauseOrError = false;
          return;
        }
        const { radio, language, setRadioState } = useOSStore.getState();
        if (!radio.power || !el.getAttribute('src')) return;
        setRadioState({
          power: false,
          status: 'error',
          errorNote:
            language === 'id'
              ? 'Stream stasiun ini tidak merespons. Coba stasiun lain atau tekan Scan.'
              : 'Stream unreachable. Try another station or Scan.',
        });
      });

      this.audio = el;
    }

    return this.audio;
  }

  private recordRecent(station: OSRadioStation) {
    if (station.id.startsWith('static-')) return;
    const prev = readStoredRadioStations(RADIO_RECENT_KEY);
    const next = [station, ...prev.filter((s) => s.id !== station.id)].slice(0, 12);
    writeStoredRadioStations(RADIO_RECENT_KEY, next);
  }

  public async playStation(station: OSRadioStation) {
    this.ensureSubscribed();
    const audio = this.ensureAudio();
    const store = useOSStore.getState();
    const { language, volume, wifiEnabled, setRadioState } = store;

    const nonce = ++this.playNonce;
    this.recordRecent(station);

    setRadioState({
      sessionActive: true,
      power: true,
      activeStation: station,
      freq: station.freq ?? store.radio.freq,
      errorNote: null,
    });

    // 1. Offline 8-bit synth band
    if (station.source === 'synth') {
      if (audio) {
        this.ignoreNextPauseOrError = true;
        audio.pause();
        audio.removeAttribute('src');
      }
      setRadioState({ status: 'synth' });
      soundEngine.startChiptuneLoop(station.notes || [523, 659, 784, 1046], station.id.startsWith('static-') ? 75 : 230);
      return;
    }

    // 2. Network check
    if (!wifiEnabled || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      if (audio) {
        this.ignoreNextPauseOrError = true;
        audio.pause();
      }
      soundEngine.startChiptuneLoop([220, 195, 240, 180], 95);
      setRadioState({
        status: 'error',
        power: false,
        errorNote: language === 'id' ? 'WiFi OS mati — aktifkan WiFi atau pilih 8-Bit Offline.' : 'OS WiFi is disabled.',
      });
      return;
    }

    soundEngine.stopChiptuneLoop();
    setRadioState({ status: 'connecting' });

    let resolvedUrl = station.streamUrl || '';
    if (station.source === 'rg' && station.rgId) {
      const cached = this.resolvedStreamCache.get(station.rgId);
      if (cached) {
        resolvedUrl = cached;
      } else {
        try {
          const resp = await fetch(`/api/radio/stream?id=${encodeURIComponent(station.rgId)}`);
          const data = (await resp.json()) as { streamUrl?: string; error?: string };
          if (nonce !== this.playNonce) return;
          if (!resp.ok || !data.streamUrl) {
            throw new Error(data.error || 'Stream resolve failed');
          }
          resolvedUrl = data.streamUrl;
          this.resolvedStreamCache.set(station.rgId, resolvedUrl);
        } catch {
          if (nonce !== this.playNonce) return;
          setRadioState({
            power: false,
            status: 'error',
            errorNote:
              language === 'id'
                ? 'Radio Garden sedang membatasi koneksi. Coba stasiun Radio Browser di tab Dunia!'
                : 'Radio Garden unavailable. Try a station in World tab.',
          });
          return;
        }
      }
    }

    if (nonce !== this.playNonce) return;

    if (!resolvedUrl) {
      setRadioState({
        power: false,
        status: 'error',
        errorNote: language === 'id' ? 'URL stream kosong' : 'Empty stream URL',
      });
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      resolvedUrl.startsWith('http://')
    ) {
      setRadioState({
        power: false,
        status: 'error',
        errorNote:
          language === 'id'
            ? 'Stream ini memakai HTTP non-terenkripsi (diblokir HTTPS). Pilih stasiun lain.'
            : 'Stream uses insecure HTTP blocked on HTTPS sites.',
      });
      return;
    }

    if (!audio) return;

    try {
      this.ignoreNextPauseOrError = true;
      audio.pause();
      this.ignoreNextPauseOrError = false;
      audio.src = resolvedUrl;
      audio.volume = volume;
      await audio.play();
      if (nonce === this.playNonce) {
        setRadioState({ status: 'live', power: true, errorNote: null });
      }
    } catch {
      if (nonce !== this.playNonce) return;
      setRadioState({
        power: false,
        status: 'error',
        errorNote:
          language === 'id'
            ? 'Gagal memutar stream ini. Coba stasiun lain atau klik Scan.'
            : 'Playback failed. Try another station or Scan.',
      });
    }
  }

  public pausePlayback() {
    this.playNonce++;
    if (this.audio) {
      this.ignoreNextPauseOrError = true;
      this.audio.pause();
      this.audio.removeAttribute('src');
    }
    soundEngine.stopChiptuneLoop();
    const { radio, setRadioState } = useOSStore.getState();
    if (radio.sessionActive) {
      setRadioState({ power: false, status: 'paused', errorNote: null });
    }
  }

  public stopCompletely() {
    this.playNonce++;
    if (this.audio) {
      this.ignoreNextPauseOrError = true;
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    soundEngine.stopChiptuneLoop();
    if (this.sleepTimerId) {
      clearInterval(this.sleepTimerId);
      this.sleepTimerId = null;
    }
    useOSStore.getState().setRadioState({
      sessionActive: false,
      power: false,
      status: 'idle',
      sleepMinutesLeft: 0,
      errorNote: null,
    });
  }

  public pauseForCompetingMedia() {
    const { radio, language, showToast } = useOSStore.getState();
    if (!radio.power && radio.status !== 'connecting') return;
    this.pausePlayback();
    showToast(
      language === 'id' ? 'Radio dijeda otomatis untuk pemutaran media' : 'Radio paused for active media',
    );
  }

  public togglePlayPause() {
    soundEngine.playCue('click');
    const { radio } = useOSStore.getState();
    if (radio.power) {
      this.pausePlayback();
    } else {
      void this.playStation(radio.activeStation);
    }
  }

  public scanNextPreset() {
    soundEngine.playCue('click');
    const { radio } = useOSStore.getState();
    const sorted = [...FM_PRESETS].sort((a, b) => (a.freq || 0) - (b.freq || 0));
    const next = sorted.find((s) => (s.freq || 0) > radio.freq + 0.05) || sorted[0];
    void this.playStation(next);
  }

  public stepFrequency(delta: number) {
    soundEngine.playCue('click');
    const { radio, language, setRadioState } = useOSStore.getState();
    const nextFreq = Math.max(87.5, Math.min(108.0, Number((radio.freq + delta).toFixed(1))));
    const matched = FM_PRESETS.find((s) => s.freq && Math.abs(s.freq - nextFreq) < 0.15);

    if (matched) {
      void this.playStation(matched);
      return;
    }

    if (radio.power) {
      void this.playStation({
        id: `static-${nextFreq}`,
        source: 'synth',
        freq: nextFreq,
        name: language === 'id' ? `Frekuensi Bebas (${nextFreq} MHz)` : `Open Band (${nextFreq} MHz)`,
        city: 'FM Dial',
        country: 'Static',
        genre: 'Analog Static',
        secure: true,
        notes: [155, 195, 140, 210],
      });
    } else {
      setRadioState({ freq: nextFreq });
    }
  }

  public setSleepMinutes(minutes: number) {
    if (this.sleepTimerId) {
      clearInterval(this.sleepTimerId);
      this.sleepTimerId = null;
    }

    const { language, setRadioState, showToast } = useOSStore.getState();
    setRadioState({ sleepMinutesLeft: minutes });

    showToast(
      minutes === 0
        ? language === 'id'
          ? 'Timer tidur nonaktif'
          : 'Sleep timer off'
        : language === 'id'
          ? `Radio mati otomatis dalam ${minutes} mnt`
          : `Radio off in ${minutes}m`,
    );

    if (minutes > 0) {
      this.sleepTimerId = setInterval(() => {
        const cur = useOSStore.getState();
        if (!cur.radio.power) return;
        const nextLeft = cur.radio.sleepMinutesLeft - 1;
        if (nextLeft <= 0) {
          this.stopCompletely();
          cur.showToast(
            cur.language === 'id' ? 'Timer tidur: Radio dimatikan' : 'Sleep timer: Radio stopped',
          );
        } else {
          cur.setRadioState({ sleepMinutesLeft: nextLeft });
        }
      }, 60_000);
    }
  }
}

export const radioEngine = new PersistentRadioEngine();
