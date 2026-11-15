'use client';

import React from 'react';
import type { WallpaperId } from '@/src/types/os';

export interface WallpaperMeta {
  id: WallpaperId;
  nameId: string;
  nameEn: string;
}

export const WALLPAPERS: WallpaperMeta[] = [
  { id: 'village', nameId: 'Desa Klasik', nameEn: 'Classic Village' },
  { id: 'mountains', nameId: 'Puncak Gunung', nameEn: 'Mountain Peak' },
  { id: 'skyline', nameId: 'Kota Pixel', nameEn: 'Pixel Skyline' },
  { id: 'sunrise', nameId: 'Matahari Terbit', nameEn: 'Ocean Sunrise' },
  { id: 'night', nameId: 'Malam Berbintang', nameEn: 'Starry Night' },
  { id: 'grid', nameId: 'Kisi Retro', nameEn: 'Retro Matrix' },
];

export const PixelWallpaperArt: React.FC<{ id: WallpaperId; className?: string }> = ({
  id,
  className = 'w-full h-full',
}) => {
  switch (id) {
    case 'village':
      return (
        <svg
          viewBox="0 0 160 72"
          className={className}
          shapeRendering="crispEdges"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Clouds */}
          <path d="M88 12h16v2h4v4H84v-4h4v-2z" fill="currentColor" opacity="0.9" />
          <rect x="90" y="14" width="16" height="2" fill="var(--lcd-bg)" />
          <path d="M126 18h14v2h4v3h-22v-3h4v-2z" fill="currentColor" opacity="0.9" />
          <rect x="128" y="20" width="14" height="1" fill="var(--lcd-bg)" />

          {/* Distant hills */}
          <path d="M0 54 L28 38 L52 48 L88 32 L120 46 L144 36 L160 44 L160 72 L0 72 Z" fill="var(--lcd-sec)" />
          <path d="M0 54 L28 38 L52 48 L88 32 L120 46 L144 36 L160 44" stroke="currentColor" strokeWidth="2" fill="none" />

          {/* Big pixel tree on left */}
          <rect x="24" y="42" width="6" height="20" fill="currentColor" />
          <rect x="12" y="18" width="30" height="18" fill="currentColor" />
          <rect x="8" y="24" width="38" height="10" fill="currentColor" />
          <rect x="16" y="14" width="22" height="6" fill="currentColor" />
          {/* Tree texture cutouts */}
          <rect x="16" y="20" width="4" height="2" fill="var(--lcd-bg)" />
          <rect x="28" y="22" width="4" height="2" fill="var(--lcd-bg)" />
          <rect x="20" y="28" width="6" height="2" fill="var(--lcd-bg)" />
          <rect x="34" y="26" width="4" height="2" fill="var(--lcd-bg)" />

          {/* Cottage on right */}
          <rect x="118" y="46" width="24" height="16" fill="var(--lcd-bg)" stroke="currentColor" strokeWidth="2" />
          <polygon points="114,46 130,34 146,46" fill="currentColor" />
          <rect x="127" y="53" width="6" height="9" fill="currentColor" />
          <rect x="121" y="50" width="4" height="4" fill="currentColor" />
          <rect x="135" y="50" width="4" height="4" fill="currentColor" />

          {/* Foreground pixel grass & path */}
          <rect x="0" y="62" width="160" height="10" fill="currentColor" />
          <rect x="10" y="64" width="6" height="2" fill="var(--lcd-bg)" />
          <rect x="44" y="66" width="8" height="2" fill="var(--lcd-bg)" />
          <rect x="78" y="64" width="10" height="2" fill="var(--lcd-bg)" />
          <rect x="108" y="66" width="8" height="2" fill="var(--lcd-bg)" />
        </svg>
      );

    case 'mountains':
      return (
        <svg viewBox="0 0 160 72" className={className} shapeRendering="crispEdges" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <circle cx="128" cy="18" r="8" fill="currentColor" />
          <circle cx="128" cy="18" r="5" fill="var(--lcd-bg)" />
          <polygon points="0,72 34,26 68,72" fill="currentColor" />
          <polygon points="44,72 88,16 132,72" fill="currentColor" />
          <polygon points="98,72 132,32 160,72" fill="currentColor" />
          <polygon points="88,16 76,32 84,32 88,26 94,32 100,32" fill="var(--lcd-bg)" />
          <polygon points="34,26 26,38 34,34 42,38" fill="var(--lcd-bg)" />
          <rect x="0" y="66" width="160" height="6" fill="var(--lcd-sec)" />
        </svg>
      );

    case 'skyline':
      return (
        <svg viewBox="0 0 160 72" className={className} shapeRendering="crispEdges" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <rect x="6" y="34" width="18" height="38" fill="currentColor" />
          <rect x="28" y="20" width="22" height="52" fill="currentColor" />
          <rect x="54" y="40" width="16" height="32" fill="currentColor" />
          <rect x="74" y="14" width="26" height="58" fill="currentColor" />
          <rect x="85" y="6" width="4" height="8" fill="currentColor" />
          <rect x="104" y="30" width="20" height="42" fill="currentColor" />
          <rect x="128" y="22" width="24" height="50" fill="currentColor" />
          {[10, 16].map((x) => [40, 48, 56].map((y) => <rect key={`b1-${x}-${y}`} x={x} y={y} width="3" height="4" fill="var(--lcd-bg)" />))}
          {[32, 40].map((x) => [26, 34, 42, 50].map((y) => <rect key={`b2-${x}-${y}`} x={x} y={y} width="4" height="4" fill="var(--lcd-bg)" />))}
          {[78, 86, 94].map((x) => [20, 28, 36, 44, 52].map((y) => <rect key={`b3-${x}-${y}`} x={x} y={y} width="3" height="4" fill="var(--lcd-bg)" />))}
          {[132, 142].map((x) => [28, 36, 44, 52].map((y) => <rect key={`b4-${x}-${y}`} x={x} y={y} width="4" height="4" fill="var(--lcd-bg)" />))}
        </svg>
      );

    case 'sunrise':
      return (
        <svg viewBox="0 0 160 72" className={className} shapeRendering="crispEdges" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <rect x="78" y="10" width="4" height="8" fill="currentColor" />
          <rect x="58" y="18" width="4" height="4" fill="currentColor" />
          <rect x="98" y="18" width="4" height="4" fill="currentColor" />
          <rect x="64" y="24" width="32" height="20" fill="currentColor" />
          <rect x="68" y="20" width="24" height="4" fill="currentColor" />
          <rect x="0" y="44" width="160" height="28" fill="var(--lcd-sec)" />
          <rect x="0" y="44" width="160" height="2" fill="currentColor" />
          <rect x="52" y="50" width="56" height="2" fill="currentColor" />
          <rect x="62" y="56" width="36" height="2" fill="currentColor" />
          <rect x="70" y="62" width="20" height="2" fill="currentColor" />
          <rect x="14" y="52" width="18" height="2" fill="currentColor" />
          <rect x="124" y="58" width="22" height="2" fill="currentColor" />
        </svg>
      );

    case 'night':
      return (
        <svg viewBox="0 0 160 72" className={className} shapeRendering="crispEdges" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <rect x="0" y="0" width="160" height="72" fill="currentColor" />
          <rect x="118" y="10" width="16" height="16" fill="var(--lcd-bg)" />
          <rect x="124" y="10" width="12" height="12" fill="currentColor" />
          <rect x="18" y="12" width="3" height="3" fill="var(--lcd-bg)" />
          <rect x="44" y="22" width="2" height="2" fill="var(--lcd-bg)" />
          <rect x="72" y="10" width="3" height="3" fill="var(--lcd-bg)" />
          <rect x="94" y="24" width="2" height="2" fill="var(--lcd-bg)" />
          <rect x="30" y="34" width="2" height="2" fill="var(--lcd-bg)" />
          <path d="M0 58 L38 42 L76 54 L118 40 L160 56 L160 72 L0 72 Z" fill="var(--lcd-sec)" />
          <rect x="20" y="52" width="6" height="14" fill="var(--lcd-bg)" />
        </svg>
      );

    case 'grid':
    default:
      return (
        <svg viewBox="0 0 160 72" className={className} shapeRendering="crispEdges" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          {[0, 16, 32, 48, 64, 80, 96, 112, 128, 144].map((x) => (
            <rect key={`vx-${x}`} x={x} y="0" width="1" height="72" fill="currentColor" opacity="0.25" />
          ))}
          {[0, 12, 24, 36, 48, 60].map((y) => (
            <rect key={`hy-${y}`} x="0" y={y} width="160" height="1" fill="currentColor" opacity="0.25" />
          ))}
          <rect x="44" y="20" width="72" height="28" fill="var(--lcd-bg)" stroke="currentColor" strokeWidth="2" />
          <rect x="50" y="26" width="12" height="12" fill="currentColor" />
          <rect x="74" y="26" width="36" height="4" fill="currentColor" />
          <rect x="74" y="34" width="24" height="4" fill="currentColor" />
        </svg>
      );
  }
};
