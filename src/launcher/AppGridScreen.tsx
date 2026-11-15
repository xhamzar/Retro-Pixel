'use client';

import React, { useEffect, useMemo } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { APP_REGISTRY } from '@/src/core/appRegistry';
import { AppHeader } from '@/src/core/AppHeader';
import { t } from '@/src/services/i18n';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';

const PAGE_SIZE = 9;

export const AppGridScreen: React.FC = () => {
  const language = useOSStore((s) => s.language);
  const gridPage = useOSStore((s) => s.gridPage);
  const setGridPage = useOSStore((s) => s.setGridPage);
  const focusIndex = useOSStore((s) => s.focusIndex);
  const setFocusIndex = useOSStore((s) => s.setFocusIndex);
  const searchQuery = useOSStore((s) => s.searchQuery);
  const setSearchQuery = useOSStore((s) => s.setSearchQuery);
  const openApp = useOSStore((s) => s.openApp);
  const setScreen = useOSStore((s) => s.setScreen);
  const goBack = useOSStore((s) => s.goBack);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const subscribeKey = useOSStore((s) => s.subscribeKey);

  const orderedApps = useMemo(() => {
    const featured = APP_REGISTRY.filter((a) => a.featuredInGrid);
    const rest = APP_REGISTRY.filter((a) => !a.featuredInGrid);
    const all = [...featured, ...rest];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (a) => a.nameId.toLowerCase().includes(q) || a.nameEn.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(orderedApps.length / PAGE_SIZE));
  const safePage = Math.min(gridPage, totalPages - 1);
  const pageApps = orderedApps.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    return subscribeKey((cmd) => {
      if (pageApps.length === 0) return false;
      if (cmd === 'RIGHT') {
        soundEngine.playCue('click');
        if (focusIndex + 1 < pageApps.length) {
          setFocusIndex(focusIndex + 1);
        } else {
          setGridPage((safePage + 1) % totalPages);
        }
        return true;
      }
      if (cmd === 'LEFT') {
        soundEngine.playCue('click');
        if (focusIndex - 1 >= 0) {
          setFocusIndex(focusIndex - 1);
        } else {
          setGridPage((safePage - 1 + totalPages) % totalPages);
        }
        return true;
      }
      if (cmd === 'DOWN') {
        soundEngine.playCue('click');
        setFocusIndex(Math.min(pageApps.length - 1, focusIndex + 3));
        return true;
      }
      if (cmd === 'UP') {
        soundEngine.playCue('click');
        setFocusIndex(Math.max(0, focusIndex - 3));
        return true;
      }
      if (cmd === 'OK') {
        const chosen = pageApps[focusIndex];
        if (chosen) openApp(chosen.id);
        return true;
      }
      return false;
    });
  }, [pageApps, focusIndex, safePage, totalPages]);

  useEffect(() => {
    setSoftkeys({
      leftLabel: t(language, 'categoriesTitle'),
      centerLabel: t(language, 'softkeyOpen'),
      rightLabel: t(language, 'softkeyBack'),
      onLeft: () => setScreen('categories'),
      onCenter: () => {
        const chosen = pageApps[focusIndex];
        if (chosen) openApp(chosen.id);
      },
      onRight: goBack,
    });
  }, [pageApps, focusIndex, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)] lcd-screen-enter">
      <AppHeader
        title={t(language, 'appsTitle')}
        onPrev={() => setGridPage((safePage - 1 + totalPages) % totalPages)}
        onNext={() => setGridPage((safePage + 1) % totalPages)}
      />

      {/* Quick Search Bar */}
      <div className="px-2.5 pt-1.5 pb-1">
        <div className="flex items-center border-[3px] border-[var(--lcd-fg)] px-2 py-0.5 bg-[var(--lcd-bg)]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(language, 'searchApps')}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-bold outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold px-1.5 cursor-pointer"
            >
              X
            </button>
          ) : (
            <PixelIcon name="search" size={20} />
          )}
        </div>
      </div>

      {/* 3x3 Application Icon Grid matching Screen 02 */}
      <div className="flex-1 px-2 py-1 grid grid-cols-3 grid-rows-3 gap-1 items-stretch min-h-0">
        {pageApps.length === 0 ? (
          <div className="col-span-3 row-span-3 flex items-center justify-center text-center text-sm font-bold">
            {t(language, 'noAppsFound')}
          </div>
        ) : (
          pageApps.map((app, idx) => {
            const focused = idx === focusIndex;
            const label = language === 'id' ? app.nameId : app.nameEn;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  setFocusIndex(idx);
                  openApp(app.id);
                }}
                className="flex flex-col items-center justify-center p-0.5 cursor-pointer group min-w-0"
              >
                <div
                  className={`w-[68px] h-[54px] sm:w-[80px] sm:h-[64px] border-[3px] border-[var(--lcd-fg)] flex items-center justify-center transition-transform ${
                    focused
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)] pixel-focus-bounce'
                      : 'bg-[var(--lcd-bg)] text-[var(--lcd-fg)] group-hover:bg-[var(--lcd-sec)]'
                  }`}
                >
                  <PixelIcon name={app.icon} size={48} className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] font-bold leading-tight mt-0.5 truncate max-w-full px-1 ${
                    focused ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Page Indicator Dots */}
      <div className="flex items-center justify-center gap-2 py-1.5">
        {Array.from({ length: totalPages }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              setGridPage(idx);
            }}
            aria-label={`Page ${idx + 1}`}
            className={`w-3.5 h-3.5 border-2 border-[var(--lcd-fg)] cursor-pointer ${
              idx === safePage ? 'bg-[var(--lcd-fg)]' : 'bg-transparent'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
