import { Howl, Howler } from 'howler';

type SoundCue = 'click' | 'select' | 'open' | 'back' | 'notify' | 'error' | 'alarm' | 'shutter';

class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.6;
  private chiptuneTimer: ReturnType<typeof setInterval> | null = null;
  private howlCache: Partial<Record<SoundCue, Howl>> = {};

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  public configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    Howler.mute(!enabled);
    Howler.volume(this.volume);
    if (!enabled) {
      this.stopChiptuneLoop();
    }
  }

  public isEnabled() {
    return this.enabled;
  }

  public playTone(freq: number, durationMs: number, wave: OscillatorType = 'square', gainScale = 0.16) {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);

    const level = Math.max(0.001, gainScale * this.volume);
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.01);
  }

  public playCue(cue: SoundCue) {
    if (!this.enabled) return;

    // Optional Howler hook if cached, otherwise crisp procedural piezo synthesis
    if (this.howlCache[cue]) {
      this.howlCache[cue]?.play();
      return;
    }

    switch (cue) {
      case 'click':
        this.playTone(980, 24, 'square', 0.1);
        break;
      case 'select':
        this.playTone(1320, 32, 'square', 0.11);
        break;
      case 'open':
        this.playTone(784, 45, 'square', 0.12);
        setTimeout(() => this.playTone(1046, 60, 'square', 0.12), 45);
        break;
      case 'back':
        this.playTone(880, 40, 'square', 0.11);
        setTimeout(() => this.playTone(587, 55, 'square', 0.11), 40);
        break;
      case 'notify':
        this.playTone(1175, 70, 'square', 0.14);
        setTimeout(() => this.playTone(1568, 90, 'square', 0.14), 80);
        setTimeout(() => this.playTone(1975, 110, 'square', 0.12), 170);
        break;
      case 'error':
        this.playTone(220, 90, 'sawtooth', 0.16);
        setTimeout(() => this.playTone(165, 130, 'sawtooth', 0.16), 95);
        break;
      case 'alarm':
        this.playTone(1760, 100, 'square', 0.18);
        setTimeout(() => this.playTone(1760, 100, 'square', 0.18), 140);
        setTimeout(() => this.playTone(1760, 120, 'square', 0.18), 280);
        break;
      case 'shutter':
        this.playTone(1480, 22, 'triangle', 0.18);
        setTimeout(() => this.playTone(420, 35, 'square', 0.15), 25);
        break;
    }
  }

  public playDtmf(digit: string) {
    if (!this.enabled) return;
    const map: Record<string, [number, number]> = {
      '1': [697, 1209],
      '2': [697, 1336],
      '3': [697, 1477],
      '4': [770, 1209],
      '5': [770, 1336],
      '6': [770, 1477],
      '7': [852, 1209],
      '8': [852, 1336],
      '9': [852, 1477],
      '*': [941, 1209],
      '0': [941, 1336],
      '#': [941, 1477],
    };
    const freqs = map[digit];
    if (!freqs) {
      this.playCue('click');
      return;
    }
    this.playTone(freqs[0], 75, 'sine', 0.12);
    this.playTone(freqs[1], 75, 'sine', 0.12);
  }

  public startChiptuneLoop(notes: number[], tempoMs = 220, onStep?: (index: number) => void) {
    this.stopChiptuneLoop();
    let idx = 0;
    const tick = () => {
      if (!this.enabled) return;
      const freq = notes[idx % notes.length];
      if (freq > 0) {
        this.playTone(freq, tempoMs * 0.78, 'square', 0.11);
      }
      onStep?.(idx % notes.length);
      idx++;
    };
    tick();
    this.chiptuneTimer = setInterval(tick, tempoMs);
  }

  public stopChiptuneLoop() {
    if (this.chiptuneTimer) {
      clearInterval(this.chiptuneTimer);
      this.chiptuneTimer = null;
    }
  }

  public playNoteSequence(
    steps: { freq: number; durationMs: number }[],
    wave: OscillatorType = 'square',
    onStep?: (index: number) => void,
    onDone?: () => void
  ): () => void {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idx = 0;

    const runNext = () => {
      if (cancelled || idx >= steps.length) {
        if (!cancelled) onDone?.();
        return;
      }
      const step = steps[idx];
      onStep?.(idx);
      if (step.freq > 0 && this.enabled) {
        this.playTone(step.freq, Math.max(25, step.durationMs * 0.86), wave, 0.14);
      }
      idx += 1;
      timer = setTimeout(runNext, step.durationMs);
    };

    runNext();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }
}

export const soundEngine = new RetroSoundEngine();
