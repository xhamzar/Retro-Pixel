'use client';

import React from 'react';
import { t } from '@/src/services/i18n';
import { useOSStore } from '@/src/store/useOSStore';

export const SoftkeyBar: React.FC = () => {
  const softkeys = useOSStore((s) => s.softkeys);
  const dispatchKey = useOSStore((s) => s.dispatchKey);
  const language = useOSStore((s) => s.language);
  const screen = useOSStore((s) => s.screen);

  const leftText = softkeys.leftLabel ?? (screen === 'home' ? t(language, 'softkeyMenu') : t(language, 'softkeyOptions'));
  const centerText = softkeys.centerLabel ?? (screen === 'home' ? t(language, 'appsTitle') : t(language, 'softkeySelect'));
  const rightText = softkeys.rightLabel ?? (screen === 'home' ? '' : t(language, 'softkeyBack'));

  return (
    <div className="grid grid-cols-3 items-stretch border-t-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)] shrink-0 select-none">
      <button
        type="button"
        onClick={() => dispatchKey('SOFT_LEFT')}
        className="min-h-[42px] px-1.5 py-1.5 text-left text-xs sm:text-sm font-bold leading-none hover:bg-[var(--lcd-sec)] active:bg-[var(--lcd-fg)] active:text-[var(--lcd-bg)] truncate cursor-pointer"
      >
        {leftText}
      </button>

      <button
        type="button"
        onClick={() => dispatchKey('OK')}
        className="min-h-[42px] px-1.5 py-1.5 text-center text-xs sm:text-sm font-bold leading-none border-x-[3px] border-[var(--lcd-fg)] hover:bg-[var(--lcd-sec)] active:bg-[var(--lcd-fg)] active:text-[var(--lcd-bg)] truncate cursor-pointer"
      >
        {centerText}
      </button>

      <button
        type="button"
        onClick={() => {
          if (rightText) dispatchKey('SOFT_RIGHT');
        }}
        disabled={!rightText}
        className="min-h-[42px] px-1.5 py-1.5 text-right text-xs sm:text-sm font-bold leading-none hover:bg-[var(--lcd-sec)] active:bg-[var(--lcd-fg)] active:text-[var(--lcd-bg)] disabled:opacity-30 truncate cursor-pointer"
      >
        {rightText}
      </button>
    </div>
  );
};
