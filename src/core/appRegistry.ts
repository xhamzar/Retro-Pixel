'use client';

import { lazy } from 'react';
import type { AppCategoryId, AppDefinition } from '@/src/types/os';

const MessagesApp = lazy(() => import('@/src/apps/messages/MessagesApp').then((m) => ({ default: m.MessagesApp })));
const PhoneApp = lazy(() => import('@/src/apps/phone/PhoneApp').then((m) => ({ default: m.PhoneApp })));
const ContactsApp = lazy(() => import('@/src/apps/contacts/ContactsApp').then((m) => ({ default: m.ContactsApp })));
const GroupsApp = lazy(() => import('@/src/apps/communication/CommunicationApps').then((m) => ({ default: m.GroupsApp })));
const EmailApp = lazy(() => import('@/src/apps/communication/CommunicationApps').then((m) => ({ default: m.EmailApp })));
const ChatApp = lazy(() => import('@/src/apps/communication/CommunicationApps').then((m) => ({ default: m.ChatApp })));

const GalleryApp = lazy(() => import('@/src/apps/gallery/GalleryApp').then((m) => ({ default: m.GalleryApp })));
const MusicApp = lazy(() => import('@/src/apps/music/MusicApp').then((m) => ({ default: m.MusicApp })));
const AudioStudioApp = lazy(() => import('@/src/apps/music/AudioStudioApp').then((m) => ({ default: m.AudioStudioApp })));
const VideoPlayerApp = lazy(() => import('@/src/apps/multimedia/MultimediaApps').then((m) => ({ default: m.VideoPlayerApp })));
const VideoEditorApp = lazy(() => import('@/src/apps/multimedia/VideoEditorApp').then((m) => ({ default: m.VideoEditorApp })));
const PhotoEditorApp = lazy(() => import('@/src/apps/multimedia/PhotoEditorApp').then((m) => ({ default: m.PhotoEditorApp })));
const CameraApp = lazy(() => import('@/src/apps/multimedia/MultimediaApps').then((m) => ({ default: m.CameraApp })));
const RadioApp = lazy(() => import('@/src/apps/multimedia/RadioApp').then((m) => ({ default: m.RadioApp })));
const TVApp = lazy(() => import('@/src/apps/multimedia/TVApp').then((m) => ({ default: m.TVApp })));
const VoiceRecorderApp = lazy(() => import('@/src/apps/multimedia/MultimediaApps').then((m) => ({ default: m.VoiceRecorderApp })));

const FileManagerApp = lazy(() => import('@/src/apps/files/FileManagerApp').then((m) => ({ default: m.FileManagerApp })));
const NotesApp = lazy(() => import('@/src/apps/notes/NotesApp').then((m) => ({ default: m.NotesApp })));
const CalendarApp = lazy(() => import('@/src/apps/calendar/CalendarApp').then((m) => ({ default: m.CalendarApp })));
const ClockApp = lazy(() => import('@/src/apps/clock/ClockApps').then((m) => ({ default: m.ClockApp })));
const AlarmApp = lazy(() => import('@/src/apps/clock/ClockApps').then((m) => ({ default: m.AlarmApp })));
const CalculatorApp = lazy(() => import('@/src/apps/calculator/CalculatorApp').then((m) => ({ default: m.CalculatorApp })));
const RemindersApp = lazy(() => import('@/src/apps/clock/ClockApps').then((m) => ({ default: m.RemindersApp })));

const BrowserApp = lazy(() => import('@/src/apps/internet/InternetApps').then((m) => ({ default: m.BrowserApp })));
const PixelMapsApp = lazy(() => import('@/src/apps/internet/PixelMapsApp').then((m) => ({ default: m.PixelMapsApp })));
const DownloadsApp = lazy(() => import('@/src/apps/internet/InternetApps').then((m) => ({ default: m.DownloadsApp })));
const SharingApp = lazy(() => import('@/src/apps/internet/InternetApps').then((m) => ({ default: m.SharingApp })));
const HotspotApp = lazy(() => import('@/src/apps/internet/InternetApps').then((m) => ({ default: m.HotspotApp })));
const NetworkApp = lazy(() => import('@/src/apps/internet/InternetApps').then((m) => ({ default: m.NetworkApp })));
const CloudApp = lazy(() => import('@/src/apps/internet/InternetApps').then((m) => ({ default: m.CloudApp })));

const GamesHubApp = lazy(() => import('@/src/apps/games/GamesApps').then((m) => ({ default: m.GamesHubApp })));
const SnakeGameApp = lazy(() => import('@/src/apps/games/GamesApps').then((m) => ({ default: m.SnakeGameApp })));
const TetrisGameApp = lazy(() => import('@/src/apps/games/GamesApps').then((m) => ({ default: m.TetrisGameApp })));
const PuzzleGameApp = lazy(() => import('@/src/apps/games/GamesApps').then((m) => ({ default: m.PuzzleGameApp })));
const TamagotchiApp = lazy(() => import('@/src/apps/games/TamagotchiApp').then((m) => ({ default: m.TamagotchiApp })));
const EbookReaderApp = lazy(() => import('@/src/apps/games/GamesApps').then((m) => ({ default: m.EbookReaderApp })));
const ComicsApp = lazy(() => import('@/src/apps/games/GamesApps').then((m) => ({ default: m.ComicsApp })));
const WallpaperGalleryApp = lazy(() => import('@/src/apps/games/GamesApps').then((m) => ({ default: m.WallpaperGalleryApp })));

const AppManagerApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.AppManagerApp })));
const ThemesApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.ThemesApp })));
const DisplaySettingsApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.DisplaySettingsApp })));
const SoundSettingsApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.SoundSettingsApp })));
const StorageApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.StorageApp })));
const BatteryApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.BatteryApp })));
const SettingsApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.SettingsApp })));
const AboutOSApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.AboutOSApp })));
const OSDocsApp = lazy(() => import('@/src/apps/system/SystemApps').then((m) => ({ default: m.OSDocsApp })));
const TerminalApp = lazy(() => import('@/src/apps/system/TerminalApp').then((m) => ({ default: m.TerminalApp })));

export const APP_CATEGORIES: { id: AppCategoryId; icon: AppDefinition['icon'] }[] = [
  { id: 'communication', icon: 'chat' },
  { id: 'multimedia', icon: 'gallery' },
  { id: 'productivity', icon: 'note' },
  { id: 'internet', icon: 'browser' },
  { id: 'entertainment', icon: 'game' },
  { id: 'system', icon: 'settings' },
];

export const APP_REGISTRY: AppDefinition[] = [
  // 1. COMMUNICATION
  { id: 'messages', nameId: 'Pesan', nameEn: 'Messages', category: 'communication', icon: 'message', component: MessagesApp, featuredInGrid: true },
  { id: 'phone', nameId: 'Panggilan', nameEn: 'Phone', category: 'communication', icon: 'phone', component: PhoneApp, featuredInGrid: true },
  { id: 'contacts', nameId: 'Kontak', nameEn: 'Contacts', category: 'communication', icon: 'contacts', component: ContactsApp },
  { id: 'groups', nameId: 'Grup', nameEn: 'Groups', category: 'communication', icon: 'groups', component: GroupsApp },
  { id: 'email', nameId: 'Email', nameEn: 'Email', category: 'communication', icon: 'email', component: EmailApp },
  { id: 'chat', nameId: 'Chat', nameEn: 'Chat', category: 'communication', icon: 'chat', component: ChatApp },

  // 2. MULTIMEDIA
  { id: 'gallery', nameId: 'Galeri', nameEn: 'Gallery', category: 'multimedia', icon: 'gallery', component: GalleryApp },
  { id: 'music', nameId: 'Musik', nameEn: 'Music', category: 'multimedia', icon: 'music', component: MusicApp, featuredInGrid: true },
  { id: 'audio-studio', nameId: 'Studio Audio', nameEn: 'Audio Studio', category: 'multimedia', icon: 'studio', component: AudioStudioApp, featuredInGrid: true },
  { id: 'tv', nameId: 'TV Live', nameEn: 'Live TV', category: 'multimedia', icon: 'tv', component: TVApp, featuredInGrid: true },
  { id: 'video-editor', nameId: 'Editor Video', nameEn: 'Video Editor', category: 'multimedia', icon: 'videoEditor', component: VideoEditorApp, featuredInGrid: true },
  { id: 'photo-editor', nameId: 'Editor Foto', nameEn: 'Photo Editor', category: 'multimedia', icon: 'photoEditor', component: PhotoEditorApp, featuredInGrid: true },
  { id: 'video', nameId: 'Video', nameEn: 'Video', category: 'multimedia', icon: 'video', component: VideoPlayerApp },
  { id: 'camera', nameId: 'Kamera', nameEn: 'Camera', category: 'multimedia', icon: 'camera', component: CameraApp },
  { id: 'radio', nameId: 'Radio Dunia', nameEn: 'World Radio', category: 'multimedia', icon: 'radio', component: RadioApp, featuredInGrid: true },
  { id: 'recorder', nameId: 'Perekam', nameEn: 'Recorder', category: 'multimedia', icon: 'mic', component: VoiceRecorderApp },

  // 3. PRODUCTIVITY
  { id: 'files', nameId: 'Berkas', nameEn: 'Files', category: 'productivity', icon: 'folder', component: FileManagerApp },
  { id: 'notes', nameId: 'Catatan', nameEn: 'Notes', category: 'productivity', icon: 'note', component: NotesApp },
  { id: 'calendar', nameId: 'Kalender', nameEn: 'Calendar', category: 'productivity', icon: 'calendar', component: CalendarApp },
  { id: 'clock', nameId: 'Jam', nameEn: 'Clock', category: 'productivity', icon: 'clock', component: ClockApp },
  { id: 'alarm', nameId: 'Alarm', nameEn: 'Alarm', category: 'productivity', icon: 'alarm', component: AlarmApp },
  { id: 'calculator', nameId: 'Kalkulator', nameEn: 'Calculator', category: 'productivity', icon: 'calculator', component: CalculatorApp },
  { id: 'reminders', nameId: 'Pengingat', nameEn: 'Reminders', category: 'productivity', icon: 'reminder', component: RemindersApp },

  // 4. INTERNET
  { id: 'browser', nameId: 'Browser', nameEn: 'Browser', category: 'internet', icon: 'browser', component: BrowserApp, featuredInGrid: true },
  { id: 'maps', nameId: 'Peta GPS', nameEn: 'Pixel Maps', category: 'internet', icon: 'maps', component: PixelMapsApp, featuredInGrid: true },
  { id: 'downloads', nameId: 'Unduhan', nameEn: 'Downloads', category: 'internet', icon: 'download', component: DownloadsApp },
  { id: 'sharing', nameId: 'Berbagi', nameEn: 'Sharing', category: 'internet', icon: 'share', component: SharingApp },
  { id: 'hotspot', nameId: 'Hotspot', nameEn: 'Hotspot', category: 'internet', icon: 'hotspot', component: HotspotApp },
  { id: 'vpn', nameId: 'VPN', nameEn: 'VPN', category: 'internet', icon: 'vpn', component: NetworkApp },
  { id: 'network', nameId: 'Jaringan', nameEn: 'Network', category: 'internet', icon: 'wifi', component: NetworkApp },
  { id: 'cloud', nameId: 'Cloud', nameEn: 'Cloud', category: 'internet', icon: 'cloud', component: CloudApp },
  { id: 'sync', nameId: 'Sinkronisasi', nameEn: 'Sync', category: 'internet', icon: 'sync', component: NetworkApp },

  // 5. ENTERTAINMENT
  { id: 'games', nameId: 'Game', nameEn: 'Games', category: 'entertainment', icon: 'game', component: GamesHubApp },
  { id: 'tamagotchi', nameId: 'Tamagotchi', nameEn: 'Tamagotchi', category: 'entertainment', icon: 'tamagotchi', component: TamagotchiApp, featuredInGrid: true },
  { id: 'snake', nameId: 'Snake', nameEn: 'Snake', category: 'entertainment', icon: 'snake', component: SnakeGameApp },
  { id: 'tetris', nameId: 'Tetris', nameEn: 'Tetris', category: 'entertainment', icon: 'tetris', component: TetrisGameApp },
  { id: 'puzzle', nameId: 'Puzzle', nameEn: 'Puzzle', category: 'entertainment', icon: 'puzzle', component: PuzzleGameApp },
  { id: 'ebook', nameId: 'Baca', nameEn: 'E-Book', category: 'entertainment', icon: 'book', component: EbookReaderApp },
  { id: 'comics', nameId: 'Komik', nameEn: 'Comics', category: 'entertainment', icon: 'comic', component: ComicsApp },
  { id: 'wallpaper', nameId: 'Wallpaper', nameEn: 'Wallpaper', category: 'entertainment', icon: 'wallpaper', component: WallpaperGalleryApp },

  // 6. SYSTEM
  { id: 'terminal', nameId: 'Terminal', nameEn: 'Terminal', category: 'system', icon: 'terminal', component: TerminalApp, featuredInGrid: true },
  { id: 'app-manager', nameId: 'Aplikasi', nameEn: 'Apps', category: 'system', icon: 'apps', component: AppManagerApp },
  { id: 'themes', nameId: 'Tema', nameEn: 'Themes', category: 'system', icon: 'theme', component: ThemesApp },
  { id: 'display', nameId: 'Tampilan', nameEn: 'Display', category: 'system', icon: 'display', component: DisplaySettingsApp },
  { id: 'sound', nameId: 'Suara', nameEn: 'Sound', category: 'system', icon: 'sound', component: SoundSettingsApp },
  { id: 'storage', nameId: 'Penyimpanan', nameEn: 'Storage', category: 'system', icon: 'storage', component: StorageApp },
  { id: 'battery', nameId: 'Baterai', nameEn: 'Battery', category: 'system', icon: 'battery', component: BatteryApp },
  { id: 'docs', nameId: 'Panduan OS', nameEn: 'OS Guide', category: 'system', icon: 'manual', component: OSDocsApp },
  { id: 'about', nameId: 'Tentang OS', nameEn: 'About OS', category: 'system', icon: 'info', component: AboutOSApp },
  { id: 'settings', nameId: 'Pengaturan', nameEn: 'Settings', category: 'system', icon: 'settings', component: SettingsApp },
];

export function getAppById(id: string): AppDefinition | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}

export function getAppsByCategory(category: AppCategoryId): AppDefinition[] {
  return APP_REGISTRY.filter((app) => app.category === category);
}
