'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WALLPAPERS } from '@/src/components/PixelWallpapers';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord, WallpaperId } from '@/src/types/os';

type EditorTab = 'filter' | 'adjust' | 'crop' | 'draw' | 'text';
type PhotoFilterId = 'none' | 'lcd' | 'pixel' | 'sepia' | 'noir' | 'invert';
type CropAspectId = 'free' | '1:1' | '4:3' | '16:9' | '9:16';

interface PhotoAdjustments {
  brightness: number; // 50..150
  contrast: number; // 50..150
  saturation: number; // 0..200
  rotateDeg: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

interface BrushPoint {
  x: number; // 0..1 normalized to oriented canvas
  y: number; // 0..1 normalized to oriented canvas
}

interface BrushStroke {
  id: string;
  mode: 'draw' | 'erase';
  color: string;
  size: number; // px relative to 480w
  points: BrushPoint[];
}

interface PhotoTextLayer {
  id: string;
  text: string;
  xPct: number; // 10..90
  yPct: number; // 10..90
  fontSize: number; // 14..48
  color: string;
  boxed: boolean;
}

interface EditorSnapshot {
  baseDataUrl: string;
  baseWidth: number;
  baseHeight: number;
  filterId: PhotoFilterId;
  pixelSize: number;
  adjustments: PhotoAdjustments;
  strokes: BrushStroke[];
  textLayers: PhotoTextLayer[];
}

const DEFAULT_ADJUSTMENTS: PhotoAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  rotateDeg: 0,
  flipH: false,
  flipV: false,
};

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const FILTER_PRESETS: { id: PhotoFilterId; labelId: string; labelEn: string }[] = [
  { id: 'none', labelId: 'Normal', labelEn: 'Normal' },
  { id: 'lcd', labelId: 'LCD 2-Bit', labelEn: 'LCD 2-Bit' },
  { id: 'pixel', labelId: 'Pixel Art', labelEn: 'Pixel Art' },
  { id: 'sepia', labelId: 'Sepia', labelEn: 'Sepia' },
  { id: 'noir', labelId: 'Noir B&W', labelEn: 'Noir B&W' },
  { id: 'invert', labelId: 'Negatif', labelEn: 'Invert' },
];

const CROP_RATIOS: { id: CropAspectId; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Asli', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

const BRUSH_COLORS = [
  { hex: '#000000', label: 'Ink' },
  { hex: '#D8FF9A', label: 'LCD' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#DC2626', label: 'Red' },
  { hex: '#D97706', label: 'Amber' },
  { hex: '#2563EB', label: 'Blue' },
];

let uidCounter = 1;
function makeId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${uidCounter}-${Math.floor(Math.random() * 1000)}`;
}

function makeDefaultFileName(): string {
  const d = new Date();
  const stamp = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  return `EDIT_${stamp}`;
}

function getCssColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length >= 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return [0, 0, 0];
}

function renderWallpaperToDataUrl(wpId: WallpaperId, w = 480, h = 360): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bg = getCssColor('--lcd-bg', '#D8FF9A');
  const fg = getCssColor('--lcd-fg', '#000000');
  const sec = getCssColor('--lcd-sec', '#BDE879');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (wpId === 'mountains') {
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.24, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.24, w * 0.036, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = sec;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w * 0.22, h * 0.36);
    ctx.lineTo(w * 0.48, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(w * 0.26, h);
    ctx.lineTo(w * 0.56, h * 0.22);
    ctx.lineTo(w * 0.86, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(w * 0.56, h * 0.22);
    ctx.lineTo(w * 0.48, h * 0.44);
    ctx.lineTo(w * 0.54, h * 0.41);
    ctx.lineTo(w * 0.64, h * 0.44);
    ctx.closePath();
    ctx.fill();
  } else if (wpId === 'skyline') {
    const heights = [0.46, 0.68, 0.42, 0.78, 0.52, 0.64, 0.55];
    const bw = Math.floor(w / heights.length);
    heights.forEach((ratio, idx) => {
      const bh = Math.floor(h * ratio);
      const bx = idx * bw + 4;
      const by = h - bh;
      ctx.fillStyle = idx % 2 === 0 ? fg : sec;
      ctx.fillRect(bx, by, bw - 8, bh);
      ctx.fillStyle = bg;
      for (let wy = by + 16; wy < h - 18; wy += 24) {
        for (let wx = bx + 10; wx < bx + bw - 22; wx += 18) {
          ctx.fillRect(wx, wy, 8, 10);
        }
      }
    });
  } else if (wpId === 'sunrise') {
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.56, w * 0.14, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = sec;
    ctx.fillRect(0, h * 0.58, w, h * 0.42);
    ctx.fillStyle = fg;
    ctx.fillRect(0, h * 0.58, w, 6);
    for (let i = 0; i < 5; i += 1) {
      const rw = w * (0.45 - i * 0.08);
      ctx.fillRect((w - rw) / 2, h * 0.65 + i * 22, rw, 6);
    }
  } else if (wpId === 'night') {
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.24, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(w * 0.81, h * 0.21, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    const stars = [
      [0.12, 0.16],
      [0.28, 0.25],
      [0.44, 0.12],
      [0.6, 0.3],
      [0.18, 0.46],
      [0.52, 0.42],
      [0.86, 0.48],
    ];
    stars.forEach(([sx, sy]) => ctx.fillRect(w * sx, h * sy, 8, 8));
    ctx.fillStyle = sec;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
  } else if (wpId === 'grid') {
    ctx.fillStyle = sec;
    for (let x = 0; x < w; x += 24) ctx.fillRect(x, 0, 2, h);
    for (let y = 0; y < h; y += 24) ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, w - 48, h - 48);
  } else {
    // 'village' default scenic pixel art
    ctx.fillStyle = sec;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.74);
    ctx.lineTo(w * 0.24, h * 0.46);
    ctx.lineTo(w * 0.45, h * 0.64);
    ctx.lineTo(w * 0.72, h * 0.42);
    ctx.lineTo(w, h * 0.58);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = fg;
    ctx.fillRect(w * 0.15, h * 0.52, 18, h * 0.32);
    ctx.fillRect(w * 0.08, h * 0.24, 90, 62);
    ctx.fillRect(w * 0.11, h * 0.18, 64, 24);
    ctx.fillRect(w * 0.7, h * 0.58, 76, 54);
    ctx.beginPath();
    ctx.moveTo(w * 0.67, h * 0.58);
    ctx.lineTo(w * 0.78, h * 0.42);
    ctx.lineTo(w * 0.89, h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.fillRect(w * 0.73, h * 0.64, 14, 14);
    ctx.fillRect(w * 0.8, h * 0.64, 14, 14);
    ctx.fillStyle = fg;
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
  }

  return canvas.toDataURL('image/png');
}

function createBlankDataUrl(tone: 'lcd' | 'white' | 'dark' = 'lcd', w = 480, h = 360): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  if (tone === 'white') {
    ctx.fillStyle = '#FFFFFF';
  } else if (tone === 'dark') {
    ctx.fillStyle = '#111810';
  } else {
    ctx.fillStyle = getCssColor('--lcd-bg', '#D8FF9A');
  }
  ctx.fillRect(0, 0, w, h);
  return canvas.toDataURL('image/png');
}

function loadImageAsync(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

async function normalizeImageToDataUrl(
  src: string,
  maxEdge = 960,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImageAsync(src);
  let w = img.naturalWidth || 480;
  let h = img.naturalHeight || 360;
  if (w > maxEdge || h > maxEdge) {
    const scale = maxEdge / Math.max(w, h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
  }
  return { dataUrl: src, width: w, height: h };
}

function computeCropRect(
  cw: number,
  ch: number,
  aspectId: CropAspectId,
  cropScalePct: number,
  panX: number,
  panY: number,
): { x: number; y: number; w: number; h: number } {
  const preset = CROP_RATIOS.find((c) => c.id === aspectId);
  const scale = Math.max(0.3, Math.min(1, cropScalePct / 100));
  const targetRatio = preset?.ratio ?? cw / Math.max(1, ch);

  let maxW = cw;
  let maxH = cw / targetRatio;
  if (maxH > ch) {
    maxH = ch;
    maxW = ch * targetRatio;
  }
  const rw = Math.max(16, Math.round(maxW * scale));
  const rh = Math.max(16, Math.round(maxH * scale));
  const availX = Math.max(0, cw - rw);
  const availY = Math.max(0, ch - rh);
  const rx = Math.round((availX * Math.max(0, Math.min(100, panX))) / 100);
  const ry = Math.round((availY * Math.max(0, Math.min(100, panY))) / 100);
  return { x: rx, y: ry, w: rw, h: rh };
}

export const PhotoEditorApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const setWallpaper = useOSStore((s) => s.setWallpaper);
  const openApp = useOSStore((s) => s.openApp);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const activeStrokeRef = useRef<BrushStroke | null>(null);
  const draggingTextRef = useRef<boolean>(false);
  const draggingCropRef = useRef<{ lastX: number; lastY: number } | null>(null);

  // Source & Gallery DCIM list
  const [dcimFiles, setDcimFiles] = useState<VirtualFileRecord[]>([]);
  const [sourceName, setSourceName] = useState<string>('PHOTO_NEW');
  const [baseDataUrl, setBaseDataUrl] = useState<string>('');
  const [baseSize, setBaseSize] = useState<{ w: number; h: number }>({ w: 480, h: 360 });
  const [renderTick, setRenderTick] = useState(0);

  // Editing pipeline state
  const [activeTab, setActiveTab] = useState<EditorTab>('filter');
  const [filterId, setFilterId] = useState<PhotoFilterId>('none');
  const [pixelSize, setPixelSize] = useState<number>(8);
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>(DEFAULT_ADJUSTMENTS);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [textLayers, setTextLayers] = useState<PhotoTextLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Brush tool controls
  const [brushMode, setBrushMode] = useState<'draw' | 'erase'>('draw');
  const [brushColor, setBrushColor] = useState<string>('#000000');
  const [brushSize, setBrushSize] = useState<number>(6);

  // Crop tool controls
  const [cropAspect, setCropAspect] = useState<CropAspectId>('free');
  const [cropScale, setCropScale] = useState<number>(100);
  const [cropPanX, setCropPanX] = useState<number>(50);
  const [cropPanY, setCropPanY] = useState<number>(50);

  // Text draft input
  const [newTextValue, setNewTextValue] = useState<string>('PIXEL SHOT');

  // Undo stack
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);

  // Modals: Source Picker, Live WebRTC Camera, Save/Export
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraLcdMode, setCameraLcdMode] = useState<boolean>(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportName, setExportName] = useState<string>(() => makeDefaultFileName());
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');

  const orientedSize = useMemo(() => {
    const swapped = adjustments.rotateDeg === 90 || adjustments.rotateDeg === 270;
    return {
      w: swapped ? baseSize.h : baseSize.w,
      h: swapped ? baseSize.w : baseSize.h,
    };
  }, [adjustments.rotateDeg, baseSize.h, baseSize.w]);

  const currentSnapshot = useCallback(
    (): EditorSnapshot => ({
      baseDataUrl,
      baseWidth: baseSize.w,
      baseHeight: baseSize.h,
      filterId,
      pixelSize,
      adjustments: { ...adjustments },
      strokes: strokes.map((s) => ({ ...s, points: [...s.points] })),
      textLayers: textLayers.map((t) => ({ ...t })),
    }),
    [adjustments, baseDataUrl, baseSize.h, baseSize.w, filterId, pixelSize, strokes, textLayers],
  );

  const pushUndo = useCallback(() => {
    if (!baseDataUrl) return;
    setUndoStack((prev) => [...prev.slice(-14), currentSnapshot()]);
  }, [baseDataUrl, currentSnapshot]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setBaseDataUrl(last.baseDataUrl);
      setBaseSize({ w: last.baseWidth, h: last.baseHeight });
      setFilterId(last.filterId);
      setPixelSize(last.pixelSize);
      setAdjustments(last.adjustments);
      setStrokes(last.strokes);
      setTextLayers(last.textLayers);
      soundEngine.playCue('back');
      return prev.slice(0, -1);
    });
  }, []);

  const loadSourceIntoEditor = useCallback(
    async (src: string, name: string, recordUndo = false) => {
      try {
        if (recordUndo && baseDataUrl) {
          pushUndo();
        }
        const norm = await normalizeImageToDataUrl(src, 960);
        setBaseDataUrl(norm.dataUrl);
        setBaseSize({ w: norm.width, h: norm.height });
        setSourceName(name.replace(/\.[^.]+$/, ''));
        setExportName(`${name.replace(/\.[^.]+$/, '')}_edit`);
        setFilterId('none');
        setAdjustments(DEFAULT_ADJUSTMENTS);
        setStrokes([]);
        setTextLayers([]);
        setSelectedTextId(null);
        setCropAspect('free');
        setCropScale(100);
        setCropPanX(50);
        setCropPanY(50);
      } catch {
        showToast(language === 'id' ? 'Gagal memuat gambar' : 'Failed to load image');
      }
    },
    [baseDataUrl, language, pushUndo, showToast],
  );

  // Initial load from DCIM or params
  useEffect(() => {
    let active = true;
    db.files
      .where('folder')
      .equals('DCIM')
      .reverse()
      .toArray()
      .then(async (rows) => {
        if (!active) return;
        setDcimFiles(rows);

        if (params?.tab && WALLPAPERS.some((w) => w.id === params.tab)) {
          const wpId = params.tab as WallpaperId;
          const url = renderWallpaperToDataUrl(wpId);
          await loadSourceIntoEditor(url, `WP_${wpId}`);
          return;
        }

        const target =
          (params?.fileId ? rows.find((r) => r.id === params.fileId) : undefined) ??
          rows.find((r) => r.content.startsWith('data:image/')) ??
          rows[0];

        if (target) {
          if (target.content.startsWith('wallpaper:')) {
            const wpId = target.content.replace('wallpaper:', '') as WallpaperId;
            await loadSourceIntoEditor(renderWallpaperToDataUrl(wpId), target.name);
          } else if (target.content.startsWith('data:image/')) {
            await loadSourceIntoEditor(target.content, target.name);
          } else {
            await loadSourceIntoEditor(renderWallpaperToDataUrl('village'), 'PIXEL_SCENE');
          }
        } else {
          await loadSourceIntoEditor(renderWallpaperToDataUrl('village'), 'PIXEL_SCENE');
        }
      });
    return () => {
      active = false;
    };
    // Run once for launch params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.fileId, params?.tab]);

  // Decode baseDataUrl into cached HTMLImageElement
  useEffect(() => {
    if (!baseDataUrl) return;
    let active = true;
    loadImageAsync(baseDataUrl)
      .then((img) => {
        if (!active) return;
        loadedImageRef.current = img;
        setRenderTick((t) => t + 1);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [baseDataUrl]);

  // Core Canvas Rendering Pipeline
  const renderToCanvas = useCallback(
    (targetCanvas: HTMLCanvasElement, includeCropOverlay: boolean) => {
      const img = loadedImageRef.current;
      if (!img) return;

      const cw = orientedSize.w;
      const ch = orientedSize.h;
      if (targetCanvas.width !== cw || targetCanvas.height !== ch) {
        targetCanvas.width = cw;
        targetCanvas.height = ch;
      }
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, cw, ch);

      // 1. Draw base image with transform & CSS adjustments/color filters
      ctx.save();
      const filterParts = [
        `brightness(${adjustments.brightness}%)`,
        `contrast(${adjustments.contrast}%)`,
        `saturate(${adjustments.saturation}%)`,
      ];
      if (filterId === 'sepia') filterParts.push('sepia(0.95)');
      if (filterId === 'noir') filterParts.push('grayscale(1) contrast(135%)');
      if (filterId === 'invert') filterParts.push('invert(1)');
      ctx.filter = filterParts.join(' ');

      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((adjustments.rotateDeg * Math.PI) / 180);
      ctx.scale(adjustments.flipH ? -1 : 1, adjustments.flipV ? -1 : 1);
      ctx.drawImage(img, -baseSize.w / 2, -baseSize.h / 2, baseSize.w, baseSize.h);
      ctx.restore();

      // 2. Pixel Art block effect
      if (filterId === 'pixel' && pixelSize > 1) {
        const sw = Math.max(4, Math.round(cw / pixelSize));
        const sh = Math.max(4, Math.round(ch / pixelSize));
        const tmp = document.createElement('canvas');
        tmp.width = sw;
        tmp.height = sh;
        const tctx = tmp.getContext('2d');
        if (tctx) {
          tctx.drawImage(targetCanvas, 0, 0, sw, sh);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, cw, ch);
          ctx.drawImage(tmp, 0, 0, sw, sh, 0, 0, cw, ch);
          ctx.restore();
        }
      }

      // 3. LCD 2-Bit Bayer 4x4 Ordered Dithering
      if (filterId === 'lcd') {
        // Compute downscaled work resolution so dithering looks delightfully pixel-authentic & fast
        const maxDitherW = 240;
        const scale = cw > maxDitherW ? maxDitherW / cw : 1;
        const dw = Math.max(16, Math.round(cw * scale));
        const dh = Math.max(16, Math.round(ch * scale));
        const tmp = document.createElement('canvas');
        tmp.width = dw;
        tmp.height = dh;
        const tctx = tmp.getContext('2d');
        if (tctx) {
          tctx.drawImage(targetCanvas, 0, 0, dw, dh);
          const imgData = tctx.getImageData(0, 0, dw, dh);
          const data = imgData.data;
          const [lr, lg, lb] = hexToRgb(getCssColor('--lcd-bg', '#D8FF9A'));
          const [dr, dg, dbCol] = hexToRgb('#0B1206');

          for (let y = 0; y < dh; y += 1) {
            for (let x = 0; x < dw; x += 1) {
              const i = (y * dw + x) * 4;
              const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              const threshold = (BAYER_4X4[y % 4][x % 4] / 16) * 255;
              if (lum > threshold) {
                data[i] = lr;
                data[i + 1] = lg;
                data[i + 2] = lb;
              } else {
                data[i] = dr;
                data[i + 1] = dg;
                data[i + 2] = dbCol;
              }
            }
          }
          tctx.putImageData(imgData, 0, 0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, cw, ch);
          ctx.drawImage(tmp, 0, 0, dw, dh, 0, 0, cw, ch);
          ctx.restore();
        }
      }

      // 4. Composite Brush Layer (separate offscreen buffer so Erase doesn't punch photo!)
      const allStrokes = activeStrokeRef.current ? [...strokes, activeStrokeRef.current] : strokes;
      if (allStrokes.length > 0) {
        const strokeCanvas = document.createElement('canvas');
        strokeCanvas.width = cw;
        strokeCanvas.height = ch;
        const sctx = strokeCanvas.getContext('2d');
        if (sctx) {
          const widthScale = cw / 480;
          sctx.lineCap = 'round';
          sctx.lineJoin = 'round';
          for (const st of allStrokes) {
            if (st.points.length === 0) continue;
            sctx.save();
            sctx.globalCompositeOperation = st.mode === 'erase' ? 'destination-out' : 'source-over';
            sctx.strokeStyle = st.color;
            sctx.fillStyle = st.color;
            sctx.lineWidth = Math.max(2, st.size * widthScale);

            if (st.points.length === 1) {
              sctx.beginPath();
              sctx.arc(st.points[0].x * cw, st.points[0].y * ch, sctx.lineWidth / 2, 0, Math.PI * 2);
              sctx.fill();
            } else {
              sctx.beginPath();
              sctx.moveTo(st.points[0].x * cw, st.points[0].y * ch);
              for (let p = 1; p < st.points.length; p += 1) {
                sctx.lineTo(st.points[p].x * cw, st.points[p].y * ch);
              }
              sctx.stroke();
            }
            sctx.restore();
          }
          ctx.drawImage(strokeCanvas, 0, 0);
        }
      }

      // 5. Render Text Layers
      const fontScale = Math.max(0.6, cw / 420);
      for (const layer of textLayers) {
        if (!layer.text.trim()) continue;
        ctx.save();
        const pxSize = Math.round(layer.fontSize * fontScale);
        ctx.font = `bold ${pxSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tx = (layer.xPct / 100) * cw;
        const ty = (layer.yPct / 100) * ch;
        const metrics = ctx.measureText(layer.text);
        const padX = Math.round(pxSize * 0.45);
        const padY = Math.round(pxSize * 0.3);
        const bw = metrics.width + padX * 2;
        const bh = pxSize + padY * 2;

        if (layer.boxed) {
          ctx.fillStyle = layer.color === '#000000' ? '#D8FF9A' : '#0B1206';
          ctx.fillRect(tx - bw / 2, ty - bh / 2, bw, bh);
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = Math.max(2, Math.round(2 * fontScale));
          ctx.strokeRect(tx - bw / 2, ty - bh / 2, bw, bh);
        }

        ctx.fillStyle = layer.color;
        ctx.fillText(layer.text, tx, ty);

        if (includeCropOverlay && activeTab === 'text' && layer.id === selectedTextId) {
          ctx.strokeStyle = '#D8FF9A';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 2;
          ctx.strokeRect(tx - bw / 2 - 4, ty - bh / 2 - 4, bw + 8, bh + 8);
        }
        ctx.restore();
      }

      // 6. Crop Guide Overlay (Preview Only)
      if (includeCropOverlay && activeTab === 'crop') {
        const rect = computeCropRect(cw, ch, cropAspect, cropScale, cropPanX, cropPanY);
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
        ctx.fillRect(0, 0, cw, rect.y);
        ctx.fillRect(0, rect.y + rect.h, cw, ch - (rect.y + rect.h));
        ctx.fillRect(0, rect.y, rect.x, rect.h);
        ctx.fillRect(rect.x + rect.w, rect.y, cw - (rect.x + rect.w), rect.h);

        // Rule of thirds lines
        ctx.strokeStyle = 'rgba(216, 255, 154, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.w / 3, rect.y);
        ctx.lineTo(rect.x + rect.w / 3, rect.y + rect.h);
        ctx.moveTo(rect.x + (2 * rect.w) / 3, rect.y);
        ctx.lineTo(rect.x + (2 * rect.w) / 3, rect.y + rect.h);
        ctx.moveTo(rect.x, rect.y + rect.h / 3);
        ctx.lineTo(rect.x + rect.w, rect.y + rect.h / 3);
        ctx.moveTo(rect.x, rect.y + (2 * rect.h) / 3);
        ctx.lineTo(rect.x + rect.w, rect.y + (2 * rect.h) / 3);
        ctx.stroke();

        // Outer crop border
        ctx.strokeStyle = '#D8FF9A';
        ctx.lineWidth = Math.max(2, Math.round(cw / 180));
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      }
    },
    [
      activeTab,
      adjustments,
      baseSize.h,
      baseSize.w,
      cropAspect,
      cropPanX,
      cropPanY,
      cropScale,
      filterId,
      orientedSize.h,
      orientedSize.w,
      pixelSize,
      selectedTextId,
      strokes,
      textLayers,
    ],
  );

  // Trigger preview canvas redraw whenever state or decoded image updates
  useEffect(() => {
    if (!canvasRef.current || !loadedImageRef.current) return;
    renderToCanvas(canvasRef.current, true);
  }, [renderToCanvas, renderTick]);

  // Apply Crop cleanly by flattening rendered output (without overlay) and slicing to crop rect
  const applyCrop = () => {
    if (!loadedImageRef.current) return;
    pushUndo();
    const full = document.createElement('canvas');
    renderToCanvas(full, false);
    const rect = computeCropRect(full.width, full.height, cropAspect, cropScale, cropPanX, cropPanY);

    const out = document.createElement('canvas');
    out.width = rect.w;
    out.height = rect.h;
    const octx = out.getContext('2d');
    if (!octx) return;
    octx.drawImage(full, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const croppedUrl = out.toDataURL('image/png');

    setBaseDataUrl(croppedUrl);
    setBaseSize({ w: rect.w, h: rect.h });
    setFilterId('none');
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setStrokes([]);
    setTextLayers([]);
    setSelectedTextId(null);
    setCropAspect('free');
    setCropScale(100);
    setCropPanX(50);
    setCropPanY(50);
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Crop diterapkan (${rect.w}×${rect.h})` : `Cropped (${rect.w}×${rect.h})`);
  };

  // Pointer interaction on canvas for Brush Drawing, Text Dragging, and Crop Panning
  const getNormalizedPointer = (e: React.PointerEvent<HTMLCanvasElement>): BrushPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTab === 'draw') {
      const pt = getNormalizedPointer(e);
      if (!pt) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      activeStrokeRef.current = {
        id: makeId('stroke'),
        mode: brushMode,
        color: brushColor,
        size: brushSize,
        points: [pt],
      };
      if (canvasRef.current) renderToCanvas(canvasRef.current, true);
    } else if (activeTab === 'text' && selectedTextId) {
      const pt = getNormalizedPointer(e);
      if (!pt) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      pushUndo();
      draggingTextRef.current = true;
      setTextLayers((prev) =>
        prev.map((l) =>
          l.id === selectedTextId
            ? { ...l, xPct: Math.round(pt.x * 100), yPct: Math.round(pt.y * 100) }
            : l,
        ),
      );
    } else if (activeTab === 'crop' && cropScale < 100) {
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingCropRef.current = { lastX: e.clientX, lastY: e.clientY };
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTab === 'draw' && activeStrokeRef.current) {
      const pt = getNormalizedPointer(e);
      if (!pt) return;
      activeStrokeRef.current.points.push(pt);
      if (canvasRef.current) renderToCanvas(canvasRef.current, true);
    } else if (activeTab === 'text' && draggingTextRef.current && selectedTextId) {
      const pt = getNormalizedPointer(e);
      if (!pt) return;
      setTextLayers((prev) =>
        prev.map((l) =>
          l.id === selectedTextId
            ? { ...l, xPct: Math.round(pt.x * 100), yPct: Math.round(pt.y * 100) }
            : l,
        ),
      );
    } else if (activeTab === 'crop' && draggingCropRef.current) {
      const dx = e.clientX - draggingCropRef.current.lastX;
      const dy = e.clientY - draggingCropRef.current.lastY;
      draggingCropRef.current = { lastX: e.clientX, lastY: e.clientY };
      setCropPanX((p) => Math.max(0, Math.min(100, p + dx * 0.45)));
      setCropPanY((p) => Math.max(0, Math.min(100, p + dy * 0.45)));
    }
  };

  const handleCanvasPointerUp = () => {
    if (activeTab === 'draw' && activeStrokeRef.current) {
      const finished = activeStrokeRef.current;
      activeStrokeRef.current = null;
      pushUndo();
      setStrokes((prev) => [...prev, finished]);
    }
    draggingTextRef.current = false;
    draggingCropRef.current = null;
  };

  // Device file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result || '');
      if (!src) return;
      await loadSourceIntoEditor(src, file.name, true);
      setSourceModalOpen(false);
      soundEngine.playCue('open');
      showToast(language === 'id' ? `Dimuat: ${file.name}` : `Loaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // WebRTC Camera Modal lifecycle
  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!cameraModalOpen) {
      stopCameraStream();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      Promise.resolve().then(() => setCameraStatus('error'));
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: cameraFacing }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => undefined);
        }
        setCameraStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setCameraStatus('error');
      });
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [cameraFacing, cameraModalOpen, stopCameraStream]);

  const captureFromLiveCamera = async () => {
    const video = cameraVideoRef.current;
    if (!video || video.readyState < 2) return;
    const w = video.videoWidth || 480;
    const h = video.videoHeight || 360;
    const cap = document.createElement('canvas');
    cap.width = w;
    cap.height = h;
    const ctx = cap.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = cap.toDataURL('image/png');
    soundEngine.playCue('shutter');
    stopCameraStream();
    setCameraModalOpen(false);
    setSourceModalOpen(false);
    await loadSourceIntoEditor(dataUrl, makeDefaultFileName(), true);
    if (cameraLcdMode) {
      setFilterId('lcd');
    }
    showToast(language === 'id' ? 'Foto kamera dimuat ke editor' : 'Camera capture loaded');
  };

  // Export final rendered image without crop guides
  const buildFinalDataUrl = (format: 'png' | 'jpeg'): string => {
    const out = document.createElement('canvas');
    renderToCanvas(out, false);
    if (format === 'jpeg') {
      // Composite white backdrop behind transparent areas if JPEG
      const jpegCanvas = document.createElement('canvas');
      jpegCanvas.width = out.width;
      jpegCanvas.height = out.height;
      const jctx = jpegCanvas.getContext('2d');
      if (jctx) {
        jctx.fillStyle = '#FFFFFF';
        jctx.fillRect(0, 0, out.width, out.height);
        jctx.drawImage(out, 0, 0);
        return jpegCanvas.toDataURL('image/jpeg', 0.92);
      }
      return out.toDataURL('image/jpeg', 0.92);
    }
    return out.toDataURL('image/png');
  };

  const handleSaveToDcim = async () => {
    const dataUrl = buildFinalDataUrl(exportFormat);
    const ext = exportFormat === 'jpeg' ? 'jpg' : 'png';
    const cleanName = (exportName.trim() || makeDefaultFileName()).replace(/\.(png|jpe?g)$/i, '');
    const fileName = `${cleanName}.${ext}`;
    const sizeKb = Math.max(2, Math.round((dataUrl.length * 0.75) / 1024));

    await db.files.add({
      folder: 'DCIM',
      name: fileName,
      mimeType: exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
      sizeKb,
      content: dataUrl,
      createdAt: Date.now(),
    });
    const updated = await db.files.where('folder').equals('DCIM').reverse().toArray();
    setDcimFiles(updated);
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Tersimpan di DCIM: ${fileName}` : `Saved to DCIM: ${fileName}`);
    setExportModalOpen(false);
  };

  const handleDownloadExport = () => {
    const dataUrl = buildFinalDataUrl(exportFormat);
    const ext = exportFormat === 'jpeg' ? 'jpg' : 'png';
    const cleanName = (exportName.trim() || makeDefaultFileName()).replace(/\.(png|jpe?g)$/i, '');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${cleanName}.${ext}`;
    a.click();
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Diunduh: ${cleanName}.${ext}` : `Downloaded: ${cleanName}.${ext}`);
  };

  const handleSetAsWallpaper = async () => {
    const dataUrl = buildFinalDataUrl('png');
    setWallpaper('village', dataUrl);
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Dipasang sebagai Wallpaper OS!' : 'Applied as OS Wallpaper!');
    setExportModalOpen(false);
  };

  // Add new text layer
  const handleAddTextLayer = () => {
    const text = newTextValue.trim();
    if (!text) return;
    pushUndo();
    const id = makeId('txt');
    const created: PhotoTextLayer = {
      id,
      text,
      xPct: 50,
      yPct: 82,
      fontSize: 24,
      color: '#D8FF9A',
      boxed: true,
    };
    setTextLayers((prev) => [...prev, created]);
    setSelectedTextId(id);
    soundEngine.playCue('select');
  };

  const selectedText = useMemo(
    () => textLayers.find((t) => t.id === selectedTextId) ?? null,
    [selectedTextId, textLayers],
  );

  // Softkey bindings
  useEffect(() => {
    if (cameraModalOpen) {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Putar Cam' : 'Flip Cam',
        centerLabel: language === 'id' ? 'Jepret' : 'Capture',
        rightLabel: language === 'id' ? 'Batal' : 'Cancel',
        onLeft: () => setCameraFacing((f) => (f === 'environment' ? 'user' : 'environment')),
        onCenter: () => {
          void captureFromLiveCamera();
        },
        onRight: () => setCameraModalOpen(false),
      });
    } else if (sourceModalOpen || exportModalOpen) {
      setSoftkeys({
        leftLabel: '',
        centerLabel: 'OK',
        rightLabel: language === 'id' ? 'Tutup' : 'Close',
        onRight: () => {
          setSourceModalOpen(false);
          setExportModalOpen(false);
        },
      });
    } else {
      setSoftkeys({
        leftLabel: undoStack.length > 0 ? 'Undo' : language === 'id' ? 'Sumber' : 'Source',
        centerLabel: language === 'id' ? 'Simpan' : 'Save',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => {
          if (undoStack.length > 0) {
            handleUndo();
          } else {
            setSourceModalOpen(true);
          }
        },
        onCenter: () => {
          setExportName(`${sourceName || 'PHOTO'}_edit`);
          setExportModalOpen(true);
        },
        onRight: onBack,
      });
    }
  });

  const tabs: { id: EditorTab; labelId: string; labelEn: string }[] = [
    { id: 'filter', labelId: 'Filter', labelEn: 'Filter' },
    { id: 'adjust', labelId: 'Atur', labelEn: 'Adjust' },
    { id: 'crop', labelId: 'Crop', labelEn: 'Crop' },
    { id: 'draw', labelId: 'Kuas', labelEn: 'Draw' },
    { id: 'text', labelId: 'Teks', labelEn: 'Text' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)] relative">
      <AppHeader title={language === 'id' ? 'Editor Foto' : 'Photo Editor'} showChevrons={false} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-1 px-2 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              setSourceModalOpen(true);
            }}
            className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer whitespace-nowrap"
          >
            + {language === 'id' ? 'Sumber' : 'Source'}
          </button>
          <button
            type="button"
            onClick={() => openApp('gallery')}
            className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer whitespace-nowrap"
          >
            {language === 'id' ? 'Galeri' : 'Gallery'}
          </button>
        </div>

        <span className="text-[10px] font-mono tabular-nums truncate opacity-80">
          {orientedSize.w}×{orientedSize.h}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              setExportName(`${sourceName || 'PHOTO'}_edit`);
              setExportModalOpen(true);
            }}
            className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer whitespace-nowrap"
          >
            {language === 'id' ? 'Simpan' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-1.5 bg-[var(--lcd-fg)]/10 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          className={`max-w-full max-h-full border-2 border-[var(--lcd-fg)] bg-black shadow-sm ${
            activeTab === 'draw'
              ? 'cursor-crosshair touch-none'
              : activeTab === 'text' || (activeTab === 'crop' && cropScale < 100)
                ? 'cursor-move touch-none'
                : 'cursor-default'
          }`}
          style={{ imageRendering: filterId === 'lcd' || filterId === 'pixel' ? 'pixelated' : 'auto' }}
        />
      </div>

      {/* Active Tool Control Panel */}
      <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-1.5 shrink-0 max-h-[38%] overflow-y-auto lcd-scroll">
        {activeTab === 'filter' && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-1">
              {FILTER_PRESETS.map((f) => {
                const isSel = filterId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      pushUndo();
                      setFilterId(f.id);
                      soundEngine.playCue('click');
                    }}
                    className={`py-1 px-1 border border-[var(--lcd-fg)] text-[10px] font-bold truncate cursor-pointer ${
                      isSel ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                    }`}
                  >
                    {language === 'id' ? f.labelId : f.labelEn}
                  </button>
                );
              })}
            </div>
            {filterId === 'pixel' && (
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="shrink-0">{language === 'id' ? 'Blok Piksel' : 'Pixel Size'}</span>
                <input
                  type="range"
                  min={4}
                  max={24}
                  step={2}
                  value={pixelSize}
                  onChange={(e) => setPixelSize(Number(e.target.value))}
                  className="flex-1 accent-[var(--lcd-fg)] cursor-pointer"
                />
                <span className="w-8 text-right font-mono tabular-nums">{pixelSize}px</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'adjust' && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="w-16 shrink-0">{language === 'id' ? 'Cerah' : 'Bright'}</span>
              <input
                type="range"
                min={50}
                max={150}
                value={adjustments.brightness}
                onChange={(e) => setAdjustments((a) => ({ ...a, brightness: Number(e.target.value) }))}
                className="flex-1 accent-[var(--lcd-fg)] cursor-pointer"
              />
              <span className="w-9 text-right font-mono tabular-nums">{adjustments.brightness}%</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="w-16 shrink-0">{language === 'id' ? 'Kontras' : 'Contrast'}</span>
              <input
                type="range"
                min={50}
                max={160}
                value={adjustments.contrast}
                onChange={(e) => setAdjustments((a) => ({ ...a, contrast: Number(e.target.value) }))}
                className="flex-1 accent-[var(--lcd-fg)] cursor-pointer"
              />
              <span className="w-9 text-right font-mono tabular-nums">{adjustments.contrast}%</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="w-16 shrink-0">{language === 'id' ? 'Saturasi' : 'Saturate'}</span>
              <input
                type="range"
                min={0}
                max={200}
                value={adjustments.saturation}
                onChange={(e) => setAdjustments((a) => ({ ...a, saturation: Number(e.target.value) }))}
                className="flex-1 accent-[var(--lcd-fg)] cursor-pointer"
              />
              <span className="w-9 text-right font-mono tabular-nums">{adjustments.saturation}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  pushUndo();
                  setAdjustments((a) => ({ ...a, rotateDeg: ((a.rotateDeg + 90) % 360) as 0 | 90 | 180 | 270 }));
                  soundEngine.playCue('click');
                }}
                className="py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
              >
                ↻ 90°
              </button>
              <button
                type="button"
                onClick={() => {
                  pushUndo();
                  setAdjustments((a) => ({ ...a, flipH: !a.flipH }));
                  soundEngine.playCue('click');
                }}
                className={`py-1 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                  adjustments.flipH ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                }`}
              >
                ↔ {language === 'id' ? 'Balik H' : 'Flip H'}
              </button>
              <button
                type="button"
                onClick={() => {
                  pushUndo();
                  setAdjustments((a) => ({ ...a, flipV: !a.flipV }));
                  soundEngine.playCue('click');
                }}
                className={`py-1 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                  adjustments.flipV ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                }`}
              >
                ↕ {language === 'id' ? 'Balik V' : 'Flip V'}
              </button>
              <button
                type="button"
                onClick={() => {
                  pushUndo();
                  setAdjustments(DEFAULT_ADJUSTMENTS);
                  soundEngine.playCue('back');
                }}
                className="py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {activeTab === 'crop' && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-5 gap-1">
              {CROP_RATIOS.map((cr) => (
                <button
                  key={cr.id}
                  type="button"
                  onClick={() => {
                    setCropAspect(cr.id);
                    soundEngine.playCue('click');
                  }}
                  className={`py-1 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                    cropAspect === cr.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {cr.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="shrink-0">{language === 'id' ? 'Area Potong' : 'Crop Area'}</span>
              <input
                type="range"
                min={35}
                max={100}
                value={cropScale}
                onChange={(e) => setCropScale(Number(e.target.value))}
                className="flex-1 accent-[var(--lcd-fg)] cursor-pointer"
              />
              <span className="w-9 text-right font-mono tabular-nums">{cropScale}%</span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={applyCrop}
                className="flex-1 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
              >
                ✓ {language === 'id' ? 'Terapkan Crop' : 'Apply Crop'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCropAspect('free');
                  setCropScale(100);
                  setCropPanX(50);
                  setCropPanY(50);
                }}
                className="px-2.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {activeTab === 'draw' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setBrushMode('draw')}
                  className={`px-2 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                    brushMode === 'draw' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {language === 'id' ? 'Kuas' : 'Brush'}
                </button>
                <button
                  type="button"
                  onClick={() => setBrushMode('erase')}
                  className={`px-2 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                    brushMode === 'erase' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {language === 'id' ? 'Hapus' : 'Eraser'}
                </button>
              </div>

              <div className="flex items-center gap-1">
                {[3, 6, 12, 18].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setBrushSize(sz)}
                    className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-mono font-bold cursor-pointer ${
                      brushSize === sz ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                {BRUSH_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      setBrushMode('draw');
                      setBrushColor(c.hex);
                    }}
                    className={`w-6 h-5 border-2 cursor-pointer ${
                      brushMode === 'draw' && brushColor === c.hex
                        ? 'border-[var(--lcd-fg)] scale-105'
                        : 'border-[var(--lcd-fg)]/45'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              {strokes.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo();
                    setStrokes([]);
                    soundEngine.playCue('back');
                  }}
                  className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                >
                  {language === 'id' ? 'Bersihkan' : 'Clear'}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              <input
                type="text"
                value={newTextValue}
                onChange={(e) => setNewTextValue(e.target.value)}
                placeholder={language === 'id' ? 'Ketik teks overlay...' : 'Enter text overlay...'}
                className="flex-1 min-w-0 px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[11px] font-bold outline-none"
              />
              <button
                type="button"
                onClick={handleAddTextLayer}
                className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer whitespace-nowrap"
              >
                + {language === 'id' ? 'Tambah' : 'Add'}
              </button>
            </div>

            {textLayers.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto lcd-scroll">
                {textLayers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTextId(t.id)}
                    className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold shrink-0 max-w-[110px] truncate cursor-pointer ${
                      selectedTextId === t.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                    }`}
                  >
                    {t.text}
                  </button>
                ))}
              </div>
            )}

            {selectedText && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                <span className="opacity-80">{language === 'id' ? 'Geser teks di layar ·' : 'Drag text ·'}</span>
                <button
                  type="button"
                  onClick={() =>
                    setTextLayers((prev) =>
                      prev.map((l) => (l.id === selectedText.id ? { ...l, fontSize: Math.min(48, l.fontSize + 4) } : l)),
                    )
                  }
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTextLayers((prev) =>
                      prev.map((l) => (l.id === selectedText.id ? { ...l, fontSize: Math.max(12, l.fontSize - 4) } : l)),
                    )
                  }
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTextLayers((prev) =>
                      prev.map((l) => (l.id === selectedText.id ? { ...l, boxed: !l.boxed } : l)),
                    )
                  }
                  className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] cursor-pointer ${
                    selectedText.boxed ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  Box
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTextLayers((prev) =>
                      prev.map((l) =>
                        l.id === selectedText.id
                          ? { ...l, color: l.color === '#D8FF9A' ? '#000000' : l.color === '#000000' ? '#FFFFFF' : '#D8FF9A' }
                          : l,
                      ),
                    )
                  }
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer"
                >
                  {language === 'id' ? 'Warna' : 'Color'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    pushUndo();
                    setTextLayers((prev) => prev.filter((l) => l.id !== selectedText.id));
                    setSelectedTextId(null);
                  }}
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] cursor-pointer ml-auto"
                >
                  {language === 'id' ? 'Hapus' : 'Del'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Thumb-Zone Tool Tab Bar */}
      <div className="grid grid-cols-5 border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0">
        {tabs.map((tab) => {
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                setActiveTab(tab.id);
              }}
              className={`py-1.5 text-[10px] sm:text-xs font-bold border-r last:border-r-0 border-[var(--lcd-fg)] cursor-pointer truncate ${
                isCurrent ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-sec)]'
              }`}
            >
              {language === 'id' ? tab.labelId : tab.labelEn}
            </button>
          );
        })}
      </div>

      {/* MODAL 1: SOURCE PICKER (DCIM / UPLOAD / CAMERA / BLANK) */}
      {sourceModalOpen && (
        <div className="absolute inset-0 z-20 bg-[var(--lcd-bg)] flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <span className="text-xs font-bold">
              {language === 'id' ? 'Pilih Sumber Foto' : 'Choose Photo Source'}
            </span>
            <button
              type="button"
              onClick={() => setSourceModalOpen(false)}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-2 grid grid-cols-3 gap-1.5 border-b-2 border-[var(--lcd-fg)] shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              ↑ {language === 'id' ? 'Unggah File' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraStatus('idle');
                setCameraModalOpen(true);
              }}
              className="py-2 px-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
            >
              ● {language === 'id' ? 'Kamera Live' : 'Live Cam'}
            </button>
            <button
              type="button"
              onClick={async () => {
                await loadSourceIntoEditor(createBlankDataUrl('lcd'), 'CANVAS_PIXEL', true);
                setSourceModalOpen(false);
                setActiveTab('draw');
                soundEngine.playCue('open');
              }}
              className="py-2 px-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              □ {language === 'id' ? 'Kanvas Baru' : 'Blank'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-2">
            <div className="text-[10px] font-bold opacity-80">
              {language === 'id' ? `Foto Tersimpan di DCIM (${dcimFiles.length})` : `DCIM Photos (${dcimFiles.length})`}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {dcimFiles.map((file) => {
                const isImg = file.content.startsWith('data:image/');
                const isWp = file.content.startsWith('wallpaper:');
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={async () => {
                      const src = isWp
                        ? renderWallpaperToDataUrl(file.content.replace('wallpaper:', '') as WallpaperId)
                        : file.content;
                      await loadSourceIntoEditor(src, file.name, true);
                      setSourceModalOpen(false);
                      soundEngine.playCue('select');
                    }}
                    className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-1 text-left cursor-pointer hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
                  >
                    <div className="h-14 w-full border border-current bg-[var(--lcd-bg)] overflow-hidden flex items-center justify-center">
                      {isImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={file.content} alt={file.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-mono text-[var(--lcd-fg)] px-1 text-center truncate">
                          {file.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-bold truncate mt-0.5">{file.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LIVE WEBRTC CAMERA CAPTURE */}
      {cameraModalOpen && (
        <div className="absolute inset-0 z-30 bg-[var(--lcd-bg)] flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <span className="text-xs font-bold">
              {language === 'id' ? 'Jepret Kamera ke Editor' : 'Camera Capture'}
            </span>
            <button
              type="button"
              onClick={() => setCameraModalOpen(false)}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 p-2 flex flex-col justify-between gap-2 min-h-0">
            <div className="flex-1 border-2 border-[var(--lcd-fg)] bg-black flex items-center justify-center overflow-hidden min-h-0">
              {cameraStatus === 'error' ? (
                <div className="p-4 text-center text-[#D8FF9A] text-xs space-y-2">
                  <div className="font-bold">
                    {language === 'id' ? 'Kamera tidak tersedia atau izin ditolak.' : 'Camera unavailable or permission denied.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraModalOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="px-3 py-1 border border-[#D8FF9A] text-xs font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Unggah Foto Sebagai Ganti' : 'Upload Photo Instead'}
                  </button>
                </div>
              ) : (
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                  style={{ filter: cameraLcdMode ? 'grayscale(1) contrast(1.8)' : 'none' }}
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setCameraFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
                className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
              >
                {language === 'id' ? 'Putar Cam' : 'Flip Cam'}
              </button>
              <button
                type="button"
                disabled={cameraStatus !== 'ready'}
                onClick={captureFromLiveCamera}
                className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer disabled:opacity-40"
              >
                ● {language === 'id' ? 'Jepret' : 'Capture'}
              </button>
              <button
                type="button"
                onClick={() => setCameraLcdMode((m) => !m)}
                className={`py-1.5 border-2 border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                  cameraLcdMode ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                }`}
              >
                {cameraLcdMode ? 'LCD ON' : 'Color'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SAVE & EXPORT */}
      {exportModalOpen && (
        <div className="absolute inset-0 z-20 bg-[var(--lcd-bg)] flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <span className="text-xs font-bold">
              {language === 'id' ? 'Simpan & Ekspor Foto' : 'Save & Export Photo'}
            </span>
            <button
              type="button"
              onClick={() => setExportModalOpen(false)}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto lcd-scroll">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold">
                {language === 'id' ? 'Nama Berkas' : 'File Name'}
              </label>
              <input
                type="text"
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                className="w-full px-2 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-mono font-bold outline-none"
              />
            </div>

            <div className="space-y-1">
              <span className="block text-[11px] font-bold">Format</span>
              <div className="grid grid-cols-2 gap-2">
                {(['png', 'jpeg'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={`py-1.5 border-2 border-[var(--lcd-fg)] text-xs font-bold uppercase cursor-pointer ${
                      exportFormat === fmt ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                    }`}
                  >
                    {fmt === 'png' ? 'PNG (Lossless)' : 'JPEG (Compact)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSaveToDcim}
                className="w-full py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'Simpan ke Galeri (DCIM)' : 'Save to Gallery (DCIM)'}
              </button>
              <button
                type="button"
                onClick={handleDownloadExport}
                className="w-full py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
              >
                ↓ {language === 'id' ? `Unduh File (.${exportFormat === 'jpeg' ? 'jpg' : 'png'})` : `Download (.${exportFormat === 'jpeg' ? 'jpg' : 'png'})`}
              </button>
              <button
                type="button"
                onClick={handleSetAsWallpaper}
                className="w-full py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer hover:bg-[var(--lcd-sec)]"
              >
                {language === 'id' ? 'Jadikan Wallpaper OS' : 'Set as OS Wallpaper'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
