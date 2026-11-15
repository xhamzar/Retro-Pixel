import type {
  LanguageCode,
  TamagotchiAttentionReason,
  TamagotchiEvolutionId,
  TamagotchiPetState,
  TamagotchiStage,
} from '@/src/types/os';

const STORAGE_KEY = 'rpos_tamagotchi_v1';
export const TAMAGOTCHI_EVENT = 'rpos-tamagotchi-updated';

export interface EvolutionMeta {
  id: TamagotchiEvolutionId;
  nameId: string;
  nameEn: string;
  descId: string;
  descEn: string;
  reqId: string;
  reqEn: string;
}

export const EVOLUTION_CATALOG: EvolutionMeta[] = [
  {
    id: 'angel_star',
    nameId: 'Bintang Penjaga',
    nameEn: 'Star Guardian',
    descId: 'Wujud sempurna penuh kasih & disiplin tinggi.',
    descEn: 'Perfect form with high discipline and ideal care.',
    reqId: 'Kesalahan ≤1, Disiplin ≥3',
    reqEn: 'Mistakes ≤1, Discipline ≥3',
  },
  {
    id: 'sporty_fox',
    nameId: 'Rubah Lincah',
    nameEn: 'Agile Fox',
    descId: 'Lincah, aktif bermain mini-game, dan bugar.',
    descEn: 'Energetic buddy raised through frequent mini-games.',
    reqId: 'Main ≥3x, Berat ≤38gr',
    reqEn: 'Play ≥3x, Weight ≤38gr',
  },
  {
    id: 'chubby_dino',
    nameId: 'Dino Gembul',
    nameEn: 'Chubby Dino',
    descId: 'Suka camilan manis dan bersantai seharian.',
    descEn: 'Loves sweet snacks and cozy naps.',
    reqId: 'Camilan ≥4 atau Berat ≥40gr',
    reqEn: 'Snacks ≥4 or Weight ≥40gr',
  },
  {
    id: 'rebel_bat',
    nameId: 'Kelelawar Jahil',
    nameEn: 'Rebel Bat',
    descId: 'Mandiri dan usil karena sering terlewat rawatannya.',
    descEn: 'Mischievous nocturnal pet shaped by missed calls.',
    reqId: 'Kesalahan ≥2 / kurang disiplin',
    reqEn: 'Mistakes ≥2 / low discipline',
  },
];

export function createInitialPetState(
  name = 'Piko',
  generation = 1,
  unlockedEvolutions: TamagotchiEvolutionId[] = [],
  history: TamagotchiPetState['history'] = []
): TamagotchiPetState {
  const now = Date.now();
  return {
    generation,
    name: name.trim() || 'Piko',
    stage: 'egg',
    evolutionId: null,
    hunger: 3,
    happiness: 3,
    discipline: 1,
    hygiene: 4,
    energy: 100,
    weightGr: 15,
    ageMinutes: 0,
    poopCount: 0,
    isSick: false,
    sickTicks: 0,
    lightsOn: true,
    isSleeping: false,
    careMistakes: 0,
    snacksEaten: 0,
    gamesPlayed: 0,
    attentionReason: null,
    lastAlertKey: '',
    speedMultiplier: 1,
    paused: false,
    eggProgressSec: 0,
    bornAt: now,
    lastTickAt: now,
    unlockedEvolutions,
    history,
  };
}

export function loadTamagotchiState(): TamagotchiPetState {
  if (typeof window === 'undefined') return createInitialPetState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialPetState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<TamagotchiPetState>;
    return {
      ...createInitialPetState(),
      ...parsed,
      unlockedEvolutions: Array.isArray(parsed.unlockedEvolutions) ? parsed.unlockedEvolutions : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return createInitialPetState();
  }
}

export function saveTamagotchiState(state: TamagotchiPetState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(TAMAGOTCHI_EVENT, { detail: state }));
  } catch {
    // Ignore storage quota issues
  }
}

export function evaluateEvolution(state: TamagotchiPetState): TamagotchiEvolutionId {
  if (state.careMistakes <= 1 && state.discipline >= 3 && state.snacksEaten <= 6) {
    return 'angel_star';
  }
  if (state.gamesPlayed >= 3 && state.weightGr <= 38 && state.careMistakes <= 3) {
    return 'sporty_fox';
  }
  if (state.snacksEaten >= 4 || state.weightGr >= 40) {
    return 'chubby_dino';
  }
  return 'rebel_bat';
}

export function computeAttentionReason(state: TamagotchiPetState): TamagotchiAttentionReason {
  if (state.stage === 'egg' || state.stage === 'angel') return null;
  if (state.isSick) return 'sick';
  if (state.isSleeping && state.lightsOn) return 'lights';
  if (state.hunger <= 1) return 'hungry';
  if (state.poopCount > 0) return 'poop';
  if (state.happiness <= 1) return 'sad';
  if (state.attentionReason === 'misbehave') return 'misbehave';
  return null;
}

export function getAttentionMessage(reason: TamagotchiAttentionReason, petName: string, lang: LanguageCode): string {
  switch (reason) {
    case 'sick':
      return lang === 'id' ? `${petName} sakit! Segera beri obat.` : `${petName} is sick! Give medicine.`;
    case 'lights':
      return lang === 'id' ? `${petName} mengantuk! Matikan lampu.` : `${petName} is sleepy! Turn off lights.`;
    case 'hungry':
      return lang === 'id' ? `${petName} lapar! Beri makanan.` : `${petName} is hungry! Feed meal.`;
    case 'poop':
      return lang === 'id' ? `${petName} buang air! Bersihkan layar.` : `${petName} pooped! Clean the floor.`;
    case 'sad':
      return lang === 'id' ? `${petName} bosan! Ajak main mini-game.` : `${petName} is bored! Play a mini-game.`;
    case 'misbehave':
      return lang === 'id' ? `${petName} berulah! Beri disiplin.` : `${petName} is misbehaving! Discipline now.`;
    default:
      return lang === 'id' ? `${petName} baik-baik saja.` : `${petName} is doing fine.`;
  }
}

export function getStageLabel(stage: TamagotchiStage, evolutionId: TamagotchiEvolutionId | null, lang: LanguageCode): string {
  if (stage === 'adult' && evolutionId) {
    const meta = EVOLUTION_CATALOG.find((e) => e.id === evolutionId);
    if (meta) return lang === 'id' ? meta.nameId : meta.nameEn;
  }
  const map: Record<TamagotchiStage, { id: string; en: string }> = {
    egg: { id: 'Telur', en: 'Egg' },
    baby: { id: 'Bayi', en: 'Baby' },
    child: { id: 'Anak', en: 'Child' },
    teen: { id: 'Remaja', en: 'Teen' },
    adult: { id: 'Dewasa', en: 'Adult' },
    angel: { id: 'Malaikat', en: 'Angel' },
  };
  return map[stage][lang];
}

export interface AdvanceResult {
  state: TamagotchiPetState;
  changed: boolean;
  newAlertReason: TamagotchiAttentionReason;
  evolvedToStage: TamagotchiStage | null;
}

export function advanceTamagotchiState(
  prev: TamagotchiPetState,
  nowMs: number = Date.now(),
  overrideDeltaSimSec?: number
): AdvanceResult {
  if (prev.paused || prev.stage === 'angel') {
    if (nowMs - prev.lastTickAt > 1000) {
      return {
        state: { ...prev, lastTickAt: nowMs },
        changed: false,
        newAlertReason: null,
        evolvedToStage: null,
      };
    }
    return { state: prev, changed: false, newAlertReason: null, evolvedToStage: null };
  }

  const realDeltaSec = Math.max(0, (nowMs - prev.lastTickAt) / 1000);
  // Cap catch-up simulation on app reopen at 6 simulated hours so pets don't vanish unexpectedly
  const rawSimSec =
    overrideDeltaSimSec !== undefined
      ? overrideDeltaSimSec
      : Math.min(6 * 3600, realDeltaSec * prev.speedMultiplier);

  if (rawSimSec < 1) {
    return { state: prev, changed: false, newAlertReason: null, evolvedToStage: null };
  }

  const next: TamagotchiPetState = {
    ...prev,
    lastTickAt: nowMs,
  };

  let evolvedToStage: TamagotchiStage | null = null;

  // Egg Hatching Phase (20 seconds at 1x)
  if (next.stage === 'egg') {
    next.eggProgressSec += rawSimSec;
    if (next.eggProgressSec >= 20) {
      next.stage = 'baby';
      next.hunger = 3;
      next.happiness = 3;
      next.hygiene = 4;
      next.energy = 100;
      next.weightGr = 16;
      evolvedToStage = 'baby';
    }
    next.attentionReason = computeAttentionReason(next);
    return { state: next, changed: true, newAlertReason: null, evolvedToStage };
  }

  const prevAgeMin = next.ageMinutes;
  const addedMinutes = rawSimSec / 60;
  next.ageMinutes = prevAgeMin + addedMinutes;

  // Step through 5-minute simulation buckets cleanly for deterministic decay & poop
  const prevBuckets = Math.floor(prevAgeMin / 5);
  const nextBuckets = Math.floor(next.ageMinutes / 5);
  const buckets = Math.max(0, Math.min(72, nextBuckets - prevBuckets));

  for (let b = 0; b < buckets; b++) {
    const simStepIndex = prevBuckets + b + 1;

    // Sleep cycle & energy
    const currentHour = new Date(nowMs).getHours();
    const isNightHour = currentHour >= 22 || currentHour < 6;

    if (!next.isSleeping && (next.energy <= 18 || (isNightHour && next.energy < 70))) {
      next.isSleeping = true;
    }

    if (next.isSleeping) {
      next.energy = Math.min(100, next.energy + (next.lightsOn ? 5 : 12));
      if (next.lightsOn) {
        // Sleeping with lights on causes stress / occasional mistake
        if (simStepIndex % 3 === 0) {
          next.careMistakes += 1;
          next.happiness = Math.max(0, next.happiness - 1);
        }
      }
      if (next.energy >= 98 && !isNightHour) {
        next.isSleeping = false;
        next.lightsOn = true;
      }
    } else {
      next.energy = Math.max(0, next.energy - 3);

      // Hunger & Happiness decay roughly every 15 sim minutes (3 buckets)
      if (simStepIndex % 3 === 0) {
        if (next.hunger > 0) {
          next.hunger -= 1;
        } else {
          next.careMistakes += 1;
        }
      }

      if (simStepIndex % 4 === 0) {
        if (next.happiness > 0) {
          next.happiness -= 1;
        } else {
          next.careMistakes += 1;
        }
      }

      // Poop every ~25 sim minutes (5 buckets)
      if (simStepIndex % 5 === 0) {
        if (next.poopCount < 4) {
          next.poopCount += 1;
        }
        next.hygiene = Math.max(0, next.hygiene - 1);
      }

      // Periodic mischievous fake call if discipline < 4
      if (
        next.stage !== 'baby' &&
        !next.isSick &&
        next.discipline < 4 &&
        next.hunger >= 2 &&
        next.happiness >= 2 &&
        next.poopCount === 0 &&
        simStepIndex % 7 === 0
      ) {
        next.attentionReason = 'misbehave';
      }
    }

    // Sickness check
    if (
      !next.isSick &&
      (next.poopCount >= 3 || (next.hunger === 0 && next.happiness === 0) || next.hygiene === 0)
    ) {
      next.isSick = true;
      next.sickTicks = 1;
    } else if (next.isSick) {
      next.sickTicks += 1;
      if (next.sickTicks % 4 === 0) {
        next.careMistakes += 1;
      }
      // If left critically sick for ~12+ buckets
      if (next.sickTicks >= 16) {
        next.stage = 'angel';
        next.isSleeping = false;
        next.attentionReason = null;
        next.history = [
          {
            generation: next.generation,
            name: next.name,
            evolutionId: next.evolutionId,
            ageHours: Math.max(1, Math.round(next.ageMinutes / 60)),
            careMistakes: next.careMistakes,
            outcome: 'angel',
            endedAt: nowMs,
          },
          ...next.history.slice(0, 9),
        ];
        evolvedToStage = 'angel';
        break;
      }
    }
  }

  // Stage Evolution Checks (if still alive)
  if (next.stage !== 'angel') {
    if (next.stage === 'baby' && next.ageMinutes >= 20) {
      next.stage = 'child';
      next.weightGr = Math.max(next.weightGr, 22);
      evolvedToStage = 'child';
    } else if (next.stage === 'child' && next.ageMinutes >= 120) {
      next.stage = 'teen';
      next.weightGr = Math.max(next.weightGr, 28);
      evolvedToStage = 'teen';
    } else if (next.stage === 'teen' && next.ageMinutes >= 360) {
      next.stage = 'adult';
      const branch = evaluateEvolution(next);
      next.evolutionId = branch;
      if (!next.unlockedEvolutions.includes(branch)) {
        next.unlockedEvolutions = [...next.unlockedEvolutions, branch];
      }
      evolvedToStage = 'adult';
    }
  }

  const computedReason = computeAttentionReason(next);
  next.attentionReason = computedReason;

  let newAlertReason: TamagotchiAttentionReason = null;
  if (computedReason) {
    const alertKey = `${next.generation}-${next.stage}-${computedReason}-${Math.floor(next.ageMinutes / 10)}`;
    if (alertKey !== prev.lastAlertKey && prev.attentionReason !== computedReason) {
      newAlertReason = computedReason;
      next.lastAlertKey = alertKey;
    }
  }

  return {
    state: next,
    changed: true,
    newAlertReason,
    evolvedToStage,
  };
}

export function performFeedMeal(state: TamagotchiPetState): {
  state: TamagotchiPetState;
  accepted: boolean;
  reason?: 'sleeping' | 'sick' | 'full' | 'angel';
} {
  if (state.stage === 'egg' || state.stage === 'angel') {
    return { state, accepted: false, reason: 'angel' };
  }
  if (state.isSleeping) return { state, accepted: false, reason: 'sleeping' };
  if (state.isSick) return { state, accepted: false, reason: 'sick' };
  if (state.hunger >= 4) return { state, accepted: false, reason: 'full' };

  const updated: TamagotchiPetState = {
    ...state,
    hunger: Math.min(4, state.hunger + 1),
    weightGr: state.weightGr + 1,
    energy: Math.min(100, state.energy + 6),
    attentionReason: null,
  };
  updated.attentionReason = computeAttentionReason(updated);
  return { state: updated, accepted: true };
}

export function performFeedSnack(state: TamagotchiPetState): {
  state: TamagotchiPetState;
  accepted: boolean;
  toothache: boolean;
  reason?: 'sleeping' | 'sick' | 'angel';
} {
  if (state.stage === 'egg' || state.stage === 'angel') {
    return { state, accepted: false, toothache: false, reason: 'angel' };
  }
  if (state.isSleeping) return { state, accepted: false, toothache: false, reason: 'sleeping' };
  if (state.isSick) return { state, accepted: false, toothache: false, reason: 'sick' };

  const nextSnacks = state.snacksEaten + 1;
  const triggerToothache = nextSnacks % 5 === 0 || (state.happiness >= 4 && nextSnacks % 2 === 0);

  const updated: TamagotchiPetState = {
    ...state,
    happiness: Math.min(4, state.happiness + 1),
    weightGr: state.weightGr + 2,
    snacksEaten: nextSnacks,
    isSick: triggerToothache ? true : state.isSick,
    sickTicks: triggerToothache ? Math.max(1, state.sickTicks) : state.sickTicks,
    attentionReason: null,
  };
  updated.attentionReason = computeAttentionReason(updated);
  return { state: updated, accepted: true, toothache: triggerToothache };
}

export function performToggleLights(state: TamagotchiPetState): TamagotchiPetState {
  const nextLights = !state.lightsOn;
  const startNap = !nextLights && !state.isSleeping && state.stage !== 'egg' && state.stage !== 'angel' && state.energy <= 60;
  const updated: TamagotchiPetState = {
    ...state,
    lightsOn: nextLights,
    isSleeping: startNap ? true : state.isSleeping,
  };
  updated.attentionReason = computeAttentionReason(updated);
  return updated;
}

export function performCleanPoop(state: TamagotchiPetState): {
  state: TamagotchiPetState;
  cleaned: boolean;
} {
  if (state.poopCount === 0 && state.hygiene >= 4) {
    return { state, cleaned: false };
  }
  const updated: TamagotchiPetState = {
    ...state,
    poopCount: 0,
    hygiene: 4,
    happiness: Math.min(4, state.happiness + (state.poopCount > 0 ? 1 : 0)),
  };
  updated.attentionReason = computeAttentionReason(updated);
  return { state: updated, cleaned: true };
}

export function performMedicine(state: TamagotchiPetState): {
  state: TamagotchiPetState;
  cured: boolean;
  dosesLeft: number;
} {
  if (!state.isSick) return { state, cured: false, dosesLeft: 0 };
  const remainingTicks = state.sickTicks > 6 ? Math.floor(state.sickTicks / 2) : 0;
  const stillSick = remainingTicks > 0;
  const updated: TamagotchiPetState = {
    ...state,
    isSick: stillSick,
    sickTicks: remainingTicks,
    hygiene: Math.max(2, state.hygiene),
  };
  updated.attentionReason = computeAttentionReason(updated);
  return { state: updated, cured: !stillSick, dosesLeft: stillSick ? 1 : 0 };
}

export function performDiscipline(state: TamagotchiPetState): {
  state: TamagotchiPetState;
  wasMisbehaving: boolean;
} {
  if (state.stage === 'egg' || state.stage === 'angel' || state.isSleeping) {
    return { state, wasMisbehaving: false };
  }
  if (state.attentionReason === 'misbehave') {
    const updated: TamagotchiPetState = {
      ...state,
      discipline: Math.min(4, state.discipline + 1),
      attentionReason: null,
    };
    updated.attentionReason = computeAttentionReason(updated);
    return { state: updated, wasMisbehaving: true };
  }
  // Scolding when not misbehaving upsets the pet
  const updated: TamagotchiPetState = {
    ...state,
    happiness: Math.max(0, state.happiness - 1),
  };
  updated.attentionReason = computeAttentionReason(updated);
  return { state: updated, wasMisbehaving: false };
}

export function applyMiniGameReward(state: TamagotchiPetState, won: boolean): TamagotchiPetState {
  const updated: TamagotchiPetState = {
    ...state,
    gamesPlayed: state.gamesPlayed + 1,
    happiness: Math.min(4, state.happiness + (won ? 2 : 1)),
    weightGr: Math.max(12, state.weightGr - (won ? 2 : 1)),
    energy: Math.max(5, state.energy - 6),
    attentionReason: state.attentionReason === 'misbehave' ? 'misbehave' : null,
  };
  updated.attentionReason = computeAttentionReason(updated);
  return updated;
}
