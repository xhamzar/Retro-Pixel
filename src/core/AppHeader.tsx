'use client';

import React from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';

interface AppHeaderProps {
  title: string;
  onPrev?: () => void;
  onNext?: () => void;
  showChevrons?: boolean;
  rightSlot?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  onPrev,
  onNext,
  showChevrons = true,
  rightSlot,
}) => {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 border-b-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)] shrink-0 select-none">
      {showChevrons ? (
        <button
          type="button"
          onClick={onPrev}
          className="p-1 hover:bg-[var(--lcd-sec)] active:bg-[var(--lcd-fg)] active:text-[var(--lcd-bg)] cursor-pointer"
          aria-label="Previous"
        >
          <PixelIcon name="chevronLeft" size={24} />
        </button>
      ) : (
        <div className="w-5" />
      )}

      <h2 className="text-base sm:text-lg font-bold leading-none truncate px-1 text-center">
        {title}
      </h2>

      {rightSlot ? (
        rightSlot
      ) : showChevrons ? (
        <button
          type="button"
          onClick={onNext}
          className="p-1 hover:bg-[var(--lcd-sec)] active:bg-[var(--lcd-fg)] active:text-[var(--lcd-bg)] cursor-pointer"
          aria-label="Next"
        >
          <PixelIcon name="chevronRight" size={24} />
        </button>
      ) : (
        <div className="w-5" />
      )}
    </div>
  );
};
