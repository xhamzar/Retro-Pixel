import Dexie, { type Table } from 'dexie';
import { buildSeededDocumentFiles } from '@/src/services/osDocs';
import type {
  AlarmRecord,
  BookmarkRecord,
  BrowserHistoryRecord,
  CalendarEventRecord,
  CallLogRecord,
  ChatMessageRecord,
  ContactRecord,
  DownloadRecord,
  EmailRecord,
  GameScoreRecord,
  GroupRecord,
  MessageRecord,
  NoteRecord,
  OSSettingsRecord,
  RecentAppRecord,
  ReminderRecord,
  VirtualFileRecord,
} from '@/src/types/os';

class RetroPixelDatabase extends Dexie {
  contacts!: Table<ContactRecord, number>;
  messages!: Table<MessageRecord, number>;
  callLogs!: Table<CallLogRecord, number>;
  notes!: Table<NoteRecord, number>;
  events!: Table<CalendarEventRecord, number>;
  alarms!: Table<AlarmRecord, number>;
  reminders!: Table<ReminderRecord, number>;
  files!: Table<VirtualFileRecord, number>;
  bookmarks!: Table<BookmarkRecord, number>;
  history!: Table<BrowserHistoryRecord, number>;
  scores!: Table<GameScoreRecord, number>;
  recentApps!: Table<RecentAppRecord, string>;
  settings!: Table<OSSettingsRecord, string>;
  emails!: Table<EmailRecord, number>;
  groups!: Table<GroupRecord, number>;
  chatMessages!: Table<ChatMessageRecord, number>;
  downloads!: Table<DownloadRecord, number>;

  constructor() {
    super('RetroPixelOSDB');
    this.version(1).stores({
      contacts: '++id, name, phone, group',
      messages: '++id, threadId, phone, timestamp, unread',
      callLogs: '++id, phone, direction, timestamp',
      notes: '++id, title, updatedAt',
      events: '++id, dateKey, time',
      alarms: '++id, time, enabled',
      reminders: '++id, done, due',
      files: '++id, folder, name, createdAt',
      bookmarks: '++id, url',
      history: '++id, visitedAt',
      scores: '++id, gameId, score, achievedAt',
      recentApps: 'appId, launchedAt',
      settings: 'key',
    });

    this.version(2).stores({
      contacts: '++id, name, phone, group',
      messages: '++id, threadId, phone, timestamp, unread',
      callLogs: '++id, phone, direction, timestamp',
      notes: '++id, title, updatedAt',
      events: '++id, dateKey, time',
      alarms: '++id, time, enabled',
      reminders: '++id, done, due',
      files: '++id, folder, name, createdAt',
      bookmarks: '++id, url',
      history: '++id, visitedAt',
      scores: '++id, gameId, score, achievedAt',
      recentApps: 'appId, launchedAt',
      settings: 'key',
      emails: '++id, folder, timestamp, unread',
      groups: '++id, threadId, name',
      chatMessages: '++id, room, timestamp',
      downloads: '++id, createdAt, status',
    });
  }
}

export const db = new RetroPixelDatabase();

let seedPromise: Promise<void> | null = null;

export async function ensureDatabaseSeeded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const contactCount = await db.contacts.count();
    if (contactCount === 0) {
      await db.contacts.bulkAdd([
        { name: 'Ayah', phone: '+62 811-2001-101', group: 'Keluarga', favorite: true },
        { name: 'Ibu', phone: '+62 811-2001-102', group: 'Keluarga', favorite: true },
        { name: 'Kakak', phone: '+62 812-3400-201', group: 'Keluarga', favorite: false },
        { name: 'Adik', phone: '+62 813-5500-301', group: 'Keluarga', favorite: false },
        { name: 'Teman A', phone: '+62 812-3456-789', group: 'Teman', favorite: true },
        { name: 'Teman B', phone: '+62 856-9876-543', group: 'Teman', favorite: false },
      ]);
    }

    const msgCount = await db.messages.count();
    if (msgCount === 0) {
      const now = Date.now();
      await db.messages.bulkAdd([
        {
          threadId: 'system',
          contactName: 'Sistem',
          phone: '0000',
          body: 'Pembaharuan tersedia untuk Retro Pixel OS v2.4. Semua modul lokal berjalan optimal.',
          timestamp: now - 1000 * 60 * 15,
          unread: true,
          isOutgoing: false,
        },
        {
          threadId: '+62 811-2001-102',
          contactName: 'Ibu',
          phone: '+62 811-2001-102',
          body: 'Jangan lupa makan siang ya, nanti sore pulang jam berapa?',
          timestamp: now - 1000 * 60 * 65,
          unread: true,
          isOutgoing: false,
        },
        {
          threadId: '+62 812-3456-789',
          contactName: 'Teman A',
          phone: '+62 812-3456-789',
          body: 'Game Snake nanti sore? Rekor aku sudah tembus 180 poin!',
          timestamp: now - 1000 * 60 * 95,
          unread: false,
          isOutgoing: false,
        },
        {
          threadId: 'grup-kelas',
          contactName: 'Grup Kelas',
          phone: 'GRUP-01',
          body: 'Jadwal ulangan praktikum dipindah ke hari Rabu pukul 09:00.',
          timestamp: now - 1000 * 60 * 60 * 20,
          unread: false,
          isOutgoing: false,
        },
        {
          threadId: 'grup-keluarga',
          contactName: 'Keluarga',
          phone: 'GRUP-02',
          body: 'Acara makan malam minggu ini jam 19:00 ya.',
          timestamp: now - 1000 * 60 * 60 * 10,
          unread: false,
          isOutgoing: false,
        },
      ]);
    }

    const groupCount = await db.groups.count();
    if (groupCount === 0) {
      await db.groups.bulkAdd([
        { threadId: 'grup-keluarga', name: 'Keluarga', members: 4, topic: 'Koordinasi acara akhir pekan' },
        { threadId: 'grup-kelas', name: 'Grup Kelas', members: 28, topic: 'Jadwal praktikum & catatan' },
        { threadId: 'grup-pixel', name: 'Komunitas Pixel', members: 14, topic: 'Berbagi skor Snake & Tetris' },
      ]);
    }

    const emailCount = await db.emails.count();
    if (emailCount === 0) {
      const now = Date.now();
      await db.emails.bulkAdd([
        {
          folder: 'inbox',
          from: 'admin@retropixel.local',
          to: 'user@retropixel.local',
          subject: 'Selamat Datang di Retro Pixel OS',
          body: 'Semua layanan pesan lokal, kontak, catatan, browser, dan utilitas perangkat Anda siap digunakan secara penuh.',
          timestamp: now - 1000 * 60 * 120,
          unread: true,
        },
        {
          folder: 'inbox',
          from: 'cuaca@stasiun.local',
          to: 'user@retropixel.local',
          subject: 'Ringkasan Cuaca Mingguan',
          body: 'Suhu rata-rata 28°C dengan kondisi cerah berawan di wilayah Anda.',
          timestamp: now - 1000 * 60 * 60 * 24,
          unread: false,
        },
      ]);
    }

    const chatCount = await db.chatMessages.count();
    if (chatCount === 0) {
      await db.chatMessages.add({
        room: 'lobby',
        sender: 'Sistem',
        text: 'Ruang obrolan lokal & lintas-tab aktif. Buka tab browser lain untuk menguji pesan real-time antar tab!',
        timestamp: Date.now() - 1000 * 60 * 5,
        isSelf: false,
      });
    }

    const callCount = await db.callLogs.count();
    if (callCount === 0) {
      const now = Date.now();
      await db.callLogs.bulkAdd([
        { contactName: 'Ibu', phone: '+62 811-2001-102', direction: 'outgoing', durationSec: 184, timestamp: now - 1000 * 60 * 120 },
        { contactName: 'Ayah', phone: '+62 811-2001-101', direction: 'incoming', durationSec: 95, timestamp: now - 1000 * 60 * 420 },
        { contactName: 'Teman A', phone: '+62 812-3456-789', direction: 'missed', durationSec: 0, timestamp: now - 1000 * 60 * 60 * 18 },
        { contactName: '+62 812-3456', phone: '+62 812-3456', direction: 'incoming', durationSec: 42, timestamp: now - 1000 * 60 * 60 * 24 },
      ]);
    }

    const noteCount = await db.notes.count();
    if (noteCount === 0) {
      const now = Date.now();
      await db.notes.bulkAdd([
        {
          title: 'Daftar Belanja',
          body: '- Baterai AA 2 pasang\n- Kertas catatan saku\n- Kabel data retro\n- Kopi hitam',
          updatedAt: now - 1000 * 60 * 180,
        },
        {
          title: 'Ide Mini Game',
          body: 'Buat level bonus di Snake dan simpan skor tertinggi otomatis ke IndexedDB lokal.',
          updatedAt: now - 1000 * 60 * 60 * 24,
        },
      ]);
    }

    const eventCount = await db.events.count();
    if (eventCount === 0) {
      const todayKey = new Date().toISOString().slice(0, 10);
      await db.events.bulkAdd([
        { dateKey: '2026-11-15', title: 'Peluncuran Retro Pixel OS', time: '16:24', description: 'Uji coba mode layar monokrom' },
        { dateKey: todayKey, title: 'Cek Jadwal Harian', time: '10:00', description: 'Sinkronisasi catatan & pengingat lokal' },
      ]);
    }

    const alarmCount = await db.alarms.count();
    if (alarmCount === 0) {
      await db.alarms.bulkAdd([
        { time: '05:30', label: 'Bangun Pagi', enabled: true, days: 'Sen-Jum' },
        { time: '12:00', label: 'Istirahat Siang', enabled: false, days: 'Setiap Hari' },
        { time: '21:00', label: 'Mode Tidur LCD', enabled: true, days: 'Setiap Hari' },
      ]);
    }

    const reminderCount = await db.reminders.count();
    if (reminderCount === 0) {
      await db.reminders.bulkAdd([
        { text: 'Balas pesan dari Ibu', done: false, due: 'Hari ini' },
        { text: 'Cek skor tertinggi Tetris', done: false, due: 'Sore ini' },
        { text: 'Cadangkan catatan ke Cloud', done: true, due: 'Kemarin' },
      ]);
    }

    const fileCount = await db.files.count();
    if (fileCount === 0) {
      const now = Date.now();
      await db.files.bulkAdd([
        { folder: 'DCIM', name: 'Pemandangan_Desa.px', mimeType: 'image/pixel', sizeKb: 14, content: 'wallpaper:village', createdAt: now - 86400000 },
        { folder: 'DCIM', name: 'Puncak_Gunung.px', mimeType: 'image/pixel', sizeKb: 12, content: 'wallpaper:mountains', createdAt: now - 72000000 },
        { folder: 'Musik', name: 'Lagu_Favorit.chip', mimeType: 'audio/chiptune', sizeKb: 8, content: 'track:0', createdAt: now - 64000000 },
        { folder: 'Musik', name: 'Melodi_Saku.chip', mimeType: 'audio/chiptune', sizeKb: 6, content: 'track:1', createdAt: now - 54000000 },
        { folder: 'Download', name: 'Panduan_Pixel_OS.txt', mimeType: 'text/plain', sizeKb: 4, content: 'Selamat datang di Retro Pixel OS.\n\nTips:\n- Gunakan tombol panah atau D-Pad untuk navigasi cepat.\n- Kamera, Perekam Suara, Pemutar Musik, Video, dan E-Book mendukung berkas nyata dari perangkat Anda.\n- Gunakan Cloud untuk mengekspor dan memulihkan cadangan seluruh data OS.', createdAt: now - 40000000 },
        { folder: 'Dokumen', name: 'demo_os.sh', mimeType: 'text/plain', sizeKb: 1, content: '# Skrip Demo Retro Pixel OS\necho === CEK SISTEM PIXEL OS ===\nwhoami\ndf\nnotes\nsound beep 880 70', createdAt: now - 25000000 },
        { folder: 'Video', name: 'Animasi_Bintang.pxv', mimeType: 'video/pixel', sizeKb: 28, content: 'clip:stars', createdAt: now - 20000000 },
        { folder: 'Lainnya', name: 'System_Config.cfg', mimeType: 'text/config', sizeKb: 2, content: 'DISPLAY=MONOCHROME_2BIT\nREFRESH=60HZ\nSOUND=PIEZO', createdAt: now - 10000000 },
      ]);
    }

    // Ensure complete official OS documentation files exist in Dokumen (non-destructive)
    const existingDocs = await db.files.where('folder').equals('Dokumen').toArray();
    const docSpecs = buildSeededDocumentFiles();
    const docTimestamp = Date.now();
    for (let i = 0; i < docSpecs.length; i += 1) {
      const spec = docSpecs[i];
      const existing = existingDocs.find((f) => f.name === spec.name);
      const sizeKb = Math.max(1, Math.ceil(spec.content.length / 1024));
      if (!existing) {
        await db.files.add({
          folder: 'Dokumen',
          name: spec.name,
          mimeType: 'text/plain',
          sizeKb,
          content: spec.content,
          createdAt: docTimestamp - (docSpecs.length - i) * 60000,
        });
      } else if (
        spec.name === 'Catatan_Rilis.txt' &&
        existing.id &&
        existing.content.startsWith('Versi 2.4: Mendukung tema LCD')
      ) {
        await db.files.update(existing.id, { content: spec.content, sizeKb });
      }
    }

    const downloadCount = await db.downloads.count();
    if (downloadCount === 0) {
      await db.downloads.add({
        name: 'Panduan_Pixel_OS.txt',
        url: 'pixel://docs/guide',
        sizeKb: 4,
        mimeType: 'text/plain',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 40000000,
      });
    }

    const bookmarkCount = await db.bookmarks.count();
    if (bookmarkCount === 0) {
      await db.bookmarks.bulkAdd([
        {
          title: 'Pixel News Portal',
          url: 'pixel://news',
          summary: 'Berita teknologi ringkas edisi layar monokrom. Semua artikel tersimpan lokal untuk pembacaan cepat.',
        },
        {
          title: 'Wikipedia (Mobile)',
          url: 'https://en.m.wikipedia.org',
          summary: 'Ensiklopedia bebas edisi seluler ringan.',
        },
        {
          title: 'Retro Weather Station',
          url: 'pixel://weather',
          summary: 'Prakiraan cuaca Nusantara 28°C Cerah Berawan, kelembaban 64%, angin 12 km/j.',
        },
        {
          title: 'Pixel Game Guide',
          url: 'pixel://games-guide',
          summary: 'Tips bermain Snake & Tetris di Retro Pixel OS menggunakan tombol arah & D-Pad.',
        },
      ]);
    }

    const scoreCount = await db.scores.count();
    if (scoreCount === 0) {
      await db.scores.bulkAdd([
        { gameId: 'snake', score: 120, level: 2, achievedAt: Date.now() - 86400000 },
        { gameId: 'tetris', score: 450, level: 3, achievedAt: Date.now() - 43200000 },
      ]);
    }
  })();

  return seedPromise;
}

export async function resetAllOSData(): Promise<void> {
  await Promise.all([
    db.contacts.clear(),
    db.messages.clear(),
    db.callLogs.clear(),
    db.notes.clear(),
    db.events.clear(),
    db.alarms.clear(),
    db.reminders.clear(),
    db.files.clear(),
    db.bookmarks.clear(),
    db.history.clear(),
    db.scores.clear(),
    db.recentApps.clear(),
    db.settings.clear(),
    db.emails.clear(),
    db.groups.clear(),
    db.chatMessages.clear(),
    db.downloads.clear(),
  ]);
  seedPromise = null;
  await ensureDatabaseSeeded();
}
