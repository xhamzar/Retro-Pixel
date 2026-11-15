'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PixelWallpaperArt, WALLPAPERS } from '@/src/components/PixelWallpapers';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord, WallpaperId } from '@/src/types/os';

interface GalleryItem {
  key: string;
  title: string;
  kind: 'photo' | 'wallpaper';
  fileId?: number;
  dataUrl?: string;
  wallpaperId?: WallpaperId;
  sizeKb?: number;
}

export const GalleryApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const wallpaperId = useOSStore((s) => s.wallpaperId);
  const customWallpaperUrl = useOSStore((s) => s.customWallpaperUrl);
  const setWallpaper = useOSStore((s) => s.setWallpaper);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const openApp = useOSStore((s) => s.openApp);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<VirtualFileRecord[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadPhotos = async () => {
    const rows = await db.files
      .where('folder')
      .equals('DCIM')
      .reverse()
      .toArray();
    setPhotos(rows);
    return rows;
  };

  useEffect(() => {
    let active = true;
    db.files
      .where('folder')
      .equals('DCIM')
      .reverse()
      .toArray()
      .then((rows) => {
        if (!active) return;
        setPhotos(rows);
        if (params?.fileId) {
          const foundIdx = rows.findIndex((r) => r.id === params.fileId);
          if (foundIdx >= 0) {
            setSelectedIdx(foundIdx);
            setPreviewOpen(true);
          }
        }
      });
    return () => {
      active = false;
    };
  }, [params?.fileId]);

  const items: GalleryItem[] = [
    ...photos.map((p): GalleryItem => {
      if (p.content.startsWith('wallpaper:')) {
        const wpId = p.content.replace('wallpaper:', '') as WallpaperId;
        return { key: `file-${p.id}`, title: p.name, kind: 'wallpaper', fileId: p.id, wallpaperId: wpId, sizeKb: p.sizeKb };
      }
      return { key: `file-${p.id}`, title: p.name, kind: 'photo', fileId: p.id, dataUrl: p.content, sizeKb: p.sizeKb };
    }),
    ...WALLPAPERS.map((wp): GalleryItem => ({
      key: `wp-${wp.id}`,
      title: language === 'id' ? wp.nameId : wp.nameEn,
      kind: 'wallpaper',
      wallpaperId: wp.id,
    })),
  ];

  const currentItem = items[selectedIdx] ?? items[0];

  const applyAsWallpaper = (item: GalleryItem) => {
    if (item.kind === 'photo' && item.dataUrl) {
      setWallpaper('village', item.dataUrl);
    } else if (item.wallpaperId) {
      setWallpaper(item.wallpaperId, null);
    }
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Wallpaper diterapkan!' : 'Wallpaper applied!');
  };

  const handleImportImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      if (!dataUrl) continue;
      await db.files.add({
        folder: 'DCIM',
        name: file.name,
        mimeType: file.type || 'image/png',
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        content: dataUrl,
        createdAt: Date.now(),
      });
    }
    e.target.value = '';
    await loadPhotos();
    setSelectedIdx(0);
    soundEngine.playCue('select');
    showToast(language === 'id' ? `${files.length} foto diimpor` : `${files.length} photo(s) imported`);
  };

  const deleteCurrentPhoto = async () => {
    if (!currentItem?.fileId) return;
    await db.files.delete(currentItem.fileId);
    soundEngine.playCue('back');
    showToast(language === 'id' ? 'Foto dihapus' : 'Photo deleted');
    setPreviewOpen(false);
    setSelectedIdx(0);
    loadPhotos();
  };

  const downloadCurrentPhoto = () => {
    if (!currentItem?.dataUrl) return;
    const a = document.createElement('a');
    a.href = currentItem.dataUrl;
    a.download = currentItem.title;
    a.click();
  };

  useEffect(() => {
    if (previewOpen && currentItem) {
      setSoftkeys({
        leftLabel: currentItem.fileId ? (language === 'id' ? 'Hapus' : 'Delete') : '',
        centerLabel: language === 'id' ? 'Wallpaper' : 'Set WP',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: currentItem.fileId ? deleteCurrentPhoto : undefined,
        onCenter: () => applyAsWallpaper(currentItem),
        onRight: () => setPreviewOpen(false),
      });
    } else {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Impor' : 'Import',
        centerLabel: language === 'id' ? 'Buka' : 'Open',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => fileInputRef.current?.click(),
        onCenter: () => {
          soundEngine.playCue('open');
          setPreviewOpen(true);
        },
        onRight: onBack,
      });
    }
  });

  const isCurrentActiveWp =
    currentItem?.kind === 'photo'
      ? customWallpaperUrl === currentItem.dataUrl
      : !customWallpaperUrl && currentItem?.wallpaperId === wallpaperId;

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={previewOpen && currentItem ? currentItem.title : language === 'id' ? 'Galeri' : 'Gallery'}
        onPrev={() => setSelectedIdx((i) => (i - 1 + items.length) % items.length)}
        onNext={() => setSelectedIdx((i) => (i + 1) % items.length)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImportImages}
        className="hidden"
      />

      {previewOpen && currentItem ? (
        <div className="flex-1 flex flex-col justify-between p-2.5 gap-2 min-h-0">
          <div className="flex-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] overflow-hidden flex items-center justify-center min-h-0">
            {currentItem.kind === 'photo' && currentItem.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentItem.dataUrl}
                alt={currentItem.title}
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : (
              <PixelWallpaperArt id={currentItem.wallpaperId ?? 'village'} />
            )}
          </div>
          <div className="flex items-center justify-between text-xs shrink-0">
            <span className="font-bold truncate">
              {currentItem.title}
              {currentItem.sizeKb ? ` · ${currentItem.sizeKb} KB` : ''}
            </span>
            {isCurrentActiveWp && (
              <span className="px-1.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold shrink-0">
                {language === 'id' ? 'Aktif' : 'Active'}
              </span>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => applyAsWallpaper(currentItem)}
              className="flex-1 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer truncate"
            >
              {language === 'id' ? 'Wallpaper' : 'Set WP'}
            </button>
            <button
              type="button"
              onClick={() =>
                openApp(
                  'photo-editor',
                  currentItem.fileId
                    ? { fileId: currentItem.fileId }
                    : { tab: currentItem.wallpaperId ?? 'village' },
                )
              }
              className="px-2.5 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
            >
              Edit
            </button>
            {currentItem.dataUrl && (
              <button
                type="button"
                onClick={downloadCurrentPhoto}
                className="px-2.5 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
              >
                ↓
              </button>
            )}
            {currentItem.fileId && (
              <button
                type="button"
                onClick={deleteCurrentPhoto}
                className="px-2.5 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-2 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold shrink-0">
            <span>{photos.length} {language === 'id' ? 'Foto' : 'Photos'} · {WALLPAPERS.length} Art</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-0.5 cursor-pointer"
            >
              + {language === 'id' ? 'Impor Foto' : 'Import'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll p-2 grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
            {items.map((item, idx) => {
              const selected = idx === selectedIdx;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setSelectedIdx(idx);
                    setPreviewOpen(true);
                    soundEngine.playCue('click');
                  }}
                  className={`flex flex-col border-2 border-[var(--lcd-fg)] p-1 text-left cursor-pointer ${
                    selected ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                  }`}
                >
                  <div className="h-16 w-full border border-current bg-[var(--lcd-bg)] text-[var(--lcd-fg)] overflow-hidden">
                    {item.kind === 'photo' && item.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.dataUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <PixelWallpaperArt id={item.wallpaperId ?? 'village'} />
                    )}
                  </div>
                  <span className="text-[11px] font-bold truncate mt-1">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
