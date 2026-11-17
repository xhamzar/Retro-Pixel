import { create } from 'zustand';
import { db, ensureDatabaseSeeded } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import type {
  AppCategoryId,
  AppLaunchParams,
  DesktopMode,
  KeyCommand,
  LanguageCode,
  OSNotification,
  OSRadioState,
  OSScreenType,
  OSThemeDefinition,
  OSThemeId,
  SoftkeyConfig,
  WallpaperId,
} from '@/src/types/os';

export const OS_THEMES: OSThemeDefinition[] = [
  { id: 'classic', nameId: 'Klasik Hijau LCD', nameEn: 'Classic Lime LCD', bg: '#D8FF9A', fg: '#000000', sec: '#BDE879' },
  { id: 'amber', nameId: 'Kuning Amber Retro', nameEn: 'Retro Amber', bg: '#FFD57E', fg: '#1C1100', sec: '#E8BA5C' },
  { id: 'paper', nameId: 'Kertas Monokrom', nameEn: 'Paper Mono', bg: '#E6EAD9', fg: '#111310', sec: '#CFD6BE' },
  { id: 'mint', nameId: 'Mint Saku', nameEn: 'Pocket Mint', bg: '#B5F4D0', fg: '#041C10', sec: '#94DBB4' },
  { id: 'inverted', nameId: 'Kontras Gelap', nameEn: 'Inverted Dark', bg: '#0D1408', fg: '#D8FF9A', sec: '#1B2912' },
];

export interface HistoryEntry {
  screen: OSScreenType;
  category?: AppCategoryId;
  appId?: string;
  params?: AppLaunchParams;
}

type KeyListener = (cmd: KeyCommand) => boolean | void;

interface OSState {
  initialized: boolean;
  screen: OSScreenType;
  activeCategory: AppCategoryId;
  activeAppId: string | null;
  activeAppParams: AppLaunchParams | undefined;
  navHistory: HistoryEntry[];

  focusIndex: number;
  gridPage: number;
  searchQuery: string;

  language: LanguageCode;
  themeId: OSThemeId;
  wallpaperId: WallpaperId;
  customWallpaperUrl: string | null;
  brightness: number; // 0.6 to 1.15
  pixelGrid: boolean;
  soundEnabled: boolean;
  volume: number; // 0 to 1
  desktopMode: DesktopMode;
  quickSlotIds: [string, string, string, string];

  batteryLevel: number;
  isCharging: boolean;
  wifiEnabled: boolean;
  hotspotEnabled: boolean;
  signalStrength: number;

  notifications: OSNotification[];
  notificationShadeOpen: boolean;
  toastMessage: string | null;
  softkeys: SoftkeyConfig;
  ringingAlarm: { id?: number; time: string; label: string } | null;
  radio: OSRadioState;

  keyListeners: KeyListener[];

  // Actions
  initOS: () => Promise<void>;
  setScreen: (screen: OSScreenType, opts?: { category?: AppCategoryId; push?: boolean }) => void;
  openApp: (appId: string, params?: AppLaunchParams) => void;
  goBack: () => void;
  goHome: () => void;
  setFocusIndex: (idx: number) => void;
  setGridPage: (page: number) => void;
  setSearchQuery: (q: string) => void;

  setSoftkeys: (cfg: SoftkeyConfig) => void;
  dispatchKey: (cmd: KeyCommand) => void;
  subscribeKey: (listener: KeyListener) => () => void;

  setLanguage: (lang: LanguageCode) => void;
  setTheme: (themeId: OSThemeId) => void;
  setWallpaper: (wallpaperId: WallpaperId, customUrl?: string | null) => void;
  setBrightness: (val: number) => void;
  setPixelGrid: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (vol: number) => void;
  setDesktopMode: (mode: DesktopMode) => void;
  setQuickSlot: (slotIndex: number, appId: string) => void;
  setBatteryState: (level: number, charging?: boolean) => void;
  setWifiEnabled: (enabled: boolean) => void;
  setHotspotEnabled: (enabled: boolean) => void;

  pushNotification: (title: string, body: string, appId?: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  toggleNotificationShade: (open?: boolean) => void;
  showToast: (msg: string) => void;
  triggerAlarm: (alarm: { id?: number; time: string; label: string }) => void;
  dismissRingingAlarm: () => void;
  setRadioState: (patch: Partial<OSRadioState>) => void;
}

const DEFAULT_QUICK_SLOTS: [string, string, string, string] = ['messages', 'phone', 'apps-grid', 'camera'];

function readLocalPref<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`rpos_${key}`);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalPref(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`rpos_${key}`, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useOSStore = create<OSState>((set, get) => ({
  initialized: false,
  screen: 'home',
  activeCategory: 'communication',
  activeAppId: null,
  activeAppParams: undefined,
  navHistory: [],

  focusIndex: 0,
  gridPage: 0,
  searchQuery: '',

  language: 'id',
  themeId: 'classic',
  wallpaperId: 'village',
  customWallpaperUrl: null,
  brightness: 1,
  pixelGrid: true,
  soundEnabled: true,
  volume: 0.65,
  desktopMode: 'chassis',
  quickSlotIds: DEFAULT_QUICK_SLOTS,

  batteryLevel: 78,
  isCharging: false,
  wifiEnabled: true,
  hotspotEnabled: false,
  signalStrength: 4,

  notifications: [
    {
      id: 'welcome-notif',
      title: 'Sistem',
      body: 'Pembaharuan tersedia — Semua modul lokal aktif.',
      appId: 'messages',
      timestamp: Date.now() - 1000 * 60 * 12,
      read: false,
    },
    {
      id: 'ibu-notif',
      title: 'Ibu',
      body: 'Jangan lupa makan siang ya...',
      appId: 'messages',
      timestamp: Date.now() - 1000 * 60 * 50,
      read: false,
    },
  ],
  notificationShadeOpen: false,
  toastMessage: null,
  softkeys: {},
  ringingAlarm: null,
  radio: {
    sessionActive: false,
    power: false,
    status: 'idle',
    freq: 102.2,
    activeStation: {
      id: 'rg-NZYf7QsQ',
      source: 'rg',
      rgId: 'NZYf7QsQ',
      freq: 102.2,
      name: 'Prambors FM 102.2 Jakarta',
      city: 'Jakarta',
      country: 'Indonesia',
      genre: 'Hits / Pop Indonesia',
      secure: true,
    },
    sleepMinutesLeft: 0,
    errorNote: null,
  },
  keyListeners: [],

  initOS: async () => {
    if (get().initialized) return;
    await ensureDatabaseSeeded();

    const language = readLocalPref<LanguageCode>('language', 'id');
    const themeId = readLocalPref<OSThemeId>('themeId', 'classic');
    const wallpaperId = readLocalPref<WallpaperId>('wallpaperId', 'village');
    const customWallpaperUrl = readLocalPref<string | null>('customWallpaperUrl', null);
    const brightness = readLocalPref<number>('brightness', 1);
    const pixelGrid = readLocalPref<boolean>('pixelGrid', true);
    const soundEnabled = readLocalPref<boolean>('soundEnabled', true);
    const volume = readLocalPref<number>('volume', 0.65);
    const desktopMode = readLocalPref<DesktopMode>('desktopMode', 'chassis');
    const quickSlotIds = readLocalPref<[string, string, string, string]>('quickSlotIds', DEFAULT_QUICK_SLOTS);
    const batteryLevel = readLocalPref<number>('batteryLevel', 78);

    soundEngine.configure(soundEnabled, volume);

    // Also mirror settings in Dexie for storage inspector
    const settingsRows = await db.settings.toArray();
    if (settingsRows.length === 0) {
      await db.settings.bulkPut([
        { key: 'language', value: language },
        { key: 'themeId', value: themeId },
        { key: 'wallpaperId', value: wallpaperId },
      ]);
    }

    set({
      initialized: true,
      language,
      themeId,
      wallpaperId,
      customWallpaperUrl,
      brightness,
      pixelGrid,
      soundEnabled,
      volume,
      desktopMode,
      quickSlotIds,
      batteryLevel,
    });
  },

  setScreen: (screen, opts) => {
    const state = get();
    const push = opts?.push ?? true;
    const nextHistory = push
      ? [
          ...state.navHistory,
          {
            screen: state.screen,
            category: state.activeCategory,
            appId: state.activeAppId ?? undefined,
            params: state.activeAppParams,
          },
        ].slice(-12)
      : state.navHistory;

    soundEngine.playCue('click');
    set({
      screen,
      activeCategory: opts?.category ?? state.activeCategory,
      activeAppId: screen === 'app' ? state.activeAppId : null,
      navHistory: nextHistory,
      focusIndex: 0,
      notificationShadeOpen: false,
    });
  },

  openApp: (appId, params) => {
    if (appId === 'apps-grid') {
      get().setScreen('grid');
      return;
    }
    const state = get();
    const nextHistory = [
      ...state.navHistory,
      {
        screen: state.screen,
        category: state.activeCategory,
        appId: state.activeAppId ?? undefined,
        params: state.activeAppParams,
      },
    ].slice(-12);

    soundEngine.playCue('open');
    set({
      screen: 'app',
      activeAppId: appId,
      activeAppParams: params,
      navHistory: nextHistory,
      notificationShadeOpen: false,
    });

    // Record recent app launch in Dexie
    db.recentApps
      .get(appId)
      .then((existing) => {
        return db.recentApps.put({
          appId,
          launchedAt: Date.now(),
          launchCount: (existing?.launchCount ?? 0) + 1,
        });
      })
      .catch(() => undefined);
  },

  goBack: () => {
    const state = get();
    if (state.notificationShadeOpen) {
      soundEngine.playCue('back');
      set({ notificationShadeOpen: false });
      return;
    }

    if (state.navHistory.length === 0) {
      if (state.screen !== 'home') {
        soundEngine.playCue('back');
        set({ screen: 'home', activeAppId: null, activeAppParams: undefined, focusIndex: 0 });
      }
      return;
    }

    const prev = state.navHistory[state.navHistory.length - 1];
    soundEngine.playCue('back');
    set({
      screen: prev.screen,
      activeCategory: prev.category ?? state.activeCategory,
      activeAppId: prev.appId ?? null,
      activeAppParams: prev.params,
      navHistory: state.navHistory.slice(0, -1),
      focusIndex: 0,
    });
  },

  goHome: () => {
    soundEngine.playCue('back');
    set({
      screen: 'home',
      activeAppId: null,
      activeAppParams: undefined,
      navHistory: [],
      focusIndex: 0,
      notificationShadeOpen: false,
    });
  },

  setFocusIndex: (idx) => set({ focusIndex: idx }),
  setGridPage: (page) => set({ gridPage: page, focusIndex: 0 }),
  setSearchQuery: (q) => set({ searchQuery: q, gridPage: 0, focusIndex: 0 }),

  setSoftkeys: (cfg) => set({ softkeys: cfg }),

  dispatchKey: (cmd) => {
    const state = get();
    if (cmd === 'HOME') {
      state.goHome();
      return;
    }
    // Give newest subscribed listener first shot (e.g. active game or screen)
    const listeners = [...state.keyListeners].reverse();
    for (const listener of listeners) {
      const handled = listener(cmd);
      if (handled === true) return;
    }

    // Fallback global softkey handling
    if (cmd === 'SOFT_LEFT' && state.softkeys.onLeft) {
      soundEngine.playCue('click');
      state.softkeys.onLeft();
      return;
    }
    if (cmd === 'OK' && state.softkeys.onCenter) {
      soundEngine.playCue('select');
      state.softkeys.onCenter();
      return;
    }
    if ((cmd === 'SOFT_RIGHT' || cmd === 'BACK') && state.softkeys.onRight) {
      state.softkeys.onRight();
      return;
    }
    if (cmd === 'BACK' || cmd === 'SOFT_RIGHT') {
      state.goBack();
    }
  },

  subscribeKey: (listener) => {
    set((s) => ({ keyListeners: [...s.keyListeners, listener] }));
    return () => {
      set((s) => ({ keyListeners: s.keyListeners.filter((l) => l !== listener) }));
    };
  },

  setLanguage: (language) => {
    writeLocalPref('language', language);
    db.settings.put({ key: 'language', value: language }).catch(() => undefined);
    set({ language });
  },

  setTheme: (themeId) => {
    writeLocalPref('themeId', themeId);
    db.settings.put({ key: 'themeId', value: themeId }).catch(() => undefined);
    set({ themeId });
  },

  setWallpaper: (wallpaperId, customUrl) => {
    const nextCustom = customUrl !== undefined ? customUrl : null;
    writeLocalPref('wallpaperId', wallpaperId);
    writeLocalPref('customWallpaperUrl', nextCustom);
    db.settings.put({ key: 'wallpaperId', value: wallpaperId }).catch(() => undefined);
    set({ wallpaperId, customWallpaperUrl: nextCustom });
  },

  setBrightness: (brightness) => {
    const clamped = Math.max(0.55, Math.min(1.15, brightness));
    writeLocalPref('brightness', clamped);
    set({ brightness: clamped });
  },

  setPixelGrid: (pixelGrid) => {
    writeLocalPref('pixelGrid', pixelGrid);
    set({ pixelGrid });
  },

  setSoundEnabled: (soundEnabled) => {
    writeLocalPref('soundEnabled', soundEnabled);
    soundEngine.configure(soundEnabled, get().volume);
    set({ soundEnabled });
  },

  setVolume: (volume) => {
    const v = Math.max(0, Math.min(1, volume));
    writeLocalPref('volume', v);
    soundEngine.configure(get().soundEnabled, v);
    set({ volume: v });
  },

  setDesktopMode: (desktopMode) => {
    writeLocalPref('desktopMode', desktopMode);
    set({ desktopMode });
  },

  setQuickSlot: (slotIndex, appId) => {
    const next = [...get().quickSlotIds] as [string, string, string, string];
    next[slotIndex] = appId;
    writeLocalPref('quickSlotIds', next);
    set({ quickSlotIds: next });
  },

  setBatteryState: (level, charging) => {
    const clamped = Math.max(1, Math.min(100, level));
    writeLocalPref('batteryLevel', clamped);
    set((s) => ({
      batteryLevel: clamped,
      isCharging: charging !== undefined ? charging : s.isCharging,
    }));
  },

  setWifiEnabled: (wifiEnabled) => set({ wifiEnabled }),
  setHotspotEnabled: (hotspotEnabled) => set({ hotspotEnabled }),

  pushNotification: (title, body, appId) => {
    soundEngine.playCue('notify');
    const item: OSNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      appId,
      timestamp: Date.now(),
      read: false,
    };
    set((s) => ({ notifications: [item, ...s.notifications].slice(0, 20) }));
    get().showToast(`${title}: ${body}`);
  },

  markAllNotificationsRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

  clearNotifications: () => set({ notifications: [] }),

  toggleNotificationShade: (open) =>
    set((s) => {
      const next = open !== undefined ? open : !s.notificationShadeOpen;
      return {
        notificationShadeOpen: next,
        notifications: next ? s.notifications.map((n) => ({ ...n, read: true })) : s.notifications,
      };
    }),

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: msg });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
    }, 2600);
  },

  triggerAlarm: (alarm) => {
    soundEngine.playCue('alarm');
    set({ ringingAlarm: alarm });
    get().pushNotification('ALARM', `${alarm.time} · ${alarm.label}`, 'alarm');
  },

  dismissRingingAlarm: () => {
    soundEngine.stopChiptuneLoop();
    set({ ringingAlarm: null });
  },

  setRadioState: (patch) =>
    set((s) => ({
      radio: { ...s.radio, ...patch },
    })),
}));
