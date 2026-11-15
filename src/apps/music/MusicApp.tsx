'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord } from '@/src/types/os';

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  tempoMs?: number;
  notes?: number[];
  audioUrl?: string;
  fileId?: number;
}

const BUILTIN_TRACKS: TrackItem[] = [
  {
    id: 'chip-0',
    title: 'Lagu Favorit',
    artist: 'Retro 8-Bit Synth',
    durationSec: 204,
    tempoMs: 210,
    notes: [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 880, 784, 659, 0],
  },
  {
    id: 'chip-1',
    title: 'Melodi Saku',
    artist: 'Pixel Synth',
    durationSec: 158,
    tempoMs: 185,
    notes: [440, 523, 659, 523, 440, 392, 440, 523, 587, 659, 784, 659, 587, 523, 440, 0],
  },
  {
    id: 'chip-2',
    title: 'Senja Monokrom',
    artist: 'Chip Studio',
    durationSec: 182,
    tempoMs: 240,
    notes: [392, 494, 587, 784, 659, 587, 494, 392, 330, 392, 494, 587, 494, 392, 330, 0],
  },
];

export const MusicApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const volume = useOSStore((s) => s.volume);
  const setVolume = useOSStore((s) => s.setVolume);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [audioFiles, setAudioFiles] = useState<VirtualFileRecord[]>([]);
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progressSec, setProgressSec] = useState(0);
  const [realDuration, setRealDuration] = useState(0);
  const [showList, setShowList] = useState(false);

  const loadAudioFiles = async () => {
    const rows = await db.files
      .filter((f) => f.mimeType.startsWith('audio/') && f.content.startsWith('data:audio/'))
      .reverse()
      .toArray();
    setAudioFiles(rows);
    return rows;
  };

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    let active = true;
    db.files
      .filter((f) => f.mimeType.startsWith('audio/') && f.content.startsWith('data:audio/'))
      .reverse()
      .toArray()
      .then((rows) => {
        if (!active) return;
        setAudioFiles(rows);
        if (params?.fileId) {
          const idx = rows.findIndex((r) => r.id === params.fileId);
          if (idx >= 0) {
            setTrackIdx(idx);
            setPlaying(true);
          }
        }
      });

    return () => {
      active = false;
      audio.pause();
      audio.src = '';
      soundEngine.stopChiptuneLoop();
    };
  }, [params?.fileId]);

  const tracks: TrackItem[] = [
    ...audioFiles.map((f): TrackItem => ({
      id: `file-${f.id}`,
      title: f.name.replace(/\.[^.]+$/, ''),
      artist: `${f.sizeKb} KB · Audio`,
      durationSec: 180,
      audioUrl: f.content,
      fileId: f.id,
    })),
    ...BUILTIN_TRACKS,
  ];

  const track = tracks[trackIdx % tracks.length] ?? BUILTIN_TRACKS[0];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!playing) {
      audio.pause();
      soundEngine.stopChiptuneLoop();
      return;
    }

    if (track.audioUrl) {
      soundEngine.stopChiptuneLoop();
      if (audio.src !== track.audioUrl) {
        audio.src = track.audioUrl;
      }
      audio.volume = volume;
      audio.onloadedmetadata = () => {
        setRealDuration(Math.round(audio.duration || 0));
      };
      audio.ontimeupdate = () => {
        setProgressSec(Math.floor(audio.currentTime));
      };
      audio.onended = () => {
        setProgressSec(0);
        setTrackIdx((i) => (i + 1) % tracks.length);
      };
      audio.play().catch(() => undefined);
      return () => {
        audio.ontimeupdate = null;
        audio.onended = null;
      };
    }

    // Built-in chiptune loop
    audio.pause();
    soundEngine.startChiptuneLoop(track.notes ?? [440, 554, 659], track.tempoMs ?? 210);
    const id = setInterval(() => {
      setProgressSec((prev) => {
        if (prev + 1 >= track.durationSec) {
          setTrackIdx((i) => (i + 1) % tracks.length);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      clearInterval(id);
      soundEngine.stopChiptuneLoop();
    };
  }, [playing, track.id, track.audioUrl, track.durationSec, track.notes, track.tempoMs, tracks.length, volume]);

  const handleImportAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        showToast(language === 'id' ? `${file.name} > 8MB dilewati` : `${file.name} > 8MB skipped`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      await db.files.add({
        folder: 'Musik',
        name: file.name,
        mimeType: file.type || 'audio/mpeg',
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        content: dataUrl,
        createdAt: Date.now(),
      });
    }
    e.target.value = '';
    await loadAudioFiles();
    setTrackIdx(0);
    setProgressSec(0);
    setPlaying(true);
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Musik ditambahkan!' : 'Music added!');
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: playing ? (language === 'id' ? 'Jeda' : 'Pause') : language === 'id' ? 'Putar' : 'Play',
      centerLabel: language === 'id' ? 'Daftar' : 'List',
      rightLabel: showList
        ? language === 'id'
          ? 'Tutup'
          : 'Close'
        : language === 'id'
          ? 'Kembali'
          : 'Back',
      onLeft: () => setPlaying((p) => !p),
      onCenter: () => setShowList((s) => !s),
      onRight: () => {
        if (showList) setShowList(false);
        else onBack();
      },
    });
  });

  const displayDuration = track.audioUrl ? (realDuration || 1) : track.durationSec;

  const fmt = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Pemutar Musik' : 'Music Player'}
        showChevrons={false}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleImportAudio}
        className="hidden"
      />

      {showList ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold shrink-0">
            <span>{tracks.length} {language === 'id' ? 'Lagu' : 'Tracks'}</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-0.5 cursor-pointer"
            >
              + {language === 'id' ? 'Impor MP3/WAV' : 'Import Audio'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
            {tracks.map((tr, idx) => (
              <div
                key={tr.id}
                className={`flex items-center justify-between p-2 ${
                  idx === trackIdx % tracks.length ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-sec)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setTrackIdx(idx);
                    setProgressSec(0);
                    setRealDuration(0);
                    setPlaying(true);
                    setShowList(false);
                  }}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="text-sm font-bold leading-none truncate">{tr.title}</div>
                  <div className="text-xs opacity-80 truncate mt-1">{tr.artist}</div>
                </button>
                {tr.fileId ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await db.files.delete(tr.fileId!);
                      loadAudioFiles();
                    }}
                    className="ml-2 px-1.5 border border-current text-xs font-bold cursor-pointer"
                  >
                    ×
                  </button>
                ) : (
                  <span className="text-xs tabular-nums shrink-0 ml-2">{fmt(tr.durationSec)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-16 h-16 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] flex items-center justify-center shrink-0">
                <PixelIcon name="music" size={38} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold leading-none truncate">{track.title}</h3>
                <p className="text-xs sm:text-sm opacity-85 truncate mt-1">{track.artist}</p>
                <p className="text-[11px] font-bold mt-1">
                  {playing
                    ? track.audioUrl
                      ? '▶ PLAYING AUDIO'
                      : '▶ PLAYING 8-BIT'
                    : '❚❚ PAUSED'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[11px] font-bold shrink-0 cursor-pointer"
              title={language === 'id' ? 'Impor Musik' : 'Import Music'}
            >
              +MP3
            </button>
          </div>

          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={displayDuration}
              value={Math.min(progressSec, displayDuration)}
              onChange={(e) => {
                const val = Number(e.target.value);
                setProgressSec(val);
                if (track.audioUrl && audioRef.current) {
                  audioRef.current.currentTime = val;
                }
              }}
              className="w-full accent-[var(--lcd-fg)] cursor-pointer"
              aria-label="Seek"
            />
            <div className="flex justify-between text-xs font-bold tabular-nums">
              <span>{fmt(progressSec)}</span>
              <span>{fmt(displayDuration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => {
                setTrackIdx((i) => (i - 1 + tracks.length) % tracks.length);
                setProgressSec(0);
                setRealDuration(0);
                soundEngine.playCue('click');
              }}
              className="p-2 border-2 border-[var(--lcd-fg)] hover:bg-[var(--lcd-sec)] cursor-pointer"
              aria-label="Previous"
            >
              <PixelIcon name="prev" size={24} />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="px-4 py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] cursor-pointer"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              <PixelIcon name={playing ? 'pause' : 'play'} size={26} />
            </button>
            <button
              type="button"
              onClick={() => {
                setTrackIdx((i) => (i + 1) % tracks.length);
                setProgressSec(0);
                setRealDuration(0);
                soundEngine.playCue('click');
              }}
              className="p-2 border-2 border-[var(--lcd-fg)] hover:bg-[var(--lcd-sec)] cursor-pointer"
              aria-label="Next"
            >
              <PixelIcon name="next" size={24} />
            </button>
          </div>

          <div className="flex items-center gap-2 border-t-2 border-[var(--lcd-fg)] pt-2">
            <PixelIcon name="volume" size={20} />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="flex-1 accent-[var(--lcd-fg)] cursor-pointer"
              aria-label="Volume"
            />
            <span className="text-xs font-bold w-9 text-right tabular-nums">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
