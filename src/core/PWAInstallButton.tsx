'use client';

import React, { useEffect, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { t } from '@/src/services/i18n';
import { useOSStore } from '@/src/store/useOSStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);

    queueMicrotask(() => {
      setIsInstalled(isStandalone);
      setIsIOS(isIOSDevice);
    });

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const language = useOSStore((s) => s.language);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center gap-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-2.5 py-1.5 text-xs sm:text-sm leading-none hover:opacity-90 active:translate-y-px whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'text-[11px] px-2 py-1' : ''
        }`}
      >
        <PixelIcon name="download" size={18} />
        <span>{t(language, 'installApp')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)] px-2.5 py-1.5 text-xs sm:text-sm leading-none hover:bg-[var(--lcd-sec)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <PixelIcon name="download" size={18} />
          <span>{language === 'id' ? 'Pasang iOS' : 'Install iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-xs border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-4 text-[var(--lcd-fg)]">
              <h3 className="text-base font-bold border-b-2 border-[var(--lcd-fg)] pb-1">
                {language === 'id' ? 'Pasang di iPhone / iPad' : 'Install on iPhone / iPad'}
              </h3>
              <ol className="mt-2 space-y-1 text-xs leading-snug">
                <li>1. {language === 'id' ? 'Ketuk tombol Bagikan (Share) di Safari.' : 'Tap the Share button in Safari toolbar.'}</li>
                <li>2. {language === 'id' ? 'Pilih "Tambah ke Layar Utama".' : 'Scroll and tap "Add to Home Screen".'}</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-3 w-full border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] py-1.5 text-sm cursor-pointer"
              >
                {t(language, 'softkeyOk')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
