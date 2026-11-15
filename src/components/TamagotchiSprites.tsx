'use client';

import React from 'react';
import type { TamagotchiEvolutionId, TamagotchiStage } from '@/src/types/os';

export type SpriteMood = 'idle' | 'happy' | 'eating' | 'sleeping' | 'sick' | 'angry' | 'refuse';

interface SpriteProps {
  stage: TamagotchiStage;
  evolutionId: TamagotchiEvolutionId | null;
  mood: SpriteMood;
  frame: number; // 0 or 1
  facing?: 'left' | 'right';
  size?: number;
}

export const TamagotchiPetSprite: React.FC<SpriteProps> = ({
  stage,
  evolutionId,
  mood,
  frame,
  facing = 'right',
  size = 84,
}) => {
  const bounceY = mood === 'sleeping' ? 0 : frame % 2 === 1 ? -2 : 0;
  const wobbleX = stage === 'egg' ? (frame % 2 === 0 ? -1 : 1) : 0;
  const flipX = facing === 'left' ? -1 : 1;

  const renderEyes = (x1: number, x2: number, y: number) => {
    if (mood === 'sleeping') {
      return (
        <>
          <rect x={x1} y={y + 1} width="3" height="1" fill="currentColor" />
          <rect x={x2} y={y + 1} width="3" height="1" fill="currentColor" />
        </>
      );
    }
    if (mood === 'happy') {
      return (
        <>
          <path d={`M${x1} ${y + 1}h1v-1h1v1h1v1h-3v-1z`} fill="currentColor" />
          <path d={`M${x2} ${y + 1}h1v-1h1v1h1v1h-3v-1z`} fill="currentColor" />
        </>
      );
    }
    if (mood === 'sick' || mood === 'refuse') {
      return (
        <>
          <path d={`M${x1} ${y}h1v1h1v1h-1v-1h-1v-1zm2 0h-1v2h1v-2z`} fill="currentColor" />
          <path d={`M${x2} ${y}h1v1h1v1h-1v-1h-1v-1zm2 0h-1v2h1v-2z`} fill="currentColor" />
        </>
      );
    }
    return (
      <>
        <rect x={x1} y={y} width="2" height="3" fill="currentColor" />
        <rect x={x2} y={y} width="2" height="3" fill="currentColor" />
      </>
    );
  };

  const renderMouth = (cx: number, y: number) => {
    if (mood === 'eating') {
      return frame % 2 === 0 ? (
        <rect x={cx - 1} y={y} width="4" height="3" fill="currentColor" />
      ) : (
        <rect x={cx - 1} y={y + 1} width="3" height="1" fill="currentColor" />
      );
    }
    if (mood === 'happy') {
      return <path d={`M${cx - 2} ${y}h1v1h3v-1h1v2h-5v-2z`} fill="currentColor" />;
    }
    if (mood === 'angry' || mood === 'refuse') {
      return <path d={`M${cx - 2} ${y + 1}h5v1h-5v-1z`} fill="currentColor" />;
    }
    if (mood === 'sick') {
      return <path d={`M${cx - 2} ${y + 1}h1v-1h2v1h1v1h-4v-1z`} fill="currentColor" />;
    }
    return <rect x={cx - 1} y={y + 1} width="3" height="1" fill="currentColor" />;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated',
        transform: `translate(${wobbleX}px, ${bounceY}px) scaleX(${flipX})`,
      }}
      className="transition-transform duration-150"
    >
      {/* EGG STAGE */}
      {stage === 'egg' && (
        <g>
          <path
            d="M12 5h8v2h3v3h2v12h-2v3h-3v2h-8v-2H9v-3H7V10h2V7h3V5zm0 2v2h-2v3H9v9h1v2h2v2h8v-2h2v-2h1v-9h-1V9h-2V7h-8z"
            fill="currentColor"
          />
          {/* Egg speckles & crack */}
          <rect x="12" y="11" width="3" height="2" fill="currentColor" fillOpacity={0.5} />
          <rect x="18" y="15" width="3" height="2" fill="currentColor" fillOpacity={0.5} />
          <path d="M11 19h2v1h2v-1h2v1h2v1h-2v-1h-2v1h-2v-1h-2v-1z" fill="currentColor" />
        </g>
      )}

      {/* BABY STAGE */}
      {stage === 'baby' && (
        <g>
          {/* Sprout */}
          <rect x="15" y="7" width="2" height="3" fill="currentColor" />
          <rect x="13" y="6" width="2" height="2" fill="currentColor" />
          {/* Round blob body */}
          <path
            d="M10 10h12v2h2v3h1v8h-2v2h-2v1H11v-1H9v-2H7v-8h1v-3h2v-2zm0 2v3H9v7h2v2h10v-2h2v-7h-1v-3H10z"
            fill="currentColor"
          />
          {renderEyes(12, 18, 16)}
          {renderMouth(15, 20)}
        </g>
      )}

      {/* CHILD STAGE */}
      {stage === 'child' && (
        <g>
          {/* Cute twin ears */}
          <path d="M9 5h3v4H9V5zm11 0h3v4h-3V5z" fill="currentColor" />
          {/* Body outline */}
          <path
            d="M8 9h16v2h2v10h-2v3h-3v2h-3v-2h-4v2h-3v-2H8v-3H6V11h2V9zm2 2v10h2v2h8v-2h2V11H10z"
            fill="currentColor"
          />
          {/* Tiny arms */}
          <rect x="4" y={15 + (frame % 2)} width="2" height="4" fill="currentColor" />
          <rect x="26" y={16 - (frame % 2)} width="2" height="4" fill="currentColor" />
          {renderEyes(11, 19, 14)}
          {renderMouth(15, 18)}
        </g>
      )}

      {/* TEEN STAGE */}
      {stage === 'teen' && (
        <g>
          {/* Spiky crown hair */}
          <path d="M10 4h2v3h2V3h4v4h2V4h2v5H10V4z" fill="currentColor" />
          {/* Tall torso */}
          <path
            d="M8 9h16v13h-2v4h-3v-3h-6v3h-3v-4H8V9zm2 2v9h12v-9H10z"
            fill="currentColor"
          />
          {/* Arms */}
          <rect x="5" y={13 + (frame % 2)} width="3" height="5" fill="currentColor" />
          <rect x="24" y={14 - (frame % 2)} width="3" height="5" fill="currentColor" />
          {renderEyes(11, 19, 13)}
          {renderMouth(15, 17)}
        </g>
      )}

      {/* ADULT 1: BINTANG PENJAGA (ANGEL STAR) */}
      {stage === 'adult' && evolutionId === 'angel_star' && (
        <g>
          {/* Halo / Star crest */}
          <path d="M11 3h10v2H11V3zm4 2h2v2h-2V5z" fill="currentColor" />
          {/* Side wings */}
          <path d={`M3 ${12 + (frame % 2)}h4v6H3v-6zm22 ${12 + (frame % 2)}h4v6h-4v-6z`} fill="currentColor" />
          {/* Star-shaped body */}
          <path
            d="M9 7h14v2h2v13h-2v3h-4v2h-6v-2H9v-3H7V9h2V7zm0 2v11h2v3h10v-3h2V9H9z"
            fill="currentColor"
          />
          {/* Cheek stars */}
          <rect x="10" y="17" width="2" height="1" fill="currentColor" fillOpacity={0.5} />
          <rect x="20" y="17" width="2" height="1" fill="currentColor" fillOpacity={0.5} />
          {renderEyes(12, 18, 13)}
          {renderMouth(15, 17)}
        </g>
      )}

      {/* ADULT 2: RUBAH LINCAH (SPORTY FOX) */}
      {stage === 'adult' && evolutionId === 'sporty_fox' && (
        <g>
          {/* Big pointed fox ears */}
          <path d="M6 3h4v2h2v4H6V3zm14 2h2V3h4v6h-6V5z" fill="currentColor" />
          {/* Fox face & agile body */}
          <path
            d="M7 9h18v11h-3v6h-3v-4h-6v4h-3v-6H7V9zm2 2v7h14v-7H9z"
            fill="currentColor"
          />
          {/* Bushy wagging tail */}
          <path d={`M25 ${17 - (frame % 2)}h5v5h-5v-5z`} fill="currentColor" />
          {renderEyes(11, 19, 13)}
          {renderMouth(15, 16)}
        </g>
      )}

      {/* ADULT 3: DINO GEMBUL (CHUBBY DINO) */}
      {stage === 'adult' && evolutionId === 'chubby_dino' && (
        <g>
          {/* Back dino spikes */}
          <path d="M5 9h3v3H5V9zm-1 5h3v3H4v-3zm1 5h3v3H5v-3z" fill="currentColor" />
          {/* Big round chubby body */}
          <path
            d="M8 6h14v2h3v3h2v11h-2v4h-5v-2h-6v2H9v-4H7V9h1V6zm2 2v12h12v-9h-2V8H10z"
            fill="currentColor"
          />
          {/* Big tummy stripe */}
          <path d="M13 18h6v3h-6v-3z" fill="currentColor" fillOpacity={0.35} />
          {renderEyes(12, 19, 11)}
          {renderMouth(16, 15)}
        </g>
      )}

      {/* ADULT 4: KELELAWAR JAHIL (REBEL BAT) */}
      {stage === 'adult' && evolutionId === 'rebel_bat' && (
        <g>
          {/* Bat wing ears & spiked top */}
          <path d="M7 4h3v4H7V4zm15 0h3v4h-3V4z" fill="currentColor" />
          {/* Bat wings */}
          <path
            d={`M2 ${11 + (frame % 2)}h5v8H4v-2H2v-6zm23 ${11 + (frame % 2)}h5v6h-2v2h-3v-8z`}
            fill="currentColor"
          />
          {/* Body */}
          <path
            d="M8 8h16v14h-3v4h-3v-3h-4v3h-3v-4H8V8zm2 2v10h12V10H10z"
            fill="currentColor"
          />
          {/* Fang smirk */}
          <rect x="13" y="18" width="1" height="2" fill="currentColor" />
          <rect x="18" y="18" width="1" height="2" fill="currentColor" />
          {renderEyes(11, 19, 13)}
          {renderMouth(15, 17)}
        </g>
      )}

      {/* ANGEL MEMORIAL */}
      {stage === 'angel' && (
        <g>
          <path d="M11 4h10v2H11V4z" fill="currentColor" />
          <path d="M4 12h4v6H4v-6zm20 0h4v6h-4v-6z" fill="currentColor" />
          <path d="M9 9h14v12h-2v3h-10v-3H9V9zm2 2v9h10v-9H11z" fill="currentColor" />
          <path d="M12 14h2v2h-2v-2zm6 0h2v2h-2v-2zm-4 3h4v1h-4v-1z" fill="currentColor" />
        </g>
      )}
    </svg>
  );
};

export const TamagotchiPoopSprite: React.FC<{ frame?: number }> = ({ frame = 0 }) => (
  <svg width="20" height="20" viewBox="0 0 16 16" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
    {/* Stink wave */}
    <rect x={frame % 2 === 0 ? 5 : 4} y="1" width="1" height="2" fill="currentColor" />
    <rect x={frame % 2 === 0 ? 10 : 11} y="1" width="1" height="2" fill="currentColor" />
    {/* Classic coiled pixel poop */}
    <path
      d="M7 4h2v2H7V4zm-2 2h6v2H5V6zm-2 2h10v3H3V8zm-1 3h12v3H2v-3z"
      fill="currentColor"
    />
  </svg>
);

export const TamagotchiIconMini: React.FC<{
  kind: 'meal' | 'lights' | 'play' | 'medicine' | 'clean' | 'stats' | 'discipline' | 'alert';
}> = ({ kind }) => {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 16 16',
    shapeRendering: 'crispEdges' as const,
    style: { imageRendering: 'pixelated' as const },
  };
  switch (kind) {
    case 'meal':
      return (
        <svg {...common}>
          <path d="M3 3h2v6H3V3zm4 0h1v4H7V3zm2 0h1v4H9V3zm2 0h2v10h-2V3zM3 10h2v3H3v-3zm5-2h1v5H8V8z" fill="currentColor" />
        </svg>
      );
    case 'lights':
      return (
        <svg {...common}>
          <path d="M6 2h4v2h2v4h-2v2H6V8H4V4h2V2zm0 9h4v2H6v-2zm1 2h2v1H7v-1z" fill="currentColor" />
        </svg>
      );
    case 'play':
      return (
        <svg {...common}>
          <path d="M2 5h12v7H2V5zm2 2v3h2V9h1V8H6V7H4zm6 0h1v1h-1V7zm2 2h1v1h-1V9z" fill="currentColor" />
        </svg>
      );
    case 'medicine':
      return (
        <svg {...common}>
          <path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4V2z" fill="currentColor" />
        </svg>
      );
    case 'clean':
      return (
        <svg {...common}>
          <path d="M7 2h2v6H7V2zM4 8h8v2H4V8zm-1 2h10v4H3v-4z" fill="currentColor" />
        </svg>
      );
    case 'stats':
      return (
        <svg {...common}>
          <path d="M2 10h3v4H2v-4zm4-4h3v8H6V6zm4-4h4v12h-4V2z" fill="currentColor" />
        </svg>
      );
    case 'discipline':
      return (
        <svg {...common}>
          <path d="M3 4h4v2H5v4h2v2H3V4zm6-1h4v10h-4V3zm2 2v6h1V5h-1z" fill="currentColor" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M7 2h2v7H7V2zm0 9h2v3H7v-3z" fill="currentColor" />
        </svg>
      );
  }
};
