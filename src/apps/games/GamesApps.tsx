'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PixelIcon } from '@/src/components/PixelIcons';
import { PixelWallpaperArt, WALLPAPERS } from '@/src/components/PixelWallpapers';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import { getStageLabel, loadTamagotchiState } from '@/src/services/tamagotchiEngine';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord } from '@/src/types/os';

// --- GAMES HUB ---
export const GamesHubApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const openApp = useOSStore((s) => s.openApp);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  const [bestSnake, setBestSnake] = useState(0);
  const [bestTetris, setBestTetris] = useState(0);
  const [bestPuzzle, setBestPuzzle] = useState<number | null>(null);
  const [bestTamagotchi, setBestTamagotchi] = useState(0);
  const [petSummary, setPetSummary] = useState(() => {
    const p = loadTamagotchiState();
    return { name: p.name, stage: getStageLabel(p.stage, p.evolutionId, language) };
  });

  useEffect(() => {
    db.scores
      .where('gameId')
      .equals('snake')
      .toArray()
      .then((rows) => setBestSnake(Math.max(0, ...rows.map((r) => r.score))));
    db.scores
      .where('gameId')
      .equals('tetris')
      .toArray()
      .then((rows) => setBestTetris(Math.max(0, ...rows.map((r) => r.score))));
    db.scores
      .where('gameId')
      .equals('puzzle')
      .toArray()
      .then((rows) => {
        if (rows.length) setBestPuzzle(Math.min(...rows.map((r) => r.score)));
      });
    db.scores
      .where('gameId')
      .equals('tamagotchi')
      .toArray()
      .then((rows) => setBestTamagotchi(Math.max(0, ...rows.map((r) => r.score))));
    const p = loadTamagotchiState();
    Promise.resolve().then(() =>
      setPetSummary({ name: p.name, stage: getStageLabel(p.stage, p.evolutionId, language) })
    );

    setSoftkeys({
      leftLabel: '',
      centerLabel: 'Snake',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: () => openApp('snake'),
      onRight: onBack,
    });
  }, [language, onBack, openApp, setSoftkeys]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={language === 'id' ? 'Pusat Game' : 'Games Hub'} showChevrons={false} />
      <div className="flex-1 overflow-y-auto lcd-scroll p-2.5 space-y-2">
        <button
          type="button"
          onClick={() => openApp('tamagotchi')}
          className="w-full flex items-center justify-between border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <PixelIcon name="tamagotchi" size={32} />
            <div className="text-left min-w-0">
              <div className="text-sm sm:text-base font-bold leading-none">Tamagotchi</div>
              <div className="text-[11px] mt-1 truncate">
                {petSummary.name} · {petSummary.stage} · Best: {bestTamagotchi}
              </div>
            </div>
          </div>
          <span className="text-xs font-bold shrink-0">PLAY ▶</span>
        </button>

        <button
          type="button"
          onClick={() => openApp('snake')}
          className="w-full flex items-center justify-between border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <PixelIcon name="snake" size={32} />
            <div className="text-left min-w-0">
              <div className="text-sm sm:text-base font-bold leading-none">Snake Classic</div>
              <div className="text-[11px] mt-1">Best: {bestSnake}</div>
            </div>
          </div>
          <span className="text-xs font-bold shrink-0">PLAY ▶</span>
        </button>

        <button
          type="button"
          onClick={() => openApp('tetris')}
          className="w-full flex items-center justify-between border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <PixelIcon name="tetris" size={32} />
            <div className="text-left min-w-0">
              <div className="text-sm sm:text-base font-bold leading-none">Pixel Tetris</div>
              <div className="text-[11px] mt-1">Best: {bestTetris}</div>
            </div>
          </div>
          <span className="text-xs font-bold shrink-0">PLAY ▶</span>
        </button>

        <button
          type="button"
          onClick={() => openApp('puzzle')}
          className="w-full flex items-center justify-between border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2.5 hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <PixelIcon name="puzzle" size={32} />
            <div className="text-left min-w-0">
              <div className="text-sm sm:text-base font-bold leading-none">15-Tile Puzzle</div>
              <div className="text-[11px] mt-1">
                {bestPuzzle !== null
                  ? `Best: ${bestPuzzle} ${language === 'id' ? 'langkah' : 'moves'}`
                  : language === 'id'
                    ? 'Susun angka 1-15'
                    : 'Sort tiles 1-15'}
              </div>
            </div>
          </div>
          <span className="text-xs font-bold shrink-0">PLAY ▶</span>
        </button>
      </div>
    </div>
  );
};

// --- SNAKE GAME ---
const SNAKE_GRID = 14;
type Pt = { x: number; y: number };

export const SnakeGameApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const subscribeKey = useOSStore((s) => s.subscribeKey);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  const [snake, setSnake] = useState<Pt[]>([
    { x: 6, y: 7 },
    { x: 5, y: 7 },
    { x: 4, y: 7 },
  ]);
  const [dir, setDir] = useState<Pt>({ x: 1, y: 0 });
  const [food, setFood] = useState<Pt>({ x: 10, y: 7 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    db.scores
      .where('gameId')
      .equals('snake')
      .toArray()
      .then((rows) => setHighScore(Math.max(0, ...rows.map((r) => r.score))));
  }, []);

  const resetGame = useCallback(() => {
    soundEngine.playCue('open');
    setSnake([
      { x: 6, y: 7 },
      { x: 5, y: 7 },
      { x: 4, y: 7 },
    ]);
    setDir({ x: 1, y: 0 });
    setFood({ x: 10, y: 7 });
    setScore(0);
    setGameOver(false);
    setPaused(false);
  }, []);

  const changeDir = useCallback((nx: number, ny: number) => {
    setDir((cur) => {
      if (cur.x === -nx && cur.y === -ny) return cur;
      return { x: nx, y: ny };
    });
  }, []);

  useEffect(() => {
    return subscribeKey((cmd) => {
      if (cmd === 'UP') {
        changeDir(0, -1);
        return true;
      }
      if (cmd === 'DOWN') {
        changeDir(0, 1);
        return true;
      }
      if (cmd === 'LEFT') {
        changeDir(-1, 0);
        return true;
      }
      if (cmd === 'RIGHT') {
        changeDir(1, 0);
        return true;
      }
      if (cmd === 'OK') {
        if (gameOver) resetGame();
        else setPaused((p) => !p);
        return true;
      }
      return false;
    });
  }, [gameOver, changeDir, resetGame]);

  useEffect(() => {
    setSoftkeys({
      leftLabel: paused ? (language === 'id' ? 'Lanjut' : 'Resume') : language === 'id' ? 'Jeda' : 'Pause',
      centerLabel: gameOver ? 'Restart' : 'OK',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => setPaused((p) => !p),
      onCenter: () => (gameOver ? resetGame() : setPaused((p) => !p)),
      onRight: onBack,
    });
  }, [paused, gameOver, language]);

  useEffect(() => {
    if (gameOver || paused) return;
    const speed = Math.max(95, 195 - Math.floor(score / 30) * 12);
    const id = setInterval(() => {
      setSnake((prev) => {
        const head = { x: prev[0].x + dir.x, y: prev[0].y + dir.y };
        const hitWall = head.x < 0 || head.x >= SNAKE_GRID || head.y < 0 || head.y >= SNAKE_GRID;
        const hitSelf = prev.some((p) => p.x === head.x && p.y === head.y);

        if (hitWall || hitSelf) {
          soundEngine.playCue('error');
          setGameOver(true);
          if (score > 0) {
            db.scores.add({ gameId: 'snake', score, level: 1, achievedAt: Date.now() });
            setHighScore((hs) => Math.max(hs, score));
          }
          return prev;
        }

        const next = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          soundEngine.playCue('select');
          setScore((s) => s + 10);
          let fx = Math.floor(Math.random() * SNAKE_GRID);
          let fy = Math.floor(Math.random() * SNAKE_GRID);
          while (next.some((p) => p.x === fx && p.y === fy)) {
            fx = Math.floor(Math.random() * SNAKE_GRID);
            fy = Math.floor(Math.random() * SNAKE_GRID);
          }
          setFood({ x: fx, y: fy });
        } else {
          next.pop();
        }
        return next;
      });
    }, speed);

    return () => clearInterval(id);
  }, [dir, food, gameOver, paused, score]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={`Snake · ${score}`}
        showChevrons={false}
        rightSlot={<span className="text-xs font-bold tabular-nums">HI:{highScore}</span>}
      />

      <div className="flex-1 flex flex-col items-center justify-between p-2.5">
        <div
          className="relative border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-sec)] grid"
          style={{
            gridTemplateColumns: `repeat(${SNAKE_GRID}, minmax(0, 1fr))`,
            width: 'min(100%, 268px)',
            aspectRatio: '1 / 1',
          }}
        >
          {Array.from({ length: SNAKE_GRID * SNAKE_GRID }).map((_, i) => {
            const x = i % SNAKE_GRID;
            const y = Math.floor(i / SNAKE_GRID);
            const isSnake = snake.some((p) => p.x === x && p.y === y);
            const isFood = food.x === x && food.y === y;
            return (
              <div
                key={i}
                className={
                  isSnake
                    ? 'bg-[var(--lcd-fg)] border border-[var(--lcd-bg)]'
                    : isFood
                      ? 'bg-[var(--lcd-fg)] rounded-none scale-75'
                      : ''
                }
              />
            );
          })}

          {(gameOver || paused) && (
            <div className="absolute inset-0 bg-[var(--lcd-bg)]/90 flex flex-col items-center justify-center p-2 text-center">
              <div className="text-xl font-bold">{gameOver ? 'GAME OVER' : 'PAUSED'}</div>
              <div className="text-sm mt-1">Score: {score}</div>
              <button
                type="button"
                onClick={gameOver ? resetGame : () => setPaused(false)}
                className="mt-2 px-4 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                {gameOver ? 'RESTART' : 'RESUME'}
              </button>
            </div>
          )}
        </div>

        {/* Touch directional strip for quick play */}
        <div className="grid grid-cols-4 gap-1.5 w-full max-w-[268px] mt-1.5">
          <button type="button" onClick={() => changeDir(-1, 0)} className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold cursor-pointer">◀</button>
          <button type="button" onClick={() => changeDir(0, -1)} className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold cursor-pointer">▲</button>
          <button type="button" onClick={() => changeDir(0, 1)} className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold cursor-pointer">▼</button>
          <button type="button" onClick={() => changeDir(1, 0)} className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold cursor-pointer">▶</button>
        </div>
      </div>
    </div>
  );
};

// --- TETRIS GAME ---
const TETRIS_W = 10;
const TETRIS_H = 16;
const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
];

function rotateMatrix(m: number[][]): number[][] {
  return m[0].map((_, c) => m.map((r) => r[c]).reverse());
}

const emptyBoard = () => Array.from({ length: TETRIS_H }, () => Array(TETRIS_W).fill(0));
const randomShape = () => SHAPES[Math.floor(Math.random() * SHAPES.length)];

export const TetrisGameApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const subscribeKey = useOSStore((s) => s.subscribeKey);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  const [board, setBoard] = useState<number[][]>(emptyBoard);
  const [piece, setPiece] = useState<{ shape: number[][]; x: number; y: number }>(() => ({
    shape: randomShape(),
    x: 3,
    y: 0,
  }));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    db.scores
      .where('gameId')
      .equals('tetris')
      .toArray()
      .then((rows) => setHighScore(Math.max(0, ...rows.map((r) => r.score))));
  }, []);

  const collides = useCallback((b: number[][], shape: number[][], px: number, py: number) => {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const nx = px + x;
        const ny = py + y;
        if (nx < 0 || nx >= TETRIS_W || ny >= TETRIS_H) return true;
        if (ny >= 0 && b[ny][nx]) return true;
      }
    }
    return false;
  }, []);

  const stepDown = useCallback(() => {
    if (gameOver) return;
    if (!collides(board, piece.shape, piece.x, piece.y + 1)) {
      setPiece((cur) => ({ ...cur, y: cur.y + 1 }));
      return;
    }

    const nextBoard = board.map((r) => [...r]);
    piece.shape.forEach((row, sy) =>
      row.forEach((val, sx) => {
        if (val && piece.y + sy >= 0 && piece.y + sy < TETRIS_H) {
          nextBoard[piece.y + sy][piece.x + sx] = 1;
        }
      })
    );
    const remaining = nextBoard.filter((row) => row.some((c) => c === 0));
    const cleared = TETRIS_H - remaining.length;
    while (remaining.length < TETRIS_H) {
      remaining.unshift(Array(TETRIS_W).fill(0));
    }
    const nextScore = score + cleared * 100;
    if (cleared > 0) {
      soundEngine.playCue('select');
      setScore(nextScore);
    } else {
      soundEngine.playCue('click');
    }
    setBoard(remaining);

    const nextShape = randomShape();
    if (collides(remaining, nextShape, 3, 0)) {
      soundEngine.playCue('error');
      setGameOver(true);
      if (nextScore > 0) {
        db.scores.add({ gameId: 'tetris', score: nextScore, level: 1, achievedAt: Date.now() });
        setHighScore((hs) => Math.max(hs, nextScore));
      }
      return;
    }
    setPiece({ shape: nextShape, x: 3, y: 0 });
  }, [board, collides, gameOver, piece, score]);

  const moveX = useCallback(
    (dx: number) => {
      if (gameOver) return;
      setPiece((cur) =>
        !collides(board, cur.shape, cur.x + dx, cur.y) ? { ...cur, x: cur.x + dx } : cur
      );
    },
    [board, collides, gameOver]
  );

  const rotate = useCallback(() => {
    if (gameOver) return;
    soundEngine.playCue('click');
    setPiece((cur) => {
      const r = rotateMatrix(cur.shape);
      return !collides(board, r, cur.x, cur.y) ? { ...cur, shape: r } : cur;
    });
  }, [board, collides, gameOver]);

  const restart = () => {
    setBoard(emptyBoard());
    setPiece({ shape: randomShape(), x: 3, y: 0 });
    setScore(0);
    setGameOver(false);
  };

  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(stepDown, 520);
    return () => clearInterval(id);
  }, [stepDown, gameOver]);

  useEffect(() => {
    return subscribeKey((cmd) => {
      if (cmd === 'LEFT') {
        moveX(-1);
        return true;
      }
      if (cmd === 'RIGHT') {
        moveX(1);
        return true;
      }
      if (cmd === 'UP' || cmd === 'OK') {
        if (gameOver) restart();
        else rotate();
        return true;
      }
      if (cmd === 'DOWN') {
        stepDown();
        return true;
      }
      return false;
    });
  }, [moveX, rotate, stepDown, gameOver]);

  useEffect(() => {
    setSoftkeys({
      leftLabel: language === 'id' ? 'Putar' : 'Rotate',
      centerLabel: gameOver ? 'Restart' : language === 'id' ? 'Turun' : 'Drop',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: rotate,
      onCenter: gameOver ? restart : stepDown,
      onRight: onBack,
    });
  }, [gameOver, rotate, stepDown, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={`Tetris · ${score}`}
        showChevrons={false}
        rightSlot={<span className="text-xs font-bold tabular-nums">HI:{highScore}</span>}
      />
      <div className="flex-1 flex flex-col items-center justify-between p-2">
        <div
          className="relative border-[3px] border-[var(--lcd-fg)] bg-[var(--lcd-sec)] grid"
          style={{
            gridTemplateColumns: `repeat(${TETRIS_W}, minmax(0, 1fr))`,
            width: '180px',
            height: '288px',
          }}
        >
          {board.map((row, y) =>
            row.map((cell, x) => {
              const py = y - piece.y;
              const px = x - piece.x;
              const active =
                py >= 0 &&
                py < piece.shape.length &&
                px >= 0 &&
                px < piece.shape[0].length &&
                piece.shape[py][px] === 1;
              return (
                <div
                  key={`${y}-${x}`}
                  className={
                    cell || active
                      ? 'bg-[var(--lcd-fg)] border border-[var(--lcd-bg)]'
                      : 'border border-[var(--lcd-fg)]/10'
                  }
                />
              );
            })
          )}
          {gameOver && (
            <div className="absolute inset-0 bg-[var(--lcd-bg)]/90 flex flex-col items-center justify-center p-2 text-center">
              <div className="text-base font-bold">GAME OVER</div>
              <button
                type="button"
                onClick={restart}
                className="mt-2 px-3 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs font-bold cursor-pointer"
              >
                RESTART
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5 w-full max-w-[260px]">
          <button type="button" onClick={() => moveX(-1)} className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold cursor-pointer">◀</button>
          <button type="button" onClick={rotate} className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold cursor-pointer">↻</button>
          <button type="button" onClick={stepDown} className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold cursor-pointer">▼</button>
          <button type="button" onClick={() => moveX(1)} className="border-2 border-[var(--lcd-fg)] py-1 text-base font-bold cursor-pointer">▶</button>
        </div>
      </div>
    </div>
  );
};

// --- 15-TILE PUZZLE ---
function recordPuzzleScore(totalMoves: number) {
  return db.scores.add({ gameId: 'puzzle', score: totalMoves, level: 1, achievedAt: Date.now() });
}

export const PuzzleGameApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const createShuffled = () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    for (let i = 0; i < 40; i++) {
      const z = arr.indexOf(0);
      const neighbors = [z - 1, z + 1, z - 4, z + 4].filter(
        (n) => n >= 0 && n < 16 && (Math.floor(n / 4) === Math.floor(z / 4) || n % 4 === z % 4)
      );
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      [arr[z], arr[pick]] = [arr[pick], arr[z]];
    }
    return arr;
  };

  const [tiles, setTiles] = useState<number[]>(createShuffled);
  const [moves, setMoves] = useState(0);

  const isSolved = tiles.every((v, i) => (i === 15 ? v === 0 : v === i + 1));

  const moveTile = (idx: number) => {
    const z = tiles.indexOf(0);
    const sameRow = Math.floor(idx / 4) === Math.floor(z / 4) && Math.abs(idx - z) === 1;
    const sameCol = idx % 4 === z % 4 && Math.abs(idx - z) === 4;
    if (!sameRow && !sameCol) return;

    soundEngine.playCue('click');
    const next = [...tiles];
    [next[z], next[idx]] = [next[idx], next[z]];
    setTiles(next);
    setMoves((m) => m + 1);
    if (next.every((v, i) => (i === 15 ? v === 0 : v === i + 1))) {
      soundEngine.playCue('notify');
      const totalMoves = moves + 1;
      void recordPuzzleScore(totalMoves);
      showToast(language === 'id' ? `Selesai dalam ${totalMoves} langkah!` : `Solved in ${totalMoves} moves!`);
    }
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: language === 'id' ? 'Acak' : 'Shuffle',
      centerLabel: 'OK',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => {
        setTiles(createShuffled());
        setMoves(0);
      },
      onRight: onBack,
    });
  }, [language, onBack, setSoftkeys]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title={`Puzzle · ${moves}`} showChevrons={false} />
      <div className="flex-1 flex flex-col items-center justify-center p-3 gap-2">
        <div className="grid grid-cols-4 gap-1 w-48 h-48 border-2 border-[var(--lcd-fg)] p-1 bg-[var(--lcd-sec)]">
          {tiles.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => moveTile(i)}
              disabled={v === 0}
              className={`border-2 border-[var(--lcd-fg)] text-xl font-bold cursor-pointer ${
                v === 0
                  ? 'border-transparent bg-transparent cursor-default'
                  : 'bg-[var(--lcd-bg)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]'
              }`}
            >
              {v === 0 ? '' : v}
            </button>
          ))}
        </div>
        {isSolved && (
          <div className="text-lg font-bold">
            {language === 'id' ? 'TEKA-TEKI SELESAI!' : 'PUZZLE SOLVED!'}
          </div>
        )}
      </div>
    </div>
  );
};

// --- E-BOOK READER (REAL .TXT/.MD BOOK READER + LIBRARY) ---
const DEFAULT_BOOK = {
  title: 'Panduan Era Monokrom',
  text:
    'Bab 1: Era Monokrom\nPada awal tahun 2000-an, layar LCD dot-matrix hijau kekuningan menjadi jendela digital pertama bagi jutaan orang di seluruh dunia. Dengan baterai yang tahan berminggu-minggu, kesederhanaan menjadi kekuatan utama.\n\n' +
    'Bab 2: Seni Pixel 2-Warna\nHanya dengan dua tingkat warna—terang dan gelap—para perancang ikon mampu membuat simbol amplop, telepon, dan pemandangan desa yang langsung dikenali dalam sekejap mata.\n\n' +
    'Bab 3: Masa Kini\nRetro Pixel OS menghidupkan kembali ketenangan antarmuka fokus tunggal: produktivitas nyata, browser web penuh, pemutar media lokal, dan permainan klasik.',
};

function paginateText(text: string, chunkSize = 280): string[] {
  const clean = text.trim();
  if (!clean) return ['(Kosong)'];
  const words = clean.split(/\s+/);
  const pages: string[] = [];
  let buf = '';
  for (const w of words) {
    if ((buf + ' ' + w).length > chunkSize && buf.length > 0) {
      pages.push(buf.trim());
      buf = w;
    } else {
      buf += (buf ? ' ' : '') + w;
    }
  }
  if (buf.trim()) pages.push(buf.trim());
  return pages;
}

export const EbookReaderApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [books, setBooks] = useState<VirtualFileRecord[]>([]);
  const [activeBook, setActiveBook] = useState<{ title: string; text: string }>(DEFAULT_BOOK);
  const [pageIdx, setPageIdx] = useState(0);
  const [showShelf, setShowShelf] = useState(false);

  const loadBooks = async () => {
    const rows = await db.files
      .filter((f) => f.mimeType.startsWith('text/') || /\.(txt|md)$/i.test(f.name))
      .reverse()
      .toArray();
    setBooks(rows);
    return rows;
  };

  useEffect(() => {
    let active = true;
    db.files
      .filter((f) => f.mimeType.startsWith('text/') || /\.(txt|md)$/i.test(f.name))
      .reverse()
      .toArray()
      .then((rows) => {
        if (!active) return;
        setBooks(rows);
        if (params?.fileId) {
          const found = rows.find((r) => r.id === params.fileId);
          if (found) {
            setActiveBook({ title: found.name, text: found.content });
            setPageIdx(0);
          }
        }
      });
    return () => {
      active = false;
    };
  }, [params?.fileId]);

  const pages = paginateText(activeBook.text, 260);

  const handleImportBook = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await db.files.add({
      folder: 'Dokumen',
      name: file.name,
      mimeType: 'text/plain',
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      content: text,
      createdAt: Date.now(),
    });
    e.target.value = '';
    setActiveBook({ title: file.name, text });
    setPageIdx(0);
    setShowShelf(false);
    await loadBooks();
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Buku dibuka: ${file.name}` : `Book opened: ${file.name}`);
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: language === 'id' ? 'Rak' : 'Books',
      centerLabel: language === 'id' ? 'Lanjut' : 'Next',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: () => setShowShelf((s) => !s),
      onCenter: () => setPageIdx((i) => (i + 1) % pages.length),
      onRight: () => {
        if (showShelf) setShowShelf(false);
        else onBack();
      },
    });
  });

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={`${activeBook.title.slice(0, 14)} (${pageIdx + 1}/${pages.length})`}
        onPrev={() => setPageIdx((i) => Math.max(0, i - 1))}
        onNext={() => setPageIdx((i) => (i + 1) % pages.length)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,text/plain"
        onChange={handleImportBook}
        className="hidden"
      />

      {showShelf ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-xs font-bold shrink-0">
            <span>{language === 'id' ? 'Rak Buku Lokal' : 'Local Books'}</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] px-2 py-0.5 cursor-pointer"
            >
              + {language === 'id' ? 'Impor .TXT' : 'Import .TXT'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto lcd-scroll divide-y divide-[var(--lcd-fg)]">
            <button
              type="button"
              onClick={() => {
                setActiveBook(DEFAULT_BOOK);
                setPageIdx(0);
                setShowShelf(false);
              }}
              className="w-full text-left p-2 text-xs font-bold hover:bg-[var(--lcd-sec)] cursor-pointer"
            >
              📖 {DEFAULT_BOOK.title}
            </button>
            {books.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setActiveBook({ title: b.name, text: b.content });
                  setPageIdx(0);
                  setShowShelf(false);
                }}
                className="w-full text-left p-2 text-xs font-bold hover:bg-[var(--lcd-sec)] flex justify-between cursor-pointer"
              >
                <span className="truncate">{b.name}</span>
                <span className="opacity-75 shrink-0 ml-2">{b.sizeKb} KB</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between p-3 gap-2 min-h-0">
          <div className="flex-1 overflow-y-auto lcd-scroll">
            <h3 className="text-sm font-bold border-b-2 border-[var(--lcd-fg)] pb-1 mb-2 truncate">
              {activeBook.title}
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{pages[pageIdx]}</p>
          </div>
          <div className="flex items-center justify-between gap-2 border-t-2 border-[var(--lcd-fg)] pt-1.5 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] cursor-pointer"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => setShowShelf(true)}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] cursor-pointer"
            >
              {language === 'id' ? 'Pilih / Impor Buku' : 'Books / Import'}
            </button>
            <button
              type="button"
              onClick={() => setPageIdx((i) => (i + 1) % pages.length)}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] cursor-pointer"
            >
              ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMICS ---
export const ComicsApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const [strip, setStrip] = useState(0);

  const strips = [
    {
      title: 'Petualangan Pixel #1',
      caption1: 'Pagi hari, sinyal penuh 4 bar!',
      caption2: 'Saatnya main Snake sebelum baterai habis.',
    },
    {
      title: 'Petualangan Pixel #2',
      caption1: 'Ada pesan masuk dari Ibu!',
      caption2: 'Jangan lupa istirahat dari layar ya.',
    },
  ];

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: language === 'id' ? 'Berikut' : 'Next',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: () => setStrip((s) => (s + 1) % strips.length),
      onRight: onBack,
    });
  }, [language]);

  const cur = strips[strip];

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={cur.title}
        onPrev={() => setStrip((s) => (s - 1 + strips.length) % strips.length)}
        onNext={() => setStrip((s) => (s + 1) % strips.length)}
      />
      <div className="flex-1 p-2.5 flex flex-col gap-2">
        <div className="flex-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 flex flex-col justify-between">
          <div className="h-16 overflow-hidden border border-[var(--lcd-fg)] bg-[var(--lcd-bg)]">
            <PixelWallpaperArt id={strip === 0 ? 'village' : 'sunrise'} />
          </div>
          <p className="text-base font-bold leading-tight mt-1">{cur.caption1}</p>
        </div>
        <div className="flex-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 flex flex-col justify-between">
          <div className="flex items-center justify-center h-14 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)]">
            <PixelIcon name={strip === 0 ? 'snake' : 'message'} size={32} />
          </div>
          <p className="text-base font-bold leading-tight mt-1">{cur.caption2}</p>
        </div>
      </div>
    </div>
  );
};

// --- WALLPAPER GALLERY ---
export const WallpaperGalleryApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const wallpaperId = useOSStore((s) => s.wallpaperId);
  const setWallpaper = useOSStore((s) => s.setWallpaper);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [idx, setIdx] = useState(() => Math.max(0, WALLPAPERS.findIndex((w) => w.id === wallpaperId)));
  const current = WALLPAPERS[idx] ?? WALLPAPERS[0];

  const apply = () => {
    setWallpaper(current.id);
    soundEngine.playCue('select');
    showToast(language === 'id' ? 'Wallpaper diterapkan!' : 'Wallpaper applied!');
  };

  useEffect(() => {
    setSoftkeys({
      leftLabel: '',
      centerLabel: language === 'id' ? 'Terapkan' : 'Apply',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onCenter: apply,
      onRight: onBack,
    });
  }, [idx, language]);

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title="Wallpaper"
        onPrev={() => setIdx((i) => (i - 1 + WALLPAPERS.length) % WALLPAPERS.length)}
        onNext={() => setIdx((i) => (i + 1) % WALLPAPERS.length)}
      />
      <div className="flex-1 p-2.5 flex flex-col justify-between gap-2">
        <div className="flex-1 border-2 border-[var(--lcd-fg)] overflow-hidden bg-[var(--lcd-bg)]">
          <PixelWallpaperArt id={current.id} />
        </div>
        <div className="flex justify-between items-center text-xs sm:text-sm font-bold">
          <span>{language === 'id' ? current.nameId : current.nameEn}</span>
          <span>{idx + 1}/{WALLPAPERS.length}</span>
        </div>
        <button
          type="button"
          onClick={apply}
          className="w-full py-1.5 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-xs sm:text-sm font-bold cursor-pointer"
        >
          {language === 'id' ? 'Terapkan Wallpaper' : 'Apply Wallpaper'}
        </button>
      </div>
    </div>
  );
};
