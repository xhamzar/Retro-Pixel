'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/src/core/AppHeader';
import { APP_REGISTRY } from '@/src/core/appRegistry';
import { DEFAULT_HOME, writeLinuxFile } from '@/src/services/linuxVfs';
import {
  autocompleteTerminalInput,
  executeTerminalCommand,
  type ShellOutputLine,
} from '@/src/services/pixelShell';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps } from '@/src/types/os';

let lineSeq = 1;
function nextLineId(prefix: string): string {
  lineSeq += 1;
  return `${prefix}-${lineSeq}`;
}

interface NanoEditorState {
  path: string;
  content: string;
  savedContent: string;
  statusMsg: string;
  cutBuffer: string;
  searchOpen: boolean;
  searchQuery: string;
  helpOpen: boolean;
  confirmExit: boolean;
  cursorLine: number;
  cursorCol: number;
}

function formatPromptPath(cwd: string): string {
  if (cwd === DEFAULT_HOME) return '~';
  if (cwd.startsWith(`${DEFAULT_HOME}/`)) {
    return `~/${cwd.slice(DEFAULT_HOME.length + 1)}`;
  }
  return cwd || '/';
}

const SHELL_QUICK_BUTTONS = [
  { id: 'tab', label: 'Tab', action: 'tab' },
  { id: 'up', label: '↑', action: 'up' },
  { id: 'down', label: '↓', action: 'down' },
  { id: 'ls -la', label: 'ls -la', action: 'run' },
  { id: 'nano ', label: 'nano', action: 'insert' },
  { id: 'man ', label: 'man', action: 'insert' },
  { id: 'cat ', label: 'cat', action: 'insert' },
  { id: 'ps', label: 'ps', action: 'run' },
  { id: 'neofetch', label: 'neofetch', action: 'run' },
  { id: 'run ', label: 'run', action: 'insert' },
  { id: 'curl -s ', label: 'curl', action: 'insert' },
  { id: 'open ', label: 'open', action: 'insert' },
  { id: '|', label: '|', action: 'insert' },
  { id: '>', label: '>', action: 'insert' },
  { id: 'clear', label: 'clear', action: 'run' },
] as const;

const NANO_SHORTCUT_BUTTONS = [
  { id: 'save', label: '^O Simpan' },
  { id: 'find', label: '^W Cari' },
  { id: 'cut', label: '^K Potong' },
  { id: 'paste', label: '^U Tempel' },
  { id: 'help', label: '^G Bantuan' },
  { id: 'exit', label: '^X Keluar' },
] as const;

export const TerminalApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const themeId = useOSStore((s) => s.themeId);
  const soundEnabled = useOSStore((s) => s.soundEnabled);
  const batteryLevel = useOSStore((s) => s.batteryLevel);
  const isCharging = useOSStore((s) => s.isCharging);
  const wifiEnabled = useOSStore((s) => s.wifiEnabled);

  const setTheme = useOSStore((s) => s.setTheme);
  const setSoundEnabled = useOSStore((s) => s.setSoundEnabled);
  const setLanguage = useOSStore((s) => s.setLanguage);
  const openApp = useOSStore((s) => s.openApp);
  const pushNotification = useOSStore((s) => s.pushNotification);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);

  const appsList = useMemo(
    () =>
      APP_REGISTRY.map((a) => ({
        id: a.id,
        nameId: a.nameId,
        nameEn: a.nameEn,
        category: a.category,
      })),
    []
  );

  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nanoAreaRef = useRef<HTMLTextAreaElement>(null);
  const nanoSearchRef = useRef<HTMLInputElement>(null);
  const bootTimeRef = useRef<number>(0);

  const [cwd, setCwd] = useState<string>(DEFAULT_HOME);
  const [lastExitCode, setLastExitCode] = useState<number>(0);
  const [env, setEnv] = useState<Record<string, string>>({
    USER: 'pixel',
    HOME: DEFAULT_HOME,
    PWD: DEFAULT_HOME,
    SHELL: '/bin/sh',
    TERM: 'pixel-mono',
    OS: 'RetroPixelLinux',
  });
  const [aliases, setAliases] = useState<Record<string, string>>({
    ll: 'ls -l',
    la: 'ls -la',
    cls: 'clear',
  });
  const [history, setHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const [inputValue, setInputValue] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [nanoState, setNanoState] = useState<NanoEditorState | null>(null);

  const [lines, setLines] = useState<ShellOutputLine[]>(() => [
    {
      id: 'boot-1',
      kind: 'sys',
      text: 'PIXELLINUX 2.4 LTS · /home/pixel · mount: /mnt/os',
    },
    {
      id: 'boot-2',
      kind: 'out',
      text: 'Ketik "help", "man nano", "ls -la", atau "run halo.sh".',
    },
  ]);

  useEffect(() => {
    if (!bootTimeRef.current) {
      bootTimeRef.current = Date.now();
    }
    if (nanoState) {
      nanoAreaRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [nanoState]);

  useEffect(() => {
    if (!nanoState) {
      outputEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [lines, nanoState]);

  const appendLines = useCallback((items: Omit<ShellOutputLine, 'id'>[]) => {
    setLines((prev) =>
      [
        ...prev,
        ...items.map((item) => ({
          id: nextLineId(item.kind),
          kind: item.kind,
          text: item.text,
        })),
      ].slice(-220)
    );
  }, []);

  const runCommandText = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      const shortPath = formatPromptPath(cwd);

      if (!trimmed) {
        appendLines([{ kind: 'cmd', text: `pixel@linux:${shortPath}$` }]);
        return;
      }

      soundEngine.playCue('click');
      setBusy(true);
      setInputValue('');
      setHistory((prev) => [...prev.slice(-59), trimmed]);
      setHistoryCursor(-1);

      appendLines([{ kind: 'cmd', text: `pixel@linux:${shortPath}$ ${trimmed}` }]);

      try {
        const res = await executeTerminalCommand(trimmed, {
          cwd,
          env,
          aliases,
          history,
          bootTimeMs: bootTimeRef.current || Date.now(),
          lastExitCode,
          apps: appsList,
          os: {
            language,
            themeId,
            soundEnabled,
            batteryLevel,
            isCharging,
            wifiEnabled,
            setTheme,
            setSoundEnabled,
            setLanguage,
            openApp,
            pushNotification,
          },
        });

        setCwd(res.nextCwd);
        setEnv(res.nextEnv);
        setAliases(res.nextAliases);
        setLastExitCode(res.lastExitCode);

        if (res.clearRequested) {
          setLines([
            {
              id: nextLineId('sys'),
              kind: 'sys',
              text: 'Layar dibersihkan. Ketik "help" atau "man".',
            },
          ]);
        }
        if (res.lines.length > 0) {
          appendLines(res.lines);
          if (res.lines.some((l) => l.kind === 'err')) {
            soundEngine.playCue('error');
          }
        }
        if (res.openNano) {
          soundEngine.playCue('select');
          setNanoState({
            path: res.openNano.path,
            content: res.openNano.content,
            savedContent: res.openNano.content,
            statusMsg: res.openNano.isNew
              ? `[ Berkas Baru: ${res.openNano.path} ]`
              : `[ Dibaca ${res.openNano.content.split('\n').length} baris ]`,
            cutBuffer: '',
            searchOpen: false,
            searchQuery: '',
            helpOpen: false,
            confirmExit: false,
            cursorLine: 1,
            cursorCol: 1,
          });
        } else if (res.exitRequested) {
          onBack();
        }
      } catch (err) {
        soundEngine.playCue('error');
        appendLines([
          {
            kind: 'err',
            text: err instanceof Error ? err.message : 'Gagal menjalankan perintah',
          },
        ]);
      } finally {
        setBusy(false);
        setTimeout(() => {
          if (!nanoState) inputRef.current?.focus();
        }, 0);
      }
    },
    [
      aliases,
      appendLines,
      appsList,
      batteryLevel,
      cwd,
      env,
      history,
      isCharging,
      language,
      lastExitCode,
      nanoState,
      onBack,
      openApp,
      pushNotification,
      setLanguage,
      setSoundEnabled,
      setTheme,
      soundEnabled,
      themeId,
      wifiEnabled,
    ]
  );

  const ranInitialRef = useRef(false);
  useEffect(() => {
    const initialCmd = typeof params?.textContent === 'string' ? params.textContent.trim() : '';
    if (initialCmd && !ranInitialRef.current) {
      ranInitialRef.current = true;
      void runCommandText(initialCmd);
    }
  }, [params?.textContent, runCommandText]);

  const handleAutocomplete = useCallback(async () => {
    soundEngine.playCue('click');
    const res = await autocompleteTerminalInput(inputValue, cwd, appsList, aliases);
    if (res.completed !== inputValue) {
      setInputValue(res.completed);
    } else if (res.suggestions.length > 0) {
      appendLines([{ kind: 'sys', text: res.suggestions.join('  ') }]);
    }
    inputRef.current?.focus();
  }, [aliases, appendLines, appsList, cwd, inputValue]);

  const recallHistory = useCallback(
    (dir: -1 | 1) => {
      if (history.length === 0) return;
      soundEngine.playCue('click');
      let nextIdx = historyCursor;
      if (dir === -1) {
        nextIdx = historyCursor < 0 ? history.length - 1 : Math.max(0, historyCursor - 1);
      } else {
        nextIdx = historyCursor < 0 ? -1 : historyCursor + 1;
        if (nextIdx >= history.length) {
          setHistoryCursor(-1);
          setInputValue('');
          return;
        }
      }
      setHistoryCursor(nextIdx);
      setInputValue(history[nextIdx] ?? '');
      inputRef.current?.focus();
    },
    [history, historyCursor]
  );

  // ---------- Nano Editor Actions ----------

  const updateNanoCursor = useCallback((text: string, selectionStart: number) => {
    const before = text.slice(0, selectionStart);
    const split = before.split('\n');
    const line = split.length;
    const col = (split[split.length - 1]?.length ?? 0) + 1;
    setNanoState((prev) => (prev ? { ...prev, cursorLine: line, cursorCol: col } : prev));
  }, []);

  const saveNanoFile = useCallback(async () => {
    if (!nanoState) return false;
    soundEngine.playCue('select');
    const res = await writeLinuxFile(nanoState.path, nanoState.content, 'overwrite');
    if (res.error) {
      soundEngine.playCue('error');
      setNanoState((prev) => (prev ? { ...prev, statusMsg: `[ Gagal: ${res.error} ]` } : prev));
      return false;
    }
    const lineCount = nanoState.content ? nanoState.content.split('\n').length : 0;
    setNanoState((prev) =>
      prev
        ? {
            ...prev,
            savedContent: prev.content,
            confirmExit: false,
            statusMsg: `[ Tersimpan ${lineCount} baris ke ${prev.path} ]`,
          }
        : prev
    );
    return true;
  }, [nanoState]);

  const closeNanoImmediate = useCallback(
    (savedMessage?: string) => {
      const targetPath = nanoState?.path ?? '';
      setNanoState(null);
      if (savedMessage) {
        appendLines([{ kind: 'sys', text: savedMessage }]);
      } else if (targetPath) {
        appendLines([{ kind: 'sys', text: `[nano] Keluar dari ${targetPath}` }]);
      }
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [appendLines, nanoState?.path]
  );

  const requestExitNano = useCallback(() => {
    if (!nanoState) return;
    soundEngine.playCue('click');
    if (nanoState.content !== nanoState.savedContent) {
      setNanoState((prev) => (prev ? { ...prev, confirmExit: true, helpOpen: false } : prev));
      return;
    }
    closeNanoImmediate();
  }, [closeNanoImmediate, nanoState]);

  const cutCurrentNanoLine = useCallback(() => {
    if (!nanoState) return;
    soundEngine.playCue('click');
    const ta = nanoAreaRef.current;
    const pos = ta?.selectionStart ?? 0;
    const linesArr = nanoState.content.split('\n');
    const before = nanoState.content.slice(0, pos);
    const lineIdx = Math.max(0, before.split('\n').length - 1);
    const removedLine = linesArr[lineIdx] ?? '';
    linesArr.splice(lineIdx, 1);
    const nextText = linesArr.join('\n');

    setNanoState((prev) =>
      prev
        ? {
            ...prev,
            content: nextText,
            cutBuffer: removedLine,
            statusMsg: `[ Baris ${lineIdx + 1} dipotong (^U untuk tempel) ]`,
          }
        : prev
    );
    setTimeout(() => nanoAreaRef.current?.focus(), 0);
  }, [nanoState]);

  const pasteNanoCutBuffer = useCallback(() => {
    if (!nanoState || !nanoState.cutBuffer) return;
    soundEngine.playCue('click');
    const ta = nanoAreaRef.current;
    const pos = ta?.selectionStart ?? nanoState.content.length;
    const inserted = `${nanoState.cutBuffer}\n`;
    const nextText =
      nanoState.content.slice(0, pos) + inserted + nanoState.content.slice(pos);
    setNanoState((prev) =>
      prev
        ? {
            ...prev,
            content: nextText,
            statusMsg: '[ Ditempel dari buffer ]',
          }
        : prev
    );
    setTimeout(() => nanoAreaRef.current?.focus(), 0);
  }, [nanoState]);

  const runNanoSearch = useCallback(
    (query: string) => {
      if (!nanoState || !query) return;
      soundEngine.playCue('click');
      const ta = nanoAreaRef.current;
      const startFrom = (ta?.selectionEnd ?? 0);
      const lowerContent = nanoState.content.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let idx = lowerContent.indexOf(lowerQuery, startFrom);
      if (idx < 0) idx = lowerContent.indexOf(lowerQuery, 0);

      if (idx < 0) {
        setNanoState((prev) => (prev ? { ...prev, statusMsg: `[ "${query}" tidak ditemukan ]` } : prev));
        return;
      }
      setNanoState((prev) => (prev ? { ...prev, statusMsg: `[ Ditemukan "${query}" ]` } : prev));
      setTimeout(() => {
        if (nanoAreaRef.current) {
          nanoAreaRef.current.focus();
          nanoAreaRef.current.setSelectionRange(idx, idx + query.length);
        }
      }, 0);
    },
    [nanoState]
  );

  // Softkeys adapt dynamically between Shell and Nano modes
  useEffect(() => {
    if (nanoState) {
      setSoftkeys({
        leftLabel: 'Simpan',
        centerLabel: 'Cari',
        rightLabel: 'Keluar',
        onLeft: () => void saveNanoFile(),
        onCenter: () => {
          setNanoState((prev) =>
            prev ? { ...prev, searchOpen: !prev.searchOpen, helpOpen: false } : prev
          );
          setTimeout(() => nanoSearchRef.current?.focus(), 10);
        },
        onRight: requestExitNano,
      });
    } else {
      setSoftkeys({
        leftLabel: 'Tab',
        centerLabel: language === 'id' ? 'Jalankan' : 'Run',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => void handleAutocomplete(),
        onCenter: () => void runCommandText(inputValue),
        onRight: onBack,
      });
    }
  });

  const insertSnippet = (snippet: string) => {
    soundEngine.playCue('click');
    setInputValue((prev) => (prev ? `${prev}${prev.endsWith(' ') ? '' : ' '}${snippet}` : snippet));
    inputRef.current?.focus();
  };

  const handleShellKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!busy) void runCommandText(inputValue);
    } else if (e.key === 'ArrowUp' && !inputValue.includes('\n')) {
      e.preventDefault();
      recallHistory(-1);
    } else if (e.key === 'ArrowDown' && !inputValue.includes('\n')) {
      e.preventDefault();
      recallHistory(1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      void handleAutocomplete();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      void runCommandText('clear');
    }
  };

  const handleNanoKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = `${nanoState?.content.slice(0, start) ?? ''}  ${nanoState?.content.slice(end) ?? ''}`;
      setNanoState((prev) => (prev ? { ...prev, content: next } : prev));
      setTimeout(() => {
        ta.setSelectionRange(start + 2, start + 2);
      }, 0);
      return;
    }

    if (!e.ctrlKey && !e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'o' || k === 's') {
      e.preventDefault();
      void saveNanoFile();
    } else if (k === 'x') {
      e.preventDefault();
      requestExitNano();
    } else if (k === 'k') {
      e.preventDefault();
      cutCurrentNanoLine();
    } else if (k === 'u') {
      e.preventDefault();
      pasteNanoCutBuffer();
    } else if (k === 'w') {
      e.preventDefault();
      setNanoState((prev) => (prev ? { ...prev, searchOpen: !prev.searchOpen } : prev));
      setTimeout(() => nanoSearchRef.current?.focus(), 10);
    } else if (k === 'g') {
      e.preventDefault();
      setNanoState((prev) => (prev ? { ...prev, helpOpen: !prev.helpOpen } : prev));
    }
  };

  // ---------- Full-Screen GNU nano Mode ----------
  if (nanoState) {
    const isDirty = nanoState.content !== nanoState.savedContent;
    const totalLines = nanoState.content.split('\n').length;

    return (
      <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)] font-mono">
        {/* Nano Title Bar */}
        <div className="bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-2 py-1 flex items-center justify-between gap-2 text-[11px] font-bold shrink-0">
          <span className="truncate">GNU nano · {nanoState.path}</span>
          <span className="shrink-0 tabular-nums">
            {isDirty ? '[Diubah]' : `B:${nanoState.cursorLine} K:${nanoState.cursorCol}`}
          </span>
        </div>

        {/* Help Drawer (^G) */}
        {nanoState.helpOpen && (
          <div className="border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] p-2 text-[10px] leading-snug shrink-0">
            <div className="font-bold mb-1">PANDUAN SINGKAT NANO</div>
            <div>^O / Simpan : Tulis berkas langsung ke VFS atau /mnt/os</div>
            <div>^W / Cari   : Temukan teks berikutnya di dokumen</div>
            <div>^K / Potong : Hapus baris kursor · ^U : Tempel baris</div>
            <div>^X / Keluar : Tutup editor dan kembali ke Shell Linux</div>
          </div>
        )}

        {/* Inline Search Bar (^W) */}
        {nanoState.searchOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runNanoSearch(nanoState.searchQuery);
            }}
            className="border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-2 py-1 flex items-center gap-1.5 shrink-0"
          >
            <span className="text-[10px] font-bold shrink-0">Cari:</span>
            <input
              ref={nanoSearchRef}
              type="text"
              value={nanoState.searchQuery}
              onChange={(e) =>
                setNanoState((prev) => (prev ? { ...prev, searchQuery: e.target.value } : prev))
              }
              placeholder="kata kunci..."
              className="flex-1 min-w-0 bg-[var(--lcd-bg)] border border-[var(--lcd-fg)] px-1.5 py-0.5 text-[11px] outline-none"
            />
            <button
              type="submit"
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold cursor-pointer"
            >
              Temukan
            </button>
          </form>
        )}

        {/* Editor Body with Line-Number Gutter */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div
            aria-hidden="true"
            className="w-8 bg-[var(--lcd-sec)] border-r border-[var(--lcd-fg)]/45 py-1.5 px-1 text-right text-[10px] leading-[1.45] opacity-75 select-none overflow-hidden shrink-0 tabular-nums"
          >
            {Array.from({ length: totalLines }, (_, idx) => (
              <div key={idx}>{idx + 1}</div>
            ))}
          </div>
          <textarea
            ref={nanoAreaRef}
            value={nanoState.content}
            onChange={(e) => {
              const val = e.target.value;
              const sel = e.target.selectionStart;
              setNanoState((prev) => (prev ? { ...prev, content: val } : prev));
              updateNanoCursor(val, sel);
            }}
            onClick={(e) =>
              updateNanoCursor(e.currentTarget.value, e.currentTarget.selectionStart)
            }
            onKeyUp={(e) =>
              updateNanoCursor(e.currentTarget.value, e.currentTarget.selectionStart)
            }
            onKeyDown={handleNanoKeyDown}
            spellCheck={false}
            autoCapitalize="none"
            className="flex-1 min-w-0 h-full resize-none bg-[var(--lcd-bg)] text-[var(--lcd-fg)] p-1.5 text-[11px] leading-[1.45] font-mono outline-none lcd-scroll"
          />
        </div>

        {/* Exit Confirmation Prompt or Status Line */}
        {nanoState.confirmExit ? (
          <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-2 py-1.5 flex items-center justify-between gap-2 text-[10px] font-bold shrink-0">
            <span className="truncate">Simpan perubahan?</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const ok = await saveNanoFile();
                  if (ok) closeNanoImmediate(`[nano] Disimpan & keluar: ${nanoState.path}`);
                }}
                className="px-2 py-0.5 bg-[var(--lcd-bg)] text-[var(--lcd-fg)] border border-[var(--lcd-bg)] cursor-pointer"
              >
                Ya (Simpan)
              </button>
              <button
                type="button"
                onClick={() => closeNanoImmediate(`[nano] Perubahan dibuang: ${nanoState.path}`)}
                className="px-2 py-0.5 border border-[var(--lcd-bg)] cursor-pointer"
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={() =>
                  setNanoState((prev) => (prev ? { ...prev, confirmExit: false } : prev))
                }
                className="px-1.5 py-0.5 border border-[var(--lcd-bg)] opacity-85 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-[var(--lcd-fg)]/45 bg-[var(--lcd-sec)] px-2 py-0.5 text-[10px] font-bold truncate shrink-0">
            {nanoState.statusMsg}
          </div>
        )}

        {/* Nano Touch Shortcut Bar */}
        <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-1.5 py-1 flex items-center gap-1 overflow-x-auto lcd-scroll shrink-0">
          {NANO_SHORTCUT_BUTTONS.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => {
                if (btn.id === 'save') {
                  void saveNanoFile();
                } else if (btn.id === 'find') {
                  setNanoState((prev) =>
                    prev ? { ...prev, searchOpen: !prev.searchOpen, helpOpen: false } : prev
                  );
                  setTimeout(() => nanoSearchRef.current?.focus(), 10);
                } else if (btn.id === 'cut') {
                  cutCurrentNanoLine();
                } else if (btn.id === 'paste') {
                  pasteNanoCutBuffer();
                } else if (btn.id === 'help') {
                  setNanoState((prev) =>
                    prev ? { ...prev, helpOpen: !prev.helpOpen } : prev
                  );
                } else {
                  requestExitNano();
                }
              }}
              className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Standard Interactive Linux Shell Mode ----------
  const promptPrefix = `${formatPromptPath(cwd)}$`;

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader
        title={language === 'id' ? 'Terminal Linux' : 'Linux Terminal'}
        showChevrons={false}
      />

      {/* Monochrome Scrollable Terminal Output Buffer */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex-1 min-h-0 overflow-y-auto lcd-scroll p-2 space-y-1.5 font-mono text-[11px] leading-snug tabular-nums cursor-text"
      >
        {lines.map((line) => {
          if (line.kind === 'cmd') {
            return (
              <div
                key={line.id}
                className="bg-[var(--lcd-fg)] text-[var(--lcd-bg)] px-1.5 py-0.5 font-bold whitespace-pre-wrap break-all"
              >
                {line.text}
              </div>
            );
          }
          if (line.kind === 'err') {
            return (
              <div
                key={line.id}
                className="border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-1.5 py-1 font-bold whitespace-pre-wrap break-words"
              >
                [ERR] {line.text}
              </div>
            );
          }
          if (line.kind === 'sys') {
            return (
              <div
                key={line.id}
                className="border-b border-dashed border-[var(--lcd-fg)]/45 pb-0.5 font-bold whitespace-pre-wrap break-words"
              >
                {line.text}
              </div>
            );
          }
          return (
            <pre
              key={line.id}
              className="font-mono text-[11px] leading-snug whitespace-pre-wrap break-words m-0"
            >
              {line.text}
            </pre>
          );
        })}
        <div ref={outputEndRef} />
      </div>

      {/* Bilah Tombol Cepat (Quick Action Keybar) */}
      <div className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] px-1.5 py-1 flex items-center gap-1 overflow-x-auto lcd-scroll shrink-0">
        {SHELL_QUICK_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => {
              if (btn.action === 'tab') {
                void handleAutocomplete();
              } else if (btn.action === 'up') {
                recallHistory(-1);
              } else if (btn.action === 'down') {
                recallHistory(1);
              } else if (btn.action === 'run') {
                void runCommandText(btn.id);
              } else {
                insertSnippet(btn.id);
              }
            }}
            className="px-2 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)]"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Prompt Input Bar (supports single-line & multi-line paste with \ and JSON) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void runCommandText(inputValue);
        }}
        className="border-t-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] p-1.5 flex items-end gap-1.5 shrink-0"
      >
        <span className="font-mono text-[11px] font-bold shrink-0 max-w-[96px] truncate pb-1.5">
          {promptPrefix}
        </span>
        <textarea
          ref={inputRef}
          rows={Math.min(4, Math.max(1, inputValue.split('\n').length))}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleShellKeyDown}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={
            language === 'id'
              ? 'ketik atau tempel perintah...'
              : 'type or paste command...'
          }
          className="flex-1 min-w-0 resize-none bg-[var(--lcd-sec)] border-2 border-[var(--lcd-fg)] px-1.5 py-1 text-xs font-mono font-bold outline-none placeholder:opacity-60 lcd-scroll leading-snug"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-2.5 py-1 border-2 border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-50"
        >
          RUN
        </button>
      </form>
    </div>
  );
};
