'use client';

import React, { useEffect } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { APP_CATEGORIES, getAppsByCategory } from '@/src/core/appRegistry';
import { AppHeader } from '@/src/core/AppHeader';
import { CATEGORY_LABELS, t } from '@/src/services/i18n';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';

export const CategoryListScreen: React.FC = () => {
  const language = useOSStore((s) => s.language);
  const activeCategory = useOSStore((s) => s.activeCategory);
  const setScreen = useOSStore((s) => s.setScreen);
  const focusIndex = useOSStore((s) => s.focusIndex);
  const setFocusIndex = useOSStore((s) => s.setFocusIndex);
  const openApp = useOSStore((s) => s.openApp);
  const goBack = useOSStore((s) => s.goBack);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const subscribeKey = useOSStore((s) => s.subscribeKey);

  const apps = getAppsByCategory(activeCategory);
  const catIdx = APP_CATEGORIES.findIndex((c) => c.id === activeCategory);

  const switchCategory = (delta: number) => {
    const nextIdx = (catIdx + delta + APP_CATEGORIES.length) % APP_CATEGORIES.length;
    setScreen('category-list', { category: APP_CATEGORIES[nextIdx].id, push: false });
  };

  useEffect(() => {
    return subscribeKey((cmd) => {
      if (cmd === 'UP') {
        soundEngine.playCue('click');
        setFocusIndex((focusIndex - 1 + apps.length) % apps.length);
        return true;
      }
      if (cmd === 'DOWN') {
        soundEngine.playCue('click');
        setFocusIndex((focusIndex + 1) % apps.length);
        return true;
      }
      if (cmd === 'LEFT') {
        switchCategory(-1);
        return true;
      }
      if (cmd === 'RIGHT') {
        switchCategory(1);
        return true;
      }
      if (cmd === 'OK') {
        const chosen = apps[focusIndex];
        if (chosen) openApp(chosen.id);
        return true;
      }
      return false;
    });
  }, [apps, focusIndex, catIdx]);

  useEffect(() => {
    setSoftkeys({
      leftLabel: t(language, 'appsTitle'),
      centerLabel: t(language, 'softkeyOpen'),
      rightLabel: t(language, 'softkeyBack'),
      onLeft: () => setScreen('grid'),
      onCenter: () => {
        const chosen = apps[focusIndex];
        if (chosen) openApp(chosen.id);
      },
      onRight: goBack,
    });
  }, [apps, focusIndex, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)] lcd-screen-enter">
      <AppHeader
        title={CATEGORY_LABELS[activeCategory][language]}
        onPrev={() => switchCategory(-1)}
        onNext={() => switchCategory(1)}
      />

      <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-1.5">
        {apps.map((app, idx) => {
          const active = idx === focusIndex;
          const label = language === 'id' ? app.nameId : app.nameEn;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => {
                setFocusIndex(idx);
                openApp(app.id);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer border-2 ${
                active
                  ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)] border-[var(--lcd-fg)]'
                  : 'border-transparent hover:bg-[var(--lcd-sec)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PixelIcon name={app.icon} size={32} />
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
