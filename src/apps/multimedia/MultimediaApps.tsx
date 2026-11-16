'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { PixelWallpaperArt, WALLPAPERS } from '@/src/components/PixelWallpapers';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord } from '@/src/types/os';

// ==========================================
// 1. REAL VIDEO PLAYER + PIXEL CLIP PLAYER
// ==========================================
export const VideoPlayerApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const openApp = useOSStore((s) => s.openApp);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [savedVideos, setSavedVideos] = useState<VirtualFileRecord[]>([]);
  const [activeFileId, setActiveFileId] = useState<number | undefined>(undefined);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('BINTANG_PIXEL.PXV');
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let active = true;
    db.files
      .filter((f) => f.mimeType.startsWith('video/') && f.content.startsWith('data:video/'))
      .reverse()
      .toArray()
      .then((rows) => {
        if (!active) return;
        setSavedVideos(rows);
        const target = params?.fileId ? rows.find((r) => r.id === params.fileId) : rows[0];
        if (target) {
          setActiveFileId(target.id);
          setVideoSrc(target.content);
          setVideoName(target.name);
          setPlaying(true);
        }
      });
    return () => {
      active = false;
    };
  }, [params?.fileId]);

  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  // Built-in pixel clip loop when no external video loaded
  useEffect(() => {
    if (videoSrc || !playing) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % 16), 240);
    return () => clearInterval(id);
  }, [playing, videoSrc]);

  const togglePlay = () => {
    if (videoSrc && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => undefined);
        setPlaying(true);
      } else {
        videoRef.current.pause();
        setPlaying(false);
      }
    } else {
      setPlaying((p) => !p);
    }
  };

  const handleOpenVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoSrc && videoSrc.startsWith('blob:')) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setActiveFileId(undefined);
    setVideoSrc(url);
    setVideoName(file.name);
    setPlaying(true);
    setCurrentTime(0);
    soundEngine.playCue('open');
    showToast(language === 'id' ? `Memutar: ${file.name}` : `Playing: ${file.name}`);
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: playing ? (language === 'id' ? 'Jeda' : 'Pause') : language === 'id' ? 'Putar' : 'Play',
      centerLabel: language === 'id' ? 'Buka' : 'Open',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: togglePlay,
      onCenter: () => fileInputRef.current?.click(),
      onRight: onBack,
    });
  });

  const fmtTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Pemutar Video' : 'Video Player'} showChevrons={false} />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleOpenVideo}
        className="hidden"
      />

      <div className="flex-1 flex flex-col p-2 justify-between gap-2 min-h-0">
        <div className="flex-1 border-2 border-[var(--lcd-fg)] bg-black text-[#D8FF9A] flex flex-col justify-between overflow-hidden min-h-0">
          <div className="text-[10px] px-2 py-1 flex justify-between bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold shrink-0">
            <span className="truncate">{videoName}</span>
            <span className="shrink-0 ml-2 tabular-nums">
              {videoSrc ? `${fmtTime(currentTime)}/${fmtTime(duration)}` : `F:${String(frame + 1).padStart(2, '0')}/16`}
            </span>
          </div>

          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              muted={muted}
              playsInline
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onEnded={() => setPlaying(false)}
              className="w-full flex-1 min-h-0 object-contain bg-black"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-2 bg-[var(--lcd-fg)] text-[var(--lcd-bg)]">
              <svg viewBox="0 0 120 60" className="w-full h-28" shapeRendering="crispEdges">
                <rect x="0" y="48" width="120" height="12" fill="currentColor" opacity="0.3" />
                <rect x={(frame * 7) % 110} y={14 + (frame % 3) * 4} width="10" height="10" fill="currentColor" />
                <rect x={(frame * 5 + 40) % 110} y="8" width="4" height="4" fill="currentColor" />
                <rect x={100 - ((frame * 6) % 90)} y="36" width="14" height="12" fill="currentColor" />
              </svg>
              <div className="text-[10px] opacity-80 mt-1">
                {language === 'id' ? 'Klik "Buka Video" untuk memutar berkas MP4/WebM' : 'Click "Open Video" to play MP4/WebM'}
              </div>
            </div>
          )}

          {videoSrc ? (
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.5}
              value={currentTime}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = v;
                setCurrentTime(v);
              }}
              className="w-full accent-[var(--lcd-bg)] cursor-pointer px-1"
            />
          ) : (
            <div className="w-full h-2 border-t border-current">
              <div className="h-full bg-current" style={{ width: `${((frame + 1) / 16) * 100}%` }} />
            </div>
          )}
        </div>

        {savedVideos.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto lcd-scroll shrink-0">
            {savedVideos.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setActiveFileId(v.id);
                  setVideoSrc(v.content);
                  setVideoName(v.name);
                  setPlaying(true);
                  setCurrentTime(0);
                }}
                className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold shrink-0 cursor-pointer ${
                  videoName === v.name ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={togglePlay}
            className="flex-1 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
          >
            {playing ? '❚❚ PAUSE' : '▶ PLAY'}
          </button>
          {videoSrc && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="px-2 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
            >
              {muted ? 'MUTE' : 'VOL'}
            </button>
          )}
          <button
            type="button"
            onClick={() => openApp('video-editor', activeFileId ? { fileId: activeFileId } : undefined)}
            className="px-2 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
          >
            EDIT
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
          >
            {language === 'id' ? 'Buka' : 'Open'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. REAL WEBRTC CAMERA + RETRO DITHERING
// ==========================================
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const CameraApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const openApp = useOSStore((s) => s.openApp);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraMode, setCameraMode] = useState<'live' | 'scene'>('live');
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'ready' | 'unavailable'>('starting');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [filterMode, setFilterMode] = useState<'lcd' | 'color'>('lcd');
  const [sceneIdx, setSceneIdx] = useState(0);
  const [flash, setFlash] = useState(false);
  const [zoom, setZoom] = useState(1);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (cameraMode !== 'live') {
      stopCamera();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      Promise.resolve().then(() => setCameraStatus('unavailable'));
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        setCameraStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setCameraStatus('unavailable');
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraMode, facingMode]);

  // Render live video frames onto canvas with optional 2-bit LCD dither filter
  useEffect(() => {
    if (cameraMode !== 'live' || cameraStatus !== 'ready') return;
    let raf = 0;

    const drawFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = filterMode === 'lcd' ? 160 : 320;
          const h = filterMode === 'lcd' ? 120 : 240;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          const vw = video.videoWidth || w;
          const vh = video.videoHeight || h;
          const cropW = vw / zoom;
          const cropH = vh / zoom;
          const sx = (vw - cropW) / 2;
          const sy = (vh - cropH) / 2;
          ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, w, h);

          if (filterMode === 'lcd') {
            const img = ctx.getImageData(0, 0, w, h);
            const data = img.data;
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                const threshold = (BAYER_4X4[y % 4][x % 4] / 16) * 255;
                if (lum > threshold) {
                  // Light LCD pixel (#D8FF9A)
                  data[i] = 216;
                  data[i + 1] = 255;
                  data[i + 2] = 154;
                } else {
                  // Dark LCD pixel (#0B1206)
                  data[i] = 11;
                  data[i + 1] = 18;
                  data[i + 2] = 6;
                }
              }
            }
            ctx.putImageData(img, 0, 0);
          }
        }
      }
      raf = requestAnimationFrame(drawFrame);
    };

    raf = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(raf);
  }, [cameraMode, cameraStatus, filterMode, zoom]);

  const capture = async () => {
    soundEngine.playCue('shutter');
    setFlash(true);
    setTimeout(() => setFlash(false), 140);

    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    if (cameraMode === 'live' && cameraStatus === 'ready' && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const sizeKb = Math.max(4, Math.round((dataUrl.length * 0.75) / 1024));
      const name = `CAM_${stamp}.png`;
      await db.files.add({
        folder: 'DCIM',
        name,
        mimeType: 'image/png',
        sizeKb,
        content: dataUrl,
        createdAt: Date.now(),
      });
      showToast(language === 'id' ? `Foto asli tersimpan: ${name}` : `Photo saved: ${name}`);
      return;
    }

    const name = `IMG_${stamp}.px`;
    await db.files.add({
      folder: 'DCIM',
      name,
      mimeType: 'image/pixel',
      sizeKb: 16,
      content: `wallpaper:${WALLPAPERS[sceneIdx].id}`,
      createdAt: Date.now(),
    });
    showToast(language === 'id' ? `Foto tersimpan: ${name}` : `Saved: ${name}`);
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: filterMode === 'lcd' ? 'BW-LCD' : 'COLOR',
      centerLabel: language === 'id' ? 'Jepret' : 'Snap',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => setFilterMode((f) => (f === 'lcd' ? 'color' : 'lcd')),
      onCenter: capture,
      onRight: onBack,
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Kamera' : 'Camera'}
        onPrev={() =>
          cameraMode === 'scene'
            ? setSceneIdx((i) => (i - 1 + WALLPAPERS.length) % WALLPAPERS.length)
            : setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))
        }
        onNext={() =>
          cameraMode === 'scene'
            ? setSceneIdx((i) => (i + 1) % WALLPAPERS.length)
            : setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))
        }
      />
      <div className="flex-1 flex flex-col p-2 justify-between min-h-0">
        <div className="relative flex-1 border-2 border-[var(--lcd-fg)] overflow-hidden bg-[var(--lcd-bg)] flex items-center justify-center min-h-0">
          <video ref={videoRef} playsInline muted className="hidden" />

          {cameraMode === 'live' && cameraStatus === 'ready' ? (
            <canvas
              ref={canvasRef}
              className="w-full h-full object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : cameraMode === 'live' && cameraStatus === 'starting' ? (
            <div className="p-3 text-center text-xs font-bold">
              {language === 'id' ? 'Mengakses kamera perangkat...' : 'Accessing device camera...'}
            </div>
          ) : cameraMode === 'live' && cameraStatus === 'unavailable' ? (
            <div className="p-3 text-center space-y-2">
              <div className="text-xs font-bold">
                {language === 'id'
                  ? 'Kamera tidak tersedia atau izin ditolak.'
                  : 'Camera unavailable or permission denied.'}
              </div>
              <div className="flex justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCameraStatus('starting');
                    setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'));
                  }}
                  className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[11px] font-bold cursor-pointer"
                >
                  {language === 'id' ? 'Coba Lagi' : 'Retry'}
                </button>
                <button
                  type="button"
                  onClick={() => setCameraMode('scene')}
                  className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[11px] font-bold cursor-pointer"
                >
                  {language === 'id' ? 'Mode Lensa Retro' : 'Retro Scene'}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="w-full h-full transition-transform duration-100"
              style={{ transform: `scale(${zoom})` }}
            >
              <PixelWallpaperArt id={WALLPAPERS[sceneIdx].id} />
            </div>
          )}

          {/* Viewfinder crosshair */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border border-[var(--lcd-fg)]" />
          </div>
          <div className="absolute top-1 left-1 px-1 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold">
            {cameraMode === 'live' && cameraStatus === 'ready'
              ? `${filterMode.toUpperCase()} · ${zoom}x`
              : `RETRO · ${zoom}x`}
          </div>
          <button
            type="button"
            onClick={() => openApp('gallery')}
            className="absolute top-1 right-1 px-1.5 py-0.5 bg-[var(--lcd-bg)] border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer"
          >
            {language === 'id' ? 'Galeri' : 'Gallery'}
          </button>
          {flash && <div className="absolute inset-0 bg-[var(--lcd-fg)]" />}
        </div>

        <div className="flex items-center gap-1.5 mt-2 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
            className="px-2 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
          >
            {zoom}x
          </button>
          <button
            type="button"
            onClick={() => setFilterMode((f) => (f === 'lcd' ? 'color' : 'lcd'))}
            className="px-2 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
          >
            {filterMode === 'lcd' ? 'LCD' : 'RGB'}
          </button>
          <button
            type="button"
            onClick={capture}
            className="flex-1 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PixelIcon name="camera" size={16} />
            <span>{language === 'id' ? 'Jepret' : 'Capture'}</span>
          </button>
          <button
            type="button"
            onClick={() => setCameraMode((m) => (m === 'live' ? 'scene' : 'live'))}
            className="px-2 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
            title={language === 'id' ? 'Ganti Mode' : 'Switch Mode'}
          >
            {cameraMode === 'live' ? 'CAM' : 'ART'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. REAL MICROPHONE VOICE RECORDER
// ==========================================
export const VoiceRecorderApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [memos, setMemos] = useState<VirtualFileRecord[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const analyserRafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const secondsRef = useRef(0);

  const loadMemos = async () => {
    const all = await db.files
      .filter((f) => f.mimeType.startsWith('audio/') && f.name.startsWith('Rekaman_'))
      .reverse()
      .toArray();
    setMemos(all);
  };

  useEffect(() => {
    let active = true;
    db.files
      .filter((f) => f.mimeType.startsWith('audio/') && f.name.startsWith('Rekaman_'))
      .reverse()
      .toArray()
      .then((rows) => {
        if (active) setMemos(rows);
      });
    return () => {
      active = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(analyserRafRef.current);
      audioCtxRef.current?.close().catch(() => undefined);
      audioElRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [recording]);

  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Mikrofon tidak didukung browser' : 'Microphone unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      // Live audio VU meter
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tickMeter = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setLevel(Math.min(100, Math.round((avg / 128) * 100)));
          analyserRafRef.current = requestAnimationFrame(tickMeter);
        };
        tickMeter();
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        cancelAnimationFrame(analyserRafRef.current);
        audioCtxRef.current?.close().catch(() => undefined);
        stream.getTracks().forEach((t) => t.stop());
        setLevel(0);

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const ext = (recorder.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
          const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
          const name = `Rekaman_${stamp}.${ext}`;
          await db.files.add({
            folder: 'Musik',
            name,
            mimeType: recorder.mimeType || 'audio/webm',
            sizeKb: Math.max(1, Math.round(blob.size / 1024)),
            content: dataUrl,
            createdAt: Date.now(),
          });
          await loadMemos();
          showToast(language === 'id' ? `Tersimpan: ${name}` : `Saved: ${name}`);
        };
        reader.readAsDataURL(blob);
      };

      secondsRef.current = 0;
      setSeconds(0);
      recorder.start();
      soundEngine.playCue('select');
      setRecording(true);
    } catch {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Izin mikrofon ditolak' : 'Microphone permission denied');
    }
  };

  const stopRecording = () => {
    soundEngine.playCue('back');
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const toggleRecord = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  const playMemo = (memo: VirtualFileRecord) => {
    if (playingId === memo.id) {
      audioElRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioElRef.current?.pause();
    if (memo.content.startsWith('data:audio/')) {
      const audio = new Audio(memo.content);
      audioElRef.current = audio;
      setPlayingId(memo.id ?? null);
      audio.onended = () => setPlayingId(null);
      audio.play().catch(() => {
        setPlayingId(null);
        showToast(language === 'id' ? 'Gagal memutar audio' : 'Playback failed');
      });
    } else {
      soundEngine.playTone(620, 120, 'triangle');
      showToast(`▶ ${memo.name}`);
    }
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: recording ? (language === 'id' ? 'Berhenti' : 'Stop') : language === 'id' ? 'Rekam' : 'Record',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: toggleRecord,
      onRight: onBack,
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Perekam Suara' : 'Voice Recorder'} showChevrons={false} />
      <div className="flex-1 flex flex-col p-2.5 gap-2 min-h-0">
        <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 text-center shrink-0">
          <PixelIcon name="mic" size={34} className="mx-auto" />
          <div className="text-2xl font-bold tabular-nums mt-1">
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
          </div>
          <div className="text-[11px] font-bold mt-0.5">
            {recording
              ? language === 'id'
                ? '● MEREKAM MIKROFON'
                : '● RECORDING MIC'
              : language === 'id'
                ? 'SIAP MEREKAM'
                : 'READY'}
          </div>
          <div className="w-full h-2 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] mt-2">
            <div className="h-full bg-[var(--lcd-fg)] transition-all duration-75" style={{ width: `${level}%` }} />
          </div>
        </div>

        <button
          type="button"
          onClick={toggleRecord}
          className={`w-full py-1.5 border-2 border-[var(--lcd-fg)] text-xs font-bold cursor-pointer shrink-0 ${
            recording ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
          }`}
        >
          {recording
            ? language === 'id'
              ? '■ Hentikan & Simpan'
              : '■ Stop & Save'
            : language === 'id'
              ? '● Mulai Rekam Suara'
              : '● Start Mic Recording'}
        </button>

        <div className="flex-1 overflow-y-auto lcd-scroll border-t-2 border-[var(--lcd-fg)] pt-2 space-y-1 min-h-0">
          {memos.length === 0 ? (
            <div className="text-xs opacity-75 text-center py-3">
              {language === 'id' ? 'Belum ada rekaman suara.' : 'No recordings yet.'}
            </div>
          ) : (
            memos.map((m) => {
              const isPlaying = playingId === m.id;
              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between border border-[var(--lcd-fg)] px-2 py-1 text-xs ${
                    isPlaying ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-sec)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => playMemo(m)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer font-bold"
                  >
                    <PixelIcon name={isPlaying ? 'pause' : 'play'} size={16} />
                    <span className="truncate">{m.name}</span>
                    <span className="text-[10px] opacity-80 shrink-0">{m.sizeKb}KB</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!m.id) return;
                      if (playingId === m.id) {
                        audioElRef.current?.pause();
                        setPlayingId(null);
                      }
                      await db.files.delete(m.id);
                      loadMemos();
                    }}
                    className="ml-2 px-1.5 border border-current font-bold cursor-pointer"
                    title={language === 'id' ? 'Hapus' : 'Delete'}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
