import type { Metadata, Viewport } from 'next';
import { Silkscreen, VT323 } from 'next/font/google';
import './globals.css';
import '../src/styles/pixel-os.css';

const silkscreen = Silkscreen({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-silkscreen',
  display: 'swap',
});

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#D8FF9A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Retro Pixel OS',
  description: 'A monochrome pixel LCD retro mobile operating system simulator with apps, games, persistent local storage, and offline PWA support.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RetroPixelOS',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Retro Pixel OS',
    description: 'A monochrome pixel LCD retro mobile operating system simulator with apps, games, persistent local storage, and offline PWA support.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Retro Pixel OS',
    description: 'A monochrome pixel LCD retro mobile operating system simulator with apps, games, persistent local storage, and offline PWA support.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${vt323.variable}`}>
      <body
        suppressHydrationWarning
        className={`${silkscreen.className} pixel-body selection:bg-black selection:text-[#D8FF9A]`}
      >
        {children}
      </body>
    </html>
  );
}
