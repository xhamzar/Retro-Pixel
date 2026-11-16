'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps } from '@/src/types/os';

type MapVisualStyle = 'lcd' | 'retro' | 'ink';
type TravelMode = 'driving' | 'foot' | 'bike';

interface SavedMapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  note?: string;
}

interface SearchPlaceResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type: string;
}

interface ActiveRouteInfo {
  fromLabel: string;
  toLabel: string;
  toLat: number;
  toLng: number;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  steps: string[];
  mode: TravelMode;
  isFallback: boolean;
}

interface GpsTelemetry {
  lat: number;
  lng: number;
  accuracy: number;
  speedKmh: number;
  heading: number | null;
  updatedAt: number;
}

const PIN_STORAGE_KEY = 'pixel_map_pins';

const DEFAULT_PINS: SavedMapPin[] = [
  { id: 'pin-monas', name: 'Monas Jakarta', lat: -6.175392, lng: 106.827153, note: 'Monumen Nasional' },
  { id: 'pin-tugu', name: 'Tugu Jogja', lat: -7.782928, lng: 110.367085, note: 'Yogyakarta' },
  { id: 'pin-sate', name: 'Gedung Sate', lat: -6.902472, lng: 107.61881, note: 'Bandung' },
];

const TILE_SIZE = 256;

function clampLat(lat: number): number {
  return Math.max(-85.0511, Math.min(85.0511, lat));
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function latLngToWorldPx(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((wrapLng(lng) + 180) / 360) * scale;
  const siny = Math.sin((clampLat(lat) * Math.PI) / 180);
  const clampedSin = Math.max(-0.9999, Math.min(0.9999, siny));
  const y = (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldPxToLatLng(px: number, py: number, zoom: number): { lat: number; lng: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = wrapLng((px / scale) * 360 - 180);
  const n = Math.PI - (2 * Math.PI * py) / scale;
  const lat = clampLat((180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
  return { lat, lng };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(sec: number): string {
  const mins = Math.max(1, Math.round(sec / 60));
  if (mins < 60) return `${mins} mnt`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}j ${rem}m`;
}

function getCssColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
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
  return [216, 255, 154];
}

function processTileToCanvas(
  img: HTMLImageElement,
  style: MapVisualStyle,
  lcdBgHex: string,
  lcdFgHex: string,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = TILE_SIZE;
  out.height = TILE_SIZE;
  const octx = out.getContext('2d');
  if (!octx) return out;

  if (style === 'retro') {
    // Full 256x256 resolution with crisp 16-bit palette quantization so street labels remain sharp
    octx.filter = 'contrast(1.16) saturate(1.22)';
    octx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
    octx.filter = 'none';
    const imgData = octx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.round(data[i] / 24) * 24);
      data[i + 1] = Math.min(255, Math.round(data[i + 1] / 24) * 24);
      data[i + 2] = Math.min(255, Math.round(data[i + 2] / 24) * 24);
    }
    octx.putImageData(imgData, 0, 0);
    return out;
  }

  if (style === 'ink') {
    // Full 256x256 high-contrast crisp grayscale
    octx.filter = 'grayscale(1) contrast(1.35)';
    octx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
    octx.filter = 'none';
    return out;
  }

  // 'lcd' -> Full 256x256 4-bit (16-shade) monochrome LCD ramp between --lcd-fg and --lcd-bg
  octx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
  const imgData = octx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const data = imgData.data;
  const [lr, lg, lb] = hexToRgb(lcdBgHex);
  const [dr, dg, dbCol] = hexToRgb(lcdFgHex);
  const levels = 15; // 16 distinct shades (0..15)

  for (let i = 0; i < data.length; i += 4) {
    const rawLum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const boosted = Math.max(0, Math.min(255, (rawLum - 128) * 1.25 + 128));
    const t = Math.round((boosted / 255) * levels) / levels;
    data[i] = Math.round(dr + (lr - dr) * t);
    data[i + 1] = Math.round(dg + (lg - dg) * t);
    data[i + 2] = Math.round(dbCol + (lb - dbCol) * t);
  }
  octx.putImageData(imgData, 0, 0);
  return out;
}

export const PixelMapsApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const themeId = useOSStore((s) => s.themeId);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const subscribeKey = useOSStore((s) => s.subscribeKey);
  const openApp = useOSStore((s) => s.openApp);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tile caches
  const rawTileCacheRef = useRef<Map<string, HTMLImageElement | 'loading' | 'error'>>(new Map());
  const styledTileCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    movedPx: number;
  } | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);

  // Viewport State (Default: Monas Jakarta)
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: -6.175392,
    lng: 106.827153,
  });
  const [zoom, setZoom] = useState<number>(15);
  const [visualStyle, setVisualStyle] = useState<MapVisualStyle>('retro');
  const [tileTick, setTileTick] = useState<number>(0);

  // GPS Live State
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(false);
  const [followGps, setFollowGps] = useState<boolean>(true);
  const [gpsTelemetry, setGpsTelemetry] = useState<GpsTelemetry | null>(null);
  const [gpsTrack, setGpsTrack] = useState<[number, number][]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Search State
  const [searchInput, setSearchInput] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchPlaceResult[]>([]);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  // Pins & Target State
  const [savedPins, setSavedPins] = useState<SavedMapPin[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [pinsModalOpen, setPinsModalOpen] = useState<boolean>(false);
  const [pinNameDraft, setPinNameDraft] = useState<string>('');
  const [addingPinModal, setAddingPinModal] = useState<boolean>(false);

  // Routing State
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [routingBusy, setRoutingBusy] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<ActiveRouteInfo | null>(null);
  const [routeStepsOpen, setRouteStepsOpen] = useState<boolean>(false);

  // Load saved pins from IndexedDB settings
  useEffect(() => {
    let active = true;
    db.settings.get(PIN_STORAGE_KEY).then(async (row) => {
      if (!active) return;
      if (row && typeof row.value === 'string') {
        try {
          const parsed = JSON.parse(row.value) as SavedMapPin[];
          if (Array.isArray(parsed)) {
            setSavedPins(parsed);
            return;
          }
        } catch {
          // ignore malformed stored pins
        }
      }
      await db.settings.put({ key: PIN_STORAGE_KEY, value: JSON.stringify(DEFAULT_PINS) });
      if (active) setSavedPins(DEFAULT_PINS);
    });
    return () => {
      active = false;
    };
  }, []);

  const persistPins = useCallback(async (nextPins: SavedMapPin[]) => {
    setSavedPins(nextPins);
    await db.settings.put({ key: PIN_STORAGE_KEY, value: JSON.stringify(nextPins) });
  }, []);

  // Stop GPS cleanly
  const stopGpsWatch = useCallback(() => {
    if (gpsWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!gpsEnabled) {
      stopGpsWatch();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Promise.resolve().then(() => {
        setGpsError(language === 'id' ? 'Perangkat tidak mendukung GPS' : 'Geolocation unsupported');
        setGpsEnabled(false);
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speedKmh =
          typeof pos.coords.speed === 'number' && Number.isFinite(pos.coords.speed)
            ? Math.max(0, Math.round(pos.coords.speed * 3.6))
            : 0;
        const heading =
          typeof pos.coords.heading === 'number' && Number.isFinite(pos.coords.heading)
            ? pos.coords.heading
            : null;
        setGpsError(null);
        setGpsTelemetry({
          lat,
          lng,
          accuracy: Math.round(pos.coords.accuracy || 15),
          speedKmh,
          heading,
          updatedAt: pos.timestamp || Date.now(),
        });
        setGpsTrack((prev) => {
          const last = prev[prev.length - 1];
          if (last && haversineMeters(last[0], last[1], lat, lng) < 8) {
            return prev;
          }
          return [...prev.slice(-199), [lat, lng]];
        });
        if (followGps) {
          setCenter({ lat, lng });
        }
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? language === 'id'
              ? 'Izin lokasi ditolak browser'
              : 'Location permission denied'
            : language === 'id'
              ? 'Sinyal GPS tidak tersedia'
              : 'GPS signal unavailable',
        );
        setGpsEnabled(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    gpsWatchIdRef.current = watchId;
    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (gpsWatchIdRef.current === watchId) {
        gpsWatchIdRef.current = null;
      }
    };
  }, [followGps, gpsEnabled, language, stopGpsWatch]);

  // Clear processed tile cache if OS theme changes
  useEffect(() => {
    styledTileCacheRef.current.clear();
  }, [themeId]);

  // Resize observer so canvas always matches physical pixels cleanly
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 320, h: 240 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load tile helper
  const requestTile = useCallback((z: number, x: number, y: number) => {
    const key = `${z}/${x}/${y}`;
    const existing = rawTileCacheRef.current.get(key);
    if (existing) return existing;

    if (rawTileCacheRef.current.size > 140) {
      const firstKey = rawTileCacheRef.current.keys().next().value;
      if (firstKey) rawTileCacheRef.current.delete(firstKey);
    }

    rawTileCacheRef.current.set(key, 'loading');
    const img = new Image();
    img.onload = () => {
      rawTileCacheRef.current.set(key, img);
      setTileTick((t) => t + 1);
    };
    img.onerror = () => {
      rawTileCacheRef.current.set(key, 'error');
      setTileTick((t) => t + 1);
    };
    img.src = `/api/maps/tile?z=${z}&x=${x}&y=${y}`;
    return 'loading' as const;
  }, []);

  // Draw Canvas Map Frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = stageSize.w;
    const ch = stageSize.h;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lcdBg = getCssColor('--lcd-bg', '#D8FF9A');
    const lcdFg = getCssColor('--lcd-fg', '#000000');
    const lcdSec = getCssColor('--lcd-sec', '#BDE879');

    ctx.fillStyle = visualStyle === 'retro' ? '#DCE6D5' : lcdBg;
    ctx.fillRect(0, 0, cw, ch);

    const centerWorld = latLngToWorldPx(center.lat, center.lng, zoom);
    const topLeftX = centerWorld.x - cw / 2;
    const topLeftY = centerWorld.y - ch / 2;

    const maxTiles = 2 ** zoom;
    const minTileX = Math.floor(topLeftX / TILE_SIZE);
    const maxTileX = Math.floor((topLeftX + cw) / TILE_SIZE);
    const minTileY = Math.max(0, Math.floor(topLeftY / TILE_SIZE));
    const maxTileY = Math.min(maxTiles - 1, Math.floor((topLeftY + ch) / TILE_SIZE));

    ctx.imageSmoothingEnabled = false;

    for (let ty = minTileY; ty <= maxTileY; ty += 1) {
      for (let tx = minTileX; tx <= maxTileX; tx += 1) {
        const wrappedTx = ((tx % maxTiles) + maxTiles) % maxTiles;
        const drawX = Math.round(tx * TILE_SIZE - topLeftX);
        const drawY = Math.round(ty * TILE_SIZE - topLeftY);

        const raw = requestTile(zoom, wrappedTx, ty);
        if (raw === 'loading' || raw === 'error') {
          ctx.fillStyle = lcdSec;
          ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = lcdFg;
          ctx.globalAlpha = 0.2;
          ctx.strokeRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
          ctx.globalAlpha = 1;
          ctx.fillStyle = lcdFg;
          ctx.font = 'bold 10px monospace';
          ctx.fillText(raw === 'error' ? 'TILE ERR' : '...', drawX + 10, drawY + 20);
          continue;
        }

        const styleKey = `${zoom}/${wrappedTx}/${ty}/${visualStyle}/${lcdBg}/${lcdFg}`;
        let styledCanvas = styledTileCacheRef.current.get(styleKey);
        if (!styledCanvas) {
          if (styledTileCacheRef.current.size > 140) {
            const firstKey = styledTileCacheRef.current.keys().next().value;
            if (firstKey) styledTileCacheRef.current.delete(firstKey);
          }
          styledCanvas = processTileToCanvas(raw, visualStyle, lcdBg, lcdFg);
          styledTileCacheRef.current.set(styleKey, styledCanvas);
        }
        ctx.drawImage(styledCanvas, drawX, drawY);
      }
    }

    const toScreen = (lat: number, lng: number) => {
      const wpt = latLngToWorldPx(lat, lng, zoom);
      return {
        x: Math.round(wpt.x - topLeftX),
        y: Math.round(wpt.y - topLeftY),
      };
    };

    // Draw GPS Track History Breadcrumb
    if (gpsTrack.length >= 2) {
      ctx.save();
      ctx.strokeStyle = visualStyle === 'retro' ? '#2563EB' : lcdFg;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      gpsTrack.forEach(([lat, lng], idx) => {
        const pt = toScreen(lat, lng);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Draw Active Route Polyline
    if (activeRoute && activeRoute.coordinates.length >= 2) {
      ctx.save();
      // Contrast Halo
      ctx.strokeStyle = visualStyle === 'retro' ? '#FFFFFF' : lcdBg;
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      activeRoute.coordinates.forEach(([lat, lng], idx) => {
        const pt = toScreen(lat, lng);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Inner route stroke
      ctx.strokeStyle = visualStyle === 'retro' ? '#DC2626' : lcdFg;
      ctx.lineWidth = 3;
      if (activeRoute.isFallback) ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Saved Pins
    for (const pin of savedPins) {
      const pt = toScreen(pin.lat, pin.lng);
      if (pt.x < -30 || pt.x > cw + 30 || pt.y < -30 || pt.y > ch + 30) continue;
      ctx.save();
      ctx.fillStyle = visualStyle === 'retro' ? '#DC2626' : lcdFg;
      ctx.strokeStyle = visualStyle === 'retro' ? '#FFFFFF' : lcdBg;
      ctx.lineWidth = 2;
      ctx.fillRect(pt.x - 5, pt.y - 12, 10, 10);
      ctx.strokeRect(pt.x - 5, pt.y - 12, 10, 10);
      ctx.fillRect(pt.x - 1, pt.y - 2, 2, 4);

      ctx.font = 'bold 9px monospace';
      const labelW = ctx.measureText(pin.name).width + 6;
      ctx.fillStyle = visualStyle === 'retro' ? '#FFFFFF' : lcdBg;
      ctx.fillRect(pt.x - labelW / 2, pt.y - 25, labelW, 11);
      ctx.strokeStyle = visualStyle === 'retro' ? '#000000' : lcdFg;
      ctx.lineWidth = 1;
      ctx.strokeRect(pt.x - labelW / 2, pt.y - 25, labelW, 11);
      ctx.fillStyle = visualStyle === 'retro' ? '#000000' : lcdFg;
      ctx.textAlign = 'center';
      ctx.fillText(pin.name, pt.x, pt.y - 17);
      ctx.restore();
    }

    // Draw Temporary Selected Target Pin
    if (selectedPoint) {
      const pt = toScreen(selectedPoint.lat, selectedPoint.lng);
      ctx.save();
      ctx.fillStyle = visualStyle === 'retro' ? '#D97706' : lcdFg;
      ctx.strokeStyle = visualStyle === 'retro' ? '#FFFFFF' : lcdBg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - 7, pt.y - 14);
      ctx.lineTo(pt.x + 7, pt.y - 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Live GPS Position Marker
    if (gpsTelemetry) {
      const pt = toScreen(gpsTelemetry.lat, gpsTelemetry.lng);
      ctx.save();
      // Accuracy ring (meters -> px)
      const metersPerPx =
        (156543.03392 * Math.cos((gpsTelemetry.lat * Math.PI) / 180)) / 2 ** zoom;
      const radiusPx = Math.max(10, Math.min(60, Math.round(gpsTelemetry.accuracy / Math.max(0.5, metersPerPx))));
      ctx.strokeStyle = visualStyle === 'retro' ? 'rgba(37,99,235,0.65)' : lcdFg;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Core Pixel GPS Marker
      ctx.fillStyle = visualStyle === 'retro' ? '#2563EB' : lcdFg;
      ctx.strokeStyle = visualStyle === 'retro' ? '#FFFFFF' : lcdBg;
      ctx.lineWidth = 2.5;
      ctx.fillRect(pt.x - 6, pt.y - 6, 12, 12);
      ctx.strokeRect(pt.x - 6, pt.y - 6, 12, 12);

      // Center inner dot
      ctx.fillStyle = visualStyle === 'retro' ? '#FFFFFF' : lcdBg;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      ctx.restore();
    }

    // Subtle pixel crosshair at map center
    ctx.save();
    ctx.strokeStyle = visualStyle === 'retro' ? 'rgba(0,0,0,0.4)' : lcdFg;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cw / 2 - 6, ch / 2);
    ctx.lineTo(cw / 2 + 6, ch / 2);
    ctx.moveTo(cw / 2, ch / 2 - 6);
    ctx.lineTo(cw / 2, ch / 2 + 6);
    ctx.stroke();
    ctx.restore();
  }, [
    activeRoute,
    center.lat,
    center.lng,
    gpsTelemetry,
    gpsTrack,
    requestTile,
    savedPins,
    selectedPoint,
    stageSize.h,
    stageSize.w,
    tileTick,
    visualStyle,
    zoom,
  ]);

  // Pointer Pan & Tap-to-Drop-Pin on Map Canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      movedPx: 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (!drag || !drag.active) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.movedPx += Math.hypot(dx, dy);

    if (drag.movedPx > 4 && followGps && gpsEnabled) {
      setFollowGps(false);
    }

    setCenter((prev) => {
      const wp = latLngToWorldPx(prev.lat, prev.lng, zoom);
      return worldPxToLatLng(wp.x - dx, wp.y - dy, zoom);
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    if (!drag) return;

    // Short tap without drag -> select map point
    if (drag.movedPx <= 6 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;
      const centerW = latLngToWorldPx(center.lat, center.lng, zoom);
      const targetW = {
        x: centerW.x - rect.width / 2 + tapX,
        y: centerW.y - rect.height / 2 + tapY,
      };
      const coords = worldPxToLatLng(targetW.x, targetW.y, zoom);
      soundEngine.playCue('click');
      setSelectedPoint({
        lat: coords.lat,
        lng: coords.lng,
        label: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      });
    }
  };

  // Search places (Nominatim or direct "lat, lng" input)
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchInput.trim();
    if (!q) return;

    // Check direct "lat, lng" coordinate paste
    const coordMatch = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = clampLat(Number(coordMatch[1]));
      const lng = wrapLng(Number(coordMatch[2]));
      setFollowGps(false);
      setCenter({ lat, lng });
      setZoom((z) => Math.max(z, 15));
      setSelectedPoint({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      setSearchOpen(false);
      soundEngine.playCue('select');
      return;
    }

    setSearching(true);
    try {
      const resp = await fetch(`/api/maps/search?q=${encodeURIComponent(q)}`);
      const json = (await resp.json()) as { results?: SearchPlaceResult[]; error?: string };
      const list = json.results ?? [];
      setSearchResults(list);
      setSearchOpen(true);
      if (list.length === 0) {
        showToast(language === 'id' ? 'Lokasi tidak ditemukan' : 'No places found');
      }
    } catch {
      showToast(language === 'id' ? 'Gagal mencari lokasi' : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Calculate Route to Target
  const computeRouteTo = useCallback(
    async (toLat: number, toLng: number, toLabel: string, overrideMode?: TravelMode) => {
      const originLat = gpsTelemetry?.lat ?? center.lat;
      const originLng = gpsTelemetry?.lng ?? center.lng;
      const originLabel = gpsTelemetry
        ? language === 'id'
          ? 'Lokasi GPS Saya'
          : 'My GPS'
        : language === 'id'
          ? 'Pusat Peta'
          : 'Map Center';
      const usedMode = overrideMode ?? travelMode;

      setRoutingBusy(true);
      try {
        const params = new URLSearchParams({
          fromLat: String(originLat),
          fromLng: String(originLng),
          toLat: String(toLat),
          toLng: String(toLng),
          mode: usedMode,
        });
        const resp = await fetch(`/api/maps/route?${params.toString()}`);
        const data = (await resp.json()) as {
          distanceMeters?: number;
          durationSeconds?: number;
          coordinates?: [number, number][];
          steps?: string[];
          isFallback?: boolean;
        };

        const coords =
          Array.isArray(data.coordinates) && data.coordinates.length >= 2
            ? data.coordinates
            : [
                [originLat, originLng] as [number, number],
                [toLat, toLng] as [number, number],
              ];

        setActiveRoute({
          fromLabel: originLabel,
          toLabel,
          toLat,
          toLng,
          distanceMeters: data.distanceMeters ?? Math.round(haversineMeters(originLat, originLng, toLat, toLng)),
          durationSeconds: data.durationSeconds ?? 60,
          coordinates: coords,
          steps: data.steps ?? [],
          mode: usedMode,
          isFallback: Boolean(data.isFallback),
        });
        setFollowGps(false);
        setCenter({ lat: (originLat + toLat) / 2, lng: (originLng + toLng) / 2 });
        soundEngine.playCue('select');
      } catch {
        showToast(language === 'id' ? 'Gagal menghitung rute' : 'Route error');
      } finally {
        setRoutingBusy(false);
      }
    },
    [center.lat, center.lng, gpsTelemetry, language, showToast, travelMode],
  );

  const toggleGps = () => {
    if (gpsEnabled) {
      setGpsEnabled(false);
      soundEngine.playCue('back');
      showToast(language === 'id' ? 'GPS dimatikan' : 'GPS stopped');
    } else {
      setFollowGps(true);
      setGpsEnabled(true);
      soundEngine.playCue('select');
      showToast(language === 'id' ? 'Mengaktifkan GPS...' : 'Starting GPS...');
    }
  };

  const savePixelSnapshotToDcim = async () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    const fileName = `MAP_${stamp}.png`;
    await db.files.add({
      folder: 'DCIM',
      name: fileName,
      mimeType: 'image/png',
      sizeKb: Math.max(4, Math.round((dataUrl.length * 0.75) / 1024)),
      content: dataUrl,
      createdAt: Date.now(),
    });
    soundEngine.playCue('shutter');
    showToast(language === 'id' ? `Peta disimpan ke DCIM: ${fileName}` : `Map saved: ${fileName}`);
  };

  // D-Pad panning & zoom
  useEffect(() => {
    return subscribeKey((cmd) => {
      if (pinsModalOpen || addingPinModal || searchOpen || routeStepsOpen) return false;
      const panStepPx = 56;
      if (cmd === 'UP' || cmd === 'DOWN' || cmd === 'LEFT' || cmd === 'RIGHT') {
        setFollowGps(false);
        setCenter((prev) => {
          const wp = latLngToWorldPx(prev.lat, prev.lng, zoom);
          const dx = cmd === 'LEFT' ? -panStepPx : cmd === 'RIGHT' ? panStepPx : 0;
          const dy = cmd === 'UP' ? -panStepPx : cmd === 'DOWN' ? panStepPx : 0;
          return worldPxToLatLng(wp.x + dx, wp.y + dy, zoom);
        });
        return true;
      }
      if (cmd === 'OK') {
        setZoom((z) => (z < 18 ? z + 1 : 13));
        soundEngine.playCue('click');
        return true;
      }
      return false;
    });
  }, [addingPinModal, pinsModalOpen, routeStepsOpen, searchOpen, subscribeKey, zoom]);

  // Softkeys
  useEffect(() => {
    if (pinsModalOpen || addingPinModal || searchOpen || routeStepsOpen) {
      setSoftkeys({
        leftLabel: '',
        centerLabel: 'OK',
        rightLabel: language === 'id' ? 'Tutup' : 'Close',
        onRight: () => {
          setPinsModalOpen(false);
          setAddingPinModal(false);
          setSearchOpen(false);
          setRouteStepsOpen(false);
        },
      });
    } else {
      setSoftkeys({
        leftLabel: gpsEnabled ? 'GPS ON' : 'GPS',
        centerLabel: language === 'id' ? 'Pin Saya' : 'My Pins',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: toggleGps,
        onCenter: () => setPinsModalOpen(true),
        onRight: onBack,
      });
    }
  });

  const cycleVisualStyle = () => {
    setVisualStyle((prev) => (prev === 'retro' ? 'lcd' : prev === 'lcd' ? 'ink' : 'retro'));
    soundEngine.playCue('click');
  };

  const styleLabel =
    visualStyle === 'lcd' ? 'LCD 4-Bit' : visualStyle === 'retro' ? '16-Bit' : 'Hi-Res';

  const currentDistToSelected = useMemo(() => {
    if (!selectedPoint || !gpsTelemetry) return null;
    return haversineMeters(gpsTelemetry.lat, gpsTelemetry.lng, selectedPoint.lat, selectedPoint.lng);
  }, [gpsTelemetry, selectedPoint]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)] relative">
      <AppHeader title={language === 'id' ? 'Peta & GPS Piksel' : 'Pixel Maps & GPS'} showChevrons={false} />

      {/* Top Search & Style Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center gap-1 p-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0"
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={language === 'id' ? 'Cari lokasi / lat,lng...' : 'Search place / lat,lng...'}
          className="flex-1 min-w-0 px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[11px] font-bold outline-none"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer whitespace-nowrap"
        >
          {searching ? '...' : language === 'id' ? 'Cari' : 'Go'}
        </button>
        <button
          type="button"
          onClick={cycleVisualStyle}
          className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer whitespace-nowrap"
          title={language === 'id' ? 'Ganti Gaya Peta' : 'Switch Map Style'}
        >
          {styleLabel}
        </button>
      </form>

      {/* Interactive Pixel Map Stage */}
      <div ref={stageRef} className="flex-1 min-h-0 relative overflow-hidden bg-[var(--lcd-sec)]">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
        />

        {/* Floating Zoom & GPS Quick Controls */}
        <div className="absolute right-1.5 top-1.5 flex flex-col gap-1 z-10">
          <button
            type="button"
            onClick={() => {
              setZoom((z) => Math.min(18, z + 1));
              soundEngine.playCue('click');
            }}
            className="w-7 h-7 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-sm font-bold leading-none cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom((z) => Math.max(3, z - 1));
              soundEngine.playCue('click');
            }}
            className="w-7 h-7 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-sm font-bold leading-none cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              if (gpsTelemetry) {
                setFollowGps(true);
                setCenter({ lat: gpsTelemetry.lat, lng: gpsTelemetry.lng });
                setZoom((z) => Math.max(z, 15));
              } else {
                toggleGps();
              }
            }}
            className={`w-7 h-7 border-2 border-[var(--lcd-fg)] text-[9px] font-bold leading-none cursor-pointer ${
              gpsEnabled && followGps ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
            }`}
            title={language === 'id' ? 'Pusatkan ke GPS' : 'Center GPS'}
          >
            GPS
          </button>
          <button
            type="button"
            onClick={savePixelSnapshotToDcim}
            className="w-7 h-7 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[9px] font-bold leading-none cursor-pointer"
            title={language === 'id' ? 'Simpan Foto Peta ke DCIM' : 'Save Map to DCIM'}
          >
            IMG
          </button>
        </div>

        {/* Zoom Badge (left top) */}
        <div className="absolute left-1.5 top-1.5 px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)]/90 text-[9px] font-mono font-bold tabular-nums pointer-events-none">
          Z{zoom} · {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </div>

        {/* Selected Point Floating Action Strip */}
        {selectedPoint && !activeRoute && (
          <div className="absolute left-1.5 right-1.5 bottom-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-1.5 flex items-center justify-between gap-1.5 z-10">
            <div className="min-w-0">
              <div className="text-[10px] font-bold truncate">{selectedPoint.label}</div>
              {currentDistToSelected !== null && (
                <div className="text-[9px] font-mono opacity-80">
                  {language === 'id' ? 'Jarak GPS:' : 'GPS Dist:'} {formatDistance(currentDistToSelected)}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPinNameDraft(selectedPoint.label.slice(0, 24));
                  setAddingPinModal(true);
                }}
                className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
              >
                + Pin
              </button>
              <button
                type="button"
                disabled={routingBusy}
                onClick={() => void computeRouteTo(selectedPoint.lat, selectedPoint.lng, selectedPoint.label)}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
              >
                {routingBusy ? '...' : language === 'id' ? 'Rute' : 'Route'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPoint(null)}
                className="px-1.5 py-1 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Active Route HUD */}
        {activeRoute && (
          <div className="absolute left-1.5 right-1.5 bottom-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-1.5 space-y-1 z-10">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <div className="text-[10px] font-bold truncate">
                  → {activeRoute.toLabel}
                </div>
                <div className="text-[10px] font-mono font-bold tabular-nums">
                  {formatDistance(activeRoute.distanceMeters)} · {formatDuration(activeRoute.durationSeconds)}
                  {activeRoute.isFallback ? ' (Lurus)' : ''}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setRouteStepsOpen(true)}
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
                >
                  {language === 'id' ? 'Panduan' : 'Steps'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRoute(null)}
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(['driving', 'bike', 'foot'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setTravelMode(m);
                    void computeRouteTo(activeRoute.toLat, activeRoute.toLng, activeRoute.toLabel, m);
                  }}
                  className={`py-0.5 border border-[var(--lcd-fg)] text-[9px] font-bold cursor-pointer ${
                    activeRoute.mode === m ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                  }`}
                >
                  {m === 'driving'
                    ? language === 'id'
                      ? 'Mobil'
                      : 'Drive'
                    : m === 'bike'
                      ? language === 'id'
                        ? 'Sepeda'
                        : 'Bike'
                      : language === 'id'
                        ? 'Jalan'
                        : 'Walk'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Live GPS Telemetry & Quick Tools Dock */}
      <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-2 py-1.5 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 text-[10px] font-mono leading-tight">
          {gpsTelemetry ? (
            <>
              <div className="font-bold truncate tabular-nums">
                ● GPS {gpsTelemetry.speedKmh} km/j · ±{gpsTelemetry.accuracy}m
              </div>
              <div className="opacity-80 truncate tabular-nums">
                {gpsTelemetry.lat.toFixed(5)}, {gpsTelemetry.lng.toFixed(5)}
              </div>
            </>
          ) : (
            <>
              <div className="font-bold truncate">
                {gpsError ? `⚠ ${gpsError}` : language === 'id' ? 'GPS Siaga (Klik GPS)' : 'GPS Standby'}
              </div>
              <div className="opacity-75 truncate">
                {language === 'id' ? 'Ketuk peta untuk Pin/Rute' : 'Tap map for Pin/Route'}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleGps}
            className={`px-2 py-1 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
              gpsEnabled ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
            }`}
          >
            {gpsEnabled ? 'GPS ON' : 'GPS OFF'}
          </button>
          <button
            type="button"
            onClick={() => {
              const target = selectedPoint ?? {
                lat: gpsTelemetry?.lat ?? center.lat,
                lng: gpsTelemetry?.lng ?? center.lng,
                label: `${(gpsTelemetry?.lat ?? center.lat).toFixed(3)}, ${(gpsTelemetry?.lng ?? center.lng).toFixed(3)}`,
              };
              setSelectedPoint(target);
              setPinNameDraft(target.label.slice(0, 24));
              setAddingPinModal(true);
            }}
            className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
          >
            + Pin
          </button>
          <button
            type="button"
            onClick={() => setPinsModalOpen(true)}
            className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
          >
            Pin ({savedPins.length})
          </button>
        </div>
      </div>

      {/* MODAL: SEARCH RESULTS */}
      {searchOpen && (
        <div className="absolute inset-0 z-20 bg-[var(--lcd-bg)] flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <span className="text-xs font-bold">
              {language === 'id' ? `Hasil Pencarian (${searchResults.length})` : `Search Results (${searchResults.length})`}
            </span>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll divide-y divide-[var(--lcd-fg)]/40">
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs opacity-75">
                {language === 'id' ? 'Tidak ada hasil ditemukan.' : 'No results found.'}
              </div>
            ) : (
              searchResults.map((res) => (
                <div key={res.id} className="p-2 space-y-1">
                  <div className="text-xs font-bold">{res.name}</div>
                  <div className="text-[10px] opacity-80 line-clamp-2">{res.displayName}</div>
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFollowGps(false);
                        setCenter({ lat: res.lat, lng: res.lng });
                        setZoom(15);
                        setSelectedPoint({ lat: res.lat, lng: res.lng, label: res.name });
                        setSearchOpen(false);
                        soundEngine.playCue('select');
                      }}
                      className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
                    >
                      {language === 'id' ? 'Lihat di Peta' : 'Show Map'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        void computeRouteTo(res.lat, res.lng, res.name);
                      }}
                      className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                    >
                      {language === 'id' ? 'Rute ke Sini' : 'Route Here'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD PIN */}
      {addingPinModal && selectedPoint && (
        <div className="absolute inset-0 z-30 bg-[var(--lcd-bg)]/95 flex flex-col justify-center p-3">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-3 space-y-2.5">
            <div className="text-xs font-bold">
              {language === 'id' ? 'Simpan Pin Lokasi Baru' : 'Save Location Pin'}
            </div>
            <div className="text-[10px] font-mono opacity-80">
              {selectedPoint.lat.toFixed(5)}, {selectedPoint.lng.toFixed(5)}
            </div>
            <input
              type="text"
              value={pinNameDraft}
              onChange={(e) => setPinNameDraft(e.target.value)}
              placeholder={language === 'id' ? 'Nama lokasi...' : 'Location name...'}
              className="w-full px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAddingPinModal(false)}
                className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const name = pinNameDraft.trim() || 'Pin Saya';
                  const newPin: SavedMapPin = {
                    id: `pin-${Date.now()}`,
                    name,
                    lat: selectedPoint.lat,
                    lng: selectedPoint.lng,
                  };
                  await persistPins([newPin, ...savedPins]);
                  setAddingPinModal(false);
                  soundEngine.playCue('select');
                  showToast(language === 'id' ? `Pin "${name}" disimpan` : `Pin "${name}" saved`);
                }}
                className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'Simpan Pin' : 'Save Pin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SAVED PINS */}
      {pinsModalOpen && (
        <div className="absolute inset-0 z-20 bg-[var(--lcd-bg)] flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <span className="text-xs font-bold">
              {language === 'id' ? 'Pin Lokasi Tersimpan' : 'Saved Location Pins'}
            </span>
            <button
              type="button"
              onClick={() => setPinsModalOpen(false)}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll divide-y divide-[var(--lcd-fg)]/40">
            {savedPins.length === 0 ? (
              <div className="p-4 text-center text-xs opacity-75">
                {language === 'id' ? 'Belum ada pin tersimpan.' : 'No saved pins yet.'}
              </div>
            ) : (
              savedPins.map((pin) => (
                <div key={pin.id} className="p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{pin.name}</div>
                    <div className="text-[10px] font-mono opacity-75">
                      {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFollowGps(false);
                        setCenter({ lat: pin.lat, lng: pin.lng });
                        setZoom(15);
                        setSelectedPoint({ lat: pin.lat, lng: pin.lng, label: pin.name });
                        setPinsModalOpen(false);
                        soundEngine.playCue('select');
                      }}
                      className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
                    >
                      {language === 'id' ? 'Buka' : 'Go'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPinsModalOpen(false);
                        void computeRouteTo(pin.lat, pin.lng, pin.name);
                      }}
                      className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                    >
                      {language === 'id' ? 'Rute' : 'Route'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await persistPins(savedPins.filter((p) => p.id !== pin.id));
                        soundEngine.playCue('back');
                      }}
                      className="px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setPinsModalOpen(false);
                openApp('gallery');
              }}
              className="flex-1 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              {language === 'id' ? 'Buka Galeri Foto Peta' : 'Open Map Gallery'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: TURN-BY-TURN ROUTE STEPS */}
      {routeStepsOpen && activeRoute && (
        <div className="absolute inset-0 z-20 bg-[var(--lcd-bg)] flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <span className="text-xs font-bold truncate">
              {language === 'id' ? `Petunjuk Arah → ${activeRoute.toLabel}` : `Directions → ${activeRoute.toLabel}`}
            </span>
            <button
              type="button"
              onClick={() => setRouteStepsOpen(false)}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="p-2 border-b border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[11px] font-mono font-bold">
            {activeRoute.fromLabel} → {activeRoute.toLabel} ({formatDistance(activeRoute.distanceMeters)},{' '}
            {formatDuration(activeRoute.durationSeconds)})
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-1.5">
            {activeRoute.steps.length === 0 ? (
              <div className="text-xs opacity-75">
                {language === 'id' ? 'Ikuti garis rute menuju tujuan.' : 'Follow the route line to destination.'}
              </div>
            ) : (
              activeRoute.steps.map((step, i) => (
                <div key={i} className="border border-[var(--lcd-fg)] p-1.5 text-[11px] flex gap-1.5">
                  <span className="font-mono font-bold shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
