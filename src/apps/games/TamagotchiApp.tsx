'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TamagotchiIconMini,
  TamagotchiPetSprite,
  TamagotchiPoopSprite,
  type SpriteMood,
} from '@/src/components/TamagotchiSprites';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import {
  advanceTamagotchiState,
  applyMiniGameReward,
  createInitialPetState,
  EVOLUTION_CATALOG,
  getAttentionMessage,
  getStageLabel,
  loadTamagotchiState,
  performCleanPoop,
  performDiscipline,
  performFeedMeal,
  performFeedSnack,
  performMedicine,
  performToggleLights,
  saveTamagotchiState,
  TAMAGOTCHI_EVENT,
} from '@/src/services/tamagotchiEngine';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, TamagotchiAttentionReason, TamagotchiPetState } from '@/src/types/os';

type SubView = 'main' | 'feed' | 'play-menu' | 'game-direction' | 'game-catch' | 'stats';

type CareActionId =
  | 'meal'
  | 'lights'
  | 'play'
  | 'medicine'
  | 'clean'
  | 'stats'
  | 'discipline'
  | 'alert';

const CARE_ACTIONS: { id: CareActionId; labelId: string; labelEn: string }[] = [
  { id: 'meal', labelId: 'Makan', labelEn: 'Feed' },
  { id: 'lights', labelId: 'Lampu', labelEn: 'Lights' },
  { id: 'play', labelId: 'Main', labelEn: 'Play' },
  { id: 'medicine', labelId: 'Obat', labelEn: 'Med' },
  { id: 'clean', labelId: 'Bersih', labelEn: 'Clean' },
  { id: 'stats', labelId: 'Status', labelEn: 'Stats' },
  { id: 'discipline', labelId: 'Disiplin', labelEn: 'Train' },
  { id: 'alert', labelId: 'Panggil', labelEn: 'Alert' },
];

interface FallingDrop {
  id: number;
  col: number;
  row: number;
  kind: 'star' | 'rock';
}

function loadSyncedInitialPet(): TamagotchiPetState {
  const initial = loadTamagotchiState();
  const res = advanceTamagotchiState(initial, Date.now());
  if (res.changed) {
    saveTamagotchiState(res.state);
  }
  return res.state;
}

function persistTamagotchiScore(score: number) {
  return db.scores.add({
    gameId: 'tamagotchi',
    score,
    level: 1,
    achievedAt: Date.now(),
  });
}

function buildResetEggState(prev: TamagotchiPetState, customName: string): TamagotchiPetState {
  const now = Date.now();
  const history =
    prev.stage !== 'egg' && prev.stage !== 'angel'
      ? [
          {
            generation: prev.generation,
            name: prev.name,
            evolutionId: prev.evolutionId,
            ageHours: Math.max(0, Math.round(prev.ageMinutes / 60)),
            careMistakes: prev.careMistakes,
            outcome: 'reset' as const,
            endedAt: now,
          },
          ...prev.history.slice(0, 9),
        ]
      : prev.history;
  return createInitialPetState(customName || 'Piko', prev.generation + 1, prev.unlockedEvolutions, history);
}

export const TamagotchiApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const subscribeKey = useOSStore((s) => s.subscribeKey);
  const showToast = useOSStore((s) => s.showToast);
  const pushNotification = useOSStore((s) => s.pushNotification);

  const [pet, setPet] = useState<TamagotchiPetState>(loadSyncedInitialPet);
  const [subView, setSubView] = useState<SubView>('main');
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [statsTab, setStatsTab] = useState<'meter' | 'evo' | 'history'>('meter');

  // Visual animation state
  const [animFrame, setAnimFrame] = useState(0);
  const [petOffsetX, setPetOffsetX] = useState(0);
  const [petFacing, setPetFacing] = useState<'left' | 'right'>('right');
  const [tempMood, setTempMood] = useState<SpriteMood | null>(null);
  const [reactionBubble, setReactionBubble] = useState<string | null>(null);
  const [cleaningWipe, setCleaningWipe] = useState(false);
  const [renameInput, setRenameInput] = useState(pet.name);

  // Mini-game 1: Left / Right Guess
  const [dirRound, setDirRound] = useState(1);
  const [dirWins, setDirWins] = useState(0);
  const [dirPetFace, setDirPetFace] = useState<'left' | 'right' | null>(null);
  const [dirResultText, setDirResultText] = useState('');
  const [dirDone, setDirDone] = useState(false);

  // Mini-game 2: Catch Stars
  const [catchCol, setCatchCol] = useState(2);
  const [catchScore, setCatchScore] = useState(0);
  const [catchTimeLeft, setCatchTimeLeft] = useState(18);
  const [catchDrops, setCatchDrops] = useState<FallingDrop[]>([]);
  const [catchRunning, setCatchRunning] = useState(false);
  const [catchDone, setCatchDone] = useState(false);
  const catchColRef = useRef(2);
  const catchScoreRef = useRef(0);

  useEffect(() => {
    catchColRef.current = catchCol;
  }, [catchCol]);

  useEffect(() => {
    catchScoreRef.current = catchScore;
  }, [catchScore]);

  const commitPet = useCallback(
    (next: TamagotchiPetState) => {
      setPet(next);
      saveTamagotchiState(next);
    },
    []
  );

  const triggerReaction = useCallback((mood: SpriteMood, bubble: string, duration = 1200) => {
    setTempMood(mood);
    setReactionBubble(bubble);
    setTimeout(() => {
      setTempMood(null);
      setReactionBubble(null);
    }, duration);
  }, []);

  // Listen to background updates if triggered externally
  useEffect(() => {
    const onExternalUpdate = (e: Event) => {
      const detail = (e as CustomEvent<TamagotchiPetState>).detail;
      if (detail) setPet(detail);
    };
    window.addEventListener(TAMAGOTCHI_EVENT, onExternalUpdate);
    return () => window.removeEventListener(TAMAGOTCHI_EVENT, onExternalUpdate);
  }, []);

  // Active simulation tick (every 1s for smooth egg countdown & fast-forward)
  useEffect(() => {
    const id = setInterval(() => {
      setAnimFrame((f) => (f + 1) % 4);
      setPet((current) => {
        if (!current.isSleeping && current.stage !== 'egg' && current.stage !== 'angel' && !current.paused) {
          setPetOffsetX((prevX) => {
            if (prevX >= 28) {
              setPetFacing('left');
              return prevX - 7;
            }
            if (prevX <= -28) {
              setPetFacing('right');
              return prevX + 7;
            }
            return petFacing === 'right' ? prevX + 7 : prevX - 7;
          });
        }

        const res = advanceTamagotchiState(current, Date.now());
        if (res.changed) {
          saveTamagotchiState(res.state);
          if (res.evolvedToStage && res.evolvedToStage !== 'angel') {
            soundEngine.playCue('notify');
            const label = getStageLabel(res.state.stage, res.state.evolutionId, language);
            showToast(
              language === 'id'
                ? `${res.state.name} berevolusi menjadi ${label}!`
                : `${res.state.name} evolved to ${label}!`
            );
          } else if (res.newAlertReason) {
            soundEngine.playCue('notify');
            showToast(getAttentionMessage(res.newAlertReason, res.state.name, language));
          }
          return res.state;
        }
        return current;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [language, petFacing, showToast]);

  // Mini-game 2 ticker (Catch Stars)
  useEffect(() => {
    if (subView !== 'game-catch' || !catchRunning || catchDone) return;
    const dropTimer = setInterval(() => {
      setCatchDrops((prevDrops) => {
        const nextDrops: FallingDrop[] = [];
        let deltaScore = 0;

        for (const d of prevDrops) {
          const nextRow = d.row + 1;
          if (nextRow === 4 && d.col === catchColRef.current) {
            if (d.kind === 'star') {
              deltaScore += 10;
              soundEngine.playCue('select');
            } else {
              deltaScore -= 5;
              soundEngine.playCue('error');
            }
            continue;
          }
          if (nextRow < 5) {
            nextDrops.push({ ...d, row: nextRow });
          }
        }

        if (deltaScore !== 0) {
          const updatedScore = Math.max(0, catchScoreRef.current + deltaScore);
          catchScoreRef.current = updatedScore;
          setCatchScore(updatedScore);
        }

        if (Math.random() < 0.62) {
          nextDrops.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            col: Math.floor(Math.random() * 5),
            row: 0,
            kind: Math.random() < 0.72 ? 'star' : 'rock',
          });
        }
        return nextDrops;
      });
    }, 340);

    const countdownTimer = setInterval(() => {
      setCatchTimeLeft((t) => {
        if (t <= 1) {
          setCatchRunning(false);
          setCatchDone(true);
          const finalScore = catchScoreRef.current;
          const won = finalScore >= 30;
          soundEngine.playCue(won ? 'notify' : 'open');
          void persistTamagotchiScore(finalScore);
          setPet((curr) => {
            const updated = applyMiniGameReward(curr, won);
            saveTamagotchiState(updated);
            return updated;
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(dropTimer);
      clearInterval(countdownTimer);
    };
  }, [subView, catchRunning, catchDone]);

  // Care Action Executors
  const handleFeedMeal = () => {
    const res = performFeedMeal(pet);
    if (!res.accepted) {
      soundEngine.playCue('error');
      triggerReaction('refuse', '×');
      const msg =
        res.reason === 'full'
          ? language === 'id'
            ? 'Sudah kenyang!'
            : 'Already full!'
          : res.reason === 'sleeping'
            ? language === 'id'
              ? 'Sedang tidur...'
              : 'Sleeping...'
            : res.reason === 'sick'
              ? language === 'id'
                ? 'Sedang sakit, beri obat!'
                : 'Sick! Give medicine.'
              : language === 'id'
                ? 'Belum bisa makan'
                : 'Cannot eat now';
      showToast(msg);
      return;
    }
    soundEngine.playCue('select');
    commitPet(res.state);
    triggerReaction('eating', '♥');
    setSubView('main');
    showToast(language === 'id' ? 'Makan nasi +1 Kenyang' : 'Meal fed +1 Hunger');
  };

  const handleFeedSnack = () => {
    const res = performFeedSnack(pet);
    if (!res.accepted) {
      soundEngine.playCue('error');
      triggerReaction('refuse', '×');
      showToast(language === 'id' ? 'Menolak camilan' : 'Refused snack');
      return;
    }
    commitPet(res.state);
    setSubView('main');
    if (res.toothache) {
      soundEngine.playCue('error');
      triggerReaction('sick', '!');
      showToast(language === 'id' ? 'Kebanyakan camilan! Gigi sakit!' : 'Too many snacks! Toothache!');
    } else {
      soundEngine.playCue('select');
      triggerReaction('eating', '★');
      showToast(language === 'id' ? 'Camilan lezat +1 Senang' : 'Tasty snack +1 Happy');
    }
  };

  const handleToggleLights = useCallback(() => {
    soundEngine.playCue('click');
    const updated = performToggleLights(pet);
    commitPet(updated);
    showToast(
      updated.lightsOn
        ? language === 'id'
          ? 'Lampu Dinyalakan'
          : 'Lights On'
        : language === 'id'
          ? 'Lampu Dimatikan'
          : 'Lights Off'
    );
  }, [commitPet, language, pet, showToast]);

  const handleMedicine = useCallback(() => {
    const res = performMedicine(pet);
    if (!pet.isSick) {
      soundEngine.playCue('error');
      triggerReaction('refuse', '×');
      showToast(language === 'id' ? 'Pet sedang sehat!' : 'Pet is healthy!');
      return;
    }
    commitPet(res.state);
    if (res.cured) {
      soundEngine.playCue('notify');
      triggerReaction('happy', '♥');
      showToast(language === 'id' ? 'Sembuh total!' : 'Fully cured!');
    } else {
      soundEngine.playCue('select');
      triggerReaction('sick', '+1');
      showToast(language === 'id' ? 'Dosis 1 diberikan, beri 1 lagi!' : 'Dose 1 given, give 1 more!');
    }
  }, [commitPet, language, pet, showToast, triggerReaction]);

  const handleClean = useCallback(() => {
    const res = performCleanPoop(pet);
    if (!res.cleaned) {
      soundEngine.playCue('click');
      showToast(language === 'id' ? 'Ruangan sudah bersih' : 'Room is already clean');
      return;
    }
    soundEngine.playCue('select');
    setCleaningWipe(true);
    setTimeout(() => setCleaningWipe(false), 550);
    commitPet(res.state);
    triggerReaction('happy', '★');
    showToast(language === 'id' ? 'Layar bersih mengkilap!' : 'Spotless clean!');
  }, [commitPet, language, pet, showToast, triggerReaction]);

  const handleDiscipline = useCallback(() => {
    const res = performDiscipline(pet);
    commitPet(res.state);
    if (res.wasMisbehaving) {
      soundEngine.playCue('notify');
      triggerReaction('angry', '+DSP');
      showToast(language === 'id' ? 'Disiplin naik! Tidak rewel lagi.' : 'Discipline up!');
    } else {
      soundEngine.playCue('error');
      triggerReaction('refuse', ':<');
      showToast(language === 'id' ? 'Tidak sedang nakal! Senang turun.' : 'Not misbehaving! Happy down.');
    }
  }, [commitPet, language, pet, showToast, triggerReaction]);

  const handleAlertCheck = useCallback(() => {
    soundEngine.playCue('click');
    const msg = getAttentionMessage(pet.attentionReason, pet.name, language);
    showToast(msg);
    if (pet.attentionReason) {
      pushNotification('Tamagotchi', msg, 'tamagotchi');
    }
  }, [language, pet.attentionReason, pet.name, pushNotification, showToast]);

  const triggerSelectedCare = useCallback(
    (actionId: CareActionId) => {
      if (pet.stage === 'egg' && actionId !== 'stats') {
        soundEngine.playCue('click');
        showToast(language === 'id' ? 'Menunggu telur menetas...' : 'Waiting for egg to hatch...');
        return;
      }
      if (pet.stage === 'angel' && actionId !== 'stats') {
        soundEngine.playCue('click');
        setSubView('stats');
        return;
      }

      switch (actionId) {
        case 'meal':
          soundEngine.playCue('open');
          setSubView('feed');
          break;
        case 'lights':
          handleToggleLights();
          break;
        case 'play':
          if (pet.isSleeping || pet.isSick) {
            soundEngine.playCue('error');
            triggerReaction('refuse', '×');
            showToast(
              pet.isSleeping
                ? language === 'id'
                  ? 'Sedang tidur!'
                  : 'Sleeping!'
                : language === 'id'
                  ? 'Sakit! Beri obat dulu.'
                  : 'Sick! Medicine first.'
            );
            return;
          }
          soundEngine.playCue('open');
          setSubView('play-menu');
          break;
        case 'medicine':
          handleMedicine();
          break;
        case 'clean':
          handleClean();
          break;
        case 'stats':
          soundEngine.playCue('open');
          setSubView('stats');
          break;
        case 'discipline':
          handleDiscipline();
          break;
        case 'alert':
          handleAlertCheck();
          break;
      }
    },
    [
      handleAlertCheck,
      handleClean,
      handleDiscipline,
      handleMedicine,
      handleToggleLights,
      language,
      pet.isSick,
      pet.isSleeping,
      pet.stage,
      showToast,
      triggerReaction,
    ]
  );

  // Mini-game 1 handlers
  const startDirectionGame = () => {
    soundEngine.playCue('open');
    setDirRound(1);
    setDirWins(0);
    setDirPetFace(null);
    setDirResultText('');
    setDirDone(false);
    setSubView('game-direction');
  };

  const guessDirection = useCallback(
    (guess: 'left' | 'right') => {
      if (dirDone || dirPetFace !== null) return;
      const actual: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
      const correct = guess === actual;
      setDirPetFace(actual);
      if (correct) {
        soundEngine.playCue('select');
      } else {
        soundEngine.playCue('error');
      }
      const nextWins = dirWins + (correct ? 1 : 0);
      setDirWins(nextWins);
      setDirResultText(
        correct
          ? language === 'id'
            ? 'TEPAT! +1'
            : 'RIGHT! +1'
          : language === 'id'
            ? 'MELESET!'
            : 'MISS!'
      );

      setTimeout(() => {
        if (dirRound >= 5) {
          setDirDone(true);
          const won = nextWins >= 3;
          soundEngine.playCue(won ? 'notify' : 'open');
          const pts = nextWins * 10;
          void persistTamagotchiScore(pts);
          const updated = applyMiniGameReward(pet, won);
          commitPet(updated);
        } else {
          setDirRound((r) => r + 1);
          setDirPetFace(null);
          setDirResultText('');
        }
      }, 650);
    },
    [commitPet, dirDone, dirPetFace, dirRound, dirWins, language, pet]
  );

  // Mini-game 2 starter
  const startCatchGame = () => {
    soundEngine.playCue('open');
    setCatchCol(2);
    setCatchScore(0);
    setCatchTimeLeft(18);
    setCatchDrops([]);
    setCatchDone(false);
    setCatchRunning(true);
    setSubView('game-catch');
  };

  const toggleSpeed = useCallback(() => {
    soundEngine.playCue('click');
    const nextSpeed: 1 | 4 | 16 = pet.speedMultiplier === 1 ? 4 : pet.speedMultiplier === 4 ? 16 : 1;
    commitPet({ ...pet, speedMultiplier: nextSpeed });
    showToast(`Fast-Forward: ${nextSpeed}x`);
  }, [commitPet, pet, showToast]);

  const fastForwardHours = useCallback(
    (hours: number) => {
      soundEngine.playCue('notify');
      const res = advanceTamagotchiState(pet, Date.now(), hours * 3600);
      commitPet(res.state);
      const stageText = getStageLabel(res.state.stage, res.state.evolutionId, language);
      showToast(
        language === 'id'
          ? `Waktu +${hours} jam · Fase: ${stageText}`
          : `+${hours}h skipped · Stage: ${stageText}`
      );
    },
    [commitPet, language, pet, showToast]
  );

  const instantHatchEgg = () => {
    if (pet.stage !== 'egg') return;
    soundEngine.playCue('notify');
    const res = advanceTamagotchiState({ ...pet, name: renameInput.trim() || 'Piko' }, Date.now(), 25);
    commitPet(res.state);
    showToast(language === 'id' ? `${res.state.name} menetas!` : `${res.state.name} hatched!`);
  };

  const resetNewEgg = () => {
    soundEngine.playCue('notify');
    const fresh = buildResetEggState(pet, renameInput);
    commitPet(fresh);
    setSubView('main');
    showToast(language === 'id' ? 'Telur baru siap menetas!' : 'New egg ready!');
  };

  // Keyboard / D-Pad support
  useEffect(() => {
    return subscribeKey((cmd) => {
      if (subView === 'main') {
        if (cmd === 'LEFT') {
          soundEngine.playCue('click');
          setSelectedIcon((i) => (i - 1 + 8) % 8);
          return true;
        }
        if (cmd === 'RIGHT') {
          soundEngine.playCue('click');
          setSelectedIcon((i) => (i + 1) % 8);
          return true;
        }
        if (cmd === 'UP' || cmd === 'DOWN') {
          soundEngine.playCue('click');
          setSelectedIcon((i) => (i + 4) % 8);
          return true;
        }
        if (cmd === 'OK') {
          triggerSelectedCare(CARE_ACTIONS[selectedIcon].id);
          return true;
        }
      } else if (subView === 'game-direction') {
        if (cmd === 'LEFT') {
          guessDirection('left');
          return true;
        }
        if (cmd === 'RIGHT') {
          guessDirection('right');
          return true;
        }
      } else if (subView === 'game-catch' && catchRunning && !catchDone) {
        if (cmd === 'LEFT') {
          soundEngine.playCue('click');
          setCatchCol((c) => Math.max(0, c - 1));
          return true;
        }
        if (cmd === 'RIGHT') {
          soundEngine.playCue('click');
          setCatchCol((c) => Math.min(4, c + 1));
          return true;
        }
      }
      return false;
    });
  }, [catchDone, catchRunning, guessDirection, selectedIcon, subView, subscribeKey, triggerSelectedCare]);

  // Softkeys per view
  useEffect(() => {
    if (subView === 'main') {
      setSoftkeys({
        leftLabel: `${pet.speedMultiplier}x`,
        centerLabel: language === 'id' ? CARE_ACTIONS[selectedIcon].labelId : CARE_ACTIONS[selectedIcon].labelEn,
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: toggleSpeed,
        onCenter: () => triggerSelectedCare(CARE_ACTIONS[selectedIcon].id),
        onRight: onBack,
      });
    } else {
      setSoftkeys({
        leftLabel: '',
        centerLabel: 'OK',
        rightLabel: language === 'id' ? 'Tutup' : 'Close',
        onRight: () => {
          setCatchRunning(false);
          setSubView('main');
        },
      });
    }
  }, [language, onBack, pet.speedMultiplier, selectedIcon, setSoftkeys, subView, toggleSpeed, triggerSelectedCare]);

  // Computed visual mood
  const activeMood: SpriteMood =
    tempMood ??
    (pet.isSick
      ? 'sick'
      : pet.isSleeping
        ? 'sleeping'
        : pet.attentionReason === 'misbehave'
          ? 'angry'
          : pet.happiness >= 4
            ? 'happy'
            : 'idle');

  const stageLabel = getStageLabel(pet.stage, pet.evolutionId, language);
  const ageHours = Math.floor(pet.ageMinutes / 60);
  const ageMins = Math.floor(pet.ageMinutes % 60);

  const renderMeterRow = (label: string, value: number, max = 4) => (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-bold w-24 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 border-2 border-[var(--lcd-fg)] ${
              i < value ? 'bg-[var(--lcd-fg)]' : 'bg-[var(--lcd-bg)]'
            }`}
          />
        ))}
      </div>
      <span className="w-8 text-right font-bold tabular-nums shrink-0">
        {value}/{max}
      </span>
    </div>
  );

  const formatAttentionTag = (reason: TamagotchiAttentionReason) => {
    if (!reason) return null;
    const map: Record<Exclude<TamagotchiAttentionReason, null>, string> = {
      sick: 'SAKIT',
      lights: 'LAMPU',
      hungry: 'LAPAR',
      poop: 'KOTOR',
      sad: 'BOSAN',
      misbehave: 'NAKAL',
    };
    return map[reason];
  };

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={`Tamagotchi · ${pet.name}`} showChevrons={false} />

      {/* SUBVIEW: MAIN 8-ICON CLASSIC VIEW */}
      {subView === 'main' && (
        <div className="flex-1 flex flex-col p-1.5 justify-between gap-1.5 min-h-0">
          {/* HUD Info Strip (Zero-pill unboxed metadata + single speed button) */}
          <div className="flex items-center justify-between px-1.5 py-0.5 border-b-2 border-[var(--lcd-fg)] text-[10px] shrink-0">
            <div className="truncate font-bold tabular-nums">
              <span>Gen {pet.generation}</span>
              <span className="mx-1">·</span>
              <span>{stageLabel}</span>
              <span className="mx-1">·</span>
              <span>{ageHours}j{ageMins}m</span>
              <span className="mx-1">·</span>
              <span>{pet.weightGr}gr</span>
            </div>
            <button
              type="button"
              onClick={toggleSpeed}
              className="px-1.5 py-0.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] font-bold text-[10px] cursor-pointer shrink-0 tabular-nums"
              title={language === 'id' ? 'Ubah kecepatan Fast-Forward' : 'Toggle Fast-Forward'}
            >
              {pet.speedMultiplier}x
            </button>
          </div>

          {/* TOP 4 CARE ICONS */}
          <div className="grid grid-cols-4 gap-1 shrink-0">
            {CARE_ACTIONS.slice(0, 4).map((act, idx) => {
              const active = selectedIcon === idx;
              const label = language === 'id' ? act.labelId : act.labelEn;
              const indicator = act.id === 'lights' && !pet.lightsOn ? 'OFF' : null;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setSelectedIcon(idx);
                    triggerSelectedCare(act.id);
                  }}
                  className={`flex flex-col items-center justify-center py-1 border-2 border-[var(--lcd-fg)] cursor-pointer min-w-0 ${
                    active
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'bg-[var(--lcd-sec)] text-[var(--lcd-fg)] hover:bg-[var(--lcd-bg)]'
                  }`}
                >
                  <TamagotchiIconMini kind={act.id as 'meal' | 'lights' | 'play' | 'medicine'} />
                  <span className="text-[9px] font-bold leading-none mt-0.5 truncate">
                    {indicator ?? label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* CENTRAL PIXEL LCD ROOM */}
          <div
            className={`relative flex-1 min-h-0 border-2 border-[var(--lcd-fg)] flex flex-col justify-between overflow-hidden p-2 ${
              !pet.lightsOn
                ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                : 'bg-[var(--lcd-bg)] text-[var(--lcd-fg)]'
            }`}
          >
            {/* Top Room Indicators (Night Stars / Sickness / Sleep / Reaction) */}
            <div className="flex items-start justify-between text-[10px] font-bold shrink-0">
              <div>
                {!pet.lightsOn ? '☾ * . *' : pet.isSleeping ? 'Zzz...' : ''}
                {pet.attentionReason && (
                  <span className="ml-1">[{formatAttentionTag(pet.attentionReason)}]</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {reactionBubble && (
                  <span className="px-1 border border-current font-bold">{reactionBubble}</span>
                )}
                {pet.isSick && <span className="px-1 bg-current text-[var(--lcd-bg)]">☠ SAKIT</span>}
              </div>
            </div>

            {/* Pet Sprite / Egg / Angel Stage */}
            <div className="flex-1 flex items-center justify-center relative min-h-0">
              {cleaningWipe ? (
                <div className="text-xs font-bold animate-pulse">
                  {language === 'id' ? '~~~ MENYAPU LAYAR ~~~' : '~~~ CLEANING FLOOR ~~~'}
                </div>
              ) : (
                <div
                  className="transition-transform duration-300 flex items-center justify-center"
                  style={{ transform: `translateX(${petOffsetX}px)` }}
                >
                  <TamagotchiPetSprite
                    stage={pet.stage}
                    evolutionId={pet.evolutionId}
                    mood={activeMood}
                    frame={animFrame}
                    facing={petFacing}
                    size={88}
                  />
                </div>
              )}

              {/* Poop piles along right floor */}
              {pet.poopCount > 0 && (
                <div className="absolute bottom-0 right-1 flex items-end gap-0.5">
                  {Array.from({ length: pet.poopCount }).map((_, pIdx) => (
                    <TamagotchiPoopSprite key={pIdx} frame={animFrame} />
                  ))}
                </div>
              )}
            </div>

            {/* Egg / Angel / Quick Status Floor Strip */}
            {pet.stage === 'egg' ? (
              <div className="border-t border-current pt-1.5 flex items-center justify-between gap-1.5 shrink-0">
                <input
                  type="text"
                  maxLength={10}
                  value={renameInput}
                  onChange={(e) => {
                    setRenameInput(e.target.value);
                    commitPet({ ...pet, name: e.target.value || 'Piko' });
                  }}
                  placeholder="Nama Pet"
                  className="w-24 bg-transparent border border-current px-1.5 py-0.5 text-[10px] font-bold outline-none"
                />
                <span className="text-[10px] tabular-nums">
                  {Math.max(0, Math.ceil(20 - pet.eggProgressSec))}s
                </span>
                <button
                  type="button"
                  onClick={instantHatchEgg}
                  className="px-2 py-0.5 border border-current bg-current text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                >
                  <span className={!pet.lightsOn ? 'text-[var(--lcd-fg)]' : 'text-[var(--lcd-bg)]'}>
                    {language === 'id' ? 'TETASKAN' : 'HATCH'}
                  </span>
                </button>
              </div>
            ) : pet.stage === 'angel' ? (
              <div className="border-t border-current pt-1.5 flex items-center justify-between gap-2 shrink-0">
                <span className="text-[10px] font-bold truncate">
                  {language === 'id' ? 'Telah berpulang dengan damai.' : 'Rested peacefully.'}
                </span>
                <button
                  type="button"
                  onClick={resetNewEgg}
                  className="px-2 py-0.5 border border-current text-[10px] font-bold cursor-pointer shrink-0"
                >
                  {language === 'id' ? 'TELUR BARU' : 'NEW EGG'}
                </button>
              </div>
            ) : (
              <div className="border-t border-current pt-1 flex items-center justify-between text-[10px] tabular-nums shrink-0">
                <span>LPR:{pet.hunger}/4</span>
                <span>SNG:{pet.happiness}/4</span>
                <span>DSP:{pet.discipline}/4</span>
                <span>ENR:{Math.round(pet.energy)}%</span>
              </div>
            )}
          </div>

          {/* BOTTOM 4 CARE ICONS */}
          <div className="grid grid-cols-4 gap-1 shrink-0">
            {CARE_ACTIONS.slice(4, 8).map((act, offset) => {
              const idx = offset + 4;
              const active = selectedIcon === idx;
              const isAlertLit = act.id === 'alert' && pet.attentionReason !== null;
              const label = language === 'id' ? act.labelId : act.labelEn;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setSelectedIcon(idx);
                    triggerSelectedCare(act.id);
                  }}
                  className={`flex flex-col items-center justify-center py-1 border-2 border-[var(--lcd-fg)] cursor-pointer min-w-0 ${
                    active || isAlertLit
                      ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                      : 'bg-[var(--lcd-sec)] text-[var(--lcd-fg)] hover:bg-[var(--lcd-bg)]'
                  }`}
                >
                  <TamagotchiIconMini kind={act.id as 'clean' | 'stats' | 'discipline' | 'alert'} />
                  <span className="text-[9px] font-bold leading-none mt-0.5 truncate">
                    {isAlertLit ? 'PANGGIL!' : label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBVIEW: FEED MENU */}
      {subView === 'feed' && (
        <div className="flex-1 flex flex-col p-3 justify-between gap-2">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 text-center">
            <div className="text-sm font-bold">
              {language === 'id' ? 'PILIH MENU MAKANAN' : 'CHOOSE FOOD'}
            </div>
            <div className="text-xs opacity-85 mt-1 tabular-nums">
              {language === 'id' ? 'Lapar' : 'Hunger'}: {pet.hunger}/4 ·{' '}
              {language === 'id' ? 'Senang' : 'Happy'}: {pet.happiness}/4 · {pet.weightGr}gr
            </div>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-center">
            <button
              type="button"
              onClick={handleFeedMeal}
              className="w-full p-3 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-left cursor-pointer"
            >
              <div className="text-sm font-bold">
                1. {language === 'id' ? 'Makanan Pokok (Nasi)' : 'Meal (Rice Bowl)'}
              </div>
              <div className="text-[11px] opacity-85 mt-0.5">
                {language === 'id'
                  ? 'Mengisi +1 Lapar, Berat +1gr. Ditolak bila kenyang.'
                  : 'Restores +1 Hunger, +1gr Weight. Refuses if full.'}
              </div>
            </button>

            <button
              type="button"
              onClick={handleFeedSnack}
              className="w-full p-3 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-left cursor-pointer"
            >
              <div className="text-sm font-bold">
                2. {language === 'id' ? 'Camilan Manis (Permen)' : 'Snack (Sweet Candy)'}
              </div>
              <div className="text-[11px] opacity-85 mt-0.5">
                {language === 'id'
                  ? 'Menambah +1 Senang, Berat +2gr. Terlalu sering bikin sakit!'
                  : 'Boosts +1 Happy, +2gr Weight. Too much causes toothache!'}
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSubView('main')}
            className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
          >
            {language === 'id' ? 'KEMBALI' : 'BACK'}
          </button>
        </div>
      )}

      {/* SUBVIEW: MINI-GAME SELECTOR */}
      {subView === 'play-menu' && (
        <div className="flex-1 flex flex-col p-3 justify-between gap-2">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 text-center">
            <div className="text-sm font-bold">
              {language === 'id' ? '2 MINI-GAME KLASIK' : '2 CLASSIC MINI-GAMES'}
            </div>
            <div className="text-[11px] mt-1">
              {language === 'id'
                ? 'Bermain menambah Kebahagiaan & menjaga berat ideal!'
                : 'Playing increases Happiness & burns extra weight!'}
            </div>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-center">
            <button
              type="button"
              onClick={startDirectionGame}
              className="w-full p-3 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-left cursor-pointer"
            >
              <div className="text-sm font-bold">
                1. {language === 'id' ? 'Tebak Arah (Klasik P1)' : 'Left or Right (Classic)'}
              </div>
              <div className="text-[11px] opacity-85 mt-0.5">
                {language === 'id'
                  ? '5 ronde menebak pet menoleh kiri atau kanan.'
                  : '5 rounds guessing which side your pet faces.'}
              </div>
            </button>

            <button
              type="button"
              onClick={startCatchGame}
              className="w-full p-3 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-left cursor-pointer"
            >
              <div className="text-sm font-bold">
                2. {language === 'id' ? 'Tangkap Bintang (Arkade)' : 'Star Catcher (Arcade)'}
              </div>
              <div className="text-[11px] opacity-85 mt-0.5">
                {language === 'id'
                  ? 'Gerakkan pet untuk tangkap ★ bintang & hindari batu!'
                  : 'Move pet to catch falling ★ stars & dodge rocks!'}
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSubView('main')}
            className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
          >
            {language === 'id' ? 'KEMBALI' : 'BACK'}
          </button>
        </div>
      )}

      {/* SUBVIEW: MINI-GAME 1 (TEBAK ARAH) */}
      {subView === 'game-direction' && (
        <div className="flex-1 flex flex-col p-2.5 justify-between gap-2">
          <div className="flex justify-between text-xs font-bold border-b-2 border-[var(--lcd-fg)] pb-1 tabular-nums">
            <span>{language === 'id' ? `Ronde ${dirRound}/5` : `Round ${dirRound}/5`}</span>
            <span>{language === 'id' ? `Menang: ${dirWins}` : `Wins: ${dirWins}`}</span>
          </div>

          <div className="flex-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] flex flex-col items-center justify-center p-2 gap-2">
            <TamagotchiPetSprite
              stage={pet.stage}
              evolutionId={pet.evolutionId}
              mood={dirDone ? (dirWins >= 3 ? 'happy' : 'idle') : 'idle'}
              frame={animFrame}
              facing={dirPetFace ?? 'right'}
              size={84}
            />
            <div className="text-xs font-bold text-center">
              {dirDone
                ? dirWins >= 3
                  ? language === 'id'
                    ? `MENANG (${dirWins}/5)! +2 Senang`
                    : `WON (${dirWins}/5)! +2 Happy`
                  : language === 'id'
                    ? `SELESAI (${dirWins}/5). +1 Senang`
                    : `DONE (${dirWins}/5). +1 Happy`
                : dirResultText || (language === 'id' ? 'Pet akan menoleh ke mana?' : 'Which way will pet look?')}
            </div>
          </div>

          {dirDone ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={startDirectionGame}
                className="py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'MAIN LAGI' : 'PLAY AGAIN'}
              </button>
              <button
                type="button"
                onClick={() => setSubView('main')}
                className="py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'SELESAI' : 'EXIT'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => guessDirection('left')}
                className="py-2.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                ◀ {language === 'id' ? 'KIRI' : 'LEFT'}
              </button>
              <button
                type="button"
                onClick={() => guessDirection('right')}
                className="py-2.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'KANAN' : 'RIGHT'} ▶
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW: MINI-GAME 2 (TANGKAP BINTANG) */}
      {subView === 'game-catch' && (
        <div className="flex-1 flex flex-col p-2 justify-between gap-1.5 min-h-0">
          <div className="flex justify-between text-xs font-bold border-b-2 border-[var(--lcd-fg)] pb-1 tabular-nums shrink-0">
            <span>Skor: {catchScore}</span>
            <span>{catchTimeLeft}s</span>
          </div>

          {/* 5x5 Catch Arena */}
          <div className="flex-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] grid grid-cols-5 grid-rows-5 p-1 gap-0.5 min-h-0">
            {Array.from({ length: 25 }).map((_, cellIdx) => {
              const r = Math.floor(cellIdx / 5);
              const c = cellIdx % 5;
              const drop = catchDrops.find((d) => d.row === r && d.col === c);
              const isPlayer = r === 4 && c === catchCol;

              return (
                <div
                  key={cellIdx}
                  className={`flex items-center justify-center text-sm font-bold border border-[var(--lcd-fg)]/15 ${
                    isPlayer ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
                  }`}
                >
                  {isPlayer ? '☺' : drop ? (drop.kind === 'star' ? '★' : '■') : ''}
                </div>
              );
            })}
          </div>

          {catchDone ? (
            <div className="space-y-1.5 shrink-0">
              <div className="text-center text-xs font-bold">
                {catchScore >= 30
                  ? language === 'id'
                    ? `HEBAT! Skor ${catchScore} (+2 Senang)`
                    : `GREAT! Score ${catchScore} (+2 Happy)`
                  : language === 'id'
                    ? `Skor ${catchScore} (+1 Senang)`
                    : `Score ${catchScore} (+1 Happy)`}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startCatchGame}
                  className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
                >
                  {language === 'id' ? 'ULANG' : 'RETRY'}
                </button>
                <button
                  type="button"
                  onClick={() => setSubView('main')}
                  className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
                >
                  {language === 'id' ? 'KELUAR' : 'EXIT'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  setCatchCol((c) => Math.max(0, c - 1));
                }}
                className="py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                ◀ {language === 'id' ? 'GESER KIRI' : 'MOVE LEFT'}
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  setCatchCol((c) => Math.min(4, c + 1));
                }}
                className="py-2 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                {language === 'id' ? 'GESER KANAN' : 'MOVE RIGHT'} ▶
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW: STATS, FAST-FORWARD, 4 EVOLUTIONS & HISTORY */}
      {subView === 'stats' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-3 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold shrink-0">
            {[
              { id: 'meter', label: language === 'id' ? 'Status' : 'Meters' },
              { id: 'evo', label: language === 'id' ? '4 Evolusi' : '4 Forms' },
              { id: 'history', label: language === 'id' ? 'Riwayat' : 'History' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatsTab(t.id as 'meter' | 'evo' | 'history')}
                className={`py-1.5 border-r last:border-r-0 border-[var(--lcd-fg)] cursor-pointer ${
                  statsTab === t.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : ''
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2.5">
            {statsTab === 'meter' && (
              <>
                <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 space-y-1.5">
                  {renderMeterRow(language === 'id' ? 'Lapar' : 'Hunger', pet.hunger)}
                  {renderMeterRow(language === 'id' ? 'Senang' : 'Happy', pet.happiness)}
                  {renderMeterRow(language === 'id' ? 'Disiplin' : 'Discipline', pet.discipline)}
                  {renderMeterRow(language === 'id' ? 'Kebersihan' : 'Hygiene', pet.hygiene)}
                </div>

                <div className="border-2 border-[var(--lcd-fg)] p-2 text-xs space-y-1 tabular-nums">
                  <div className="flex justify-between">
                    <span>{language === 'id' ? 'Umur / Fase' : 'Age / Stage'}</span>
                    <span className="font-bold">
                      {ageHours}j {ageMins}m · {stageLabel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === 'id' ? 'Berat / Energi' : 'Weight / Energy'}</span>
                    <span className="font-bold">
                      {pet.weightGr}gr · {Math.round(pet.energy)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === 'id' ? 'Kesalahan Rawat' : 'Care Mistakes'}</span>
                    <span className="font-bold">{pet.careMistakes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === 'id' ? 'Main / Camilan' : 'Games / Snacks'}</span>
                    <span className="font-bold">
                      {pet.gamesPlayed}x / {pet.snacksEaten}x
                    </span>
                  </div>
                </div>

                {/* Fast-Forward & Egg Controls */}
                <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 space-y-1.5">
                  <div className="text-[10px] font-bold">
                    {language === 'id' ? 'KONTROL WAKTU & FAST-FORWARD' : 'TIME & FAST-FORWARD'}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {([1, 4, 16] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => {
                          soundEngine.playCue('click');
                          commitPet({ ...pet, speedMultiplier: spd });
                        }}
                        className={`py-1 border-2 border-[var(--lcd-fg)] text-[10px] font-bold cursor-pointer ${
                          pet.speedMultiplier === spd
                            ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                            : 'bg-[var(--lcd-bg)]'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => fastForwardHours(1)}
                      className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                    >
                      ⏩ +1 JAM
                    </button>
                    <button
                      type="button"
                      onClick={resetNewEgg}
                      className="py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
                    >
                      {language === 'id' ? 'TELUR BARU' : 'NEW EGG'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {statsTab === 'evo' && (
              <div className="space-y-2">
                {EVOLUTION_CATALOG.map((evo) => {
                  const unlocked = pet.unlockedEvolutions.includes(evo.id) || pet.evolutionId === evo.id;
                  return (
                    <div
                      key={evo.id}
                      className={`border-2 border-[var(--lcd-fg)] p-2 flex items-center gap-2.5 ${
                        pet.evolutionId === evo.id ? 'bg-[var(--lcd-sec)]' : 'bg-[var(--lcd-bg)]'
                      }`}
                    >
                      <div className="border border-[var(--lcd-fg)] p-1 bg-[var(--lcd-bg)] shrink-0">
                        <TamagotchiPetSprite
                          stage="adult"
                          evolutionId={evo.id}
                          mood="idle"
                          frame={0}
                          size={44}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 text-xs font-bold">
                          <span className="truncate">{language === 'id' ? evo.nameId : evo.nameEn}</span>
                          <span className="shrink-0">{unlocked ? '✓' : 'LOCK'}</span>
                        </div>
                        <div className="text-[10px] opacity-85 leading-snug mt-0.5">
                          {language === 'id' ? evo.descId : evo.descEn}
                        </div>
                        <div className="text-[9px] font-bold mt-0.5 opacity-90">
                          {language === 'id' ? evo.reqId : evo.reqEn}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {statsTab === 'history' && (
              <div className="space-y-1.5">
                {pet.history.length === 0 ? (
                  <div className="p-4 text-center text-xs">
                    {language === 'id'
                      ? 'Belum ada riwayat generasi terdahulu.'
                      : 'No previous generation records yet.'}
                  </div>
                ) : (
                  pet.history.map((entry) => (
                    <div
                      key={`${entry.generation}-${entry.endedAt}`}
                      className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 text-xs"
                    >
                      <div className="flex justify-between font-bold">
                        <span>
                          Gen {entry.generation} · {entry.name}
                        </span>
                        <span className="tabular-nums">{entry.ageHours}j</span>
                      </div>
                      <div className="text-[10px] opacity-85 mt-0.5">
                        {entry.evolutionId
                          ? getStageLabel('adult', entry.evolutionId, language)
                          : entry.outcome.toUpperCase()}{' '}
                        · {language === 'id' ? 'Salah' : 'Mistakes'}: {entry.careMistakes}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="p-2 border-t-2 border-[var(--lcd-fg)] shrink-0">
            <button
              type="button"
              onClick={() => setSubView('main')}
              className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
            >
              {language === 'id' ? 'KEMBALI KE LAYAR PET' : 'BACK TO PET'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
