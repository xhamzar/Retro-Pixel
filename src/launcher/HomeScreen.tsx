'use client';

import React, { useEffect, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { PixelWallpaperArt } from '@/src/components/PixelWallpapers';
import { getAppById } from '@/src/core/appRegistry';
import { formatRetroDate, t } from '@/src/services/i18n';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';

export const HomeScreen: React.FC = () => {
  const language = useOSStore((s) => s.language);
  const wallpaperId = useOSStore((s) => s.wallpaperId);
  const customWallpaperUrl = useOSStore((s) => s.customWallpaperUrl);
  const quickSlotIds = useOSStore((s) => s.quickSlotIds);
  const focusIndex = useOSStore((s) => s.focusIndex);
  const setFocusIndex = useOSStore((s) => s.setFocusIndex);
  const openApp = useOSStore((s) => s.openApp);
  const setScreen = useOSStore((s) => s.setScreen);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const subscribeKey = useOSStore((s) => s.subscribeKey);
  const showToast = useOSStore((s) => s.showToast);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  const launchSlot = (slotIdx: number) => {
    const targetId = quickSlotIds[slotIdx];
    if (targetId === 'apps-grid') {
      setScreen('grid');
    } else {
      openApp(targetId);
    }
  };

  useEffect(() => {
    return subscribeKey((cmd) => {
      if (cmd === 'LEFT') {
        soundEngine.playCue('click');
        setFocusIndex((focusIndex - 1 + 4) % 4);
        return true;
      }
      if (cmd === 'RIGHT') {
        soundEngine.playCue('click');
        setFocusIndex((focusIndex + 1) % 4);
        return true;
      }
      if (cmd === 'UP') {
        setScreen('categories');
        return true;
      }
      if (cmd === 'DOWN') {
        setScreen('grid');
        return true;
      }
      if (cmd === 'OK') {
        launchSlot(focusIndex);
        return true;
      }
      return false;
    });
  }, [focusIndex, quickSlotIds]);

  useEffect(() => {
    setSoftkeys({
      leftLabel: t(language, 'softkeyMenu'),
      centerLabel: t(language, 'appsTitle'),
      rightLabel: t(language, 'categoriesTitle'),
      onLeft: () => setScreen('categories'),
      onCenter: () => setScreen('grid'),
      onRight: () => setScreen('categories'),
    });
  }, [language]);

  const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateString = formatRetroDate(now, language);

  return (
    <div className="flex flex-col justify-between h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)] select-none lcd-screen-enter">
      {/* Top Clock, Date & Weather Widget matching Screen 01 */}
      <div className="px-3 pt-3 text-center">
        <div className="text-[44px] sm:text-[52px] leading-[0.95] font-bold tracking-wider tabular-nums">
          {timeString}
        </div>
        <div className="text-sm sm:text-base font-bold leading-tight mt-1">{dateString}</div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playCue('click');
            showToast(`28°C · ${t(language, 'weatherLabel')}`);
          }}
          className="mt-1.5 inline-flex items-center justify-center gap-2 px-3 py-1 hover:bg-[var(--lcd-sec)] cursor-pointer"
        >
          <PixelIcon name="sunCloud" size={36} className="w-8 h-8 sm:w-9 sm:h-9" />
          <span className="text-xl sm:text-2xl font-bold leading-none tabular-nums">28°C</span>
        </button>
      </div>

      {/* Pixel Art Landscape Wallpaper or Custom Photo Wallpaper */}
      <div className="flex-1 min-h-[84px] w-full overflow-hidden flex items-end relative">
        {customWallpaperUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={customWallpaperUrl}
            alt="Wallpaper"
            className="w-full h-full max-h-44 object-cover grayscale contrast-150 opacity-85"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <PixelWallpaperArt id={wallpaperId} className="w-full h-full max-h-44" />
        )}
      </div>

      {/* Bottom 4 Quick-Access Dock Icons matching Screen 01 */}
      <div className="grid grid-cols-4 gap-2 px-2.5 py-2 border-t-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)]">
        {quickSlotIds.map((slotId, idx) => {
          const isGrid = slotId === 'apps-grid';
          const app = isGrid ? null : getAppById(slotId);
          const iconName = isGrid ? 'apps' : app?.icon ?? 'apps';
          const label = isGrid
            ? t(language, 'appsTitle')
            : language === 'id'
              ? app?.nameId ?? slotId
              : app?.nameEn ?? slotId;
          const active = idx === focusIndex;

          return (
            <button
              key={`${slotId}-${idx}`}
              type="button"
              onClick={() => {
                setFocusIndex(idx);
                launchSlot(idx);
              }}
              title={label}
              aria-label={label}
              className={`flex items-center justify-center min-h-[58px] sm:min-h-[64px] border-[3px] border-[var(--lcd-fg)] transition-transform cursor-pointer ${
                active
                  ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)] pixel-focus-bounce'
                  : 'bg-[var(--lcd-bg)] text-[var(--lcd-fg)] hover:bg-[var(--lcd-sec)]'
              }`}
            >
              <PixelIcon name={iconName} size={44} className="w-9 h-9 sm:w-11 sm:h-11" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
