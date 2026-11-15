'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps } from '@/src/types/os';

export type NokiaDuration = 1 | 2 | 4 | 8 | 16 | 32;
export type NokiaPitch = 'c' | 'd' | 'e' | 'f' | 'g' | 'a' | 'b' | '-';
export type NokiaOctave = 1 | 2 | 3;

export interface NokiaNoteToken {
  duration: NokiaDuration;
  dotted?: boolean;
  sharp?: boolean;
  pitch: NokiaPitch;
  octave: NokiaOctave;
}

interface StudioComposition {
  id: string;
  name: string;
  bpm: number;
  wave: OscillatorType;
  notation: string;
}

const DURATIONS: NokiaDuration[] = [1, 2, 4, 8, 16, 32];

const PRESETS: StudioComposition[] = [
  {
    id: 'nokia-tune',
    name: 'Nokia Klasik (Gran Vals)',
    bpm: 180,
    wave: 'square',
    notation: '8e2 8d2 4#f1 4#g1 8#c2 8b1 4d1 4e1 8b1 8a1 4#c1 4e1 2a1',
  },
  {
    id: 'nokia-kick',
    name: 'Kick 3310',
    bpm: 160,
    wave: 'square',
    notation: '8d1 8f1 4g1 8g1 8a1 4#a1 8a1 8g1 4f1 8d1 8f1 2g1',
  },
  {
    id: 'attraction',
    name: 'Attraction',
    bpm: 150,
    wave: 'triangle',
    notation: '8g1 8b1 8d2 8g2 8d2 8b1 4g1 8a1 8#c2 8e2 4a2 4d2',
  },
  {
    id: 'sms-beep',
    name: 'SMS Bip Klasik',
    bpm: 160,
    wave: 'square',
    notation: '16e3 16- 16e3 8- 16e3 16- 16e3 4-',
  },
  {
    id: 'fanfare',
    name: 'Fanfare 8-Bit',
    bpm: 170,
    wave: 'sawtooth',
    notation: '8c2 8e2 8g2 4c3 8g2 2c3',
  },
];

const SAVED_COMPOSITIONS_KEY = 'rpos_audio_studio_compositions_v1';
const CUSTOM_RINGTONE_KEY = 'rpos_custom_ringtone';

const SEMITONE_OFFSET: Record<Exclude<NokiaPitch, '-'>, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

const STAFF_ROW_MAP: Record<Exclude<NokiaPitch, '-'>, number> = {
  c: 0,
  d: 1,
  e: 2,
  f: 3,
  g: 4,
  a: 5,
  b: 6,
};

export function tokenToFrequency(token: NokiaNoteToken): number {
  if (token.pitch === '-') return 0;
  // Octave 1 starts at C4 (MIDI 60) -> classic Nokia piezo range C4..B6
  const midi = 60 + (token.octave - 1) * 12 + SEMITONE_OFFSET[token.pitch] + (token.sharp ? 1 : 0);
  return Math.round(440 * Math.pow(2, (midi - 69) / 12));
}

export function tokenToDurationMs(token: NokiaNoteToken, bpm: number): number {
  const wholeMs = (60000 / Math.max(40, bpm)) * 4;
  const base = wholeMs / token.duration;
  return Math.round(token.dotted ? base * 1.5 : base);
}

export function formatToken(t: NokiaNoteToken): string {
  const dot = t.dotted ? '.' : '';
  const sharp = t.pitch !== '-' && t.sharp ? '#' : '';
  const oct = t.pitch === '-' ? '' : String(t.octave);
  return `${t.duration}${dot}${sharp}${t.pitch}${oct}`;
}

export function parseNokiaNotation(input: string): NokiaNoteToken[] {
  const parts = input
    .trim()
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);

  const parsed: NokiaNoteToken[] = [];
  const regex = /^(1|2|4|8|16|32)(\.?)(#?)([a-g-])([1-3]?)$/;

  for (const part of parts) {
    const m = part.match(regex);
    if (!m) continue;
    const dur = Number(m[1]) as NokiaDuration;
    const dotted = m[2] === '.';
    const sharp = m[3] === '#';
    const pitch = m[4] as NokiaPitch;
    const oct = (m[5] ? Number(m[5]) : 2) as NokiaOctave;
    parsed.push({
      duration: dur,
      dotted,
      sharp: pitch === '-' || pitch === 'e' || pitch === 'b' ? false : sharp,
      pitch,
      octave: oct,
    });
  }
  return parsed;
}

function synthesizeWavDataUrl(
  tokens: NokiaNoteToken[],
  bpm: number,
  wave: OscillatorType
): { dataUrl: string; sizeKb: number } {
  const sampleRate = 22050;
  const steps = tokens.map((tok) => ({
    freq: tokenToFrequency(tok),
    samples: Math.max(1, Math.floor((tokenToDurationMs(tok, bpm) / 1000) * sampleRate)),
  }));
  const totalSamples = steps.reduce((acc, s) => acc + s.samples, 0);
  const dataBytes = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let sampleOffset = 44;
  for (const step of steps) {
    const activeSamples = Math.floor(step.samples * 0.88);
    for (let i = 0; i < step.samples; i++) {
      let amp = 0;
      if (step.freq > 0 && i < activeSamples) {
        const phase = ((i / sampleRate) * step.freq) % 1;
        let raw = 0;
        if (wave === 'square') {
          raw = phase < 0.5 ? 1 : -1;
        } else if (wave === 'sawtooth') {
          raw = 2 * phase - 1;
        } else if (wave === 'triangle') {
          raw = 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
        } else {
          raw = Math.sin(phase * 2 * Math.PI);
        }
        // Quick envelope fade out to prevent clicks
        const fadeOut = i > activeSamples - 120 ? (activeSamples - i) / 120 : 1;
        amp = raw * 0.35 * fadeOut;
      }
      const pcm = Math.max(-32768, Math.min(32767, Math.floor(amp * 32767)));
      view.setInt16(sampleOffset, pcm, true);
      sampleOffset += 2;
    }
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);
  const dataUrl = `data:audio/wav;base64,${base64}`;
  const sizeKb = Math.max(1, Math.round(bytes.length / 1024));
  return { dataUrl, sizeKb };
}

function loadSavedCompositions(): StudioComposition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_COMPOSITIONS_KEY);
    return raw ? (JSON.parse(raw) as StudioComposition[]) : [];
  } catch {
    return [];
  }
}

export const AudioStudioApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [tab, setTab] = useState<'compose' | 'presets' | 'import'>('compose');
  const [inputMode, setInputMode] = useState<'keypad' | 'piano'>('keypad');

  const [title, setTitle] = useState('Nokia Klasik');
  const [bpm, setBpm] = useState(180);
  const [wave, setWave] = useState<OscillatorType>('square');
  const [tokens, setTokens] = useState<NokiaNoteToken[]>(() => parseNokiaNotation(PRESETS[0].notation));

  const [curDuration, setCurDuration] = useState<NokiaDuration>(8);
  const [curOctave, setCurOctave] = useState<NokiaOctave>(2);
  const [curDotted, setCurDotted] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState<number | null>(null);
  const [selectedNoteIdx, setSelectedNoteIdx] = useState<number | null>(null);

  const [savedSongs, setSavedSongs] = useState<StudioComposition[]>(loadSavedCompositions);
  const [importText, setImportText] = useState(PRESETS[0].notation);

  const stopPlaybackRef = useRef<(() => void) | null>(null);

  const stopPlayback = useCallback(() => {
    if (stopPlaybackRef.current) {
      stopPlaybackRef.current();
      stopPlaybackRef.current = null;
    }
    setPlaying(false);
    setPlayIndex(null);
  }, []);

  useEffect(() => {
    return () => {
      if (stopPlaybackRef.current) {
        stopPlaybackRef.current();
        stopPlaybackRef.current = null;
      }
    };
  }, []);

  const previewSingleNote = useCallback(
    (tok: NokiaNoteToken) => {
      const freq = tokenToFrequency(tok);
      if (freq > 0) {
        soundEngine.playTone(freq, Math.min(260, tokenToDurationMs(tok, bpm)), wave, 0.16);
      } else {
        soundEngine.playCue('click');
      }
    },
    [bpm, wave]
  );

  const appendNote = useCallback(
    (pitch: NokiaPitch, sharp = false) => {
      const token: NokiaNoteToken = {
        duration: curDuration,
        dotted: curDotted,
        sharp: pitch === '-' || pitch === 'e' || pitch === 'b' ? false : sharp,
        pitch,
        octave: curOctave,
      };
      previewSingleNote(token);
      setTokens((prev) => [...prev, token]);
      setSelectedNoteIdx(null);
    },
    [curDotted, curDuration, curOctave, previewSingleNote]
  );

  const toggleSharpLast = useCallback(() => {
    setTokens((prev) => {
      if (prev.length === 0) return prev;
      const idx = selectedNoteIdx !== null && prev[selectedNoteIdx] ? selectedNoteIdx : prev.length - 1;
      const target = prev[idx];
      if (target.pitch === '-' || target.pitch === 'e' || target.pitch === 'b') {
        soundEngine.playCue('error');
        return prev;
      }
      const nextTok = { ...target, sharp: !target.sharp };
      previewSingleNote(nextTok);
      const next = [...prev];
      next[idx] = nextTok;
      return next;
    });
  }, [previewSingleNote, selectedNoteIdx]);

  const deleteLastOrSelected = useCallback(() => {
    soundEngine.playCue('back');
    setTokens((prev) => {
      if (prev.length === 0) return prev;
      if (selectedNoteIdx !== null && prev[selectedNoteIdx]) {
        const next = prev.filter((_, i) => i !== selectedNoteIdx);
        setSelectedNoteIdx(null);
        return next;
      }
      return prev.slice(0, -1);
    });
  }, [selectedNoteIdx]);

  const cycleDuration = useCallback((dir: 1 | -1) => {
    soundEngine.playCue('click');
    setCurDuration((d) => {
      const idx = DURATIONS.indexOf(d);
      const nextIdx = (idx + dir + DURATIONS.length) % DURATIONS.length;
      return DURATIONS[nextIdx];
    });
  }, []);

  const cycleOctave = useCallback(() => {
    soundEngine.playCue('click');
    setCurOctave((o) => (o === 1 ? 2 : o === 2 ? 3 : 1));
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      stopPlayback();
      return;
    }
    if (tokens.length === 0) {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Belum ada nada!' : 'No notes yet!');
      return;
    }
    const steps = tokens.map((tok) => ({
      freq: tokenToFrequency(tok),
      durationMs: tokenToDurationMs(tok, bpm),
    }));
    setPlaying(true);
    stopPlaybackRef.current = soundEngine.playNoteSequence(
      steps,
      wave,
      (idx) => setPlayIndex(idx),
      () => {
        setPlaying(false);
        setPlayIndex(null);
        stopPlaybackRef.current = null;
      }
    );
  }, [bpm, language, playing, showToast, stopPlayback, tokens, wave]);

  // Physical Keyboard Composer Shortcuts (1-7 notes, 8/9 duration, * octave, # sharp, Backspace, Space)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (tab !== 'compose') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;

      const keyMap: Record<string, NokiaPitch> = {
        '1': 'c',
        '2': 'd',
        '3': 'e',
        '4': 'f',
        '5': 'g',
        '6': 'a',
        '7': 'b',
        '0': '-',
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        appendNote(keyMap[e.key]);
      } else if (e.key === '8') {
        e.preventDefault();
        cycleDuration(1);
      } else if (e.key === '9') {
        e.preventDefault();
        cycleDuration(-1);
      } else if (e.key === '*') {
        e.preventDefault();
        cycleOctave();
      } else if (e.key === '#') {
        e.preventDefault();
        toggleSharpLast();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        deleteLastOrSelected();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appendNote, cycleDuration, cycleOctave, deleteLastOrSelected, tab, togglePlay, toggleSharpLast]);

  const notationString = useMemo(() => tokens.map(formatToken).join(' '), [tokens]);

  const saveToLibraryAndMusik = async (downloadWav = false) => {
    if (tokens.length === 0) {
      soundEngine.playCue('error');
      return;
    }
    soundEngine.playCue('select');
    const cleanName = title.trim() || 'Nada Nokia';
    const { dataUrl, sizeKb } = synthesizeWavDataUrl(tokens, bpm, wave);

    // 1. Save composition preset in Studio collection
    const newEntry: StudioComposition = {
      id: `comp-${Date.now()}`,
      name: cleanName,
      bpm,
      wave,
      notation: notationString,
    };
    const nextSaved = [newEntry, ...savedSongs.filter((s) => s.name !== cleanName)].slice(0, 20);
    setSavedSongs(nextSaved);
    window.localStorage.setItem(SAVED_COMPOSITIONS_KEY, JSON.stringify(nextSaved));

    // 2. Save real .WAV audio to Musik folder in IndexedDB (playable in MusicApp!)
    const safeFileName = `${cleanName.replace(/[^a-zA-Z0-9_-]+/g, '_')}.wav`;
    await db.files.add({
      folder: 'Musik',
      name: safeFileName,
      mimeType: 'audio/wav',
      sizeKb,
      content: dataUrl,
      createdAt: Date.now(),
    });

    if (downloadWav) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = safeFileName;
      a.click();
      showToast(language === 'id' ? `Diunduh & disimpan: ${safeFileName}` : `Downloaded & saved: ${safeFileName}`);
    } else {
      showToast(
        language === 'id' ? `Disimpan ke Musik (${safeFileName})` : `Saved to Music (${safeFileName})`
      );
    }
  };

  const setAsRingtone = () => {
    if (tokens.length === 0) return;
    soundEngine.playCue('notify');
    window.localStorage.setItem(
      CUSTOM_RINGTONE_KEY,
      JSON.stringify({ name: title.trim() || 'Nada Nokia', bpm, wave, notation: notationString })
    );
    showToast(
      language === 'id' ? `Nada dering aktif: ${title || 'Nada Nokia'}` : `Active ringtone: ${title || 'Nokia'}`
    );
  };

  const loadPreset = (comp: StudioComposition) => {
    stopPlayback();
    soundEngine.playCue('open');
    setTitle(comp.name);
    setBpm(comp.bpm);
    setWave(comp.wave);
    setTokens(parseNokiaNotation(comp.notation));
    setSelectedNoteIdx(null);
    setTab('compose');
    showToast(comp.name);
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: playing ? 'STOP' : language === 'id' ? 'PUTAR' : 'PLAY',
      centerLabel: language === 'id' ? 'SIMPAN' : 'SAVE',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: togglePlay,
      onCenter: () => void saveToLibraryAndMusik(false),
      onRight: () => {
        stopPlayback();
        onBack();
      },
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Studio Audio Nokia' : 'Nokia Audio Studio'} showChevrons={false} />

      {/* Top Tabs */}
      <div className="grid grid-cols-3 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold shrink-0">
        {[
          { id: 'compose', label: language === 'id' ? 'Komposer' : 'Composer' },
          { id: 'presets', label: language === 'id' ? 'Koleksi' : 'Library' },
          { id: 'import', label: 'Impor/WAV' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              setTab(item.id as 'compose' | 'presets' | 'import');
            }}
            className={`py-1 border-r last:border-r-0 border-[var(--lcd-fg)] cursor-pointer ${
              tab === item.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* TAB 1: NOKIA COMPOSER WORKSPACE */}
      {tab === 'compose' && (
        <div className="flex-1 flex flex-col p-1.5 justify-between gap-1.5 min-h-0">
          {/* Song Title + BPM + Wave Strip */}
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={22}
              className="flex-1 min-w-0 bg-[var(--lcd-bg)] border-2 border-[var(--lcd-fg)] px-1.5 py-0.5 text-[11px] font-bold outline-none"
              placeholder="Judul nada..."
            />
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                setBpm((b) => (b >= 220 ? 80 : b + 20));
              }}
              className="px-1.5 py-0.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer tabular-nums shrink-0"
              title="Ubah Tempo (BPM)"
            >
              {bpm}BPM
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                const order: OscillatorType[] = ['square', 'triangle', 'sawtooth', 'sine'];
                setWave(order[(order.indexOf(wave) + 1) % order.length]);
              }}
              className="px-1.5 py-0.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold uppercase cursor-pointer shrink-0"
              title="Ubah Gelombang Synth"
            >
              {wave.slice(0, 3)}
            </button>
          </div>

          {/* Nokia 5-Line Musical Staff LCD Display */}
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-1.5 flex flex-col gap-1 shrink-0">
            <div className="relative h-14 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] overflow-x-auto lcd-scroll flex items-center px-1.5 gap-1">
              {/* 5 horizontal staff lines */}
              <div className="absolute inset-x-0 top-2.5 border-t border-[var(--lcd-fg)]/25 pointer-events-none" />
              <div className="absolute inset-x-0 top-4.5 border-t border-[var(--lcd-fg)]/25 pointer-events-none" />
              <div className="absolute inset-x-0 top-6.5 border-t border-[var(--lcd-fg)]/25 pointer-events-none" />
              <div className="absolute inset-x-0 top-8.5 border-t border-[var(--lcd-fg)]/25 pointer-events-none" />
              <div className="absolute inset-x-0 top-10.5 border-t border-[var(--lcd-fg)]/25 pointer-events-none" />

              {tokens.length === 0 ? (
                <span className="text-[10px] opacity-70 px-1 relative z-10">
                  {language === 'id' ? 'Tekan 1-7 untuk menulis nada...' : 'Press 1-7 to compose notes...'}
                </span>
              ) : (
                tokens.map((tok, idx) => {
                  const isActive = playIndex === idx || selectedNoteIdx === idx;
                  const rowHeight = tok.pitch === '-' ? 3 : STAFF_ROW_MAP[tok.pitch];
                  const topOffsetPx = Math.max(2, 34 - rowHeight * 4 - (tok.octave - 1) * 4);
                  return (
                    <button
                      key={`${idx}-${formatToken(tok)}`}
                      type="button"
                      onClick={() => {
                        setSelectedNoteIdx(idx === selectedNoteIdx ? null : idx);
                        previewSingleNote(tok);
                      }}
                      className={`relative z-10 px-1 h-12 min-w-[26px] flex flex-col justify-end items-center cursor-pointer border ${
                        isActive
                          ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)] border-[var(--lcd-fg)]'
                          : 'border-transparent hover:border-[var(--lcd-fg)]/40'
                      }`}
                    >
                      <span
                        className="absolute w-2.5 h-2 bg-current"
                        style={{ top: `${topOffsetPx}px` }}
                      />
                      <span className="text-[9px] font-bold leading-none tabular-nums">
                        {formatToken(tok)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Active Note Setting + Play/Clear Row */}
            <div className="flex items-center justify-between text-[10px] font-bold tabular-nums">
              <div className="flex items-center gap-1">
                <span>1/{curDuration}{curDotted ? '.' : ''}</span>
                <span>·</span>
                <span>Okt {curOctave}</span>
                <span>·</span>
                <span>{tokens.length} nada</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setInputMode((m) => (m === 'keypad' ? 'piano' : 'keypad'))}
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer"
                >
                  {inputMode === 'keypad' ? 'PIANO' : 'KEYPAD'}
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] cursor-pointer"
                >
                  {playing ? '■ STOP' : '▶ PUTAR'}
                </button>
              </div>
            </div>
          </div>

          {/* Input Deck: Classic Nokia 1-9*0# Keypad OR Visual Piano */}
          {inputMode === 'keypad' ? (
            <div className="flex-1 grid grid-cols-3 gap-1 min-h-0">
              {[
                { key: '1', sub: 'C (do)', onClick: () => appendNote('c') },
                { key: '2', sub: 'D (re)', onClick: () => appendNote('d') },
                { key: '3', sub: 'E (mi)', onClick: () => appendNote('e') },
                { key: '4', sub: 'F (fa)', onClick: () => appendNote('f') },
                { key: '5', sub: 'G (sol)', onClick: () => appendNote('g') },
                { key: '6', sub: 'A (la)', onClick: () => appendNote('a') },
                { key: '7', sub: 'B (si)', onClick: () => appendNote('b') },
                { key: '8', sub: `Dur - (1/${curDuration})`, onClick: () => cycleDuration(1) },
                { key: '9', sub: 'Dur +', onClick: () => cycleDuration(-1) },
                { key: '*', sub: `Oktaf (${curOctave})`, onClick: cycleOctave },
                { key: '0', sub: 'Jeda (-)', onClick: () => appendNote('-') },
                { key: '#', sub: 'Kres (#)', onClick: toggleSharpLast },
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={btn.onClick}
                  className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] flex flex-col items-center justify-center py-0.5 cursor-pointer"
                >
                  <span className="text-xs font-bold leading-none">{btn.key}</span>
                  <span className="text-[9px] opacity-85 leading-none mt-0.5">{btn.sub}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-1 min-h-0">
              {/* Piano Sharp Row */}
              <div className="grid grid-cols-7 gap-1">
                {(['c', 'd', null, 'f', 'g', 'a', null] as const).map((p, i) =>
                  p ? (
                    <button
                      key={`sharp-${p}`}
                      type="button"
                      onClick={() => appendNote(p, true)}
                      className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                    >
                      #{p.toUpperCase()}
                    </button>
                  ) : (
                    <div key={`gap-${i}`} />
                  )
                )}
              </div>
              {/* Piano Natural Row */}
              <div className="flex-1 grid grid-cols-7 gap-1 min-h-0">
                {(['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => appendNote(p, false)}
                    className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-sec)] flex flex-col items-center justify-end pb-1.5 text-xs font-bold cursor-pointer"
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => cycleDuration(1)}
                  className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
                >
                  1/{curDuration}
                </button>
                <button
                  type="button"
                  onClick={cycleOctave}
                  className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
                >
                  OKT {curOctave}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('click');
                    setCurDotted((d) => !d);
                  }}
                  className={`py-1 border-2 border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                    curDotted ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  TITIK (.)
                </button>
              </div>
            </div>
          )}

          {/* Bottom Utility Bar: Delete, Clear, Export */}
          <div className="grid grid-cols-3 gap-1 shrink-0">
            <button
              type="button"
              onClick={deleteLastOrSelected}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
            >
              ⌫ HAPUS
            </button>
            <button
              type="button"
              onClick={() => {
                stopPlayback();
                soundEngine.playCue('back');
                setTokens([]);
                setSelectedNoteIdx(null);
              }}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              KOSONGKAN
            </button>
            <button
              type="button"
              onClick={() => void saveToLibraryAndMusik(true)}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              ↓ .WAV
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PRESETS & SAVED RINGTONES */}
      {tab === 'presets' && (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-2">
          <div className="text-[10px] font-bold opacity-80">
            {language === 'id' ? 'NADA BAWAAN NOKIA KLASIK' : 'CLASSIC NOKIA PRESETS'}
          </div>
          {PRESETS.map((p) => (
            <div
              key={p.id}
              className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{p.name}</div>
                <div className="text-[10px] opacity-80 tabular-nums">
                  {p.bpm} BPM · {p.wave}
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadPreset(p)}
                className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer shrink-0"
              >
                BUKA
              </button>
            </div>
          ))}

          <div className="text-[10px] font-bold opacity-80 pt-1">
            {language === 'id' ? `KARYA TERSIMPAN (${savedSongs.length})` : `SAVED SONGS (${savedSongs.length})`}
          </div>
          {savedSongs.length === 0 ? (
            <div className="border-2 border-[var(--lcd-fg)] p-3 text-center text-xs">
              {language === 'id'
                ? 'Belum ada nada tersimpan. Tekan SIMPAN di Komposer.'
                : 'No saved melodies yet. Tap SAVE in Composer.'}
            </div>
          ) : (
            savedSongs.map((s) => (
              <div
                key={s.id}
                className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{s.name}</div>
                  <div className="text-[10px] opacity-80 tabular-nums">
                    {s.bpm} BPM · {s.wave}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadPreset(s)}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = savedSongs.filter((item) => item.id !== s.id);
                      setSavedSongs(next);
                      window.localStorage.setItem(SAVED_COMPOSITIONS_KEY, JSON.stringify(next));
                      soundEngine.playCue('back');
                    }}
                    className="px-1.5 py-1 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: IMPORT NOTATION & WAV EXPORT / RINGTONE */}
      {tab === 'import' && (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2.5">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 space-y-1.5">
            <div className="text-xs font-bold">
              {language === 'id' ? 'Impor / Salin Notasi Nokia' : 'Import / Copy Nokia Notation'}
            </div>
            <textarea
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="8e2 8d2 4#f1 4#g1 ..."
              className="w-full bg-[var(--lcd-bg)] border-2 border-[var(--lcd-fg)] p-1.5 text-[11px] font-mono outline-none resize-none"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const parsed = parseNokiaNotation(importText);
                  if (parsed.length === 0) {
                    soundEngine.playCue('error');
                    showToast(language === 'id' ? 'Format notasi tidak valid' : 'Invalid notation');
                    return;
                  }
                  stopPlayback();
                  setTokens(parsed);
                  setTab('compose');
                  soundEngine.playCue('select');
                  showToast(`${parsed.length} nada dimuat`);
                }}
                className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
              >
                MUAT KE STAF
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportText(notationString);
                  navigator.clipboard?.writeText(notationString).catch(() => undefined);
                  soundEngine.playCue('click');
                  showToast(language === 'id' ? 'Notasi disalin!' : 'Notation copied!');
                }}
                className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
              >
                SALIN NOTASI
              </button>
            </div>
          </div>

          <div className="border-2 border-[var(--lcd-fg)] p-2 space-y-1.5">
            <div className="text-xs font-bold">
              {language === 'id' ? 'Ekspor Audio & Nada Dering' : 'Export Audio & Ringtone'}
            </div>
            <button
              type="button"
              onClick={() => void saveToLibraryAndMusik(true)}
              className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'UNDUH FILE .WAV & SIMPAN KE MUSIK' : 'DOWNLOAD .WAV & SAVE TO MUSIC'}
            </button>
            <button
              type="button"
              onClick={setAsRingtone}
              className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'JADIKAN NADA DERING AKTIF' : 'SET AS ACTIVE RINGTONE'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
