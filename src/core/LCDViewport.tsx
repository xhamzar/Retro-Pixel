'use client';

import React, { Suspense, useEffect } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { getAppById } from '@/src/core/appRegistry';
import { NotificationShade } from '@/src/core/NotificationShade';
import { SoftkeyBar } from '@/src/core/SoftkeyBar';
import { StatusBar } from '@/src/core/StatusBar';
import { AppGridScreen } from '@/src/launcher/AppGridScreen';
import { CategoryListScreen } from '@/src/launcher/CategoryListScreen';
import { CategoryMenuScreen } from '@/src/launcher/CategoryMenuScreen';
import { HomeScreen } from '@/src/launcher/HomeScreen';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';

export const LCDViewport: React.FC<{ className?: string }> = ({ className = '' }) => {
  const screen = useOSStore((s) => s.screen);
  const activeAppId = useOSStore((s) => s.activeAppId);
  const activeAppParams = useOSStore((s) => s.activeAppParams);
  const goBack = useOSStore((s) => s.goBack);
  const themeId = useOSStore((s) => s.themeId);
  const brightness = useOSStore((s) => s.brightness);
  const pixelGrid = useOSStore((s) => s.pixelGrid);
  const language = useOSStore((s) => s.language);
  const ringingAlarm = useOSStore((s) => s.ringingAlarm);
  const dismissRingingAlarm = useOSStore((s) => s.dismissRingingAlarm);
  const showToast = useOSStore((s) => s.showToast);

  const activeApp = activeAppId ? getAppById(activeAppId) : undefined;
  const ActiveComponent = activeApp?.component;

  useEffect(() => {
    if (!ringingAlarm) return;
    soundEngine.playCue('alarm');
    const id = setInterval(() => {
      soundEngine.playCue('alarm');
    }, 2200);
    return () => clearInterval(id);
  }, [ringingAlarm]);

  const handleSnooze = async () => {
    if (!ringingAlarm) return;
    const snoozeDate = new Date(Date.now() + 5 * 60 * 1000);
    const nextTime = `${String(snoozeDate.getHours()).padStart(2, '0')}:${String(snoozeDate.getMinutes()).padStart(2, '0')}`;
    await db.alarms.add({
      time: nextTime,
      label: `${ringingAlarm.label} (Snooze)`,
      enabled: true,
      days: language === 'id' ? 'Sekali' : 'Once',
    });
    dismissRingingAlarm();
    showToast(language === 'id' ? `Ditunda ke ${nextTime}` : `Snoozed to ${nextTime}`);
  };

  return (
    <div
      data-lcd-theme={themeId}
      style={{ '--lcd-brightness': brightness } as React.CSSProperties}
      className={`relative flex flex-col overflow-hidden lcd-surface lcd-border ${className}`}
    >
      <StatusBar />

      <div className="relative flex-1 min-h-0 overflow-hidden">
        {screen === 'home' && <HomeScreen />}
        {screen === 'grid' && <AppGridScreen />}
        {screen === 'categories' && <CategoryMenuScreen />}
        {screen === 'category-list' && <CategoryListScreen />}
        {screen === 'app' && ActiveComponent && activeAppId && (
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-2xl font-bold bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
                LOADING...
              </div>
            }
          >
            <ActiveComponent appId={activeAppId} params={activeAppParams} onBack={goBack} />
          </Suspense>
        )}
      </div>

      {ringingAlarm && (
        <div className="absolute inset-0 z-40 bg-[var(--lcd-bg)]/95 flex flex-col items-center justify-center p-4 text-center">
          <div className="border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-4 w-full max-w-[260px] space-y-3">
            <PixelIcon name="alarm" size={44} className="mx-auto animate-bounce" />
            <div className="text-xs font-bold uppercase tracking-widest">
              {language === 'id' ? 'ALARM BERBUNYI' : 'ALARM RINGING'}
            </div>
            <div className="text-3xl font-bold tabular-nums leading-none">{ringingAlarm.time}</div>
            <div className="text-sm font-bold">{ringingAlarm.label}</div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSnooze}
                className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] py-1.5 text-xs font-bold cursor-pointer hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
              >
                {language === 'id' ? 'Tunda 5m' : 'Snooze 5m'}
              </button>
              <button
                type="button"
                onClick={dismissRingingAlarm}
                className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] py-1.5 text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'Matikan' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationShade />
      <SoftkeyBar />

      {/* Physical dot-matrix pixel sub-grid overlay across entire LCD */}
      {pixelGrid && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-50 lcd-pixel-grid"
        />
      )}
    </div>
  );
};
