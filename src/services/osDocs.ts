'use client';

export interface OSReleaseVersionEntry {
  version: string;
  date: string;
  titleId: string;
  titleEn: string;
  highlightsId: string[];
  highlightsEn: string[];
}

export interface OSDocSection {
  headingId: string;
  headingEn: string;
  linesId: string[];
  linesEn: string[];
}

export interface OSDocChapter {
  id: string;
  badge: string;
  titleId: string;
  titleEn: string;
  summaryId: string;
  summaryEn: string;
  sections: OSDocSection[];
  quickApps: { appId: string; labelId: string; labelEn: string }[];
}

export interface OSLicenseNotice {
  name: string;
  license: string;
  roleId: string;
  roleEn: string;
}

export const OS_RELEASE_INFO = {
  name: 'Retro Pixel OS',
  version: '2.4 LTS',
  codename: 'Monochrome Edition',
  build: 'RP-2026.11-MONO',
  kernel: 'PixelLinux 2.4.0-monochrome',
  shell: 'PixelShell + GNU nano',
  displaySpec: '2-Bit Monochrome Adaptive LCD (60Hz)',
  storageEngine: 'Dexie IndexedDB + POSIX VFS',
} as const;

export const OS_CHANGELOG: OSReleaseVersionEntry[] = [
  {
    version: '2.4 LTS',
    date: '2026-11-15',
    titleId: 'Pusat Tentang & Panduan OS, Terminal PixelLinux Penuh, Editor Video',
    titleEn: 'About & Complete OS Docs, Full PixelLinux Terminal, Video Editor',
    highlightsId: [
      'Menambahkan menu Tentang Perangkat (About) dan Pusat Panduan OS lengkap di Pengaturan serta berkas manual di /Dokumen.',
      'Terminal PixelLinux: struktur folder Linux (/home/pixel, /etc, /tmp) + mount langsung folder OS /mnt/os/*, editor layar penuh GNU nano, dan manual man.',
      'Dukungan curl REST API penuh (-X POST, -H, -d JSON, -i) beserta tempel perintah multi-baris backslash (\\) dan perapian JSON otomatis.',
      'Editor Video bergaya CapCut dengan pratinjau real-time 60fps, split klip, teks, filter monokrom, kecepatan, trek audio, dan ekspor WebM asli.',
    ],
    highlightsEn: [
      'Added full About Device screen and searchable OS Guide Hub in Settings plus complete manual files in /Dokumen.',
      'PixelLinux Terminal: nested Linux folders (/home/pixel, /etc, /tmp) + live /mnt/os/* bridge, full-screen GNU nano editor, and man pages.',
      'Full REST curl support (-X POST, -H, -d JSON, -i) with multi-line backslash (\\) paste input and automatic JSON pretty-printing.',
      'CapCut-style Video Editor with 60fps real-time playback, clip splitting, text overlays, monochrome filters, speed, audio tracks, and WebM export.',
    ],
  },
  {
    version: '2.3',
    date: '2026-10-28',
    titleId: 'Studio Audio, Live TV & Tamagotchi Generasi Baru',
    titleEn: 'Audio Studio, Live TV & Next-Gen Tamagotchi',
    highlightsId: [
      'Studio Audio untuk menyusun ketukan chiptune Web Audio dan merekam suara mikrofon.',
      'TV Live dengan pemutar saluran streaming nyata dan daftar putar bawaan.',
      'Tamagotchi lengkap dengan siklus hidup, evolusi rahasia, dan mini-game.',
    ],
    highlightsEn: [
      'Audio Studio for composing Web Audio chiptune beats and recording mic tracks.',
      'Live TV player with real streaming channels and built-in playlist.',
      'Tamagotchi pet simulator with full life stages, evolutions, and mini-games.',
    ],
  },
  {
    version: '2.2',
    date: '2026-10-12',
    titleId: 'Browser Proxy, Unduhan Nyata & Perangkat Keras Web',
    titleEn: 'Proxy Browser, Real Downloads & Web Hardware Integration',
    highlightsId: [
      'Browser Web dengan mode pembaca bersih dan pencarian web nyata melalui proxy server aman.',
      'Kamera WebRTC, Perekam Suara MediaRecorder, dan monitor baterai hardware API.',
      'Cadangan Cloud JSON portabel untuk mengekspor dan memulihkan seluruh data OS.',
    ],
    highlightsEn: [
      'Web Browser with clean reader mode and live web search via SSRF-safe server proxy.',
      'WebRTC Camera, MediaRecorder Voice Recorder, and hardware Battery Status API.',
      'Portable JSON Cloud Backup to export and restore all local OS data.',
    ],
  },
  {
    version: '1.0',
    date: '2026-09-01',
    titleId: 'Rilis Perdana Retro Pixel OS',
    titleEn: 'Initial Retro Pixel OS Release',
    highlightsId: [
      'Peluncur ponsel monokrom dengan sasis piksel, D-Pad interaktif, suara piezo, dan penyimpanan IndexedDB.',
    ],
    highlightsEn: [
      'Monochrome mobile launcher with pixel chassis, interactive D-Pad, piezo audio cues, and IndexedDB persistence.',
    ],
  },
];

export const OS_LICENSES: OSLicenseNotice[] = [
  {
    name: 'Retro Pixel OS Core',
    license: 'MIT / Open Educational System',
    roleId: 'Antarmuka LCD monokrom, launcher, aplikasi OS, dan PixelShell.',
    roleEn: 'Monochrome LCD interface, launcher, built-in OS apps, and PixelShell.',
  },
  {
    name: 'Next.js & React',
    license: 'MIT License',
    roleId: 'Kerangka kerja aplikasi web App Router & komponen antarmuka reaktif.',
    roleEn: 'App Router web framework & reactive UI component runtime.',
  },
  {
    name: 'Dexie.js (IndexedDB)',
    license: 'Apache-2.0 License',
    roleId: 'Penyimpanan persisten lokal untuk kontak, pesan, catatan, berkas, dan alarm.',
    roleEn: 'Local persistent database for contacts, messages, notes, files, and alarms.',
  },
  {
    name: 'Web Audio, WebRTC, MediaRecorder & Canvas API',
    license: 'W3C Open Web Standards',
    roleId: 'Sintesis audio piezo/musik, kamera, perekam suara, dan render Editor Video WebM.',
    roleEn: 'Piezo/music synthesis, camera, microphone recording, and WebM Video Editor rendering.',
  },
  {
    name: 'Tailwind CSS & Lucide Icons',
    license: 'MIT / ISC License',
    roleId: 'Utilitas tata letak responsif dan ikon pendukung kontrol media.',
    roleEn: 'Responsive layout utilities and auxiliary media control icons.',
  },
];

export const OS_DOC_CHAPTERS: OSDocChapter[] = [
  {
    id: 'start',
    badge: '01',
    titleId: 'Mulai Cepat & Navigasi',
    titleEn: 'Quick Start & Navigation',
    summaryId: 'Cara mengoperasikan sasis ponsel piksel, D-Pad, keyboard fisik, tema LCD, dan mode PWA offline.',
    summaryEn: 'How to operate the pixel phone chassis, D-Pad, keyboard shortcuts, LCD themes, and offline PWA mode.',
    quickApps: [
      { appId: 'themes', labelId: 'Buka Tema', labelEn: 'Open Themes' },
      { appId: 'display', labelId: 'Buka Tampilan', labelEn: 'Open Display' },
    ],
    sections: [
      {
        headingId: 'Navigasi Utama & Akses Cepat',
        headingEn: 'Home Navigation & Quick Access',
        linesId: [
          'Layar Utama (Home) menampilkan jam, status jaringan/baterai, jadwal hari ini, serta 4 slot Akses Cepat di bagian bawah.',
          'Tekan Softkey Kiri ("Menu") atau tombol OK untuk masuk ke Grid Aplikasi (geser Halaman 1/2 dengan panah Kiri/Kanan) atau Daftar Kategori.',
          'Mode Desktop mendukung tampilan Sasis Ponsel klasik maupun Layar Lebar (Wide LCD) melalui Pengaturan > Tampilan.',
        ],
        linesEn: [
          'The Home screen shows clock, signal/battery status, today schedule, and 4 Quick Access slots at the bottom.',
          'Press Left Softkey ("Menu") or OK to open the App Grid (switch Page 1/2 with Left/Right) or Category List.',
          'Desktop supports both classic Phone Chassis and Wide LCD modes via Settings > Display.',
        ],
      },
      {
        headingId: 'Pintasan Keyboard & Tombol D-Pad',
        headingEn: 'Keyboard & D-Pad Shortcuts',
        linesId: [
          'Panah Atas / Bawah / Kiri / Kanan: Pindah fokus ikon, menu, atau kontrol game Snake & Tetris.',
          'Enter / Spasi (OK): Buka aplikasi atau konfirmasi pilihan.',
          'Backspace / Escape: Kembali ke layar sebelumnya (atau keluar aplikasi).',
          'Tombol [ / ]: Pemicu Softkey Kiri dan Softkey Kanan secara cepat.',
          'Di Terminal & Nano: Tab (Autocomplete), Atas/Bawah (Riwayat), Ctrl+L (Bersihkan), Ctrl+O (Simpan Nano), Ctrl+X (Keluar Nano).',
        ],
        linesEn: [
          'Arrow Keys (Up/Down/Left/Right): Move focus across icons, menus, or control Snake & Tetris.',
          'Enter / Space (OK): Launch selected app or confirm action.',
          'Backspace / Escape: Navigate back or close current app.',
          'Bracket keys [ / ]: Trigger Left Softkey and Right Softkey quickly.',
          'In Terminal & Nano: Tab (Autocomplete), Up/Down (History), Ctrl+L (Clear), Ctrl+O (Save Nano), Ctrl+X (Exit Nano).',
        ],
      },
    ],
  },
  {
    id: 'communication',
    badge: '02',
    titleId: 'Komunikasi & Pesan',
    titleEn: 'Communication & Messaging',
    summaryId: 'Pesan SMS lokal, panggilan simulasi, buku kontak, grup diskusi, email, dan chat lintas-tab real-time.',
    summaryEn: 'Local SMS threads, call dialer, contacts book, groups, email client, and real-time cross-tab chat.',
    quickApps: [
      { appId: 'messages', labelId: 'Buka Pesan', labelEn: 'Open Messages' },
      { appId: 'contacts', labelId: 'Buka Kontak', labelEn: 'Open Contacts' },
      { appId: 'chat', labelId: 'Buka Chat', labelEn: 'Open Chat' },
    ],
    sections: [
      {
        headingId: 'Pesan, Kontak & Panggilan',
        headingEn: 'Messages, Contacts & Phone',
        linesId: [
          'Pesan: Kelola utas percakapan, buat pesan baru ke kontak, dan tandai pesan sudah dibaca secara otomatis.',
          'Kontak: Tambah, ubah, favoritkan, atau hapus kontak; ketuk kontak untuk langsung menelepon atau mengirim pesan.',
          'Panggilan: Papan tombol DTMF lengkap dengan nada nada suara nyata serta riwayat panggilan masuk/keluar/tak terjawab.',
        ],
        linesEn: [
          'Messages: Manage SMS threads, compose new messages to contacts, and track unread counters.',
          'Contacts: Add, edit, star favorites, or delete contacts; launch a call or message directly from a contact.',
          'Phone: Full DTMF dialpad with real audio tones and persistent incoming/outgoing/missed call history.',
        ],
      },
      {
        headingId: 'Email, Grup & Chat Lintas-Tab',
        headingEn: 'Email, Groups & Cross-Tab Chat',
        linesId: [
          'Email: Kotak masuk dan terkirim lokal dengan form tulis email baru.',
          'Chat: Menggunakan BroadcastChannel browser sehingga pesan muncul real-time bila Anda membuka OS di dua tab berbeda.',
        ],
        linesEn: [
          'Email: Local Inbox & Sent folders with full compose workflow.',
          'Chat: Uses browser BroadcastChannel so messages appear in real time across multiple open OS tabs.',
        ],
      },
    ],
  },
  {
    id: 'multimedia',
    badge: '03',
    titleId: 'Multimedia & Kreator',
    titleEn: 'Multimedia & Creators',
    summaryId: 'Editor Foto, Editor Video gaya CapCut, Studio Audio, Kamera WebRTC, Galeri, Musik, TV Live, Radio, dan Perekam.',
    summaryEn: 'Photo Editor, CapCut-style Video Editor, Audio Studio, WebRTC Camera, Gallery, Music, Live TV, Radio, and Recorder.',
    quickApps: [
      { appId: 'photo-editor', labelId: 'Editor Foto', labelEn: 'Photo Editor' },
      { appId: 'video-editor', labelId: 'Editor Video', labelEn: 'Video Editor' },
      { appId: 'audio-studio', labelId: 'Studio Audio', labelEn: 'Audio Studio' },
      { appId: 'camera', labelId: 'Kamera', labelEn: 'Camera' },
    ],
    sections: [
      {
        headingId: 'Editor Foto Studio',
        headingEn: 'Photo Editor Studio',
        linesId: [
          'Sumber fleksibel: muat foto dari Galeri DCIM, unggah gambar perangkat, jepret langsung dari Kamera Live, atau mulai dari Kanvas Kosong.',
          'Alat lengkap: filter retro (LCD 2-Bit Bayer Dither, Pixel Art, Sepia, Noir, Negatif), penyesuaian kecerahan/kontras/saturasi, putar/balik, crop rasio, kuas piksel, dan teks overlay.',
          'Simpan hasil ke Galeri DCIM, unduh sebagai PNG/JPEG, atau langsung pasang menjadi Wallpaper OS.',
        ],
        linesEn: [
          'Flexible inputs: open from DCIM Gallery, upload device images, capture straight from Live Camera, or paint on a Blank Canvas.',
          'Complete tools: retro filters (LCD 2-Bit Bayer Dither, Pixel Art, Sepia, Noir, Invert), brightness/contrast/saturation, rotate/flip, ratio crop, pixel brush, and text overlays.',
          'Save back to DCIM Gallery, download as PNG/JPEG, or apply directly as your OS Wallpaper.',
        ],
      },
      {
        headingId: 'Editor Video (Gaya CapCut)',
        headingEn: 'Video Editor (CapCut-Style)',
        linesId: [
          'Impor media nyata: video lokal perangkat, foto dari Galeri/DCIM, serta audio dari folder Musik atau Studio Audio.',
          'Timeline multi-trek: Pisahkan klip (Split) di titik playhead, atur trim awal/akhir, tambahkan hamparan Teks kustom, pilih Filter monokrom, serta atur Kecepatan (0.5x–2x).',
          'Ekspor WebM asli: Merender kanvas & audio secara real-time lalu menyimpan hasilnya ke folder Video OS dan menyediakan tombol unduh.',
        ],
        linesEn: [
          'Import real media: local device videos, Gallery/DCIM photos, and audio tracks from Musik or Audio Studio.',
          'Multi-track timeline: Split clips at playhead, trim in/out, add custom Text overlays, monochrome Filters, and Speed control (0.5x–2x).',
          'Native WebM export: Renders canvas & audio in real time directly to the OS Video folder plus instant download.',
        ],
      },
      {
        headingId: 'Studio Audio, Kamera, Radio Dunia & TV Live',
        headingEn: 'Audio Studio, Camera, World Radio & Live TV',
        linesId: [
          'Radio Dunia & FM: Jelajahi ribuan stasiun radio Indonesia & dunia melalui Radio Garden + Radio Browser tanpa API Key. Radio terus berjalan di latar belakang saat membuka aplikasi lain, menampilkan ikon gelombang aktif di navbar atas (klik untuk membuka kontrol cepat di Laci Notifikasi), dan otomatis jeda saat TV/Video/Musik diputar.',
          'Studio Audio: Sequencer nada chiptune multi-kanal plus perekaman mikrofon dan simpan hasil ke folder Musik.',
          'Kamera & Perekam: Menggunakan izin kamera dan mikrofon browser nyata; foto tersimpan di DCIM dan rekaman di Musik/Lainnya.',
          'TV Live: Memutar saluran streaming TV nasional dan internasional saat WiFi aktif.',
        ],
        linesEn: [
          'World & FM Radio: Tune into thousands of Indonesian & global stations via keyless Radio Garden + Radio Browser proxies, complete with 87.5–108 MHz FM dial, pixel VU equalizer, search, favorites, sleep timer, and Offline 8-Bit Synth band.',
          'Audio Studio: Multi-channel chiptune pattern sequencer plus microphone recording saved directly to Musik.',
          'Camera & Recorder: Uses real browser WebRTC camera & mic; photos save to DCIM and recordings to Musik/Lainnya.',
          'Live TV: Stream public live channels when WiFi is enabled.',
        ],
      },
    ],
  },
  {
    id: 'productivity',
    badge: '04',
    titleId: 'Produktivitas, Berkas & Cloud',
    titleEn: 'Productivity, Files & Cloud',
    summaryId: 'Elixir Office (Dokumen, Tabel, Slide), Manajer Berkas 6 folder, Catatan, Kalender, Jam, Alarm, Kalkulator, Browser Web, dan Cloud.',
    summaryEn: 'Elixir Office (Docs, Sheets, Slides), 6-folder File Manager, Notes, Calendar, Clock, Alarms, Calculator, Web Browser, and Cloud Backup.',
    quickApps: [
      { appId: 'office', labelId: 'Elixir Office', labelEn: 'Elixir Office' },
      { appId: 'maps', labelId: 'Peta & GPS', labelEn: 'Pixel Maps' },
      { appId: 'files', labelId: 'Buka Berkas', labelEn: 'Open Files' },
      { appId: 'browser', labelId: 'Buka Browser', labelEn: 'Open Browser' },
    ],
    sections: [
      {
        headingId: 'Elixir Office Suite (Dokumen, Tabel & Slide)',
        headingEn: 'Elixir Office Suite (Writer, Calc & Slides)',
        linesId: [
          'Suite kantor luring bergaya Ribbon Microsoft Office untuk menyusun Dokumen (.doc/.html/.txt), Spreadsheet (.csv dengan rumus =SUM, =AVERAGE, =MIN, =MAX), dan Presentasi Slide layar penuh.',
          'Seluruh berkas dapat disimpan langsung ke folder Dokumen OS, dibuka kembali dari Manajer Berkas, atau diekspor ke perangkat tanpa akun maupun pelacakan awan.',
        ],
        linesEn: [
          'Offline Ribbon-style office suite for writing Documents (.doc/.html/.txt), calculating Spreadsheets (.csv with =SUM, =AVERAGE, =MIN, =MAX formulas), and presenting Slide decks.',
          'All files save directly to OS Dokumen storage, reopen from File Manager, or export locally with zero telemetry.',
        ],
      },
      {
        headingId: 'Peta & GPS Piksel (OpenStreetMap)',
        headingEn: 'Pixel Maps & Live GPS (OpenStreetMap)',
        linesId: [
          'Peta dunia nyata berbasis OpenStreetMap tanpa API Key, dilengkapi 3 mode visual yang bisa diganti langsung: LCD 2-Bit Dither, Retro Color Piksel, dan Taktis.',
          'Tekan GPS untuk melacak posisi langsung via Geolocation browser, lihat kecepatan serta radius akurasi, cari lokasi/koordinat, hitung rute (Mobil/Sepeda/Jalan), dan simpan Pin Lokasi favorit.',
        ],
        linesEn: [
          'Keyless OpenStreetMap navigation with 3 live visual modes: LCD 2-Bit Dither, Retro Pixel Color, and Tactical Ink.',
          'Enable GPS for real-time Geolocation tracking, speed & accuracy rings, place search, turn-by-turn routing (Drive/Bike/Walk), and saved location pins.',
        ],
      },
      {
        headingId: 'Manajer Berkas & Folder Sistem',
        headingEn: 'File Manager & System Folders',
        linesId: [
          'Enam folder utama OS: DCIM (foto), Dokumen (teks/skrip), Download (unduhan web), Musik (audio/chiptune), Video (klip WebM), dan Lainnya.',
          'Mendukung unggah berkas dari komputer/HP Anda, lihat pratinjau langsung, hapus, atau buka di Pembaca E-Book dan Pemutar Media.',
        ],
        linesEn: [
          'Six core OS folders: DCIM (photos), Dokumen (docs/scripts), Download (web files), Musik (audio), Video (WebM clips), and Lainnya.',
          'Upload real files from your device, preview inline, delete, or open directly in E-Book Reader and Media Players.',
        ],
      },
      {
        headingId: 'Browser Web, Unduhan & Cadangan Cloud',
        headingEn: 'Web Browser, Downloads & Cloud Backup',
        linesId: [
          'Browser memuat pencarian web dan Mode Baca bersih melalui proxy server aman.',
          'Cloud memungkinkan Anda mengekspor seluruh database OS (kontak, catatan, pesan, alarm, berkas) ke satu berkas JSON cadangan dan memulihkannya kapan saja.',
        ],
        linesEn: [
          'Browser performs web searches and clean Reader Mode loading through the secure server proxy.',
          'Cloud exports your entire OS database (contacts, notes, messages, alarms, files) to a portable JSON backup file for instant restore.',
        ],
      },
    ],
  },
  {
    id: 'entertainment',
    badge: '05',
    titleId: 'Hiburan, Gim & Bacaan',
    titleEn: 'Entertainment, Games & Reading',
    summaryId: 'Peliharaan virtual Tamagotchi, Snake, Tetris, Puzzle angka, Pembaca E-Book, Komik piksel, dan Wallpaper.',
    summaryEn: 'Virtual pet Tamagotchi, Snake, Tetris, Number Puzzle, E-Book Reader, Pixel Comics, and Wallpapers.',
    quickApps: [
      { appId: 'tamagotchi', labelId: 'Tamagotchi', labelEn: 'Tamagotchi' },
      { appId: 'ebook', labelId: 'Pembaca E-Book', labelEn: 'E-Book Reader' },
      { appId: 'games', labelId: 'Hub Gim', labelEn: 'Games Hub' },
    ],
    sections: [
      {
        headingId: 'Tamagotchi & Skor Tertinggi Gim',
        headingEn: 'Tamagotchi & Game High Scores',
        linesId: [
          'Tamagotchi tetap berjalan di latar: beri makan, nyalakan/matikan lampu tidur, bersihkan kotoran, obati saat sakit, dan buka berbagai evolusi.',
          'Snake, Tetris, dan Puzzle menyimpan skor tertinggi permanen ke database lokal OS.',
        ],
        linesEn: [
          'Tamagotchi simulates hunger, sleep lights, hygiene, medicine, discipline, mini-games, and secret evolutions over time.',
          'Snake, Tetris, and Puzzle persist your high scores to the local OS database.',
        ],
      },
      {
        headingId: 'E-Book Reader & Komik',
        headingEn: 'E-Book Reader & Comics',
        linesId: [
          'Pembaca E-Book otomatis membaca dokumen teks dari folder Dokumen/Download—termasuk seluruh manual lengkap OS ini.',
        ],
        linesEn: [
          'E-Book Reader automatically opens text manuals from Dokumen/Download—including all built-in OS guide documents.',
        ],
      },
    ],
  },
  {
    id: 'terminal',
    badge: '06',
    titleId: 'Terminal Linux (PixelLinux)',
    titleEn: 'Linux Terminal (PixelLinux)',
    summaryId: 'Shell POSIX nyata dengan VFS Linux, mount /mnt/os, editor nano, man page, curl REST API, dan skrip bash.',
    summaryEn: 'Real POSIX shell with Linux VFS, /mnt/os live mount, GNU nano editor, man pages, REST curl, and shell scripting.',
    quickApps: [
      { appId: 'terminal', labelId: 'Buka Terminal', labelEn: 'Open Terminal' },
    ],
    sections: [
      {
        headingId: 'Sistem Berkas Linux & Mount /mnt/os',
        headingEn: 'Linux Filesystem & /mnt/os Mount',
        linesId: [
          'Direktori rumah default Anda adalah /home/pixel (~$). Folder sistem /etc, /bin, /tmp, dan /var/log tersimpan persisten.',
          'Seluruh folder OS asli terpasang dua arah di /mnt/os/* (mis. /mnt/os/Dokumen atau singkatannya /Dokumen).',
          'Perintah berkas: ls [-la], cd, pwd, mkdir [-p], rmdir, rm [-rf], cp [-r], mv, touch, chmod, chown, stat, tree, find.',
        ],
        linesEn: [
          'Default home directory is /home/pixel (~$). System folders /etc, /bin, /tmp, and /var/log persist locally.',
          'All native OS folders are two-way mounted at /mnt/os/* (e.g. /mnt/os/Dokumen or shorthand /Dokumen).',
          'File commands: ls [-la], cd, pwd, mkdir [-p], rmdir, rm [-rf], cp [-r], mv, touch, chmod, chown, stat, tree, find.',
        ],
      },
      {
        headingId: 'Editor nano, Manual man, Filter & Jaringan',
        headingEn: 'nano Editor, man Pages, Filters & Networking',
        linesId: [
          'nano <berkas>: Buka editor teks layar penuh (^O Simpan, ^W Cari, ^K Potong, ^U Tempel, ^X Keluar).',
          'man <perintah>: Baca dokumentasi lengkap perintah apa pun (mis. man grep, man curl, man run).',
          'Filter & Kripto: grep [-invc], sed, sort, uniq, cut, tr, nl, rev, tee, xargs, diff, base64, sha256sum.',
          'REST & Jaringan: curl [-X POST] [-H "..."] [-d JSON] [-i] [-o], wget [-O], ping [-c 3], serta mendukung tempel perintah multi-baris (\\).',
          'Skrip & Proses: run <skrip.sh> mendukung if/then/else/fi, for/in/do/done, while, $(cmd), ps, top, dan kill <PID>.',
        ],
        linesEn: [
          'nano <file>: Full-screen text editor (^O Save, ^W Find, ^K Cut line, ^U Paste, ^X Exit).',
          'man <cmd>: View manual pages for any command (e.g. man grep, man curl, man run).',
          'Filters & Crypto: grep [-invc], sed, sort, uniq, cut, tr, nl, rev, tee, xargs, diff, base64, sha256sum.',
          'REST & Net: curl [-X POST] [-H "..."] [-d JSON] [-i] [-o], wget [-O], ping [-c 3], supporting pasted multi-line backslash (\\) commands.',
          'Scripts & Processes: run <script.sh> with if/for/while/$(cmd), plus ps, top, and kill <PID>.',
        ],
      },
    ],
  },
  {
    id: 'tips',
    badge: '07',
    titleId: 'Tips Harian & Pemecahan Masalah',
    titleEn: 'Daily Tips & Troubleshooting',
    summaryId: 'Praktik terbaik menjaga data lokal, menghemat baterai simulasi, pemecahan kendala jaringan, dan reset aman.',
    summaryEn: 'Best practices for local backups, power settings, network troubleshooting, and safe reset.',
    quickApps: [
      { appId: 'network', labelId: 'Cek Jaringan', labelEn: 'Check Network' },
      { appId: 'storage', labelId: 'Cek Penyimpanan', labelEn: 'Check Storage' },
    ],
    sections: [
      {
        headingId: 'Tips Produktivitas Harian',
        headingEn: 'Daily Productivity Tips',
        linesId: [
          'Sematkan aplikasi favorit ke Slot 4 Akses Cepat melalui Pengaturan > Aplikasi agar langsung terbuka dari layar Home.',
          'Gunakan perintah Terminal `open <appId>` (mis. `open video-editor`) atau `theme amber` untuk berpindah cepat tanpa keluar keyboard.',
          'Simpan berkas skrip atau catatan Terminal ke /Dokumen/nama.txt agar otomatis dapat dibuka di Pembaca E-Book dan Manajer Berkas.',
        ],
        linesEn: [
          'Pin your favorite app to Home Quick Slot 4 via Settings > Applications for instant one-tap launch.',
          'Use Terminal `open <appId>` (e.g. `open video-editor`) or `theme amber` to switch apps and themes from the shell.',
          'Save Terminal files to /Dokumen/name.txt so they appear automatically in File Manager and E-Book Reader.',
        ],
      },
      {
        headingId: 'Pemecahan Masalah Umum',
        headingEn: 'Common Troubleshooting',
        linesId: [
          'Browser, TV Live, Radio, curl/wget/ping gagal? Pastikan sakelar WiFi di Pengaturan > Jaringan aktif dan perangkat terhubung internet.',
          'Kamera atau Perekam tidak merekam? Izinkan akses Kamera & Mikrofon pada bilah izin browser Anda.',
          'Ingin memulai ulang dari bersih? Ekspor cadangan dulu di Cloud, lalu tekan "Reset Data Lokal" di menu Pengaturan.',
        ],
        linesEn: [
          'Browser, Live TV, Radio, or curl/wget/ping failing? Ensure WiFi is turned ON in Settings > Network.',
          'Camera or Recorder blocked? Grant Camera & Microphone permissions in your browser site settings.',
          'Need a fresh start? Export a JSON backup in Cloud first, then choose "Reset Local Data" inside Settings.',
        ],
      },
    ],
  },
];

export interface SeededDocFileSpec {
  name: string;
  content: string;
}

export function buildSeededDocumentFiles(): SeededDocFileSpec[] {
  const manualLines: string[] = [
    `========================================`,
    `MANUAL LENGKAP ${OS_RELEASE_INFO.name.toUpperCase()} v${OS_RELEASE_INFO.version}`,
    `Build: ${OS_RELEASE_INFO.build} | Kernel: ${OS_RELEASE_INFO.kernel}`,
    `========================================`,
    '',
  ];

  OS_DOC_CHAPTERS.forEach((ch) => {
    manualLines.push(`[${ch.badge}] ${ch.titleId.toUpperCase()}`);
    manualLines.push(ch.summaryId);
    manualLines.push('');
    ch.sections.forEach((sec) => {
      manualLines.push(`* ${sec.headingId}`);
      sec.linesId.forEach((l) => manualLines.push(`  - ${l}`));
      manualLines.push('');
    });
    manualLines.push('----------------------------------------', '');
  });

  const terminalChapter = OS_DOC_CHAPTERS.find((c) => c.id === 'terminal');
  const terminalLines: string[] = [
    'PANDUAN LENGKAP TERMINAL PIXELLINUX',
    '===================================',
    'Lokasi Awal : /home/pixel (~$)',
    'Mount OS    : /mnt/os/{DCIM,Dokumen,Download,Lainnya,Musik,Video}',
    '',
  ];
  terminalChapter?.sections.forEach((sec) => {
    terminalLines.push(`[${sec.headingId}]`);
    sec.linesId.forEach((l) => terminalLines.push(`- ${l}`));
    terminalLines.push('');
  });
  terminalLines.push(
    'CONTOH SKRIP & REST API:',
    '  1. run halo.sh',
    '  2. nano /Dokumen/catatan.txt',
    '  3. man grep && man curl',
    '  4. curl -X POST https://api.bariska.cloud/v1/chat/completions \\',
    '       -H "Authorization: Bearer TOKEN" \\',
    '       -H "Content-Type: application/json" \\',
    '       -d \'{"model":"deepseek-v4.1-flash","messages":[{"role":"user","content":"Halo"}]}\'',
    '  5. sha256sum /etc/os-release'
  );

  const shortcutLines: string[] = [
    'DAFTAR PINTASAN TOMBOL RETRO PIXEL OS',
    '=====================================',
    '',
    '[NAVIGASI OS & LAUNCHER]',
    '  Panah Arah        : Pindah fokus / kontrol game',
    '  Enter / Spasi     : Pilih / OK / Buka aplikasi',
    '  Backspace / Esc   : Kembali / Tutup aplikasi',
    '  Tombol [ / ]      : Softkey Kiri / Softkey Kanan',
    '',
    '[TERMINAL SHELL]',
    '  Enter             : Jalankan perintah (multi-baris didukung)',
    '  Shift + Enter     : Tambah baris baru di prompt',
    '  Tab               : Pelengkapan otomatis perintah & jalur',
    '  Panah Atas/Bawah  : Riwayat perintah sebelumnya/berikutnya',
    '  Ctrl + L          : Bersihkan layar terminal',
    '',
    '[EDITOR LAYAR PENUH GNU NANO]',
    '  Ctrl + O / S      : Simpan berkas ke VFS atau /mnt/os',
    '  Ctrl + W          : Cari kata kunci di dokumen',
    '  Ctrl + K          : Potong baris aktif',
    '  Ctrl + U          : Tempel baris hasil potong',
    '  Ctrl + G          : Tampilkan bantuan ringkas',
    '  Ctrl + X          : Keluar kembali ke shell',
  ];

  const releaseLines: string[] = [
    `CATATAN RILIS ${OS_RELEASE_INFO.name.toUpperCase()}`,
    '===================================',
    '',
  ];
  OS_CHANGELOG.forEach((rel) => {
    releaseLines.push(`Versi ${rel.version} (${rel.date}) — ${rel.titleId}`);
    rel.highlightsId.forEach((h) => releaseLines.push(`  • ${h}`));
    releaseLines.push('');
  });

  return [
    { name: 'Manual_Lengkap_PixelOS.txt', content: manualLines.join('\n') },
    { name: 'Panduan_Terminal_Linux.txt', content: terminalLines.join('\n') },
    { name: 'Pintasan_Tombol_OS.txt', content: shortcutLines.join('\n') },
    { name: 'Catatan_Rilis.txt', content: releaseLines.join('\n') },
  ];
}
