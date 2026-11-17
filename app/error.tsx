'use client';

import React, { useEffect } from 'react';

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => undefined);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#141712] text-[#D8FF9A] p-4 text-center space-y-4">
      <div className="border-4 border-[#D8FF9A] p-6 max-w-sm w-full space-y-3 bg-[#1c2019]">
        <div className="text-lg font-bold tracking-wider">RETRO PIXEL OS</div>
        <p className="text-xs opacity-85">
          Terjadi gangguan pemuatan aplikasi. Bersihkan cache sementara dan muat ulang sistem.
        </p>
        <div className="flex gap-2 justify-center pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-1.5 border-2 border-[#D8FF9A] bg-[#D8FF9A] text-[#141712] text-xs font-bold cursor-pointer"
          >
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-1.5 border-2 border-[#D8FF9A] text-xs font-bold cursor-pointer"
          >
            Hard Reload
          </button>
        </div>
      </div>
    </div>
  );
}
