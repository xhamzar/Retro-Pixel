'use client';

import { db } from '@/src/services/db';
import type { VirtualFileRecord } from '@/src/types/os';

export type VirtualFolder = VirtualFileRecord['folder'];

export const OS_FOLDERS: VirtualFolder[] = [
  'DCIM',
  'Dokumen',
  'Download',
  'Lainnya',
  'Musik',
  'Video',
];

export const DEFAULT_HOME = '/home/pixel';
const VFS_STORAGE_KEY = 'rpos_linux_vfs_v1';

export interface LinuxVfsNode {
  path: string;
  type: 'dir' | 'file';
  mode: number; // e.g., 0o755, 0o644
  owner: string;
  group: string;
  content: string;
  mimeType?: string;
  osFileId?: number;
  osFolder?: VirtualFolder;
  sizeBytes?: number;
  createdAt: number;
  updatedAt: number;
}

type PersistedVfsMap = Record<string, LinuxVfsNode>;

function makeSeedTree(): PersistedVfsMap {
  const now = Date.now();
  const dir = (path: string, mode = 0o755, owner = 'pixel'): LinuxVfsNode => ({
    path,
    type: 'dir',
    mode,
    owner,
    group: owner === 'root' ? 'root' : 'staff',
    content: '',
    createdAt: now,
    updatedAt: now,
  });
  const file = (path: string, content: string, mode = 0o644, owner = 'pixel'): LinuxVfsNode => ({
    path,
    type: 'file',
    mode,
    owner,
    group: owner === 'root' ? 'root' : 'staff',
    content,
    mimeType: 'text/plain',
    sizeBytes: new Blob([content]).size,
    createdAt: now,
    updatedAt: now,
  });

  return {
    '/': dir('/', 0o755, 'root'),
    '/bin': dir('/bin', 0o755, 'root'),
    '/etc': dir('/etc', 0o755, 'root'),
    '/home': dir('/home', 0o755, 'root'),
    '/home/pixel': dir('/home/pixel', 0o755, 'pixel'),
    '/mnt': dir('/mnt', 0o755, 'root'),
    '/mnt/os': dir('/mnt/os', 0o755, 'pixel'),
    '/tmp': dir('/tmp', 0o777, 'root'),
    '/var': dir('/var', 0o755, 'root'),
    '/var/log': dir('/var/log', 0o755, 'root'),

    '/bin/sh': file('/bin/sh', '#!/bin/sh\n# PixelLinux Shell Link\n', 0o755, 'root'),
    '/etc/hostname': file('/etc/hostname', 'retro-pixel\n', 0o644, 'root'),
    '/etc/os-release': file(
      '/etc/os-release',
      'NAME="Retro Pixel Linux"\nVERSION="2.4 LTS"\nID=retropixel\nSHELL=PixelShell\nHOME_URL="pixel://home"',
      0o644,
      'root'
    ),
    '/etc/motd': file(
      '/etc/motd',
      'Selamat datang di PixelLinux 2.4!\nFolder OS asli dimount pada /mnt/os (atau /Dokumen, /DCIM).\nKetik "man nano" atau "nano halo.sh" untuk mulai menyunting.',
      0o644,
      'root'
    ),
    '/etc/passwd': file(
      '/etc/passwd',
      'root:x:0:0:root:/:/bin/sh\npixel:x:1000:1000:Pixel User:/home/pixel:/bin/sh',
      0o644,
      'root'
    ),
    '/var/log/syslog': file(
      '/var/log/syslog',
      '[BOOT] Kernel RetroPixelOS 2.4 monokrom siap\n[VFS] IndexedDB /mnt/os terhubung\n[NET] Proxy HTTP/HTTPS siap digunakan curl & ping',
      0o644,
      'root'
    ),
    '/home/pixel/README.md': file(
      '/home/pixel/README.md',
      '# PixelLinux Shell\n\nContoh perintah:\n  ls -la /mnt/os/Dokumen\n  mkdir -p proyek/src\n  nano proyek/src/app.sh\n  run halo.sh\n  curl -s https://example.com | head -n 5\n  ps && top',
      0o644,
      'pixel'
    ),
    '/home/pixel/halo.sh': file(
      '/home/pixel/halo.sh',
      '# Contoh skrip Linux lengkap (if, for, $(cmd))\necho "Halo dari $(whoami)@$(cat /etc/hostname)"\nfor f in DCIM Dokumen Musik; do\n  echo "Mount OS: /mnt/os/$f"\ndone\nif [ -f /etc/os-release ]; then\n  echo "OS Terverifikasi: OK"\nelse\n  echo "OS Tidak ditemukan"\nfi',
      0o755,
      'pixel'
    ),
  };
}

function loadVfsMap(): PersistedVfsMap {
  if (typeof window === 'undefined') return makeSeedTree();
  try {
    const raw = window.localStorage.getItem(VFS_STORAGE_KEY);
    if (!raw) {
      const seed = makeSeedTree();
      window.localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as PersistedVfsMap;
    if (!parsed['/'] || !parsed['/home/pixel']) {
      const seed = { ...makeSeedTree(), ...parsed };
      window.localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return parsed;
  } catch {
    return makeSeedTree();
  }
}

function saveVfsMap(map: PersistedVfsMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore localStorage quota failures cleanly
  }
}

export function normalizeLinuxPath(rawPath: string, cwd: string, home = DEFAULT_HOME): string {
  let p = rawPath.trim();
  if (!p || p === '~') return home;
  if (p.startsWith('~/')) p = `${home}/${p.slice(2)}`;

  // Allow shorthand OS root mounts like /Dokumen or /DCIM/foto.png -> /mnt/os/...
  if (p.startsWith('/')) {
    const firstSeg = p.slice(1).split('/')[0] ?? '';
    const matchedOs = OS_FOLDERS.find((f) => f.toLowerCase() === firstSeg.toLowerCase());
    if (matchedOs) {
      const rest = p.slice(1 + firstSeg.length);
      p = `/mnt/os/${matchedOs}${rest}`;
    }
  } else {
    p = `${cwd === '/' ? '' : cwd}/${p}`;
  }

  const stack: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      stack.pop();
    } else {
      stack.push(seg);
    }
  }
  return stack.length === 0 ? '/' : `/${stack.join('/')}`;
}

function getParentPath(absPath: string): string {
  if (absPath === '/') return '/';
  const idx = absPath.lastIndexOf('/');
  return idx <= 0 ? '/' : absPath.slice(0, idx);
}

function getBaseName(absPath: string): string {
  if (absPath === '/') return '/';
  const idx = absPath.lastIndexOf('/');
  return absPath.slice(idx + 1);
}

function parseOsMountPath(absPath: string): {
  isOsRoot: boolean;
  folder: VirtualFolder | null;
  fileName: string | null;
} {
  if (absPath === '/mnt/os') {
    return { isOsRoot: true, folder: null, fileName: null };
  }
  if (!absPath.startsWith('/mnt/os/')) {
    return { isOsRoot: false, folder: null, fileName: null };
  }
  const sub = absPath.slice('/mnt/os/'.length);
  const parts = sub.split('/').filter(Boolean);
  if (parts.length === 0) return { isOsRoot: true, folder: null, fileName: null };
  const folder = OS_FOLDERS.find((f) => f.toLowerCase() === parts[0].toLowerCase()) ?? null;
  if (!folder) return { isOsRoot: false, folder: null, fileName: null };
  if (parts.length === 1) return { isOsRoot: false, folder, fileName: null };
  return { isOsRoot: false, folder, fileName: parts.slice(1).join('_') };
}

export function formatPermissions(node: LinuxVfsNode): string {
  const prefix = node.type === 'dir' ? 'd' : '-';
  const triad = (n: number) =>
    `${n & 4 ? 'r' : '-'}${n & 2 ? 'w' : '-'}${n & 1 ? 'x' : '-'}`;
  const o = (node.mode >> 6) & 7;
  const g = (node.mode >> 3) & 7;
  const w = node.mode & 7;
  return `${prefix}${triad(o)}${triad(g)}${triad(w)}`;
}

export async function statLinuxNode(absPath: string): Promise<LinuxVfsNode | null> {
  const mount = parseOsMountPath(absPath);
  if (mount.isOsRoot) {
    return {
      path: '/mnt/os',
      type: 'dir',
      mode: 0o755,
      owner: 'pixel',
      group: 'staff',
      content: '',
      createdAt: 0,
      updatedAt: 0,
    };
  }
  if (mount.folder && !mount.fileName) {
    return {
      path: `/mnt/os/${mount.folder}`,
      type: 'dir',
      mode: 0o755,
      owner: 'pixel',
      group: 'staff',
      content: '',
      osFolder: mount.folder,
      createdAt: 0,
      updatedAt: 0,
    };
  }
  if (mount.folder && mount.fileName) {
    const all = await db.files.toArray();
    const rec = all.find(
      (f) => f.folder === mount.folder && f.name.toLowerCase() === mount.fileName!.toLowerCase()
    );
    if (!rec) return null;
    return {
      path: `/mnt/os/${mount.folder}/${rec.name}`,
      type: 'file',
      mode: rec.name.endsWith('.sh') ? 0o755 : 0o644,
      owner: 'pixel',
      group: 'staff',
      content: rec.content,
      mimeType: rec.mimeType,
      osFileId: rec.id,
      osFolder: rec.folder,
      sizeBytes: Math.max(rec.sizeKb * 1024, rec.content.length),
      createdAt: rec.createdAt,
      updatedAt: rec.createdAt,
    };
  }

  const map = loadVfsMap();
  return map[absPath] ?? null;
}

export async function listLinuxDir(absPath: string): Promise<{ nodes: LinuxVfsNode[]; error?: string }> {
  const mount = parseOsMountPath(absPath);
  if (mount.isOsRoot) {
    return {
      nodes: OS_FOLDERS.map((folder) => ({
        path: `/mnt/os/${folder}`,
        type: 'dir',
        mode: 0o755,
        owner: 'pixel',
        group: 'staff',
        content: '',
        osFolder: folder,
        createdAt: 0,
        updatedAt: 0,
      })),
    };
  }
  if (mount.folder && !mount.fileName) {
    const files = await db.files.where('folder').equals(mount.folder).toArray();
    return {
      nodes: files.map((rec) => ({
        path: `/mnt/os/${mount.folder}/${rec.name}`,
        type: 'file',
        mode: rec.name.endsWith('.sh') ? 0o755 : 0o644,
        owner: 'pixel',
        group: 'staff',
        content: rec.content,
        mimeType: rec.mimeType,
        osFileId: rec.id,
        osFolder: rec.folder,
        sizeBytes: Math.max(rec.sizeKb * 1024, rec.content.length),
        createdAt: rec.createdAt,
        updatedAt: rec.createdAt,
      })),
    };
  }

  const target = await statLinuxNode(absPath);
  if (!target) return { nodes: [], error: `Direktori tidak ditemukan: ${absPath}` };
  if (target.type === 'file') return { nodes: [target] };

  const map = loadVfsMap();
  const prefix = absPath === '/' ? '/' : `${absPath}/`;
  const children = Object.values(map).filter((node) => {
    if (node.path === absPath) return false;
    if (!node.path.startsWith(prefix)) return false;
    const rel = node.path.slice(prefix.length);
    return !rel.includes('/');
  });
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
  return { nodes: children };
}

export function formatNodeReadableContent(node: LinuxVfsNode): string {
  if (node.content.startsWith('data:image/')) {
    return `[BINER GAMBAR ${node.mimeType ?? 'image/*'} · ${Math.ceil((node.sizeBytes ?? 0) / 1024)} KB · Buka: openfile ${node.path}]`;
  }
  if (node.content.startsWith('data:audio/')) {
    return `[BINER AUDIO ${node.mimeType ?? 'audio/*'} · ${Math.ceil((node.sizeBytes ?? 0) / 1024)} KB · Buka: openfile ${node.path}]`;
  }
  if (node.content.startsWith('data:video/')) {
    return `[BINER VIDEO ${node.mimeType ?? 'video/*'} · ${Math.ceil((node.sizeBytes ?? 0) / 1024)} KB · Buka: openfile ${node.path}]`;
  }
  return node.content;
}

export async function writeLinuxFile(
  absPath: string,
  content: string,
  mode: 'overwrite' | 'append' = 'overwrite',
  mimeHint?: string
): Promise<{ node?: LinuxVfsNode; error?: string }> {
  const mount = parseOsMountPath(absPath);
  if (mount.isOsRoot || (mount.folder && !mount.fileName)) {
    return { error: `Tidak bisa menulis file langsung sebagai folder OS: ${absPath}` };
  }

  if (mount.folder && mount.fileName) {
    const existing = await statLinuxNode(absPath);
    const nextContent =
      mode === 'append' && existing
        ? existing.content
          ? `${existing.content}\n${content}`
          : content
        : content;
    const sizeKb = Math.max(1, Math.ceil(new Blob([nextContent]).size / 1024));
    const mimeType =
      mimeHint ||
      (mount.fileName.endsWith('.cfg')
        ? 'text/config'
        : mount.fileName.endsWith('.json')
          ? 'application/json'
          : 'text/plain');

    if (existing?.osFileId) {
      await db.files.update(existing.osFileId, { content: nextContent, sizeKb });
      return {
        node: {
          ...existing,
          content: nextContent,
          sizeBytes: nextContent.length,
          updatedAt: Date.now(),
        },
      };
    }

    const id = await db.files.add({
      folder: mount.folder,
      name: mount.fileName,
      mimeType,
      sizeKb,
      content: nextContent,
      createdAt: Date.now(),
    });
    const created: LinuxVfsNode = {
      path: `/mnt/os/${mount.folder}/${mount.fileName}`,
      type: 'file',
      mode: mount.fileName.endsWith('.sh') ? 0o755 : 0o644,
      owner: 'pixel',
      group: 'staff',
      content: nextContent,
      mimeType,
      osFileId: Number(id),
      osFolder: mount.folder,
      sizeBytes: nextContent.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return { node: created };
  }

  if (absPath.startsWith('/mnt/os')) {
    return { error: `Folder mount OS hanya mendukung: ${OS_FOLDERS.join(', ')}` };
  }

  const map = loadVfsMap();
  const parentPath = getParentPath(absPath);
  const parent = map[parentPath];
  if (!parent || parent.type !== 'dir') {
    return { error: `Direktori induk tidak ada: ${parentPath}` };
  }
  const existing = map[absPath];
  if (existing && existing.type === 'dir') {
    return { error: `${absPath} adalah sebuah direktori` };
  }

  const nextContent =
    mode === 'append' && existing
      ? existing.content
        ? `${existing.content}\n${content}`
        : content
      : content;
  const now = Date.now();
  const nextNode: LinuxVfsNode = {
    path: absPath,
    type: 'file',
    mode: existing?.mode ?? (absPath.endsWith('.sh') ? 0o755 : 0o644),
    owner: existing?.owner ?? 'pixel',
    group: existing?.group ?? 'staff',
    content: nextContent,
    mimeType: mimeHint ?? 'text/plain',
    sizeBytes: new Blob([nextContent]).size,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  map[absPath] = nextNode;
  saveVfsMap(map);
  return { node: nextNode };
}

export async function mkdirLinux(
  absPath: string,
  recursive: boolean
): Promise<{ error?: string }> {
  if (absPath.startsWith('/mnt/os')) {
    return { error: 'Folder mount /mnt/os tetap (DCIM, Dokumen, Download, Lainnya, Musik, Video).' };
  }
  const map = loadVfsMap();
  if (map[absPath]) {
    if (recursive && map[absPath].type === 'dir') return {};
    return { error: `Sudah ada: ${absPath}` };
  }

  const parts = absPath.split('/').filter(Boolean);
  if (!recursive) {
    const parent = getParentPath(absPath);
    if (!map[parent] || map[parent].type !== 'dir') {
      return { error: `Direktori induk tidak ada: ${parent} (gunakan mkdir -p)` };
    }
    const now = Date.now();
    map[absPath] = {
      path: absPath,
      type: 'dir',
      mode: 0o755,
      owner: 'pixel',
      group: 'staff',
      content: '',
      createdAt: now,
      updatedAt: now,
    };
    saveVfsMap(map);
    return {};
  }

  let cur = '';
  const now = Date.now();
  for (const seg of parts) {
    cur += `/${seg}`;
    if (!map[cur]) {
      map[cur] = {
        path: cur,
        type: 'dir',
        mode: 0o755,
        owner: 'pixel',
        group: 'staff',
        content: '',
        createdAt: now,
        updatedAt: now,
      };
    } else if (map[cur].type !== 'dir') {
      return { error: `${cur} adalah file, bukan direktori` };
    }
  }
  saveVfsMap(map);
  return {};
}

export async function removeLinuxNode(
  absPath: string,
  recursive: boolean,
  onlyEmptyDir = false
): Promise<{ error?: string }> {
  if (absPath === '/' || absPath === '/mnt' || absPath === '/mnt/os' || absPath === '/home' || absPath === '/home/pixel') {
    return { error: `Tidak diizinkan menghapus direktori sistem: ${absPath}` };
  }
  const mount = parseOsMountPath(absPath);
  if (mount.folder && !mount.fileName) {
    return { error: `Folder bawaan OS tidak dapat dihapus: ${absPath}` };
  }
  if (mount.folder && mount.fileName) {
    const existing = await statLinuxNode(absPath);
    if (!existing?.osFileId) return { error: `File tidak ditemukan: ${absPath}` };
    await db.files.delete(existing.osFileId);
    return {};
  }

  const map = loadVfsMap();
  const target = map[absPath];
  if (!target) return { error: `Tidak ditemukan: ${absPath}` };

  if (target.type === 'dir') {
    const prefix = `${absPath}/`;
    const descendants = Object.keys(map).filter((k) => k.startsWith(prefix));
    if (onlyEmptyDir && descendants.length > 0) {
      return { error: `rmdir: gagal menghapus '${absPath}': Direktori tidak kosong` };
    }
    if (!recursive && !onlyEmptyDir) {
      return { error: `rm: tidak bisa menghapus '${absPath}': Ini direktori (gunakan rm -r)` };
    }
    descendants.forEach((k) => delete map[k]);
  }
  delete map[absPath];
  saveVfsMap(map);
  return {};
}

export async function copyLinuxNode(
  srcAbs: string,
  dstAbs: string,
  recursive: boolean
): Promise<{ finalPath?: string; error?: string }> {
  const srcNode = await statLinuxNode(srcAbs);
  if (!srcNode) return { error: `Sumber tidak ditemukan: ${srcAbs}` };

  let targetAbs = dstAbs;
  const dstStat = await statLinuxNode(dstAbs);
  if (dstStat?.type === 'dir') {
    targetAbs = dstAbs === '/' ? `/${getBaseName(srcAbs)}` : `${dstAbs}/${getBaseName(srcAbs)}`;
  }

  if (srcNode.type === 'file') {
    const res = await writeLinuxFile(targetAbs, srcNode.content, 'overwrite', srcNode.mimeType);
    if (res.error) return { error: res.error };
    return { finalPath: res.node?.path ?? targetAbs };
  }

  if (!recursive) {
    return { error: `cp: -r tidak diberikan; melewati direktori '${srcAbs}'` };
  }
  const mkErr = await mkdirLinux(targetAbs, true);
  if (mkErr.error) return { error: mkErr.error };

  const { nodes } = await listLinuxDir(srcAbs);
  for (const child of nodes) {
    const childName = getBaseName(child.path);
    const childDst = `${targetAbs}/${childName}`;
    const res = await copyLinuxNode(child.path, childDst, true);
    if (res.error) return res;
  }
  return { finalPath: targetAbs };
}

export async function moveLinuxNode(
  srcAbs: string,
  dstAbs: string
): Promise<{ finalPath?: string; error?: string }> {
  const cpRes = await copyLinuxNode(srcAbs, dstAbs, true);
  if (cpRes.error) return cpRes;
  const rmRes = await removeLinuxNode(srcAbs, true);
  if (rmRes.error) return rmRes;
  return { finalPath: cpRes.finalPath };
}

export async function chmodLinuxNode(
  absPath: string,
  modeSpec: string
): Promise<{ newMode?: string; error?: string }> {
  if (absPath.startsWith('/mnt/os')) {
    return { error: 'Izin mount /mnt/os mengikuti sistem berkas OS.' };
  }
  const map = loadVfsMap();
  const node = map[absPath];
  if (!node) return { error: `Tidak ditemukan: ${absPath}` };

  let nextMode = node.mode;
  if (/^[0-7]{3,4}$/.test(modeSpec)) {
    nextMode = parseInt(modeSpec.slice(-3), 8);
  } else if (/^[ugoa]*[+-=][rwx]+$/.test(modeSpec)) {
    const op = modeSpec.includes('+') ? '+' : modeSpec.includes('-') ? '-' : '=';
    const [whoRaw, permsRaw] = modeSpec.split(/[+-=]/);
    const who = whoRaw || 'a';
    let bit = 0;
    if (permsRaw.includes('r')) bit |= 4;
    if (permsRaw.includes('w')) bit |= 2;
    if (permsRaw.includes('x')) bit |= 1;

    let mask = 0;
    if (who.includes('u') || who.includes('a')) mask |= bit << 6;
    if (who.includes('g') || who.includes('a')) mask |= bit << 3;
    if (who.includes('o') || who.includes('a')) mask |= bit;

    if (op === '+') nextMode |= mask;
    else if (op === '-') nextMode &= ~mask;
    else {
      let clearMask = 0;
      if (who.includes('u') || who.includes('a')) clearMask |= 0o700;
      if (who.includes('g') || who.includes('a')) clearMask |= 0o070;
      if (who.includes('o') || who.includes('a')) clearMask |= 0o007;
      nextMode = (nextMode & ~clearMask) | mask;
    }
  } else {
    return { error: `Format mode tidak valid: ${modeSpec} (contoh: 755 atau +x)` };
  }

  node.mode = nextMode;
  node.updatedAt = Date.now();
  saveVfsMap(map);
  return { newMode: formatPermissions(node) };
}

export async function chownLinuxNode(
  absPath: string,
  ownerSpec: string
): Promise<{ error?: string }> {
  if (absPath.startsWith('/mnt/os')) {
    return { error: 'Pemilik berkas di /mnt/os tetap (pixel:staff).' };
  }
  const map = loadVfsMap();
  const node = map[absPath];
  if (!node) return { error: `Tidak ditemukan: ${absPath}` };
  const [owner, group] = ownerSpec.split(':');
  if (!owner) return { error: 'Gunakan: chown user[:group] <target>' };
  node.owner = owner;
  if (group) node.group = group;
  node.updatedAt = Date.now();
  saveVfsMap(map);
  return {};
}

export async function collectAllLinuxPaths(
  startAbs: string
): Promise<LinuxVfsNode[]> {
  const rootNode = await statLinuxNode(startAbs);
  if (!rootNode) return [];
  if (rootNode.type === 'file') return [rootNode];

  const out: LinuxVfsNode[] = [rootNode];
  const { nodes } = await listLinuxDir(startAbs);
  for (const child of nodes) {
    if (child.type === 'dir') {
      const sub = await collectAllLinuxPaths(child.path);
      out.push(...sub);
    } else {
      out.push(child);
    }
  }
  return out;
}

export async function buildLinuxTreeString(
  startAbs: string,
  depthLimit = 3
): Promise<string[]> {
  const lines: string[] = [startAbs];

  async function walk(dirPath: string, prefix: string, depth: number) {
    if (depth >= depthLimit) return;
    const { nodes } = await listLinuxDir(dirPath);
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      const isLast = i === nodes.length - 1;
      const name = getBaseName(n.path);
      const label = n.type === 'dir' ? `${name}/` : name;
      lines.push(`${prefix}${isLast ? '└─ ' : '├─ '}${label}`);
      if (n.type === 'dir') {
        await walk(n.path, `${prefix}${isLast ? '   ' : '│  '}`, depth + 1);
      }
    }
  }

  await walk(startAbs, '', 0);
  return lines;
}
