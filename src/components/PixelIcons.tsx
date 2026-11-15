'use client';

import React from 'react';
import type { PixelIconName } from '@/src/types/os';

interface PixelIconProps {
  name: PixelIconName;
  size?: number;
  className?: string;
}

export const PixelIcon: React.FC<PixelIconProps> = ({ name, size = 32, className = '' }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    shapeRendering: 'crispEdges' as const,
    style: { imageRendering: 'pixelated' as const },
    className: `shrink-0 ${className}`,
    'aria-hidden': true as const,
  };

  switch (name) {
    // --- COMMUNICATION ---
    case 'message':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 25h24v2H5v-2zm22-17h2v17h-2V8z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed envelope */}
          <path
            d="M3 6h24v19H3V6zm2 2v15h20V8H5z"
            fill="currentColor"
          />
          {/* Stepped V-flap + fold accents */}
          <path
            d="M5 9h2v2H5V9zm2 2h3v2H7v-2zm3 2h3v2h-3v-2zm3 2h4v2h-4v-2zm4-2h3v2h-3v-2zm3-2h3v2h-3v-2zm3-2h2v2h-2V9zM6 19h3v2H6v-2zm15 0h3v2h-3v-2z"
            fill="currentColor"
          />
          <path d="M9 17h2v2H9v-2zm10 0h2v2h-2v-2z" fill="currentColor" fillOpacity={0.4} />
        </svg>
      );

    case 'phone':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path
            d="M8 10h2v5H8v-5zm2 5h2v3h-2v-3zm2 3h3v3h-3v-3zm3 3h3v2h-3v-2zm3 2h4v2h-4v-2zm-5 5h14v2H13v-2zm12-7h3v8h-3v-8z"
            fill="currentColor"
            fillOpacity={0.28}
          />
          {/* Retro handset silhouette */}
          <path
            d="M5 4h7v2h2v5h-3v3h2v2h2v2h3v-3h5v2h2v7h-3v2h-6v-1h-3v-1h-3v-1h-2v-2H8v-2H7v-3H6v-3H5V4z"
            fill="currentColor"
          />
          {/* Inner speaker & mouthpiece bevel highlights */}
          <path
            d="M7 6h2v3H7V6zm12 15h3v3h-3v-3zm-9-5h2v2h-2v-2z"
            fill="currentColor"
            fillOpacity={0.35}
          />
          <rect x="8" y="7" width="1" height="1" fill="currentColor" />
        </svg>
      );

    case 'contacts':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M6 27h21v2H6v-2zm19-21h2v21h-2V6z" fill="currentColor" fillOpacity={0.28} />
          {/* Spine rings */}
          <path d="M2 7h3v2H2V7zm0 5h3v2H2v-2zm0 5h3v2H2v-2zm0 5h3v2H2v-2z" fill="currentColor" />
          {/* Framed address book */}
          <path d="M4 3h21v24H4V3zm2 2v20h17V5H6z" fill="currentColor" />
          {/* Right index tabs */}
          <path d="M25 6h3v4h-3V6zm0 6h3v4h-3v-4zm0 6h3v4h-3v-4z" fill="currentColor" />
          {/* Bust portrait inside */}
          <path
            d="M12 8h5v2h1v4h-1v1h-5v-1h-1v-4h1V8zm-2 9h9v1h2v5H8v-5h2v-1z"
            fill="currentColor"
          />
          <rect x="13" y="10" width="3" height="3" fill="currentColor" fillOpacity={0.3} />
        </svg>
      );

    case 'profile':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h24v2H5v-2zm22-19h2v19h-2V7z" fill="currentColor" fillOpacity={0.28} />
          {/* Lanyard clip */}
          <path d="M13 2h6v4h-6V2zm2 1v2h2V3h-2z" fill="currentColor" />
          {/* Framed ID card */}
          <path d="M3 5h24v21H3V5zm2 2v17h20V7H5z" fill="currentColor" />
          {/* Left framed photo */}
          <path d="M7 10h7v11H7V10zm1 1v9h5v-9H8z" fill="currentColor" />
          <rect x="9" y="12" width="3" height="3" fill="currentColor" />
          <path d="M8 17h5v3H8v-3z" fill="currentColor" />
          {/* Right profile data lines */}
          <path d="M16 11h7v2h-7v-2zm0 4h6v2h-6v-2zm0 4h4v2h-4v-2z" fill="currentColor" />
        </svg>
      );

    case 'groups':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M4 26h25v2H4v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Left member */}
          <path d="M5 7h4v4H5V7zm-2 6h7v8H3v-6h1v-2z" fill="currentColor" fillOpacity={0.75} />
          {/* Right member */}
          <path d="M23 7h4v4h-4V7zm-1 6h7v8h-7v-8z" fill="currentColor" fillOpacity={0.75} />
          {/* Center foreground framed member */}
          <path
            d="M13 6h6v1h1v5h-1v1h-6v-1h-1V7h1V6zm-3 9h12v2h2v9H8v-9h2v-2z"
            fill="currentColor"
          />
          {/* Inner lapel/collar detail */}
          <path d="M14 17h4v2h-4v-2zm-3 3h10v4H11v-4z" fill="currentColor" fillOpacity={0.28} />
        </svg>
      );

    case 'email':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h24v2H5v-2zm22-20h2v20h-2V6z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed mail card */}
          <path d="M3 4h24v22H3V4zm2 2v18h20V6H5z" fill="currentColor" />
          {/* Crisp pixel @ symbol */}
          <path
            d="M11 9h10v2h2v8h-2v2h-5v-2h4v-7h-8v9h9v2H10v-2H8v-9h2V9h1zm3 4h4v5h-4v-5z"
            fill="currentColor"
          />
          <rect x="15" y="14" width="2" height="3" fill="currentColor" fillOpacity={0.3} />
        </svg>
      );

    case 'chat':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M24 19h5v2h-5v-2zm-18 5h16v2H6v-2zm-2 2h3v3H4v-3z" fill="currentColor" fillOpacity={0.28} />
          {/* Secondary back bubble */}
          <path d="M13 4h16v13h-3v3l-3-3h-2v-2h6V6H15v3h-2V4z" fill="currentColor" />
          {/* Primary framed front bubble */}
          <path d="M3 10h19v13H9l-4 4v-4H3V10zm2 2v9h15v-9H5z" fill="currentColor" />
          {/* Typing dots */}
          <path d="M8 15h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" fill="currentColor" />
        </svg>
      );

    // --- MULTIMEDIA ---
    case 'gallery':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h24v2H5v-2zm22-20h2v20h-2V6z" fill="currentColor" fillOpacity={0.28} />
          {/* Outer frame */}
          <path d="M3 4h24v22H3V4zm2 2v18h20V6H5z" fill="currentColor" />
          {/* Sun */}
          <path d="M8 8h4v4H8V8zm1-1h2v1H9V7zm0 5h2v1H9v-1z" fill="currentColor" />
          {/* Stepped mountain silhouette */}
          <path
            d="M7 21h18v1H7v-1zm1-2h17v2H8v-2zm2-2h6v2h-6v-2zm2-2h3v2h-3v-2zm6-1h5v3h-5v-3zm2-2h3v2h-3v-2z"
            fill="currentColor"
          />
          {/* Shaded mountain slope */}
          <path d="M13 17h4v2h-4v-2zm7-3h3v3h-3v-3z" fill="currentColor" fillOpacity={0.35} />
        </svg>
      );

    case 'music':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path
            d="M9 26h6v2H9v-2zm12-2h6v2h-6v-2zm5-17h2v16h-2V7z"
            fill="currentColor"
            fillOpacity={0.28}
          />
          {/* Framed double beamed eighth notes */}
          <path d="M11 4h15v5H11V4zm2 2v1h11V6H13z" fill="currentColor" />
          <path d="M11 9h3v13h-3V9zm12-1h3v12h-3V8z" fill="currentColor" />
          {/* Note heads with inner pixel glint */}
          <path d="M6 19h8v6H6v-6zm12-2h8v6h-8v-6z" fill="currentColor" />
          <path d="M8 21h2v2H8v-2zm12-2h2v2h-2v-2z" fill="currentColor" fillOpacity={0.35} />
          {/* Frame accent bars */}
          <path d="M4 7h4v2H4V7zm0 4h3v2H4v-2z" fill="currentColor" fillOpacity={0.5} />
        </svg>
      );

    case 'video':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h24v2H5v-2zm22-19h2v19h-2V7z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed filmstrip shell */}
          <path d="M3 5h24v21H3V5zm2 5v11h20V10H5z" fill="currentColor" />
          {/* Top & bottom sprocket holes */}
          <path
            d="M6 7h2v2H6V7zm5 0h2v2h-2V7zm5 0h2v2h-2V7zm5 0h2v2h-2V7zM6 22h2v2H6v-2zm5 0h2v2h-2v-2zm5 0h2v2h-2v-2zm5 0h2v2h-2v-2z"
            fill="currentColor"
            fillOpacity={0.3}
          />
          {/* Stepped play triangle */}
          <path
            d="M12 11h2v9h-2v-9zm2 1h2v7h-2v-7zm2 1h2v5h-2v-5zm2 1h2v3h-2v-3zm2 1h1v1h-1v-1z"
            fill="currentColor"
          />
        </svg>
      );

    case 'camera':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h24v2H5v-2zm22-16h2v16h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Shutter & top prism */}
          <path d="M5 6h4v2H5V6zm6-2h10v4H11V4z" fill="currentColor" />
          {/* Camera body */}
          <path d="M3 8h24v18H3V8zm2 2v14h20V10H5z" fill="currentColor" />
          {/* Flash window */}
          <rect x="21" y="11" width="3" height="3" fill="currentColor" />
          {/* Multi-ring stepped lens */}
          <path
            d="M12 11h7v2h2v7h-2v2h-7v-2h-2v-7h2v-2zm1 2v2h-1v3h1v2h5v-2h1v-3h-1v-2h-5z"
            fill="currentColor"
          />
          <rect x="14" y="15" width="3" height="3" fill="currentColor" />
          <rect x="13" y="14" width="1" height="1" fill="currentColor" fillOpacity={0.4} />
        </svg>
      );

    case 'radio':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-16h2v16h-2V11z" fill="currentColor" fillOpacity={0.28} />
          {/* Stepped telescopic antenna */}
          <path d="M7 7h4v2H7V7zm4-2h5v2h-5V5zm5-2h6v2h-6V3z" fill="currentColor" />
          {/* Framed radio body */}
          <path d="M3 9h24v18H3V9zm2 2v14h20V11H5z" fill="currentColor" />
          {/* Speaker grille left */}
          <path
            d="M7 13h2v2H7v-2zm4 0h2v2h-2v-2zm-4 4h2v2H7v-2zm4 0h2v2h-2v-2zm-4 4h2v2H7v-2zm4 0h2v2h-2v-2z"
            fill="currentColor"
          />
          {/* Tuning window & knob right */}
          <path d="M16 13h7v4h-7v-4zm1 1v2h5v-2h-5zm0 5h5v4h-5v-4z" fill="currentColor" />
          <rect x="19" y="14" width="1" height="2" fill="currentColor" />
        </svg>
      );

    case 'mic':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M11 27h12v2H11v-2zm9-20h2v9h-2V7z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed capsule head */}
          <path d="M12 3h8v14h-8V3zm2 2v10h4V5h-4z" fill="currentColor" />
          {/* Grille slots */}
          <path d="M14 7h4v1h-4V7zm0 3h4v1h-4v-1zm0 3h4v1h-4v-1z" fill="currentColor" />
          {/* U-mount cradle & stand */}
          <path d="M8 12h2v7h12v-7h2v9H8v-9zm7 9h2v5h5v2H10v-2h5v-5z" fill="currentColor" />
        </svg>
      );

    // --- PRODUCTIVITY ---
    case 'folder':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h24v2H5v-2zm22-15h2v15h-2V11z" fill="currentColor" fillOpacity={0.28} />
          {/* Folder tab & paper edge */}
          <path d="M3 5h10v2h2v2h12v17H3V5zm2 2v2h8V7H5zm0 4v13h20V11H5z" fill="currentColor" />
          {/* Inner document line */}
          <path d="M15 8h9v1h-9V8zm-7 6h16v2H8v-2zm0 4h11v2H8v-2z" fill="currentColor" fillOpacity={0.4} />
        </svg>
      );

    case 'note':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M7 27h20v2H7v-2zm18-20h2v20h-2V7z" fill="currentColor" fillOpacity={0.28} />
          {/* Spiral top rings */}
          <path d="M9 2h2v4H9V2zm6 0h2v4h-2V2zm6 0h2v4h-2V2z" fill="currentColor" />
          {/* Framed page with folded corner */}
          <path d="M5 4h20v18h-4v4h-1v1H5V4zm2 2v19h12v-4h4V6H7z" fill="currentColor" />
          {/* Folded corner triangle */}
          <path d="M21 22h3v2h-3v-2zm-1 2h2v2h-2v-2z" fill="currentColor" fillOpacity={0.45} />
          {/* Text lines */}
          <path d="M9 10h12v2H9v-2zm0 4h12v2H9v-2zm0 4h8v2H9v-2z" fill="currentColor" />
        </svg>
      );

    case 'calendar':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-20h2v20h-2V7z" fill="currentColor" fillOpacity={0.28} />
          {/* Binding rings */}
          <path d="M8 2h3v5H8V2zm13 0h3v5h-3V2z" fill="currentColor" />
          {/* Framed body + header band */}
          <path d="M3 5h24v22H3V5zm2 6v14h20V11H5z" fill="currentColor" />
          {/* 3x2 Date grid cells + highlighted today */}
          <path
            d="M7 14h3v3H7v-3zm6 0h3v3h-3v-3zm6 0h3v3h-3v-3zM7 19h3v3H7v-3zm12 0h3v3h-3v-3z"
            fill="currentColor"
          />
          <rect x="13" y="19" width="3" height="3" fill="currentColor" fillOpacity={0.35} />
        </svg>
      );

    case 'clock':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M10 27h14v2H10v-2zm15-16h2v12h-2V11zm-2 12h2v3h-2v-3z" fill="currentColor" fillOpacity={0.28} />
          {/* Stepped framed round dial */}
          <path
            d="M9 3h14v2h3v3h2v14h-2v3h-3v2H9v-2H6v-3H4V8h2V5h3V3zm1 2v2H7v3H6v10h1v3h3v2h12v-2h3v-3h1V10h-1V7h-3V5H10z"
            fill="currentColor"
          />
          {/* Cardinal ticks (12, 3, 6, 9) */}
          <path d="M15 6h2v2h-2V6zm0 18h2v2h-2v-2zM7 15h2v2H7v-2zm16 0h2v2h-2v-2z" fill="currentColor" />
          {/* Clock hands */}
          <path d="M15 9h2v8h6v2h-8V9z" fill="currentColor" />
        </svg>
      );

    case 'alarm':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M8 27h17v2H8v-2zm16-17h2v13h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Twin bells */}
          <path d="M4 4h6v2H4V4zM3 6h2v4H3V6zm19-2h6v2h-6V4zm5 2h2v4h-2V6z" fill="currentColor" />
          {/* Clock frame */}
          <path
            d="M9 6h14v2h2v15h-2v2H9v-2H7V8h2V6zm1 2v2H9v11h1v2h12v-2h1V10h-1V8H10z"
            fill="currentColor"
          />
          {/* Feet */}
          <path d="M7 25h3v3H7v-3zm15 0h3v3h-3v-3z" fill="currentColor" />
          {/* Hands */}
          <path d="M15 10h2v7h4v2h-6v-9z" fill="currentColor" />
        </svg>
      );

    case 'calculator':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M7 28h20v2H7v-2zm18-24h2v24h-2V4z" fill="currentColor" fillOpacity={0.28} />
          {/* Calculator body */}
          <path d="M5 2h20v26H5V2zm2 2v22h16V4H7z" fill="currentColor" />
          {/* LCD screen */}
          <path d="M9 6h12v5H9V6zm1 1v3h10V7H10z" fill="currentColor" />
          <rect x="17" y="8" width="2" height="1" fill="currentColor" />
          {/* Keypad 3x4 grid */}
          <path
            d="M9 13h3v3H9v-3zm4 0h3v3h-3v-3zm4 0h4v3h-4v-3zM9 17h3v3H9v-3zm4 0h3v3h-3v-3zm4 0h4v3h-4v-3zM9 21h3v3H9v-3zm4 0h3v3h-3v-3zm4 0h4v3h-4v-3z"
            fill="currentColor"
          />
        </svg>
      );

    case 'reminder':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M6 27h21v2H6v-2zm19-21h2v21h-2V6z" fill="currentColor" fillOpacity={0.28} />
          {/* Top pushpin */}
          <path d="M13 2h6v2h-2v2h-2V4h-2V2z" fill="currentColor" />
          {/* Framed task card */}
          <path d="M5 5h20v22H5V5zm2 2v18h16V7H7z" fill="currentColor" />
          {/* Checked item + lines */}
          <path
            d="M9 11h2v2H9v-2zm2 2h2v2h-2v-2zm2-4h2v4h-2V9zm3 2h5v2h-5v-2zM9 18h3v3H9v-3zm5 1h7v2h-7v-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'bell':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M6 24h21v2H6v-2zm7 3h6v2h-6v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Crown loop */}
          <rect x="14" y="3" width="4" height="3" fill="currentColor" />
          {/* Framed bell dome & flared rim */}
          <path
            d="M11 5h10v2h3v4h2v8h2v4H4v-4h2v-8h2V7h3V5zm0 2v3H9v9H7v2h18v-2h-2v-9h-2V7H11z"
            fill="currentColor"
          />
          {/* Clapper + ring ticks */}
          <path d="M13 24h6v3h-6v-3zM3 7h2v4H3V7zm24 0h2v4h-2V7z" fill="currentColor" />
        </svg>
      );

    // --- INTERNET ---
    case 'browser':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M10 27h14v2H10v-2zm15-17h2v12h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed stepped globe */}
          <path
            d="M9 3h14v2h3v3h2v14h-2v3h-3v2H9v-2H6v-3H4V8h2V5h3V3zm1 2v2H7v3H6v10h1v3h3v2h12v-2h3v-3h1V10h-1V7h-3V5H10z"
            fill="currentColor"
          />
          {/* Equator & latitude bars */}
          <path d="M6 14h20v2H6v-2zm2-5h16v2H8V9zm0 11h16v2H8v-2z" fill="currentColor" />
          {/* Central meridian & curved ribs */}
          <path
            d="M15 5h2v20h-2V5zm-4 2h2v16h-2V7zm8 0h2v16h-2V7z"
            fill="currentColor"
            fillOpacity={0.75}
          />
        </svg>
      );

    case 'download':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-7h2v7h-2v-7z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed arrow */}
          <path
            d="M13 3h6v10h5v2h-2v2h-2v2h-2v2h-4v-2h-2v-2h-2v-2H8v-2h5V3zm2 2v10h-2v1h2v2h2v-2h2v-1h-2V5h-2z"
            fill="currentColor"
          />
          {/* Framed tray */}
          <path d="M3 19h4v5h18v-5h4v8H3v-8z" fill="currentColor" />
        </svg>
      );

    case 'share':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path
            d="M21 11h7v2h-7v-2zM5 19h7v2H5v-2zm16 8h7v2h-7v-2z"
            fill="currentColor"
            fillOpacity={0.28}
          />
          {/* 3 framed nodes */}
          <path
            d="M19 4h8v8h-8V4zm2 2v4h4V6h-4zM3 12h8v8H3v-8zm2 2v4h4v-4H5zm14 6h8v8h-8v-8zm2 2v4h4v-4h-4z"
            fill="currentColor"
          />
          {/* Stepped connecting links */}
          <path
            d="M11 13h3v-2h3V9h2v2h-2v2h-3v2h-3v-2zm0 4h3v2h3v2h2v2h-2v-2h-3v-2h-3v-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'hotspot':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M11 27h12v2H11v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Signal waves */}
          <path
            d="M4 7h2v10H4V7zm2-2h2v2H6V5zm0 12h2v2H6v-2zm20-10h2v10h-2V7zm-2-2h2v2h-2V5zm0 12h2v2h-2v-2zM8 9h2v6H8V9zm14 0h2v6h-2V9z"
            fill="currentColor"
          />
          {/* Central emitter & tower */}
          <path d="M14 9h4v4h-4V9zm1 4h2v12h4v2H11v-2h4V13z" fill="currentColor" />
        </svg>
      );

    case 'wifi':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M14 27h6v2h-6v-2zm-4-7h14v2H10v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Outer arc */}
          <path d="M6 6h20v3H6V6zM3 9h3v3H3V9zm23 0h3v3h-3V9z" fill="currentColor" />
          {/* Middle arc */}
          <path d="M10 12h12v3H10v-3zm-3 3h3v3H7v-3zm15 0h3v3h-3v-3z" fill="currentColor" />
          {/* Inner arc */}
          <path d="M12 18h8v3h-8v-3z" fill="currentColor" />
          {/* Base dot */}
          <path d="M14 23h4v4h-4v-4z" fill="currentColor" />
        </svg>
      );

    case 'vpn':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M25 6h2v13h-2V6zm-10 21h4v2h-4v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed security shield */}
          <path
            d="M6 3h20v14h-2v4h-2v3h-3v2h-2v2h-2v-2h-2v-2H10v-3H8v-4H6V3zm2 2v11h2v4h2v2h3v2h2v-2h3v-2h2v-4h2V5H8z"
            fill="currentColor"
          />
          {/* Keyhole emblem */}
          <path d="M13 9h6v5h-2v5h-2v-5h-2V9z" fill="currentColor" />
        </svg>
      );

    case 'lock':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M7 27h20v2H7v-2zm18-14h2v14h-2V13z" fill="currentColor" fillOpacity={0.28} />
          {/* Shackle arch */}
          <path d="M10 3h12v3H10V3zM8 6h3v7H8V6zm13 0h3v7h-3V6z" fill="currentColor" />
          {/* Framed lock body */}
          <path d="M5 12h22v15H5V12zm2 2v11h18V14H7z" fill="currentColor" />
          {/* Keyhole */}
          <path d="M14 16h4v4h-1v3h-2v-3h-1v-4z" fill="currentColor" />
        </svg>
      );

    case 'cloud':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 24h24v2H5v-2zm22-7h2v7h-2v-7z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed stepped puffy cloud */}
          <path
            d="M11 6h9v2h3v3h4v3h2v10H3v-8h2v-3h4V8h2V6zm0 2v3H9v4H5v7h22v-6h-3v-3h-3v-3h-2V8h-8z"
            fill="currentColor"
          />
          {/* Inner highlight */}
          <path d="M12 10h5v2h-5v-2zm-4 5h4v2H8v-2z" fill="currentColor" fillOpacity={0.3} />
        </svg>
      );

    case 'sync':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M9 26h15v2H9v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Top clockwise arrow */}
          <path
            d="M8 6h15v3H8V6zM5 9h3v5H5V9zm17-4h3v2h2v2h2v3h-7V5z"
            fill="currentColor"
          />
          {/* Bottom counter-clockwise arrow */}
          <path
            d="M9 23h15v3H9v-3zm15-5h3v5h-3v-5zM3 20h7v7H8v-2H6v-2H3v-3z"
            fill="currentColor"
          />
        </svg>
      );

    // --- ENTERTAINMENT ---
    case 'game':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M4 25h25v2H4v-2zm23-15h2v15h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed gamepad body */}
          <path d="M2 8h26v17H2V8zm2 2v13h22V10H4z" fill="currentColor" />
          {/* D-pad */}
          <path d="M8 12h2v3h3v2h-3v3H8v-3H5v-2h3v-3z" fill="currentColor" />
          {/* Select / Start */}
          <path d="M14 19h2v2h-2v-2zm3 0h2v2h-2v-2z" fill="currentColor" fillOpacity={0.5} />
          {/* A / B buttons */}
          <path d="M22 12h3v3h-3v-3zm-3 4h3v3h-3v-3z" fill="currentColor" />
        </svg>
      );

    case 'snake':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h23v2H5v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed coiled snake body */}
          <path
            d="M4 4h17v6H9v4h10v6H9v2h11v4H4v-8h10v-2H4V4z"
            fill="currentColor"
          />
          {/* Scale pattern highlights */}
          <path
            d="M6 6h2v2H6V6zm4 0h2v2h-2V6zm4 0h2v2h-2V6zM6 16h2v2H6v-2zm0 6h2v2H6v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"
            fill="currentColor"
            fillOpacity={0.3}
          />
          {/* Eye + forked tongue */}
          <rect x="18" y="5" width="2" height="2" fill="currentColor" fillOpacity={0.2} />
          <path d="M21 6h4v2h-4V6zm4-1h2v1h-2V5zm0 3h2v1h-2V8z" fill="currentColor" />
          {/* Pixel apple */}
          <path d="M23 15h4v1h1v5h-1v1h-4v-1h-1v-5h1v-1zm1-2h2v2h-2v-2z" fill="currentColor" />
        </svg>
      );

    case 'tetris':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-9h2v9h-2v-9z" fill="currentColor" fillOpacity={0.28} />
          {/* T-tetromino top */}
          <path d="M11 3h5v5h-5V3zM6 8h15v5H6V8z" fill="currentColor" />
          {/* L-tetromino bottom left */}
          <path d="M4 16h5v11H4V16zm5 6h5v5H9v-5z" fill="currentColor" />
          {/* O-tetromino bottom right */}
          <path d="M17 17h10v10H17V17z" fill="currentColor" />
          {/* Inner 3D brick bevel pips */}
          <path
            d="M12 4h2v2h-2V4zM7 9h2v2H7V9zm5 0h2v2h-2V9zm5 0h2v2h-2V9zM5 17h2v2H5v-2zm0 6h2v2H5v-2zm5 0h2v2h-2v-2zm8-5h2v2h-2v-2zm5 0h2v2h-2v-2zm-5 5h2v2h-2v-2zm5 0h2v2h-2v-2z"
            fill="currentColor"
            fillOpacity={0.35}
          />
        </svg>
      );

    case 'puzzle':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M6 27h19v2H6v-2zm22-14h2v7h-2v-7z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed puzzle piece with top & right tabs */}
          <path
            d="M11 3h7v5h6v6h5v6h-5v7H4V8h7V3zm2 2v5H6v15h16v-6h5v-3h-5v-6h-6V5h-3z"
            fill="currentColor"
          />
          {/* Inner detail square */}
          <path d="M9 13h8v8H9v-8zm2 2v4h4v-4h-4z" fill="currentColor" fillOpacity={0.45} />
        </svg>
      );

    case 'book':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M4 26h26v2H4v-2zm24-19h2v19h-2V7z" fill="currentColor" fillOpacity={0.28} />
          {/* Open book frame */}
          <path
            d="M2 5h13v2h2V5h13v21H2V5zm2 2v16h11V7H4zm13 0v16h11V7H17z"
            fill="currentColor"
          />
          {/* Page text lines */}
          <path
            d="M6 10h7v2H6v-2zm0 4h7v2H6v-2zm0 4h5v2H6v-2zm13-8h7v2h-7v-2zm0 4h7v2h-7v-2zm0 4h5v2h-5v-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'comic':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-22h2v22h-2V5z" fill="currentColor" fillOpacity={0.28} />
          {/* Outer page frame + panel grid */}
          <path
            d="M3 3h24v24H3V3zm2 2v9h10V5H5zm12 0v9h8V5h-8zM5 16v9h20v-9H5z"
            fill="currentColor"
          />
          {/* Speech bubble + burst + horizon */}
          <path
            d="M7 7h6v4H9l-2 2V7zm12 1h4v4h-4V8zM7 20h16v3H7v-3zm3-2h5v2h-5v-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'wallpaper':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-19h2v19h-2V8z" fill="currentColor" fillOpacity={0.28} />
          {/* Hanging cord */}
          <path d="M14 2h4v2h-4V2zm-3 2h3v2h-3V4zm7 0h3v2h-3V4z" fill="currentColor" />
          {/* Thick framed picture */}
          <path d="M3 6h24v21H3V6zm2 2v17h20V8H5z" fill="currentColor" />
          {/* Moon + pixel mountain + pine */}
          <path
            d="M8 10h3v3H8v-3zm12 0h2v4h2v2h-6v-2h2v-4zM7 21h18v2H7v-2zm2-2h7v2H9v-2zm2-2h3v2h-3v-2z"
            fill="currentColor"
          />
        </svg>
      );

    // --- SYSTEM ---
    case 'apps':
      return (
        <svg {...common}>
          {/* Drop shadows */}
          <path
            d="M5 14h10v2H5v-2zm14 0h10v2H19v-2zM5 28h10v2H5v-2zm14 0h10v2H19v-2z"
            fill="currentColor"
            fillOpacity={0.28}
          />
          {/* 4 framed app squares */}
          <path
            d="M3 3h11v11H3V3zm2 2v7h7V5H5zM17 3h11v11H17V3zm2 2v7h7V5h-7zM3 17h11v11H3V17zm2 2v7h7v-7H5zM17 17h11v11H17V17zm2 2v7h7v-7h-7z"
            fill="currentColor"
          />
          {/* Center pips */}
          <path d="M7 7h3v3H7V7zm14 0h3v3h-3V7zM7 21h3v3H7v-3zm14 0h3v3h-3v-3z" fill="currentColor" />
        </svg>
      );

    case 'theme':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M7 26h17v2H7v-2zm19-16h2v10h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Stepped artist palette */}
          <path
            d="M8 4h15v2h3v3h2v8h-2v3h-4v2h-2v4H9v-2H6v-3H4V9h2V6h2V4zm1 2v2H7v3H6v9h2v3h3v1h7v-4h3v-2h4v-2h1v-6h-1V8h-3V6H9z"
            fill="currentColor"
          />
          {/* Swatches + thumb hole */}
          <path d="M10 9h3v3h-3V9zm6 0h3v3h-3V9zm4 4h3v3h-3v-3z" fill="currentColor" />
          <rect x="9" y="16" width="4" height="4" fill="currentColor" fillOpacity={0.35} />
        </svg>
      );

    case 'display':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 23h24v2H5v-2zm10 4h10v2H15v-2zm12-19h2v15h-2V8z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed LCD monitor */}
          <path d="M3 4h24v19H3V4zm2 2v13h20V6H5z" fill="currentColor" />
          {/* Screen diagonal glint */}
          <path d="M7 8h4v2H7V8zm2 2h4v2H9v-2z" fill="currentColor" fillOpacity={0.45} />
          {/* Stand */}
          <path d="M13 23h6v3h5v2H8v-2h5v-3z" fill="currentColor" />
        </svg>
      );

    case 'sound':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 21h5v2H5v-2zm7 4h4v2h-4v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed speaker cone */}
          <path
            d="M12 5h4v22h-4v-2h-2v-2H8v-2H3V11h5V9h2V7h2V5zm-2 4v2H8v2H5v6h3v2h2v2h2V9h-2z"
            fill="currentColor"
          />
          {/* 3 stepped sound waves */}
          <path
            d="M19 12h2v8h-2v-8zm4-3h2v14h-2V9zm4-3h2v20h-2V6z"
            fill="currentColor"
          />
        </svg>
      );

    case 'volume':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 22h6v2H5v-2zm13 2h12v2H18v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Speaker */}
          <path d="M3 11h5l6-5h2v20h-2l-6-5H3V11zm2 2v6h4l5 4V9l-5 4H5z" fill="currentColor" />
          {/* Stepped level bars */}
          <path d="M19 16h3v8h-3v-8zm4-4h3v12h-3V12zm4-4h3v16h-3V8z" fill="currentColor" />
        </svg>
      );

    case 'storage':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-21h2v21h-2V6z" fill="currentColor" fillOpacity={0.28} />
          {/* 3 stacked drive bays */}
          <path
            d="M3 4h24v7H3V4zm2 2v3h20V6H5zM3 12h24v7H3v-7zm2 2v3h20v-3H5zM3 20h24v7H3v-7zm2 2v3h20v-3H5z"
            fill="currentColor"
          />
          {/* Drive slot + LED pips */}
          <path
            d="M7 7h10v1H7V7zm14 0h2v1h-2V7zM7 15h10v1H7v-1zm14 0h2v1h-2v-1zM7 23h10v1H7v-1zm14 0h2v1h-2v-1z"
            fill="currentColor"
          />
        </svg>
      );

    case 'battery':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 24h22v2H5v-2zm21-14h2v14h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed battery cell + terminal cap */}
          <path d="M3 8h23v16H3V8zm2 2v12h19V10H5zm21 2h3v8h-3v-8z" fill="currentColor" />
          {/* 3 segmented charge bars */}
          <path d="M7 12h4v8H7v-8zm6 0h4v8h-4v-8zm6 0h3v8h-3v-8z" fill="currentColor" />
        </svg>
      );

    case 'settings':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path
            d="M13 27h8v2h-8v-2zm13-13h2v6h-2v-6zm-3 9h3v3h-3v-3z"
            fill="currentColor"
            fillOpacity={0.28}
          />
          {/* 8-tooth precision gear */}
          <path
            d="M13 3h6v3h3V4h3v3h2v3h-2v3h3v6h-3v3h2v3h-3v2h-3v-2h-2v4h-6v-4h-3v2H7v-3H5v-3h2v-3H4v-6h3v-3H5V7h3V5h3v2h2V3zm0 5v2h-3v2H9v8h1v2h3v2h6v-2h3v-2h1v-8h-1v-2h-3V8h-6z"
            fill="currentColor"
          />
          {/* Inner axle hub */}
          <path d="M13 12h6v8h-6v-8zm2 2v4h2v-4h-2z" fill="currentColor" />
        </svg>
      );

    // --- UI & STATUS CHROME ---
    case 'signal':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M6 27h23v2H6v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* 4 stepped signal bars */}
          <path
            d="M4 21h4v6H4v-6zm6-5h4v11h-4V16zm6-5h4v16h-4V11zm6-6h4v22h-4V5z"
            fill="currentColor"
          />
        </svg>
      );

    case 'sunCloud':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M11 26h19v2H11v-2z" fill="currentColor" fillOpacity={0.28} />
          {/* Sun rays & disc */}
          <path
            d="M9 3h2v3H9V3zm0 11h2v2H9v-2zM3 9h3v2H3V9zm1-4h2v2H4V5zm10 0h2v2h-2V5zM7 6h6v6H7V6z"
            fill="currentColor"
          />
          {/* Framed foreground cloud */}
          <path
            d="M14 11h7v2h3v3h4v9H9v-7h2v-4h3v-3zm0 2v3h-2v3h-1v4h15v-5h-3v-3h-3v-2h-6z"
            fill="currentColor"
          />
        </svg>
      );

    case 'search':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M9 21h10v2H9v-2zm13 3h6v5h-6v-5z" fill="currentColor" fillOpacity={0.28} />
          {/* Stepped circular lens */}
          <path
            d="M8 4h10v2h3v3h2v9h-2v3h-3v2H8v-2H5v-3H3V9h2V6h3V4zm1 2v2H7v2H5v6h2v2h2v2h8v-2h2v-2h2v-6h-2V8h-2V6H9z"
            fill="currentColor"
          />
          {/* Inner glint */}
          <path d="M9 9h4v2H9V9zm0 2h2v2H9v-2z" fill="currentColor" fillOpacity={0.5} />
          {/* Stepped handle */}
          <path d="M20 20h3v2h2v2h2v2h2v2h-3v-2h-2v-2h-2v-2h-2v-2z" fill="currentColor" />
        </svg>
      );

    case 'chevronLeft':
      return (
        <svg {...common}>
          <path
            d="M19 6h3v3h-3V6zm-3 3h3v3h-3V9zm-3 3h3v3h-3v-3zm-3 3h3v3h-3v-3zm3 3h3v3h-3v-3zm3 3h3v3h-3v-3zm3 3h3v3h-3v-3z"
            fill="currentColor"
            fillOpacity={0.28}
          />
          <path
            d="M18 5h3v3h-3V5zm-3 3h3v3h-3V8zm-3 3h3v3h-3v-3zm-3 3h3v4H9v-4zm3 4h3v3h-3v-3zm3 3h3v3h-3v-3zm3 3h3v3h-3v-3z"
            fill="currentColor"
          />
        </svg>
      );

    case 'chevronRight':
      return (
        <svg {...common}>
          <path
            d="M12 6h3v3h-3V6zm3 3h3v3h-3V9zm3 3h3v3h-3v-3zm3 3h3v3h-3v-3zm-3 3h3v3h-3v-3zm-3 3h3v3h-3v-3zm-3 3h3v3h-3v-3z"
            fill="currentColor"
            fillOpacity={0.28}
          />
          <path
            d="M11 5h3v3h-3V5zm3 3h3v3h-3V8zm3 3h3v3h-3v-3zm3 3h3v4h-3v-4zm-3 4h3v3h-3v-3zm-3 3h3v3h-3v-3zm-3 3h3v3h-3v-3z"
            fill="currentColor"
          />
        </svg>
      );

    case 'play':
      return (
        <svg {...common}>
          <path d="M9 7h3v20H9V7zm3 2h3v16h-3V9zm3 2h3v12h-3V11zm3 2h3v8h-3v-8zm3 2h3v4h-3v-4z" fill="currentColor" fillOpacity={0.28} />
          <path
            d="M7 5h3v22H7V5zm3 2h3v18h-3V7zm3 2h3v14h-3V9zm3 2h3v10h-3V11zm3 2h3v6h-3v-6zm3 2h3v2h-3v-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'pause':
      return (
        <svg {...common}>
          <path d="M9 26h6v2H9v-2zm10 0h6v2h-6v-2z" fill="currentColor" fillOpacity={0.28} />
          <path
            d="M7 5h6v21H7V5zm2 2v17h2V7H9zm8-2h6v21h-6V5zm2 2v17h2V7h-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'prev':
      return (
        <svg {...common}>
          <path d="M7 26h4v2H7v-2zm7-10h12v10H14V16z" fill="currentColor" fillOpacity={0.28} />
          <path
            d="M6 6h4v20H6V6zm17 0h3v20h-3V6zm-3 2h3v16h-3V8zm-3 2h3v12h-3V10zm-3 2h3v8h-3v-8zm-2 2h2v4h-2v-4z"
            fill="currentColor"
          />
        </svg>
      );

    case 'next':
      return (
        <svg {...common}>
          <path d="M22 26h4v2h-4v-2zM7 16h12v10H7V16z" fill="currentColor" fillOpacity={0.28} />
          <path
            d="M22 6h4v20h-4V6zM6 6h3v20H6V6zm3 2h3v16H9V8zm3 2h3v12h-3V10zm3 2h3v8h-3v-8zm3 2h2v4h-2v-4z"
            fill="currentColor"
          />
        </svg>
      );

    case 'plus':
      return (
        <svg {...common}>
          <path d="M14 27h6v2h-6v-2zm6-9h8v2h-8v-2z" fill="currentColor" fillOpacity={0.28} />
          <path
            d="M13 4h6v9h9v6h-9v9h-6v-9H4v-6h9V4zm2 2v9H6v2h9v9h2v-9h9v-2h-9V6h-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'trash':
      return (
        <svg {...common}>
          <path d="M8 27h17v2H8v-2zm16-17h2v17h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Lid + handle */}
          <path d="M11 3h10v3h-2V5h-6v1h-2V3zM5 6h22v3H5V6z" fill="currentColor" />
          {/* Framed bin + vertical ribs */}
          <path
            d="M7 10h18v17H7V10zm2 2v13h14V12H9zm3 2h2v9h-2v-9zm6 0h2v9h-2v-9z"
            fill="currentColor"
          />
        </svg>
      );

    case 'check':
      return (
        <svg {...common}>
          <path
            d="M25 8h3v3h-3V8zm-3 3h3v3h-3v-3zm-3 3h3v3h-3v-3zm-3 3h3v3h-3v-3zm-3 3h3v3h-3v-3zm-3-3h3v3h-3v-3z"
            fill="currentColor"
            fillOpacity={0.28}
          />
          <path
            d="M24 6h4v4h-4V6zm-3 3h4v4h-4V9zm-3 3h4v4h-4v-4zm-3 3h4v4h-4v-4zm-3 3h4v4h-4v-4zm-3-3h3v4H9v-4zm-3-3h3v4H6v-4z"
            fill="currentColor"
          />
        </svg>
      );

    case 'tv':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-17h2v17h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Rabbit-ear antennas */}
          <path
            d="M8 2h2v2H8V2zm2 2h2v2h-2V4zm2 2h2v2h-2V6zm8-4h2v2h-2V2zm-2 2h2v2h-2V4zm-2 2h2v2h-2V6zM13 7h6v2h-6V7z"
            fill="currentColor"
          />
          {/* Retro TV outer frame */}
          <path
            d="M3 9h24v18H3V9zm2 2v14h20V11H5z"
            fill="currentColor"
          />
          {/* Left CRT viewport bezel */}
          <path
            d="M7 13h12v10H7V13zm1 1v8h10v-8H8z"
            fill="currentColor"
          />
          {/* Scanline / broadcast bar inside CRT */}
          <path
            d="M9 15h3v2H9v-2zm4 0h4v1h-4v-1zm-4 3h8v1H9v-1zm0 2h5v1H9v-1z"
            fill="currentColor"
            fillOpacity={0.55}
          />
          {/* Right rotary dials & speaker grille */}
          <path
            d="M21 13h3v3h-3v-3zm0 4h3v3h-3v-3zm0 4h3v2h-3v-2z"
            fill="currentColor"
          />
          {/* TV stand feet */}
          <path d="M6 27h3v2H6v-2zm15 0h3v2h-3v-2z" fill="currentColor" />
        </svg>
      );

    case 'tamagotchi':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M9 28h16v2H9v-2zm16-17h2v14h-2V11z" fill="currentColor" fillOpacity={0.28} />
          {/* Keychain ring */}
          <path d="M13 2h6v2h-6V2zm2 2h2v2h-2V4z" fill="currentColor" />
          {/* Egg-shaped classic Tamagotchi shell */}
          <path
            d="M11 5h10v2h3v3h2v13h-2v3h-3v2H11v-2H8v-3H6V10h2V7h3V5zm0 2v2H9v3H8v10h1v2h2v2h10v-2h2v-2h1V12h-1V9h-2V7H11z"
            fill="currentColor"
          />
          {/* Inner pixel LCD screen */}
          <path d="M10 10h12v9H10v-9zm1 1v7h10v-7H11z" fill="currentColor" />
          {/* Cute pixel pet face inside screen */}
          <path
            d="M13 13h2v2h-2v-2zm4 0h2v2h-2v-2zm-2 3h2v1h-2v-1z"
            fill="currentColor"
          />
          {/* Classic 3 hardware buttons A B C */}
          <path
            d="M10 21h3v2h-3v-2zm5 1h3v2h-3v-2zm4-1h3v2h-3v-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'studio':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M6 27h22v2H6v-2zm20-21h2v21h-2V6z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed audio mixer / composer console */}
          <path
            d="M4 4h22v23H4V4zm2 2v19h18V6H6z"
            fill="currentColor"
          />
          {/* Beamed eighth note */}
          <path
            d="M12 8h10v3H14v7h-2V8zm8 3h2v8h-2v-8zM9 17h5v4H9v-4zm8 1h5v4h-5v-4z"
            fill="currentColor"
          />
          {/* Bottom equalizer fader ticks */}
          <path
            d="M8 23h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"
            fill="currentColor"
            fillOpacity={0.65}
          />
        </svg>
      );

    case 'videoEditor':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 27h24v2H5v-2zm22-17h2v17h-2V10z" fill="currentColor" fillOpacity={0.28} />
          {/* Angled clapper top */}
          <path
            d="M3 5h24v5H3V5zm3 1v3h3V6H6zm6 0v3h3V6h-3zm6 0v3h3V6h-3z"
            fill="currentColor"
          />
          {/* Framed filmstrip & timeline cut slate */}
          <path d="M3 10h24v17H3V10zm2 2v13h20V12H5z" fill="currentColor" />
          {/* Play triangle + vertical split playhead bar */}
          <path
            d="M8 14h2v9H8v-9zm2 2h2v5h-2v-5zm2 1h2v3h-2v-3zm5-4h2v11h-2V13zm4 3h2v5h-2v-5z"
            fill="currentColor"
          />
        </svg>
      );

    case 'photoEditor':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h23v2H5v-2zm21-19h2v19h-2V7z" fill="currentColor" fillOpacity={0.28} />
          {/* Photo frame */}
          <path d="M3 5h23v21H3V5zm2 2v17h19V7H5z" fill="currentColor" />
          {/* Sun / Mountain pixel motif inside photo */}
          <rect x="8" y="9" width="3" height="3" fill="currentColor" />
          <path d="M6 22l5-6 3 3 4-5 5 8H6z" fill="currentColor" fillOpacity={0.6} />
          {/* Crop corner brackets + pixel brush diagonal accent */}
          <path
            d="M18 3h9v3h-2V5h-7V3zm7 7h2v7h-2v-7zM16 14h3v2h-3v-2zm2-2h3v2h-3v-2zm2-2h3v2h-3v-2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'terminal':
      return (
        <svg {...common}>
          {/* Drop shadow */}
          <path d="M5 26h24v2H5v-2zm22-20h2v20h-2V6z" fill="currentColor" fillOpacity={0.28} />
          {/* Framed CRT / LCD terminal window */}
          <path d="M3 4h24v22H3V4zm2 5v15h20V9H5z" fill="currentColor" />
          {/* Titlebar window dots */}
          <path d="M6 6h2v2H6V6zm3 0h2v2H9V6zm13 0h2v2h-2V6z" fill="currentColor" fillOpacity={0.35} />
          {/* Stepped '>' prompt chevron + '_' cursor block */}
          <path
            d="M7 12h2v2H7v-2zm2 2h2v2H9v-2zm2 2h2v2h-2v-2zm-2 2h2v2H9v-2zm-2 2h2v2H7v-2zm8 0h7v2h-7v-2z"
            fill="currentColor"
          />
          <rect x="15" y="13" width="2" height="5" fill="currentColor" fillOpacity={0.35} />
        </svg>
      );

    case 'info':
      return (
        <svg {...common}>
          <path d="M6 26h20v2H6v-2zm20-20h2v20h-2V6z" fill="currentColor" fillOpacity={0.28} />
          <path d="M5 4h20v22H5V4zm2 2v18h16V6H7z" fill="currentColor" />
          <rect x="13" y="9" width="4" height="3" fill="currentColor" />
          <path d="M12 14h5v6h2v2h-7v-2h2v-4h-2v-2z" fill="currentColor" />
        </svg>
      );

    case 'manual':
      return (
        <svg {...common}>
          <path d="M6 26h20v2H6v-2zm20-19h2v19h-2V7z" fill="currentColor" fillOpacity={0.28} />
          <path d="M5 4h20v22H5V4zm2 2v18h16V6H7z" fill="currentColor" />
          <rect x="8" y="6" width="2" height="18" fill="currentColor" fillOpacity={0.35} />
          <path
            d="M12 9h9v2h-9V9zm0 4h9v2h-9v-2zm0 4h7v2h-7v-2zm0 4h5v2h-5v-2z"
            fill="currentColor"
          />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <path d="M6 26h22v2H6v-2zm20-20h2v20h-2V6z" fill="currentColor" fillOpacity={0.28} />
          <path d="M4 4h22v22H4V4zm2 2v18h18V6H6z" fill="currentColor" />
          <rect x="11" y="11" width="10" height="10" fill="currentColor" />
        </svg>
      );
  }
};
