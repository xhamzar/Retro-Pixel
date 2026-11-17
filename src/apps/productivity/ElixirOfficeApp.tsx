'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Heading1,
  Heading2,
  Italic,
  List,
  Loader2,
  Minus,
  Play,
  Presentation,
  Redo2,
  Save,
  Table,
  Trash2,
  Underline,
  Undo2,
  Upload,
} from 'lucide-react';
import { AppHeader } from '@/src/core/AppHeader';
import { db } from '@/src/services/db';
import {
  MIME_DOCX,
  MIME_PPTX,
  MIME_XLSX,
  OFFICE_COLS as COLS,
  OFFICE_ROW_COUNT as ROW_COUNT,
  OfficeReadError,
  blobToDataUrl,
  buildDocxBlobFromHtml,
  buildPptxBlobFromSlides,
  buildXlsxBlobFromCells,
  dataUrlToArrayBuffer,
  getOfficeFileKind,
  parseDocxBufferToHtml,
  parsePptxBufferToSlides,
  parseXlsxBufferToCells,
  stripDangerousOfficeHtml,
  type OfficeModule,
  type CellFormatType,
  type OfficeSlide,
  type SheetCellData,
  type SheetCellsMap,
  type SlideTheme,
} from '@/src/services/officeCodecs';
import { soundEngine } from '@/src/services/sound';
import { useOSStore } from '@/src/store/useOSStore';
import type { AppComponentProps, VirtualFileRecord } from '@/src/types/os';

type RibbonTab = 'home' | 'insert' | 'file' | 'template';

let officeUid = 1;
function nextOfficeId(prefix: string): string {
  officeUid += 1;
  return `${prefix}-${officeUid}-${Math.floor(Math.random() * 1000)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const stripDangerousHtml = stripDangerousOfficeHtml;

function countWordsAndChars(html: string): { words: number; chars: number } {
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return { words: 0, chars: 0 };
  return {
    words: plain.split(' ').filter(Boolean).length,
    chars: plain.length,
  };
}

// --- Safe Spreadsheet Formula Engine (Zero eval) ---
function expandCellRange(startRef: string, endRef: string): string[] {
  const m1 = /^([A-H])(\d{1,2})$/.exec(startRef.toUpperCase());
  const m2 = /^([A-H])(\d{1,2})$/.exec(endRef.toUpperCase());
  if (!m1 || !m2) return [];
  const c1 = COLS.indexOf(m1[1] as (typeof COLS)[number]);
  const c2 = COLS.indexOf(m2[1] as (typeof COLS)[number]);
  const r1 = parseInt(m1[2], 10);
  const r2 = parseInt(m2[2], 10);
  if (c1 < 0 || c2 < 0) return [];
  const out: string[] = [];
  for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c += 1) {
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r += 1) {
      if (r >= 1 && r <= ROW_COUNT) {
        out.push(`${COLS[c]}${r}`);
      }
    }
  }
  return out;
}

function evalArithmeticExpr(expr: string): number {
  let pos = 0;
  const src = expr.replace(/\s+/g, '');

  const parseExpr = (): number => {
    let val = parseTerm();
    while (pos < src.length && (src[pos] === '+' || src[pos] === '-')) {
      const op = src[pos];
      pos += 1;
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  };

  const parseTerm = (): number => {
    let val = parseFactor();
    while (pos < src.length && (src[pos] === '*' || src[pos] === '/')) {
      const op = src[pos];
      pos += 1;
      const rhs = parseFactor();
      val = op === '*' ? val * rhs : rhs === 0 ? NaN : val / rhs;
    }
    return val;
  };

  const parseFactor = (): number => {
    if (src[pos] === '+') {
      pos += 1;
      return parseFactor();
    }
    if (src[pos] === '-') {
      pos += 1;
      return -parseFactor();
    }
    if (src[pos] === '(') {
      pos += 1;
      const inner = parseExpr();
      if (src[pos] === ')') pos += 1;
      return inner;
    }
    const match = /^\d+(\.\d+)?/.exec(src.slice(pos));
    if (!match) return NaN;
    pos += match[0].length;
    return parseFloat(match[0]);
  };

  if (!src) return 0;
  const result = parseExpr();
  return pos === src.length ? result : NaN;
}

function evaluateCellValue(
  coord: string,
  cells: SheetCellsMap,
  visited = new Set<string>()
): { display: string; num: number | null; error?: string } {
  const cell = cells[coord];
  if (!cell || cell.raw === '') return { display: '', num: null };
  const raw = cell.raw.trim();

  if (!raw.startsWith('=')) {
    const asNum = Number(raw);
    if (!Number.isNaN(asNum) && raw !== '') {
      return { display: formatNumberDisplay(asNum, cell.format), num: asNum };
    }
    return { display: raw, num: null };
  }

  if (visited.has(coord)) {
    return { display: '#REF!', num: null, error: '#REF!' };
  }
  const nextVisited = new Set(visited);
  nextVisited.add(coord);

  let formula = raw.slice(1).trim().toUpperCase();

  // Resolve SUM/AVERAGE/AVG/MIN/MAX/COUNT functions
  formula = formula.replace(
    /\b(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(([^()]+)\)/g,
    (_, fnName: string, argsStr: string) => {
      const nums: number[] = [];
      const parts = argsStr.split(',').map((p) => p.trim());
      for (const part of parts) {
        if (part.includes(':')) {
          const [a, b] = part.split(':');
          for (const cRef of expandCellRange(a.trim(), b.trim())) {
            const ev = evaluateCellValue(cRef, cells, nextVisited);
            if (ev.num !== null && Number.isFinite(ev.num)) nums.push(ev.num);
          }
        } else if (/^[A-H]\d{1,2}$/.test(part)) {
          const ev = evaluateCellValue(part, cells, nextVisited);
          if (ev.num !== null && Number.isFinite(ev.num)) nums.push(ev.num);
        } else {
          const n = Number(part);
          if (!Number.isNaN(n)) nums.push(n);
        }
      }
      if (fnName === 'COUNT') return String(nums.length);
      if (nums.length === 0) return '0';
      if (fnName === 'SUM') return String(nums.reduce((a, b) => a + b, 0));
      if (fnName === 'AVERAGE' || fnName === 'AVG') {
        return String(nums.reduce((a, b) => a + b, 0) / nums.length);
      }
      if (fnName === 'MIN') return String(Math.min(...nums));
      if (fnName === 'MAX') return String(Math.max(...nums));
      return '0';
    }
  );

  // Replace remaining cell coordinates (e.g. B2 * C2)
  formula = formula.replace(/\b([A-H]\d{1,2})\b/g, (ref) => {
    const ev = evaluateCellValue(ref, cells, nextVisited);
    if (ev.error) return 'NaN';
    return ev.num !== null ? String(ev.num) : '0';
  });

  const val = evalArithmeticExpr(formula);
  if (!Number.isFinite(val)) {
    return { display: '#ERR', num: null, error: '#ERR' };
  }
  const rounded = Math.round(val * 100) / 100;
  return { display: formatNumberDisplay(rounded, cell.format), num: rounded };
}

function formatNumberDisplay(n: number, fmt?: CellFormatType): string {
  if (fmt === 'currency') {
    return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
  }
  if (fmt === 'percent') {
    return `${(n * 100).toFixed(0)}%`;
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// --- Built-In Starter Content & Templates ---
const DOC_TEMPLATES: { id: string; labelId: string; labelEn: string; title: string; html: string }[] = [
  {
    id: 'meeting',
    labelId: 'Catatan Rapat',
    labelEn: 'Meeting Notes',
    title: 'Catatan_Rapat',
    html: `<h1>Notulensi Rapat Mingguan</h1><p><b>Tanggal:</b> Hari Ini &nbsp;|&nbsp; <b>Peserta:</b> Tim Inti</p><h2>Agenda Pembahasan</h2><ul><li>Evaluasi pencapaian sprint minggu ini</li><li>Penetapan prioritas fitur baru</li><li>Pembagian tugas dan jadwal rilis</li></ul><h2>Tindak Lanjut</h2><p>Seluruh tugas utama ditargetkan selesai sebelum akhir pekan.</p>`,
  },
  {
    id: 'letter',
    labelId: 'Surat Resmi',
    labelEn: 'Formal Letter',
    title: 'Surat_Undangan',
    html: `<h1>Surat Pemberitahuan</h1><p>Kepada Yth. Rekan Kerja,</p><p>Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri sesi diskusi proyek bersama yang akan dilaksanakan secara daring.</p><ul><li>Waktu: 10:00 WIB</li><li>Topik: Review &amp; Finalisasi Dokumen</li></ul><p>Terima kasih atas perhatian dan kerja samanya.</p>`,
  },
  {
    id: 'report',
    labelId: 'Laporan Proyek',
    labelEn: 'Project Brief',
    title: 'Laporan_Proyek',
    html: `<h1>Ringkasan Laporan Proyek</h1><p>Dokumen ini disusun menggunakan <b>Elixir Office</b> secara luring dan aman.</p><h2>1. Status Kemajuan</h2><p>Tahap pengembangan antarmuka dan integrasi data telah berjalan sesuai rencana tanpa kendala.</p><h2>2. Langkah Berikutnya</h2><p>Melakukan uji coba akhir serta dokumentasi pengguna.</p>`,
  },
];

const SHEET_TEMPLATES: { id: string; labelId: string; labelEn: string; title: string; cells: SheetCellsMap }[] = [
  {
    id: 'budget',
    labelId: 'Anggaran Bulanan',
    labelEn: 'Monthly Budget',
    title: 'Anggaran_Bulanan',
    cells: {
      A1: { raw: 'Pos Pengeluaran', bold: true },
      B1: { raw: 'Anggaran', bold: true, align: 'right' },
      C1: { raw: 'Realisasi', bold: true, align: 'right' },
      D1: { raw: 'Sisa', bold: true, align: 'right' },
      A2: { raw: 'Makan & Minum' },
      B2: { raw: '1500000', format: 'currency', align: 'right' },
      C2: { raw: '1250000', format: 'currency', align: 'right' },
      D2: { raw: '=B2-C2', format: 'currency', align: 'right' },
      A3: { raw: 'Transportasi' },
      B3: { raw: '600000', format: 'currency', align: 'right' },
      C3: { raw: '480000', format: 'currency', align: 'right' },
      D3: { raw: '=B3-C3', format: 'currency', align: 'right' },
      A4: { raw: 'Internet & Paket' },
      B4: { raw: '350000', format: 'currency', align: 'right' },
      C4: { raw: '350000', format: 'currency', align: 'right' },
      D4: { raw: '=B4-C4', format: 'currency', align: 'right' },
      A5: { raw: 'Tabungan' },
      B5: { raw: '1000000', format: 'currency', align: 'right' },
      C5: { raw: '1000000', format: 'currency', align: 'right' },
      D5: { raw: '=B5-C5', format: 'currency', align: 'right' },
      A6: { raw: 'TOTAL', bold: true },
      B6: { raw: '=SUM(B2:B5)', bold: true, format: 'currency', align: 'right' },
      C6: { raw: '=SUM(C2:C5)', bold: true, format: 'currency', align: 'right' },
      D6: { raw: '=SUM(D2:D5)', bold: true, format: 'currency', align: 'right' },
    },
  },
  {
    id: 'shopping',
    labelId: 'Daftar Belanja',
    labelEn: 'Shopping List',
    title: 'Daftar_Belanja',
    cells: {
      A1: { raw: 'Barang', bold: true },
      B1: { raw: 'Qty', bold: true, align: 'right' },
      C1: { raw: 'Harga', bold: true, align: 'right' },
      D1: { raw: 'Subtotal', bold: true, align: 'right' },
      A2: { raw: 'Kertas A4' },
      B2: { raw: '2', align: 'right' },
      C2: { raw: '45000', format: 'currency', align: 'right' },
      D2: { raw: '=B2*C2', format: 'currency', align: 'right' },
      A3: { raw: 'Tinta Hitam' },
      B3: { raw: '1', align: 'right' },
      C3: { raw: '85000', format: 'currency', align: 'right' },
      D3: { raw: '=B3*C3', format: 'currency', align: 'right' },
      A4: { raw: 'Map Dokumen' },
      B4: { raw: '5', align: 'right' },
      C4: { raw: '6000', format: 'currency', align: 'right' },
      D4: { raw: '=B4*C4', format: 'currency', align: 'right' },
      A5: { raw: 'TOTAL', bold: true },
      D5: { raw: '=SUM(D2:D4)', bold: true, format: 'currency', align: 'right' },
    },
  },
  {
    id: 'empty',
    labelId: 'Lembar Kosong',
    labelEn: 'Blank Sheet',
    title: 'Spreadsheet_Baru',
    cells: {},
  },
];

const DEFAULT_SLIDES: OfficeSlide[] = [
  {
    id: 's-1',
    title: 'Elixir Office Suite',
    body: 'Produktivitas Dokumen, Spreadsheet & Presentasi\n100% Luring · Antarmuka Ribbon Familiar',
    layout: 'title',
    theme: 'lcd',
  },
  {
    id: 's-2',
    title: 'Keunggulan Utama',
    body: '• Editor Dokumen kaya format (Word-style)\n• Kalkulasi rumus Spreadsheet (=SUM, =AVG)\n• Mode Presentasi penuh langsung di perangkat',
    layout: 'bullets',
    theme: 'paper',
  },
  {
    id: 's-3',
    title: 'Privasi & Portabilitas',
    body: 'Penyimpanan Lokal\nTersimpan di folder Dokumen OS tanpa pelacakan awan.',
    bodyRight: 'Ekspor Terbuka\nMendukung ekspor .DOC, .CSV, dan .HTML siap bagikan.',
    layout: 'two-col',
    theme: 'ink',
  },
];

export const ElixirOfficeApp: React.FC<AppComponentProps> = ({ params, onBack }) => {
  const language = useOSStore((s) => s.language);
  const setSoftkeys = useOSStore((s) => s.setSoftkeys);
  const showToast = useOSStore((s) => s.showToast);

  const writerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [activeModule, setActiveModule] = useState<OfficeModule>('docs');
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('home');
  const [openFileModal, setOpenFileModal] = useState(false);
  const [osDocFiles, setOsDocFiles] = useState<VirtualFileRecord[]>([]);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);

  // --- DOCS (WRITER) STATE ---
  const [docTitle, setDocTitle] = useState('Dokumen_Baru');
  const [docHtml, setDocHtml] = useState<string>(DOC_TEMPLATES[0].html);
  const [docPaperLight, setDocPaperLight] = useState(true);
  const [docStats, setDocStats] = useState(() => countWordsAndChars(DOC_TEMPLATES[0].html));
  const pendingSyncDocRef = useRef(true);

  // --- SPREADSHEET (CALC) STATE ---
  const [sheetTitle, setSheetTitle] = useState('Anggaran_Bulanan');
  const [cells, setCells] = useState<SheetCellsMap>(SHEET_TEMPLATES[0].cells);
  const [activeCell, setActiveCell] = useState<string>('D6');
  const [formulaInput, setFormulaInput] = useState<string>(SHEET_TEMPLATES[0].cells.D6?.raw ?? '');

  // --- PRESENTATION (SLIDES) STATE ---
  const [deckTitle, setDeckTitle] = useState('Presentasi_Elixir');
  const [slides, setSlides] = useState<OfficeSlide[]>(DEFAULT_SLIDES);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [presenting, setPresenting] = useState(false);

  // Sync writer contentEditable only when loading external content / switching tabs back to docs
  useEffect(() => {
    if (activeModule === 'docs' && writerRef.current && pendingSyncDocRef.current) {
      writerRef.current.innerHTML = docHtml;
      pendingSyncDocRef.current = false;
    }
  }, [activeModule, docHtml]);

  const loadOsDocFiles = useCallback(async () => {
    const all = await db.files
      .filter((f) => f.folder === 'Dokumen' || f.folder === 'Download')
      .reverse()
      .toArray();
    setOsDocFiles(all);
  }, []);

  const loadRecordIntoOffice = useCallback(
    async (file: VirtualFileRecord, rawBuffer?: ArrayBuffer) => {
      const kind = getOfficeFileKind(file.name, file.mimeType);
      const baseName = file.name
        .replace(/\.(docx|doc|xlsx|xls|pptx|csv|tsv|txt|md|html|htm)$/i, '')
        .replace(/\.elxslides\.json$|\.slides\.json$/i, '');

      try {
        if (kind === 'docx') {
          setBusyStatus(
            language === 'id' ? `Membuka ${file.name}...` : `Opening ${file.name}...`
          );
          const buf =
            rawBuffer ??
            (file.content.startsWith('data:')
              ? dataUrlToArrayBuffer(file.content)
              : new TextEncoder().encode(file.content).buffer);
          const html = await parseDocxBufferToHtml(buf);
          setDocTitle(baseName || 'Dokumen_Word');
          setDocHtml(html);
          setDocStats(countWordsAndChars(html));
          pendingSyncDocRef.current = true;
          setActiveModule('docs');
        } else if (kind === 'doc') {
          if (rawBuffer || file.content.startsWith('data:')) {
            setBusyStatus(
              language === 'id' ? `Membuka ${file.name}...` : `Opening ${file.name}...`
            );
            const buf = rawBuffer ?? dataUrlToArrayBuffer(file.content);
            const html = await parseDocxBufferToHtml(buf);
            setDocTitle(baseName || 'Dokumen_Word');
            setDocHtml(html);
            setDocStats(countWordsAndChars(html));
            pendingSyncDocRef.current = true;
            setActiveModule('docs');
          } else {
            const isHtml = /<[a-z][\s\S]*>/i.test(file.content);
            const safe = isHtml
              ? stripDangerousHtml(file.content)
              : file.content
                  .split(/\r?\n/)
                  .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br/></p>'))
                  .join('');
            setDocTitle(baseName || 'Dokumen');
            setDocHtml(safe);
            setDocStats(countWordsAndChars(safe));
            pendingSyncDocRef.current = true;
            setActiveModule('docs');
          }
        } else if (kind === 'xlsx') {
          setBusyStatus(
            language === 'id' ? `Membuka ${file.name}...` : `Opening ${file.name}...`
          );
          const buf =
            rawBuffer ??
            (file.content.startsWith('data:')
              ? dataUrlToArrayBuffer(file.content)
              : new TextEncoder().encode(file.content).buffer);
          const parsed = await parseXlsxBufferToCells(buf);
          setSheetTitle(baseName || parsed.sheetTitle || 'Spreadsheet');
          setCells(parsed.cells);
          setActiveCell('A1');
          setFormulaInput(parsed.cells.A1?.raw ?? '');
          setActiveModule('sheets');
        } else if (kind === 'pptx') {
          setBusyStatus(
            language === 'id' ? `Membuka ${file.name}...` : `Opening ${file.name}...`
          );
          const buf =
            rawBuffer ??
            (file.content.startsWith('data:')
              ? dataUrlToArrayBuffer(file.content)
              : new TextEncoder().encode(file.content).buffer);
          const importedSlides = await parsePptxBufferToSlides(buf);
          setDeckTitle(baseName || 'Presentasi');
          setSlides(importedSlides);
          setActiveSlideIdx(0);
          setActiveModule('slides');
        } else if (kind === 'csv') {
          const delim = file.name.toLowerCase().endsWith('.tsv') ? '\t' : ',';
          const lines = file.content.split(/\r?\n/).filter((l) => l.length > 0);
          const nextCells: SheetCellsMap = {};
          lines.slice(0, ROW_COUNT).forEach((line, rIdx) => {
            const cols = line.split(delim);
            cols.slice(0, COLS.length).forEach((rawCell, cIdx) => {
              const clean = rawCell.replace(/^"|"$/g, '').trim();
              if (clean) {
                const coord = `${COLS[cIdx]}${rIdx + 1}`;
                const isNum = !Number.isNaN(Number(clean)) && clean !== '';
                nextCells[coord] = {
                  raw: clean,
                  bold: rIdx === 0,
                  align: isNum || clean.startsWith('=') ? 'right' : 'left',
                };
              }
            });
          });
          setSheetTitle(baseName || 'Spreadsheet');
          setCells(nextCells);
          setActiveCell('A1');
          setFormulaInput(nextCells.A1?.raw ?? '');
          setActiveModule('sheets');
        } else if (kind === 'slides') {
          const parsed = JSON.parse(file.content);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSlides(parsed);
            setDeckTitle(baseName || 'Presentasi');
            setActiveSlideIdx(0);
            setActiveModule('slides');
          }
        } else {
          if (file.content.startsWith('data:')) {
            showToast(
              language === 'id'
                ? 'Format biner ini belum didukung untuk disunting langsung'
                : 'Binary format cannot be edited directly'
            );
            return;
          }
          const isHtml = /<[a-z][\s\S]*>/i.test(file.content);
          const safe = isHtml
            ? stripDangerousHtml(file.content)
            : file.content
                .split(/\r?\n/)
                .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br/></p>'))
                .join('');
          setDocTitle(baseName || 'Dokumen');
          setDocHtml(safe);
          setDocStats(countWordsAndChars(safe));
          pendingSyncDocRef.current = true;
          setActiveModule('docs');
        }
        setOpenFileModal(false);
        soundEngine.playCue('select');
        showToast(
          language === 'id' ? `Dimuat: ${file.name}` : `Loaded: ${file.name}`
        );
      } catch (err) {
        soundEngine.playCue('error');
        const detail =
          err instanceof OfficeReadError
            ? err.message
            : language === 'id'
              ? `Gagal membaca ${file.name}. Pastikan berkas tidak rusak.`
              : `Failed to parse ${file.name}`;
        showToast(detail);
      } finally {
        setBusyStatus(null);
      }
    },
    [language, showToast]
  );

  // Load requested fileId from FileManager / Notes if provided
  useEffect(() => {
    let active = true;
    db.files
      .filter((f) => f.folder === 'Dokumen' || f.folder === 'Download')
      .reverse()
      .toArray()
      .then((all) => {
        if (active) setOsDocFiles(all);
      });
    if (typeof params?.fileId === 'number') {
      db.files.get(params.fileId).then((rec) => {
        if (active && rec) {
          loadRecordIntoOffice(rec);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [loadRecordIntoOffice, params?.fileId]);

  // --- DOCS COMMANDS ---
  const execDocCmd = (cmd: string, value?: string) => {
    if (!writerRef.current) return;
    writerRef.current.focus();
    document.execCommand(cmd, false, value);
    const updated = writerRef.current.innerHTML;
    setDocHtml(updated);
    setDocStats(countWordsAndChars(updated));
    soundEngine.playCue('click');
  };

  const insertDocSnippet = (htmlSnippet: string) => {
    if (!writerRef.current) return;
    writerRef.current.focus();
    document.execCommand('insertHTML', false, htmlSnippet);
    const updated = writerRef.current.innerHTML;
    setDocHtml(updated);
    setDocStats(countWordsAndChars(updated));
    soundEngine.playCue('select');
  };

  const applyDocTemplate = (tplId: string) => {
    const tpl = DOC_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setDocTitle(tpl.title);
    setDocHtml(tpl.html);
    setDocStats(countWordsAndChars(tpl.html));
    pendingSyncDocRef.current = true;
    soundEngine.playCue('select');
    showToast(language === 'id' ? `Templat "${tpl.labelId}" dimuat` : `Loaded "${tpl.labelEn}"`);
  };

  // --- SAVE & EXPORT TO OS / DEVICE ---
  const saveCurrentToOS = useCallback(async () => {
    try {
      if (activeModule === 'docs') {
        const currentHtml = writerRef.current ? writerRef.current.innerHTML : docHtml;
        const cleanTitle = docTitle.trim() || 'Dokumen';
        const safeName = `${cleanTitle}.docx`;
        setBusyStatus(
          language === 'id' ? `Menyimpan ${safeName}...` : `Saving ${safeName}...`
        );
        const blob = await buildDocxBlobFromHtml(cleanTitle, currentHtml);
        const dataUrl = await blobToDataUrl(blob);
        const existing = await db.files
          .where('folder')
          .equals('Dokumen')
          .filter((f) => f.name === safeName)
          .first();
        const kb = Math.max(1, Math.ceil(blob.size / 1024));
        if (existing?.id) {
          await db.files.update(existing.id, {
            content: dataUrl,
            mimeType: MIME_DOCX,
            sizeKb: kb,
            createdAt: Date.now(),
          });
        } else {
          await db.files.add({
            folder: 'Dokumen',
            name: safeName,
            mimeType: MIME_DOCX,
            sizeKb: kb,
            content: dataUrl,
            createdAt: Date.now(),
          });
        }
        showToast(language === 'id' ? `Disimpan: Dokumen/${safeName}` : `Saved: ${safeName}`);
      } else if (activeModule === 'sheets') {
        const cleanTitle = sheetTitle.trim() || 'Spreadsheet';
        const safeName = `${cleanTitle}.xlsx`;
        setBusyStatus(
          language === 'id' ? `Menyimpan ${safeName}...` : `Saving ${safeName}...`
        );
        const blob = await buildXlsxBlobFromCells(cleanTitle, cells, evaluateCellValue);
        const dataUrl = await blobToDataUrl(blob);
        const existing = await db.files
          .where('folder')
          .equals('Dokumen')
          .filter((f) => f.name === safeName)
          .first();
        const kb = Math.max(1, Math.ceil(blob.size / 1024));
        if (existing?.id) {
          await db.files.update(existing.id, {
            content: dataUrl,
            mimeType: MIME_XLSX,
            sizeKb: kb,
            createdAt: Date.now(),
          });
        } else {
          await db.files.add({
            folder: 'Dokumen',
            name: safeName,
            mimeType: MIME_XLSX,
            sizeKb: kb,
            content: dataUrl,
            createdAt: Date.now(),
          });
        }
        showToast(language === 'id' ? `Disimpan: Dokumen/${safeName}` : `Saved: ${safeName}`);
      } else {
        const cleanTitle = deckTitle.trim() || 'Presentasi';
        const safeName = `${cleanTitle}.pptx`;
        setBusyStatus(
          language === 'id' ? `Menyimpan ${safeName}...` : `Saving ${safeName}...`
        );
        const blob = await buildPptxBlobFromSlides(cleanTitle, slides);
        const dataUrl = await blobToDataUrl(blob);
        const existing = await db.files
          .where('folder')
          .equals('Dokumen')
          .filter((f) => f.name === safeName)
          .first();
        const kb = Math.max(1, Math.ceil(blob.size / 1024));
        if (existing?.id) {
          await db.files.update(existing.id, {
            content: dataUrl,
            mimeType: MIME_PPTX,
            sizeKb: kb,
            createdAt: Date.now(),
          });
        } else {
          await db.files.add({
            folder: 'Dokumen',
            name: safeName,
            mimeType: MIME_PPTX,
            sizeKb: kb,
            content: dataUrl,
            createdAt: Date.now(),
          });
        }
        showToast(language === 'id' ? `Disimpan: Dokumen/${safeName}` : `Saved: ${safeName}`);
      }
      soundEngine.playCue('select');
      loadOsDocFiles();
    } catch {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Gagal menyimpan berkas' : 'Failed to save file');
    } finally {
      setBusyStatus(null);
    }
  }, [activeModule, cells, deckTitle, docHtml, docTitle, language, loadOsDocFiles, sheetTitle, showToast, slides]);

  const exportToDevice = async (variant: 'docx' | 'doc' | 'txt' | 'xlsx' | 'csv' | 'pptx' | 'html') => {
    try {
      let blob: Blob;
      let filename = 'ElixirOffice.txt';

      if (variant === 'docx') {
        const currentHtml = writerRef.current ? writerRef.current.innerHTML : docHtml;
        const cleanTitle = docTitle.trim() || 'Dokumen';
        filename = `${cleanTitle}.docx`;
        setBusyStatus(language === 'id' ? `Membuat ${filename}...` : `Building ${filename}...`);
        blob = await buildDocxBlobFromHtml(cleanTitle, currentHtml);
      } else if (variant === 'xlsx') {
        const cleanTitle = sheetTitle.trim() || 'Spreadsheet';
        filename = `${cleanTitle}.xlsx`;
        setBusyStatus(language === 'id' ? `Membuat ${filename}...` : `Building ${filename}...`);
        blob = await buildXlsxBlobFromCells(cleanTitle, cells, evaluateCellValue);
      } else if (variant === 'pptx') {
        const cleanTitle = deckTitle.trim() || 'Presentasi';
        filename = `${cleanTitle}.pptx`;
        setBusyStatus(language === 'id' ? `Membuat ${filename}...` : `Building ${filename}...`);
        blob = await buildPptxBlobFromSlides(cleanTitle, slides);
      } else if (activeModule === 'docs') {
        const currentHtml = writerRef.current ? writerRef.current.innerHTML : docHtml;
        if (variant === 'doc') {
          filename = `${docTitle || 'Dokumen'}.doc`;
          const content = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title></head><body>${currentHtml}</body></html>`;
          blob = new Blob([content], { type: 'application/msword;charset=utf-8' });
        } else {
          filename = `${docTitle || 'Dokumen'}.txt`;
          const content = currentHtml
            .replace(/<\/(p|h1|h2|h3|li|tr)>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
          blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        }
      } else if (activeModule === 'sheets') {
        filename = `${sheetTitle || 'Spreadsheet'}.csv`;
        const outRows: string[] = [];
        for (let r = 1; r <= ROW_COUNT; r += 1) {
          outRows.push(
            COLS.map((c) => {
              const ev = evaluateCellValue(`${c}${r}`, cells).display;
              return ev.includes(',') ? `"${ev}"` : ev;
            }).join(',')
          );
        }
        blob = new Blob([outRows.join('\n').trimEnd()], { type: 'text/csv;charset=utf-8' });
      } else {
        filename = `${deckTitle || 'Presentasi'}.html`;
        const content = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deckTitle)}</title><style>body{font-family:monospace;background:#111;color:#d8ff9a;margin:0;padding:24px;}section{border:2px solid #d8ff9a;padding:24px;margin:0 auto 24px;max-width:720px;}</style></head><body>${slides
          .map(
            (s, i) =>
              `<section><h2>${i + 1}. ${escapeHtml(s.title)}</h2><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(s.body)}${s.bodyRight ? `\n\n${escapeHtml(s.bodyRight)}` : ''}</pre></section>`
          )
          .join('')}</body></html>`;
        blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      soundEngine.playCue('select');
      showToast(language === 'id' ? `Diekspor: ${filename}` : `Exported: ${filename}`);
    } catch {
      soundEngine.playCue('error');
      showToast(language === 'id' ? 'Gagal mengekspor berkas' : 'Export failed');
    } finally {
      setBusyStatus(null);
    }
  };

  const handleDeviceImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = getOfficeFileKind(file.name, file.type);
    const isBinaryOffice =
      kind === 'docx' || kind === 'doc' || kind === 'xlsx' || kind === 'pptx';
    const rawBuf = isBinaryOffice ? await file.arrayBuffer() : undefined;
    const content = isBinaryOffice ? '' : await file.text();
    await loadRecordIntoOffice(
      {
        folder: 'Dokumen',
        name: file.name,
        mimeType:
          file.type ||
          (kind === 'docx'
            ? MIME_DOCX
            : kind === 'xlsx'
              ? MIME_XLSX
              : kind === 'pptx'
                ? MIME_PPTX
                : 'text/plain'),
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        content,
        createdAt: Date.now(),
      },
      rawBuf
    );
    e.target.value = '';
  };

  // --- SPREADSHEET HANDLERS ---
  const commitCellRaw = (coord: string, rawVal: string) => {
    setCells((prev) => {
      const existing = prev[coord] ?? { raw: '' };
      return {
        ...prev,
        [coord]: { ...existing, raw: rawVal },
      };
    });
  };

  const updateCellStyle = (patch: Partial<SheetCellData>) => {
    setCells((prev) => {
      const existing = prev[activeCell] ?? { raw: '' };
      return {
        ...prev,
        [activeCell]: { ...existing, ...patch },
      };
    });
    soundEngine.playCue('click');
  };

  const insertFormulaHelper = (fn: 'SUM' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT') => {
    const m = /^([A-H])(\d{1,2})$/.exec(activeCell);
    const col = m?.[1] ?? 'B';
    const row = m ? parseInt(m[2], 10) : 6;
    const endRow = Math.max(2, row - 1);
    const expr = `=${fn}(${col}2:${col}${endRow})`;
    setFormulaInput(expr);
    commitCellRaw(activeCell, expr);
    soundEngine.playCue('select');
  };

  const activeCellEvaluated = useMemo(
    () => evaluateCellValue(activeCell, cells),
    [activeCell, cells]
  );

  // --- SLIDE HANDLERS ---
  const currentSlide = slides[activeSlideIdx] ?? slides[0];

  const updateCurrentSlide = (patch: Partial<OfficeSlide>) => {
    setSlides((prev) => prev.map((s, idx) => (idx === activeSlideIdx ? { ...s, ...patch } : s)));
  };

  const addNewSlide = () => {
    const nextSlide: OfficeSlide = {
      id: nextOfficeId('sl'),
      title: `Slide ${slides.length + 1}`,
      body: '• Poin penting pertama\n• Poin penting kedua',
      layout: 'bullets',
      theme: currentSlide?.theme ?? 'lcd',
    };
    const insertAt = activeSlideIdx + 1;
    setSlides((prev) => [...prev.slice(0, insertAt), nextSlide, ...prev.slice(insertAt)]);
    setActiveSlideIdx(insertAt);
    soundEngine.playCue('select');
  };

  const duplicateCurrentSlide = () => {
    if (!currentSlide) return;
    const copy: OfficeSlide = {
      ...currentSlide,
      id: nextOfficeId('sl'),
      title: `${currentSlide.title} (Salin)`,
    };
    const insertAt = activeSlideIdx + 1;
    setSlides((prev) => [...prev.slice(0, insertAt), copy, ...prev.slice(insertAt)]);
    setActiveSlideIdx(insertAt);
    soundEngine.playCue('select');
  };

  const deleteCurrentSlide = () => {
    if (slides.length <= 1) {
      showToast(language === 'id' ? 'Minimal harus ada 1 slide' : 'Need at least 1 slide');
      return;
    }
    setSlides((prev) => prev.filter((_, idx) => idx !== activeSlideIdx));
    setActiveSlideIdx((i) => Math.max(0, i - 1));
    soundEngine.playCue('back');
  };

  const moveCurrentSlide = (dir: -1 | 1) => {
    const target = activeSlideIdx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[activeSlideIdx], next[target]] = [next[target], next[activeSlideIdx]];
      return next;
    });
    setActiveSlideIdx(target);
    soundEngine.playCue('click');
  };

  useEffect(() => {
    if (presenting) {
      setSoftkeys({
        leftLabel: '◀ Prev',
        centerLabel: `${activeSlideIdx + 1}/${slides.length}`,
        rightLabel: language === 'id' ? 'Keluar' : 'Exit',
        onLeft: () => setActiveSlideIdx((i) => Math.max(0, i - 1)),
        onCenter: () => setActiveSlideIdx((i) => (i + 1) % slides.length),
        onRight: () => setPresenting(false),
      });
    } else {
      setSoftkeys({
        leftLabel: language === 'id' ? 'Buka' : 'Open',
        centerLabel: language === 'id' ? 'Simpan' : 'Save',
        rightLabel: language === 'id' ? 'Kembali' : 'Back',
        onLeft: () => {
          loadOsDocFiles();
          setOpenFileModal(true);
        },
        onCenter: () => void saveCurrentToOS(),
        onRight: onBack,
      });
    }
  });

  const slideThemeClass: Record<SlideTheme, string> = {
    lcd: 'bg-[#D8FF9A] text-[#0b1305] border-[#0b1305]',
    ink: 'bg-[#0b1120] text-[#f8fafc] border-[#38bdf8]',
    paper: 'bg-[#faf8f5] text-[#111827] border-[#111827]',
    blueprint: 'bg-[#0f294a] text-[#e0f2fe] border-[#7dd3fc]',
  };

  // --- FULLSCREEN PRESENTATION MODE ---
  if (presenting && currentSlide) {
    return (
      <div className="flex flex-col h-full bg-[#070b14] text-[#f8fafc]">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/20 text-[10px] font-bold">
          <span className="truncate">{deckTitle}</span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Slide {activeSlideIdx + 1} / {slides.length}
            </span>
            <button
              type="button"
              onClick={() => setPresenting(false)}
              className="px-2 py-0.5 border border-white/60 bg-white/10 cursor-pointer"
            >
              {language === 'id' ? 'Keluar ×' : 'Exit ×'}
            </button>
          </div>
        </div>

        <div className="flex-1 p-3 flex items-center justify-center min-h-0">
          <div
            className={`w-full h-full border-2 p-4 flex flex-col justify-center gap-3 overflow-y-auto ${
              slideThemeClass[currentSlide.theme]
            }`}
          >
            <h2
              className={`font-bold leading-tight text-balance ${
                currentSlide.layout === 'title' ? 'text-xl sm:text-2xl text-center' : 'text-base sm:text-lg border-b border-current/30 pb-1.5'
              }`}
            >
              {currentSlide.title}
            </h2>

            {currentSlide.layout === 'two-col' ? (
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm leading-relaxed">
                <p className="whitespace-pre-wrap">{currentSlide.body}</p>
                <p className="whitespace-pre-wrap border-l border-current/30 pl-3">{currentSlide.bodyRight || ''}</p>
              </div>
            ) : (
              <p
                className={`whitespace-pre-wrap leading-relaxed ${
                  currentSlide.layout === 'title' ? 'text-xs sm:text-sm text-center opacity-85' : 'text-xs sm:text-sm'
                }`}
              >
                {currentSlide.body}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-white/20 bg-black/50 text-xs font-bold">
          <button
            type="button"
            disabled={activeSlideIdx === 0}
            onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
            className="px-3 py-1 border border-white/60 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{language === 'id' ? 'Sebelumnya' : 'Prev'}</span>
          </button>
          <button
            type="button"
            disabled={activeSlideIdx >= slides.length - 1}
            onClick={() => setActiveSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
            className="px-3 py-1 border border-white/60 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
          >
            <span>{language === 'id' ? 'Berikutnya' : 'Next'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--lcd-bg)] text-[var(--lcd-fg)]">
      <AppHeader title="Elixir Office" showChevrons={false} />

      <input
        ref={importInputRef}
        type="file"
        accept=".docx,.doc,.xlsx,.xls,.pptx,.txt,.md,.html,.htm,.csv,.tsv,.json"
        onChange={handleDeviceImport}
        className="hidden"
      />

      {/* Office Suite Switcher Bar (Docs / Sheets / Slides) + File Name + Save */}
      <div className="flex items-center justify-between gap-1 px-1.5 py-1 border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-sec)] shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          {(
            [
              { id: 'docs', label: 'Dokumen', icon: FileText },
              { id: 'sheets', label: 'Tabel', icon: FileSpreadsheet },
              { id: 'slides', label: 'Slide', icon: Presentation },
            ] as const
          ).map((mod) => {
            const Icon = mod.icon;
            const active = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  if (activeModule === 'docs' && writerRef.current) {
                    setDocHtml(writerRef.current.innerHTML);
                  }
                  if (mod.id === 'docs') pendingSyncDocRef.current = true;
                  setActiveModule(mod.id);
                  setRibbonTab('home');
                }}
                className={`px-1.5 py-1 border border-[var(--lcd-fg)] text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  active ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={activeModule === 'docs' ? docTitle : activeModule === 'sheets' ? sheetTitle : deckTitle}
          onChange={(e) => {
            if (activeModule === 'docs') setDocTitle(e.target.value);
            else if (activeModule === 'sheets') setSheetTitle(e.target.value);
            else setDeckTitle(e.target.value);
          }}
          aria-label="Document Name"
          className="min-w-0 flex-1 bg-[var(--lcd-bg)] border border-[var(--lcd-fg)] px-1.5 py-0.5 text-[10px] font-bold outline-none"
        />

        <button
          type="button"
          onClick={() => void saveCurrentToOS()}
          title={language === 'id' ? 'Simpan ke Dokumen OS' : 'Save to OS Documents'}
          className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Save className="w-3 h-3" />
          <span className="hidden sm:inline">Simpan</span>
        </button>
      </div>

      {/* ElixirOffice Signature Ribbon Strip */}
      <div className="border-b-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0">
        {/* Ribbon Tabs */}
        <div className="flex items-center justify-between px-1.5 pt-1 border-b border-[var(--lcd-fg)]/40 text-[10px] font-bold">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'home', label: language === 'id' ? 'Beranda' : 'Home' },
                {
                  id: 'insert',
                  label:
                    activeModule === 'sheets'
                      ? language === 'id'
                        ? 'Rumus'
                        : 'Formulas'
                      : activeModule === 'slides'
                        ? language === 'id'
                          ? 'Desain'
                          : 'Design'
                        : language === 'id'
                          ? 'Sisipkan'
                          : 'Insert',
                },
                { id: 'file', label: language === 'id' ? 'Berkas' : 'File' },
                { id: 'template', label: language === 'id' ? 'Templat' : 'Templates' },
              ] as const
            ).map((rt) => (
              <button
                key={rt.id}
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  setRibbonTab(rt.id);
                }}
                className={`px-2 py-0.5 border-t border-x border-[var(--lcd-fg)] cursor-pointer whitespace-nowrap ${
                  ribbonTab === rt.id
                    ? 'bg-[var(--lcd-sec)] font-bold -mb-[1px] pb-[3px]'
                    : 'bg-[var(--lcd-bg)] opacity-75 hover:opacity-100'
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>

          {activeModule === 'slides' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playCue('open');
                setPresenting(true);
              }}
              className="px-2 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold flex items-center gap-1 mb-0.5 cursor-pointer shrink-0"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Tayang</span>
            </button>
          )}
        </div>

        {/* Ribbon Command Toolbar */}
        <div className="bg-[var(--lcd-sec)] px-1.5 py-1 flex items-center gap-1 overflow-x-auto lcd-scroll text-[10px] font-bold">
          {/* FILE TAB (Shared across Docs / Sheets / Slides) */}
          {ribbonTab === 'file' && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (activeModule === 'docs') {
                    setDocTitle('Dokumen_Baru');
                    const blank = '<p>Mulai mengetik dokumen Anda di sini...</p>';
                    setDocHtml(blank);
                    setDocStats(countWordsAndChars(blank));
                    pendingSyncDocRef.current = true;
                  } else if (activeModule === 'sheets') {
                    setSheetTitle('Spreadsheet_Baru');
                    setCells({});
                    setFormulaInput('');
                  } else {
                    setDeckTitle('Presentasi_Baru');
                    setSlides([
                      {
                        id: nextOfficeId('sl'),
                        title: 'Judul Presentasi',
                        body: 'Subjudul atau ringkasan singkat',
                        layout: 'title',
                        theme: 'lcd',
                      },
                    ]);
                    setActiveSlideIdx(0);
                  }
                  soundEngine.playCue('click');
                }}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <FilePlus2 className="w-3 h-3" />
                <span>Baru</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  loadOsDocFiles();
                  setOpenFileModal(true);
                }}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <FolderOpen className="w-3 h-3" />
                <span>Buka OS</span>
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Impor</span>
              </button>
              {activeModule === 'docs' && (
                <>
                  <button
                    type="button"
                    onClick={() => void exportToDevice('docx')}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Ekspor .DOCX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportToDevice('doc')}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    .DOC
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportToDevice('txt')}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    .TXT
                  </button>
                </>
              )}
              {activeModule === 'sheets' && (
                <>
                  <button
                    type="button"
                    onClick={() => void exportToDevice('xlsx')}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Ekspor .XLSX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportToDevice('csv')}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    .CSV
                  </button>
                </>
              )}
              {activeModule === 'slides' && (
                <>
                  <button
                    type="button"
                    onClick={() => void exportToDevice('pptx')}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Ekspor .PPTX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportToDevice('html')}
                    className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    .HTML
                  </button>
                </>
              )}
            </>
          )}

          {/* DOCS RIBBON COMMANDS */}
          {activeModule === 'docs' && ribbonTab === 'home' && (
            <>
              <button
                type="button"
                onClick={() => execDocCmd('undo')}
                title="Undo"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('redo')}
                title="Redo"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <Redo2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('bold')}
                title="Tebal (Bold)"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <Bold className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('italic')}
                title="Miring (Italic)"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <Italic className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('underline')}
                title="Garis Bawah"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <Underline className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('formatBlock', 'H1')}
                title="Judul Besar"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <Heading1 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('formatBlock', 'H2')}
                title="Subjudul"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <Heading2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('insertUnorderedList')}
                title="Daftar Poin"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <List className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('justifyLeft')}
                title="Rata Kiri"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <AlignLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('justifyCenter')}
                title="Rata Tengah"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <AlignCenter className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => execDocCmd('justifyRight')}
                title="Rata Kanan"
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <AlignRight className="w-3 h-3" />
              </button>
            </>
          )}

          {activeModule === 'docs' && ribbonTab === 'insert' && (
            <>
              <button
                type="button"
                onClick={() =>
                  insertDocSnippet(
                    '<table border="1" style="width:100%;border-collapse:collapse;margin:6px 0"><tr><th>Kolom 1</th><th>Kolom 2</th></tr><tr><td>Data A</td><td>Data B</td></tr></table><p></p>'
                  )
                }
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Table className="w-3 h-3" />
                <span>+Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => insertDocSnippet('<hr/><p></p>')}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Minus className="w-3 h-3" />
                <span>Garis</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  insertDocSnippet(`<span>${new Date().toLocaleDateString('id-ID')}</span>`)
                }
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                +Tanggal
              </button>
              <button
                type="button"
                onClick={() => setDocPaperLight((v) => !v)}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                {docPaperLight ? 'Mode LCD' : 'Kertas Putih'}
              </button>
            </>
          )}

          {activeModule === 'docs' && ribbonTab === 'template' && (
            <>
              {DOC_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyDocTemplate(tpl.id)}
                  className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
                >
                  {language === 'id' ? tpl.labelId : tpl.labelEn}
                </button>
              ))}
            </>
          )}

          {/* SHEETS RIBBON COMMANDS */}
          {activeModule === 'sheets' && ribbonTab === 'home' && (
            <>
              <button
                type="button"
                onClick={() => updateCellStyle({ bold: !cells[activeCell]?.bold })}
                className={`px-2 py-1 border border-[var(--lcd-fg)] shrink-0 cursor-pointer ${
                  cells[activeCell]?.bold ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                }`}
              >
                B
              </button>
              <button
                type="button"
                onClick={() =>
                  updateCellStyle({
                    format: cells[activeCell]?.format === 'currency' ? 'plain' : 'currency',
                    align: 'right',
                  })
                }
                className={`px-2 py-1 border border-[var(--lcd-fg)] shrink-0 cursor-pointer ${
                  cells[activeCell]?.format === 'currency'
                    ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                    : 'bg-[var(--lcd-bg)]'
                }`}
              >
                Rp
              </button>
              <button
                type="button"
                onClick={() =>
                  updateCellStyle({
                    format: cells[activeCell]?.format === 'percent' ? 'plain' : 'percent',
                    align: 'right',
                  })
                }
                className={`px-2 py-1 border border-[var(--lcd-fg)] shrink-0 cursor-pointer ${
                  cells[activeCell]?.format === 'percent'
                    ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                    : 'bg-[var(--lcd-bg)]'
                }`}
              >
                %
              </button>
              <button
                type="button"
                onClick={() =>
                  updateCellStyle({
                    align: cells[activeCell]?.align === 'right' ? 'left' : 'right',
                  })
                }
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                {cells[activeCell]?.align === 'right' ? 'Kanan' : 'Kiri'}
              </button>
              <button
                type="button"
                onClick={() => {
                  commitCellRaw(activeCell, '');
                  setFormulaInput('');
                }}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                Hapus Sel
              </button>
            </>
          )}

          {activeModule === 'sheets' && ribbonTab === 'insert' && (
            <>
              {(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT'] as const).map((fn) => (
                <button
                  key={fn}
                  type="button"
                  onClick={() => insertFormulaHelper(fn)}
                  className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
                >
                  ={fn}()
                </button>
              ))}
            </>
          )}

          {activeModule === 'sheets' && ribbonTab === 'template' && (
            <>
              {SHEET_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setSheetTitle(tpl.title);
                    setCells(tpl.cells);
                    setActiveCell('A1');
                    setFormulaInput(tpl.cells.A1?.raw ?? '');
                    soundEngine.playCue('select');
                  }}
                  className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
                >
                  {language === 'id' ? tpl.labelId : tpl.labelEn}
                </button>
              ))}
            </>
          )}

          {/* SLIDES RIBBON COMMANDS */}
          {activeModule === 'slides' && ribbonTab === 'home' && (
            <>
              <button
                type="button"
                onClick={addNewSlide}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                + Slide
              </button>
              <button
                type="button"
                onClick={duplicateCurrentSlide}
                className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Salin</span>
              </button>
              <button
                type="button"
                disabled={activeSlideIdx === 0}
                onClick={() => moveCurrentSlide(-1)}
                className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] disabled:opacity-40 shrink-0 cursor-pointer"
              >
                ◀
              </button>
              <button
                type="button"
                disabled={activeSlideIdx >= slides.length - 1}
                onClick={() => moveCurrentSlide(1)}
                className="px-1.5 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] disabled:opacity-40 shrink-0 cursor-pointer"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={deleteCurrentSlide}
                className="p-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}

          {activeModule === 'slides' && ribbonTab === 'insert' && currentSlide && (
            <>
              {(
                [
                  { id: 'title', label: 'Judul' },
                  { id: 'bullets', label: 'Poin' },
                  { id: 'two-col', label: '2 Kolom' },
                ] as const
              ).map((ly) => (
                <button
                  key={ly.id}
                  type="button"
                  onClick={() => updateCurrentSlide({ layout: ly.id })}
                  className={`px-2 py-1 border border-[var(--lcd-fg)] shrink-0 cursor-pointer ${
                    currentSlide.layout === ly.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {ly.label}
                </button>
              ))}
              {(
                [
                  { id: 'lcd', label: 'LCD' },
                  { id: 'paper', label: 'Kertas' },
                  { id: 'ink', label: 'Gelap' },
                  { id: 'blueprint', label: 'Biru' },
                ] as const
              ).map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => updateCurrentSlide({ theme: th.id })}
                  className={`px-2 py-1 border border-[var(--lcd-fg)] shrink-0 cursor-pointer ${
                    currentSlide.theme === th.id ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)]' : 'bg-[var(--lcd-bg)]'
                  }`}
                >
                  {th.label}
                </button>
              ))}
            </>
          )}

          {activeModule === 'slides' && ribbonTab === 'template' && (
            <button
              type="button"
              onClick={() => {
                setDeckTitle('Presentasi_Elixir');
                setSlides(DEFAULT_SLIDES);
                setActiveSlideIdx(0);
                soundEngine.playCue('select');
              }}
              className="px-2 py-1 border border-[var(--lcd-fg)] bg-[var(--lcd-bg)] shrink-0 cursor-pointer"
            >
              Deck Pengenalan Elixir Office
            </button>
          )}
        </div>
      </div>

      {busyStatus && (
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)] text-[10px] font-bold shrink-0">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{busyStatus}</span>
        </div>
      )}

      {/* MAIN WORKSPACE CANVAS */}
      {activeModule === 'docs' && (
        <div className="flex-1 flex flex-col min-h-0 p-2">
          <div
            ref={writerRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              if (!writerRef.current) return;
              const html = writerRef.current.innerHTML;
              setDocHtml(html);
              setDocStats(countWordsAndChars(html));
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void saveCurrentToOS();
              }
            }}
            className={`flex-1 overflow-y-auto lcd-scroll border-2 border-[var(--lcd-fg)] p-3 text-xs leading-relaxed outline-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_td]:border [&_td]:border-current [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:border-current [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:font-bold [&_img]:max-w-full [&_img]:h-auto [&_img]:my-1.5 [&_img]:border [&_img]:border-current/30 [&_aside]:border [&_aside]:border-dashed [&_aside]:border-current/40 [&_aside]:p-1.5 [&_aside]:my-1.5 [&_aside]:text-[11px] ${
              docPaperLight ? 'bg-[#fafdf6] text-[#0f172a]' : 'bg-[var(--lcd-bg)] text-[var(--lcd-fg)]'
            }`}
          />
          <div className="flex items-center justify-between pt-1 text-[10px] font-bold opacity-80 tabular-nums shrink-0">
            <span>Elixir Writer · Halaman 1</span>
            <span>
              {docStats.words} Kata · {docStats.chars} Karakter
            </span>
          </div>
        </div>
      )}

      {activeModule === 'sheets' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Formula Bar */}
          <div className="flex items-center gap-1 px-1.5 py-1 border-b border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[10px] shrink-0">
            <span className="px-1.5 py-0.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] font-bold tabular-nums w-9 text-center">
              {activeCell}
            </span>
            <span className="font-bold italic opacity-75">fx</span>
            <input
              type="text"
              value={formulaInput}
              onChange={(e) => {
                setFormulaInput(e.target.value);
                commitCellRaw(activeCell, e.target.value);
              }}
              placeholder="Nilai atau rumus (=SUM(B2:B5))"
              className="flex-1 min-w-0 bg-[var(--lcd-bg)] border border-[var(--lcd-fg)] px-1.5 py-0.5 text-[11px] font-bold outline-none"
            />
          </div>

          {/* Interactive Spreadsheet Grid */}
          <div className="flex-1 overflow-auto lcd-scroll">
            <table className="w-full border-collapse text-[10px] tabular-nums">
              <thead className="sticky top-0 z-10 bg-[var(--lcd-sec)]">
                <tr>
                  <th className="w-7 border border-[var(--lcd-fg)] p-0.5 bg-[var(--lcd-sec)]">#</th>
                  {COLS.map((c) => (
                    <th key={c} className="min-w-[66px] border border-[var(--lcd-fg)] p-0.5 font-bold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: ROW_COUNT }, (_, rIdx) => {
                  const rNum = rIdx + 1;
                  return (
                    <tr key={rNum}>
                      <td className="border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-center font-bold p-0.5">
                        {rNum}
                      </td>
                      {COLS.map((col) => {
                        const coord = `${col}${rNum}`;
                        const isSel = coord === activeCell;
                        const cellMeta = cells[coord];
                        const ev = evaluateCellValue(coord, cells);
                        return (
                          <td
                            key={coord}
                            onClick={() => {
                              setActiveCell(coord);
                              setFormulaInput(cellMeta?.raw ?? '');
                            }}
                            className={`border border-[var(--lcd-fg)]/60 px-1 py-0.5 cursor-pointer truncate max-w-[96px] ${
                              isSel
                                ? 'bg-[var(--lcd-fg)] text-[var(--lcd-bg)] font-bold'
                                : 'bg-[var(--lcd-bg)] hover:bg-[var(--lcd-sec)]/60'
                            } ${cellMeta?.bold ? 'font-bold' : ''} ${
                              cellMeta?.align === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {ev.display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Spreadsheet Status Bar */}
          <div className="flex items-center justify-between px-2 py-0.5 border-t border-[var(--lcd-fg)] bg-[var(--lcd-sec)] text-[10px] font-bold tabular-nums shrink-0">
            <span>
              Sel {activeCell}: {activeCellEvaluated.display || '(Kosong)'}
            </span>
            <span>Elixir Calc</span>
          </div>
        </div>
      )}

      {activeModule === 'slides' && currentSlide && (
        <div className="flex-1 flex flex-col justify-between p-2 gap-1.5 min-h-0">
          {/* Active Slide Editor Card */}
          <div
            className={`flex-1 border-2 p-2.5 flex flex-col gap-1.5 min-h-0 overflow-y-auto lcd-scroll ${
              slideThemeClass[currentSlide.theme]
            }`}
          >
            <input
              type="text"
              value={currentSlide.title}
              onChange={(e) => updateCurrentSlide({ title: e.target.value })}
              placeholder="Judul Slide..."
              className="bg-transparent border-b border-current/40 pb-1 text-sm font-bold outline-none"
            />
            {currentSlide.layout === 'two-col' ? (
              <div className="flex-1 grid grid-cols-2 gap-2 min-h-0">
                <textarea
                  value={currentSlide.body}
                  onChange={(e) => updateCurrentSlide({ body: e.target.value })}
                  placeholder="Kolom kiri..."
                  className="bg-transparent border border-current/30 p-1.5 text-[11px] outline-none resize-none"
                />
                <textarea
                  value={currentSlide.bodyRight ?? ''}
                  onChange={(e) => updateCurrentSlide({ bodyRight: e.target.value })}
                  placeholder="Kolom kanan..."
                  className="bg-transparent border border-current/30 p-1.5 text-[11px] outline-none resize-none"
                />
              </div>
            ) : (
              <textarea
                value={currentSlide.body}
                onChange={(e) => updateCurrentSlide({ body: e.target.value })}
                placeholder="Isi slide..."
                className="flex-1 bg-transparent border border-current/30 p-1.5 text-[11px] outline-none resize-none"
              />
            )}
          </div>

          {/* Bottom Slide Filmstrip */}
          <div className="flex items-center gap-1.5 overflow-x-auto lcd-scroll pb-0.5 shrink-0">
            {slides.map((sl, idx) => (
              <button
                key={sl.id}
                type="button"
                onClick={() => {
                  soundEngine.playCue('click');
                  setActiveSlideIdx(idx);
                }}
                className={`w-20 h-11 border-2 p-1 text-left shrink-0 cursor-pointer flex flex-col justify-between ${
                  idx === activeSlideIdx
                    ? 'border-[var(--lcd-fg)] bg-[var(--lcd-fg)] text-[var(--lcd-bg)]'
                    : 'border-[var(--lcd-fg)] bg-[var(--lcd-sec)]'
                }`}
              >
                <span className="text-[8px] font-bold tabular-nums">#{idx + 1}</span>
                <span className="text-[9px] font-bold truncate">{sl.title || 'Slide'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* OPEN FILE FROM OS DOCUMENTS MODAL */}
      {openFileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3">
          <div className="w-full max-w-sm border-2 border-[var(--lcd-fg)] bg-[var(--lcd-bg)] text-[var(--lcd-fg)] p-2.5 space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--lcd-fg)] pb-1 text-xs font-bold">
              <span>{language === 'id' ? 'Buka dari Dokumen OS' : 'Open OS Document'}</span>
              <button
                type="button"
                onClick={() => setOpenFileModal(false)}
                className="px-1.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto lcd-scroll space-y-1 text-xs">
              {osDocFiles.length === 0 ? (
                <p className="opacity-75 py-2">
                  {language === 'id' ? 'Belum ada berkas dokumen di OS.' : 'No saved documents yet.'}
                </p>
              ) : (
                osDocFiles.map((f) => (
                  <button
                    key={f.id ?? f.name}
                    type="button"
                    onClick={() => void loadRecordIntoOffice(f)}
                    className="w-full px-2 py-1.5 border border-[var(--lcd-fg)] bg-[var(--lcd-sec)] hover:bg-[var(--lcd-fg)] hover:text-[var(--lcd-bg)] text-left flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="font-bold truncate">{f.name}</span>
                    <span className="text-[10px] shrink-0 tabular-nums">{f.sizeKb} KB</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
