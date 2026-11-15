'use client';

import React, { useEffect } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { APP_CATEGORIES } from '@/src/core/appRegistry';
import { AppHeader } from '@/src/core/AppHeader';
import { CATEGORY_LABELS, t } from '@/src/services/i18n';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';

export const CategoryMenuScreen: React.FC = () => {
  const language = useOSStore((s) => s.language);
  const focusIndex = useOSStore((s) => s.focusIndex);
  const setFocusIndex = useOSStore((s) => s.setFocusIndex);
  const setScreen = useOSStore((s) => s.setScreen);
  const goBack = useOSStore((s) => s.goBack);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const subscribeKey = useOSStore((s) => s.subscribeKey);

  useEffect(() => {
    return subscribeKey((cmd) => {
      if (cmd === 'UP') {
        soundEngine.playCue('click');
        setFocusIndex((focusIndex - 1 + APP_CATEGORIES.length) % APP_CATEGORIES.length);
        return true;
      }
      if (cmd === 'DOWN') {
        soundEngine.playCue('click');
        setFocusIndex((focusIndex + 1) % APP_CATEGORIES.length);
        return true;
      }
      if (cmd === 'OK' || cmd === 'RIGHT') {
        const cat = APP_CATEGORIES[focusIndex];
        if (cat) setScreen('category-list', { category: cat.id });
        return true;
      }
      return false;
    });
  }, [focusIndex]);

  useEffect(() => {
    setSoftkeys({
      leftLabel: t(language, 'appsTitle'),
      centerLabel: t(language, 'softkeySelect'),
      rightLabel: t(language, 'softkeyBack'),
      onLeft: () => setScreen('grid'),
      onCenter: () => {
        const cat = APP_CATEGORIES[focusIndex];
        if (cat) setScreen('category-list', { category: cat.id });
      },
      onRight: goBack,
    });
  }, [focusIndex, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)] lcd-screen-enter">
      <AppHeader
        title={t(language, 'categoriesTitle')}
        onPrev={() => setScreen('grid')}
        onNext={() => setScreen('grid')}
      />

      <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-1.5">
        {APP_CATEGORIES.map((cat, idx) => {
          const active = idx === focusIndex;
          const label = CATEGORY_LABELS[cat.id][language];
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setFocusIndex(idx);
                setScreen('category-list', { category: cat.id });
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer border-2 ${
                active
                  ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)] border-[var(--lcd-fg)]'
                  : 'border-transparent hover:bg-[var(--lcd-sec)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PixelIcon name={cat.icon} size={32} />
                <span className="text-sm sm:text-base font-bold leading-none truncate">{label}</span>
              </div>
              <PixelIcon name="chevronRight" size={22} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
