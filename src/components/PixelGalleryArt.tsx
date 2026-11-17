'use client';

import React, { useEffect, useRef } from 'react';

export type GalleryArtId =
  | 'rain-cyber'
  | 'campfire'
  | 'space-ship'
  | 'koi-pond'
  | 'cafe-cat'
  | 'waterfall'
  | 'sunset-train'
  | 'sakura-shrine'
  | 'retro-arcade'
  | 'night-market';

export type GalleryArtPalette = 'color' | 'lcd';

export interface GalleryArtworkMeta {
  id: GalleryArtId;
  titleId: string;
  titleEn: string;
  subtitleId: string;
  subtitleEn: string;
  animated: boolean;
  fps: number;
  totalFrames: number;
}

export const GALLERY_ARTWORKS: GalleryArtworkMeta[] = [
  {
    id: 'rain-cyber',
    titleId: 'Malam Hujan Neon',
    titleEn: 'Neon Rain Night',
    subtitleId: 'Animasi kota cyberpunk hujan',
    subtitleEn: 'Animated rainy neon street',
    animated: true,
    fps: 8,
    totalFrames: 16,
  },
  {
    id: 'campfire',
    titleId: 'Api Unggun Hutan',
    titleEn: 'Forest Campfire',
    subtitleId: 'Animasi api unggun & kunang-kunang',
    subtitleEn: 'Animated campfire & fireflies',
    animated: true,
    fps: 8,
    totalFrames: 16,
  },
  {
    id: 'space-ship',
    titleId: 'Jelajah Angkasa',
    titleEn: 'Space Odyssey',
    subtitleId: 'Animasi roket & planet bercincin',
    subtitleEn: 'Animated rocket & ringed planet',
    animated: true,
    fps: 8,
    totalFrames: 16,
  },
  {
    id: 'koi-pond',
    titleId: 'Akuarium Koi',
    titleEn: 'Pixel Aquarium',
    subtitleId: 'Animasi ikan koi & gelembung air',
    subtitleEn: 'Animated koi fish & bubbles',
    animated: true,
    fps: 8,
    totalFrames: 16,
  },
  {
    id: 'cafe-cat',
    titleId: 'Kucing & Kopi',
    titleEn: 'Retro Cafe Cat',
    subtitleId: 'Animasi kucing berkedip & uap kopi',
    subtitleEn: 'Blinking pixel cat & hot coffee',
    animated: true,
    fps: 6,
    totalFrames: 16,
  },
  {
    id: 'waterfall',
    titleId: 'Air Terjun Pelangi',
    titleEn: 'Rainbow Waterfall',
    subtitleId: 'Animasi air terjun & awan bergerak',
    subtitleEn: 'Cascading pixel falls & clouds',
    animated: true,
    fps: 8,
    totalFrames: 16,
  },
  {
    id: 'sunset-train',
    titleId: 'Kereta Senja',
    titleEn: 'Sunset Express',
    subtitleId: 'Ilustrasi piksel kereta di jembatan',
    subtitleEn: 'Pixel steam train over viaduct',
    animated: false,
    fps: 0,
    totalFrames: 1,
  },
  {
    id: 'sakura-shrine',
    titleId: 'Gerbang Sakura',
    titleEn: 'Sakura Torii',
    subtitleId: 'Ilustrasi piksel kuil & Gunung Fuji',
    subtitleEn: 'Crimson Torii & blossom view',
    animated: false,
    fps: 0,
    totalFrames: 1,
  },
  {
    id: 'retro-arcade',
    titleId: 'Mecha 8-Bit',
    titleEn: '8-Bit Mecha Bay',
    subtitleId: 'Ilustrasi piksel hanggar robot mecha',
    subtitleEn: 'Giant mecha robot hangar art',
    animated: false,
    fps: 0,
    totalFrames: 1,
  },
  {
    id: 'night-market',
    titleId: 'Pasar Malam',
    titleEn: 'Pixel Night Market',
    subtitleId: 'Ilustrasi piksel kedai lampion malam',
    subtitleEn: 'Lantern-lit night food stall',
    animated: false,
    fps: 0,
    totalFrames: 1,
  },
];

const ART_W = 120;
const ART_H = 90;

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function parseColorRgb(val: string, fallback: [number, number, number]): [number, number, number] {
  const clean = val.trim();
  if (clean.startsWith('#')) {
    const hex = clean.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  return fallback;
}

function getThemeLcdColors(): {
  bg: [number, number, number];
  sec: [number, number, number];
  fg: [number, number, number];
} {
  if (typeof window === 'undefined') {
    return { bg: [216, 255, 154], sec: [189, 232, 121], fg: [0, 0, 0] };
  }
  const styles = getComputedStyle(document.documentElement);
  return {
    bg: parseColorRgb(styles.getPropertyValue('--lcd-bg'), [216, 255, 154]),
    sec: parseColorRgb(styles.getPropertyValue('--lcd-sec'), [189, 232, 121]),
    fg: parseColorRgb(styles.getPropertyValue('--lcd-fg'), [0, 0, 0]),
  };
}

class PixelCanvas {
  ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  px(x: number, y: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  dither(x: number, y: number, w: number, h: number, c1: string, c2: string, step = 1) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);
    this.ctx.fillStyle = c1;
    this.ctx.fillRect(rx, ry, rw, rh);
    this.ctx.fillStyle = c2;
    for (let yy = 0; yy < rh; yy += step) {
      for (let xx = 0; xx < rw; xx += step) {
        if (((xx / step + yy / step) & 1) === 0) {
          this.ctx.fillRect(rx + xx, ry + yy, step, step);
        }
      }
    }
  }

  disc(cx: number, cy: number, r: number, color: string) {
    this.ctx.fillStyle = color;
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy <= r2) {
          this.ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
        }
      }
    }
  }

  tri(xTop: number, yTop: number, halfBase: number, height: number, color: string) {
    this.ctx.fillStyle = color;
    for (let row = 0; row < height; row += 1) {
      const span = Math.max(1, Math.round(((row + 1) / height) * halfBase));
      this.ctx.fillRect(Math.round(xTop - span), Math.round(yTop + row), span * 2, 1);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, thick = 1) {
    this.ctx.fillStyle = color;
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0);
    const sx = ix0 < ix1 ? 1 : -1;
    const dy = -Math.abs(iy1 - iy0);
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      this.ctx.fillRect(ix0, iy0, thick, thick);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ix0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }
}

function drawRainCyber(p: PixelCanvas, f: number) {
  // Deep night cyber sky
  p.rect(0, 0, 120, 32, '#0b1026');
  p.dither(0, 32, 120, 16, '#0b1026', '#161b3a');
  p.rect(0, 48, 120, 20, '#1e2144');

  // Distant moon & drifting cyber cloud
  p.disc(98, 13, 6, '#e2e8f0');
  p.disc(100, 11, 5, '#0b1026');
  const cx = (f * 2) % 130;
  p.rect((cx - 20 + 120) % 120, 10, 18, 3, '#2d3561');
  p.rect((cx - 16 + 120) % 120, 8, 10, 2, '#3d477d');

  // Background skyline silhouette
  const bgTowers = [
    [2, 22, 16],
    [20, 14, 18],
    [40, 26, 14],
    [58, 10, 22],
    [82, 20, 18],
    [102, 16, 18],
  ];
  bgTowers.forEach(([bx, by, bw]) => {
    p.rect(bx, by, bw, 68 - by, '#151836');
    p.rect(bx + 2, by + 4, 2, 2, '#38bdf8');
    p.rect(bx + bw - 5, by + 8, 2, 2, '#f472b6');
  });

  // Main Cyberpunk Buildings Left & Right
  // Left Arcade Building
  p.rect(4, 28, 34, 40, '#1e293b');
  p.rect(4, 28, 34, 2, '#334155');
  p.rect(8, 33, 26, 9, '#0f172a');
  // Flickering Neon Sign "ARCADE"
  const neonBlink = f % 8 === 0 ? '#9333ea' : '#f43f5e';
  p.rect(9, 34, 24, 7, neonBlink);
  p.rect(11, 36, 4, 3, '#fef08a');
  p.rect(17, 36, 4, 3, '#fef08a');
  p.rect(23, 36, 4, 3, '#fef08a');
  p.rect(29, 36, 2, 3, '#fef08a');

  // Windows left building
  for (let wy = 46; wy <= 56; wy += 6) {
    for (let wx = 8; wx <= 28; wx += 7) {
      const lit = (wx + wy + Math.floor(f / 4)) % 3 !== 0;
      p.rect(wx, wy, 4, 4, lit ? '#38bdf8' : '#0f172a');
    }
  }

  // Right Ramen Shop
  p.rect(74, 30, 42, 38, '#1f2437');
  p.rect(72, 28, 46, 3, '#475569');
  // Vertical neon banner
  const bannerColor = f % 6 < 3 ? '#22d3ee' : '#06b6d4';
  p.rect(66, 26, 6, 22, '#0f172a');
  p.rect(67, 27, 4, 20, bannerColor);
  p.rect(68, 29, 2, 3, '#0f172a');
  p.rect(68, 34, 2, 3, '#0f172a');
  p.rect(68, 39, 2, 3, '#0f172a');

  // Glowing Ramen Counter Window
  p.rect(78, 46, 32, 16, '#f59e0b');
  p.rect(79, 47, 30, 14, '#fef08a');
  // Striped awning
  for (let ax = 74; ax < 114; ax += 4) {
    p.rect(ax, 42, 2, 4, '#ef4444');
    p.rect(ax + 2, 42, 2, 4, '#f8fafc');
  }
  // Shopkeeper silhouette inside
  p.disc(94, 53, 3, '#334155');
  p.rect(89, 56, 10, 5, '#1e293b');
  // Hanging Lanterns swaying gently
  const sway = (f >> 2) % 2;
  p.rect(82 + sway, 46, 3, 4, '#ef4444');
  p.rect(104 + sway, 46, 3, 4, '#ef4444');

  // Wet Neon Asphalt Road & Puddle Reflections
  p.rect(0, 68, 120, 22, '#0f172a');
  p.rect(0, 68, 120, 2, '#334155');
  // Neon reflections on wet ground
  p.rect(10, 72, 22, 2, neonBlink);
  p.rect(14, 76, 14, 1, '#f43f5e');
  p.rect(66, 71, 5, 3, '#22d3ee');
  p.rect(80, 73, 28, 3, '#f59e0b');
  p.rect(84, 78, 20, 2, '#f59e0b');

  // Passing Pixel Retro Car in Background
  const carX = ((f * 7) % 150) - 24;
  p.rect(carX, 62, 18, 6, '#dc2626');
  p.rect(carX + 4, 59, 9, 3, '#38bdf8');
  p.rect(carX + 2, 67, 4, 3, '#020617');
  p.rect(carX + 12, 67, 4, 3, '#020617');
  p.rect(carX + 17, 64, 3, 2, '#fef08a');
  p.rect(carX + 20, 64, 8, 2, '#fef08a');

  // Puddle Ripples
  const rStep = f % 8;
  const rx = rStep < 4 ? 48 : 24;
  const rw = (rStep % 4) * 3 + 2;
  p.rect(rx - rw, 82, rw * 2, 1, '#7dd3fc');

  // Angled Animated Rain Streaks
  for (let i = 0; i < 28; i += 1) {
    const rxPos = (i * 17 + f * 5) % 120;
    const ryPos = (i * 13 + f * 9) % 82;
    p.px(rxPos, ryPos, '#93c5fd');
    p.px(rxPos - 1, ryPos + 2, '#60a5fa');
    p.px(rxPos - 2, ryPos + 4, '#38bdf8');
  }
}

function drawCampfire(p: PixelCanvas, f: number) {
  // Starry Night Sky
  p.rect(0, 0, 120, 56, '#090d1f');
  p.dither(0, 44, 120, 12, '#090d1f', '#131d38');

  // Twinkling Stars + Crescent Moon
  p.disc(22, 14, 6, '#fef3c7');
  p.disc(25, 12, 5, '#090d1f');
  const stars = [
    [42, 10],
    [58, 16],
    [76, 8],
    [94, 14],
    [108, 20],
    [14, 28],
    [86, 26],
  ];
  stars.forEach(([sx, sy], idx) => {
    const bright = (f + idx * 3) % 8 < 5;
    p.px(sx, sy, bright ? '#fef08a' : '#475569');
    if (bright && idx % 2 === 0) {
      p.px(sx - 1, sy, '#94a3b8');
      p.px(sx + 1, sy, '#94a3b8');
    }
  });

  // Distant Pine Ridge
  for (let tx = 0; tx < 120; tx += 10) {
    const th = 14 + ((tx * 7) % 10);
    p.tri(tx + 5, 56 - th, 6, th, '#0f2922');
  }

  // Foreground Pine Trees Framing
  const drawPine = (cx: number, topY: number, scale: number) => {
    p.rect(cx - 1, topY + scale * 3, 3, 10, '#451a03');
    p.tri(cx, topY, scale * 2, scale * 2, '#166534');
    p.tri(cx, topY + scale, scale * 3, scale * 2, '#15803d');
    p.tri(cx, topY + scale * 2, scale * 4, scale * 2, '#14532d');
  };
  drawPine(12, 24, 5);
  drawPine(106, 20, 6);

  // Forest Clearing & Warm Glow Circle on Ground
  p.rect(0, 56, 120, 34, '#143321');
  p.dither(0, 56, 120, 8, '#143321', '#1b4332');
  // Firelight glow pool
  const glowR = 26 + ((f >> 1) % 3);
  p.disc(60, 74, glowR, '#3f2e18');
  p.disc(60, 74, glowR - 8, '#5c3c16');
  p.rect(0, 82, 120, 8, '#0c2116');

  // Cozy Glowing Tent on Left
  p.tri(28, 46, 13, 18, '#b45309');
  p.tri(28, 48, 10, 16, '#d97706');
  p.tri(28, 53, 5, 11, '#fef08a');
  p.rect(14, 63, 28, 2, '#78350f');

  // Camping Log Bench on Right
  p.rect(82, 66, 20, 5, '#78350f');
  p.rect(82, 66, 20, 2, '#92400e');
  p.rect(84, 71, 3, 4, '#451a03');
  p.rect(97, 71, 3, 4, '#451a03');

  // Stone Ring & Firewood Logs
  for (let lx = 50; lx <= 70; lx += 4) {
    p.rect(lx, 73, 3, 3, '#64748b');
    p.px(lx, 73, '#94a3b8');
  }
  p.rect(52, 70, 16, 3, '#78350f');
  p.rect(54, 68, 12, 3, '#92400e');

  // Animated Multi-Frame Pixel Flame
  const flicker = (f % 4) - 1;
  const tall = (f >> 1) % 3;
  // Outer red flame
  p.tri(60, 50 - tall, 8, 20 + tall, '#ef4444');
  p.rect(55 + flicker, 48 - tall, 3, 4, '#ef4444');
  // Mid orange flame
  p.tri(60, 54 - (tall >> 1), 6, 15, '#f97316');
  // Inner yellow core
  p.tri(60, 59, 3, 10, '#fde047');
  p.rect(59, 64, 3, 4, '#fef9c3');

  // Rising Ember Sparks
  for (let e = 0; e < 6; e += 1) {
    const ey = 62 - ((f * 3 + e * 7) % 34);
    const ex = 56 + ((e * 5 + Math.floor(Math.sin(f + e) * 3)) % 10);
    p.px(ex, ey, ey < 42 ? '#f97316' : '#fef08a');
  }

  // Blinking Fireflies
  const flies = [
    [20 + (f % 4), 48 - (f % 3)],
    [92 - (f % 5), 52 + ((f >> 1) % 3)],
    [44 + ((f >> 2) % 4), 40],
  ];
  flies.forEach(([fx, fy], idx) => {
    if ((f + idx * 2) % 6 < 4) {
      p.rect(fx, fy, 2, 2, '#bef264');
    }
  });
}

function drawSpaceShip(p: PixelCanvas, f: number) {
  // Deep Cosmos Background
  p.rect(0, 0, 120, 90, '#060818');

  // 3-Depth Parallax Scrolling Starfield
  for (let s = 0; s < 32; s += 1) {
    const speed = (s % 3) + 1;
    const sx = (s * 23 + (120 - ((f * speed * 2) % 120))) % 120;
    const sy = (s * 19 + 7) % 88;
    const color = speed === 3 ? '#ffffff' : speed === 2 ? '#93c5fd' : '#475569';
    p.px(sx, sy, color);
    if (speed === 3 && s % 4 === 0) {
      p.px((sx + 1) % 120, sy, '#bae6fd');
    }
  }

  // Nebula Pixel Band
  p.dither(0, 56, 120, 22, '#060818', '#1e1b4b');
  p.dither(18, 62, 84, 10, '#1e1b4b', '#312e81');

  // Distant Ringed Planet (Top Right)
  p.disc(94, 22, 11, '#7c3aed');
  p.disc(92, 20, 9, '#a78bfa');
  p.rect(86, 18, 12, 2, '#c4b5fd');
  p.rect(88, 23, 14, 2, '#6d28d9');
  // Ring
  p.line(77, 27, 111, 17, '#fde047', 2);
  p.line(79, 28, 109, 18, '#f59e0b', 1);

  // Small Moon Left
  p.disc(20, 20, 5, '#64748b');
  p.disc(19, 19, 4, '#cbd5e1');
  p.px(18, 18, '#94a3b8');
  p.px(21, 21, '#94a3b8');

  // Passing Shooting Meteor
  const mx = (f * 8) % 140;
  const my = 6 + ((f * 3) % 40);
  if (f % 16 < 10) {
    p.px(mx, my, '#ffffff');
    p.line(mx - 6, my - 2, mx - 1, my, '#38bdf8', 1);
  }

  // Hero Pixel Rocket Ship (Center-Left, gentle vertical hover bob)
  const bob = [0, -1, -2, -1, 0, 1, 2, 1][f % 8];
  const rx = 44;
  const ry = 46 + bob;

  // Animated Exhaust Plume
  const exhaustLen = 10 + (f % 4) * 3;
  p.rect(rx - exhaustLen, ry - 2, exhaustLen, 5, '#ef4444');
  p.rect(rx - Math.round(exhaustLen * 0.7), ry - 1, Math.round(exhaustLen * 0.7), 3, '#f97316');
  p.rect(rx - Math.round(exhaustLen * 0.4), ry, Math.round(exhaustLen * 0.4), 1, '#fef08a');
  // Exhaust Smoke Puffs
  p.disc(rx - exhaustLen - 3, ry + (f % 3) - 1, 2, '#cbd5e1');

  // Rocket Fins
  p.rect(rx - 2, ry - 8, 7, 4, '#dc2626');
  p.rect(rx - 2, ry + 5, 7, 4, '#dc2626');
  // Rocket Body
  p.rect(rx, ry - 4, 22, 9, '#f8fafc');
  p.rect(rx, ry + 2, 22, 3, '#cbd5e1');
  // Red Stripe
  p.rect(rx + 3, ry - 4, 3, 9, '#ef4444');
  // Nose Cone
  p.rect(rx + 22, ry - 3, 4, 7, '#ef4444');
  p.rect(rx + 26, ry - 2, 3, 5, '#ef4444');
  p.rect(rx + 29, ry - 1, 2, 3, '#f87171');
  // Cockpit Window
  p.rect(rx + 12, ry - 2, 6, 4, '#0284c7');
  p.rect(rx + 13, ry - 1, 3, 2, '#7dd3fc');
}

function drawKoiPond(p: PixelCanvas, f: number) {
  // Sunlit Water Depth Gradient
  p.rect(0, 0, 120, 26, '#0284c7');
  p.dither(0, 26, 120, 20, '#0284c7', '#0369a1');
  p.rect(0, 46, 120, 24, '#0369a1');
  p.dither(0, 70, 120, 10, '#0369a1', '#0c4a6e');

  // Diagonal Pixel Sunbeams
  const rayShift = (f >> 2) % 3;
  for (let i = 0; i < 16; i += 1) {
    p.rect(18 + i + rayShift, i * 3, 8, 3, '#38bdf8');
    p.rect(68 + i + rayShift, i * 3, 6, 3, '#38bdf8');
  }

  // Sandy Seabed & Pebbles
  p.rect(0, 76, 120, 14, '#ca8a04');
  p.rect(0, 76, 120, 3, '#eab308');
  p.rect(14, 81, 6, 3, '#78716c');
  p.rect(48, 83, 8, 3, '#57534e');
  p.rect(92, 80, 7, 3, '#78716c');

  // Treasure Chest on Right Floor
  p.rect(86, 68, 16, 9, '#78350f');
  p.rect(86, 66, 16, 3, '#b45309');
  p.rect(88, 69, 12, 2, '#fbbf24');
  if (f % 8 < 4) {
    p.px(93, 63, '#fef08a');
    p.px(98, 64, '#fef08a');
  }

  // Swaying Seaweed Fronds
  const swayOffset = [0, 1, 0, -1][Math.floor(f / 2) % 4];
  const drawWeed = (wx: number, height: number, color: string) => {
    for (let y = 0; y < height; y += 3) {
      const bend = y > height / 2 ? swayOffset : 0;
      p.rect(wx + bend + ((y >> 2) % 2), 76 - y, 3, 3, color);
    }
  };
  drawWeed(8, 32, '#16a34a');
  drawWeed(15, 22, '#22c55e');
  drawWeed(32, 26, '#15803d');
  drawWeed(108, 30, '#16a34a');
  drawWeed(113, 20, '#4ade80');

  // Helper to draw swimming Pixel Fish
  const drawFish = (x: number, y: number, dir: 1 | -1, body: string, accent: string) => {
    const tailWag = (f >> 1) % 2 === 0 ? -1 : 1;
    // Body
    p.rect(x, y, 12, 6, body);
    p.rect(x + 2, y - 1, 8, 8, body);
    // Pattern
    p.rect(x + 4, y + 1, 4, 4, accent);
    // Tail
    const tx = dir === 1 ? x - 4 : x + 12;
    p.rect(tx, y + 1 + tailWag, 4, 4, accent);
    p.rect(tx + (dir === 1 ? -1 : 3), y + tailWag, 2, 6, body);
    // Eye
    const ex = dir === 1 ? x + 9 : x + 2;
    p.px(ex, y + 2, '#0f172a');
    p.px(ex, y + 1, '#ffffff');
  };

  // Koi 1 (Orange/White Swimming Right)
  const k1x = ((f * 4) % 144) - 18;
  const k1y = 28 + Math.round(Math.sin(f * 0.4) * 3);
  drawFish(k1x, k1y, 1, '#f97316', '#f8fafc');

  // Koi 2 (Gold/Red Swimming Left)
  const k2x = 124 - ((f * 3 + 40) % 144);
  const k2y = 50 + Math.round(Math.cos(f * 0.4) * 3);
  drawFish(k2x, k2y, -1, '#fef08a', '#ef4444');

  // Small Neon Fish
  const k3x = ((f * 5 + 70) % 140) - 14;
  drawFish(k3x, 16, 1, '#a855f7', '#38bdf8');

  // Rising Air Bubbles
  for (let b = 0; b < 7; b += 1) {
    const by = 72 - ((f * 4 + b * 11) % 68);
    const bx = 22 + b * 14 + ((f + b) % 2);
    p.rect(bx, by, 3, 3, '#bae6fd');
    p.px(bx, by, '#ffffff');
  }
}

function drawCafeCat(p: PixelCanvas, f: number) {
  // Cozy Wooden Cafe Wall
  p.rect(0, 0, 120, 62, '#78350f');
  p.dither(0, 0, 120, 62, '#78350f', '#92400e');

  // Large Night Window Center
  p.rect(16, 8, 88, 48, '#451a03');
  p.rect(19, 11, 82, 42, '#0f172a');
  // Window Starry Sky + Crescent Moon
  p.disc(82, 22, 6, '#fde047');
  p.disc(85, 20, 5, '#0f172a');
  p.px(32, 18, '#fef08a');
  p.px(54, 16, f % 4 === 0 ? '#94a3b8' : '#fef08a');
  p.px(66, 26, '#bae6fd');
  p.px(38, 32, '#fef08a');
  // Window Distant Roofline & Mullions
  p.rect(19, 43, 82, 10, '#1e293b');
  p.rect(30, 40, 14, 4, '#334155');
  p.rect(58, 11, 3, 42, '#451a03');
  p.rect(19, 32, 82, 2, '#451a03');

  // Wooden Table / Countertop
  p.rect(0, 60, 120, 30, '#b45309');
  p.rect(0, 60, 120, 3, '#d97706');
  p.rect(0, 74, 120, 16, '#92400e');

  // Sitting Pixel Ginger Cat on Counter
  const catX = 30;
  const catY = 44;
  // Tail Wagging
  const tailUp = (f >> 2) % 2 === 0;
  p.rect(catX - 8, tailUp ? catY + 8 : catY + 14, 9, 4, '#ea580c');
  p.rect(catX - 10, tailUp ? catY + 4 : catY + 12, 4, 5, '#f97316');
  // Cat Torso
  p.rect(catX, catY + 8, 18, 18, '#f97316');
  p.rect(catX + 4, catY + 12, 10, 14, '#ffedd5'); // Cream belly
  p.rect(catX + 2, catY + 24, 5, 3, '#f8fafc'); // Paws
  p.rect(catX + 11, catY + 24, 5, 3, '#f8fafc');
  // Cat Head + Ears
  p.rect(catX + 1, catY - 4, 16, 13, '#f97316');
  p.rect(catX + 1, catY - 8, 4, 4, '#ea580c');
  p.rect(catX + 13, catY - 8, 4, 4, '#ea580c');
  p.px(catX + 2, catY - 6, '#fda4af');
  p.px(catX + 14, catY - 6, '#fda4af');
  // Cat Face (Blinking every 12 frames)
  const blink = f % 14 >= 12;
  if (blink) {
    p.rect(catX + 4, catY + 2, 3, 1, '#1e293b');
    p.rect(catX + 11, catY + 2, 3, 1, '#1e293b');
  } else {
    p.rect(catX + 4, catY + 1, 3, 3, '#15803d');
    p.rect(catX + 11, catY + 1, 3, 3, '#15803d');
    p.px(catX + 5, catY + 2, '#020617');
    p.px(catX + 12, catY + 2, '#020617');
  }
  p.px(catX + 8, catY + 5, '#fb7185'); // Cute nose

  // Steaming Pixel Coffee Mug on Right
  const mugX = 76;
  const mugY = 56;
  p.rect(mugX - 2, mugY + 12, 22, 3, '#e2e8f0'); // Saucer
  p.rect(mugX, mugY, 16, 12, '#f8fafc');
  p.rect(mugX + 16, mugY + 3, 4, 6, '#e2e8f0'); // Handle
  p.rect(mugX + 16, mugY + 4, 2, 4, '#b45309');
  p.rect(mugX + 2, mugY + 2, 12, 2, '#451a03'); // Coffee top
  p.rect(mugX + 4, mugY + 5, 8, 3, '#ef4444'); // Mug stripe

  // Rising Animated Pixel Steam Curls
  for (let s = 0; s < 3; s += 1) {
    const sy = mugY - 3 - ((f + s * 4) % 14);
    const sx = mugX + 4 + s * 4 + ((sy >> 1) % 2);
    p.rect(sx, sy, 2, 2, sy < mugY - 11 ? '#94a3b8' : '#f8fafc');
  }
}

function drawWaterfall(p: PixelCanvas, f: number) {
  // Bright Sky + Drifting Clouds
  p.rect(0, 0, 120, 44, '#38bdf8');
  p.dither(0, 30, 120, 14, '#38bdf8', '#7dd3fc');
  const cx1 = (f * 2 + 12) % 130;
  p.rect((cx1 - 16 + 120) % 120, 10, 22, 6, '#f8fafc');
  p.rect((cx1 - 12 + 120) % 120, 7, 12, 3, '#ffffff');

  // Pixel Rainbow Arc Right
  const rbColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6'];
  rbColors.forEach((rc, idx) => {
    p.line(74 + idx * 2, 36, 98, 12 + idx * 2, rc, 2);
  });

  // Rocky Stepped Cliff Left & Right
  p.rect(0, 26, 44, 48, '#57534e');
  p.rect(74, 30, 46, 44, '#44403c');
  // Cliff Highlights & Greenery Top
  p.rect(0, 22, 46, 6, '#16a34a');
  p.rect(0, 22, 44, 3, '#22c55e');
  p.rect(72, 26, 48, 6, '#15803d');
  p.rect(74, 26, 46, 3, '#22c55e');

  // River Top Feeding the Falls
  p.rect(44, 24, 30, 6, '#0284c7');

  // Animated Cascading Waterfall Stream
  p.rect(46, 26, 26, 48, '#0284c7');
  p.rect(49, 26, 20, 48, '#38bdf8');
  for (let row = 0; row < 46; row += 3) {
    const fallY = 26 + ((row + f * 3) % 46);
    p.rect(50 + ((row * 3) % 16), fallY, 3, 4, '#e0f2fe');
    p.rect(48 + ((row * 7) % 18), (fallY + 4) % 72 > 26 ? (fallY + 4) % 72 : 28, 2, 3, '#ffffff');
  }

  // Basin Pool & Ripples
  p.rect(0, 72, 120, 18, '#0369a1');
  p.rect(0, 72, 120, 3, '#0284c7');
  p.rect(10, 79, 24, 2, '#38bdf8');
  p.rect(86, 82, 22, 2, '#38bdf8');

  // Churning Splash Foam Particles at Falls Base
  const splashShift = f % 4;
  p.rect(42, 70, 34, 5, '#e0f2fe');
  p.rect(45 + splashShift, 68, 8, 3, '#ffffff');
  p.rect(62 - splashShift, 67, 8, 4, '#ffffff');
  p.px(40 + splashShift, 66, '#ffffff');
  p.px(75 - splashShift, 65, '#ffffff');

  // Foreground Pine & Grass Corners
  p.rect(0, 68, 22, 22, '#14532d');
  p.rect(0, 66, 20, 3, '#22c55e');
  p.rect(98, 68, 22, 22, '#14532d');
  p.rect(100, 66, 20, 3, '#22c55e');
}

function drawSunsetTrain(p: PixelCanvas) {
  // Warm Sunset Gradient Sky
  p.rect(0, 0, 120, 18, '#7c2d12');
  p.rect(0, 18, 120, 16, '#c2410c');
  p.rect(0, 34, 120, 14, '#f97316');
  p.rect(0, 48, 120, 10, '#facc15');
  // Setting Pixel Sun
  p.disc(86, 46, 12, '#fef08a');
  p.disc(86, 46, 8, '#ffffff');

  // Distant Mountain Layer
  p.tri(24, 34, 28, 24, '#431407');
  p.tri(64, 36, 30, 22, '#581c0c');
  p.tri(104, 38, 24, 20, '#431407');

  // Shimmering Sunset River
  p.rect(0, 58, 120, 32, '#1e3a8a');
  p.dither(0, 58, 120, 12, '#9a3412', '#1e3a8a');
  p.rect(74, 62, 24, 2, '#fde047');
  p.rect(78, 67, 16, 2, '#f97316');
  p.rect(82, 73, 8, 2, '#fef08a');

  // Stone Arch Viaduct Bridge
  p.rect(0, 52, 120, 6, '#1c1917');
  for (let bx = 4; bx < 120; bx += 22) {
    p.rect(bx, 58, 8, 32, '#292524');
    p.rect(bx + 8, 58, 14, 4, '#292524');
  }

  // Pixel Steam Locomotive + 2 Coaches
  // Smoke trail
  p.disc(28, 32, 4, '#fed7aa');
  p.disc(20, 28, 5, '#fdba74');
  p.disc(11, 24, 4, '#ea580c');
  // Engine
  p.rect(28, 41, 22, 10, '#0f172a');
  p.rect(30, 37, 4, 4, '#0f172a'); // Smokestack
  p.rect(42, 37, 8, 5, '#1e293b'); // Cab
  p.rect(44, 39, 4, 3, '#fef08a'); // Warm cab glow
  p.rect(48, 46, 4, 3, '#fef08a'); // Headlight
  p.rect(26, 49, 26, 2, '#dc2626');
  // Coaches
  [54, 80].forEach((cx) => {
    p.rect(cx, 41, 22, 9, '#1e293b');
    p.rect(cx, 49, 22, 2, '#b91c1c');
    for (let wx = cx + 3; wx <= cx + 17; wx += 5) {
      p.rect(wx, 43, 3, 3, '#fde047');
    }
  });
}

function drawSakuraShrine(p: PixelCanvas) {
  // Morning Pastel Sky
  p.rect(0, 0, 120, 28, '#93c5fd');
  p.dither(0, 28, 120, 16, '#93c5fd', '#dbeafe');
  p.rect(0, 44, 120, 18, '#fce7f3');

  // Mt. Fuji in Background
  p.tri(76, 24, 36, 38, '#475569');
  p.tri(76, 24, 14, 14, '#f8fafc');
  p.rect(68, 36, 6, 3, '#f8fafc');
  p.rect(78, 36, 6, 3, '#f8fafc');

  // Rolling Hills & Temple Steps
  p.rect(0, 58, 120, 32, '#166534');
  p.rect(0, 58, 120, 4, '#22c55e');
  // Stone Path
  for (let i = 0; i < 6; i += 1) {
    const pw = 18 + i * 6;
    p.rect(50 - pw / 2, 62 + i * 5, pw, 4, i % 2 === 0 ? '#cbd5e1' : '#94a3b8');
  }

  // Crimson Pixel Torii Gate
  p.rect(28, 32, 44, 4, '#991b1b');
  p.rect(24, 29, 52, 4, '#dc2626');
  p.rect(32, 40, 36, 3, '#dc2626');
  p.rect(36, 35, 5, 32, '#dc2626');
  p.rect(59, 35, 5, 32, '#dc2626');
  p.rect(35, 63, 7, 5, '#1e293b');
  p.rect(58, 63, 7, 5, '#1e293b');
  p.rect(47, 35, 6, 5, '#fbbf24');

  // Stone Lanterns
  p.rect(18, 56, 6, 12, '#94a3b8');
  p.rect(19, 58, 4, 3, '#fef08a');
  p.rect(86, 56, 6, 12, '#94a3b8');
  p.rect(87, 58, 4, 3, '#fef08a');

  // Lush Sakura Cherry Blossom Canopy
  p.rect(0, 14, 14, 44, '#451a03'); // Trunk
  p.disc(14, 18, 14, '#f472b6');
  p.disc(28, 14, 12, '#f9a8d4');
  p.disc(8, 28, 10, '#ec4899');
  p.disc(104, 16, 14, '#f472b6');
  p.disc(92, 12, 10, '#fbcfe8');
  // Floating Petals
  [[36, 22], [54, 18], [72, 28], [44, 48], [82, 44]].forEach(([px, py]) => {
    p.rect(px, py, 2, 2, '#fbcfe8');
  });
}

function drawRetroArcade(p: PixelCanvas) {
  // Hangar Interior
  p.rect(0, 0, 120, 90, '#0f172a');
  p.rect(8, 8, 104, 72, '#1e293b');
  // Structural Beams & Wall Screens
  for (let gx = 16; gx <= 104; gx += 22) {
    p.rect(gx, 8, 2, 72, '#334155');
  }
  p.rect(12, 16, 20, 12, '#0284c7');
  p.rect(14, 18, 12, 2, '#7dd3fc');
  p.rect(14, 22, 8, 2, '#4ade80');
  p.rect(88, 16, 20, 12, '#0284c7');
  p.rect(90, 18, 14, 2, '#facc15');
  p.rect(90, 22, 10, 2, '#f87171');

  // Hangar Floor + Caution Stripes
  p.rect(0, 74, 120, 16, '#334155');
  for (let sx = 0; sx < 120; sx += 8) {
    p.rect(sx, 74, 4, 3, '#facc15');
    p.rect(sx + 4, 74, 4, 3, '#0f172a');
  }

  // Hero 8-Bit Giant Mecha Robot
  // Shoulders & Arms
  p.rect(32, 26, 14, 14, '#dc2626');
  p.rect(74, 26, 14, 14, '#dc2626');
  p.rect(34, 40, 10, 18, '#94a3b8');
  p.rect(76, 40, 10, 18, '#94a3b8');
  // Torso
  p.rect(44, 28, 32, 24, '#2563eb');
  p.rect(48, 32, 24, 10, '#f8fafc');
  p.rect(56, 35, 8, 5, '#facc15'); // Chest Core
  // Head + V-Fin + Glowing Visor
  p.rect(52, 14, 16, 14, '#f8fafc');
  p.rect(50, 12, 5, 3, '#facc15');
  p.rect(65, 12, 5, 3, '#facc15');
  p.rect(54, 19, 12, 4, '#22d3ee'); // Glowing visor
  // Waist & Legs
  p.rect(46, 52, 28, 6, '#f8fafc');
  p.rect(44, 58, 12, 16, '#1d4ed8');
  p.rect(64, 58, 12, 16, '#1d4ed8');
  p.rect(42, 70, 15, 5, '#dc2626');
  p.rect(63, 70, 15, 5, '#dc2626');
}

function drawNightMarket(p: PixelCanvas) {
  // Night Sky & Stars
  p.rect(0, 0, 120, 62, '#0b1120');
  p.px(16, 10, '#fef08a');
  p.px(44, 8, '#cbd5e1');
  p.px(98, 12, '#fef08a');
  p.disc(104, 16, 5, '#fef3c7');
  p.disc(106, 14, 4, '#0b1120');

  // Food Stall Structure
  p.rect(20, 26, 80, 44, '#451a03');
  p.rect(24, 34, 72, 22, '#fef08a'); // Warm Lit Interior
  // Vendor Silhouette
  p.disc(58, 44, 4, '#334155');
  p.rect(52, 48, 12, 8, '#0f172a');
  // Striped Awning
  for (let ax = 18; ax < 102; ax += 6) {
    p.rect(ax, 24, 3, 9, '#dc2626');
    p.rect(ax + 3, 24, 3, 9, '#f8fafc');
  }
  // Wooden Counter + Bowls
  p.rect(20, 56, 80, 14, '#92400e');
  p.rect(18, 55, 84, 3, '#d97706');
  p.rect(34, 52, 8, 3, '#ef4444');
  p.rect(74, 52, 8, 3, '#38bdf8');
  // Hanging Paper Lanterns
  [26, 44, 74, 92].forEach((lx) => {
    p.px(lx + 2, 18, '#f8fafc');
    p.rect(lx, 20, 5, 7, '#ef4444');
    p.rect(lx + 1, 21, 3, 5, '#fde047');
  });

  // Stools & Cobblestone Street
  p.rect(36, 66, 6, 8, '#78350f');
  p.rect(76, 66, 6, 8, '#78350f');
  p.rect(0, 70, 120, 20, '#1e293b');
  p.rect(24, 74, 72, 3, '#fde047');
  p.dither(0, 78, 120, 12, '#1e293b', '#0f172a');
}

export function renderArtworkFrameToBuffer(
  artId: GalleryArtId,
  frame: number,
  palette: GalleryArtPalette,
  targetCanvas: HTMLCanvasElement,
) {
  if (targetCanvas.width !== ART_W) targetCanvas.width = ART_W;
  if (targetCanvas.height !== ART_H) targetCanvas.height = ART_H;
  const ctx = targetCanvas.getContext('2d', { willReadFrequently: palette === 'lcd' });
  if (!ctx) return;

  const p = new PixelCanvas(ctx);
  switch (artId) {
    case 'rain-cyber':
      drawRainCyber(p, frame);
      break;
    case 'campfire':
      drawCampfire(p, frame);
      break;
    case 'space-ship':
      drawSpaceShip(p, frame);
      break;
    case 'koi-pond':
      drawKoiPond(p, frame);
      break;
    case 'cafe-cat':
      drawCafeCat(p, frame);
      break;
    case 'waterfall':
      drawWaterfall(p, frame);
      break;
    case 'sunset-train':
      drawSunsetTrain(p);
      break;
    case 'sakura-shrine':
      drawSakuraShrine(p);
      break;
    case 'retro-arcade':
      drawRetroArcade(p);
      break;
    case 'night-market':
      drawNightMarket(p);
      break;
  }

  if (palette === 'lcd') {
    const lcd = getThemeLcdColors();
    const imgData = ctx.getImageData(0, 0, ART_W, ART_H);
    const d = imgData.data;
    for (let y = 0; y < ART_H; y += 1) {
      for (let x = 0; x < ART_W; x += 1) {
        const idx = (y * ART_W + x) * 4;
        const luma = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
        const bayer = (BAYER_4X4[y % 4][x % 4] / 16 - 0.5) * 46;
        const val = luma + bayer;
        const chosen = val < 82 ? lcd.fg : val < 168 ? lcd.sec : lcd.bg;
        d[idx] = chosen[0];
        d[idx + 1] = chosen[1];
        d[idx + 2] = chosen[2];
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
}

export function captureGalleryArtDataUrl(
  artId: GalleryArtId,
  palette: GalleryArtPalette = 'color',
  frame = 0,
  scale = 4,
): string {
  if (typeof document === 'undefined') return '';
  const srcCanvas = document.createElement('canvas');
  renderArtworkFrameToBuffer(artId, frame, palette, srcCanvas);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = ART_W * scale;
  outCanvas.height = ART_H * scale;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return srcCanvas.toDataURL('image/png');
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(srcCanvas, 0, 0, outCanvas.width, outCanvas.height);
  return outCanvas.toDataURL('image/png');
}

interface PixelGalleryArtProps {
  artId: GalleryArtId;
  palette?: GalleryArtPalette;
  playing?: boolean;
  speed?: 1 | 2;
  className?: string;
  onFrameChange?: (frame: number) => void;
}

export const PixelGalleryArt: React.FC<PixelGalleryArtProps> = ({
  artId,
  palette = 'color',
  playing = true,
  speed = 1,
  className = 'w-full h-full',
  onFrameChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const onFrameRef = useRef(onFrameChange);

  useEffect(() => {
    onFrameRef.current = onFrameChange;
  }, [onFrameChange]);

  const meta = GALLERY_ARTWORKS.find((item) => item.id === artId) ?? GALLERY_ARTWORKS[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    frameRef.current = 0;
    renderArtworkFrameToBuffer(artId, 0, palette, canvas);
    onFrameRef.current?.(0);

    if (!meta.animated || !playing) return;

    const intervalMs = Math.max(55, Math.round(1000 / (meta.fps * speed)));
    const timer = window.setInterval(() => {
      frameRef.current = (frameRef.current + 1) % meta.totalFrames;
      if (canvasRef.current) {
        renderArtworkFrameToBuffer(artId, frameRef.current, palette, canvasRef.current);
      }
      onFrameRef.current?.(frameRef.current);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [artId, meta.animated, meta.fps, meta.totalFrames, palette, playing, speed]);

  return (
    <canvas
      ref={canvasRef}
      width={ART_W}
      height={ART_H}
      className={className}
      style={{ imageRendering: 'pixelated' }}
      aria-label={meta.titleEn}
    />
  );
};
