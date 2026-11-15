'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord } from '@/src/types/os';

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';
export type VideoFilterId = 'none' | 'lcd' | 'contrast' | 'sepia' | 'invert';

export interface EditorVideoClip {
  id: string;
  name: string;
  kind: 'video' | 'image';
  src: string;
  sourceDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  speed: 0.5 | 1 | 1.5 | 2;
  filter: VideoFilterId;
  muted: boolean;
}

export interface EditorTextOverlay {
  id: string;
  text: string;
  startSec: number;
  durationSec: number;
  position: 'top' | 'center' | 'bottom';
  boxed: boolean;
}

export interface EditorAudioClip {
  id: string;
  name: string;
  src: string;
  durationSec: number;
  startSec: number;
  volume: number;
}

interface ComputedClip extends EditorVideoClip {
  timelineStart: number;
  timelineEnd: number;
  effectiveDuration: number;
}

type ToolPanel = 'none' | 'media' | 'trim' | 'speed' | 'filter' | 'text' | 'audio' | 'export';

const FILTER_OPTIONS: { id: VideoFilterId; labelId: string; labelEn: string; css: string }[] = [
  { id: 'none', labelId: 'Normal', labelEn: 'Normal', css: 'none' },
  { id: 'lcd', labelId: 'LCD 2-Bit', labelEn: 'LCD 2-Bit', css: 'grayscale(1) contrast(1.85) brightness(1.05)' },
  { id: 'contrast', labelId: 'Tajam', labelEn: 'Crisp', css: 'contrast(1.45) saturate(1.18)' },
  { id: 'sepia', labelId: 'Klasik', labelEn: 'Vintage', css: 'sepia(0.95) contrast(1.15)' },
  { id: 'invert', labelId: 'Negatif', labelEn: 'Invert', css: 'invert(1)' },
];

const ASPECT_DIMS: Record<VideoAspectRatio, { w: number; h: number }> = {
  '16:9': { w: 480, h: 270 },
  '9:16': { w: 270, h: 480 },
  '1:1': { w: 360, h: 360 },
};

let seqCounter = 1;
function nextUid(prefix: string): string {
  seqCounter += 1;
  return `${prefix}-${seqCounter}-${Math.floor(Math.random() * 1000)}`;
}

function fmtSec(sec: number): string {
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

function makeExportFileName(): string {
  const d = new Date();
  const stamp = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  return `RetroCut_${stamp}.webm`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to encode video'));
    reader.readAsDataURL(blob);
  });
}

function drawCoverMedia(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  srcW: number,
  srcH: number,
  cw: number,
  ch: number
) {
  if (!srcW || !srcH) return;
  const scale = Math.min(cw / srcW, ch / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.drawImage(source, dx, dy, dw, dh);
}

export const VideoEditorApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const openApp = useOSStore((s) => s.openApp);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Media element cache & pending async seek queue for crisp realtime scrubbing
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const pendingVideoSeekRef = useRef<Map<string, number>>(new Map());

  // Library files from OS IndexedDB
  const [osPhotos, setOsPhotos] = useState<VirtualFileRecord[]>([]);
  const [osVideos, setOsVideos] = useState<VirtualFileRecord[]>([]);
  const [osAudios, setOsAudios] = useState<VirtualFileRecord[]>([]);

  // Timeline state
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [clips, setClips] = useState<EditorVideoClip[]>([]);
  const [texts, setTexts] = useState<EditorTextOverlay[]>([]);
  const [audioClip, setAudioClip] = useState<EditorAudioClip | null>(null);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ToolPanel>('none');

  const [playheadSec, setPlayheadSec] = useState(0);
  const playheadRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // New Text Form
  const [draftText, setDraftText] = useState('RETRO CUT');
  const [draftTextPos, setDraftTextPos] = useState<'top' | 'center' | 'bottom'>('bottom');
  const [draftTextBoxed, setDraftTextBoxed] = useState(true);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideo, setExportedVideo] = useState<{
    fileId?: number;
    fileName: string;
    blobUrl: string;
    sizeKb: number;
  } | null>(null);

  // Latest-state refs so async callbacks (image onload, video onseeked, RAF playback) never use stale closures or tear down playback
  const isPlayingRef = useRef(isPlaying);
  const exportingRef = useRef(exporting);
  const audioClipRef = useRef(audioClip);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    exportingRef.current = exporting;
  }, [exporting]);
  useEffect(() => {
    audioClipRef.current = audioClip;
  }, [audioClip]);

  // Computed clip positions along V1
  const computedClips = useMemo<ComputedClip[]>(() => {
    return clips.reduce<ComputedClip[]>((acc, c) => {
      const start = acc.length > 0 ? acc[acc.length - 1].timelineEnd : 0;
      const span = Math.max(0.4, c.trimEndSec - c.trimStartSec);
      const effectiveDuration = Number((span / c.speed).toFixed(2));
      acc.push({
        ...c,
        timelineStart: start,
        timelineEnd: start + effectiveDuration,
        effectiveDuration,
      });
      return acc;
    }, []);
  }, [clips]);

  const totalDuration = useMemo(() => {
    const vEnd = computedClips.length > 0 ? computedClips[computedClips.length - 1].timelineEnd : 0;
    const tEnd = texts.reduce((m, t) => Math.max(m, t.startSec + t.durationSec), 0);
    return Math.max(vEnd, tEnd);
  }, [computedClips, texts]);

  const totalDurationRef = useRef(totalDuration);
  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  const selectedClip = useMemo(
    () => computedClips.find((c) => c.id === selectedClipId) ?? computedClips[0] ?? null,
    [computedClips, selectedClipId]
  );

  const selectedText = useMemo(
    () => texts.find((t) => t.id === selectedTextId) ?? null,
    [selectedTextId, texts]
  );

  // Ref for triggering a composite redraw from async image/video events
  const renderFrameRef = useRef<(timeSec: number, syncVideoPlay: boolean) => void>(() => undefined);

  // Helpers to preload / access cached media elements with instant redraw on load/seek
  const getImageEl = useCallback((src: string): HTMLImageElement => {
    let img = imageCacheRef.current.get(src);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!exportingRef.current) {
          renderFrameRef.current(playheadRef.current, isPlayingRef.current);
        }
      };
      img.src = src;
      imageCacheRef.current.set(src, img);
    }
    return img;
  }, []);

  const getVideoEl = useCallback((src: string): HTMLVideoElement => {
    let vid = videoCacheRef.current.get(src);
    if (!vid) {
      vid = document.createElement('video');
      vid.playsInline = true;
      vid.preload = 'auto';
      vid.crossOrigin = 'anonymous';

      const handleMediaReady = () => {
        if (exportingRef.current) return;
        const pending = pendingVideoSeekRef.current.get(src);
        if (pending !== undefined && !isPlayingRef.current) {
          pendingVideoSeekRef.current.delete(src);
          if (Math.abs(vid!.currentTime - pending) > 0.03) {
            try {
              vid!.currentTime = pending;
              return;
            } catch {
              // Ignore seek errors
            }
          }
        }
        renderFrameRef.current(playheadRef.current, isPlayingRef.current);
      };

      vid.addEventListener('loadeddata', handleMediaReady);
      vid.addEventListener('seeked', handleMediaReady);
      vid.addEventListener('canplay', handleMediaReady);
      vid.src = src;
      videoCacheRef.current.set(src, vid);
    }
    return vid;
  }, []);

  // Composite frame drawer for preview, scrubbing, and WebM export
  const renderCompositeFrame = useCallback(
    (timeSec: number, syncVideoPlay: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { w, h } = ASPECT_DIMS[aspectRatio];
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.save();
      ctx.fillStyle = '#0d1109';
      ctx.fillRect(0, 0, w, h);

      const activeClip = computedClips.find(
        (c) => timeSec >= c.timelineStart && timeSec <= c.timelineEnd + 0.02
      );

      if (!activeClip) {
        ctx.fillStyle = '#d8ff9a';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          computedClips.length === 0
            ? language === 'id'
              ? '+ TAMBAH VIDEO / FOTO'
              : '+ ADD VIDEO / PHOTO'
            : language === 'id'
              ? 'AKHIR TIMELINE'
              : 'END OF TIMELINE',
          w / 2,
          h / 2
        );
      } else {
        const filterCfg = FILTER_OPTIONS.find((f) => f.id === activeClip.filter);
        ctx.filter = filterCfg?.css ?? 'none';

        if (activeClip.kind === 'image') {
          const img = getImageEl(activeClip.src);
          if (img.complete && img.naturalWidth > 0) {
            drawCoverMedia(ctx, img, img.naturalWidth, img.naturalHeight, w, h);
          }
        } else {
          const vid = getVideoEl(activeClip.src);
          const maxLocal = Math.max(0, (vid.duration || activeClip.sourceDurationSec) - 0.02);
          const rawLocal = activeClip.trimStartSec + Math.max(0, timeSec - activeClip.timelineStart) * activeClip.speed;
          const localTime = Math.min(maxLocal, Math.max(0, rawLocal));

          vid.muted = activeClip.muted || !syncVideoPlay;
          vid.playbackRate = activeClip.speed;

          const tolerance = syncVideoPlay ? Math.max(0.35, 0.25 * activeClip.speed) : 0.03;
          if (Math.abs(vid.currentTime - localTime) > tolerance) {
            if (!syncVideoPlay && vid.seeking) {
              // Queue latest scrubbed target instead of spamming aborted seeks
              pendingVideoSeekRef.current.set(activeClip.src, localTime);
            } else {
              try {
                vid.currentTime = localTime;
              } catch {
                // Ignore seek before metadata ready
              }
            }
          }

          if (syncVideoPlay && vid.paused) {
            vid.play().catch(() => undefined);
          } else if (!syncVideoPlay && !vid.paused) {
            vid.pause();
          }

          if (vid.readyState >= 2) {
            drawCoverMedia(ctx, vid, vid.videoWidth, vid.videoHeight, w, h);
          }
        }

        // Apply crisp retro phosphor green tint in realtime when LCD 2-Bit filter is selected
        if (activeClip.filter === 'lcd') {
          ctx.filter = 'none';
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = '#9bbc0f';
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      // Pause any unused videos
      videoCacheRef.current.forEach((vid, src) => {
        if (!activeClip || activeClip.kind !== 'video' || activeClip.src !== src || !syncVideoPlay) {
          if (!vid.paused) vid.pause();
        }
      });

      ctx.filter = 'none';

      // Render active text overlays (T1)
      const activeTexts = texts.filter((t) => timeSec >= t.startSec && timeSec <= t.startSec + t.durationSec);
      const drawOverlayText = (
        textValue: string,
        position: 'top' | 'center' | 'bottom',
        boxed: boolean,
        isPreviewDraft = false
      ) => {
        const y = position === 'top' ? 36 : position === 'center' ? h / 2 : h - 32;
        ctx.save();
        if (isPreviewDraft) ctx.globalAlpha = 0.8;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(textValue);
        if (boxed) {
          const padX = 12;
          const boxW = Math.min(w - 16, metrics.width + padX * 2);
          ctx.fillStyle = '#000000';
          ctx.fillRect(w / 2 - boxW / 2, y - 16, boxW, 32);
          ctx.strokeStyle = '#d8ff9a';
          ctx.lineWidth = 2;
          ctx.strokeRect(w / 2 - boxW / 2, y - 16, boxW, 32);
          ctx.fillStyle = '#d8ff9a';
        } else {
          ctx.fillStyle = '#000000';
          ctx.fillText(textValue, w / 2 + 2, y + 2);
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillText(textValue, w / 2, y, w - 24);
        ctx.restore();
      };

      for (const txt of activeTexts) {
        drawOverlayText(txt.text, txt.position, txt.boxed, false);
      }

      // Live draft preview while user types inside Text panel (when not editing an existing text)
      if (!exporting && activePanel === 'text' && !selectedText && draftText.trim()) {
        drawOverlayText(draftText.trim(), draftTextPos, draftTextBoxed, true);
      }

      ctx.restore();
    },
    [
      activePanel,
      aspectRatio,
      computedClips,
      draftText,
      draftTextBoxed,
      draftTextPos,
      exporting,
      getImageEl,
      getVideoEl,
      language,
      selectedText,
      texts,
    ]
  );

  useEffect(() => {
    renderFrameRef.current = renderCompositeFrame;
  }, [renderCompositeFrame]);

  // Load OS media library on mount (+ optional incoming video fileId from Video Player)
  useEffect(() => {
    let active = true;
    const requestedFileId = typeof params?.fileId === 'number' ? params.fileId : undefined;

    db.files.toArray().then((all) => {
      if (!active) return;
      const photos = all.filter((f) => f.folder === 'DCIM' && f.content.startsWith('data:image/')).reverse();
      const videos = all.filter((f) => f.mimeType.startsWith('video/') && f.content.startsWith('data:video/')).reverse();
      const audios = all.filter((f) => f.mimeType.startsWith('audio/') && f.content.startsWith('data:audio/')).reverse();
      setOsPhotos(photos);
      setOsVideos(videos);
      setOsAudios(audios);

      if (requestedFileId) {
        const target = videos.find((v) => v.id === requestedFileId);
        if (target) {
          const probe = document.createElement('video');
          probe.preload = 'metadata';
          probe.src = target.content;
          probe.onloadedmetadata = () => {
            if (!active) return;
            const dur = Math.max(1, Number((probe.duration || 6).toFixed(1)));
            const id = nextUid('osv');
            getVideoEl(target.content);
            setClips([
              {
                id,
                name: target.name.slice(0, 18),
                kind: 'video',
                src: target.content,
                sourceDurationSec: dur,
                trimStartSec: 0,
                trimEndSec: dur,
                speed: 1,
                filter: 'none',
                muted: false,
              },
            ]);
            setSelectedClipId(id);
          };
        }
      }
    });

    const audio = new Audio();
    audioPlayerRef.current = audio;

    const urls = objectUrlsRef.current;
    const videos = videoCacheRef.current;

    return () => {
      active = false;
      audio.pause();
      audio.src = '';
      videos.forEach((v) => {
        v.pause();
        v.src = '';
      });
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [getVideoEl, params?.fileId]);

  // Helper to update playhead synchronously in ref + React state
  const seekPlayhead = useCallback((sec: number, renderNow = false) => {
    const clamped = Math.max(0, Math.min(totalDurationRef.current || sec, sec));
    playheadRef.current = clamped;
    setPlayheadSec(clamped);
    if (renderNow && !exportingRef.current) {
      renderFrameRef.current(clamped, isPlayingRef.current);
    }
  }, []);

  // Redraw immediately whenever paused edits change (filters, texts, trim, clips, aspectRatio, scrubbing)
  useEffect(() => {
    if (!isPlaying && !exporting) {
      renderCompositeFrame(playheadSec, false);
    }
  }, [exporting, isPlaying, playheadSec, renderCompositeFrame]);

  // Ref-driven continuous 60fps real-time playback loop: changing Filter, Speed, Trim, Text, or Volume NEVER restarts or stutters playback!
  useEffect(() => {
    if (!isPlaying || exporting) return;
    if (totalDurationRef.current <= 0) {
      Promise.resolve().then(() => setIsPlaying(false));
      return;
    }

    let lastTs = performance.now();
    let lastUiSync = lastTs;
    let rafId = 0;
    const videoCache = videoCacheRef.current;
    const audioEl = audioPlayerRef.current;

    const syncAudioForTime = (t: number) => {
      const aClip = audioClipRef.current;
      if (!audioEl) return;
      if (!aClip) {
        if (!audioEl.paused) audioEl.pause();
        return;
      }
      if (audioEl.src !== aClip.src) {
        audioEl.src = aClip.src;
      }
      audioEl.volume = aClip.volume;
      const offset = t - aClip.startSec;
      if (offset >= 0 && offset < aClip.durationSec) {
        if (audioEl.paused || Math.abs(audioEl.currentTime - offset) > 0.35) {
          try {
            audioEl.currentTime = offset;
          } catch {
            // Ignore audio seek before ready
          }
          if (audioEl.paused) audioEl.play().catch(() => undefined);
        }
      } else if (!audioEl.paused) {
        audioEl.pause();
      }
    };

    syncAudioForTime(playheadRef.current);

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      const dur = totalDurationRef.current;
      if (dur <= 0) {
        setIsPlaying(false);
        return;
      }

      const next = playheadRef.current + dt;
      if (next >= dur) {
        playheadRef.current = 0;
        setPlayheadSec(0);
        setIsPlaying(false);
        if (audioEl && !audioEl.paused) audioEl.pause();
        renderFrameRef.current(0, false);
        return;
      }

      playheadRef.current = next;
      // Throttle React state sync to ~24fps while canvas + audio run at full 60fps
      if (now - lastUiSync >= 42) {
        lastUiSync = now;
        setPlayheadSec(next);
      }

      syncAudioForTime(next);
      renderFrameRef.current(next, true);
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      if (audioEl && !audioEl.paused) audioEl.pause();
      videoCache.forEach((v) => {
        if (!v.paused) v.pause();
      });
    };
  }, [exporting, isPlaying]);

  // Add video or photo from local device upload
  const handleUploadMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    Array.from(fileList).forEach((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);

      if (file.type.startsWith('image/')) {
        const id = nextUid('img');
        getImageEl(url);
        setClips((prev) => [
          ...prev,
          {
            id,
            name: file.name.slice(0, 18),
            kind: 'image',
            src: url,
            sourceDurationSec: 4,
            trimStartSec: 0,
            trimEndSec: 4,
            speed: 1,
            filter: 'none',
            muted: false,
          },
        ]);
        setSelectedClipId(id);
      } else if (file.type.startsWith('video/')) {
        const probe = document.createElement('video');
        probe.preload = 'metadata';
        probe.src = url;
        probe.onloadedmetadata = () => {
          const dur = Math.max(1, Number((probe.duration || 6).toFixed(1)));
          const id = nextUid('vid');
          getVideoEl(url);
          setClips((prev) => [
            ...prev,
            {
              id,
              name: file.name.slice(0, 18),
              kind: 'video',
              src: url,
              sourceDurationSec: dur,
              trimStartSec: 0,
              trimEndSec: dur,
              speed: 1,
              filter: 'none',
              muted: false,
            },
          ]);
          setSelectedClipId(id);
        };
      }
    });

    soundEngine.playCue('select');
    setActivePanel('none');
    e.target.value = '';
  };

  // Add OS Gallery Photo or Video
  const addOsMediaFile = (file: VirtualFileRecord) => {
    soundEngine.playCue('select');
    if (file.mimeType.startsWith('image/')) {
      const id = nextUid('gal');
      getImageEl(file.content);
      setClips((prev) => [
        ...prev,
        {
          id,
          name: file.name.slice(0, 18),
          kind: 'image',
          src: file.content,
          sourceDurationSec: 4,
          trimStartSec: 0,
          trimEndSec: 4,
          speed: 1,
          filter: 'none',
          muted: false,
        },
      ]);
      setSelectedClipId(id);
      setActivePanel('none');
    } else if (file.mimeType.startsWith('video/')) {
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.src = file.content;
      probe.onloadedmetadata = () => {
        const dur = Math.max(1, Number((probe.duration || 6).toFixed(1)));
        const id = nextUid('osv');
        getVideoEl(file.content);
        setClips((prev) => [
          ...prev,
          {
            id,
            name: file.name.slice(0, 18),
            kind: 'video',
            src: file.content,
            sourceDurationSec: dur,
            trimStartSec: 0,
            trimEndSec: dur,
            speed: 1,
            filter: 'none',
            muted: false,
          },
        ]);
        setSelectedClipId(id);
        setActivePanel('none');
      };
    }
  };

  // Upload or select Audio track
  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);

    const probe = new Audio(url);
    probe.onloadedmetadata = () => {
      const dur = Math.max(1, Number((probe.duration || 15).toFixed(1)));
      setAudioClip({
        id: nextUid('aud'),
        name: file.name.slice(0, 20),
        src: url,
        durationSec: dur,
        startSec: 0,
        volume: 0.85,
      });
      soundEngine.playCue('select');
      showToast(language === 'id' ? `Audio ditambahkan: ${file.name}` : `Audio added: ${file.name}`);
    };
    e.target.value = '';
  };

  const selectOsAudio = (file: VirtualFileRecord) => {
    const probe = new Audio(file.content);
    probe.onloadedmetadata = () => {
      const dur = Math.max(1, Number((probe.duration || 10).toFixed(1)));
      setAudioClip({
        id: nextUid('osa'),
        name: file.name.slice(0, 20),
        src: file.content,
        durationSec: dur,
        startSec: 0,
        volume: 0.9,
      });
      soundEngine.playCue('select');
      setActivePanel('none');
      showToast(language === 'id' ? `Musik dipilih: ${file.name}` : `Music set: ${file.name}`);
    };
  };

  // Split clip at exact live playhead
  const splitAtPlayhead = () => {
    const curSec = playheadRef.current;
    const target = computedClips.find(
      (c) => curSec > c.timelineStart + 0.25 && curSec < c.timelineEnd - 0.25
    );
    if (!target) {
      soundEngine.playCue('error');
      showToast(
        language === 'id'
          ? 'Geser garis waktu ke tengah klip untuk Split!'
          : 'Move playhead inside a clip to split!'
      );
      return;
    }

    const offsetEffective = curSec - target.timelineStart;
    const splitSourceSec = Number((target.trimStartSec + offsetEffective * target.speed).toFixed(2));
    const leftClip: EditorVideoClip = {
      ...target,
      trimEndSec: splitSourceSec,
    };
    const rightClip: EditorVideoClip = {
      ...target,
      id: nextUid('split'),
      name: `${target.name} (2)`,
      trimStartSec: splitSourceSec,
    };

    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === target.id);
      if (idx < 0) return prev;
      return [...prev.slice(0, idx), leftClip, rightClip, ...prev.slice(idx + 1)];
    });
    setSelectedClipId(rightClip.id);
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Klip berhasil di-Split!' : 'Clip split!');
  };

  const updateSelectedClip = (patch: Partial<EditorVideoClip>) => {
    if (!selectedClip) return;
    setClips((prev) => prev.map((c) => (c.id === selectedClip.id ? { ...c, ...patch } : c)));
  };

  const updateSelectedText = (patch: Partial<EditorTextOverlay>) => {
    if (!selectedText) return;
    setTexts((prev) => prev.map((t) => (t.id === selectedText.id ? { ...t, ...patch } : t)));
  };

  const moveSelectedClip = (dir: -1 | 1) => {
    if (!selectedClip) return;
    const idx = clips.findIndex((c) => c.id === selectedClip.id);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= clips.length) return;
    soundEngine.playCue('click');
    const copy = [...clips];
    [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
    setClips(copy);
  };

  const deleteSelectedClip = () => {
    if (!selectedClip) return;
    soundEngine.playCue('back');
    setClips((prev) => prev.filter((c) => c.id !== selectedClip.id));
    setSelectedClipId(null);
    setActivePanel('none');
  };

  // Real .WebM Render & Export Pipeline
  const startExportWebM = async () => {
    if (computedClips.length === 0 || totalDuration <= 0) {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Tambahkan media terlebih dahulu!' : 'Add media first!');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === 'undefined') {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Browser tidak mendukung ekspor WebM' : 'WebM export unsupported');
      return;
    }

    setIsPlaying(false);
    setExporting(true);
    exportingRef.current = true;
    setExportProgress(1);
    setActivePanel('export');

    let audioCtx: AudioContext | null = null;
    let audioBufSrc: AudioBufferSourceNode | null = null;

    try {
      const videoStream = canvas.captureStream(30);
      const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      if (audioClip) {
        try {
          const AudioCtx =
            window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx = new AudioCtx();
          const dest = audioCtx.createMediaStreamDestination();
          const resp = await fetch(audioClip.src);
          const arr = await resp.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arr);
          audioBufSrc = audioCtx.createBufferSource();
          audioBufSrc.buffer = decoded;
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = audioClip.volume;
          audioBufSrc.connect(gainNode);
          gainNode.connect(dest);
          const audioTracks = dest.stream.getAudioTracks();
          combinedTracks.push(...audioTracks);
        } catch {
          // Proceed with video-only WebM if audio decoding fails
        }
      }

      const mixedStream = new MediaStream(combinedTracks);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';

      const recorder = new MediaRecorder(mixedStream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const stoppedPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start(250);
      if (audioBufSrc) {
        audioBufSrc.start(0, 0, Math.max(0.5, totalDuration));
      }

      const startTime = performance.now();
      let lastExportUiSync = startTime;
      await new Promise<void>((resolve) => {
        const tickExport = (now: number) => {
          const elapsed = (now - startTime) / 1000;
          if (elapsed >= totalDuration) {
            renderFrameRef.current(totalDuration, false);
            setExportProgress(100);
            resolve();
            return;
          }
          renderFrameRef.current(elapsed, true);
          playheadRef.current = elapsed;
          if (now - lastExportUiSync >= 80) {
            lastExportUiSync = now;
            setPlayheadSec(elapsed);
            setExportProgress(Math.min(99, Math.max(1, Math.round((elapsed / totalDuration) * 100))));
          }
          requestAnimationFrame(tickExport);
        };
        requestAnimationFrame(tickExport);
      });

      videoCacheRef.current.forEach((v) => {
        if (!v.paused) v.pause();
      });
      if (audioBufSrc) {
        try {
          audioBufSrc.stop();
        } catch {
          // Ignore already stopped
        }
      }
      recorder.stop();
      const blob = await stoppedPromise;
      const blobUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.push(blobUrl);

      const dataUrl = await blobToDataUrl(blob);
      const sizeKb = Math.max(1, Math.round(blob.size / 1024));
      const fileName = makeExportFileName();

      const savedId = await db.files.add({
        folder: 'Video',
        name: fileName,
        mimeType: 'video/webm',
        sizeKb,
        content: dataUrl,
        createdAt: Date.now(),
      });

      setExportedVideo({
        fileId: Number(savedId),
        fileName,
        blobUrl,
        sizeKb,
      });
      soundEngine.playCue('notify');
      showToast(language === 'id' ? `Selesai! Disimpan ke Video: ${fileName}` : `Done! Saved to Video: ${fileName}`);
    } catch {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Gagal merender video' : 'Video render failed');
    } finally {
      if (audioCtx) {
        audioCtx.close().catch(() => undefined);
      }
      exportingRef.current = false;
      setExporting(false);
    }
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: isPlaying ? 'PAUSE' : 'PLAY',
      centerLabel: exporting ? `${exportProgress}%` : 'EKSPOR',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => {
        if (!exporting) setIsPlaying((p) => !p);
      },
      onCenter: () => {
        if (!exporting) void startExportWebM();
      },
      onRight: () => {
        setIsPlaying(false);
        onBack();
      },
    });
  });

  const cycleAspectRatio = () => {
    soundEngine.playCue('click');
    const order: VideoAspectRatio[] = ['16:9', '9:16', '1:1'];
    setAspectRatio(order[(order.indexOf(aspectRatio) + 1) % order.length]);
  };

  const playheadPct = totalDuration > 0 ? Math.min(100, Math.max(0, (playheadSec / totalDuration) * 100)) : 0;

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Editor Video' : 'Video Editor'} showChevrons={false} />

      <input
        ref={mediaInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        onChange={handleUploadMedia}
        className="hidden"
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={handleUploadAudio}
        className="hidden"
      />

      {/* Top Transport Bar */}
      <div className="flex items-center justify-between px-2 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold shrink-0 tabular-nums">
        <button
          type="button"
          onClick={cycleAspectRatio}
          className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer"
          title="Rasio Kanvas"
        >
          {aspectRatio}
        </button>
        <span>
          {fmtSec(playheadSec)} / {fmtSec(totalDuration)}
        </span>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void startExportWebM()}
          className="px-2 py-0.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] cursor-pointer disabled:opacity-50"
        >
          {exporting ? `${exportProgress}%` : 'EKSPOR .WEBM'}
        </button>
      </div>

      {/* Preview Canvas Monitor */}
      <div className="flex-1 min-h-[120px] bg-black flex items-center justify-center p-1.5 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full border border-[var(--lcd-fg)]/40 bg-[#0d1109] object-contain"
        />
        <button
          type="button"
          onClick={() => !exporting && setIsPlaying((p) => !p)}
          className="absolute bottom-2 left-2 px-2 py-1 border-2 border-[#D8FF9A] bg-black/80 text-[#D8FF9A] text-[10px] font-bold cursor-pointer"
        >
          {isPlaying ? '❚❚ JEDA' : '▶ PUTAR'}
        </button>
        {selectedClip && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/75 border border-[#D8FF9A]/60 text-[#D8FF9A] text-[9px] font-bold tabular-nums">
            {selectedClip.speed}x · {FILTER_OPTIONS.find((f) => f.id === selectedClip.filter)?.labelId}
          </div>
        )}
      </div>

      {/* Playhead Scrubber */}
      <div className="px-2 py-1 bg-[var(--lcd-sec)] border-t-2 border-[var(--lcd-fg)] flex items-center gap-2 shrink-0">
        <input
          type="range"
          min={0}
          max={Math.max(0.1, totalDuration)}
          step={0.05}
          value={Math.min(playheadSec, totalDuration)}
          onChange={(e) => {
            const val = Number(e.target.value);
            setIsPlaying(false);
            seekPlayhead(val, true);
          }}
          className="flex-1 accent-[var(--lcd-fg)] cursor-pointer"
        />
      </div>

      {/* Multi-Track Timeline (V1 Video/Foto, T1 Teks, A1 Audio) with Live Playhead Marker */}
      <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-1.5 space-y-1 shrink-0 max-h-[112px] overflow-y-auto lcd-scroll relative">
        {/* Proportional Realtime Timeline Needle Bar */}
        {totalDuration > 0 && (
          <div className="w-full h-1.5 bg-[var(--lcd-sec)] border border-[var(--lcd-fg)] relative overflow-hidden">
            <div className="h-full bg-[var(--lcd-fg)]" style={{ width: `${playheadPct}%` }} />
          </div>
        )}

        {/* Track V1 */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-5 font-bold shrink-0">V1</span>
          <div className="flex-1 flex items-center gap-1 overflow-x-auto lcd-scroll pb-0.5">
            {computedClips.length === 0 ? (
              <button
                type="button"
                onClick={() => setActivePanel('media')}
                className="px-2 py-1 border border-dashed border-[var(--lcd-fg)] text-[10px] opacity-80 cursor-pointer"
              >
                + Tambah Video / Foto
              </button>
            ) : (
              computedClips.map((c) => {
                const isSel = selectedClip?.id === c.id;
                const isActive = playheadSec >= c.timelineStart && playheadSec <= c.timelineEnd;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playCue('click');
                      setSelectedClipId(c.id);
                      if (!isPlaying) {
                        seekPlayhead(c.timelineStart, true);
                      }
                    }}
                    className={`px-1.5 py-1 border-2 text-[9px] font-bold shrink-0 cursor-pointer tabular-nums ${
                      isSel
                        ? 'border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                        : isActive
                          ? 'border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)] underline'
                          : 'border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[var(--lcd-fg)]'
                    }`}
                  >
                    {c.kind === 'image' ? 'IMG' : 'VID'}·{c.name.slice(0, 8)} ({c.effectiveDuration}s)
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Track T1 */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-5 font-bold shrink-0">T1</span>
          <div className="flex-1 flex items-center gap-1 overflow-x-auto lcd-scroll">
            {texts.length === 0 ? (
              <span className="text-[9px] opacity-60">
                {language === 'id' ? 'Belum ada teks overlay' : 'No text overlays'}
              </span>
            ) : (
              texts.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('click');
                    setSelectedTextId(t.id);
                    setActivePanel('text');
                    if (!isPlaying) {
                      seekPlayhead(t.startSec + 0.05, true);
                    }
                  }}
                  className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[9px] font-bold shrink-0 cursor-pointer ${
                    selectedTextId === t.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                  }`}
                >
                  T: {t.text.slice(0, 10)} ({t.startSec.toFixed(1)}s)
                </button>
              ))
            )}
          </div>
        </div>

        {/* Track A1 */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-5 font-bold shrink-0">A1</span>
          {audioClip ? (
            <button
              type="button"
              onClick={() => setActivePanel('audio')}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[9px] font-bold truncate cursor-pointer"
            >
              ♪ {audioClip.name} ({Math.round(audioClip.volume * 100)}%)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActivePanel('audio')}
              className="text-[9px] opacity-65 underline cursor-pointer"
            >
              + {language === 'id' ? 'Tambah Musik / Audio Studio' : 'Add Music / Studio Audio'}
            </button>
          )}
        </div>
      </div>

      {/* Contextual CapCut-style Drawer Panel */}
      {activePanel !== 'none' && (
        <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 max-h-[165px] overflow-y-auto lcd-scroll space-y-1.5 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="uppercase">{activePanel}</span>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="px-1.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer"
            >
              ×
            </button>
          </div>

          {activePanel === 'media' && (
            <div className="space-y-1.5 text-xs">
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer"
              >
                + {language === 'id' ? 'UNGGAH VIDEO / FOTO PERANGKAT' : 'UPLOAD LOCAL VIDEO / PHOTO'}
              </button>
              {osVideos.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold mb-1">Video OS ({osVideos.length}):</div>
                  <div className="flex flex-wrap gap-1">
                    {osVideos.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => addOsMediaFile(v)}
                        className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                      >
                        +{v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {osPhotos.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold mb-1">Foto Galeri DCIM ({osPhotos.length}):</div>
                  <div className="flex flex-wrap gap-1">
                    {osPhotos.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addOsMediaFile(p)}
                        className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                      >
                        +{p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activePanel === 'trim' && selectedClip && (
            <div className="space-y-1.5 text-[10px]">
              {selectedClip.kind === 'image' ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">Durasi Foto: {selectedClip.trimEndSec.toFixed(1)}s</span>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={0.5}
                    value={selectedClip.trimEndSec}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateSelectedClip({ trimEndSec: val });
                    }}
                    className="flex-1 accent-[var(--lcd-fg)]"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-16 font-bold">Mulai: {selectedClip.trimStartSec.toFixed(1)}s</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, selectedClip.trimEndSec - 0.5)}
                      step={0.1}
                      value={selectedClip.trimStartSec}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSelectedClip({ trimStartSec: val });
                        if (!isPlaying) {
                          seekPlayhead(selectedClip.timelineStart, false);
                        }
                      }}
                      className="flex-1 accent-[var(--lcd-fg)]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 font-bold">Akhir: {selectedClip.trimEndSec.toFixed(1)}s</span>
                    <input
                      type="range"
                      min={Math.min(selectedClip.sourceDurationSec, selectedClip.trimStartSec + 0.5)}
                      max={selectedClip.sourceDurationSec}
                      step={0.1}
                      value={selectedClip.trimEndSec}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSelectedClip({ trimEndSec: val });
                        if (!isPlaying) {
                          const newDur = Math.max(0.4, (val - selectedClip.trimStartSec) / selectedClip.speed);
                          seekPlayhead(selectedClip.timelineStart + Math.max(0, newDur - 0.05), false);
                        }
                      }}
                      className="flex-1 accent-[var(--lcd-fg)]"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveSelectedClip(-1)}
                  className="flex-1 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                >
                  ◀ GESER
                </button>
                <button
                  type="button"
                  onClick={() => moveSelectedClip(1)}
                  className="flex-1 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                >
                  GESER ▶
                </button>
                {selectedClip.kind === 'video' && (
                  <button
                    type="button"
                    onClick={() => updateSelectedClip({ muted: !selectedClip.muted })}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                  >
                    {selectedClip.muted ? 'MUTE' : 'SUARA'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={deleteSelectedClip}
                  className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer"
                >
                  HAPUS
                </button>
              </div>
            </div>
          )}

          {activePanel === 'speed' && selectedClip && (
            <div className="grid grid-cols-4 gap-1">
              {([0.5, 1, 1.5, 2] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('click');
                    updateSelectedClip({ speed: spd });
                  }}
                  className={`py-1.5 border-2 border-[var(--lcd-fg)] text-xs font-bold cursor-pointer ${
                    selectedClip.speed === spd
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          )}

          {activePanel === 'filter' && selectedClip && (
            <div className="grid grid-cols-3 gap-1">
              {FILTER_OPTIONS.map((flt) => (
                <button
                  key={flt.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('click');
                    updateSelectedClip({ filter: flt.id });
                  }}
                  className={`py-1 border-2 border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                    selectedClip.filter === flt.id
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {language === 'id' ? flt.labelId : flt.labelEn}
                </button>
              ))}
            </div>
          )}

          {activePanel === 'text' && (
            <div className="space-y-1.5 text-[10px]">
              {selectedText ? (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold">Edit Teks Terpilih</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTextId(null)}
                      className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                    >
                      + Buat Baru
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={selectedText.text}
                      onChange={(e) => updateSelectedText({ text: e.target.value })}
                      maxLength={32}
                      className="flex-1 bg-[var(--lcd-bg)] border-2 border-[var(--lcd-fg)] px-1.5 py-1 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTexts((prev) => prev.filter((item) => item.id !== selectedText.id));
                        setSelectedTextId(null);
                      }}
                      className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer"
                    >
                      HAPUS
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['top', 'center', 'bottom'] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => updateSelectedText({ position: pos })}
                        className={`flex-1 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                          selectedText.position === pos ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {pos === 'top' ? 'ATAS' : pos === 'center' ? 'TENGAH' : 'BAWAH'}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateSelectedText({ boxed: !selectedText.boxed })}
                      className={`px-2 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                        selectedText.boxed ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                      }`}
                    >
                      KOTAK
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-20">Durasi: {selectedText.durationSec.toFixed(1)}s</span>
                    <input
                      type="range"
                      min={0.5}
                      max={15}
                      step={0.5}
                      value={selectedText.durationSec}
                      onChange={(e) => updateSelectedText({ durationSec: Number(e.target.value) })}
                      className="flex-1 accent-[var(--lcd-fg)]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      maxLength={32}
                      placeholder="Teks overlay..."
                      className="flex-1 bg-[var(--lcd-bg)] border-2 border-[var(--lcd-fg)] px-1.5 py-1 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!draftText.trim()) return;
                        const newT: EditorTextOverlay = {
                          id: nextUid('txt'),
                          text: draftText.trim(),
                          startSec: Number(playheadRef.current.toFixed(1)),
                          durationSec: 3,
                          position: draftTextPos,
                          boxed: draftTextBoxed,
                        };
                        setTexts((prev) => [...prev, newT]);
                        setSelectedTextId(newT.id);
                        soundEngine.playCue('select');
                      }}
                      className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer"
                    >
                      +TEKS
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['top', 'center', 'bottom'] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setDraftTextPos(pos)}
                        className={`flex-1 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                          draftTextPos === pos ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {pos === 'top' ? 'ATAS' : pos === 'center' ? 'TENGAH' : 'BAWAH'}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDraftTextBoxed((b) => !b)}
                      className={`px-2 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                        draftTextBoxed ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                      }`}
                    >
                      KOTAK
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activePanel === 'audio' && (
            <div className="space-y-1.5 text-[10px]">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="flex-1 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer"
                >
                  + UNGGAH AUDIO
                </button>
                {audioClip && (
                  <button
                    type="button"
                    onClick={() => setAudioClip(null)}
                    className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                  >
                    HAPUS
                  </button>
                )}
              </div>
              {audioClip && (
                <div className="flex items-center gap-2">
                  <span className="font-bold">Vol {Math.round(audioClip.volume * 100)}%</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioClip.volume}
                    onChange={(e) => setAudioClip({ ...audioClip, volume: Number(e.target.value) })}
                    className="flex-1 accent-[var(--lcd-fg)]"
                  />
                </div>
              )}
              {osAudios.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {osAudios.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => selectOsAudio(a)}
                      className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                    >
                      ♪ {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activePanel === 'export' && (
            <div className="space-y-1.5 text-xs">
              {exporting ? (
                <div className="space-y-1">
                  <div className="font-bold tabular-nums">
                    {language === 'id' ? `Merender Video... ${exportProgress}%` : `Rendering Video... ${exportProgress}%`}
                  </div>
                  <div className="w-full h-3 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)]">
                    <div className="h-full bg-[var(--lcd-fg)]" style={{ width: `${exportProgress}%` }} />
                  </div>
                </div>
              ) : exportedVideo ? (
                <div className="space-y-1.5">
                  <div className="font-bold truncate">
                    ✓ {exportedVideo.fileName} ({exportedVideo.sizeKb} KB)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => openApp('video', { fileId: exportedVideo.fileId })}
                      className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                    >
                      PUTAR DI VIDEO
                    </button>
                    <a
                      href={exportedVideo.blobUrl}
                      download={exportedVideo.fileName}
                      className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold text-center cursor-pointer"
                    >
                      UNDUH .WEBM
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Bottom CapCut-Style Toolbar */}
      <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] flex items-center gap-1 p-1 overflow-x-auto lcd-scroll shrink-0">
        {(
          [
            { id: 'media', label: '+Media' },
            { id: 'split', label: 'Split' },
            { id: 'trim', label: 'Trim' },
            { id: 'speed', label: 'Kecepatan' },
            { id: 'filter', label: 'Filter' },
            { id: 'text', label: 'Teks' },
            { id: 'audio', label: 'Audio' },
          ] as const
        ).map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              if (tool.id === 'media') {
                setActivePanel(activePanel === 'media' ? 'none' : 'media');
              } else if (tool.id === 'split') {
                splitAtPlayhead();
              } else if (tool.id === 'trim') {
                if (!selectedClip) {
                  showToast(language === 'id' ? 'Pilih klip dulu' : 'Select a clip first');
                  return;
                }
                setActivePanel(activePanel === 'trim' ? 'none' : 'trim');
              } else if (tool.id === 'speed') {
                if (!selectedClip) return;
                setActivePanel(activePanel === 'speed' ? 'none' : 'speed');
              } else if (tool.id === 'filter') {
                if (!selectedClip) return;
                setActivePanel(activePanel === 'filter' ? 'none' : 'filter');
              } else if (tool.id === 'text') {
                if (activePanel === 'text') {
                  setActivePanel('none');
                } else {
                  setSelectedTextId(null);
                  setActivePanel('text');
                }
              } else if (tool.id === 'audio') {
                setActivePanel(activePanel === 'audio' ? 'none' : 'audio');
              }
            }}
            className={`px-2 py-1.5 border-2 border-[var(--lcd-fg)] text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer ${
              activePanel === tool.id
                ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                : 'bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]'
            }`}
          >
            {tool.label}
          </button>
        ))}
      </div>
    </div>
  );
};
