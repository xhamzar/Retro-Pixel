'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { PWAInstallButton } from '@/src/core/PWAInstallButton';
import { db, resetAllOSData } from '@/src/services/db';
import {
  OS_CHANGELOG,
  OS_DOC_CHAPTERS,
  OS_LICENSES,
  OS_RELEASE_INFO,
} from '@/src/services/osDocs';
import { soundEngine } from '@/src/services/sound';
import { OS_THEMES, useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, PixelIconName } from '@/src/types/os';

// --- SETTINGS HUB (Screen 17) ---
export const SettingsApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setLanguage = useOSStore((s) => s.setLanguage);
  const openApp = useOSStore((s) => s.openApp);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [selectedIdx, setSelectedIdx] = useState(0);

  const items: { id: string; labelId: string; labelEn: string; icon: PixelIconName; action: () => void }[] = [
    {
      id: 'lang',
      labelId: `Bahasa: Indonesia (Ubah)`,
      labelEn: `Language: English (Switch)`,
      icon: 'profile',
      action: () => {
        const next = language === 'id' ? 'en' : 'id';
        setLanguage(next);
        soundEngine.playCue('select');
        showToast(next === 'id' ? 'Bahasa: Indonesia' : 'Language: English');
      },
    },
    { id: 'themes', labelId: 'Tema & Wallpaper', labelEn: 'Themes & Wallpaper', icon: 'theme', action: () => openApp('themes') },
    { id: 'display', labelId: 'Tampilan', labelEn: 'Display', icon: 'display', action: () => openApp('display') },
    { id: 'sound', labelId: 'Suara', labelEn: 'Sound', icon: 'sound', action: () => openApp('sound') },
    { id: 'network', labelId: 'Jaringan', labelEn: 'Network', icon: 'wifi', action: () => openApp('network') },
    { id: 'app-manager', labelId: 'Aplikasi', labelEn: 'Applications', icon: 'apps', action: () => openApp('app-manager') },
    { id: 'storage', labelId: 'Penyimpanan', labelEn: 'Storage', icon: 'storage', action: () => openApp('storage') },
    { id: 'battery', labelId: 'Baterai', labelEn: 'Battery', icon: 'battery', action: () => openApp('battery') },
    { id: 'docs', labelId: 'Panduan & Dokumen OS', labelEn: 'OS Guide & Docs', icon: 'manual', action: () => openApp('docs') },
    { id: 'about', labelId: 'Tentang Perangkat', labelEn: 'About Device', icon: 'info', action: () => openApp('about') },
  ];

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: language === 'id' ? 'Pilih' : 'Select',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: () => items[selectedIdx]?.action(),
      onRight: onBack,
    });
  }, [selectedIdx, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Pengaturan' : 'Settings'} showChevrons={false} />
      <div className="flex-1 overflow-y-auto lcd-scroll divide-y border-[var(--lcd-fg)]">
        {items.map((item, idx) => {
          const active = idx === selectedIdx;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedIdx(idx);
                soundEngine.playCue('click');
                item.action();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 text-left cursor-pointer ${
                active ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-sec)]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <PixelIcon name={item.icon} size={26} />
                <span className="text-xs sm:text-sm font-bold leading-none truncate">
                  {language === 'id' ? item.labelId : item.labelEn}
                </span>
              </div>
              <PixelIcon name="chevronRight" size={18} />
            </button>
          );
        })}

        <div className="p-2.5 space-y-2 bg-[var(--lcd-sec)]">
          <PWAInstallButton />
          <button
            type="button"
            onClick={async () => {
              await resetAllOSData();
              soundEngine.playCue('notify');
              showToast(language === 'id' ? 'Data OS direset ke awal' : 'OS data reset to defaults');
            }}
            className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs sm:text-sm font-bold hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
          >
            {language === 'id' ? 'Reset Data Lokal' : 'Reset Local Data'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- THEMES PICKER (Screen 18) ---
export const ThemesApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const themeId = useOSStore((s) => s.themeId);
  const setTheme = useOSStore((s) => s.setTheme);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const openApp = useOSStore((s) => s.openApp);
  const showToast = useOSStore((s) => s.showToast);

  const [selected, setSelected] = useState(themeId);

  const applyTheme = () => {
    setTheme(selected);
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Tema LCD diterapkan!' : 'LCD theme applied!');
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: 'Wallpaper',
      centerLabel: language === 'id' ? 'Terapkan' : 'Apply',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => openApp('wallpaper'),
      onCenter: applyTheme,
      onRight: onBack,
    });
  }, [selected, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Tema' : 'Themes'} showChevrons={false} />
      <div className="flex-1 overflow-y-auto lcd-scroll p-2 grid grid-cols-2 gap-2 content-start">
        {OS_THEMES.map((th) => {
          const isPicked = selected === th.id;
          return (
            <button
              key={th.id}
              type="button"
              onClick={() => {
                setSelected(th.id);
                setTheme(th.id);
                soundEngine.playCue('click');
              }}
              className={`border-2 border-[var(--lcd-fg)] p-1.5 text-left cursor-pointer ${
                isPicked ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
              }`}
            >
              <div
                className="h-12 border border-current p-1 flex flex-col justify-between"
                style={{ backgroundColor: th.bg, color: th.fg }}
              >
                <div className="text-xs font-bold leading-none">16:24</div>
                <div className="h-3 w-full" style={{ backgroundColor: th.sec }} />
              </div>
              <div className="text-sm font-bold truncate mt-1">
                {language === 'id' ? th.nameId : th.nameEn}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- DISPLAY SETTINGS ---
export const DisplaySettingsApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const brightness = useOSStore((s) => s.brightness);
  const setBrightness = useOSStore((s) => s.setBrightness);
  const pixelGrid = useOSStore((s) => s.pixelGrid);
  const setPixelGrid = useOSStore((s) => s.setPixelGrid);
  const desktopMode = useOSStore((s) => s.desktopMode);
  const setDesktopMode = useOSStore((s) => s.setDesktopMode);
  const setLanguage = useOSStore((s) => s.setLanguage);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: 'OK',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onRight: onBack,
    });
  }, [language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Tampilan' : 'Display'} showChevrons={false} />
      <div className="flex-1 overflow-y-auto lcd-scroll p-3 space-y-3">
        <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2">
          <div className="flex justify-between text-xs sm:text-sm font-bold">
            <span>{language === 'id' ? 'Kecerahan LCD' : 'LCD Brightness'}</span>
            <span>{Math.round(brightness * 100)}%</span>
          </div>
          <input
            type="range"
            min={55}
            max={115}
            value={Math.round(brightness * 100)}
            onChange={(e) => setBrightness(Number(e.target.value) / 100)}
            className="w-full accent-[var(--lcd-fg)] mt-1 cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={() => setPixelGrid(!pixelGrid)}
          className="w-full flex justify-between border-2 border-[var(--lcd-fg)] p-2 text-xs sm:text-sm font-bold cursor-pointer"
        >
          <span>{language === 'id' ? 'Kisi Piksel LCD' : 'LCD Pixel Grid'}</span>
          <span>{pixelGrid ? 'ON' : 'OFF'}</span>
        </button>

        <button
          type="button"
          onClick={() => setDesktopMode(desktopMode === 'chassis' ? 'wide' : 'chassis')}
          className="w-full flex justify-between border-2 border-[var(--lcd-fg)] p-2 text-xs sm:text-sm font-bold cursor-pointer"
        >
          <span>{language === 'id' ? 'Mode Desktop' : 'Desktop Mode'}</span>
          <span>{desktopMode === 'chassis' ? 'Phone' : 'Wide LCD'}</span>
        </button>

        <button
          type="button"
          onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
          className="w-full flex justify-between border-2 border-[var(--lcd-fg)] p-2 text-xs sm:text-sm font-bold cursor-pointer"
        >
          <span>{language === 'id' ? 'Bahasa' : 'Language'}</span>
          <span>{language === 'id' ? 'Indonesia' : 'English'}</span>
        </button>
      </div>
    </div>
  );
};

// --- SOUND SETTINGS ---
export const SoundSettingsApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const soundEnabled = useOSStore((s) => s.soundEnabled);
  const setSoundEnabled = useOSStore((s) => s.setSoundEnabled);
  const volume = useOSStore((s) => s.volume);
  const setVolume = useOSStore((s) => s.setVolume);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  useEffect(() => {
    setSoftkeys({
      leftLabel: language === 'id' ? 'Tes' : 'Test',
      centerLabel: soundEnabled ? 'MUTE' : 'UNMUTE',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => soundEngine.playCue('notify'),
      onCenter: () => setSoundEnabled(!soundEnabled),
      onRight: onBack,
    });
  }, [soundEnabled, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Suara' : 'Sound'} showChevrons={false} />
      <div className="p-3 space-y-3">
        <button
          type="button"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="w-full flex justify-between border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 text-xs sm:text-sm font-bold cursor-pointer"
        >
          <span>{language === 'id' ? 'Efek Suara Piezo' : 'Piezo Sound FX'}</span>
          <span>{soundEnabled ? 'ON' : 'OFF'}</span>
        </button>

        <div className="border-2 border-[var(--lcd-fg)] p-2">
          <div className="flex justify-between text-xs sm:text-sm font-bold">
            <span>Volume</span>
            <span>{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="w-full accent-[var(--lcd-fg)] mt-1 cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={() => soundEngine.playCue('alarm')}
          className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs sm:text-sm font-bold cursor-pointer"
        >
          {language === 'id' ? 'Putar Nada Dering' : 'Preview Ringtone'}
        </button>
      </div>
    </div>
  );
};

// --- APP MANAGER ---
export const AppManagerApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const openApp = useOSStore((s) => s.openApp);
  const quickSlotIds = useOSStore((s) => s.quickSlotIds);
  const setQuickSlot = useOSStore((s) => s.setQuickSlot);
  const showToast = useOSStore((s) => s.showToast);

  const [recent, setRecent] = useState<{ appId: string; launchCount: number }[]>([]);

  useEffect(() => {
    db.recentApps.orderBy('launchedAt').reverse().toArray().then(setRecent);
    setSoftkeys({
      leftLabel: '',
      centerLabel: 'OK',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onRight: onBack,
    });
  }, [language, onBack, setSoftkeys]);

  const pinToDock = (appId: string) => {
    setQuickSlot(3, appId);
    soundEngine.playCue('select');
    showToast(language === 'id' ? `${appId} disematkan di Home` : `${appId} pinned to Home`);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Manajer Aplikasi' : 'App Manager'} showChevrons={false} />
      <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-1.5">
        <div className="text-xs font-bold border-b border-[var(--lcd-fg)] pb-1">
          {language === 'id' ? 'Aplikasi Sering Dibuka (Sematkan ke Slot 4 Home)' : 'Recently Launched (Pin to Home Slot 4)'}
        </div>
        {recent.length === 0 ? (
          <div className="text-sm opacity-80 py-4 text-center">
            {language === 'id' ? 'Belum ada riwayat aplikasi.' : 'No app history yet.'}
          </div>
        ) : (
          recent.map((r) => {
            const pinned = quickSlotIds.includes(r.appId);
            return (
              <div
                key={r.appId}
                className="flex items-center justify-between border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-2 py-1 text-xs font-bold"
              >
                <button
                  type="button"
                  onClick={() => openApp(r.appId)}
                  className="flex-1 text-left cursor-pointer truncate"
                >
                  {r.appId} ({r.launchCount}x)
                </button>
                <button
                  type="button"
                  onClick={() => pinToDock(r.appId)}
                  className={`ml-2 px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[10px] cursor-pointer ${
                    pinned ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {pinned ? 'PINNED' : 'PIN'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// --- STORAGE INFO ---
export const StorageApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [stats, setStats] = useState({ contacts: 0, messages: 0, notes: 0, files: 0, events: 0, totalKb: 0 });
  const [quotaInfo, setQuotaInfo] = useState<{ usedMb: string; quotaMb: string; pct: number } | null>(null);

  const fetchStorageSnapshot = async () => {
    const [contacts, messages, notes, filesList, events] = await Promise.all([
      db.contacts.count(),
      db.messages.count(),
      db.notes.count(),
      db.files.toArray(),
      db.events.count(),
    ]);
    const totalKb = filesList.reduce((acc, f) => acc + (f.sizeKb || 0), 0);
    let quota: { usedMb: string; quotaMb: string; pct: number } | null = null;
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const usage = est.usage ?? 0;
      const quotaBytes = est.quota ?? 1;
      quota = {
        usedMb: (usage / (1024 * 1024)).toFixed(2),
        quotaMb: (quotaBytes / (1024 * 1024)).toFixed(0),
        pct: Math.min(100, Math.max(1, Math.round((usage / quotaBytes) * 100))),
      };
    }
    return {
      stats: { contacts, messages, notes, files: filesList.length, events, totalKb },
      quota,
    };
  };

  const refreshStats = async () => {
    const snap = await fetchStorageSnapshot();
    setStats(snap.stats);
    setQuotaInfo(snap.quota);
  };

  useEffect(() => {
    let active = true;
    fetchStorageSnapshot().then((snap) => {
      if (!active) return;
      setStats(snap.stats);
      setQuotaInfo(snap.quota);
    });
    setSoftkeys({
      leftLabel: '',
      centerLabel: 'OK',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onRight: onBack,
    });
    return () => {
      active = false;
    };
  }, [language, onBack, setSoftkeys]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Penyimpanan' : 'Storage'} showChevrons={false} />
      <div className="flex-1 overflow-y-auto lcd-scroll p-3 space-y-2.5">
        <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2">
          <div className="flex justify-between font-bold text-xs sm:text-sm">
            <span>IndexedDB Storage</span>
            <span>{quotaInfo ? `${quotaInfo.usedMb} MB` : `${stats.totalKb} KB`}</span>
          </div>
          <div className="w-full h-3 border-2 border-[var(--lcd-fg)] mt-1 bg-[var(--lcd-bg)]">
            <div className="h-full bg-[var(--lcd-fg)]" style={{ width: `${quotaInfo?.pct ?? 12}%` }} />
          </div>
          {quotaInfo && (
            <div className="text-[10px] opacity-80 mt-1">
              {language === 'id' ? 'Kuota browser' : 'Browser quota'}: {quotaInfo.quotaMb} MB ({quotaInfo.pct}%)
            </div>
          )}
        </div>
        <div className="border-2 border-[var(--lcd-fg)] p-2 space-y-1 text-xs sm:text-sm">
          <div className="flex justify-between"><span>Contacts</span><span className="font-bold">{stats.contacts}</span></div>
          <div className="flex justify-between"><span>Messages</span><span className="font-bold">{stats.messages}</span></div>
          <div className="flex justify-between"><span>Notes</span><span className="font-bold">{stats.notes}</span></div>
          <div className="flex justify-between"><span>Files ({stats.totalKb} KB)</span><span className="font-bold">{stats.files}</span></div>
          <div className="flex justify-between"><span>Events</span><span className="font-bold">{stats.events}</span></div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await db.history.clear();
            soundEngine.playCue('back');
            showToast(language === 'id' ? 'Riwayat browser dibersihkan' : 'Browser history cleared');
            refreshStats();
          }}
          className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
        >
          {language === 'id' ? 'Bersihkan Riwayat Browser' : 'Clear Browser History'}
        </button>
      </div>
    </div>
  );
};

// --- BATTERY MONITOR (REAL HARDWARE API + FALLBACK) ---
export const BatteryApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const batteryLevel = useOSStore((s) => s.batteryLevel);
  const isCharging = useOSStore((s) => s.isCharging);
  const setBatteryState = useOSStore((s) => s.setBatteryState);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  const [hwSupported, setHwSupported] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    if (nav.getBattery) {
      nav.getBattery().then((b) => {
        setHwSupported(true);
        setBatteryState(Math.round(b.level * 100), b.charging);
      }).catch(() => undefined);
    }
  }, [setBatteryState]);

  useEffect(() => {
    setSoftkeys({
      leftLabel: '-10%',
      centerLabel: isCharging ? 'Unplug' : 'Charge',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => setBatteryState(batteryLevel - 10),
      onCenter: () => setBatteryState(batteryLevel, !isCharging),
      onRight: onBack,
    });
  }, [batteryLevel, isCharging, language, onBack, setBatteryState, setSoftkeys]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Baterai' : 'Battery'} showChevrons={false} />
      <div className="p-3 space-y-3">
        <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-3 text-center">
          <div className="text-[10px] font-bold uppercase mb-1">
            {hwSupported
              ? language === 'id'
                ? '● SENSOR PERANGKAT ASLI'
                : '● HARDWARE BATTERY API'
              : language === 'id'
                ? 'MODE SIMULASI'
                : 'SIMULATED POWER'}
          </div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">{batteryLevel}%</div>
          <div className="text-xs sm:text-sm mt-1">
            {isCharging
              ? language === 'id'
                ? 'Sedang Mengisi Daya'
                : 'Charging'
              : language === 'id'
                ? `Perkiraan: ~${Math.max(1, Math.round(batteryLevel / 12))} jam aktif`
                : `Est: ~${Math.max(1, Math.round(batteryLevel / 12))} hrs active`}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBatteryState(batteryLevel, !isCharging)}
            className="py-1.5 px-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer truncate"
          >
            {isCharging ? (language === 'id' ? 'Cabut Charger' : 'Stop Charging') : language === 'id' ? 'Isi Daya' : 'Simulate Charge'}
          </button>
          <button
            type="button"
            onClick={() => setBatteryState(Math.min(100, batteryLevel + 15))}
            className="py-1.5 border-2 border-[var(--lcd-fg)] text-xs font-bold hover:bg-[var(--lcd-sec)] cursor-pointer"
          >
            +15%
          </button>
        </div>
      </div>
    </div>
  );
};

// --- ABOUT DEVICE / TENTANG OS ---
type AboutTabId = 'identity' | 'device' | 'changelog' | 'licenses';

const ABOUT_TABS: { id: AboutTabId; labelId: string; labelEn: string }[] = [
  { id: 'identity', labelId: 'Identitas', labelEn: 'Identity' },
  { id: 'device', labelId: 'Perangkat', labelEn: 'Device' },
  { id: 'changelog', labelId: 'Rilis', labelEn: 'Release' },
  { id: 'licenses', labelId: 'Lisensi', labelEn: 'Licenses' },
];

interface LiveDeviceSnapshot {
  viewport: string;
  platform: string;
  cores: string;
  online: boolean;
  contacts: number;
  notes: number;
  files: number;
  alarms: number;
  storageSummary: string;
}

const initialTabFromParam = (tab?: string): AboutTabId => {
  if (tab === 'device' || tab === 'changelog' || tab === 'licenses' || tab === 'identity') {
    return tab;
  }
  return 'identity';
};

export const AboutOSApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const batteryLevel = useOSStore((s) => s.batteryLevel);
  const isCharging = useOSStore((s) => s.isCharging);
  const wifiEnabled = useOSStore((s) => s.wifiEnabled);
  const themeId = useOSStore((s) => s.themeId);
  const pixelGrid = useOSStore((s) => s.pixelGrid);
  const openApp = useOSStore((s) => s.openApp);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState<AboutTabId>(() => initialTabFromParam(params?.tab));
  const [snapshot, setSnapshot] = useState<LiveDeviceSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const loadSnapshot = async () => {
      const [contacts, notes, files, alarms] = await Promise.all([
        db.contacts.count(),
        db.notes.count(),
        db.files.count(),
        db.alarms.count(),
      ]);
      let storageSummary = `${files} files (IndexedDB)`;
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        try {
          const est = await navigator.storage.estimate();
          if (est.usage !== undefined && est.quota) {
            const usedMb = (est.usage / (1024 * 1024)).toFixed(2);
            const quotaMb = Math.round(est.quota / (1024 * 1024));
            storageSummary = `${usedMb} MB / ${quotaMb} MB`;
          }
        } catch {
          // ignore storage estimate errors
        }
      }
      if (!active) return;
      setSnapshot({
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '-',
        platform: typeof navigator !== 'undefined' ? navigator.platform || 'Web' : 'Web',
        cores:
          typeof navigator !== 'undefined' && navigator.hardwareConcurrency
            ? `${navigator.hardwareConcurrency} cores`
            : '-',
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        contacts,
        notes,
        files,
        alarms,
        storageSummary,
      });
    };
    void loadSnapshot();
    return () => {
      active = false;
    };
  }, []);

  const copySystemInfo = async () => {
    const lines = [
      `${OS_RELEASE_INFO.name} ${OS_RELEASE_INFO.version} (${OS_RELEASE_INFO.codename})`,
      `Build: ${OS_RELEASE_INFO.build}`,
      `Kernel: ${OS_RELEASE_INFO.kernel}`,
      `Shell: ${OS_RELEASE_INFO.shell}`,
      `Theme: ${themeId} | Lang: ${language.toUpperCase()}`,
      `Battery: ${batteryLevel}%${isCharging ? ' (Charging)' : ''} | Wi-Fi: ${wifiEnabled ? 'ON' : 'OFF'}`,
      `Viewport: ${snapshot?.viewport ?? '-'} | Platform: ${snapshot?.platform ?? '-'}`,
      `Storage: ${snapshot?.storageSummary ?? '-'}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      soundEngine.playCue('select');
      showToast(language === 'id' ? 'Info sistem disalin' : 'System info copied');
    } catch {
      showToast(language === 'id' ? 'Clipboard tidak tersedia' : 'Clipboard unavailable');
    }
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: language === 'id' ? 'Salin' : 'Copy',
      centerLabel: language === 'id' ? 'Panduan' : 'Guide',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => {
        void copySystemInfo();
      },
      onCenter: () => openApp('docs'),
      onRight: onBack,
    });
  });

  const activeThemeName = useMemo(() => {
    const found = OS_THEMES.find((t) => t.id === themeId);
    if (!found) return themeId;
    return language === 'id' ? found.nameId : found.nameEn;
  }, [language, themeId]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Tentang Perangkat' : 'About Device'}
        showChevrons={false}
      />

      {/* Tabs */}
      <div className="grid grid-cols-4 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
        {ABOUT_TABS.map((tab) => {
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundEngine.playCue('click');
                setActiveTab(tab.id);
              }}
              className={`py-1.5 text-[10px] sm:text-xs font-bold border-r last:border-r-0 border-[var(--lcd-fg)] cursor-pointer truncate px-1 ${
                isCurrent ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-bg)]/40'
              }`}
            >
              {language === 'id' ? tab.labelId : tab.labelEn}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2.5">
        {activeTab === 'identity' && (
          <>
            <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 flex items-center gap-2.5">
              <div className="w-10 h-10 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] flex items-center justify-center shrink-0">
                <PixelIcon name="info" size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight truncate">{OS_RELEASE_INFO.name}</div>
                <div className="text-[11px] font-bold opacity-85">
                  v{OS_RELEASE_INFO.version} — {OS_RELEASE_INFO.codename}
                </div>
                <div className="text-[10px] font-mono opacity-75">{OS_RELEASE_INFO.build}</div>
              </div>
            </div>

            <div className="border-2 border-[var(--lcd-fg)] divide-y divide-[var(--lcd-fg)]/30 text-[11px]">
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">Kernel</span>
                <span className="font-mono font-bold text-right">{OS_RELEASE_INFO.kernel}</span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">Shell</span>
                <span className="font-mono font-bold text-right">{OS_RELEASE_INFO.shell}</span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">{language === 'id' ? 'Layar' : 'Display'}</span>
                <span className="font-bold text-right">{OS_RELEASE_INFO.displaySpec}</span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">{language === 'id' ? 'Mesin Data' : 'Storage Engine'}</span>
                <span className="font-bold text-right">{OS_RELEASE_INFO.storageEngine}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openApp('docs')}
                className="py-1.5 px-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer truncate"
              >
                {language === 'id' ? 'Pusat Panduan OS' : 'OS Guide Hub'}
              </button>
              <button
                type="button"
                onClick={() => openApp('terminal')}
                className="py-1.5 px-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer truncate hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
              >
                {language === 'id' ? 'Buka Terminal' : 'Open Terminal'}
              </button>
            </div>
          </>
        )}

        {activeTab === 'device' && (
          <>
            <div className="border-2 border-[var(--lcd-fg)] divide-y divide-[var(--lcd-fg)]/30 text-[11px]">
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">{language === 'id' ? 'Baterai' : 'Battery'}</span>
                <span className="font-bold">
                  {batteryLevel}% {isCharging ? (language === 'id' ? '(Mengisi)' : '(Charging)') : ''}
                </span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">Wi-Fi / {language === 'id' ? 'Jaringan' : 'Network'}</span>
                <span className="font-bold">
                  {wifiEnabled ? 'ON' : 'OFF'} / {snapshot?.online ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">{language === 'id' ? 'Tema LCD' : 'LCD Theme'}</span>
                <span className="font-bold text-right">{activeThemeName}</span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">{language === 'id' ? 'Grid Piksel' : 'Pixel Grid'}</span>
                <span className="font-bold">{pixelGrid ? 'ON' : 'OFF'}</span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">{language === 'id' ? 'Bahasa' : 'Language'}</span>
                <span className="font-bold">{language === 'id' ? 'Indonesia (ID)' : 'English (EN)'}</span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">Viewport</span>
                <span className="font-mono font-bold">{snapshot?.viewport ?? '...'}</span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">Host / CPU</span>
                <span className="font-mono font-bold text-right">
                  {snapshot ? `${snapshot.platform} (${snapshot.cores})` : '...'}
                </span>
              </div>
              <div className="p-2 flex justify-between gap-2">
                <span className="opacity-75">IndexedDB</span>
                <span className="font-mono font-bold text-right">{snapshot?.storageSummary ?? '...'}</span>
              </div>
            </div>

            <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex justify-between">
                <span>{language === 'id' ? 'Kontak' : 'Contacts'}</span>
                <span className="font-bold">{snapshot?.contacts ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'id' ? 'Catatan' : 'Notes'}</span>
                <span className="font-bold">{snapshot?.notes ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'id' ? 'Berkas' : 'Files'}</span>
                <span className="font-bold">{snapshot?.files ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Alarm</span>
                <span className="font-bold">{snapshot?.alarms ?? 0}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void copySystemInfo();
              }}
              className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'Salin Info Sistem ke Clipboard' : 'Copy System Info to Clipboard'}
            </button>
          </>
        )}

        {activeTab === 'changelog' && (
          <div className="space-y-2.5">
            {OS_CHANGELOG.map((rel) => {
              const title = language === 'id' ? rel.titleId : rel.titleEn;
              const itemsList = language === 'id' ? rel.highlightsId : rel.highlightsEn;
              return (
                <div key={rel.version} className="border-2 border-[var(--lcd-fg)] p-2 space-y-1">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--lcd-fg)]/30 pb-1">
                    <span className="px-1.5 py-0.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold">
                      v{rel.version}
                    </span>
                    <span className="text-[10px] font-mono opacity-75">{rel.date}</span>
                  </div>
                  <div className="text-xs font-bold leading-snug">{title}</div>
                  <ul className="space-y-1 text-[11px] leading-snug">
                    {itemsList.map((line, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="font-bold shrink-0">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'licenses' && (
          <div className="space-y-2">
            <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 text-[11px] leading-snug">
              <div className="font-bold mb-0.5">
                {language === 'id' ? 'Privasi & Penyimpanan Lokal' : 'Privacy & Local Storage'}
              </div>
              <p className="opacity-85">
                {language === 'id'
                  ? 'Seluruh kontak, catatan, berkas, foto kamera, rekaman suara, dan skrip Linux disimpan secara lokal di IndexedDB browser Anda.'
                  : 'All contacts, notes, files, camera photos, voice recordings, and Linux scripts are stored locally in your browser IndexedDB.'}
              </p>
            </div>
            {OS_LICENSES.map((lic) => (
              <div key={lic.name} className="border-2 border-[var(--lcd-fg)] p-2 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{lic.name}</span>
                  <span className="text-[10px] font-mono px-1 bg-[var(--lcd-sec)] border border-[var(--lcd-fg)] shrink-0">
                    {lic.license}
                  </span>
                </div>
                <div className="text-[11px] opacity-85 leading-snug">
                  {language === 'id' ? lic.roleId : lic.roleEn}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPLETE OS GUIDE & DOCUMENTATION HUB ---
export const OSDocsApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const openApp = useOSStore((s) => s.openApp);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (params?.tab && OS_DOC_CHAPTERS.some((c) => c.id === params.tab)) {
      return params.tab;
    }
    return null;
  });

  const filteredChapters = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OS_DOC_CHAPTERS;
    return OS_DOC_CHAPTERS.filter((ch) => {
      const title = (language === 'id' ? ch.titleId : ch.titleEn).toLowerCase();
      const summary = (language === 'id' ? ch.summaryId : ch.summaryEn).toLowerCase();
      if (title.includes(q) || summary.includes(q)) return true;
      return ch.sections.some((sec) => {
        const heading = (language === 'id' ? sec.headingId : sec.headingEn).toLowerCase();
        const lines = (language === 'id' ? sec.linesId : sec.linesEn).join(' ').toLowerCase();
        return heading.includes(q) || lines.includes(q);
      });
    });
  }, [language, query]);

  const activeChapter = useMemo(
    () => (selectedId ? OS_DOC_CHAPTERS.find((c) => c.id === selectedId) ?? null : null),
    [selectedId],
  );

  useEffect(() => {
    if (activeChapter) {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Semua Bab' : 'All Chapters',
        centerLabel: 'Dokumen',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => setSelectedId(null),
        onCenter: () => openApp('files', { folder: 'Dokumen' }),
        onRight: () => setSelectedId(null),
      });
    } else {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Tentang OS' : 'About OS',
        centerLabel: 'Dokumen',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => openApp('about'),
        onCenter: () => openApp('files', { folder: 'Dokumen' }),
        onRight: onBack,
      });
    }
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Panduan Lengkap OS' : 'Complete OS Guide'}
        showChevrons={false}
      />

      {activeChapter ? (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b-2 border-[var(--lcd-fg)] pb-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('back');
                setSelectedId(null);
              }}
              className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[11px] font-bold cursor-pointer"
            >
              ← {language === 'id' ? 'Daftar Bab' : 'Chapters'}
            </button>
            <span className="px-1.5 py-0.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold">
              BAB {activeChapter.badge}
            </span>
          </div>

          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 space-y-1">
            <div className="text-sm font-bold leading-snug">
              {language === 'id' ? activeChapter.titleId : activeChapter.titleEn}
            </div>
            <p className="text-[11px] opacity-85 leading-snug">
              {language === 'id' ? activeChapter.summaryId : activeChapter.summaryEn}
            </p>
            {activeChapter.quickApps.length > 0 && (
              <div className="pt-1.5 flex flex-wrap gap-1.5">
                {activeChapter.quickApps.map((qa) => (
                  <button
                    key={qa.appId}
                    type="button"
                    onClick={() => openApp(qa.appId)}
                    className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                  >
                    ↗ {language === 'id' ? qa.labelId : qa.labelEn}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeChapter.sections.map((sec, sIdx) => {
            const heading = language === 'id' ? sec.headingId : sec.headingEn;
            const lines = language === 'id' ? sec.linesId : sec.linesEn;
            return (
              <div key={sIdx} className="border-2 border-[var(--lcd-fg)] p-2 space-y-1.5">
                <div className="text-xs font-bold border-b border-[var(--lcd-fg)]/30 pb-1">
                  {heading}
                </div>
                <ul className="space-y-1 text-[11px] leading-snug">
                  {lines.map((line, lIdx) => (
                    <li key={lIdx} className="flex items-start gap-1.5">
                      <span className="font-bold shrink-0">›</span>
                      <span className="break-words">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'Semua Bab' : 'All Chapters'}
            </button>
            <button
              type="button"
              onClick={() => openApp('files', { folder: 'Dokumen' })}
              className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
            >
              /Dokumen →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="p-2 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                language === 'id'
                  ? 'Cari panduan (contoh: curl, nano, video)...'
                  : 'Search guide (e.g., curl, nano, video)...'
              }
              className="w-full px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)] text-xs outline-none placeholder:opacity-60"
            />
          </div>

          <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-2">
            {/* Quick Access Banner to /Dokumen & E-Book */}
            <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate">
                  {language === 'id' ? 'Berkas Manual di /Dokumen' : 'Manual Files in /Dokumen'}
                </div>
                <div className="text-[10px] opacity-80 truncate">
                  {language === 'id'
                    ? 'Tersedia 4 dokumen .txt lengkap & bisa dibaca di E-Book.'
                    : '4 complete .txt manuals ready to read in E-Book.'}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openApp('ebook')}
                  className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
                >
                  E-Book
                </button>
                <button
                  type="button"
                  onClick={() => openApp('files', { folder: 'Dokumen' })}
                  className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                >
                  /Dokumen
                </button>
              </div>
            </div>

            {filteredChapters.length === 0 ? (
              <div className="border-2 border-[var(--lcd-fg)] p-4 text-center text-xs opacity-75">
                {language === 'id'
                  ? `Tidak ada topik panduan untuk "${query}".`
                  : `No guide topics matching "${query}".`}
              </div>
            ) : (
              filteredChapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('select');
                    setSelectedId(ch.id);
                  }}
                  className="w-full text-left border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-sec)] p-2 space-y-1 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold shrink-0">
                        {ch.badge}
                      </span>
                      <span className="text-xs font-bold truncate">
                        {language === 'id' ? ch.titleId : ch.titleEn}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono opacity-75 shrink-0">
                      {ch.sections.length} {language === 'id' ? 'bagian' : 'sec'} ›
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-snug line-clamp-2">
                    {language === 'id' ? ch.summaryId : ch.summaryEn}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};


