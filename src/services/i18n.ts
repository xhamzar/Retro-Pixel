import type { AppCategoryId, LanguageCode } from '@/src/types/os';

export const CATEGORY_LABELS: Record<AppCategoryId, { id: string; en: string }> = {
  communication: { id: 'Komunikasi', en: 'Communication' },
  multimedia: { id: 'Multimedia', en: 'Multimedia' },
  productivity: { id: 'Produktivitas', en: 'Productivity' },
  internet: { id: 'Internet', en: 'Internet' },
  entertainment: { id: 'Hiburan & Game', en: 'Entertainment' },
  system: { id: 'Sistem', en: 'System' },
};

export const UI_STRINGS = {
  id: {
    appsTitle: 'Aplikasi',
    categoriesTitle: 'Kategori',
    searchApps: 'Cari aplikasi...',
    noAppsFound: 'Aplikasi tidak ditemukan',
    softkeyOptions: 'Opsi',
    softkeySelect: 'Pilih',
    softkeyOk: 'OK',
    softkeyBack: 'Kembali',
    softkeyMenu: 'Menu',
    softkeyNew: 'Baru',
    softkeyOpen: 'Buka',
    softkeyAdd: 'Tambah',
    softkeyCall: 'Panggil',
    softkeyApply: 'Terapkan',
    softkeyList: 'Daftar',
    softkeySave: 'Simpan',
    softkeyDelete: 'Hapus',
    softkeySend: 'Kirim',
    homeTip: 'Tekan Menu atau klik ikon bawah',
    notifications: 'Notifikasi',
    noNotifications: 'Tidak ada notifikasi baru',
    clearAll: 'Bersihkan',
    offlineBanner: 'Mode Offline (Data Tersimpan Lokal)',
    onlineStatus: 'Online',
    offlineStatus: 'Offline',
    weatherLabel: 'Cerah Berawan',
    displayModeChassis: 'Mode Ponsel',
    displayModeWide: 'Mode Layar Lebar',
    soundOn: 'Suara Aktif',
    soundMuted: 'Suara Bisu',
    installApp: 'Pasang PWA',
    keyboardHelp: 'Navigasi Keyboard: Panah = Arah, Enter = OK, Esc = Kembali',
    quickAccess: 'Akses Cepat',
    recentApps: 'Baru Dibuka',
    desktopWorkspace: 'Ruang Kerja LCD',
  },
  en: {
    appsTitle: 'Applications',
    categoriesTitle: 'Categories',
    searchApps: 'Search apps...',
    noAppsFound: 'No applications found',
    softkeyOptions: 'Options',
    softkeySelect: 'Select',
    softkeyOk: 'OK',
    softkeyBack: 'Back',
    softkeyMenu: 'Menu',
    softkeyNew: 'New',
    softkeyOpen: 'Open',
    softkeyAdd: 'Add',
    softkeyCall: 'Call',
    softkeyApply: 'Apply',
    softkeyList: 'List',
    softkeySave: 'Save',
    softkeyDelete: 'Delete',
    softkeySend: 'Send',
    homeTip: 'Press Menu or tap quick shortcuts',
    notifications: 'Notifications',
    noNotifications: 'No new notifications',
    clearAll: 'Clear All',
    offlineBanner: 'Offline Mode (Local Storage Active)',
    onlineStatus: 'Online',
    offlineStatus: 'Offline',
    weatherLabel: 'Partly Cloudy',
    displayModeChassis: 'Phone Frame',
    displayModeWide: 'Wide LCD',
    soundOn: 'Sound On',
    soundMuted: 'Muted',
    installApp: 'Install PWA',
    keyboardHelp: 'Keyboard: Arrows = Move, Enter = OK, Esc = Back',
    quickAccess: 'Quick Access',
    recentApps: 'Recent Apps',
    desktopWorkspace: 'LCD Workspace',
  },
} as const;

export function t(lang: LanguageCode, key: keyof typeof UI_STRINGS.id): string {
  return UI_STRINGS[lang][key];
}

export function formatRetroDate(date: Date, lang: LanguageCode): string {
  const daysId = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const d = date.getDate();
  const y = date.getFullYear();
  if (lang === 'id') {
    return `${daysId[date.getDay()]}, ${d} ${months[date.getMonth()]} ${y}`;
  }
  return `${daysEn[date.getDay()]}, ${monthsEn[date.getMonth()]} ${d}, ${y}`;
}
