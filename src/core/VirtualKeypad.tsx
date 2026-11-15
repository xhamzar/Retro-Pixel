'use client';

import React from 'react';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';

interface VirtualKeypadProps {
  compact?: boolean;
}

export const VirtualKeypad: React.FC<VirtualKeypadProps> = ({ compact = false }) => {
  const dispatchKey = useOSStore((s) => s.dispatchKey);
  const openApp = useOSStore((s) => s.openApp);
  const language = useOSStore((s) => s.language);

  const btnCls =
    'pixel-key bg-[#2a3026] text-[#D8FF9A] hover:bg-[#353d30] font-bold select-none cursor-pointer flex items-center justify-center';

  return (
    <div className="w-full select-none">
      {/* Upper Softkeys + D-Pad Cluster */}
      <div className="grid grid-cols-3 gap-2.5 items-center">
        {/* Left Softkey + Call */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => dispatchKey('SOFT_LEFT')}
            className={`${btnCls} py-2.5 text-xs sm:text-sm`}
            aria-label="Left Softkey"
          >
            ──
          </button>
          <button
            type="button"
            onClick={() => openApp('phone')}
            className={`${btnCls} py-2.5 text-xs sm:text-sm`}
            aria-label="Call / Phone"
          >
            {language === 'id' ? 'TELP' : 'CALL'}
          </button>
        </div>

        {/* 4-Way D-Pad + OK Center */}
        <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
          <div />
          <button
            type="button"
            onClick={() => dispatchKey('UP')}
            className={`${btnCls} h-9 text-xs`}
            aria-label="D-Pad Up"
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            onClick={() => dispatchKey('LEFT')}
            className={`${btnCls} h-9 text-xs`}
            aria-label="D-Pad Left"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => dispatchKey('OK')}
            className="pixel-key-accent bg-[#D8FF9A] text-black hover:bg-[#BDE879] font-bold h-9 text-xs cursor-pointer flex items-center justify-center"
            aria-label="OK / Select"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => dispatchKey('RIGHT')}
            className={`${btnCls} h-9 text-xs`}
            aria-label="D-Pad Right"
          >
            ▶
          </button>
          <div />
          <button
            type="button"
            onClick={() => dispatchKey('DOWN')}
            className={`${btnCls} h-9 text-xs`}
            aria-label="D-Pad Down"
          >
            ▼
          </button>
          <div />
        </div>

        {/* Right Softkey + Home/End */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => dispatchKey('SOFT_RIGHT')}
            className={`${btnCls} py-2.5 text-xs sm:text-sm`}
            aria-label="Right Softkey / Back"
          >
            ──
          </button>
          <button
            type="button"
            onClick={() => dispatchKey('HOME')}
            className={`${btnCls} py-2.5 text-xs sm:text-sm`}
            aria-label="Home"
          >
            HOME
          </button>
        </div>
      </div>

      {/* Numeric Keypad */}
      {!compact && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { d: '1', sub: '.,!' },
            { d: '2', sub: 'ABC' },
            { d: '3', sub: 'DEF' },
            { d: '4', sub: 'GHI' },
            { d: '5', sub: 'JKL' },
            { d: '6', sub: 'MNO' },
            { d: '7', sub: 'PQRS' },
            { d: '8', sub: 'TUV' },
            { d: '9', sub: 'WXYZ' },
            { d: '*', sub: '+' },
            { d: '0', sub: '_' },
            { d: '#', sub: '⇧' },
          ].map((k) => (
            <button
              key={k.d}
              type="button"
              onClick={() => {
                soundEngine.playDtmf(k.d);
                if (k.d === '0') dispatchKey('HOME');
              }}
              className={`${btnCls} py-1.5 px-2 justify-between text-sm sm:text-base`}
            >
              <span>{k.d}</span>
              <span className="text-[9px] sm:text-[10px] opacity-75">{k.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
