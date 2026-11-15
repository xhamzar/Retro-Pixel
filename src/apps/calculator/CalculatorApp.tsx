'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppHeader } from '@/src/core/AppHeader';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps } from '@/src/types/os';

export const CalculatorApp: React.FC<AppComponentProps> = ({ onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const [display, setDisplay] = useState('0');
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHist, setShowHist] = useState(false);

  const inputDigit = useCallback(
    (d: string) => {
      soundEngine.playCue('click');
      if (resetNext || display === '0') {
        setDisplay(d === '.' ? '0.' : d);
        setResetNext(false);
      } else {
        if (d === '.' && display.includes('.')) return;
        setDisplay(display + d);
      }
    },
    [display, resetNext]
  );

  const compute = (a: number, b: number, operator: string): number => {
    switch (operator) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '×':
        return a * b;
      case '÷':
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  };

  const pressOp = useCallback(
    (nextOp: string) => {
      soundEngine.playCue('click');
      const cur = parseFloat(display);
      if (prevVal !== null && op && !resetNext) {
        const res = compute(prevVal, cur, op);
        const formatted = Number.isNaN(res) ? 'Error' : String(Number(res.toFixed(6)));
        setDisplay(formatted);
        setPrevVal(Number.isNaN(res) ? null : res);
      } else {
        setPrevVal(cur);
      }
      setOp(nextOp);
      setResetNext(true);
    },
    [display, op, prevVal, resetNext]
  );

  const pressEquals = useCallback(() => {
    if (prevVal === null || !op) return;
    soundEngine.playCue('select');
    const cur = parseFloat(display);
    const res = compute(prevVal, cur, op);
    const formatted = Number.isNaN(res) ? 'Error' : String(Number(res.toFixed(6)));
    setHistory((h) => [`${prevVal} ${op} ${cur} = ${formatted}`, ...h].slice(0, 12));
    setDisplay(formatted);
    setPrevVal(null);
    setOp(null);
    setResetNext(true);
  }, [display, op, prevVal]);

  const clearAll = useCallback(() => {
    soundEngine.playCue('back');
    setDisplay('0');
    setPrevVal(null);
    setOp(null);
    setResetNext(false);
  }, []);

  // Physical keyboard support for numeric and operator keys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        inputDigit(e.key);
      } else if (e.key === '+') {
        e.preventDefault();
        pressOp('+');
      } else if (e.key === '-') {
        e.preventDefault();
        pressOp('-');
      } else if (e.key === '*') {
        e.preventDefault();
        pressOp('×');
      } else if (e.key === '/') {
        e.preventDefault();
        pressOp('÷');
      } else if (e.key === '=') {
        e.preventDefault();
        pressEquals();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        clearAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearAll, inputDigit, pressEquals, pressOp]);

  useEffect(() => {
    setSoftkeys({
      leftLabel: 'C',
      centerLabel: '=',
      rightLabel: language === 'id' ? 'Kembali' : 'Back',
      onLeft: clearAll,
      onCenter: pressEquals,
      onRight: onBack,
    });
  }, [clearAll, pressEquals, onBack, setSoftkeys, language]);

  const buttons = [
    'C', '±', '%', '÷',
    '7', '8', '9', '×',
    '4', '5', '6', '-',
    '1', '2', '3', '+',
    '0', '.', '←', '=',
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Kalkulator' : 'Calculator'}
        showChevrons={false}
        rightSlot={
          <button
            type="button"
            onClick={() => setShowHist((v) => !v)}
            className="border border-current px-1.5 text-[10px] font-bold cursor-pointer"
          >
            {showHist ? 'CALC' : `HIST(${history.length})`}
          </button>
        }
      />

      {showHist ? (
        <div className="flex-1 overflow-y-auto lcd-scroll p-2 space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold border-b border-[var(--lcd-fg)] pb-1">
            <span>{language === 'id' ? 'Riwayat Hitung' : 'History'}</span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setHistory([])}
                className="underline cursor-pointer"
              >
                {language === 'id' ? 'Bersihkan' : 'Clear'}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="text-xs opacity-75 text-center py-6">
              {language === 'id' ? 'Belum ada riwayat perhitungan.' : 'No history yet.'}
            </div>
          ) : (
            history.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const ans = item.split('=')[1]?.trim();
                  if (ans && ans !== 'Error') {
                    setDisplay(ans);
                    setShowHist(false);
                  }
                }}
                className="w-full text-right border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-2 py-1 text-xs font-bold tabular-nums cursor-pointer"
              >
                {item}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-2 gap-2">
          <div className="border-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-2.5 py-2 text-right">
            <div className="flex items-center justify-between text-[11px] h-4 opacity-80">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard?.writeText(display).catch(() => undefined);
                  showToast(language === 'id' ? 'Hasil disalin' : 'Copied');
                }}
                className="text-[10px] underline cursor-pointer"
              >
                {language === 'id' ? 'Salin' : 'Copy'}
              </button>
              <span>{prevVal !== null ? `${prevVal} ${op ?? ''}` : ''}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold leading-none truncate tabular-nums">{display}</div>
          </div>

          <div className="grid grid-cols-4 gap-1 flex-1">
            {buttons.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  if (b === 'C') clearAll();
                  else if (b === '←') setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
                  else if (b === '±') setDisplay((d) => String(-parseFloat(d || '0')));
                  else if (b === '%') setDisplay((d) => String(parseFloat(d || '0') / 100));
                  else if (['+', '-', '×', '÷'].includes(b)) pressOp(b);
                  else if (b === '=') pressEquals();
                  else inputDigit(b);
                }}
                className={`border-2 border-[var(--lcd-fg)] text-base sm:text-lg font-bold cursor-pointer ${
                  b === '=' || ['+', '-', '×', '÷'].includes(b)
                    ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                    : 'bg-[var(--lcd-bg)] hover:bg-[var(--lcd-sec)]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
