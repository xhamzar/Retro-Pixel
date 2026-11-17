'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Maximize2,
  Minimize2,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  captureGalleryArtDataUrl,
  GALLERY_ARTWORKS,
  PixelGalleryArt,
  type GalleryArtId,
  type GalleryArtPalette,
} from '@/src/components/PixelGalleryArt';
import { PixelWallpaperArt, WALLPAPERS } from '@/src/components/PixelWallpapers';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord, WallpaperId } from '@/src/types/os';

type GalleryFilter = 'all' | 'animated' | 'pixel' | 'dcim';

interface GalleryItem {
  key: string;
  title: string;
  kind: 'photo' | 'art' | 'wallpaper';
  animated: boolean;
  fps?: number;
  totalFrames?: number;
  fileId?: number;
  dataUrl?: string;
  artId?: GalleryArtId;
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
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Pixel clarity & animation controls
  const [artPalette, setArtPalette] = useState<GalleryArtPalette>('color');
  const [isPlaying, setIsPlaying] = useState(true);
  const [animSpeed, setAnimSpeed] = useState<1 | 2>(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fillFrame, setFillFrame] = useState(false);
  const [photoCrispMode, setPhotoCrispMode] = useState(true);

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
          const found = rows.find((r) => r.id === params.fileId);
          if (found) {
            setFilter('all');
            setSelectedKey(`file-${found.id}`);
            setPreviewOpen(true);
          }
        }
      });
    return () => {
      active = false;
    };
  }, [params?.fileId]);

  const allItems = useMemo<GalleryItem[]>(() => {
    const dcimItems: GalleryItem[] = photos.map((p) => {
      if (p.content.startsWith('wallpaper:')) {
        const wpId = p.content.replace('wallpaper:', '') as WallpaperId;
        return {
          key: `file-${p.id}`,
          title: p.name,
          kind: 'wallpaper',
          animated: false,
          fileId: p.id,
          wallpaperId: wpId,
          sizeKb: p.sizeKb,
        };
      }
      return {
        key: `file-${p.id}`,
        title: p.name,
        kind: 'photo',
        animated: false,
        fileId: p.id,
        dataUrl: p.content,
        sizeKb: p.sizeKb,
      };
    });

    const artItems: GalleryItem[] = GALLERY_ARTWORKS.map((art) => ({
      key: `art-${art.id}`,
      title: language === 'id' ? art.titleId : art.titleEn,
      kind: 'art',
      animated: art.animated,
      fps: art.fps,
      totalFrames: art.totalFrames,
      artId: art.id,
    }));

    const wallpaperItems: GalleryItem[] = WALLPAPERS.map((wp) => ({
      key: `wp-${wp.id}`,
      title: language === 'id' ? wp.nameId : wp.nameEn,
      kind: 'wallpaper',
      animated: false,
      wallpaperId: wp.id,
    }));

    // Order user captures first, then crisp animated/static pixel art, then classic OS wallpapers
    return [...dcimItems, ...artItems, ...wallpaperItems];
  }, [language, photos]);

  const filteredItems = useMemo(() => {
    if (filter === 'animated') {
      return allItems.filter((item) => item.animated);
    }
    if (filter === 'pixel') {
      return allItems.filter((item) => item.kind === 'art' || item.kind === 'wallpaper');
    }
    if (filter === 'dcim') {
      return allItems.filter((item) => Boolean(item.fileId));
    }
    return allItems;
  }, [allItems, filter]);

  const selectedIdx = useMemo(() => {
    if (filteredItems.length === 0) return 0;
    const found = filteredItems.findIndex((i) => i.key === selectedKey);
    return found >= 0 ? found : 0;
  }, [filteredItems, selectedKey]);

  const currentItem = filteredItems[selectedIdx] ?? filteredItems[0];

  const selectByOffset = (delta: number) => {
    if (filteredItems.length === 0) return;
    const nextIdx = (selectedIdx + delta + filteredItems.length) % filteredItems.length;
    setSelectedKey(filteredItems[nextIdx].key);
    setCurrentFrame(0);
    setIsPlaying(true);
  };

  const applyAsWallpaper = (item: GalleryItem) => {
    if (item.kind === 'photo' && item.dataUrl) {
      setWallpaper('village', item.dataUrl);
    } else if (item.kind === 'art' && item.artId) {
      const snapshotUrl = captureGalleryArtDataUrl(item.artId, artPalette, currentFrame, 4);
      setWallpaper('village', snapshotUrl);
    } else if (item.wallpaperId) {
      setWallpaper(item.wallpaperId, null);
    }
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Wallpaper diterapkan!' : 'Wallpaper applied!');
  };

  const handleImportImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let firstId: number | undefined;
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      if (!dataUrl) continue;
      const insertedId = await db.files.add({
        folder: 'DCIM',
        name: file.name,
        mimeType: file.type || 'image/png',
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        content: dataUrl,
        createdAt: Date.now(),
      });
      if (!firstId && typeof insertedId === 'number') firstId = insertedId;
    }
    e.target.value = '';
    await loadPhotos();
    if (firstId) setSelectedKey(`file-${firstId}`);
    soundEngine.playCue('select');
    showToast(language === 'id' ? `${files.length} foto diimpor` : `${files.length} photo(s) imported`);
  };

  const deleteCurrentPhoto = async () => {
    if (!currentItem?.fileId) return;
    await db.files.delete(currentItem.fileId);
    soundEngine.playCue('back');
    showToast(language === 'id' ? 'Foto dihapus' : 'Photo deleted');
    setPreviewOpen(false);
    setSelectedKey('');
    loadPhotos();
  };

  const downloadCurrentItem = () => {
    if (!currentItem) return;
    let href = '';
    let filename = `${currentItem.title.replace(/\s+/g, '_')}.png`;

    if (currentItem.kind === 'photo' && currentItem.dataUrl) {
      href = currentItem.dataUrl;
      filename = currentItem.title;
    } else if (currentItem.kind === 'art' && currentItem.artId) {
      href = captureGalleryArtDataUrl(currentItem.artId, artPalette, currentFrame, 4);
    }
    if (!href) return;

    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Gambar disimpan (PNG)' : 'Image saved (PNG)');
  };

  const editCurrentItem = () => {
    if (!currentItem) return;
    if (currentItem.fileId) {
      openApp('photo-editor', { fileId: currentItem.fileId });
      return;
    }
    if (currentItem.kind === 'art' && currentItem.artId) {
      const snapshotUrl = captureGalleryArtDataUrl(currentItem.artId, artPalette, currentFrame, 4);
      openApp('photo-editor', {
        imageDataUrl: snapshotUrl,
        title: currentItem.title,
      });
      return;
    }
    openApp('photo-editor', { tab: currentItem.wallpaperId ?? 'village' });
  };

  useEffect(() => {
    if (previewOpen && currentItem) {
      setSoftkeys({
        leftLabel: currentItem.fileId
          ? language === 'id'
            ? 'Hapus'
            : 'Delete'
          : currentItem.animated
            ? isPlaying
              ? language === 'id'
                ? 'Jeda'
                : 'Pause'
              : language === 'id'
                ? 'Putar'
                : 'Play'
            : language === 'id'
              ? 'Warna'
              : 'Palette',
        centerLabel: language === 'id' ? 'Wallpaper' : 'Set WP',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: currentItem.fileId
          ? deleteCurrentPhoto
          : currentItem.animated
            ? () => {
                soundEngine.playCue('click');
                setIsPlaying((p) => !p);
              }
            : () => {
                soundEngine.playCue('click');
                setArtPalette((p) => (p === 'color' ? 'lcd' : 'color'));
              },
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
          if (!currentItem) return;
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
      : currentItem?.kind === 'wallpaper'
        ? !customWallpaperUrl && currentItem?.wallpaperId === wallpaperId
        : false;

  const animCount = allItems.filter((i) => i.animated).length;
  const pixelCount = allItems.filter((i) => i.kind === 'art' || i.kind === 'wallpaper').length;
  const dcimCount = allItems.filter((i) => Boolean(i.fileId)).length;

  const filterTabs: { id: GalleryFilter; label: string; count: number }[] = [
    { id: 'all', label: language === 'id' ? 'Semua' : 'All', count: allItems.length },
    { id: 'animated', label: language === 'id' ? 'Animasi' : 'Anim', count: animCount },
    { id: 'pixel', label: 'Pixel', count: pixelCount },
    { id: 'dcim', label: 'DCIM', count: dcimCount },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={previewOpen && currentItem ? currentItem.title : language === 'id' ? 'Galeri' : 'Gallery'}
        onPrev={() => selectByOffset(-1)}
        onNext={() => selectByOffset(1)}
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
        <div className="flex-1 flex flex-col justify-between p-2 gap-1.5 min-h-0">
          {/* Crisp Viewport Frame */}
          <div className="relative flex-1 border-2 border-[var(--lcd-fg)] bg-[#070b14] overflow-hidden flex items-center justify-center min-h-0">
            {currentItem.kind === 'photo' && currentItem.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentItem.dataUrl}
                alt={currentItem.title}
                className={`w-full h-full ${fillFrame ? 'object-cover' : 'object-contain'}`}
                style={{ imageRendering: photoCrispMode ? 'pixelated' : 'auto' }}
              />
            ) : currentItem.kind === 'art' && currentItem.artId ? (
              <PixelGalleryArt
                artId={currentItem.artId}
                palette={artPalette}
                playing={isPlaying}
                speed={animSpeed}
                onFrameChange={setCurrentFrame}
                className={`w-full h-full ${fillFrame ? 'object-cover' : 'object-contain'}`}
              />
            ) : (
              <div className="w-full h-full bg-[var(--lcd-bg)] flex items-center justify-center">
                <PixelWallpaperArt id={currentItem.wallpaperId ?? 'village'} className="w-full h-full" />
              </div>
            )}

            {/* Corner Unboxed Overlay Telemetry */}
            <div className="absolute top-1 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
              <span className="px-1 py-0.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold tracking-tight tabular-nums">
                {currentItem.animated
                  ? `ANIM · F${String(currentFrame + 1).padStart(2, '0')}/${currentItem.totalFrames ?? 16}`
                  : currentItem.kind === 'art'
                    ? '120×90 PX'
                    : currentItem.kind === 'photo'
                      ? 'DCIM'
                      : 'WP PIXEL'}
              </span>
              {isCurrentActiveWp && (
                <span className="px-1 py-0.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold">
                  {language === 'id' ? 'AKTIF' : 'ACTIVE'}
                </span>
              )}
            </div>
          </div>

          {/* Title & Quick Image Controls */}
          <div className="flex items-center justify-between gap-2 text-xs shrink-0 border-b border-[var(--lcd-fg)]/40 pb-1">
            <div className="min-w-0">
              <p className="font-bold truncate leading-tight">{currentItem.title}</p>
              <p className="text-[10px] opacity-80 tabular-nums leading-tight">
                {currentItem.animated
                  ? `${(currentItem.fps ?? 8) * animSpeed} FPS · ${artPalette === 'color' ? '16-Bit Color' : 'LCD Dither'}`
                  : currentItem.kind === 'art'
                    ? `Pixel Art · ${artPalette === 'color' ? '16-Bit Color' : 'LCD Dither'}`
                    : currentItem.sizeKb
                      ? `${currentItem.sizeKb} KB`
                      : 'Wallpaper OS'}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {currentItem.animated && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playCue('click');
                      setIsPlaying((p) => !p);
                    }}
                    title={isPlaying ? 'Jeda' : 'Putar'}
                    className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playCue('click');
                      setAnimSpeed((s) => (s === 1 ? 2 : 1));
                    }}
                    className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold tabular-nums cursor-pointer"
                  >
                    {animSpeed}x
                  </button>
                </>
              )}

              {currentItem.kind === 'art' && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('click');
                    setArtPalette((p) => (p === 'color' ? 'lcd' : 'color'));
                  }}
                  title={language === 'id' ? 'Ganti Palet Warna / LCD' : 'Toggle Color / LCD'}
                  className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Palette className="w-3 h-3" />
                  <span>{artPalette === 'color' ? 'RGB' : 'LCD'}</span>
                </button>
              )}

              {currentItem.kind === 'photo' && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playCue('click');
                    setPhotoCrispMode((v) => !v);
                  }}
                  className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer"
                >
                  {photoCrispMode ? 'PX' : 'SMOOTH'}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  setFillFrame((v) => !v);
                }}
                title={fillFrame ? 'Fit' : 'Zoom'}
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] cursor-pointer"
              >
                {fillFrame ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Primary Action Buttons */}
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
              onClick={editCurrentItem}
              className="px-2.5 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            {(currentItem.kind === 'photo' || currentItem.kind === 'art') && (
              <button
                type="button"
                onClick={downloadCurrentItem}
                title={language === 'id' ? 'Unduh PNG' : 'Download PNG'}
                className="px-2.5 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold flex items-center justify-center cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            {currentItem.fileId && (
              <button
                type="button"
                onClick={deleteCurrentPhoto}
                title={language === 'id' ? 'Hapus' : 'Delete'}
                className="px-2.5 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Category Filter & Palette Bar */}
          <div className="flex items-center justify-between gap-1 px-1.5 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {filterTabs.map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playCue('click');
                      setFilter(tab.id);
                    }}
                    className={`px-1.5 py-0.5 border border-[var(--lcd-fg)] text-[10px] font-bold whitespace-nowrap cursor-pointer tabular-nums ${
                      active
                        ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                        : 'bg-[var(--lcd-bg)] text-[var(--lcd-fg)]'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  setArtPalette((p) => (p === 'color' ? 'lcd' : 'color'));
                }}
                title={language === 'id' ? 'Mode Warna / LCD' : 'Color / LCD Mode'}
                className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
              >
                {artPalette === 'color' ? 'RGB' : 'LCD'}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={language === 'id' ? 'Impor Foto' : 'Import Photo'}
                className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{language === 'id' ? 'Impor' : 'Add'}</span>
              </button>
            </div>
          </div>

          {/* Crisp Pixel Thumbnail Grid */}
          {filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2 text-xs">
              <p className="font-bold">
                {language === 'id' ? 'Belum ada foto di folder DCIM' : 'No photos in DCIM yet'}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold cursor-pointer"
              >
                + {language === 'id' ? 'Impor Foto' : 'Import Photo'}
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto lcd-scroll p-2 grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
              {filteredItems.map((item) => {
                const selected = item.key === currentItem?.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSelectedKey(item.key);
                      setCurrentFrame(0);
                      setIsPlaying(true);
                      setPreviewOpen(true);
                      soundEngine.playCue('click');
                    }}
                    className={`flex flex-col border-2 border-[var(--lcd-fg)] p-1 text-left cursor-pointer ${
                      selected ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-sec)]'
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full border border-current bg-[#070b14] text-[var(--lcd-fg)] overflow-hidden">
                      {item.kind === 'photo' && item.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.dataUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : item.kind === 'art' && item.artId ? (
                        <PixelGalleryArt
                          artId={item.artId}
                          palette={artPalette}
                          playing={item.animated}
                          speed={1}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[var(--lcd-bg)]">
                          <PixelWallpaperArt id={item.wallpaperId ?? 'village'} className="w-full h-full" />
                        </div>
                      )}

                      {/* Unboxed Micro Type Tag */}
                      <span className="absolute top-0.5 left-0.5 px-1 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[9px] font-bold leading-tight">
                        {item.animated
                          ? 'ANIM'
                          : item.kind === 'art'
                            ? 'PX'
                            : item.kind === 'photo'
                              ? 'DCIM'
                              : 'WP'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <span className="text-[11px] font-bold truncate leading-tight">{item.title}</span>
                      {item.animated && (
                        <Play className="w-2.5 h-2.5 shrink-0 fill-current" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
