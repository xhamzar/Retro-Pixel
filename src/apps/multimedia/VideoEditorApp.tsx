'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Copy,
  Download,
  Film,
  FolderPlus,
  Gauge,
  Music,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  GALLERY_ARTWORKS,
  renderArtworkFrameToBuffer,
  type GalleryArtId,
  type GalleryArtPalette,
} from '@/src/components/PixelGalleryArt';
import { AppHeader } from '@/src/core/AppHeader';
import { OS_MUSIC_PRESETS, synthesizeChiptuneWavUrl } from '@/src/services/chiptuneWav';
import { db } from '@/src/services/db';
import { radioEngine } from '@/src/services/radioEngine';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord } from '@/src/types/os';

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';
export type VideoFilterId = 'none' | 'lcd' | 'contrast' | 'vibrant' | 'sepia' | 'invert';
export type TransitionType = 'none' | 'crossfade' | 'fadeBlack' | 'slideLeft' | 'zoom' | 'pixelate';
export type TextStyleType = 'boxed' | 'clean' | 'caption';

export interface EditorVideoClip {
  id: string;
  name: string;
  kind: 'video' | 'image' | 'pixel-anim';
  src: string;
  artId?: GalleryArtId;
  palette?: GalleryArtPalette;
  sourceDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  speed: 0.5 | 1 | 1.5 | 2;
  filter: VideoFilterId;
  brightness: number; // 70..130
  contrast: number; // 70..140
  muted: boolean;
  transitionIn: TransitionType;
  transitionDurSec: number;
}

export interface EditorTextOverlay {
  id: string;
  text: string;
  startSec: number;
  durationSec: number;
  position: 'top' | 'center' | 'bottom';
  style: TextStyleType;
  size: 'sm' | 'md' | 'lg';
}

export interface EditorAudioClip {
  id: string;
  name: string;
  src: string;
  durationSec: number;
  startSec: number;
  volume: number;
  fadeInSec: number;
  fadeOutSec: number;
}

interface ComputedClip extends EditorVideoClip {
  timelineStart: number;
  timelineEnd: number;
  effectiveDuration: number;
}

interface EditorHistorySnapshot {
  aspectRatio: VideoAspectRatio;
  clips: EditorVideoClip[];
  texts: EditorTextOverlay[];
  audioClip: EditorAudioClip | null;
}

type ToolPanel = 'none' | 'media' | 'transition' | 'trim' | 'speed' | 'filter' | 'text' | 'audio' | 'export';
type MediaSourceTab = 'pixel' | 'gallery' | 'device';

const FILTER_OPTIONS: { id: VideoFilterId; labelId: string; labelEn: string; css: string }[] = [
  { id: 'none', labelId: 'Normal', labelEn: 'Normal', css: 'none' },
  { id: 'lcd', labelId: 'LCD 2-Bit', labelEn: 'LCD 2-Bit', css: 'grayscale(1) contrast(1.85) brightness(1.05)' },
  { id: 'contrast', labelId: 'Tajam', labelEn: 'Crisp', css: 'contrast(1.38) saturate(1.12)' },
  { id: 'vibrant', labelId: 'Cerah', labelEn: 'Vivid', css: 'saturate(1.48) contrast(1.12)' },
  { id: 'sepia', labelId: 'Klasik', labelEn: 'Vintage', css: 'sepia(0.95) contrast(1.15)' },
  { id: 'invert', labelId: 'Negatif', labelEn: 'Invert', css: 'invert(1)' },
];

const TRANSITION_OPTIONS: { id: TransitionType; labelId: string; labelEn: string }[] = [
  { id: 'none', labelId: 'Potong', labelEn: 'Cut' },
  { id: 'crossfade', labelId: 'Pudar', labelEn: 'Crossfade' },
  { id: 'fadeBlack', labelId: 'Gelap', labelEn: 'Fade Black' },
  { id: 'slideLeft', labelId: 'Geser', labelEn: 'Slide' },
  { id: 'zoom', labelId: 'Zoom', labelEn: 'Zoom In' },
  { id: 'pixelate', labelId: 'Piksel', labelEn: 'Pixelate' },
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

function drawContainedMedia(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  srcW: number,
  srcH: number,
  cw: number,
  ch: number,
  pixelated = false
) {
  if (!srcW || !srcH) return;
  const scale = Math.min(cw / srcW, ch / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.imageSmoothingEnabled = !pixelated;
  ctx.drawImage(source, dx, dy, dw, dh);
}

function cloneClips(list: EditorVideoClip[]): EditorVideoClip[] {
  return list.map((c) => ({ ...c }));
}

function cloneTexts(list: EditorTextOverlay[]): EditorTextOverlay[] {
  return list.map((t) => ({ ...t }));
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

  // Reusable offscreen canvases for transitions, pixel art rendering & mosaic effects
  const prevLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelArtCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mosaicCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // History Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<EditorHistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorHistorySnapshot[]>([]);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ToolPanel>('none');
  const [mediaTab, setMediaTab] = useState<MediaSourceTab>('pixel');
  const [pixelPaletteChoice, setPixelPaletteChoice] = useState<GalleryArtPalette>('color');

  const [playheadSec, setPlayheadSec] = useState(0);
  const playheadRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // New Text Form
  const [draftText, setDraftText] = useState('RETRO CUT');
  const [draftTextPos, setDraftTextPos] = useState<'top' | 'center' | 'bottom'>('bottom');
  const [draftTextStyle, setDraftTextStyle] = useState<TextStyleType>('boxed');
  const [draftTextSize, setDraftTextSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideo, setExportedVideo] = useState<{
    fileId?: number;
    fileName: string;
    blobUrl: string;
    sizeKb: number;
  } | null>(null);

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

  // Snapshot history helper
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-19),
      {
        aspectRatio,
        clips: cloneClips(clips),
        texts: cloneTexts(texts),
        audioClip: audioClip ? { ...audioClip } : null,
      },
    ]);
    setRedoStack([]);
  }, [aspectRatio, audioClip, clips, texts]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const target = prev[prev.length - 1];
      setRedoStack((rPrev) => [
        ...rPrev.slice(-19),
        {
          aspectRatio,
          clips: cloneClips(clips),
          texts: cloneTexts(texts),
          audioClip: audioClip ? { ...audioClip } : null,
        },
      ]);
      setAspectRatio(target.aspectRatio);
      setClips(cloneClips(target.clips));
      setTexts(cloneTexts(target.texts));
      setAudioClip(target.audioClip ? { ...target.audioClip } : null);
      soundEngine.playCue('back');
      return prev.slice(0, -1);
    });
  }, [aspectRatio, audioClip, clips, texts]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const target = prev[prev.length - 1];
      setUndoStack((uPrev) => [
        ...uPrev.slice(-19),
        {
          aspectRatio,
          clips: cloneClips(clips),
          texts: cloneTexts(texts),
          audioClip: audioClip ? { ...audioClip } : null,
        },
      ]);
      setAspectRatio(target.aspectRatio);
      setClips(cloneClips(target.clips));
      setTexts(cloneTexts(target.texts));
      setAudioClip(target.audioClip ? { ...target.audioClip } : null);
      soundEngine.playCue('click');
      return prev.slice(0, -1);
    });
  }, [aspectRatio, audioClip, clips, texts]);

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

  const selectedClipIndex = useMemo(
    () => (selectedClip ? computedClips.findIndex((c) => c.id === selectedClip.id) : -1),
    [computedClips, selectedClip]
  );

  const selectedText = useMemo(
    () => texts.find((t) => t.id === selectedTextId) ?? null,
    [selectedTextId, texts]
  );

  const renderFrameRef = useRef<(timeSec: number, syncVideoPlay: boolean) => void>(() => undefined);

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

  // Draw a single clip layer (video, image, or live animated pixel art) to a target context
  const drawClipToCtx = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      clip: ComputedClip,
      timelineSec: number,
      w: number,
      h: number,
      syncVideoPlay: boolean
    ) => {
      ctx.save();
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, w, h);

      const filterCfg = FILTER_OPTIONS.find((f) => f.id === clip.filter);
      const baseCss = filterCfg && filterCfg.css !== 'none' ? filterCfg.css : '';
      const adjCss =
        clip.brightness !== 100 || clip.contrast !== 100
          ? `brightness(${(clip.brightness / 100).toFixed(2)}) contrast(${(clip.contrast / 100).toFixed(2)})`
          : '';
      const combinedFilter = [baseCss, adjCss].filter(Boolean).join(' ') || 'none';
      ctx.filter = combinedFilter;

      if (clip.kind === 'pixel-anim' && clip.artId) {
        if (!pixelArtCanvasRef.current) {
          pixelArtCanvasRef.current = document.createElement('canvas');
        }
        const artCanvas = pixelArtCanvasRef.current;
        const artMeta = GALLERY_ARTWORKS.find((a) => a.id === clip.artId) ?? GALLERY_ARTWORKS[0];
        const elapsedLocal = Math.max(0, timelineSec - clip.timelineStart) * clip.speed;
        const frameIdx = artMeta.animated
          ? Math.floor(elapsedLocal * (artMeta.fps || 8)) % (artMeta.totalFrames || 16)
          : 0;
        renderArtworkFrameToBuffer(clip.artId, frameIdx, clip.palette ?? 'color', artCanvas);
        drawContainedMedia(ctx, artCanvas, artCanvas.width, artCanvas.height, w, h, true);
      } else if (clip.kind === 'image') {
        const img = getImageEl(clip.src);
        if (img.complete && img.naturalWidth > 0) {
          drawContainedMedia(ctx, img, img.naturalWidth, img.naturalHeight, w, h, true);
        }
      } else {
        const vid = getVideoEl(clip.src);
        const maxLocal = Math.max(0, (vid.duration || clip.sourceDurationSec) - 0.02);
        const rawLocal = clip.trimStartSec + Math.max(0, timelineSec - clip.timelineStart) * clip.speed;
        const localTime = Math.min(maxLocal, Math.max(0, rawLocal));

        vid.muted = clip.muted || !syncVideoPlay;
        vid.playbackRate = clip.speed;

        const tolerance = syncVideoPlay ? Math.max(0.35, 0.25 * clip.speed) : 0.03;
        if (Math.abs(vid.currentTime - localTime) > tolerance) {
          if (!syncVideoPlay && vid.seeking) {
            pendingVideoSeekRef.current.set(clip.src, localTime);
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
          drawContainedMedia(ctx, vid, vid.videoWidth, vid.videoHeight, w, h, false);
        }
      }

      if (clip.filter === 'lcd') {
        ctx.filter = 'none';
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#9bbc0f';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.restore();
    },
    [getImageEl, getVideoEl]
  );

  // Composite frame drawer with real transition engine + styled text overlays
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
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, w, h);

      const activeIdx = computedClips.findIndex(
        (c) => timeSec >= c.timelineStart && timeSec <= c.timelineEnd + 0.02
      );
      const activeClip = activeIdx >= 0 ? computedClips[activeIdx] : undefined;

      if (!activeClip) {
        if (computedClips.length > 0) {
          ctx.fillStyle = '#d8ff9a';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(language === 'id' ? 'AKHIR TIMELINE' : 'END OF TIMELINE', w / 2, h / 2);
        }
      } else {
        const prevClip = activeIdx > 0 ? computedClips[activeIdx - 1] : undefined;
        const maxTrans = prevClip
          ? Math.min(activeClip.transitionDurSec, prevClip.effectiveDuration * 0.6, activeClip.effectiveDuration * 0.6)
          : 0;
        const intoClipSec = timeSec - activeClip.timelineStart;

        if (prevClip && activeClip.transitionIn !== 'none' && maxTrans > 0.08 && intoClipSec < maxTrans) {
          const tProgress = Math.max(0, Math.min(1, intoClipSec / maxTrans));
          if (!prevLayerCanvasRef.current) prevLayerCanvasRef.current = document.createElement('canvas');
          if (!nextLayerCanvasRef.current) nextLayerCanvasRef.current = document.createElement('canvas');
          const prevCvs = prevLayerCanvasRef.current;
          const nextCvs = nextLayerCanvasRef.current;
          if (prevCvs.width !== w || prevCvs.height !== h) {
            prevCvs.width = w;
            prevCvs.height = h;
          }
          if (nextCvs.width !== w || nextCvs.height !== h) {
            nextCvs.width = w;
            nextCvs.height = h;
          }

          const pCtx = prevCvs.getContext('2d');
          const nCtx = nextCvs.getContext('2d');
          if (pCtx && nCtx) {
            drawClipToCtx(pCtx, prevClip, Math.max(prevClip.timelineStart, prevClip.timelineEnd - 0.02), w, h, false);
            drawClipToCtx(nCtx, activeClip, timeSec, w, h, syncVideoPlay);

            const mode = activeClip.transitionIn;
            if (mode === 'crossfade') {
              ctx.drawImage(prevCvs, 0, 0);
              ctx.globalAlpha = tProgress;
              ctx.drawImage(nextCvs, 0, 0);
              ctx.globalAlpha = 1;
            } else if (mode === 'fadeBlack') {
              if (tProgress < 0.5) {
                ctx.globalAlpha = 1 - tProgress * 2;
                ctx.drawImage(prevCvs, 0, 0);
              } else {
                ctx.globalAlpha = (tProgress - 0.5) * 2;
                ctx.drawImage(nextCvs, 0, 0);
              }
              ctx.globalAlpha = 1;
            } else if (mode === 'slideLeft') {
              const shift = Math.round(w * tProgress);
              ctx.drawImage(prevCvs, -shift, 0);
              ctx.drawImage(nextCvs, w - shift, 0);
            } else if (mode === 'zoom') {
              ctx.globalAlpha = 1 - tProgress;
              ctx.drawImage(prevCvs, 0, 0);
              const zoomScale = 1.32 - 0.32 * tProgress;
              const zw = w * zoomScale;
              const zh = h * zoomScale;
              ctx.globalAlpha = tProgress;
              ctx.drawImage(nextCvs, (w - zw) / 2, (h - zh) / 2, zw, zh);
              ctx.globalAlpha = 1;
            } else if (mode === 'pixelate') {
              if (!mosaicCanvasRef.current) mosaicCanvasRef.current = document.createElement('canvas');
              const mCvs = mosaicCanvasRef.current;
              const peak = 1 - Math.abs(tProgress - 0.5) * 2; // 0 -> 1 -> 0
              const block = Math.max(1, Math.round(1 + peak * 18));
              const mw = Math.max(8, Math.round(w / block));
              const mh = Math.max(6, Math.round(h / block));
              mCvs.width = mw;
              mCvs.height = mh;
              const mCtx = mCvs.getContext('2d');
              if (mCtx) {
                mCtx.imageSmoothingEnabled = false;
                mCtx.drawImage(tProgress < 0.5 ? prevCvs : nextCvs, 0, 0, mw, mh);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(mCvs, 0, 0, w, h);
              }
            }
          }
        } else {
          drawClipToCtx(ctx, activeClip, timeSec, w, h, syncVideoPlay);
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
        style: TextStyleType,
        size: 'sm' | 'md' | 'lg',
        isPreviewDraft = false
      ) => {
        const fontSize = size === 'sm' ? 15 : size === 'lg' ? 25 : 20;
        const y = position === 'top' ? 32 : position === 'center' ? h / 2 : h - 30;
        ctx.save();
        if (isPreviewDraft) ctx.globalAlpha = 0.8;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(textValue);

        if (style === 'boxed') {
          const padX = 12;
          const boxH = fontSize + 12;
          const boxW = Math.min(w - 16, metrics.width + padX * 2);
          ctx.fillStyle = '#000000';
          ctx.fillRect(w / 2 - boxW / 2, y - boxH / 2, boxW, boxH);
          ctx.strokeStyle = '#d8ff9a';
          ctx.lineWidth = 2;
          ctx.strokeRect(w / 2 - boxW / 2, y - boxH / 2, boxW, boxH);
          ctx.fillStyle = '#d8ff9a';
        } else if (style === 'caption') {
          const boxH = fontSize + 10;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
          ctx.fillRect(0, y - boxH / 2, w, boxH);
          ctx.fillStyle = '#fef08a';
        } else {
          ctx.fillStyle = '#000000';
          ctx.fillText(textValue, w / 2 + 2, y + 2, w - 24);
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillText(textValue, w / 2, y, w - 24);
        ctx.restore();
      };

      for (const txt of activeTexts) {
        drawOverlayText(txt.text, txt.position, txt.style, txt.size, false);
      }

      if (!exporting && activePanel === 'text' && !selectedText && draftText.trim()) {
        drawOverlayText(draftText.trim(), draftTextPos, draftTextStyle, draftTextSize, true);
      }

      ctx.restore();
    },
    [
      activePanel,
      aspectRatio,
      computedClips,
      draftText,
      draftTextPos,
      draftTextSize,
      draftTextStyle,
      drawClipToCtx,
      exporting,
      language,
      selectedText,
      texts,
    ]
  );

  useEffect(() => {
    renderFrameRef.current = renderCompositeFrame;
  }, [renderCompositeFrame]);

  // Load OS media library on mount
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
                brightness: 100,
                contrast: 100,
                muted: false,
                transitionIn: 'none',
                transitionDurSec: 0.6,
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

  const seekPlayhead = useCallback((sec: number, renderNow = false) => {
    const clamped = Math.max(0, Math.min(totalDurationRef.current || sec, sec));
    playheadRef.current = clamped;
    setPlayheadSec(clamped);
    if (renderNow && !exportingRef.current) {
      renderFrameRef.current(clamped, isPlayingRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying && !exporting) {
      renderCompositeFrame(playheadSec, false);
    }
  }, [exporting, isPlaying, playheadSec, renderCompositeFrame]);

  // Ref-driven 60fps real-time playback loop with audio fade support
  useEffect(() => {
    if (!isPlaying || exporting) return;
    if (totalDurationRef.current <= 0) {
      Promise.resolve().then(() => setIsPlaying(false));
      return;
    }

    radioEngine.pauseForCompetingMedia();

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
      const total = Math.max(0.5, totalDurationRef.current);
      let gainMul = 1;
      if (aClip.fadeInSec > 0 && t < aClip.fadeInSec) {
        gainMul = Math.max(0, t / aClip.fadeInSec);
      }
      if (aClip.fadeOutSec > 0 && t > total - aClip.fadeOutSec) {
        gainMul = Math.min(gainMul, Math.max(0, (total - t) / aClip.fadeOutSec));
      }
      audioEl.volume = Math.max(0, Math.min(1, aClip.volume * gainMul));

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

  // Add video or photo from local device
  const handleUploadMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    pushUndo();
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
            brightness: 100,
            contrast: 100,
            muted: false,
            transitionIn: prev.length > 0 ? 'crossfade' : 'none',
            transitionDurSec: 0.6,
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
              brightness: 100,
              contrast: 100,
              muted: false,
              transitionIn: prev.length > 0 ? 'crossfade' : 'none',
              transitionDurSec: 0.6,
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
    pushUndo();
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
          brightness: 100,
          contrast: 100,
          muted: false,
          transitionIn: prev.length > 0 ? 'crossfade' : 'none',
          transitionDurSec: 0.6,
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
            brightness: 100,
            contrast: 100,
            muted: false,
            transitionIn: prev.length > 0 ? 'crossfade' : 'none',
            transitionDurSec: 0.6,
          },
        ]);
        setSelectedClipId(id);
        setActivePanel('none');
      };
    }
  };

  // Add animated or static Pixel Gallery Art clip
  const addPixelArtClip = (artId: GalleryArtId) => {
    const meta = GALLERY_ARTWORKS.find((a) => a.id === artId);
    if (!meta) return;
    pushUndo();
    const id = nextUid('px');
    setClips((prev) => [
      ...prev,
      {
        id,
        name: language === 'id' ? meta.titleId : meta.titleEn,
        kind: 'pixel-anim',
        src: `pixel:${artId}`,
        artId,
        palette: pixelPaletteChoice,
        sourceDurationSec: 15,
        trimStartSec: 0,
        trimEndSec: 4,
        speed: 1,
        filter: 'none',
        brightness: 100,
        contrast: 100,
        muted: false,
        transitionIn: prev.length > 0 ? 'crossfade' : 'none',
        transitionDurSec: 0.6,
      },
    ]);
    setSelectedClipId(id);
    soundEngine.playCue('select');
    setActivePanel('none');
  };

  // Load 1-click starter pixel movie project
  const loadDemoProject = () => {
    pushUndo();
    const c1: EditorVideoClip = {
      id: nextUid('demo1'),
      name: 'Malam Hujan Neon',
      kind: 'pixel-anim',
      src: 'pixel:rain-cyber',
      artId: 'rain-cyber',
      palette: 'color',
      sourceDurationSec: 15,
      trimStartSec: 0,
      trimEndSec: 4,
      speed: 1,
      filter: 'none',
      brightness: 100,
      contrast: 100,
      muted: false,
      transitionIn: 'none',
      transitionDurSec: 0.6,
    };
    const c2: EditorVideoClip = {
      id: nextUid('demo2'),
      name: 'Api Unggun Hutan',
      kind: 'pixel-anim',
      src: 'pixel:campfire',
      artId: 'campfire',
      palette: 'color',
      sourceDurationSec: 15,
      trimStartSec: 0,
      trimEndSec: 4,
      speed: 1,
      filter: 'none',
      brightness: 100,
      contrast: 100,
      muted: false,
      transitionIn: 'crossfade',
      transitionDurSec: 0.8,
    };
    const c3: EditorVideoClip = {
      id: nextUid('demo3'),
      name: 'Jelajah Angkasa',
      kind: 'pixel-anim',
      src: 'pixel:space-ship',
      artId: 'space-ship',
      palette: 'color',
      sourceDurationSec: 15,
      trimStartSec: 0,
      trimEndSec: 4,
      speed: 1,
      filter: 'none',
      brightness: 100,
      contrast: 100,
      muted: false,
      transitionIn: 'pixelate',
      transitionDurSec: 0.8,
    };

    setClips([c1, c2, c3]);
    setSelectedClipId(c1.id);
    setTexts([
      {
        id: nextUid('txt'),
        text: 'PIXEL STORY',
        startSec: 0.4,
        durationSec: 3.2,
        position: 'bottom',
        style: 'boxed',
        size: 'md',
      },
    ]);

    const synth = synthesizeChiptuneWavUrl('os-lagu-favorit');
    if (synth) {
      setAudioClip({
        id: nextUid('osmus'),
        name: synth.name,
        src: synth.url,
        durationSec: synth.durationSec,
        startSec: 0,
        volume: 0.75,
        fadeInSec: 0.5,
        fadeOutSec: 1.0,
      });
    }
    seekPlayhead(0, true);
    soundEngine.playCue('notify');
    showToast(language === 'id' ? 'Contoh proyek dimuat!' : 'Demo project loaded!');
  };

  // Upload or select Audio track
  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pushUndo();
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
        fadeInSec: 0.5,
        fadeOutSec: 1.0,
      });
      soundEngine.playCue('select');
      showToast(language === 'id' ? `Audio ditambahkan: ${file.name}` : `Audio added: ${file.name}`);
    };
    e.target.value = '';
  };

  const selectOsAudio = (file: VirtualFileRecord) => {
    pushUndo();
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
        fadeInSec: 0.5,
        fadeOutSec: 1.0,
      });
      soundEngine.playCue('select');
      setActivePanel('none');
      showToast(language === 'id' ? `Musik dipilih: ${file.name}` : `Music set: ${file.name}`);
    };
  };

  const selectBuiltInMusic = (presetId: string) => {
    const synth = synthesizeChiptuneWavUrl(presetId);
    if (!synth) return;
    pushUndo();
    setAudioClip({
      id: nextUid('osmus'),
      name: synth.name,
      src: synth.url,
      durationSec: synth.durationSec,
      startSec: 0,
      volume: 0.8,
      fadeInSec: 0.5,
      fadeOutSec: 1.0,
    });
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Musik OS dipilih: ${synth.name}` : `OS Music set: ${synth.name}`);
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
          ? 'Geser playhead ke tengah klip untuk Split!'
          : 'Move playhead inside a clip to split!'
      );
      return;
    }

    pushUndo();
    const offsetEffective = curSec - target.timelineStart;
    const splitSourceSec = Number((target.trimStartSec + offsetEffective * target.speed).toFixed(2));
    const leftClip: EditorVideoClip = {
      ...target,
      trimEndSec: target.kind === 'video' ? splitSourceSec : Number(offsetEffective.toFixed(2)),
    };
    const rightClip: EditorVideoClip = {
      ...target,
      id: nextUid('split'),
      name: `${target.name} (2)`,
      trimStartSec: target.kind === 'video' ? splitSourceSec : 0,
      trimEndSec:
        target.kind === 'video'
          ? target.trimEndSec
          : Math.max(0.5, Number((target.effectiveDuration - offsetEffective).toFixed(2))),
      transitionIn: 'none',
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

  const applyTransitionToAll = (type: TransitionType, durSec: number) => {
    if (clips.length < 2) return;
    pushUndo();
    setClips((prev) =>
      prev.map((c, idx) => (idx === 0 ? c : { ...c, transitionIn: type, transitionDurSec: durSec }))
    );
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Transisi diterapkan ke semua klip' : 'Transition applied to all');
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
    pushUndo();
    soundEngine.playCue('click');
    const copy = [...clips];
    [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
    // First clip never plays an incoming transition from void
    const normalized = copy.map((c, i) => (i === 0 ? { ...c, transitionIn: 'none' as TransitionType } : c));
    setClips(normalized);
  };

  const duplicateSelectedClip = () => {
    if (!selectedClip) return;
    const idx = clips.findIndex((c) => c.id === selectedClip.id);
    if (idx < 0) return;
    pushUndo();
    const copy: EditorVideoClip = {
      ...clips[idx],
      id: nextUid('dup'),
      name: `${clips[idx].name} (Salin)`,
    };
    setClips((prev) => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
    setSelectedClipId(copy.id);
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Klip diduplikasi' : 'Clip duplicated');
  };

  const deleteSelectedClip = () => {
    if (!selectedClip) return;
    pushUndo();
    soundEngine.playCue('back');
    setClips((prev) =>
      prev
        .filter((c) => c.id !== selectedClip.id)
        .map((c, i) => (i === 0 ? { ...c, transitionIn: 'none' as TransitionType } : c))
    );
    setSelectedClipId(null);
    setActivePanel('none');
  };

  const resetProject = () => {
    pushUndo();
    setIsPlaying(false);
    setClips([]);
    setTexts([]);
    setAudioClip(null);
    setSelectedClipId(null);
    setSelectedTextId(null);
    setExportedVideo(null);
    seekPlayhead(0, true);
    setActivePanel('none');
    soundEngine.playCue('back');
    showToast(language === 'id' ? 'Proyek direset' : 'Project reset');
  };

  const jumpClipOffset = (dir: -1 | 1) => {
    if (computedClips.length === 0) return;
    const cur = selectedClipIndex >= 0 ? selectedClipIndex : 0;
    const nextIdx = Math.max(0, Math.min(computedClips.length - 1, cur + dir));
    const target = computedClips[nextIdx];
    setSelectedClipId(target.id);
    setIsPlaying(false);
    seekPlayhead(target.timelineStart, true);
    soundEngine.playCue('click');
  };

  // Real .WebM Render & Export Pipeline with Audio Fade In/Out
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

    radioEngine.pauseForCompetingMedia();
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
          const nowCtx = audioCtx.currentTime;
          const vol = audioClip.volume;

          if (audioClip.fadeInSec > 0) {
            gainNode.gain.setValueAtTime(0.01, nowCtx);
            gainNode.gain.linearRampToValueAtTime(vol, nowCtx + Math.min(audioClip.fadeInSec, totalDuration * 0.5));
          } else {
            gainNode.gain.setValueAtTime(vol, nowCtx);
          }

          if (audioClip.fadeOutSec > 0 && totalDuration > audioClip.fadeOutSec) {
            const fadeStart = nowCtx + Math.max(0, totalDuration - audioClip.fadeOutSec);
            gainNode.gain.setValueAtTime(vol, fadeStart);
            gainNode.gain.linearRampToValueAtTime(0.005, nowCtx + totalDuration);
          }

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
    pushUndo();
    soundEngine.playCue('click');
    const order: VideoAspectRatio[] = ['16:9', '9:16', '1:1'];
    setAspectRatio(order[(order.indexOf(aspectRatio) + 1) % order.length]);
  };

  const playheadPct = totalDuration > 0 ? Math.min(100, Math.max(0, (playheadSec / totalDuration) * 100)) : 0;

  const panelTitleMap: Record<ToolPanel, string> = {
    none: '',
    media: language === 'id' ? 'Tambah Media' : 'Add Media',
    transition: language === 'id' ? 'Transisi Antar Klip' : 'Clip Transition',
    trim: language === 'id' ? 'Pangkas & Atur Urutan' : 'Trim & Reorder',
    speed: language === 'id' ? 'Kecepatan & Warna' : 'Speed & Palette',
    filter: language === 'id' ? 'Filter & Pencahayaan' : 'Filter & Light',
    text: language === 'id' ? 'Teks Overlay' : 'Text Overlay',
    audio: language === 'id' ? 'Musik OS & Audio' : 'OS Music & Audio',
    export: language === 'id' ? 'Ekspor Video (.webm)' : 'Export Video',
  };

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

      {/* Top Transport Bar: Ratio, Undo/Redo, Timecode, Export */}
      <div className="flex items-center justify-between gap-1 px-2 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold shrink-0 tabular-nums">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={cycleAspectRatio}
            className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer whitespace-nowrap"
            title={language === 'id' ? 'Rasio Kanvas' : 'Canvas Ratio'}
          >
            {aspectRatio}
          </button>
          <button
            type="button"
            disabled={undoStack.length === 0 || exporting}
            onClick={handleUndo}
            title="Undo"
            className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] disabled:opacity-40 cursor-pointer"
          >
            <Undo2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled={redoStack.length === 0 || exporting}
            onClick={handleRedo}
            title="Redo"
            className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] disabled:opacity-40 cursor-pointer"
          >
            <Redo2 className="w-3 h-3" />
          </button>
        </div>

        <span className="truncate">
          {fmtSec(playheadSec)} / {fmtSec(totalDuration)}
        </span>

        <button
          type="button"
          disabled={exporting}
          onClick={() => void startExportWebM()}
          className="px-2 py-0.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {exporting ? `${exportProgress}%` : 'EKSPOR'}
        </button>
      </div>

      {/* Preview Canvas Monitor */}
      <div className="flex-1 min-h-[115px] bg-[#070b14] flex items-center justify-center p-1.5 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full border border-[var(--lcd-fg)]/40 bg-[#070b14] object-contain"
        />

        {/* Beginner Friendly Empty-State Quick Actions */}
        {computedClips.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 bg-[#070b14]/90 text-[#D8FF9A]">
            <p className="text-[11px] font-bold text-center">
              {language === 'id' ? 'Mulai Buat Video Piksel Anda' : 'Start Your Pixel Video'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  setActivePanel('media');
                }}
                className="px-2.5 py-1.5 border-2 border-[#D8FF9A] bg-[#D8FF9A] text-black text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Tambah Media</span>
              </button>
              <button
                type="button"
                onClick={loadDemoProject}
                className="px-2.5 py-1.5 border-2 border-[#D8FF9A] bg-black text-[#D8FF9A] text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Contoh Proyek</span>
              </button>
            </div>
          </div>
        )}

        {/* Active Clip Indicator */}
        {selectedClip && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 border border-[#D8FF9A]/60 text-[#D8FF9A] text-[9px] font-bold tabular-nums pointer-events-none">
            {selectedClip.speed}x · {FILTER_OPTIONS.find((f) => f.id === selectedClip.filter)?.labelId}
            {selectedClipIndex > 0 && selectedClip.transitionIn !== 'none'
              ? ` · ${TRANSITION_OPTIONS.find((tr) => tr.id === selectedClip.transitionIn)?.labelId}`
              : ''}
          </div>
        )}
      </div>

      {/* Transport + Scrubber Bar */}
      <div className="px-2 py-1 bg-[var(--lcd-sec)] border-t-2 border-[var(--lcd-fg)] flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          disabled={computedClips.length === 0 || exporting}
          onClick={() => setIsPlaying((p) => !p)}
          title={isPlaying ? 'Jeda' : 'Putar'}
          className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] disabled:opacity-40 cursor-pointer"
        >
          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </button>
        <button
          type="button"
          disabled={computedClips.length === 0 || exporting}
          onClick={() => jumpClipOffset(-1)}
          title={language === 'id' ? 'Klip Sebelumnya' : 'Previous Clip'}
          className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] disabled:opacity-40 cursor-pointer"
        >
          <SkipBack className="w-3 h-3" />
        </button>
        <button
          type="button"
          disabled={computedClips.length === 0 || exporting}
          onClick={() => jumpClipOffset(1)}
          title={language === 'id' ? 'Klip Berikutnya' : 'Next Clip'}
          className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] disabled:opacity-40 cursor-pointer"
        >
          <SkipForward className="w-3 h-3" />
        </button>

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

        <button
          type="button"
          disabled={computedClips.length === 0 || exporting}
          onClick={splitAtPlayhead}
          title={language === 'id' ? 'Split di Playhead' : 'Split at Playhead'}
          className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[9px] font-bold flex items-center gap-0.5 disabled:opacity-40 cursor-pointer"
        >
          <Scissors className="w-3 h-3" />
          <span className="hidden sm:inline">Split</span>
        </button>
      </div>

      {/* Multi-Track CapCut Visual Timeline */}
      <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-1.5 space-y-1 shrink-0 max-h-[116px] overflow-y-auto lcd-scroll relative">
        {totalDuration > 0 && (
          <div className="w-full h-1.5 bg-[var(--lcd-sec)] border border-[var(--lcd-fg)] relative overflow-hidden">
            <div className="h-full bg-[var(--lcd-fg)]" style={{ width: `${playheadPct}%` }} />
          </div>
        )}

        {/* Track V1: Clips + Inline Transition Connectors */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-5 font-bold shrink-0">V1</span>
          <div className="flex-1 flex items-center gap-0.5 overflow-x-auto lcd-scroll pb-0.5">
            {computedClips.length === 0 ? (
              <button
                type="button"
                onClick={() => setActivePanel('media')}
                className="px-2 py-1 border border-dashed border-[var(--lcd-fg)] text-[10px] opacity-85 cursor-pointer"
              >
                + Tambah Video / Foto / Piksel
              </button>
            ) : (
              computedClips.map((c, idx) => {
                const isSel = selectedClip?.id === c.id;
                const isActive = playheadSec >= c.timelineStart && playheadSec <= c.timelineEnd;
                const hasTrans = c.transitionIn !== 'none';
                const kindTag = c.kind === 'pixel-anim' ? 'ANIM' : c.kind === 'image' ? 'IMG' : 'VID';

                return (
                  <React.Fragment key={c.id}>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playCue('click');
                          setSelectedClipId(c.id);
                          setActivePanel('transition');
                          if (!isPlaying) {
                            seekPlayhead(c.timelineStart + 0.15, true);
                          }
                        }}
                        title={
                          language === 'id'
                            ? `Atur Transisi (${TRANSITION_OPTIONS.find((tr) => tr.id === c.transitionIn)?.labelId})`
                            : 'Set Transition'
                        }
                        className={`px-1 py-1 border text-[9px] font-bold shrink-0 cursor-pointer ${
                          hasTrans
                            ? 'border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                            : 'border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)] opacity-75 hover:opacity-100'
                        }`}
                      >
                        ◊
                      </button>
                    )}
                    <button
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
                      {kindTag}·{c.name.slice(0, 8)} ({c.effectiveDuration}s)
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Track T1: Text Overlays */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-5 font-bold shrink-0">T1</span>
          <div className="flex-1 flex items-center gap-1 overflow-x-auto lcd-scroll">
            {texts.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedTextId(null);
                  setActivePanel('text');
                }}
                className="text-[9px] opacity-70 underline cursor-pointer"
              >
                + {language === 'id' ? 'Tambah Teks Overlay' : 'Add Text Overlay'}
              </button>
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
                  className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[9px] font-bold shrink-0 cursor-pointer tabular-nums ${
                    selectedTextId === t.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                  }`}
                >
                  T: {t.text.slice(0, 10)} ({t.startSec.toFixed(1)}s)
                </button>
              ))
            )}
          </div>
        </div>

        {/* Track A1: Audio */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-5 font-bold shrink-0">A1</span>
          {audioClip ? (
            <button
              type="button"
              onClick={() => setActivePanel('audio')}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[9px] font-bold truncate cursor-pointer tabular-nums"
            >
              ♪ {audioClip.name} · {Math.round(audioClip.volume * 100)}%
              {audioClip.fadeInSec > 0 || audioClip.fadeOutSec > 0 ? ' · Fade' : ''}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActivePanel('audio')}
              className="text-[9px] opacity-70 underline cursor-pointer"
            >
              + {language === 'id' ? 'Tambah Musik OS / Audio' : 'Add OS Music / Audio'}
            </button>
          )}
        </div>
      </div>

      {/* Contextual CapCut-Style Drawer Panel */}
      {activePanel !== 'none' && (
        <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 max-h-[180px] overflow-y-auto lcd-scroll space-y-1.5 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-bold border-b border-[var(--lcd-fg)]/30 pb-1">
            <span>{panelTitleMap[activePanel]}</span>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer"
            >
              {language === 'id' ? 'Tutup ×' : 'Close ×'}
            </button>
          </div>

          {activePanel === 'media' && (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'pixel', label: language === 'id' ? 'Pixel Animasi' : 'Pixel Anim' },
                    { id: 'gallery', label: language === 'id' ? 'Galeri & Video' : 'Gallery' },
                    { id: 'device', label: language === 'id' ? 'Perangkat' : 'Device' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playCue('click');
                      setMediaTab(t.id);
                    }}
                    className={`flex-1 py-1 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                      mediaTab === t.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {mediaTab === 'pixel' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold">
                      {language === 'id' ? 'Pilih adegan (Animasi / Piksel):' : 'Pick pixel scene:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPixelPaletteChoice((p) => (p === 'color' ? 'lcd' : 'color'))}
                      className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                    >
                      {pixelPaletteChoice === 'color' ? 'RGB' : 'LCD'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {GALLERY_ARTWORKS.map((art) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => addPixelArtClip(art.id)}
                        className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-left text-[10px] font-bold cursor-pointer flex items-center justify-between gap-1"
                      >
                        <span className="truncate">+{language === 'id' ? art.titleId : art.titleEn}</span>
                        <span className="text-[8px] opacity-70 shrink-0">{art.animated ? 'ANIM' : 'PX'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mediaTab === 'gallery' && (
                <div className="space-y-1.5 text-[10px]">
                  {osVideos.length === 0 && osPhotos.length === 0 ? (
                    <p className="opacity-75 py-1">
                      {language === 'id' ? 'Belum ada berkas Video/DCIM tersimpan.' : 'No OS Video/DCIM files found.'}
                    </p>
                  ) : (
                    <>
                      {osVideos.length > 0 && (
                        <div>
                          <div className="font-bold mb-0.5">Video OS ({osVideos.length}):</div>
                          <div className="flex flex-wrap gap-1">
                            {osVideos.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => addOsMediaFile(v)}
                                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                              >
                                +{v.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {osPhotos.length > 0 && (
                        <div>
                          <div className="font-bold mb-0.5">Foto Galeri DCIM ({osPhotos.length}):</div>
                          <div className="flex flex-wrap gap-1">
                            {osPhotos.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addOsMediaFile(p)}
                                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                              >
                                +{p.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {mediaTab === 'device' && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    className="w-full py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{language === 'id' ? 'UNGGAH VIDEO / FOTO PERANGKAT' : 'UPLOAD VIDEO / PHOTO'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadDemoProject}
                    className="w-full py-1.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                  >
                    + {language === 'id' ? 'Muat Contoh Proyek (3 Klip + Musik)' : 'Load Demo Project'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activePanel === 'transition' && (
            <div className="space-y-1.5 text-[10px]">
              {!selectedClip || clips.length < 2 ? (
                <p className="font-bold py-1">
                  {language === 'id'
                    ? 'Tambahkan minimal 2 klip di linimasa untuk memberi transisi.'
                    : 'Add at least 2 clips to apply transitions.'}
                </p>
              ) : selectedClipIndex === 0 ? (
                <div className="space-y-1">
                  <p className="font-bold">
                    {language === 'id'
                      ? 'Transisi berlaku di awal klip ke-2 dst. Pilih klip berikutnya:'
                      : 'Transitions apply before clip #2+. Select next clip:'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const next = computedClips[1];
                      if (next) {
                        setSelectedClipId(next.id);
                        seekPlayhead(next.timelineStart + 0.15, true);
                      }
                    }}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer"
                  >
                    Pilih Klip #2 ({computedClips[1].name})
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1">
                    {TRANSITION_OPTIONS.map((tr) => (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => {
                          pushUndo();
                          soundEngine.playCue('click');
                          updateSelectedClip({ transitionIn: tr.id });
                          seekPlayhead(selectedClip.timelineStart + 0.25, true);
                        }}
                        className={`py-1 border-2 border-[var(--lcd-fg)] font-bold cursor-pointer ${
                          selectedClip.transitionIn === tr.id
                            ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                            : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {language === 'id' ? tr.labelId : tr.labelEn}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <div className="flex items-center gap-1">
                      <span className="font-bold">Durasi:</span>
                      {[0.4, 0.6, 0.8, 1.0].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateSelectedClip({ transitionDurSec: d })}
                          className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] font-bold tabular-nums cursor-pointer ${
                            selectedClip.transitionDurSec === d
                              ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                              : 'bg-[var(--lcd-bg)]'
                          }`}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        applyTransitionToAll(selectedClip.transitionIn, selectedClip.transitionDurSec)
                      }
                      className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                    >
                      Semua Klip
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activePanel === 'trim' && selectedClip && (
            <div className="space-y-1.5 text-[10px]">
              {selectedClip.kind === 'image' || selectedClip.kind === 'pixel-anim' ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold tabular-nums">
                    Durasi Klip: {selectedClip.trimEndSec.toFixed(1)}s
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={0.5}
                    value={selectedClip.trimEndSec}
                    onChange={(e) => updateSelectedClip({ trimEndSec: Number(e.target.value) })}
                    className="flex-1 accent-[var(--lcd-fg)]"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-20 font-bold tabular-nums">
                      Mulai: {selectedClip.trimStartSec.toFixed(1)}s
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, selectedClip.trimEndSec - 0.5)}
                      step={0.1}
                      value={selectedClip.trimStartSec}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSelectedClip({ trimStartSec: val });
                        if (!isPlaying) seekPlayhead(selectedClip.timelineStart, false);
                      }}
                      className="flex-1 accent-[var(--lcd-fg)]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 font-bold tabular-nums">
                      Akhir: {selectedClip.trimEndSec.toFixed(1)}s
                    </span>
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
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={selectedClipIndex <= 0}
                  onClick={() => moveSelectedClip(-1)}
                  className="flex-1 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold flex items-center justify-center gap-0.5 disabled:opacity-40 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Geser</span>
                </button>
                <button
                  type="button"
                  disabled={selectedClipIndex < 0 || selectedClipIndex >= clips.length - 1}
                  onClick={() => moveSelectedClip(1)}
                  className="flex-1 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold flex items-center justify-center gap-0.5 disabled:opacity-40 cursor-pointer"
                >
                  <span>Geser</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={duplicateSelectedClip}
                  title="Duplikat Klip"
                  className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </button>
                {selectedClip.kind === 'video' && (
                  <button
                    type="button"
                    onClick={() => updateSelectedClip({ muted: !selectedClip.muted })}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    {selectedClip.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={deleteSelectedClip}
                  title="Hapus Klip"
                  className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {activePanel === 'speed' && selectedClip && (
            <div className="space-y-1.5 text-[10px]">
              <div className="grid grid-cols-4 gap-1">
                {([0.5, 1, 1.5, 2] as const).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => {
                      pushUndo();
                      soundEngine.playCue('click');
                      updateSelectedClip({ speed: spd });
                    }}
                    className={`py-1.5 border-2 border-[var(--lcd-fg)] text-xs font-bold tabular-nums cursor-pointer ${
                      selectedClip.speed === spd
                        ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                        : 'bg-[var(--lcd-bg)]'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
              {selectedClip.kind === 'pixel-anim' && (
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold">Palet Pixel:</span>
                  <div className="flex gap-1">
                    {(['color', 'lcd'] as const).map((pal) => (
                      <button
                        key={pal}
                        type="button"
                        onClick={() => updateSelectedClip({ palette: pal })}
                        className={`px-2 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                          (selectedClip.palette ?? 'color') === pal
                            ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                            : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {pal === 'color' ? 'RGB Warna' : 'LCD OS'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activePanel === 'filter' && selectedClip && (
            <div className="space-y-1.5 text-[10px]">
              <div className="grid grid-cols-3 gap-1">
                {FILTER_OPTIONS.map((flt) => (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playCue('click');
                      updateSelectedClip({ filter: flt.id });
                    }}
                    className={`py-1 border-2 border-[var(--lcd-fg)] font-bold cursor-pointer ${
                      selectedClip.filter === flt.id
                        ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                        : 'bg-[var(--lcd-bg)]'
                    }`}
                  >
                    {language === 'id' ? flt.labelId : flt.labelEn}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 font-bold tabular-nums">Cahaya: {selectedClip.brightness}%</span>
                <input
                  type="range"
                  min={70}
                  max={130}
                  step={5}
                  value={selectedClip.brightness}
                  onChange={(e) => updateSelectedClip({ brightness: Number(e.target.value) })}
                  className="flex-1 accent-[var(--lcd-fg)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 font-bold tabular-nums">Kontras: {selectedClip.contrast}%</span>
                <input
                  type="range"
                  min={70}
                  max={140}
                  step={5}
                  value={selectedClip.contrast}
                  onChange={(e) => updateSelectedClip({ contrast: Number(e.target.value) })}
                  className="flex-1 accent-[var(--lcd-fg)]"
                />
                <button
                  type="button"
                  onClick={() => updateSelectedClip({ filter: 'none', brightness: 100, contrast: 100 })}
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                >
                  Reset
                </button>
              </div>
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
                        pushUndo();
                        setTexts((prev) => prev.filter((item) => item.id !== selectedText.id));
                        setSelectedTextId(null);
                      }}
                      className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                    {(['boxed', 'clean', 'caption'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => updateSelectedText({ style: st })}
                        className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                          selectedText.style === st ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {st === 'boxed' ? 'KOTAK' : st === 'clean' ? 'POLOS' : 'SUB'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-20 tabular-nums">Durasi: {selectedText.durationSec.toFixed(1)}s</span>
                    <input
                      type="range"
                      min={0.5}
                      max={15}
                      step={0.5}
                      value={selectedText.durationSec}
                      onChange={(e) => updateSelectedText({ durationSec: Number(e.target.value) })}
                      className="flex-1 accent-[var(--lcd-fg)]"
                    />
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => updateSelectedText({ size: sz })}
                        className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] font-bold uppercase cursor-pointer ${
                          selectedText.size === sz ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
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
                        pushUndo();
                        const newT: EditorTextOverlay = {
                          id: nextUid('txt'),
                          text: draftText.trim(),
                          startSec: Number(playheadRef.current.toFixed(1)),
                          durationSec: 3,
                          position: draftTextPos,
                          style: draftTextStyle,
                          size: draftTextSize,
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
                    {(['boxed', 'clean', 'caption'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setDraftTextStyle(st)}
                        className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                          draftTextStyle === st ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {st === 'boxed' ? 'KOTAK' : st === 'clean' ? 'POLOS' : 'SUB'}
                      </button>
                    ))}
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setDraftTextSize(sz)}
                        className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] font-bold uppercase cursor-pointer ${
                          draftTextSize === sz ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
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
                  + UNGGAH AUDIO PERANGKAT
                </button>
                {audioClip && (
                  <button
                    type="button"
                    onClick={() => {
                      pushUndo();
                      setAudioClip(null);
                    }}
                    className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] font-bold cursor-pointer"
                  >
                    HAPUS
                  </button>
                )}
              </div>

              {audioClip && (
                <div className="space-y-1 border border-[var(--lcd-fg)]/40 bg-[var(--lcd-bg)] p-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums w-16">Vol {Math.round(audioClip.volume * 100)}%</span>
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
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAudioClip({ ...audioClip, fadeInSec: audioClip.fadeInSec > 0 ? 0 : 0.8 })
                      }
                      className={`flex-1 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                        audioClip.fadeInSec > 0 ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                      }`}
                    >
                      Fade In ({audioClip.fadeInSec}s)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAudioClip({ ...audioClip, fadeOutSec: audioClip.fadeOutSec > 0 ? 0 : 1.0 })
                      }
                      className={`flex-1 py-0.5 border border-[var(--lcd-fg)] font-bold cursor-pointer ${
                        audioClip.fadeOutSec > 0 ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                      }`}
                    >
                      Fade Out ({audioClip.fadeOutSec}s)
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="font-bold mb-0.5">Musik OS Bawaan:</div>
                <div className="grid grid-cols-2 gap-1">
                  {OS_MUSIC_PRESETS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectBuiltInMusic(m.id)}
                      className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-left font-bold truncate cursor-pointer"
                    >
                      ♪ {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {osAudios.length > 0 && (
                <div>
                  <div className="font-bold mb-0.5">Audio Studio & Rekaman ({osAudios.length}):</div>
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
                      className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>PUTAR VIDEO</span>
                    </button>
                    <a
                      href={exportedVideo.blobUrl}
                      download={exportedVideo.fileName}
                      className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>UNDUH .WEBM</span>
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={resetProject}
                    className="w-full py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{language === 'id' ? 'Buat Proyek Baru' : 'New Project'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Intuitive CapCut-Style Bottom Toolbar */}
      <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] flex items-center gap-1 p-1 overflow-x-auto lcd-scroll shrink-0">
        {[
          { id: 'media', label: '+Media', icon: FolderPlus },
          { id: 'split', label: 'Split', icon: Scissors },
          { id: 'transition', label: 'Transisi', icon: Sparkles },
          { id: 'trim', label: 'Urut/Edit', icon: ArrowLeftRight },
          { id: 'speed', label: 'Cepat', icon: Gauge },
          { id: 'filter', label: 'Filter', icon: SlidersHorizontal },
          { id: 'text', label: 'Teks', icon: Type },
          { id: 'audio', label: 'Audio', icon: Music },
        ].map((tool) => {
          const Icon = tool.icon;
          const isActive = activePanel === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                if (tool.id === 'media') {
                  setActivePanel(activePanel === 'media' ? 'none' : 'media');
                } else if (tool.id === 'split') {
                  splitAtPlayhead();
                } else if (tool.id === 'transition') {
                  if (clips.length < 2) {
                    showToast(language === 'id' ? 'Tambahkan minimal 2 klip dulu' : 'Need at least 2 clips');
                    return;
                  }
                  if (selectedClipIndex <= 0 && computedClips[1]) {
                    setSelectedClipId(computedClips[1].id);
                  }
                  setActivePanel(activePanel === 'transition' ? 'none' : 'transition');
                } else if (tool.id === 'trim') {
                  if (!selectedClip) {
                    showToast(language === 'id' ? 'Pilih klip dulu' : 'Select a clip first');
                    return;
                  }
                  setActivePanel(activePanel === 'trim' ? 'none' : 'trim');
                } else if (tool.id === 'speed') {
                  if (!selectedClip) {
                    showToast(language === 'id' ? 'Pilih klip dulu' : 'Select a clip first');
                    return;
                  }
                  setActivePanel(activePanel === 'speed' ? 'none' : 'speed');
                } else if (tool.id === 'filter') {
                  if (!selectedClip) {
                    showToast(language === 'id' ? 'Pilih klip dulu' : 'Select a clip first');
                    return;
                  }
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
              className={`min-w-[46px] px-1.5 py-1 border-2 border-[var(--lcd-fg)] flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                  : 'bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tool.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
