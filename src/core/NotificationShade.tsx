'use client';

import React from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { t } from '@/src/services/i18n';
import { radioEngine } from '@/src/services/radioEngine';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';

export const NotificationShade: React.FC = () => {
  const open = useOSStore((s) => s.notificationShadeOpen);
  const notifications = useOSStore((s) => s.notifications);
  const toastMessage = useOSStore((s) => s.toastMessage);
  const language = useOSStore((s) => s.language);
  const radio = useOSStore((s) => s.radio);
  const toggleNotificationShade = useOSStore((s) => s.toggleNotificationShade);
  const clearNotifications = useOSStore((s) => s.clearNotifications);
  const openApp = useOSStore((s) => s.openApp);

  const radioStatusLabel =
    radio.status === 'live'
      ? radio.activeStation.source === 'rg'
        ? 'LIVE RADIO GARDEN'
        : 'LIVE WORLD'
      : radio.status === 'connecting'
        ? 'BUFFERING...'
        : radio.status === 'synth'
          ? 'SYNTH 8-BIT'
          : radio.status === 'paused'
            ? language === 'id'
              ? 'TERJEDA'
              : 'PAUSED'
            : language === 'id'
              ? 'GANGGUAN'
              : 'ERROR';

  return (
    <>
      {/* Non-blocking pixel toast banner */}
      {toastMessage && !open && (
        <div className="pointer-events-none absolute top-9 left-2 right-2 z-30 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-2 py-1 text-sm leading-tight">
          {toastMessage}
        </div>
      )}

      {/* Slide-down Notification Shade */}
      {open && (
        <div className="absolute inset-x-0 top-[26px] bottom-[40px] z-40 flex flex-col bg-[var(--lcd-bg)] border-b-2 border-[var(--lcd-fg)] lcd-screen-enter">
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)]">
            <div className="flex items-center gap-1.5 text-lg font-bold leading-none">
              <PixelIcon name="bell" size={20} />
              <span>{t(language, 'notifications')}</span>
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="text-sm border border-[var(--lcd-bg)] px-1.5 py-0.5 hover:bg-[var(--lcd-bg)] hover:text-[var(--lcd-fg)] cursor-pointer"
                >
                  {t(language, 'clearAll')}
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleNotificationShade(false)}
                className="text-sm border border-[var(--lcd-bg)] px-1.5 py-0.5 hover:bg-[var(--lcd-bg)] hover:text-[var(--lcd-fg)] cursor-pointer"
              >
                X
              </button>
            </div>
          </div>

          {/* Persistent Background Radio Quick Control Card */}
          {radio.sessionActive && (
            <div className="p-2 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase opacity-90">
                <span className="flex items-center gap-1 truncate">
                  <PixelIcon name="radio" size={14} />
                  <span>
                    {language === 'id' ? 'Radio Latar' : 'Background Radio'} · {radioStatusLabel}
                  </span>
                </span>
                <span className="tabular-nums shrink-0">
                  {radio.activeStation.freq ? `${radio.freq.toFixed(1)} MHz` : 'LIVE'}
                  {radio.sleepMinutesLeft > 0 ? ` · ${radio.sleepMinutesLeft}m` : ''}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-tight truncate">
                    {radio.activeStation.name}
                  </div>
                  <div className="text-[11px] opacity-80 truncate">
                    {radio.activeStation.city} · {radio.activeStation.genre}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => radioEngine.togglePlayPause()}
                  className={`py-1.5 border-2 border-[var(--lcd-fg)] text-xs font-bold cursor-pointer whitespace-nowrap ${
                    radio.power
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'bg-[var(--lcd-bg)] text-[var(--lcd-fg)]'
                  }`}
                >
                  {radio.power ? (language === 'id' ? 'Jeda' : 'Pause') : language === 'id' ? 'Putar' : 'Play'}
                </button>
                <button
                  type="button"
                  onClick={() => radioEngine.scanNextPreset()}
                  className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  Scan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('click');
                    radioEngine.stopCompletely();
                  }}
                  className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  Stop
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('open');
                    toggleNotificationShade(false);
                    openApp('radio');
                  }}
                  className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  {language === 'id' ? 'Buka' : 'Open'}
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-1.5">
            {notifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-75 p-4">
                <PixelIcon name="bell" size={40} />
                <p className="mt-2 text-lg">{t(language, 'noNotifications')}</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    toggleNotificationShade(false);
                    if (notif.appId) {
                      openApp(notif.appId);
                    }
                  }}
                  className="w-full text-left border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
                >
                  <div className="flex items-center justify-between text-base font-bold leading-tight">
                    <span>{notif.title}</span>
                    <span className="text-xs opacity-80">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm leading-snug mt-0.5">{notif.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};
