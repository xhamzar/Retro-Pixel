'use client';

export interface ManPageEntry {
  name: string;
  synopsis: string;
  description: string;
  options?: string[];
  examples?: string[];
}

export const LINUX_MAN_PAGES: Record<string, ManPageEntry> = {
  ls: {
    name: 'ls - tampilkan isi direktori',
    synopsis: 'ls [-l] [-a] [JALUR]',
    description:
      'Menampilkan berkas dan subdirektori di direktori aktif maupun jalur target (/home/pixel, /etc, /mnt/os/Dokumen, dll).',
    options: [
      '-l   Format panjang dengan izin POSIX (-rwxr-xr-x), pemilik, ukuran, dan nama',
      '-a   Tampilkan entri tersembunyi serta . dan ..',
    ],
    examples: ['ls -la /home/pixel', 'ls -l /mnt/os/Dokumen'],
  },
  cd: {
    name: 'cd - pindah direktori kerja',
    synopsis: 'cd [DIREKTORI | ~ | .. | /]',
    description: 'Mengubah direktori kerja aktif shell ke jalur Linux atau folder OS (/Dokumen, /mnt/os/DCIM).',
    examples: ['cd ~', 'cd /etc', 'cd /mnt/os/Dokumen', 'cd ..'],
  },
  mkdir: {
    name: 'mkdir - buat direktori baru',
    synopsis: 'mkdir [-p] DIREKTORI...',
    description: 'Membuat satu atau lebih direktori bersarang di sistem berkas Linux.',
    options: ['-p   Buat direktori induk secara otomatis jika belum ada'],
    examples: ['mkdir proyek', 'mkdir -p proyek/src/utils'],
  },
  rm: {
    name: 'rm - hapus berkas atau direktori',
    synopsis: 'rm [-r] [-f] TARGET...',
    description: 'Menghapus berkas secara permanen dari VFS Linux maupun folder OS (/mnt/os/*).',
    options: ['-r   Hapus direktori beserta seluruh isinya secara rekursif', '-f   Abaikan pesan kesalahan'],
    examples: ['rm catatan.txt', 'rm -r proyek'],
  },
  cp: {
    name: 'cp - salin berkas atau direktori',
    synopsis: 'cp [-r] SUMBER TUJUAN',
    description: 'Menyalin berkas atau folder antar direktori Linux maupun ke folder OS /mnt/os.',
    options: ['-r   Salin direktori beserta seluruh isinya'],
    examples: ['cp halo.sh /tmp/backup.sh', 'cp -r proyek /tmp/'],
  },
  mv: {
    name: 'mv - pindah atau ubah nama berkas',
    synopsis: 'mv SUMBER TUJUAN',
    description: 'Memindahkan berkas/folder ke lokasi lain atau mengganti namanya.',
    examples: ['mv draf.txt final.txt', 'mv script.sh /mnt/os/Dokumen/'],
  },
  chmod: {
    name: 'chmod - ubah hak akses berkas',
    synopsis: 'chmod MODE TARGET',
    description: 'Mengubah bit izin baca/tulis/eksekusi (rwx) pada berkas atau direktori Linux.',
    examples: ['chmod 755 skrip.sh', 'chmod +x halo.sh', 'chmod u-w catatan.txt'],
  },
  chown: {
    name: 'chown - ubah pemilik berkas',
    synopsis: 'chown PEMILIK[:GRUP] TARGET',
    description: 'Mengubah pemilik dan grup berkas/direktori pada sistem berkas Linux.',
    examples: ['chown root:wheel /etc/motd', 'chown pixel catatan.txt'],
  },
  stat: {
    name: 'stat - tampilkan metadata lengkap node',
    synopsis: 'stat TARGET',
    description: 'Menampilkan tipe, ukuran byte, mode izin oktal & simbolik, serta pemilik node.',
    examples: ['stat /etc/os-release', 'stat halo.sh'],
  },
  nano: {
    name: 'nano - editor teks layar penuh retro',
    synopsis: 'nano [NAMA_BERKAS]',
    description:
      'Membuka editor teks layar penuh GNU nano langsung di LCD Terminal. Mendukung nomor baris, tombol pintasan sentuh (^O Simpan, ^X Keluar, ^K Potong Baris, ^W Cari), dan pintasan keyboard.',
    examples: ['nano halo.sh', 'nano /mnt/os/Dokumen/catatan.txt'],
  },
  man: {
    name: 'man - tampilkan manual perintah',
    synopsis: 'man NAMA_PERINTAH',
    description: 'Menampilkan dokumentasi lengkap, opsi, dan contoh penggunaan perintah Linux & OS.',
    examples: ['man grep', 'man nano', 'man curl'],
  },
  grep: {
    name: 'grep - cari baris cocok dengan pola teks',
    synopsis: 'grep [-i] [-n] [-v] [-c] POLA [BERKAS]',
    description: 'Menyaring baris dari berkas atau stdin pipa yang mengandung pola tertentu.',
    options: [
      '-i   Abaikan huruf besar/kecil',
      '-n   Sertakan nomor baris',
      '-v   Tampilkan baris yang TIDAK cocok',
      '-c   Hitung jumlah baris cocok saja',
    ],
    examples: ['grep -in "pixel" /etc/motd', 'apps | grep -i game'],
  },
  sed: {
    name: 'sed - editor aliran teks (stream editor)',
    synopsis: "sed 's/POLA/PENGGANTI/[g]' [BERKAS]",
    description: 'Melakukan penggantian teks pada setiap baris masukan dari berkas atau pipa.',
    examples: ["echo 'halo dunia' | sed 's/dunia/Linux/'", "sed 's/Retro/Pixel/g' README.md"],
  },
  sort: {
    name: 'sort - urutkan baris teks',
    synopsis: 'sort [-r] [-n] [-u] [BERKAS]',
    description: 'Mengurutkan baris masukan secara alfabetis atau numerik.',
    options: ['-r   Urutan terbalik', '-n   Urutkan sebagai angka', '-u   Sekaligus hapus duplikat'],
    examples: ['ls /bin | sort -r', 'sort -n angka.txt | uniq'],
  },
  uniq: {
    name: 'uniq - saring baris duplikat berurutan',
    synopsis: 'uniq [-c] [BERKAS]',
    description: 'Menghapus duplikat baris yang berdekatan (umumnya dipasangkan setelah sort).',
    options: ['-c   Tampilkan jumlah kemunculan tiap baris'],
    examples: ['sort daftar.txt | uniq -c'],
  },
  cut: {
    name: 'cut - potong kolom pada setiap baris',
    synopsis: 'cut -d PEMISAH -f KOLOM [BERKAS]',
    description: 'Mengambil kolom tertentu berdasarkan karakter pemisah (seperti : atau ,).',
    examples: ['cut -d : -f 1 /etc/passwd', 'cat data.csv | cut -d , -f 1,3'],
  },
  tr: {
    name: 'tr - terjemahkan atau ubah karakter',
    synopsis: 'tr SET1 SET2',
    description: 'Mengganti karakter dari stdin, misalnya huruf kecil ke huruf kapital (a-z A-Z).',
    examples: ["echo 'retro pixel' | tr a-z A-Z"],
  },
  base64: {
    name: 'base64 - encode/decode Base64',
    synopsis: 'base64 [-d] [BERKAS]',
    description: 'Mengonversi teks menjadi string Base64 atau mengembalikan Base64 ke teks asal (-d).',
    examples: ["echo 'Halo Linux' | base64", "echo 'SGFsbyBMaW51eA==' | base64 -d"],
  },
  sha256sum: {
    name: 'sha256sum - hitung hash SHA-256 asli',
    synopsis: 'sha256sum [BERKAS]',
    description: 'Menghitung digest kriptografi SHA-256 menggunakan Web Crypto API browser.',
    examples: ['sha256sum /etc/os-release', "echo 'rahasia' | sha256sum"],
  },
  curl: {
    name: 'curl - klien REST API & transfer HTTP/HTTPS nyata',
    synopsis: 'curl [-X METHOD] [-H "K: V"] [-d BODY] [-i|-I|-s|--raw] [-o FILE] URL',
    description:
      'Mengirim permintaan GET, POST, PUT, PATCH, DELETE, atau HEAD melalui proxy server OS. Respons JSON otomatis dirapikan, dan halaman HTML otomatis ditampilkan sebagai teks bersih.',
    options: [
      '-X     Tentukan metode HTTP (GET, POST, PUT, DELETE, dll.)',
      '-H     Tambahkan header HTTP (mis. "Authorization: Bearer ...")',
      '-d     Kirim isi data/JSON (otomatis memakai metode POST)',
      '-i     Sertakan status & header respons di atas isi',
      '-I     Tampilkan header/status saja (HEAD)',
      '-s     Mode senyap tanpa metadata simpan',
      '--raw  Tampilkan sumber mentah tanpa perapian JSON/HTML',
      '-o     Simpan hasil ke berkas target di VFS atau /mnt/os',
    ],
    examples: [
      'curl https://example.com',
      'curl -X POST https://api.bariska.cloud/v1/chat/completions -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d \'{"model":"deepseek-v4.1-flash","messages":[{"role":"user","content":"Halo"}]}\'',
      'curl -o halaman.html https://example.com',
    ],
  },
  wget: {
    name: 'wget - unduh berkas dari web ke OS',
    synopsis: 'wget [-O NAMA] URL',
    description: 'Mengunduh sumber daya web melalui server OS dan menyimpannya ke folder aktif atau Download.',
    examples: ['wget https://example.com', 'wget -O info.html https://example.com'],
  },
  ping: {
    name: 'ping - uji latensi koneksi HTTP ke host',
    synopsis: 'ping [-c JUMLAH] HOST_ATAU_URL',
    description: 'Mengirimkan paket probe jaringan melalui proxy server OS dan mengukur waktu respons (ms).',
    examples: ['ping example.com', 'ping -c 3 wikipedia.org'],
  },
  ps: {
    name: 'ps - tampilkan proses aktif sistem OS',
    synopsis: 'ps',
    description: 'Menampilkan proses virtual OS termasuk kernel shell, jadwal alarm aktif, latar Tamagotchi, dan jaringan.',
    examples: ['ps', 'top'],
  },
  top: {
    name: 'top - monitor ringkas proses & sumber daya OS',
    synopsis: 'top',
    description: 'Menampilkan statistik CPU virtual, baterai, penggunaan penyimpanan IndexedDB, dan daftar proses.',
    examples: ['top'],
  },
  run: {
    name: 'run / sh - jalankan skrip shell terstruktur',
    synopsis: 'run SKRIP.sh',
    description:
      'Menjalankan skrip shell lengkap mendukung komentar #, variabel, substitusi $(cmd), dan blok kontrol if/then/else/fi, for/in/do/done, serta while.',
    examples: ['run halo.sh', 'sh /home/pixel/halo.sh'],
  },
  open: {
    name: 'open - luncurkan aplikasi Retro Pixel OS',
    synopsis: 'open APP_ID',
    description: 'Membuka aplikasi OS secara langsung. Gunakan "apps" untuk melihat semua ID aplikasi.',
    examples: ['open snake', 'open video-editor', 'open tv', 'open audio-studio'],
  },
  theme: {
    name: 'theme - ganti tema layar LCD OS secara live',
    synopsis: 'theme [classic|amber|paper|mint|inverted]',
    description: 'Mengubah tema warna seluruh sistem Retro Pixel OS seketika.',
    examples: ['theme amber', 'theme inverted', 'theme classic'],
  },
};

export function formatManPage(cmd: string): string | null {
  const key = cmd.toLowerCase().trim();
  const entry = LINUX_MAN_PAGES[key];
  if (!entry) return null;

  const lines = [
    `MANUAL(1)            Retro Pixel Linux            MANUAL(1)`,
    '',
    'NAMA',
    `    ${entry.name}`,
    '',
    'SINOPSIS',
    `    ${entry.synopsis}`,
    '',
    'DESKRIPSI',
    `    ${entry.description}`,
  ];
  if (entry.options && entry.options.length > 0) {
    lines.push('', 'OPSI');
    entry.options.forEach((o) => lines.push(`    ${o}`));
  }
  if (entry.examples && entry.examples.length > 0) {
    lines.push('', 'CONTOH');
    entry.examples.forEach((e) => lines.push(`    $ ${e}`));
  }
  return lines.join('\n');
}
