'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { PixelWallpaperArt } from '@/src/components/PixelWallpapers';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord, WallpaperId } from '@/src/types/os';

const FOLDERS: VirtualFileRecord['folder'][] = [
  'DCIM',
  'Download',
  'Musik',
  'Video',
  'Dokumen',
  'Lainnya',
];

export const FileManagerApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const openApp = useOSStore((s) => s.openApp);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentFolder, setCurrentFolder] = useState<VirtualFileRecord['folder'] | null>(() => {
    const f = params?.folder as VirtualFileRecord['folder'] | undefined;
    return f && FOLDERS.includes(f) ? f : null;
  });
  const [files, setFiles] = useState<VirtualFileRecord[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [inspectFile, setInspectFile] = useState<VirtualFileRecord | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);

  const loadFiles = async (folder: VirtualFileRecord['folder'] | null) => {
    if (!folder) {
      const all = await db.files.toArray();
      setFiles(all);
    } else {
      const list = await db.files.where('folder').equals(folder).reverse().toArray();
      setFiles(list);
    }
  };

  useEffect(() => {
    let active = true;
    const req = currentFolder
      ? db.files.where('folder').equals(currentFolder).reverse().toArray()
      : db.files.toArray();
    req.then((list) => {
      if (active) setFiles(list);
    });
    return () => {
      active = false;
    };
  }, [currentFolder]);

  const deleteFile = async (f: VirtualFileRecord) => {
    if (!f.id) return;
    await db.files.delete(f.id);
    soundEngine.playCue('back');
    showToast(language === 'id' ? 'Berkas dihapus' : 'File deleted');
    setInspectFile(null);
    setEditingText(null);
    loadFiles(currentFolder);
  };

  const createTextFile = async () => {
    const targetFolder = currentFolder ?? 'Dokumen';
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    const name = `Catatan_${stamp}.txt`;
    const id = await db.files.add({
      folder: targetFolder,
      name,
      mimeType: 'text/plain',
      sizeKb: 1,
      content: '',
      createdAt: Date.now(),
    });
    const created = await db.files.get(id);
    setCurrentFolder(targetFolder);
    if (created) {
      setInspectFile(created);
      setEditingText(created.content);
    }
    await loadFiles(targetFolder);
  };

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const targetFolder: VirtualFileRecord['folder'] = currentFolder ?? 'Download';

    for (const file of picked) {
      const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv|cfg|log)$/i.test(file.name);
      const content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        if (isText) reader.readAsText(file);
        else reader.readAsDataURL(file);
      });
      await db.files.add({
        folder: targetFolder,
        name: file.name,
        mimeType: file.type || (isText ? 'text/plain' : 'application/octet-stream'),
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        content,
        createdAt: Date.now(),
      });
    }
    e.target.value = '';
    setCurrentFolder(targetFolder);
    await loadFiles(targetFolder);
    soundEngine.playCue('select');
    showToast(language === 'id' ? `${picked.length} berkas diimpor` : `${picked.length} file(s) imported`);
  };

  const saveEditedText = async () => {
    if (!inspectFile?.id || editingText === null) return;
    const kb = Math.max(1, Math.ceil(new Blob([editingText]).size / 1024));
    await db.files.update(inspectFile.id, { content: editingText, sizeKb: kb });
    const updated = await db.files.get(inspectFile.id);
    if (updated) setInspectFile(updated);
    setEditingText(null);
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Perubahan disimpan' : 'Changes saved');
    loadFiles(currentFolder);
  };

  const downloadToDevice = (f: VirtualFileRecord) => {
    const a = document.createElement('a');
    if (f.content.startsWith('data:')) {
      a.href = f.content;
    } else {
      const blob = new Blob([f.content], { type: f.mimeType || 'text/plain' });
      a.href = URL.createObjectURL(blob);
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    a.download = f.name;
    a.click();
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Mengunduh ${f.name}` : `Downloading ${f.name}`);
  };

  useEffect(() => {
    if (inspectFile) {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Unduh' : 'Export',
        centerLabel: editingText !== null ? (language === 'id' ? 'Simpan' : 'Save') : 'OK',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => downloadToDevice(inspectFile),
        onCenter: () => {
          if (editingText !== null) saveEditedText();
          else {
            setInspectFile(null);
            setEditingText(null);
          }
        },
        onRight: () => {
          setInspectFile(null);
          setEditingText(null);
        },
      });
    } else if (currentFolder) {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Impor' : 'Import',
        centerLabel: language === 'id' ? 'Buka' : 'Open',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => fileInputRef.current?.click(),
        onCenter: () => {
          const item = files[selectedIdx];
          if (item) setInspectFile(item);
        },
        onRight: () => {
          setCurrentFolder(null);
          setSelectedIdx(0);
        },
      });
    } else {
      setSoftkeys({
        leftLabel: '+TXT',
        centerLabel: language === 'id' ? 'Buka' : 'Open',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: createTextFile,
        onCenter: () => {
          const f = FOLDERS[selectedIdx];
          if (f) {
            setCurrentFolder(f);
            setSelectedIdx(0);
          }
        },
        onRight: onBack,
      });
    }
  });

  const isTextFile = (f: VirtualFileRecord) =>
    f.mimeType.startsWith('text/') ||
    f.mimeType.includes('json') ||
    f.mimeType.includes('xml') ||
    /\.(txt|md|cfg|json|csv|log)$/i.test(f.name);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Manajer Berkas' : 'File Manager'}
        showChevrons={false}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleImportFiles}
        className="hidden"
      />

      {/* Path strip + quick actions */}
      <div className="flex items-center justify-between px-2 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold shrink-0">
        <span className="truncate">
          {currentFolder ? `Internal / ${currentFolder}` : language === 'id' ? 'Penyimpanan Internal' : 'Internal Storage'}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            type="button"
            onClick={createTextFile}
            className="border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-1.5 py-0.5 cursor-pointer"
          >
            +TXT
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-1.5 py-0.5 cursor-pointer"
          >
            +{language === 'id' ? 'Impor' : 'Import'}
          </button>
        </div>
      </div>

      {inspectFile ? (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2">
            <div className="text-sm font-bold break-all">{inspectFile.name}</div>
            <div className="text-xs opacity-85">
              {inspectFile.mimeType} · {inspectFile.sizeKb} KB
            </div>
            <div className="text-[10px] opacity-75">
              {new Date(inspectFile.createdAt).toLocaleString()}
            </div>
          </div>

          {inspectFile.content.startsWith('data:image/') ? (
            <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-1 flex flex-col gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inspectFile.content} alt={inspectFile.name} className="w-full max-h-44 object-contain" />
              <button
                type="button"
                onClick={() => openApp('gallery', { fileId: inspectFile.id })}
                className="w-full py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'Buka di Galeri' : 'Open in Gallery'}
              </button>
            </div>
          ) : inspectFile.content.startsWith('wallpaper:') ? (
            <div className="border-2 border-[var(--lcd-fg)] h-28 overflow-hidden">
              <PixelWallpaperArt id={inspectFile.content.replace('wallpaper:', '') as WallpaperId} />
            </div>
          ) : inspectFile.content.startsWith('data:audio/') ? (
            <div className="border-2 border-[var(--lcd-fg)] p-2 space-y-1.5 bg-[var(--lcd-sec)]">
              <audio controls src={inspectFile.content} className="w-full h-8" />
              <button
                type="button"
                onClick={() => openApp('music', { fileId: inspectFile.id })}
                className="w-full py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'Buka di Pemutar Musik' : 'Open in Music Player'}
              </button>
            </div>
          ) : isTextFile(inspectFile) ? (
            editingText !== null ? (
              <div className="space-y-1.5">
                <textarea
                  rows={6}
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-2 text-xs outline-none resize-none"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={saveEditedText}
                    className="flex-1 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Simpan Teks' : 'Save Text'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingText(null)}
                    className="px-3 py-1 border-2 border-[var(--lcd-fg)] text-xs font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Batal' : 'Cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="border-2 border-[var(--lcd-fg)] p-2 text-xs whitespace-pre-wrap break-words max-h-40 overflow-y-auto lcd-scroll">
                  {inspectFile.content || (language === 'id' ? '(Berkas kosong)' : '(Empty file)')}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingText(inspectFile.content)}
                    className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Edit Teks' : 'Edit Text'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openApp('ebook', { fileId: inspectFile.id })}
                    className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Baca di E-Book' : 'Read in E-Book'}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="border-2 border-[var(--lcd-fg)] p-2 text-xs">
              {language === 'id'
                ? 'Berkas biner tersimpan lokal. Gunakan tombol Ekspor untuk mengunduh ke perangkat Anda.'
                : 'Binary file stored locally. Use Export to download to your device.'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => downloadToDevice(inspectFile)}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'Ekspor ke Perangkat' : 'Download File'}
            </button>
            <button
              type="button"
              onClick={() => deleteFile(inspectFile)}
              className="py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'Hapus Berkas' : 'Delete File'}
            </button>
          </div>
        </div>
      ) : !currentFolder ? (
        <div className="flex-1 overflow-y-auto lcd-scroll divide-y border-[var(--lcd-fg)]">
          {FOLDERS.map((folder, idx) => {
            const count = files.filter((f) => f.folder === folder).length;
            const selected = idx === selectedIdx;
            return (
              <button
                key={folder}
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  setCurrentFolder(folder);
                  setSelectedIdx(0);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-left cursor-pointer ${
                  selected ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-sec)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PixelIcon name="folder" size={24} />
                  <span className="text-base font-bold">{folder}</span>
                </div>
                <span className="text-xs font-bold">{count} item</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto lcd-scroll divide-y border-[var(--lcd-fg)]">
          {files.length === 0 ? (
            <div className="p-4 text-center text-sm space-y-2">
              <div>{language === 'id' ? 'Folder kosong.' : 'Folder is empty.'}</div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-3 py-1 text-xs font-bold cursor-pointer"
              >
                + {language === 'id' ? 'Impor Berkas' : 'Import Files'}
              </button>
            </div>
          ) : (
            files.map((file, idx) => {
              const selected = idx === selectedIdx;
              return (
                <button
                  key={file.id ?? file.name}
                  type="button"
                  onClick={() => {
                    setSelectedIdx(idx);
                    setInspectFile(file);
                    setEditingText(null);
                    soundEngine.playCue('click');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 text-left cursor-pointer ${
                    selected ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'hover:bg-[var(--lcd-sec)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PixelIcon
                      name={
                        file.mimeType.startsWith('image/')
                          ? 'gallery'
                          : file.mimeType.startsWith('audio/')
                            ? 'music'
                            : 'note'
                      }
                      size={20}
                    />
                    <span className="text-xs sm:text-sm font-bold truncate">{file.name}</span>
                  </div>
                  <span className="text-[11px] shrink-0 ml-2 tabular-nums">{file.sizeKb} KB</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
