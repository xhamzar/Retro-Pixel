'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type {
  AppComponentProps,
  BookmarkRecord,
  BrowserHistoryRecord,
  ContactRecord,
  DownloadRecord,
  NoteRecord,
} from '@/src/types/os';

interface SearchResultItem {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
}

interface ReaderPayload {
  title: string;
  url: string;
  paragraphs: string[];
  links: { text: string; href: string }[];
  error?: string;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  historyStack: string[];
  historyIndex: number;
  viewMode: 'web' | 'reader';
  loading: boolean;
  reloadNonce: number;
}

const PIXEL_PAGES: Record<string, { title: string; paragraphs: string[]; links?: { label: string; url: string }[] }> = {
  'pixel://news': {
    title: 'Pixel News Portal',
    paragraphs: [
      'EDISI RETRO PIXEL — Berita teknologi ringkas untuk layar monokrom hemat daya.',
      '1. Browser Retro Pixel OS kini mendukung proxy web langsung, pencarian web otomatis, multi-tab, serta navigasi Back & Forward.',
      '2. Anda dapat mengetik domain seperti wikipedia.org atau kata kunci pencarian langsung di bilah alamat.',
    ],
    links: [
      { label: 'Buka Wikipedia (Mobile)', url: 'https://en.m.wikipedia.org' },
      { label: 'Buka Hacker News', url: 'https://news.ycombinator.com' },
      { label: 'Cek Cuaca Retro', url: 'pixel://weather' },
    ],
  },
  'pixel://weather': {
    title: 'Retro Weather Station',
    paragraphs: [
      'Kondisi: Cerah Berawan · Suhu: 28°C',
      'Kelembaban: 64% · Angin: 12 km/j Timur',
      'Prakiraan Besok: 29°C Cerah, peluang hujan 10%.',
    ],
    links: [
      { label: 'Cari Prakiraan BMKG di Web', url: 'pixel://search?q=prakiraan+cuaca+hari+ini' },
      { label: 'Kembali ke Beranda', url: 'pixel://home' },
    ],
  },
  'pixel://games-guide': {
    title: 'Pixel Game Guide',
    paragraphs: [
      'SNAKE: Gunakan tombol arah atau D-Pad untuk mengarahkan ular tanpa menabrak dinding atau ekor sendiri.',
      'TETRIS: Tekan Atas untuk memutar balok, Kiri/Kanan untuk menggeser, Bawah untuk menjatuhkan lebih cepat.',
    ],
    links: [
      { label: 'Cari Sejarah Tetris di Web', url: 'pixel://search?q=sejarah+game+tetris' },
      { label: 'Kembali ke Beranda', url: 'pixel://home' },
    ],
  },
};

function resolveOmniboxInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'pixel://home';
  if (trimmed.startsWith('pixel://')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Match domain or host/path without spaces (e.g. wikipedia.org, example.com/test)
  const looksLikeDomain =
    !/\s/.test(trimmed) &&
    /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*|\?.*|#.*)?$/.test(trimmed);

  if (looksLikeDomain) {
    return `https://${trimmed}`;
  }

  return `pixel://search?q=${encodeURIComponent(trimmed)}`;
}

function deriveTabTitle(url: string): string {
  if (url === 'pixel://home') return 'Beranda';
  if (url.startsWith('pixel://search?')) {
    const q = new URLSearchParams(url.split('?')[1] || '').get('q') || '';
    return q ? `Cari: ${q}` : 'Cari';
  }
  if (PIXEL_PAGES[url]) return PIXEL_PAGES[url].title;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function createTab(initialUrl = 'pixel://home'): BrowserTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: deriveTabTitle(initialUrl),
    url: initialUrl,
    historyStack: [initialUrl],
    historyIndex: 0,
    viewMode: 'web',
    loading: initialUrl.startsWith('http'),
    reloadNonce: 0,
  };
}

function formatOmniboxValue(url: string): string {
  if (url.startsWith('pixel://search?')) {
    return new URLSearchParams(url.split('?')[1] || '').get('q') || url;
  }
  return url;
}

export const BrowserApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const initialUrl = params?.url ? resolveOmniboxInput(String(params.url)) : 'pixel://home';
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab(initialUrl)]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const [urlInput, setUrlInput] = useState<string>(() => formatOmniboxValue(initialUrl));
  const [homeSearchInput, setHomeSearchInput] = useState<string>('');
  const [subView, setSubView] = useState<'browser' | 'bookmarks' | 'history'>('browser');

  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [history, setHistory] = useState<BrowserHistoryRecord[]>([]);

  const [searchState, setSearchState] = useState<{
    key: string;
    results: SearchResultItem[];
    error: string | null;
  }>({ key: '', results: [], error: null });

  const [readerState, setReaderState] = useState<{
    key: string;
    data: ReaderPayload | null;
  }>({ key: '', data: null });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const loadMeta = useCallback(async () => {
    const [bms, hist] = await Promise.all([
      db.bookmarks.toArray(),
      db.history.orderBy('visitedAt').reverse().limit(30).toArray(),
    ]);
    setBookmarks(bms);
    setHistory(hist);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.bookmarks.toArray(),
      db.history.orderBy('visitedAt').reverse().limit(30).toArray(),
    ]).then(([bms, hist]) => {
      if (!active) return;
      setBookmarks(bms);
      setHistory(hist);
    });
    return () => {
      active = false;
    };
  }, []);

  const recordVisit = useCallback(
    async (url: string, title: string) => {
      if (url === 'pixel://home') return;
      await db.history.add({
        title: title || url,
        url,
        visitedAt: Date.now(),
      });
      loadMeta();
    },
    [loadMeta]
  );

  const navigateInTab = useCallback(
    (rawInput: string, targetTabId?: string) => {
      const targetUrl = resolveOmniboxInput(rawInput);
      const tabId = targetTabId ?? activeTab.id;
      const derivedTitle = deriveTabTitle(targetUrl);
      const isHttp = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');

      soundEngine.playCue('open');
      setSubView('browser');
      setUrlInput(formatOmniboxValue(targetUrl));

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== tabId) return tab;
          const truncated = tab.historyStack.slice(0, tab.historyIndex + 1);
          const nextStack =
            truncated[truncated.length - 1] === targetUrl ? truncated : [...truncated, targetUrl];
          return {
            ...tab,
            url: targetUrl,
            title: derivedTitle,
            historyStack: nextStack,
            historyIndex: nextStack.length - 1,
            loading: isHttp,
            reloadNonce: tab.reloadNonce + 1,
          };
        })
      );

      recordVisit(targetUrl, derivedTitle);
    },
    [activeTab.id, recordVisit]
  );

  const openInNewTab = useCallback(
    (rawInput = 'pixel://home') => {
      const targetUrl = resolveOmniboxInput(rawInput);
      const nextTab = createTab(targetUrl);
      soundEngine.playCue('click');
      setTabs((prev) => [...prev, nextTab]);
      setActiveTabId(nextTab.id);
      setUrlInput(formatOmniboxValue(targetUrl));
      setSubView('browser');
      if (targetUrl !== 'pixel://home') {
        recordVisit(targetUrl, nextTab.title);
      }
    },
    [recordVisit]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      soundEngine.playCue('back');
      setTabs((prev) => {
        if (prev.length <= 1) {
          const fresh = createTab('pixel://home');
          setActiveTabId(fresh.id);
          setUrlInput(formatOmniboxValue(fresh.url));
          return [fresh];
        }
        const idx = prev.findIndex((t) => t.id === tabId);
        const remaining = prev.filter((t) => t.id !== tabId);
        if (tabId === activeTabId) {
          const fallback = remaining[Math.max(0, idx - 1)] ?? remaining[0];
          setActiveTabId(fallback.id);
          setUrlInput(formatOmniboxValue(fallback.url));
        }
        return remaining;
      });
    },
    [activeTabId]
  );

  const goHistoryBack = useCallback(() => {
    if (activeTab.historyIndex <= 0) return;
    soundEngine.playCue('click');
    const nextIdx = activeTab.historyIndex - 1;
    const targetUrl = activeTab.historyStack[nextIdx];
    const isHttp = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
    setUrlInput(formatOmniboxValue(targetUrl));
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              url: targetUrl,
              title: deriveTabTitle(targetUrl),
              historyIndex: nextIdx,
              loading: isHttp,
              reloadNonce: tab.reloadNonce + 1,
            }
          : tab
      )
    );
  }, [activeTab]);

  const goHistoryForward = useCallback(() => {
    if (activeTab.historyIndex >= activeTab.historyStack.length - 1) return;
    soundEngine.playCue('click');
    const nextIdx = activeTab.historyIndex + 1;
    const targetUrl = activeTab.historyStack[nextIdx];
    const isHttp = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
    setUrlInput(formatOmniboxValue(targetUrl));
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              url: targetUrl,
              title: deriveTabTitle(targetUrl),
              historyIndex: nextIdx,
              loading: isHttp,
              reloadNonce: tab.reloadNonce + 1,
            }
          : tab
      )
    );
  }, [activeTab]);

  const reloadOrStop = useCallback(() => {
    soundEngine.playCue('click');
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTab.id) return tab;
        if (tab.loading) {
          return { ...tab, loading: false };
        }
        const isHttp = tab.url.startsWith('http://') || tab.url.startsWith('https://');
        return {
          ...tab,
          loading: isHttp,
          reloadNonce: tab.reloadNonce + 1,
        };
      })
    );
  }, [activeTab.id]);

  const toggleViewMode = useCallback(() => {
    soundEngine.playCue('click');
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? { ...tab, viewMode: tab.viewMode === 'web' ? 'reader' : 'web' }
          : tab
      )
    );
  }, [activeTab.id]);

  const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);

  const toggleBookmark = useCallback(async () => {
    const existing = bookmarks.find((b) => b.url === activeTab.url);
    if (existing?.id) {
      await db.bookmarks.delete(existing.id);
      soundEngine.playCue('back');
      showToast(language === 'id' ? 'Bookmark dihapus' : 'Bookmark removed');
    } else {
      await db.bookmarks.add({
        title: activeTab.title || activeTab.url,
        url: activeTab.url,
        summary: 'Bookmark pengguna',
      });
      soundEngine.playCue('select');
      showToast(language === 'id' ? 'Ditambahkan ke Bookmark' : 'Bookmark saved');
    }
    loadMeta();
  }, [bookmarks, activeTab.url, activeTab.title, language, loadMeta, showToast]);

  const currentSearchKey = activeTab.url.startsWith('pixel://search?')
    ? `${activeTab.url}#${activeTab.reloadNonce}`
    : '';
  const searchQueryText = activeTab.url.startsWith('pixel://search?')
    ? new URLSearchParams(activeTab.url.split('?')[1] || '').get('q') || ''
    : '';
  const searchLoading = Boolean(currentSearchKey && searchQueryText && searchState.key !== currentSearchKey);
  const searchResults = searchState.key === currentSearchKey ? searchState.results : [];
  const searchError = searchState.key === currentSearchKey ? searchState.error : null;

  // Fetch search results when tab URL is pixel://search?q=...
  useEffect(() => {
    if (!currentSearchKey || !searchQueryText) return;

    const controller = new AbortController();

    fetch(`/api/browser/search?q=${encodeURIComponent(searchQueryText)}&lang=${language}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const raw = await res.text();
        if (!raw.trim().startsWith('{')) throw new Error('Non-JSON response');
        return JSON.parse(raw) as { results?: SearchResultItem[]; error?: string };
      })
      .then((data) => {
        const list = data.results ?? [];
        setSearchState({
          key: currentSearchKey,
          results: list,
          error: data.error && list.length === 0 ? data.error : null,
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSearchState({
          key: currentSearchKey,
          results: [],
          error: language === 'id' ? 'Gagal mengambil hasil pencarian.' : 'Failed to fetch search results.',
        });
      });

    return () => controller.abort();
  }, [currentSearchKey, searchQueryText, language]);

  const isHttpUrl = activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://');
  const currentReaderKey =
    isHttpUrl && activeTab.viewMode === 'reader' ? `${activeTab.url}#${activeTab.reloadNonce}` : '';
  const readerLoading = Boolean(currentReaderKey && readerState.key !== currentReaderKey);
  const readerData = readerState.key === currentReaderKey ? readerState.data : null;

  // Fetch reader content when tab is in 'reader' mode on http(s) URL
  useEffect(() => {
    if (!currentReaderKey) return;

    const controller = new AbortController();

    fetch(`/api/browser/proxy?url=${encodeURIComponent(activeTab.url)}&mode=reader`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const raw = await res.text();
        if (!raw.trim().startsWith('{')) throw new Error('Non-JSON response');
        return JSON.parse(raw) as ReaderPayload;
      })
      .then((data) => {
        setReaderState({ key: currentReaderKey, data });
        if (data.title) {
          setTabs((prev) =>
            prev.map((tab) => (tab.id === activeTab.id ? { ...tab, title: data.title } : tab))
          );
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setReaderState({
          key: currentReaderKey,
          data: {
            title: activeTab.url,
            url: activeTab.url,
            paragraphs: [],
            links: [],
            error: language === 'id' ? 'Gagal memuat mode baca.' : 'Failed to load reader mode.',
          },
        });
      })
      .finally(() => {
        setTabs((prev) =>
          prev.map((tab) => (tab.id === activeTab.id ? { ...tab, loading: false } : tab))
        );
      });

    return () => controller.abort();
  }, [currentReaderKey, activeTab.id, activeTab.url, language]);

  // Listen to navigation & title messages from the proxied iframe bridge
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) {
        return;
      }
      const data = event.data as
        | { type?: string; url?: string; title?: string; query?: string }
        | undefined;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'PIXEL_BROWSER_LOADED' || data.type === 'PIXEL_BROWSER_TITLE') {
        const nextTitle = data.title?.trim();
        const resolvedUrl = data.url && data.url.startsWith('http') ? data.url : undefined;
        if (resolvedUrl) {
          setUrlInput(formatOmniboxValue(resolvedUrl));
        }
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTab.id
              ? {
                  ...tab,
                  loading: false,
                  title: nextTitle || tab.title,
                  url: resolvedUrl ?? tab.url,
                }
              : tab
          )
        );
      } else if (data.type === 'PIXEL_BROWSER_NAVIGATE' && data.url) {
        navigateInTab(data.url, activeTab.id);
      } else if (data.type === 'PIXEL_BROWSER_OPEN_READER') {
        setTabs((prev) =>
          prev.map((tab) => (tab.id === activeTab.id ? { ...tab, viewMode: 'reader' } : tab))
        );
      } else if (data.type === 'PIXEL_BROWSER_SEARCH' && data.query) {
        navigateInTab(data.query, activeTab.id);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [activeTab.id, navigateInTab]);

  // Sync OS softkeys
  useEffect(() => {
    setSoftkeys({
      leftLabel: subView === 'bookmarks' ? (language === 'id' ? 'Halaman' : 'Page') : 'Bookmark',
      centerLabel:
        subView === 'history'
          ? language === 'id'
            ? 'Halaman'
            : 'Page'
          : language === 'id'
            ? 'Riwayat'
            : 'History',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => setSubView((v) => (v === 'bookmarks' ? 'browser' : 'bookmarks')),
      onCenter: () => setSubView((v) => (v === 'history' ? 'browser' : 'history')),
      onRight: () => {
        if (subView !== 'browser') setSubView('browser');
        else onBack();
      },
    });
  }, [subView, language, onBack, setSoftkeys]);

  const isSearchUrl = activeTab.url.startsWith('pixel://search?');
  const pixelPage = PIXEL_PAGES[activeTab.url];

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)] min-h-0">
      {/* Multi-Tab Strip */}
      <div className="flex items-center gap-1 px-1.5 pt-1 pb-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] overflow-x-auto lcd-scroll shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab.id && subView === 'browser';
          return (
            <div
              key={tab.id}
              onClick={() => {
                soundEngine.playCue('click');
                setActiveTabId(tab.id);
                setUrlInput(formatOmniboxValue(tab.url));
                setSubView('browser');
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setActiveTabId(tab.id);
                  setUrlInput(formatOmniboxValue(tab.url));
                  setSubView('browser');
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 border-2 border-[var(--lcd-fg)] min-w-[78px] max-w-[130px] text-xs font-bold cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                  : 'bg-[var(--lcd-bg)] text-[var(--lcd-fg)] hover:bg-[var(--lcd-sec)]'
              }`}
            >
              <span className="truncate flex-1">
                {tab.loading ? '⏳ ' : ''}
                {tab.title}
              </span>
              <button
                type="button"
                aria-label="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="px-1 leading-none hover:opacity-70 cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => openInNewTab('pixel://home')}
          title={language === 'id' ? 'Tab Baru' : 'New Tab'}
          aria-label="New tab"
          className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-xs font-bold cursor-pointer shrink-0"
        >
          +
        </button>

        <div className="ml-auto flex items-center gap-1 shrink-0 pl-1">
          <button
            type="button"
            onClick={() => setSubView((v) => (v === 'bookmarks' ? 'browser' : 'bookmarks'))}
            className={`px-1.5 py-1 border-2 border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
              subView === 'bookmarks' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
            }`}
            title="Bookmarks"
          >
            BM
          </button>
          <button
            type="button"
            onClick={() => setSubView((v) => (v === 'history' ? 'browser' : 'history'))}
            className={`px-1.5 py-1 border-2 border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
              subView === 'history' ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
            }`}
            title={language === 'id' ? 'Riwayat' : 'History'}
          >
            HIS
          </button>
        </div>
      </div>

      {/* Navigation Toolbar & Omnibox */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigateInTab(urlInput);
        }}
        className="flex items-center gap-1 px-1.5 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0"
      >
        <button
          type="button"
          onClick={goHistoryBack}
          disabled={activeTab.historyIndex <= 0}
          title={language === 'id' ? 'Mundur' : 'Back'}
          aria-label="Back"
          className="px-1.5 py-1 border-2 border-[var(--lcd-fg)] text-xs font-bold disabled:opacity-35 hover:bg-[var(--lcd-sec)] cursor-pointer shrink-0"
        >
          ←
        </button>
        <button
          type="button"
          onClick={goHistoryForward}
          disabled={activeTab.historyIndex >= activeTab.historyStack.length - 1}
          title={language === 'id' ? 'Maju' : 'Forward'}
          aria-label="Forward"
          className="px-1.5 py-1 border-2 border-[var(--lcd-fg)] text-xs font-bold disabled:opacity-35 hover:bg-[var(--lcd-sec)] cursor-pointer shrink-0"
        >
          →
        </button>
        <button
          type="button"
          onClick={reloadOrStop}
          title={activeTab.loading ? 'Stop' : language === 'id' ? 'Muat Ulang' : 'Reload'}
          aria-label="Reload"
          className="px-1.5 py-1 border-2 border-[var(--lcd-fg)] text-xs font-bold hover:bg-[var(--lcd-sec)] cursor-pointer shrink-0"
        >
          {activeTab.loading ? '✕' : '↻'}
        </button>
        <button
          type="button"
          onClick={() => navigateInTab('pixel://home')}
          title={language === 'id' ? 'Beranda' : 'Home'}
          aria-label="Home"
          className="px-1.5 py-1 border-2 border-[var(--lcd-fg)] text-xs font-bold hover:bg-[var(--lcd-sec)] cursor-pointer shrink-0"
        >
          ⌂
        </button>

        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          placeholder={language === 'id' ? 'URL atau cari di web...' : 'URL or search web...'}
          className="flex-1 min-w-0 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-1.5 py-1 text-xs font-bold outline-none"
        />

        <button
          type="submit"
          className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer shrink-0"
        >
          GO
        </button>

        {activeTab.url !== 'pixel://home' && (
          <button
            type="button"
            onClick={toggleBookmark}
            title="Bookmark"
            aria-label="Bookmark"
            className={`px-1.5 py-1 border-2 border-[var(--lcd-fg)] text-xs font-bold cursor-pointer shrink-0 ${
              isBookmarked ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
            }`}
          >
            {isBookmarked ? '★' : '☆'}
          </button>
        )}

        {isHttpUrl && (
          <button
            type="button"
            onClick={toggleViewMode}
            title={
              activeTab.viewMode === 'web'
                ? language === 'id'
                  ? 'Mode Baca LCD'
                  : 'LCD Reader Mode'
                : language === 'id'
                  ? 'Mode Web Penuh'
                  : 'Full Web Mode'
            }
            className="px-1.5 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold cursor-pointer shrink-0"
          >
            {activeTab.viewMode === 'web' ? 'LCD' : 'WEB'}
          </button>
        )}
      </form>

      {/* Thin loading bar */}
      {(activeTab.loading || searchLoading || readerLoading) && (
        <div className="h-1 w-full bg-[var(--lcd-sec)] overflow-hidden shrink-0">
          <div className="h-full w-1/2 bg-[var(--lcd-fg)] animate-pulse" />
        </div>
      )}

      {/* Main Browser Viewport */}
      {subView === 'browser' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 1. Speed Dial Start Page */}
          {activeTab.url === 'pixel://home' && (
            <div className="flex-1 overflow-y-auto lcd-scroll p-3 space-y-3">
              <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-3 text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <PixelIcon name="browser" size={28} />
                  <h3 className="text-base sm:text-lg font-bold leading-none">PIXEL WEB BROWSER</h3>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (homeSearchInput.trim()) {
                      navigateInTab(homeSearchInput);
                      setHomeSearchInput('');
                    }
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={homeSearchInput}
                    onChange={(e) => setHomeSearchInput(e.target.value)}
                    placeholder={
                      language === 'id'
                        ? 'Ketik kata kunci atau alamat web...'
                        : 'Search the web or type a URL...'
                    }
                    className="flex-1 min-w-0 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-1.5 text-xs sm:text-sm font-bold outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Cari' : 'Search'}
                  </button>
                </form>
              </div>

              <div>
                <div className="text-xs font-bold border-b-2 border-[var(--lcd-fg)] pb-1 mb-2">
                  {language === 'id' ? 'Situs Cepat & Bookmark' : 'Speed Dial & Bookmarks'}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { title: 'Wikipedia', url: 'https://en.m.wikipedia.org' },
                    { title: 'Hacker News', url: 'https://news.ycombinator.com' },
                    { title: 'Example.com', url: 'https://example.com' },
                    { title: 'Pixel News', url: 'pixel://news' },
                    ...bookmarks
                      .filter(
                        (b) =>
                          b.url !== 'https://en.m.wikipedia.org' &&
                          b.url !== 'pixel://news'
                      )
                      .slice(0, 4)
                      .map((b) => ({ title: b.title, url: b.url })),
                  ].map((item) => (
                    <button
                      key={item.url}
                      type="button"
                      onClick={() => navigateInTab(item.url)}
                      className="text-left border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-sec)] px-2 py-1.5 cursor-pointer"
                    >
                      <div className="text-xs font-bold truncate">{item.title}</div>
                      <div className="text-[10px] opacity-75 truncate">{item.url}</div>
                    </button>
                  ))}
                </div>
              </div>

              {history.length > 0 && (
                <div>
                  <div className="text-xs font-bold border-b-2 border-[var(--lcd-fg)] pb-1 mb-1.5">
                    {language === 'id' ? 'Terakhir Dikunjungi' : 'Recently Visited'}
                  </div>
                  <div className="space-y-1">
                    {history.slice(0, 4).map((h) => (
                      <button
                        key={h.id ?? `${h.url}-${h.visitedAt}`}
                        type="button"
                        onClick={() => navigateInTab(h.url)}
                        className="w-full flex items-center justify-between border border-[var(--lcd-fg)] px-2 py-1 text-left hover:bg-[var(--lcd-sec)] cursor-pointer"
                      >
                        <span className="text-xs font-bold truncate">{h.title}</span>
                        <span className="text-[10px] opacity-75 ml-2 shrink-0">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Web Search Results Page */}
          {isSearchUrl && (
            <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2">
              <div className="border-b-2 border-[var(--lcd-fg)] pb-1.5 flex items-center justify-between gap-2">
                <div className="text-xs sm:text-sm font-bold truncate">
                  {language === 'id' ? 'Hasil Pencarian:' : 'Search Results:'} &ldquo;{searchQueryText}&rdquo;
                </div>
                <button
                  type="button"
                  onClick={() => navigateInTab(`https://duckduckgo.com/?q=${encodeURIComponent(searchQueryText)}`)}
                  className="text-[10px] font-bold border border-[var(--lcd-fg)] px-1.5 py-0.5 hover:bg-[var(--lcd-sec)] cursor-pointer shrink-0"
                >
                  DDG Web ↗
                </button>
              </div>

              {searchLoading ? (
                <div className="p-4 text-center text-sm font-bold">
                  {language === 'id' ? 'Mencari di web...' : 'Searching the web...'}
                </div>
              ) : searchError ? (
                <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-3 text-xs space-y-2">
                  <div className="font-bold">{searchError}</div>
                  <button
                    type="button"
                    onClick={reloadOrStop}
                    className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-2 py-1 font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Coba Lagi' : 'Retry'}
                  </button>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs font-bold">
                  {language === 'id' ? 'Tidak ada hasil ditemukan.' : 'No results found.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((res, idx) => (
                    <div
                      key={`${res.url}-${idx}`}
                      className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-2 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigateInTab(res.url)}
                          className="text-left text-xs sm:text-sm font-bold underline hover:opacity-80 cursor-pointer leading-snug"
                        >
                          {res.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => openInNewTab(res.url)}
                          title={language === 'id' ? 'Buka di Tab Baru' : 'Open in New Tab'}
                          className="text-[10px] font-bold border border-[var(--lcd-fg)] px-1 py-0.5 hover:bg-[var(--lcd-sec)] cursor-pointer shrink-0"
                        >
                          +Tab
                        </button>
                      </div>
                      <div className="text-[10px] opacity-75 truncate">{res.displayUrl}</div>
                      {res.snippet && <p className="text-[11px] leading-snug">{res.snippet}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Built-in Offline Pixel Portals */}
          {pixelPage && (
            <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2">
              <div className="border-b-2 border-[var(--lcd-fg)] pb-1">
                <h3 className="text-lg font-bold leading-none">{pixelPage.title}</h3>
              </div>
              {pixelPage.paragraphs.map((p, idx) => (
                <p key={idx} className="text-sm leading-snug">
                  {p}
                </p>
              ))}
              {pixelPage.links && pixelPage.links.length > 0 && (
                <div className="pt-2 border-t-2 border-[var(--lcd-fg)] space-y-1">
                  {pixelPage.links.map((lk) => (
                    <button
                      key={lk.url}
                      type="button"
                      onClick={() => navigateInTab(lk.url)}
                      className="w-full text-left border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-2 py-1 text-xs font-bold hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
                    >
                      → {lk.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Live External Website (Full Proxied Web Mode) */}
          {isHttpUrl && activeTab.viewMode === 'web' && (
            <iframe
              ref={iframeRef}
              key={`${activeTab.id}-${activeTab.reloadNonce}`}
              src={`/api/browser/proxy?url=${encodeURIComponent(activeTab.url)}`}
              title={activeTab.title}
              onLoad={() => {
                setTabs((prev) =>
                  prev.map((tab) => (tab.id === activeTab.id ? { ...tab, loading: false } : tab))
                );
              }}
              className="flex-1 w-full bg-white border-0"
              sandbox="allow-scripts allow-forms allow-popups"
            />
          )}

          {/* 5. Live External Website (Monochrome LCD Reader Mode) */}
          {isHttpUrl && activeTab.viewMode === 'reader' && (
            <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2">
              {readerLoading ? (
                <div className="p-4 text-center text-sm font-bold">
                  {language === 'id' ? 'Memuat mode baca LCD...' : 'Loading LCD reader...'}
                </div>
              ) : readerData?.error ? (
                <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-3 text-xs space-y-2">
                  <div className="font-bold">{readerData.error}</div>
                  <button
                    type="button"
                    onClick={toggleViewMode}
                    className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-2 py-1 font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Kembali ke Mode Web' : 'Switch to Web Mode'}
                  </button>
                </div>
              ) : readerData ? (
                <>
                  <div className="border-b-2 border-[var(--lcd-fg)] pb-1">
                    <h3 className="text-base font-bold leading-snug">{readerData.title}</h3>
                    <div className="text-[10px] opacity-75 truncate">{readerData.url}</div>
                  </div>
                  {readerData.paragraphs.map((p, idx) => (
                    <p key={idx} className="text-xs sm:text-sm leading-relaxed">
                      {p}
                    </p>
                  ))}
                  {readerData.links.length > 0 && (
                    <div className="pt-2 border-t-2 border-[var(--lcd-fg)] space-y-1">
                      <div className="text-xs font-bold">
                        {language === 'id' ? 'Tautan di Halaman:' : 'Page Links:'}
                      </div>
                      {readerData.links.map((lk) => (
                        <button
                          key={lk.href}
                          type="button"
                          onClick={() => navigateInTab(lk.href)}
                          className="w-full text-left border border-[var(--lcd-fg)] px-2 py-1 text-xs font-bold hover:bg-[var(--lcd-sec)] truncate cursor-pointer"
                        >
                          → {lk.text}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Bookmarks Sub-View */}
      {subView === 'bookmarks' && (
        <div className="flex-1 overflow-y-auto lcd-scroll divide-y-2 divide-[var(--lcd-fg)]">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--lcd-sec)]">
            <span className="text-xs font-bold">Bookmark ({bookmarks.length})</span>
            <button
              type="button"
              onClick={() => setSubView('browser')}
              className="text-xs font-bold border border-[var(--lcd-fg)] px-1.5 py-0.5 cursor-pointer"
            >
              {language === 'id' ? 'Tutup' : 'Close'}
            </button>
          </div>
          {bookmarks.length === 0 ? (
            <div className="p-4 text-center text-sm">
              {language === 'id' ? 'Belum ada bookmark.' : 'No bookmarks yet.'}
            </div>
          ) : (
            bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="flex items-center justify-between gap-2 p-2 hover:bg-[var(--lcd-sec)]"
              >
                <button
                  type="button"
                  onClick={() => navigateInTab(bm.url)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="text-sm font-bold leading-none truncate">{bm.title}</div>
                  <div className="text-[11px] opacity-80 truncate mt-1">{bm.url}</div>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!bm.id) return;
                    await db.bookmarks.delete(bm.id);
                    soundEngine.playCue('back');
                    loadMeta();
                  }}
                  className="px-1.5 py-0.5 border border-[var(--lcd-fg)] text-xs font-bold cursor-pointer shrink-0"
                  title={language === 'id' ? 'Hapus' : 'Delete'}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* History Sub-View */}
      {subView === 'history' && (
        <div className="flex-1 overflow-y-auto lcd-scroll divide-y border-[var(--lcd-fg)]">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--lcd-sec)] border-b-2 border-[var(--lcd-fg)]">
            <span className="text-xs font-bold">
              {language === 'id' ? 'Riwayat Penjelajahan' : 'Browsing History'}
            </span>
            <div className="flex items-center gap-1.5">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await db.history.clear();
                    soundEngine.playCue('back');
                    loadMeta();
                  }}
                  className="text-[11px] font-bold border border-[var(--lcd-fg)] px-1.5 py-0.5 cursor-pointer"
                >
                  {language === 'id' ? 'Bersihkan' : 'Clear'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSubView('browser')}
                className="text-[11px] font-bold border border-[var(--lcd-fg)] px-1.5 py-0.5 cursor-pointer"
              >
                {language === 'id' ? 'Tutup' : 'Close'}
              </button>
            </div>
          </div>
          {history.length === 0 ? (
            <div className="p-4 text-center text-sm">
              {language === 'id' ? 'Belum ada riwayat.' : 'No history yet.'}
            </div>
          ) : (
            history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => navigateInTab(h.url)}
                className="w-full text-left p-2 hover:bg-[var(--lcd-sec)] cursor-pointer"
              >
                <div className="text-sm font-bold truncate">{h.title}</div>
                <div className="text-[11px] opacity-75 truncate">{h.url}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const DownloadsApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);
  const openApp = useOSStore((s) => s.openApp);

  const [items, setItems] = useState<DownloadRecord[]>([]);
  const [urlInput, setUrlInput] = useState('https://example.com');
  const [busy, setBusy] = useState(false);

  const loadDownloads = async () => {
    const rows = await db.downloads.orderBy('createdAt').reverse().toArray();
    setItems(rows);
  };

  useEffect(() => {
    let active = true;
    db.downloads
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .then((rows) => {
        if (active) setItems(rows);
      });
    return () => {
      active = false;
    };
  }, []);

  const startDownload = async (rawUrl?: string) => {
    const target = (rawUrl ?? urlInput).trim();
    if (!target) return;
    const normalized = /^https?:\/\//i.test(target) ? target : `https://${target}`;

    setBusy(true);
    soundEngine.playCue('open');
    const tempId = await db.downloads.add({
      name: normalized.split('/').pop() || 'download',
      url: normalized,
      sizeKb: 0,
      mimeType: 'application/octet-stream',
      status: 'downloading',
      progress: 35,
      createdAt: Date.now(),
    });
    await loadDownloads();

    try {
      const res = await fetch(`/api/browser/download?url=${encodeURIComponent(normalized)}`);
      const rawText = await res.text();
      if (!rawText.trim().startsWith('{')) {
        throw new Error(`HTTP ${res.status}: Respons server bukan JSON`);
      }
      const payload = JSON.parse(rawText) as {
        name?: string;
        url?: string;
        mimeType?: string;
        sizeKb?: number;
        content?: string;
        error?: string;
      };
      if (!res.ok || !payload.content) {
        throw new Error(payload.error || 'Download failed');
      }
      const fileId = await db.files.add({
        folder: 'Download',
        name: payload.name || 'file.dat',
        mimeType: payload.mimeType || 'application/octet-stream',
        sizeKb: payload.sizeKb || 1,
        content: payload.content,
        createdAt: Date.now(),
      });
      await db.downloads.update(tempId, {
        name: payload.name || 'file.dat',
        sizeKb: payload.sizeKb || 1,
        mimeType: payload.mimeType || 'application/octet-stream',
        status: 'completed',
        progress: 100,
        fileId,
      });
      soundEngine.playCue('notify');
      showToast(language === 'id' ? `Selesai: ${payload.name}` : `Downloaded: ${payload.name}`);
    } catch (err) {
      await db.downloads.update(tempId, { status: 'failed', progress: 0 });
      soundEngine.playCue('error');
      showToast(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(false);
      loadDownloads();
    }
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: language === 'id' ? 'Berkas' : 'Files',
      centerLabel: language === 'id' ? 'Unduh' : 'Fetch',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => openApp('files', { folder: 'Download' }),
      onCenter: () => startDownload(),
      onRight: onBack,
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Unduhan' : 'Downloads'} showChevrons={false} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startDownload();
        }}
        className="flex gap-1 p-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0"
      >
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://..."
          className="flex-1 min-w-0 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-0.5 text-xs outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-2.5 bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          {busy ? '...' : language === 'id' ? 'Unduh' : 'Get'}
        </button>
      </form>
      <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-2 min-h-0">
        {items.map((it) => (
          <div key={it.id} className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 space-y-1">
            <div className="flex justify-between items-center text-xs font-bold gap-2">
              <span className="truncate">{it.name}</span>
              <span className="shrink-0">
                {it.status === 'failed' ? 'GAGAL' : `${it.sizeKb} KB`}
              </span>
            </div>
            <div className="w-full h-2 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)]">
              <div className="h-full bg-[var(--lcd-fg)]" style={{ width: `${it.progress}%` }} />
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="truncate opacity-75">{it.url}</span>
              <div className="flex gap-1.5 shrink-0 ml-2">
                {it.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => openApp('files', { folder: 'Download' })}
                    className="underline font-bold cursor-pointer"
                  >
                    {language === 'id' ? 'Buka' : 'Open'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!it.id) return;
                    await db.downloads.delete(it.id);
                    loadDownloads();
                  }}
                  className="underline font-bold cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SharingApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [receivedCount, setReceivedCount] = useState(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const loadShareables = async () => {
    const [n, c] = await Promise.all([db.notes.toArray(), db.contacts.toArray()]);
    setNotes(n);
    setContacts(c);
  };

  useEffect(() => {
    let active = true;
    Promise.all([db.notes.toArray(), db.contacts.toArray()]).then(([n, c]) => {
      if (!active) return;
      setNotes(n);
      setContacts(c);
    });

    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('retro_pixel_share');
      channelRef.current = ch;
      ch.onmessage = async (ev) => {
        const msg = ev.data as { kind?: 'note'; title?: string; body?: string };
        if (msg?.kind === 'note' && msg.title) {
          await db.notes.add({
            title: `${msg.title} (Shared)`,
            body: msg.body || '',
            updatedAt: Date.now(),
          });
          setReceivedCount((c) => c + 1);
          soundEngine.playCue('notify');
          showToast(language === 'id' ? `Menerima catatan: ${msg.title}` : `Received: ${msg.title}`);
          loadShareables();
        }
      };
      return () => {
        active = false;
        ch.close();
      };
    }

    return () => {
      active = false;
    };
  }, [language, showToast]);

  const shareTextPayload = async (title: string, text: string) => {
    soundEngine.playCue('select');
    channelRef.current?.postMessage({ kind: 'note', title, body: text });

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text });
        showToast(language === 'id' ? 'Dibagikan via sistem' : 'Shared via system');
        return;
      } catch {
        // fallback to clipboard
      }
    }

    await navigator.clipboard?.writeText(`${title}\n${text}`).catch(() => undefined);
    showToast(language === 'id' ? 'Disalin & dikirim ke tab lain' : 'Copied & broadcast to tabs');
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: language === 'id' ? 'Segarkan' : 'Refresh',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: loadShareables,
      onRight: onBack,
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Berbagi Cepat' : 'Quick Share'} showChevrons={false} />
      <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2.5">
        <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 text-center">
          <PixelIcon name="share" size={24} className="mx-auto" />
          <div className="text-xs font-bold mt-1">
            {language === 'id'
              ? 'Bagikan via Sistem, Clipboard & Lintas-Tab'
              : 'Web Share, Clipboard & Cross-Tab Transfer'}
          </div>
          {receivedCount > 0 && (
            <div className="text-[10px] mt-1 font-bold">
              {receivedCount} {language === 'id' ? 'item diterima' : 'items received'}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-xs font-bold border-b border-[var(--lcd-fg)] pb-0.5">
            {language === 'id' ? 'Bagikan Catatan:' : 'Share Notes:'}
          </div>
          {notes.slice(0, 4).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => shareTextPayload(n.title, n.body)}
              className="w-full flex justify-between items-center border border-[var(--lcd-fg)] px-2 py-1 text-xs font-bold hover:bg-[var(--lcd-sec)] cursor-pointer"
            >
              <span className="truncate">{n.title}</span>
              <span className="shrink-0 ml-2">{language === 'id' ? 'Bagikan' : 'Share'}</span>
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <div className="text-xs font-bold border-b border-[var(--lcd-fg)] pb-0.5">
            {language === 'id' ? 'Bagikan Kontak:' : 'Share Contacts:'}
          </div>
          {contacts.slice(0, 4).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => shareTextPayload(c.name, `${c.name}: ${c.phone}`)}
              className="w-full flex justify-between items-center border border-[var(--lcd-fg)] px-2 py-1 text-xs font-bold hover:bg-[var(--lcd-sec)] cursor-pointer"
            >
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 ml-2 tabular-nums">{c.phone}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const HotspotApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const hotspotEnabled = useOSStore((s) => s.hotspotEnabled);
  const setHotspotEnabled = useOSStore((s) => s.setHotspotEnabled);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: hotspotEnabled ? 'OFF' : 'ON',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: () => {
        soundEngine.playCue('click');
        setHotspotEnabled(!hotspotEnabled);
      },
      onRight: onBack,
    });
  }, [hotspotEnabled, language, onBack, setHotspotEnabled, setSoftkeys]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title="Hotspot" showChevrons={false} />
      <div className="p-3 space-y-3">
        <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">Hotspot Wi-Fi</div>
            <div className="text-sm">SSID: RetroPixel_AP</div>
          </div>
          <button
            type="button"
            onClick={() => setHotspotEnabled(!hotspotEnabled)}
            className={`px-3 py-1 border-2 border-[var(--lcd-fg)] font-bold cursor-pointer ${
              hotspotEnabled ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
            }`}
          >
            {hotspotEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="border-2 border-[var(--lcd-fg)] p-2 text-sm space-y-1">
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Status' : 'Status'}</span>
            <span className="font-bold">{hotspotEnabled ? 'BROADCASTING' : 'STANDBY'}</span>
          </div>
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Keamanan' : 'Security'}</span>
            <span className="font-bold">WPA2-PSK</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NetworkApp: React.FC<AppComponentProps> = ({ appId, onBack }) => {
  const language = useOSStore((s) => s.language);
  const wifiEnabled = useOSStore((s) => s.wifiEnabled);
  const setWifiEnabled = useOSStore((s) => s.setWifiEnabled);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [pingMs, setPingMs] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);

  const navConn =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & {
          connection?: { effectiveType?: string; downlink?: number; rtt?: number };
        }).connection
      : undefined;

  const runPingTest = async () => {
    setTesting(true);
    soundEngine.playCue('click');
    const start = performance.now();
    try {
      await fetch('/manifest.webmanifest', { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - start);
      setPingMs(elapsed);
      soundEngine.playCue('select');
      showToast(`Ping: ${elapsed} ms`);
    } catch {
      setPingMs(-1);
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Jaringan offline' : 'Network offline');
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: 'Ping',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: runPingTest,
      onRight: onBack,
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={
          appId === 'vpn'
            ? 'VPN & Jaringan'
            : appId === 'sync'
              ? language === 'id'
                ? 'Diagnostik Jaringan'
                : 'Network Sync'
              : language === 'id'
                ? 'Jaringan'
                : 'Network'
        }
        showChevrons={false}
      />
      <div className="p-3 space-y-2">
        <button
          type="button"
          onClick={() => setWifiEnabled(!wifiEnabled)}
          className="w-full flex justify-between items-center border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 text-sm font-bold cursor-pointer"
        >
          <span>Wi-Fi</span>
          <span>{wifiEnabled ? 'ON' : 'OFF'}</span>
        </button>

        <div className="border-2 border-[var(--lcd-fg)] p-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Status Online' : 'Browser Online'}</span>
            <span className="font-bold">
              {typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          {navConn?.effectiveType && (
            <div className="flex justify-between">
              <span>{language === 'id' ? 'Tipe Koneksi' : 'Connection'}</span>
              <span className="font-bold uppercase">{navConn.effectiveType}</span>
            </div>
          )}
          {typeof navConn?.downlink === 'number' && (
            <div className="flex justify-between">
              <span>Downlink</span>
              <span className="font-bold">{navConn.downlink} Mbps</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Latensi Server' : 'Server Ping'}</span>
            <span className="font-bold">
              {pingMs === null ? '--' : pingMs < 0 ? 'ERR' : `${pingMs} ms`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={runPingTest}
          disabled={testing}
          className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-sm font-bold cursor-pointer"
        >
          {testing
            ? language === 'id'
              ? 'Mengukur Latensi...'
              : 'Testing Latency...'
            : language === 'id'
              ? 'Tes Koneksi & Ping'
              : 'Run Ping Test'}
        </button>
      </div>
    </div>
  );
};

export const CloudApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const importInputRef = useRef<HTMLInputElement>(null);
  const [counts, setCounts] = useState({ notes: 0, contacts: 0, files: 0, emails: 0, usedKb: 0 });

  const loadCounts = async () => {
    const [notes, contacts, filesList, emails] = await Promise.all([
      db.notes.count(),
      db.contacts.count(),
      db.files.toArray(),
      db.emails.count(),
    ]);
    const usedKb = filesList.reduce((acc, f) => acc + (f.sizeKb || 0), 0);
    setCounts({ notes, contacts, files: filesList.length, emails, usedKb });
  };

  useEffect(() => {
    let active = true;
    Promise.all([db.notes.count(), db.contacts.count(), db.files.toArray(), db.emails.count()]).then(
      ([notes, contacts, filesList, emails]) => {
        if (!active) return;
        const usedKb = filesList.reduce((acc, f) => acc + (f.sizeKb || 0), 0);
        setCounts({ notes, contacts, files: filesList.length, emails, usedKb });
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const exportBackup = async () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      contacts: await db.contacts.toArray(),
      messages: await db.messages.toArray(),
      notes: await db.notes.toArray(),
      events: await db.events.toArray(),
      alarms: await db.alarms.toArray(),
      reminders: await db.reminders.toArray(),
      bookmarks: await db.bookmarks.toArray(),
      emails: await db.emails.toArray(),
      groups: await db.groups.toArray(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retropixel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Cadangan JSON diunduh' : 'Backup JSON exported');
  };

  const restoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown[]>;
      if (Array.isArray(data.contacts)) await db.contacts.bulkPut(data.contacts as ContactRecord[]);
      if (Array.isArray(data.notes)) await db.notes.bulkPut(data.notes as NoteRecord[]);
      if (Array.isArray(data.bookmarks)) await db.bookmarks.bulkPut(data.bookmarks as BookmarkRecord[]);
      await loadCounts();
      soundEngine.playCue('notify');
      showToast(language === 'id' ? 'Cadangan dipulihkan!' : 'Backup restored!');
    } catch {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Format cadangan tidak valid' : 'Invalid backup JSON');
    } finally {
      e.target.value = '';
    }
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: language === 'id' ? 'Ekspor' : 'Export',
      centerLabel: language === 'id' ? 'Impor' : 'Restore',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: exportBackup,
      onCenter: () => importInputRef.current?.click(),
      onRight: onBack,
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title="Cloud & Backup" showChevrons={false} />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={restoreBackup}
        className="hidden"
      />
      <div className="flex-1 overflow-y-auto lcd-scroll p-3 space-y-2.5">
        <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5">
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
            <PixelIcon name="cloud" size={20} />
            <span>RetroVault Backup</span>
          </div>
          <div className="text-xs mt-1">
            {language === 'id' ? 'Total berkas lokal' : 'Local files size'}: {counts.usedKb} KB
          </div>
        </div>

        <div className="border-2 border-[var(--lcd-fg)] p-2 space-y-1 text-xs sm:text-sm">
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Kontak' : 'Contacts'}</span>
            <span className="font-bold">{counts.contacts}</span>
          </div>
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Catatan' : 'Notes'}</span>
            <span className="font-bold">{counts.notes}</span>
          </div>
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Email' : 'Emails'}</span>
            <span className="font-bold">{counts.emails}</span>
          </div>
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Berkas' : 'Files'}</span>
            <span className="font-bold">{counts.files}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={exportBackup}
            className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
          >
            {language === 'id' ? 'Ekspor .JSON' : 'Export .JSON'}
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
          >
            {language === 'id' ? 'Pulihkan .JSON' : 'Restore .JSON'}
          </button>
        </div>
      </div>
    </div>
  );
};

