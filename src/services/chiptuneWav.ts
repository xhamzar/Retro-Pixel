'use client';

export interface OsMusicPreset {
  id: string;
  name: string;
  artist: string;
  durationSec: number;
  tempoMs: number;
  notes: number[];
  bass: number[];
}

export const OS_MUSIC_PRESETS: OsMusicPreset[] = [
  {
    id: 'os-lagu-favorit',
    name: 'Lagu Favorit 8-Bit',
    artist: 'Retro Synth',
    durationSec: 24,
    tempoMs: 210,
    notes: [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 880, 784, 659, 0],
    bass: [131, 131, 165, 165, 147, 147, 175, 175, 131, 131, 165, 196, 175, 165, 147, 131],
  },
  {
    id: 'os-melodi-saku',
    name: 'Melodi Saku',
    artist: 'Pixel Synth',
    durationSec: 24,
    tempoMs: 185,
    notes: [440, 523, 659, 523, 440, 392, 440, 523, 587, 659, 784, 659, 587, 523, 440, 0],
    bass: [110, 110, 131, 131, 98, 98, 110, 131, 147, 147, 196, 165, 147, 131, 110, 98],
  },
  {
    id: 'os-senja-monokrom',
    name: 'Senja Monokrom',
    artist: 'Lo-Fi Chip',
    durationSec: 24,
    tempoMs: 240,
    notes: [392, 494, 587, 784, 659, 587, 494, 392, 330, 392, 494, 587, 494, 392, 330, 0],
    bass: [98, 98, 123, 147, 131, 123, 110, 98, 82, 98, 123, 147, 123, 98, 82, 82],
  },
  {
    id: 'os-arcade-rush',
    name: 'Arcade Rush',
    artist: 'Gameboy Beat',
    durationSec: 24,
    tempoMs: 155,
    notes: [659, 659, 0, 659, 0, 523, 659, 0, 784, 0, 0, 0, 392, 0, 0, 0],
    bass: [165, 196, 165, 196, 131, 165, 196, 165, 196, 220, 247, 196, 98, 131, 147, 165],
  },
];

const wavCache = new Map<string, string>();

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

export function synthesizeChiptuneWavUrl(presetId: string): { url: string; durationSec: number; name: string } | null {
  const preset = OS_MUSIC_PRESETS.find((p) => p.id === presetId);
  if (!preset || typeof window === 'undefined') return null;

  const cached = wavCache.get(presetId);
  if (cached) {
    return { url: cached, durationSec: preset.durationSec, name: preset.name };
  }

  const sampleRate = 22050;
  const totalSamples = Math.floor(sampleRate * preset.durationSec);
  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const stepSec = preset.tempoMs / 1000;
  let leadPhase = 0;
  let bassPhase = 0;

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const stepIdx = Math.floor(t / stepSec) % preset.notes.length;
    const localPos = (t % stepSec) / stepSec;
    const env = localPos < 0.08 ? localPos / 0.08 : Math.max(0.1, 1 - (localPos - 0.08) * 0.9);

    const leadFreq = preset.notes[stepIdx];
    const bassFreq = preset.bass[stepIdx % preset.bass.length];

    let sample = 0;
    if (leadFreq > 0) {
      leadPhase = (leadPhase + leadFreq / sampleRate) % 1;
      const square = leadPhase < 0.25 ? 1 : -1;
      sample += square * 0.22 * env;
    }
    if (bassFreq > 0) {
      bassPhase = (bassPhase + bassFreq / sampleRate) % 1;
      const tri = 4 * Math.abs(bassPhase - 0.5) - 1;
      sample += tri * 0.18;
    }

    // Gentle lo-fi percussion tick every step
    if (localPos < 0.045) {
      const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 2 - 1;
      sample += noise * (stepIdx % 2 === 0 ? 0.08 : 0.04);
    }

    const clamped = Math.max(-0.95, Math.min(0.95, sample));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  wavCache.set(presetId, url);
  return { url, durationSec: preset.durationSec, name: preset.name };
}
