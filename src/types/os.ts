import type { ComponentType } from 'react';

export type LanguageCode = 'id' | 'en';

export type DesktopMode = 'chassis' | 'wide';

export type OSThemeId = 'classic' | 'amber' | 'paper' | 'mint' | 'inverted';

export type WallpaperId = 'village' | 'mountains' | 'skyline' | 'sunrise' | 'night' | 'grid';

export type AppCategoryId =
  | 'communication'
  | 'multimedia'
  | 'productivity'
  | 'internet'
  | 'entertainment'
  | 'system';

export type PixelIconName =
  | 'message'
  | 'phone'
  | 'contacts'
  | 'groups'
  | 'email'
  | 'chat'
  | 'gallery'
  | 'music'
  | 'video'
  | 'videoEditor'
  | 'photoEditor'
  | 'camera'
  | 'radio'
  | 'tv'
  | 'studio'
  | 'mic'
  | 'folder'
  | 'note'
  | 'calendar'
  | 'clock'
  | 'alarm'
  | 'calculator'
  | 'reminder'
  | 'browser'
  | 'download'
  | 'share'
  | 'hotspot'
  | 'vpn'
  | 'cloud'
  | 'sync'
  | 'game'
  | 'snake'
  | 'tetris'
  | 'puzzle'
  | 'tamagotchi'
  | 'book'
  | 'comic'
  | 'wallpaper'
  | 'apps'
  | 'theme'
  | 'display'
  | 'sound'
  | 'storage'
  | 'battery'
  | 'settings'
  | 'terminal'
  | 'info'
  | 'manual'
  | 'profile'
  | 'wifi'
  | 'signal'
  | 'bell'
  | 'sunCloud'
  | 'search'
  | 'chevronLeft'
  | 'chevronRight'
  | 'play'
  | 'pause'
  | 'prev'
  | 'next'
  | 'plus'
  | 'trash'
  | 'check'
  | 'volume'
  | 'lock';

export type OSScreenType = 'home' | 'grid' | 'categories' | 'category-list' | 'app';

export type KeyCommand =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'OK'
  | 'SOFT_LEFT'
  | 'SOFT_RIGHT'
  | 'BACK'
  | 'HOME';

export interface AppLaunchParams {
  tab?: string;
  contactId?: number;
  phoneNumber?: string;
  folder?: string;
  noteId?: number;
  fileId?: number;
  textContent?: string;
  title?: string;
  url?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface AppComponentProps {
  appId: string;
  params?: AppLaunchParams;
  onBack: () => void;
}

export interface AppDefinition {
  id: string;
  nameId: string;
  nameEn: string;
  category: AppCategoryId;
  icon: PixelIconName;
  component: ComponentType<AppComponentProps>;
  featuredInGrid?: boolean;
}

export interface SoftkeyConfig {
  leftLabel?: string;
  centerLabel?: string;
  rightLabel?: string;
  onLeft?: () => void;
  onCenter?: () => void;
  onRight?: () => void;
}

export interface OSNotification {
  id: string;
  title: string;
  body: string;
  appId?: string;
  timestamp: number;
  read: boolean;
}

export interface OSThemeDefinition {
  id: OSThemeId;
  nameId: string;
  nameEn: string;
  bg: string;
  fg: string;
  sec: string;
}

// Dexie Database Entities
export interface ContactRecord {
  id?: number;
  name: string;
  phone: string;
  group: string;
  favorite?: boolean;
}

export interface MessageRecord {
  id?: number;
  threadId: string;
  contactName: string;
  phone: string;
  body: string;
  timestamp: number;
  unread: boolean;
  isOutgoing: boolean;
}

export interface CallLogRecord {
  id?: number;
  contactName: string;
  phone: string;
  direction: 'outgoing' | 'incoming' | 'missed';
  durationSec: number;
  timestamp: number;
}

export interface NoteRecord {
  id?: number;
  title: string;
  body: string;
  updatedAt: number;
}

export interface CalendarEventRecord {
  id?: number;
  dateKey: string; // YYYY-MM-DD
  title: string;
  time: string;
  description?: string;
}

export interface AlarmRecord {
  id?: number;
  time: string; // HH:mm
  label: string;
  enabled: boolean;
  days: string;
}

export interface ReminderRecord {
  id?: number;
  text: string;
  done: boolean;
  due: string;
}

export interface VirtualFileRecord {
  id?: number;
  folder: 'DCIM' | 'Download' | 'Musik' | 'Video' | 'Dokumen' | 'Lainnya';
  name: string;
  mimeType: string;
  sizeKb: number;
  content: string;
  createdAt: number;
}

export interface BookmarkRecord {
  id?: number;
  title: string;
  url: string;
  summary: string;
}

export interface BrowserHistoryRecord {
  id?: number;
  title: string;
  url: string;
  visitedAt: number;
}

export interface GameScoreRecord {
  id?: number;
  gameId: 'snake' | 'tetris' | 'puzzle' | 'tamagotchi';
  score: number;
  level: number;
  achievedAt: number;
}

export interface RecentAppRecord {
  appId: string;
  launchedAt: number;
  launchCount: number;
}

export interface OSSettingsRecord {
  key: string;
  value: string;
}

export interface EmailRecord {
  id?: number;
  folder: 'inbox' | 'sent';
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: number;
  unread: boolean;
}

export interface GroupRecord {
  id?: number;
  threadId: string;
  name: string;
  members: number;
  topic: string;
}

export interface ChatMessageRecord {
  id?: number;
  room: string;
  sender: string;
  text: string;
  timestamp: number;
  isSelf?: boolean;
}

export interface DownloadRecord {
  id?: number;
  name: string;
  url: string;
  sizeKb: number;
  mimeType: string;
  status: 'downloading' | 'completed' | 'failed';
  progress: number;
  fileId?: number;
  createdAt: number;
}

export type TamagotchiStage = 'egg' | 'baby' | 'child' | 'teen' | 'adult' | 'angel';

export type TamagotchiEvolutionId = 'angel_star' | 'sporty_fox' | 'chubby_dino' | 'rebel_bat';

export type TamagotchiAttentionReason =
  | 'sick'
  | 'lights'
  | 'hungry'
  | 'poop'
  | 'sad'
  | 'misbehave'
  | null;

export interface TamagotchiGenerationEntry {
  generation: number;
  name: string;
  evolutionId: TamagotchiEvolutionId | null;
  ageHours: number;
  careMistakes: number;
  outcome: 'evolved' | 'angel' | 'reset';
  endedAt: number;
}

export interface TamagotchiPetState {
  generation: number;
  name: string;
  stage: TamagotchiStage;
  evolutionId: TamagotchiEvolutionId | null;
  hunger: number; // 0..4
  happiness: number; // 0..4
  discipline: number; // 0..4
  hygiene: number; // 0..4
  energy: number; // 0..100
  weightGr: number;
  ageMinutes: number;
  poopCount: number; // 0..4
  isSick: boolean;
  sickTicks: number;
  lightsOn: boolean;
  isSleeping: boolean;
  careMistakes: number;
  snacksEaten: number;
  gamesPlayed: number;
  attentionReason: TamagotchiAttentionReason;
  lastAlertKey: string;
  speedMultiplier: 1 | 4 | 16;
  paused: boolean;
  eggProgressSec: number;
  bornAt: number;
  lastTickAt: number;
  unlockedEvolutions: TamagotchiEvolutionId[];
  history: TamagotchiGenerationEntry[];
}

