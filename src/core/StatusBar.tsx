'use client';

import React, { useEffect, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { useOnlineStatus } from '@/src/core/PWAInstallButton';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';

export const StatusBar: React.FC = () => {
  const screen = useOSStore((s) => s.screen);
  const batteryLevel = useOSStore((s) => s.batteryLevel);
  const isCharging = useOSStore((s) => s.isCharging);
  const wifiEnabled = useOSStore((s) => s.wifiEnabled);
  const hotspotEnabled = useOSStore((s) => s.hotspotEnabled);
  const signalStrength = useOSStore((s) => s.signalStrength);
  const notifications = useOSStore((s) => s.notifications);
  const radio = useOSStore((s) => s.radio);
  const toggleNotificationShade = useOSStore((s) => s.toggleNotificationShade);
  const isOnline = useOnlineStatus();

  const [timeText, setTimeText] = useState('16:24');
  const [eqStep, setEqStep] = useState(0);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setTimeText(`${hh}:${mm}`);
    };
    updateClock();
    const id = setInterval(updateClock, 15000);
    return () => clearInterval(id);
  }, []);

  const radioPlaying = radio.power && (radio.status === 'live' || radio.status === 'synth');

  useEffect(() => {
    if (!radioPlaying) return;
    const id = setInterval(() => {
      setEqStep((s) => (s + 1) % 4);
    }, 240);
    return () => clearInterval(id);
  }, [radioPlaying]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 border-b-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)] select-none text-base leading-none shrink-0">
      {/* Left: Signal + Wi-Fi / Hotspot / Offline */}
      <div className="flex items-center gap-2">
        <div className="flex items-end gap-[2px] h-4" title={`Signal: ${signalStrength}/4`}>
          {[1, 2, 3, 4].map((bar) => (
            <span
              key={bar}
              className="w-[4px] bg-[var(--lcd-fg)]"
              style={{
                height: `${bar * 3 + 3}px`,
                opacity: bar <= signalStrength ? 1 : 0.22,
              }}
            />
          ))}
        </div>
        {wifiEnabled && <PixelIcon name="wifi" size={22} />}
        {hotspotEnabled && (
          <span className="text-xs font-bold px-1 border-2 border-[var(--lcd-fg)] leading-tight">HS</span>
        )}
        {!isOnline && (
          <span className="text-xs font-bold px-1 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] leading-tight">
            OFF
          </span>
        )}
      </div>

      {/* Center: Mini clock when not on home screen */}
      <div className="text-sm font-bold tracking-wider tabular-nums">
        {screen !== 'home' ? timeText : ''}
      </div>

      {/* Right: Background Radio indicator + Notification bell + Battery */}
      <div className="flex items-center gap-1.5">
        {radio.sessionActive && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              toggleNotificationShade(true);
            }}
            className={`flex items-center gap-1 px-1 py-0.5 border border-[var(--lcd-fg)] cursor-pointer whitespace-nowrap shrink-0 ${
              radioPlaying ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
            }`}
            title={radio.activeStation.name}
            aria-label={`Radio: ${radio.activeStation.name}`}
          >
            <PixelIcon name="radio" size={16} />
            {radioPlaying ? (
              <span className="flex items-end gap-[1px] h-3" aria-hidden="true">
                {[0, 1, 2].map((idx) => {
                  const h = 4 + ((eqStep + idx * 2) % 3) * 4;
                  return (
                    <span
                      key={idx}
                      className="w-[2px] bg-current"
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </span>
            ) : (
              <span className="text-[9px] font-bold leading-none">
                {radio.status === 'connecting' ? '...' : 'II'}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => toggleNotificationShade()}
          className="relative flex items-center gap-1 px-1 hover:bg-[var(--lcd-sec)] cursor-pointer"
          aria-label="Notifications"
        >
          <PixelIcon name="bell" size={20} />
          {unreadCount > 0 && (
            <span className="text-[11px] font-bold bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-1 leading-tight">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 tabular-nums">
          <div className="relative flex items-center">
            <div className="w-7 h-3.5 border-2 border-[var(--lcd-fg)] p-[1px] flex items-center">
              <div
                className="h-full bg-[var(--lcd-fg)]"
                style={{ width: `${Math.max(10, batteryLevel)}%` }}
              />
            </div>
            <div className="w-[3px] h-2 bg-[var(--lcd-fg)]" />
          </div>
          <span className="text-xs sm:text-sm font-bold leading-none">
            {isCharging ? '+' : ''}
            {batteryLevel}%
          </span>
        </div>
      </div>
    </div>
  );
};
