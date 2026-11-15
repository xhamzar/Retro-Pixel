'use client';

import React, { useEffect, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { APP_CATEGORIES, APP_REGISTRY, getAppById } from '@/src/core/appRegistry';
import { LCDViewport } from '@/src/core/LCDViewport';
import {
  PWAInstallButton,
  useOnlineStatus,
  useServiceWorkerRegistration,
} from '@/src/core/PWAInstallButton';
import { VirtualKeypad } from '@/src/core/VirtualKeypad';
import { db } from '@/src/services/db';
import { CATEGORY_LABELS, t } from '@/src/services/i18n';
import { soundEngine } from '@/src/services/sound';
import {
  advanceTamagotchiState,
  getAttentionMessage,
  getStageLabel,
  loadTamagotchiState,
  saveTamagotchiState,
} from '@/src/services/tamagotchiEngine';
import { useOSStore } from '@/src/store/useOSStore';

export const OSShell: React.FC = () => {
  const initOS = useOSStore((s) => s.initOS);
  const initialized = useOSStore((s) => s.initialized);
  const language = useOSStore((s) => s.language);
  const setLanguage = useOSStore((s) => s.setLanguage);
  const desktopMode = useOSStore((s) => s.desktopMode);
  const setDesktopMode = useOSStore((s) => s.setDesktopMode);
  const soundEnabled = useOSStore((s) => s.soundEnabled);
  const setSoundEnabled = useOSStore((s) => s.setSoundEnabled);
  const themeId = useOSStore((s) => s.themeId);
  const dispatchKey = useOSStore((s) => s.dispatchKey);
  const openApp = useOSStore((s) => s.openApp);
  const setScreen = useOSStore((s) => s.setScreen);
  const goHome = useOSStore((s) => s.goHome);
  const activeCategory = useOSStore((s) => s.activeCategory);
  const activeAppId = useOSStore((s) => s.activeAppId);
  const screen = useOSStore((s) => s.screen);
  const setBatteryState = useOSStore((s) => s.setBatteryState);
  const triggerAlarm = useOSStore((s) => s.triggerAlarm);
  const pushNotification = useOSStore((s) => s.pushNotification);

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showMobileDpad, setShowMobileDpad] = useState(false);
  const isOnline = useOnlineStatus();

  useServiceWorkerRegistration();

  useEffect(() => {
    initOS();
  }, [initOS]);

  // Real device battery monitoring when supported by browser
  useEffect(() => {
    if (!initialized || typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (ev: string, fn: () => void) => void;
        removeEventListener: (ev: string, fn: () => void) => void;
      }>;
    };
    if (!nav.getBattery) return;

    let batteryObj: Awaited<ReturnType<NonNullable<typeof nav.getBattery>>> | null = null;
    const syncBattery = () => {
      if (!batteryObj) return;
      setBatteryState(Math.round(batteryObj.level * 100), batteryObj.charging);
    };

    nav
      .getBattery()
      .then((bat) => {
        batteryObj = bat;
        syncBattery();
        bat.addEventListener('levelchange', syncBattery);
        bat.addEventListener('chargingchange', syncBattery);
      })
      .catch(() => undefined);

    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener('levelchange', syncBattery);
        batteryObj.removeEventListener('chargingchange', syncBattery);
      }
    };
  }, [initialized, setBatteryState]);

  // Background real-time Alarm scheduler
  useEffect(() => {
    if (!initialized) return;
    let lastMinuteTriggered = '';
    const checkAlarms = async () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const minuteKey = `${now.toDateString()}-${hhmm}`;
      if (minuteKey === lastMinuteTriggered) return;

      const enabledAlarms = await db.alarms.filter((a) => a.enabled).toArray();
      const matched = enabledAlarms.find((a) => a.time === hhmm);
      if (matched) {
        lastMinuteTriggered = minuteKey;
        triggerAlarm({ id: matched.id, time: matched.time, label: matched.label });
      }
    };
    const id = setInterval(checkAlarms, 4000);
    return () => clearInterval(id);
  }, [initialized, triggerAlarm]);

  // Background Tamagotchi virtual pet simulation & OS notification alerts
  useEffect(() => {
    if (!initialized) return;
    const tickPetBackground = () => {
      if (activeAppId === 'tamagotchi') return;
      const current = loadTamagotchiState();
      const res = advanceTamagotchiState(current, Date.now());
      if (res.changed) {
        saveTamagotchiState(res.state);
        if (res.evolvedToStage && res.evolvedToStage !== 'angel') {
          const label = getStageLabel(res.state.stage, res.state.evolutionId, language);
          pushNotification(
            'Tamagotchi',
            language === 'id'
              ? `${res.state.name} berevolusi menjadi ${label}!`
              : `${res.state.name} evolved into ${label}!`,
            'tamagotchi'
          );
          soundEngine.playCue('notify');
        } else if (res.newAlertReason) {
          pushNotification(
            'Tamagotchi',
            getAttentionMessage(res.newAlertReason, res.state.name, language),
            'tamagotchi'
          );
          soundEngine.playCue('notify');
        }
      }
    };

    tickPetBackground();
    const id = setInterval(tickPetBackground, 12000);
    return () => clearInterval(id);
  }, [initialized, activeAppId, language, pushNotification]);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Global keyboard navigation handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isTyping) {
        if (e.key === 'Escape') {
          (target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          dispatchKey('UP');
          break;
        case 'ArrowDown':
          e.preventDefault();
          dispatchKey('DOWN');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          dispatchKey('LEFT');
          break;
        case 'ArrowRight':
          e.preventDefault();
          dispatchKey('RIGHT');
          break;
        case 'Enter':
          e.preventDefault();
          dispatchKey('OK');
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          dispatchKey('BACK');
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatchKey]);

  if (!initialized) {
    return (
      <div
        data-lcd-theme={themeId}
        className="min-h-screen flex items-center justify-center bg-[#141712] text-[#D8FF9A]"
      >
        <div className="pixel-panel px-8 py-6 text-center">
          <div className="text-xl sm:text-2xl font-bold tracking-widest">RETRO PIXEL OS</div>
          <div className="text-xs sm:text-sm mt-2">BOOTING SYSTEM...</div>
        </div>
      </div>
    );
  }

  // --- MOBILE PORTRAIT FULLSCREEN MODE ---
  if (isMobileViewport) {
    return (
      <main
        data-lcd-theme={themeId}
        className="h-[100dvh] w-screen flex flex-col bg-[var(--lcd-bg)] overflow-hidden"
      >
        <LCDViewport className="flex-1 w-full border-0" />

        <div className="border-t-[3px] border-[var(--lcd-fg)] bg-[#1c2019] text-[#D8FF9A] px-2.5 py-1.5 flex items-center justify-between text-xs shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              setShowMobileDpad((v) => !v);
            }}
            className="border-2 border-[#D8FF9A] px-2.5 py-1 font-bold cursor-pointer"
          >
            {showMobileDpad ? '▼ D-PAD' : '▲ D-PAD'}
          </button>

          <div className="flex items-center gap-2">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="border-2 border-[#D8FF9A] px-2.5 py-1 font-bold cursor-pointer"
            >
              {soundEnabled ? 'SFX:ON' : 'SFX:OFF'}
            </button>
          </div>
        </div>

        {showMobileDpad && (
          <div className="bg-[#1c2019] px-3 pb-3 pt-2 border-t-2 border-[#32382d]">
            <VirtualKeypad compact />
          </div>
        )}
      </main>
    );
  }

  // --- DESKTOP WIDE LCD WORKSPACE MODE ---
  if (desktopMode === 'wide') {
    const featuredApps = APP_REGISTRY.filter((a) => a.featuredInGrid || a.id === 'video' || a.id === 'notes' || a.id === 'calculator').slice(0, 12);

    return (
      <main
        data-lcd-theme={themeId}
        className="min-h-screen w-full flex flex-col bg-[var(--lcd-bg)] text-[var(--lcd-fg)]"
      >
        <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-2.5 border-b-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-sec)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goHome}
              className="flex items-center gap-2 border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-3 py-1.5 text-base sm:text-lg font-bold leading-none cursor-pointer"
            >
              <PixelIcon name="apps" size={26} />
              <span>RETRO PIXEL OS</span>
            </button>
            {!isOnline && (
              <span className="border-[3px] border-[var(--lcd-fg)] px-2.5 py-1 text-xs font-bold">
                {t(language, 'offlineBanner')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                setDesktopMode('chassis');
              }}
              className="border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-3 py-1 text-xs sm:text-sm font-bold hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer whitespace-nowrap"
            >
              {t(language, 'displayModeChassis')}
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                setLanguage(language === 'id' ? 'en' : 'id');
              }}
              className="border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-3 py-1 text-xs sm:text-sm font-bold hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer whitespace-nowrap"
            >
              {language === 'id' ? 'ID / EN' : 'EN / ID'}
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-3 py-1 text-xs sm:text-sm font-bold hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer whitespace-nowrap"
            >
              {soundEnabled ? t(language, 'soundOn') : t(language, 'soundMuted')}
            </button>
            <PWAInstallButton />
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-4 p-4 max-w-[1440px] w-full mx-auto min-h-0">
          {/* Left Category Dock */}
          <aside className="border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)] flex flex-col">
            <div className="px-3 py-2 border-b-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-sm sm:text-base font-bold">
              {t(language, 'categoriesTitle')}
            </div>
            <nav className="p-2.5 space-y-1.5 flex-1">
              <button
                type="button"
                onClick={goHome}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs sm:text-sm font-bold cursor-pointer ${
                  screen === 'home' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-sec)]'
                }`}
              >
                <PixelIcon name="wallpaper" size={24} />
                <span>Home</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('grid')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs sm:text-sm font-bold cursor-pointer ${
                  screen === 'grid' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-sec)]'
                }`}
              >
                <PixelIcon name="apps" size={24} />
                <span>{t(language, 'appsTitle')}</span>
              </button>
              <div className="border-t-[3px] border-[var(--lcd-fg)] my-2" />
              {APP_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setScreen('category-list', { category: cat.id })}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs sm:text-sm font-bold cursor-pointer ${
                    screen === 'category-list' && activeCategory === cat.id
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'hover:bg-[var(--lcd-sec)]'
                  }`}
                >
                  <PixelIcon name={cat.icon} size={24} />
                  <span className="truncate">{CATEGORY_LABELS[cat.id][language]}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Center Main LCD Screen */}
          <section className="flex flex-col items-center justify-center min-h-[600px]">
            <LCDViewport className="w-full h-full min-h-[600px] max-h-[760px]" />
          </section>

          {/* Right Quick Apps & Virtual D-Pad */}
          <aside className="flex flex-col gap-4">
            <div className="border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-3">
              <div className="text-xs sm:text-sm font-bold border-b-[3px] border-[var(--lcd-fg)] pb-1 mb-2.5">
                {t(language, 'quickAccess')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {featuredApps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => openApp(app.id)}
                    className="flex flex-col items-center justify-center p-2 border-2 border-[var(--lcd-fg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer min-w-0"
                  >
                    <PixelIcon name={app.icon} size={32} />
                    <span className="text-[10px] font-bold truncate max-w-full mt-1.5">
                      {language === 'id' ? app.nameId : app.nameEn}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-[3px] border-[var(--lcd-fg)] bg-[#1c2019] p-3.5 text-[#D8FF9A]">
              <div className="text-xs font-bold mb-2.5">D-PAD & KEYPAD</div>
              <VirtualKeypad />
            </div>
          </aside>
        </div>
      </main>
    );
  }

  // --- DESKTOP PHONE CHASSIS MODE (Large & Sharp Pixel Hardware Frame) ---
  return (
    <main
      data-lcd-theme={themeId}
      className="min-h-screen w-full bg-[#141712] text-[#D8FF9A] flex flex-col lg:flex-row items-center justify-center gap-8 p-4 lg:p-6"
    >
      {/* Large Centered Retro Phone Chassis (Sharp Stepped Pixel Geometry) */}
      <div className="w-full max-w-[440px] pixel-chassis p-5 shrink-0">
        {/* Earpiece Speaker Grille */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs tracking-widest text-[#BDE879] font-bold">PIXEL-01</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#0b0d09]" />
            <span className="w-12 h-2 bg-[#0b0d09]" />
            <span className="w-2 h-2 bg-[#0b0d09]" />
          </div>
          <span className="text-xs font-bold text-[#BDE879]">{isOnline ? 'LINK' : 'LOCAL'}</span>
        </div>

        {/* Large Recessed Pixel LCD Screen */}
        <div className="border-4 border-[#0b0d09] bg-[#0b0d09] p-1.5">
          <LCDViewport className="w-full h-[500px]" />
        </div>

        {/* Physical Tactile Pixel Keypad */}
        <div className="mt-4">
          <VirtualKeypad />
        </div>
      </div>

      {/* Desktop Companion Workspace Rail (Pixel Styled) */}
      <aside className="w-full max-w-[420px] pixel-panel p-5 space-y-4">
        <div className="border-b-[3px] border-[#3f463a] pb-3">
          <h1 className="text-xl sm:text-2xl font-bold leading-none text-[#D8FF9A]">RETRO PIXEL OS</h1>
          <p className="text-xs sm:text-sm text-[#BDE879] mt-2 leading-snug">
            {language === 'id'
              ? 'Simulator Sistem Operasi Ponsel Monokrom Klasik'
              : 'Classic Monochrome Pocket OS Simulator'}
          </p>
        </div>

        {/* Mode & System Controls */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              setDesktopMode('wide');
            }}
            className="pixel-key-accent bg-[#D8FF9A] text-black px-2.5 py-2 text-xs sm:text-sm font-bold hover:bg-[#BDE879] cursor-pointer truncate"
          >
            {t(language, 'displayModeWide')}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playCue('click');
              setLanguage(language === 'id' ? 'en' : 'id');
            }}
            className="pixel-key bg-[#2a3026] px-2.5 py-2 text-xs sm:text-sm font-bold text-[#D8FF9A] hover:bg-[#353d30] cursor-pointer truncate"
          >
            {language === 'id' ? 'Bahasa: ID' : 'Language: EN'}
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="pixel-key bg-[#2a3026] px-2.5 py-2 text-xs sm:text-sm font-bold text-[#D8FF9A] hover:bg-[#353d30] cursor-pointer truncate"
          >
            {soundEnabled ? t(language, 'soundOn') : t(language, 'soundMuted')}
          </button>

          <button
            type="button"
            onClick={() => openApp('settings')}
            className="pixel-key bg-[#2a3026] px-2.5 py-2 text-xs sm:text-sm font-bold text-[#D8FF9A] hover:bg-[#353d30] cursor-pointer truncate"
          >
            {language === 'id' ? 'Pengaturan' : 'Settings'}
          </button>
        </div>

        <PWAInstallButton />

        {/* Quick App Launchers */}
        <div>
          <div className="text-xs font-bold text-[#BDE879] mb-2">
            {t(language, 'quickAccess')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'messages', label: language === 'id' ? 'Pesan' : 'Messages' },
              { id: 'phone', label: language === 'id' ? 'Panggil' : 'Phone' },
              { id: 'tamagotchi', label: 'Tamagotchi' },
              { id: 'tv', label: 'TV Live' },
              { id: 'audio-studio', label: 'Studio' },
              { id: 'video-editor', label: 'Edit Video' },
              { id: 'terminal', label: 'Terminal' },
              { id: 'music', label: language === 'id' ? 'Musik' : 'Music' },
              { id: 'browser', label: 'Browser' },
              { id: 'snake', label: 'Snake' },
              { id: 'camera', label: language === 'id' ? 'Kamera' : 'Camera' },
              { id: 'calendar', label: language === 'id' ? 'Kalender' : 'Calendar' },
            ].map((item) => {
              const appIcon = getAppById(item.id)?.icon ?? 'apps';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openApp(item.id)}
                  className="pixel-key bg-[#262b22] px-1.5 py-2 text-[11px] font-bold text-[#D8FF9A] hover:bg-[#353d30] cursor-pointer flex flex-col items-center justify-center gap-1 min-w-0"
                >
                  <PixelIcon name={appIcon} size={28} />
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Keyboard Legend */}
        <div className="border-t-[3px] border-[#3f463a] pt-3 text-xs text-[#BDE879] leading-relaxed">
          <div>{t(language, 'keyboardHelp')}</div>
          {!isOnline && <div className="mt-1 font-bold text-[#D8FF9A]">{t(language, 'offlineBanner')}</div>}
        </div>
      </aside>
    </main>
  );
};
