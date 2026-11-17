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
          {/* Pixel Clouds */}
          <path d="M84 10h12v2h6v4H80v-4h4v-2z" fill="currentColor" opacity="0.85" />
          <rect x="86" y="12" width="12" height="2" fill="var(--lcd-bg)" />
          <path d="M124 14h10v2h4v3h-18v-3h4v-2z" fill="currentColor" opacity="0.85" />
          <rect x="126" y="16" width="10" height="1" fill="var(--lcd-bg)" />
          <rect x="58" y="8" width="6" height="1" fill="currentColor" opacity="0.7" />
          <rect x="60" y="9" width="2" height="1" fill="currentColor" opacity="0.7" />
          <rect x="66" y="12" width="4" height="1" fill="currentColor" opacity="0.7" />

          {/* Chimney Smoke Puffs */}
          <rect x="135" y="21" width="3" height="2" fill="currentColor" opacity="0.55" />
          <rect x="137" y="17" width="4" height="2" fill="currentColor" opacity="0.4" />
          <rect x="140" y="13" width="3" height="2" fill="currentColor" opacity="0.25" />

          {/* Stepped Distant Rolling Hills */}
          <path
            d="M0 50h12v-4h10v-4h12v4h10v4h14v-4h10v-4h12v-4h14v4h10v4h14v4h12v-4h10v-4h18v32H0z"
            fill="var(--lcd-sec)"
          />
          <path
            d="M0 50h12v-4h10v-4h12v4h10v4h14v-4h10v-4h12v-4h14v4h10v4h14v4h12v-4h10v-4h18v2h-18v4h-10v4h-12v-4h-14v-4h-10v-4H80v4H68v4H58v4H44v-4H34v-4H22v4H12v4H0z"
            fill="currentColor"
          />

          {/* Detailed Pixel Oak Tree */}
          <rect x="24" y="42" width="6" height="18" fill="currentColor" />
          <rect x="26" y="46" width="2" height="10" fill="var(--lcd-bg)" />
          <rect x="20" y="58" width="14" height="2" fill="currentColor" />
          <rect x="14" y="14" width="26" height="4" fill="currentColor" />
          <rect x="10" y="18" width="34" height="18" fill="currentColor" />
          <rect x="6" y="22" width="42" height="10" fill="currentColor" />
          {/* Tree Leaf Highlights */}
          <rect x="14" y="18" width="4" height="2" fill="var(--lcd-bg)" />
          <rect x="24" y="16" width="6" height="2" fill="var(--lcd-bg)" />
          <rect x="12" y="24" width="6" height="2" fill="var(--lcd-bg)" />
          <rect x="26" y="24" width="6" height="2" fill="var(--lcd-bg)" />
          <rect x="18" y="30" width="8" height="2" fill="var(--lcd-bg)" />
          <rect x="34" y="28" width="6" height="2" fill="var(--lcd-bg)" />

          {/* Small Pine Tree */}
          <rect x="61" y="48" width="4" height="12" fill="currentColor" />
          <rect x="57" y="44" width="12" height="4" fill="currentColor" />
          <rect x="59" y="40" width="8" height="4" fill="currentColor" />
          <rect x="61" y="36" width="4" height="4" fill="currentColor" />

          {/* Detailed Stepped Cottage */}
          <rect x="134" y="24" width="4" height="10" fill="currentColor" />
          <rect x="116" y="34" width="24" height="2" fill="currentColor" />
          <rect x="112" y="36" width="32" height="2" fill="currentColor" />
          <rect x="108" y="38" width="40" height="2" fill="currentColor" />
          <rect x="104" y="40" width="48" height="4" fill="currentColor" />
          {/* Roof Shingle Pixels */}
          <rect x="114" y="38" width="4" height="1" fill="var(--lcd-bg)" />
          <rect x="124" y="38" width="4" height="1" fill="var(--lcd-bg)" />
          <rect x="134" y="38" width="4" height="1" fill="var(--lcd-bg)" />
          <rect x="110" y="41" width="4" height="1" fill="var(--lcd-bg)" />
          <rect x="120" y="41" width="4" height="1" fill="var(--lcd-bg)" />
          <rect x="130" y="41" width="4" height="1" fill="var(--lcd-bg)" />
          {/* Cottage Walls & Windows */}
          <rect x="108" y="44" width="40" height="16" fill="var(--lcd-bg)" />
          <rect x="108" y="44" width="2" height="16" fill="currentColor" />
          <rect x="146" y="44" width="2" height="16" fill="currentColor" />
          <rect x="124" y="49" width="8" height="11" fill="currentColor" />
          <rect x="130" y="54" width="1" height="2" fill="var(--lcd-bg)" />
          <rect x="113" y="48" width="6" height="6" fill="currentColor" />
          <rect x="115" y="49" width="2" height="4" fill="var(--lcd-bg)" />
          <rect x="137" y="48" width="6" height="6" fill="currentColor" />
          <rect x="139" y="49" width="2" height="4" fill="var(--lcd-bg)" />

          {/* Wooden Fence */}
          <rect x="74" y="54" width="32" height="2" fill="currentColor" />
          <rect x="74" y="57" width="32" height="1" fill="currentColor" />
          {[76, 84, 92, 100].map((fx) => (
            <rect key={`fence-${fx}`} x={fx} y="51" width="2" height="9" fill="currentColor" />
          ))}

          {/* Foreground Grass, Flowers & Path */}
          <rect x="0" y="60" width="160" height="12" fill="currentColor" />
          <rect x="8" y="58" width="2" height="2" fill="currentColor" />
          <rect x="40" y="58" width="2" height="2" fill="currentColor" />
          <rect x="52" y="58" width="2" height="2" fill="currentColor" />
          <rect x="120" y="60" width="16" height="12" fill="var(--lcd-sec)" />
          <rect x="122" y="63" width="4" height="2" fill="var(--lcd-bg)" />
          <rect x="128" y="67" width="5" height="2" fill="var(--lcd-bg)" />
          <rect x="6" y="63" width="8" height="2" fill="var(--lcd-bg)" />
          <rect x="36" y="66" width="10" height="2" fill="var(--lcd-bg)" />
          <rect x="70" y="64" width="12" height="2" fill="var(--lcd-bg)" />
          <rect x="96" y="67" width="8" height="2" fill="var(--lcd-bg)" />
        </svg>
      );

    case 'mountains':
      return (
        <svg
          viewBox="0 0 160 72"
          className={className}
          shapeRendering="crispEdges"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Stepped Pixel Sun/Moon + Craters */}
          <rect x="120" y="10" width="16" height="14" fill="currentColor" />
          <rect x="122" y="8" width="12" height="2" fill="currentColor" />
          <rect x="118" y="12" width="2" height="10" fill="currentColor" />
          <rect x="136" y="12" width="2" height="10" fill="currentColor" />
          <rect x="122" y="12" width="12" height="10" fill="var(--lcd-bg)" />
          <rect x="124" y="14" width="3" height="2" fill="var(--lcd-sec)" />
          <rect x="130" y="18" width="2" height="2" fill="var(--lcd-sec)" />

          {/* Pixel Clouds */}
          <rect x="14" y="14" width="20" height="3" fill="var(--lcd-sec)" />
          <rect x="18" y="11" width="10" height="3" fill="var(--lcd-sec)" />
          <rect x="48" y="18" width="14" height="2" fill="var(--lcd-sec)" />

          {/* Far Mountain Range (Stepped) */}
          <path
            d="M0 62V44h6v-4h6v-4h6v-4h6v-4h6v-4h6v4h6v4h6v4h6v4h6v-6h6v-6h6v-6h6v-6h8v6h6v6h6v6h6v-4h6v-4h6v-4h8v4h6v4h6v4h4v18z"
            fill="var(--lcd-sec)"
          />

          {/* Main Peak (Center Stepped Pixel Mountain) */}
          <path
            d="M42 62h-4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h8v4h4v4h4v4h4v4h4v4h4v4h4v4h4v4h4v4h-80z"
            fill="currentColor"
          />
          {/* Left Peak (Stepped) */}
          <path
            d="M0 62V42h4v-4h4v-4h4v-4h4v-4h4v-4h8v4h4v4h4v4h4v4h4v4h4v18z"
            fill="currentColor"
          />
          {/* Right Peak */}
          <path
            d="M110 62v-8h4v-4h4v-4h4v-4h4v-4h4v-4h8v4h4v4h4v4h4v4h4v4h6v12z"
            fill="currentColor"
          />

          {/* Crisp Stepped Snow Caps */}
          <path d="M74 16h8v4h4v4h4v4h-6v-2h-4v4h-4v-4h-4v2h-6v-4h4v-4h4z" fill="var(--lcd-bg)" />
          <path d="M20 22h8v4h4v4h-4v-2h-4v3h-4v-3h-4v2h-4v-4h4z" fill="var(--lcd-bg)" />
          <path d="M130 34h8v4h4v2h-4v-1h-4v2h-4v-2h-4v1h-4v-2h4z" fill="var(--lcd-bg)" />

          {/* Pine Silhouettes Along Foothills */}
          {[8, 16, 46, 54, 102, 112, 148].map((px) => (
            <g key={`pine-${px}`}>
              <rect x={px} y="56" width="6" height="4" fill="var(--lcd-bg)" />
              <rect x={px + 1} y="53" width="4" height="3" fill="var(--lcd-bg)" />
              <rect x={px + 2} y="51" width="2" height="2" fill="var(--lcd-bg)" />
            </g>
          ))}

          {/* Lake & Water Ripples */}
          <rect x="0" y="60" width="160" height="12" fill="var(--lcd-sec)" />
          <rect x="0" y="60" width="160" height="2" fill="currentColor" />
          <rect x="20" y="64" width="22" height="2" fill="currentColor" />
          <rect x="64" y="66" width="36" height="2" fill="currentColor" />
          <rect x="116" y="64" width="26" height="2" fill="currentColor" />
          <rect x="74" y="69" width="16" height="1" fill="var(--lcd-bg)" />
        </svg>
      );

    case 'skyline':
      return (
        <svg
          viewBox="0 0 160 72"
          className={className}
          shapeRendering="crispEdges"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Starry Pixel Sky */}
          <rect x="14" y="8" width="2" height="2" fill="currentColor" />
          <rect x="38" y="6" width="2" height="2" fill="currentColor" />
          <rect x="64" y="10" width="2" height="2" fill="currentColor" />
          <rect x="114" y="8" width="2" height="2" fill="currentColor" />
          <rect x="146" y="12" width="2" height="2" fill="currentColor" />
          {/* Moon */}
          <rect x="130" y="8" width="8" height="8" fill="currentColor" />
          <rect x="133" y="8" width="5" height="5" fill="var(--lcd-bg)" />

          {/* Background Mid-Tone Towers */}
          <rect x="0" y="38" width="16" height="34" fill="var(--lcd-sec)" />
          <rect x="44" y="30" width="18" height="42" fill="var(--lcd-sec)" />
          <rect x="94" y="28" width="20" height="44" fill="var(--lcd-sec)" />

          {/* Foreground Skyscrapers */}
          <rect x="8" y="32" width="18" height="40" fill="currentColor" />
          <rect x="12" y="28" width="10" height="4" fill="currentColor" />
          <rect x="30" y="18" width="22" height="54" fill="currentColor" />
          <rect x="38" y="12" width="6" height="6" fill="currentColor" />
          <rect x="56" y="36" width="16" height="36" fill="currentColor" />
          <rect x="74" y="12" width="24" height="60" fill="currentColor" />
          <rect x="80" y="8" width="12" height="4" fill="currentColor" />
          <rect x="85" y="2" width="2" height="6" fill="currentColor" />
          <rect x="104" y="26" width="22" height="46" fill="currentColor" />
          <rect x="130" y="20" width="24" height="52" fill="currentColor" />
          <rect x="136" y="16" width="12" height="4" fill="currentColor" />

          {/* Crisp Lit Windows */}
          {[11, 17, 21].map((x) =>
            [36, 42, 48, 54, 60].map((y) => (
              <rect key={`s1-${x}-${y}`} x={x} y={y} width="3" height="3" fill="var(--lcd-bg)" />
            )),
          )}
          {[34, 40, 46].map((x) =>
            [22, 28, 34, 40, 46, 52, 58].map((y) => (
              <rect key={`s2-${x}-${y}`} x={x} y={y} width="3" height="3" fill="var(--lcd-bg)" />
            )),
          )}
          {[78, 84, 90].map((x) =>
            [16, 22, 28, 34, 40, 46, 52, 58].map((y) => (
              <rect
                key={`s3-${x}-${y}`}
                x={x}
                y={y}
                width="3"
                height="3"
                fill={(x + y) % 12 === 0 ? 'var(--lcd-sec)' : 'var(--lcd-bg)'}
              />
            )),
          )}
          {[108, 114, 120].map((x) =>
            [30, 36, 42, 48, 54].map((y) => (
              <rect key={`s4-${x}-${y}`} x={x} y={y} width="3" height="3" fill="var(--lcd-bg)" />
            )),
          )}
          {[134, 140, 146].map((x) =>
            [24, 30, 36, 42, 48, 54].map((y) => (
              <rect key={`s5-${x}-${y}`} x={x} y={y} width="3" height="3" fill="var(--lcd-bg)" />
            )),
          )}

          {/* Highway & Streetlamps */}
          <rect x="0" y="64" width="160" height="8" fill="currentColor" />
          <rect x="0" y="67" width="160" height="1" fill="var(--lcd-bg)" />
          {[12, 36, 60, 84, 108, 132, 152].map((lx) => (
            <rect key={`lamp-${lx}`} x={lx} y="61" width="2" height="3" fill="var(--lcd-sec)" />
          ))}
        </svg>
      );

    case 'sunrise':
      return (
        <svg
          viewBox="0 0 160 72"
          className={className}
          shapeRendering="crispEdges"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Sky Dither Horizon Band */}
          <rect x="0" y="34" width="160" height="10" fill="var(--lcd-sec)" opacity="0.5" />

          {/* Sunbeams */}
          <rect x="78" y="6" width="4" height="8" fill="currentColor" />
          <rect x="54" y="12" width="4" height="4" fill="currentColor" />
          <rect x="102" y="12" width="4" height="4" fill="currentColor" />
          <rect x="44" y="24" width="6" height="3" fill="currentColor" />
          <rect x="110" y="24" width="6" height="3" fill="currentColor" />

          {/* Stepped Pixel Sun Disk */}
          <rect x="70" y="18" width="20" height="2" fill="currentColor" />
          <rect x="66" y="20" width="28" height="4" fill="currentColor" />
          <rect x="62" y="24" width="36" height="20" fill="currentColor" />
          <rect x="68" y="24" width="24" height="18" fill="var(--lcd-sec)" />
          <rect x="72" y="28" width="16" height="12" fill="var(--lcd-bg)" />

          {/* Seagulls */}
          <rect x="26" y="16" width="4" height="1" fill="currentColor" />
          <rect x="30" y="17" width="2" height="1" fill="currentColor" />
          <rect x="32" y="16" width="4" height="1" fill="currentColor" />
          <rect x="122" y="14" width="3" height="1" fill="currentColor" />
          <rect x="125" y="15" width="2" height="1" fill="currentColor" />
          <rect x="127" y="14" width="3" height="1" fill="currentColor" />

          {/* Sailboat Silhouette */}
          <rect x="28" y="36" width="2" height="8" fill="currentColor" />
          <rect x="24" y="38" width="4" height="4" fill="currentColor" />
          <rect x="22" y="40" width="2" height="2" fill="currentColor" />
          <rect x="20" y="43" width="14" height="2" fill="currentColor" />

          {/* Ocean Surface & Crisp Pixel Sun Reflection */}
          <rect x="0" y="44" width="160" height="28" fill="var(--lcd-sec)" />
          <rect x="0" y="44" width="160" height="2" fill="currentColor" />
          <rect x="52" y="48" width="56" height="2" fill="var(--lcd-bg)" />
          <rect x="58" y="52" width="44" height="2" fill="currentColor" />
          <rect x="64" y="56" width="32" height="2" fill="var(--lcd-bg)" />
          <rect x="68" y="60" width="24" height="2" fill="currentColor" />
          <rect x="74" y="65" width="12" height="2" fill="var(--lcd-bg)" />
          <rect x="10" y="52" width="22" height="2" fill="currentColor" />
          <rect x="122" y="56" width="26" height="2" fill="currentColor" />
          <rect x="16" y="64" width="18" height="2" fill="currentColor" />
          <rect x="128" y="66" width="20" height="2" fill="currentColor" />
        </svg>
      );

    case 'night':
      return (
        <svg
          viewBox="0 0 160 72"
          className={className}
          shapeRendering="crispEdges"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Deep Night Backdrop */}
          <rect x="0" y="0" width="160" height="72" fill="currentColor" />

          {/* Crescent Pixel Moon */}
          <rect x="116" y="8" width="16" height="16" fill="var(--lcd-bg)" />
          <rect x="114" y="10" width="20" height="12" fill="var(--lcd-bg)" />
          <rect x="122" y="6" width="14" height="12" fill="currentColor" />
          <rect x="124" y="8" width="12" height="12" fill="currentColor" />

          {/* Twinkle Cross Stars & Pixel Dots */}
          <rect x="20" y="10" width="2" height="6" fill="var(--lcd-bg)" />
          <rect x="18" y="12" width="6" height="2" fill="var(--lcd-bg)" />
          <rect x="74" y="8" width="2" height="6" fill="var(--lcd-bg)" />
          <rect x="72" y="10" width="6" height="2" fill="var(--lcd-bg)" />
          <rect x="44" y="20" width="2" height="2" fill="var(--lcd-bg)" />
          <rect x="58" y="14" width="2" height="2" fill="var(--lcd-sec)" />
          <rect x="94" y="18" width="2" height="2" fill="var(--lcd-bg)" />
          <rect x="34" y="30" width="2" height="2" fill="var(--lcd-sec)" />
          <rect x="102" y="28" width="2" height="2" fill="var(--lcd-bg)" />
          <rect x="144" y="26" width="2" height="2" fill="var(--lcd-bg)" />

          {/* Stepped Mountain Silhouettes */}
          <path
            d="M0 54h16v-4h12v-4h14v-4h12v4h14v4h16v-4h14v-4h16v4h14v4h16v4h16v18H0z"
            fill="var(--lcd-sec)"
          />

          {/* Pine Forest Edge */}
          {[8, 18, 28, 134, 144, 152].map((tx) => (
            <g key={`nt-${tx}`}>
              <rect x={tx} y="52" width="6" height="6" fill="currentColor" />
              <rect x={tx + 1} y="48" width="4" height="4" fill="currentColor" />
              <rect x={tx + 2} y="44" width="2" height="4" fill="currentColor" />
            </g>
          ))}

          {/* Lakeside Cabin With Glowing Window */}
          <rect x="58" y="48" width="16" height="10" fill="currentColor" />
          <rect x="56" y="46" width="20" height="2" fill="currentColor" />
          <rect x="60" y="44" width="12" height="2" fill="currentColor" />
          <rect x="64" y="51" width="4" height="4" fill="var(--lcd-bg)" />

          {/* Moonlit Lake */}
          <rect x="0" y="58" width="160" height="14" fill="currentColor" />
          <rect x="0" y="58" width="160" height="2" fill="var(--lcd-bg)" />
          <rect x="118" y="62" width="12" height="2" fill="var(--lcd-bg)" />
          <rect x="120" y="66" width="8" height="2" fill="var(--lcd-bg)" />
          <rect x="64" y="62" width="4" height="2" fill="var(--lcd-sec)" />
          <rect x="24" y="65" width="18" height="2" fill="var(--lcd-sec)" />
        </svg>
      );

    case 'grid':
    default:
      return (
        <svg
          viewBox="0 0 160 72"
          className={className}
          shapeRendering="crispEdges"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Perspective Horizon Synth Grid */}
          {[0, 16, 32, 48, 64, 80, 96, 112, 128, 144].map((x) => (
            <rect key={`vx-${x}`} x={x} y="0" width="1" height="72" fill="currentColor" opacity="0.22" />
          ))}
          {[0, 12, 24, 36, 48, 60].map((y) => (
            <rect key={`hy-${y}`} x="0" y={y} width="160" height="1" fill="currentColor" opacity="0.22" />
          ))}
          <rect x="0" y="44" width="160" height="2" fill="currentColor" />
          <rect x="0" y="50" width="160" height="1" fill="currentColor" opacity="0.6" />
          <rect x="0" y="57" width="160" height="2" fill="currentColor" opacity="0.7" />
          <rect x="0" y="65" width="160" height="2" fill="currentColor" opacity="0.85" />

          {/* Retro Pixel Sun Emblem */}
          <rect x="68" y="10" width="24" height="2" fill="var(--lcd-sec)" />
          <rect x="64" y="14" width="32" height="3" fill="currentColor" />
          <rect x="62" y="19" width="36" height="4" fill="currentColor" />
          <rect x="62" y="25" width="36" height="4" fill="var(--lcd-sec)" />
          <rect x="64" y="31" width="32" height="4" fill="currentColor" />

          {/* HUD Terminal Window */}
          <rect x="40" y="18" width="80" height="30" fill="var(--lcd-bg)" stroke="currentColor" strokeWidth="2" />
          <rect x="40" y="18" width="80" height="6" fill="currentColor" />
          <rect x="44" y="20" width="4" height="2" fill="var(--lcd-bg)" />
          <rect x="50" y="20" width="4" height="2" fill="var(--lcd-bg)" />
          <rect x="46" y="28" width="14" height="14" fill="currentColor" />
          <rect x="49" y="31" width="8" height="8" fill="var(--lcd-bg)" />
          <rect x="52" y="34" width="2" height="2" fill="currentColor" />
          <rect x="66" y="28" width="44" height="4" fill="currentColor" />
          <rect x="66" y="35" width="32" height="3" fill="var(--lcd-sec)" />
          <rect x="66" y="40" width="20" height="2" fill="currentColor" />
        </svg>
      );
  }
};
