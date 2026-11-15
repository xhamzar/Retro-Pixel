'use client';

import { db } from '@/src/services/db';
import { formatManPage, LINUX_MAN_PAGES } from '@/src/services/linuxManPages';
import {
  buildLinuxTreeString,
  chmodLinuxNode,
  chownLinuxNode,
  collectAllLinuxPaths,
  copyLinuxNode,
  DEFAULT_HOME,
  formatNodeReadableContent,
  formatPermissions,
  listLinuxDir,
  mkdirLinux,
  moveLinuxNode,
  normalizeLinuxPath,
  OS_FOLDERS,
  removeLinuxNode,
  statLinuxNode,
  writeLinuxFile,
  type LinuxVfsNode,
} from '@/src/services/linuxVfs';
import { soundEngine } from '@/src/services/sound';
import { loadTamagotchiState } from '@/src/services/tamagotchiEngine';
import { OS_THEMES } from '@/src/store/useOSStore';
import type { AppLaunchParams, LanguageCode, OSThemeId } from '@/src/types/os';

export interface ShellAppSummary {
  id: string;
  nameId: string;
  nameEn: string;
  category: string;
}

export interface ShellOutputLine {
  id: string;
  kind: 'cmd' | 'out' | 'err' | 'sys';
  text: string;
}

export interface NanoLaunchPayload {
  path: string;
  content: string;
  isNew: boolean;
}

export interface ShellRuntimeContext {
  cwd: string;
  env: Record<string, string>;
  aliases: Record<string, string>;
  history: string[];
  bootTimeMs: number;
  lastExitCode: number;
  apps: ShellAppSummary[];
  os: {
    language: LanguageCode;
    themeId: OSThemeId;
    soundEnabled: boolean;
    batteryLevel: number;
    isCharging: boolean;
    wifiEnabled: boolean;
    setTheme: (id: OSThemeId) => void;
    setSoundEnabled: (enabled: boolean) => void;
    setLanguage: (lang: LanguageCode) => void;
    openApp: (id: string, params?: AppLaunchParams) => void;
    pushNotification: (title: string, body: string, appId?: string) => void;
  };
}

export interface ShellExecutionResult {
  lines: Omit<ShellOutputLine, 'id'>[];
  nextCwd: string;
  nextEnv: Record<string, string>;
  nextAliases: Record<string, string>;
  lastExitCode: number;
  clearRequested: boolean;
  exitRequested: boolean;
  openNano?: NanoLaunchPayload | null;
}

export const TERMINAL_COMMAND_LIST = [
  'help',
  'man',
  'ls',
  'll',
  'cd',
  'pwd',
  'tree',
  'find',
  'mkdir',
  'rmdir',
  'rm',
  'cp',
  'mv',
  'touch',
  'chmod',
  'chown',
  'stat',
  'nano',
  'cat',
  'head',
  'tail',
  'wc',
  'nl',
  'rev',
  'grep',
  'sed',
  'sort',
  'uniq',
  'cut',
  'tr',
  'tee',
  'xargs',
  'diff',
  'base64',
  'sha256sum',
  'echo',
  'write',
  'openfile',
  'curl',
  'wget',
  'ping',
  'ps',
  'top',
  'htop',
  'kill',
  'free',
  'df',
  'which',
  'hostname',
  'id',
  'uname',
  'uptime',
  'date',
  'whoami',
  'apps',
  'open',
  'theme',
  'sound',
  'lang',
  'notify',
  'neofetch',
  'notes',
  'contacts',
  'alarms',
  'battery',
  'calc',
  'run',
  'sh',
  'bash',
  'test',
  'true',
  'false',
  'env',
  'export',
  'unset',
  'alias',
  'unalias',
  'history',
  'clear',
  'exit',
];

const BUILTIN_SET = new Set(TERMINAL_COMMAND_LIST);

// ---------- Parsing, Substitution & Variable Expansion ----------

function splitOutsideQuotes(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (ch === '\\' && quote !== "'" && i + 1 < input.length) {
      buf += ch + input[i + 1];
      i += 2;
      continue;
    }
    if ((ch === '"' || ch === "'") && (!quote || quote === ch)) {
      quote = quote === ch ? null : ch;
      buf += ch;
      i += 1;
      continue;
    }
    if (quote !== "'" && input.startsWith('$(', i)) {
      parenDepth += 1;
      buf += '$(';
      i += 2;
      continue;
    }
    if (quote !== "'" && parenDepth > 0 && ch === ')') {
      parenDepth -= 1;
      buf += ch;
      i += 1;
      continue;
    }
    if (!quote && parenDepth === 0 && input.startsWith(delimiter, i)) {
      parts.push(buf.trim());
      buf = '';
      i += delimiter.length;
      continue;
    }
    buf += ch;
    i += 1;
  }
  if (buf.trim().length > 0 || parts.length > 0) {
    parts.push(buf.trim());
  }
  return parts.filter(Boolean);
}

type ChainOp = 'start' | ';' | '&&' | '||';

interface ChainSegment {
  op: ChainOp;
  command: string;
}

function parseCommandChains(input: string): ChainSegment[] {
  const segments: ChainSegment[] = [];
  let buf = '';
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;
  let pendingOp: ChainOp = 'start';
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (ch === '\\' && quote !== "'" && i + 1 < input.length) {
      buf += ch + input[i + 1];
      i += 2;
      continue;
    }
    if ((ch === '"' || ch === "'") && (!quote || quote === ch)) {
      quote = quote === ch ? null : ch;
      buf += ch;
      i += 1;
      continue;
    }
    if (quote !== "'" && input.startsWith('$(', i)) {
      parenDepth += 1;
      buf += '$(';
      i += 2;
      continue;
    }
    if (quote !== "'" && parenDepth > 0 && ch === ')') {
      parenDepth -= 1;
      buf += ch;
      i += 1;
      continue;
    }
    if (!quote && parenDepth === 0) {
      if (input.startsWith('&&', i)) {
        if (buf.trim()) segments.push({ op: pendingOp, command: buf.trim() });
        buf = '';
        pendingOp = '&&';
        i += 2;
        continue;
      }
      if (input.startsWith('||', i)) {
        if (buf.trim()) segments.push({ op: pendingOp, command: buf.trim() });
        buf = '';
        pendingOp = '||';
        i += 2;
        continue;
      }
      if (ch === ';') {
        if (buf.trim()) segments.push({ op: pendingOp, command: buf.trim() });
        buf = '';
        pendingOp = ';';
        i += 1;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  if (buf.trim()) {
    segments.push({ op: pendingOp, command: buf.trim() });
  }
  return segments;
}

async function expandCommandSubstitutions(
  raw: string,
  ctx: ShellRuntimeContext,
  depth: number
): Promise<string> {
  if (depth >= 3 || !raw.includes('$(')) return raw;

  let out = '';
  let quote: '"' | "'" | null = null;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\' && quote !== "'" && i + 1 < raw.length) {
      out += ch + raw[i + 1];
      i += 2;
      continue;
    }
    if ((ch === '"' || ch === "'") && (!quote || quote === ch)) {
      quote = quote === ch ? null : ch;
      out += ch;
      i += 1;
      continue;
    }
    if (quote !== "'" && raw.startsWith('$(', i)) {
      let nested = 1;
      let j = i + 2;
      let innerQuote: '"' | "'" | null = null;
      while (j < raw.length && nested > 0) {
        const c = raw[j];
        if (c === '\\' && innerQuote !== "'" && j + 1 < raw.length) {
          j += 2;
          continue;
        }
        if ((c === '"' || c === "'") && (!innerQuote || innerQuote === c)) {
          innerQuote = innerQuote === c ? null : c;
          j += 1;
          continue;
        }
        if (innerQuote !== "'") {
          if (raw.startsWith('$(', j)) {
            nested += 1;
            j += 2;
            continue;
          }
          if (c === ')') {
            nested -= 1;
            if (nested === 0) break;
          }
        }
        j += 1;
      }
      if (nested === 0) {
        const innerCmd = raw.slice(i + 2, j).trim();
        const subRes = await executeScriptBody(innerCmd, { ...ctx }, depth + 1);
        const captured = subRes.lines
          .filter((l) => l.kind === 'out')
          .map((l) => l.text)
          .join('\n')
          .replace(/\n+$/, '')
          .replace(/\r?\n/g, ' ');
        out += captured;
        i = j + 1;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

function tokenizeArgs(raw: string, ctx: ShellRuntimeContext): string[] {
  const tokens: string[] = [];
  let current = '';
  let inToken = false;
  let quote: '"' | "'" | null = null;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\' && quote !== "'" && i + 1 < raw.length) {
      current += raw[i + 1];
      inToken = true;
      i += 2;
      continue;
    }
    if ((ch === '"' || ch === "'") && (!quote || quote === ch)) {
      quote = quote === ch ? null : ch;
      inToken = true;
      i += 1;
      continue;
    }
    if (!quote && /\s/.test(ch)) {
      if (inToken) {
        tokens.push(current);
        current = '';
        inToken = false;
      }
      i += 1;
      continue;
    }
    if (quote !== "'" && ch === '$') {
      const rest = raw.slice(i);
      if (rest.startsWith('$?')) {
        current += String(ctx.lastExitCode);
        inToken = true;
        i += 2;
        continue;
      }
      const match = rest.match(/^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/);
      if (match) {
        const key = match[1] || match[2];
        current += ctx.env[key] ?? '';
        inToken = true;
        i += match[0].length;
        continue;
      }
    }
    current += ch;
    inToken = true;
    i += 1;
  }
  if (inToken) tokens.push(current);
  return tokens;
}

function extractRedirection(tokens: string[]): {
  args: string[];
  redirectMode: 'overwrite' | 'append' | null;
  redirectTarget: string | null;
} {
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === '>' || tokens[i] === '>>') {
      const target = tokens[i + 1] ?? null;
      return {
        args: tokens.slice(0, i),
        redirectMode: tokens[i] === '>>' ? 'append' : 'overwrite',
        redirectTarget: target,
      };
    }
  }
  return { args: tokens, redirectMode: null, redirectTarget: null };
}

// ---------- Safe Math Evaluator ----------

function safeEvalMath(expr: string): number {
  const cleaned = expr.replace(/\s+/g, '');
  if (!cleaned) throw new Error('Ekspresi kosong');
  let pos = 0;

  const peek = () => cleaned[pos] ?? '';
  const consume = () => cleaned[pos++] ?? '';

  function parseExpression(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parsePower();
      if (op === '*') left *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Pembagian dengan nol');
        left /= right;
      } else {
        if (right === 0) throw new Error('Modulo nol');
        left %= right;
      }
    }
    return left;
  }

  function parsePower(): number {
    const base = parseUnary();
    if (peek() === '^') {
      consume();
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      consume();
      const val = parseExpression();
      if (consume() !== ')') throw new Error('Kurung tidak seimbang');
      return val;
    }
    const idMatch = cleaned.slice(pos).match(/^[a-zA-Z_]+/);
    if (idMatch) {
      const ident = idMatch[0].toLowerCase();
      pos += ident.length;
      if (ident === 'pi') return Math.PI;
      if (ident === 'e') return Math.E;
      if (consume() !== '(') throw new Error(`Simbol tidak dikenal: ${ident}`);
      const arg = parseExpression();
      if (consume() !== ')') throw new Error('Kurung fungsi tidak seimbang');
      if (ident === 'sqrt') return Math.sqrt(arg);
      if (ident === 'abs') return Math.abs(arg);
      if (ident === 'round') return Math.round(arg);
      if (ident === 'floor') return Math.floor(arg);
      if (ident === 'ceil') return Math.ceil(arg);
      if (ident === 'sin') return Math.sin(arg);
      if (ident === 'cos') return Math.cos(arg);
      if (ident === 'tan') return Math.tan(arg);
      throw new Error(`Fungsi tidak dikenal: ${ident}`);
    }

    const numMatch = cleaned.slice(pos).match(/^\d+(?:\.\d+)?/);
    if (numMatch) {
      pos += numMatch[0].length;
      return Number(numMatch[0]);
    }
    throw new Error(`Token tidak valid di posisi ${pos + 1}`);
  }

  const result = parseExpression();
  if (pos < cleaned.length) {
    throw new Error(`Karakter berlebih: ${cleaned.slice(pos)}`);
  }
  return result;
}

// ---------- Unix Helpers & Filters ----------

function decodeEscapes(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

function expandCharRange(spec: string): string[] {
  const s = decodeEscapes(spec);
  const chars: string[] = [];
  for (let i = 0; i < s.length; i += 1) {
    if (i + 2 < s.length && s[i + 1] === '-') {
      const start = s.charCodeAt(i);
      const end = s.charCodeAt(i + 2);
      const step = start <= end ? 1 : -1;
      for (let code = start; step > 0 ? code <= end : code >= end; code += step) {
        chars.push(String.fromCharCode(code));
      }
      i += 2;
    } else {
      chars.push(s[i]);
    }
  }
  return chars;
}

function parseSedSubstitute(expr: string): {
  pattern: string;
  replacement: string;
  global: boolean;
  ignoreCase: boolean;
} | null {
  if (!expr.startsWith('s') || expr.length < 4) return null;
  const delim = expr[1];
  const parts: string[] = [];
  let buf = '';
  let i = 2;
  while (i < expr.length) {
    if (expr[i] === '\\' && i + 1 < expr.length && expr[i + 1] === delim) {
      buf += delim;
      i += 2;
      continue;
    }
    if (expr[i] === delim) {
      parts.push(buf);
      buf = '';
      i += 1;
      continue;
    }
    buf += expr[i];
    i += 1;
  }
  parts.push(buf);
  if (parts.length < 2) return null;
  const flags = parts[2] ?? '';
  return {
    pattern: parts[0],
    replacement: parts[1],
    global: flags.includes('g'),
    ignoreCase: flags.includes('i'),
  };
}

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function computeSha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeHttpUrl(raw: string): string {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function getBaseName(absPath: string): string {
  if (absPath === '/') return '/';
  const idx = absPath.lastIndexOf('/');
  return absPath.slice(idx + 1);
}

async function readInputTextOrFile(
  fileArg: string | undefined,
  stdin: string,
  ctx: ShellRuntimeContext
): Promise<{ text: string; label: string; error?: string }> {
  if (!fileArg || fileArg === '-') {
    return { text: stdin, label: '-' };
  }
  const home = ctx.env.HOME || DEFAULT_HOME;
  const abs = normalizeLinuxPath(fileArg, ctx.cwd, home);
  const node = await statLinuxNode(abs);
  if (!node) return { text: '', label: abs, error: `Berkas tidak ditemukan: ${fileArg}` };
  if (node.type === 'dir') return { text: '', label: abs, error: `${fileArg} adalah sebuah direktori` };
  return { text: formatNodeReadableContent(node), label: node.path };
}

async function evalTestCondition(args: string[], ctx: ShellRuntimeContext): Promise<boolean> {
  let clean = [...args];
  if (clean[clean.length - 1] === ']') clean.pop();

  let negate = false;
  if (clean[0] === '!') {
    negate = true;
    clean = clean.slice(1);
  }

  let result = false;
  const home = ctx.env.HOME || DEFAULT_HOME;

  if (clean.length === 0) {
    result = false;
  } else if (clean.length === 1) {
    result = clean[0].length > 0;
  } else if (clean.length === 2) {
    const [op, val] = clean;
    if (op === '-z') result = val.length === 0;
    else if (op === '-n') result = val.length > 0;
    else if (op === '-e' || op === '-f' || op === '-d' || op === '-s') {
      const node = await statLinuxNode(normalizeLinuxPath(val, ctx.cwd, home));
      if (op === '-e') result = Boolean(node);
      else if (op === '-f') result = node?.type === 'file';
      else if (op === '-d') result = node?.type === 'dir';
      else result = node?.type === 'file' && (node.sizeBytes ?? node.content.length) > 0;
    }
  } else if (clean.length >= 3) {
    const [left, op, right] = clean;
    if (op === '=' || op === '==') result = left === right;
    else if (op === '!=') result = left !== right;
    else if (op === '-eq') result = Number(left) === Number(right);
    else if (op === '-ne') result = Number(left) !== Number(right);
    else if (op === '-gt') result = Number(left) > Number(right);
    else if (op === '-lt') result = Number(left) < Number(right);
    else if (op === '-ge') result = Number(left) >= Number(right);
    else if (op === '-le') result = Number(left) <= Number(right);
  }

  return negate ? !result : result;
}

// ---------- Safe HTTP, JSON & HTML Helpers ----------

interface CurlApiPayload {
  status?: number;
  statusText?: string;
  url?: string;
  name?: string;
  mimeType?: string;
  headers?: Record<string, string>;
  sizeKb?: number;
  content?: string;
  error?: string;
}

interface ReaderApiPayload {
  title?: string;
  url?: string;
  paragraphs?: string[];
  links?: { label: string; href: string }[];
  error?: string;
}

type SafeFetchResourceResult =
  | {
      ok: true;
      status: number;
      statusText: string;
      name: string;
      url: string;
      mimeType: string;
      headers: Record<string, string>;
      sizeKb: number;
      content: string;
      cleanTextHint?: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function safeParseJsonText<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function isHtmlDocumentString(text: string, mimeType?: string): boolean {
  const m = (mimeType ?? '').toLowerCase();
  if (m.includes('html')) return true;
  const head = text.trimStart().slice(0, 128).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<head');
}

function decodeHtmlEntitiesBasic(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return decodeHtmlEntitiesBasic(match[1]).replace(/\s+/g, ' ').trim();
}

function htmlToCleanReadableText(html: string, urlLabel?: string): string {
  const title = extractHtmlTitle(html);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : html;

  body = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|main|aside|li|tr|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ');

  const decoded = decodeHtmlEntitiesBasic(body);
  const cleanLines = decoded
    .split('\n')
    .map((line) => line.replace(/[ \t\r]+/g, ' ').trim())
    .filter((line) => line.length > 0);

  const out: string[] = [];
  if (title) out.push(`# ${title}`);
  if (urlLabel) out.push(`URL: ${urlLabel}`);
  if (out.length > 0 && cleanLines.length > 0) out.push('---');
  out.push(...cleanLines);

  return out.length > 0 ? out.join('\n') : '(halaman HTML kosong tanpa teks)';
}

function formatReaderPayloadAsText(reader: ReaderApiPayload, fallbackUrl: string): string {
  const lines: string[] = [];
  if (reader.title) lines.push(`# ${reader.title}`);
  lines.push(`URL: ${reader.url ?? fallbackUrl}`);
  lines.push('---');
  if (reader.paragraphs && reader.paragraphs.length > 0) {
    lines.push(...reader.paragraphs);
  } else {
    lines.push('(tidak ada paragraf teks terbaca)');
  }
  if (reader.links && reader.links.length > 0) {
    lines.push('', '[TAUTAN]');
    reader.links.slice(0, 8).forEach((lnk) => {
      lines.push(`• ${lnk.label || lnk.href} -> ${lnk.href}`);
    });
  }
  return lines.join('\n');
}

async function fetchBrowserResource(
  fullUrl: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<SafeFetchResourceResult> {
  const method = (options?.method || (options?.body !== undefined ? 'POST' : 'GET')).toUpperCase();
  const hasCustomReq =
    method !== 'GET' ||
    options?.body !== undefined ||
    (options?.headers && Object.keys(options.headers).length > 0);

  try {
    const resp = await fetch('/api/browser/curl', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        url: fullUrl,
        method,
        headers: options?.headers,
        body: options?.body,
      }),
    });
    const rawText = await resp.text();
    const payload = safeParseJsonText<CurlApiPayload>(rawText);

    if (payload) {
      if (!resp.ok || payload.error) {
        return {
          ok: false,
          status: resp.status,
          error: payload.error || `HTTP ${resp.status}`,
        };
      }
      const fallbackName = (() => {
        try {
          const seg = new URL(payload.url ?? fullUrl).pathname.split('/').filter(Boolean).pop();
          return seg || 'index.html';
        } catch {
          return 'downloaded_file';
        }
      })();
      return {
        ok: true,
        status: payload.status ?? resp.status,
        statusText: payload.statusText ?? 'OK',
        name: payload.name || fallbackName,
        url: payload.url ?? fullUrl,
        mimeType: payload.mimeType ?? 'text/plain',
        headers: payload.headers ?? {},
        sizeKb: payload.sizeKb ?? Math.max(1, Math.ceil((payload.content?.length ?? 0) / 1024)),
        content: payload.content ?? '',
      };
    }

    // Fallback for GET requests if /api/browser/curl returned non-JSON HTML (e.g., proxy/gateway)
    if (!hasCustomReq && isHtmlDocumentString(rawText, resp.headers.get('content-type') ?? undefined)) {
      try {
        const readerResp = await fetch(
          `/api/browser/proxy?mode=reader&url=${encodeURIComponent(fullUrl)}`,
          {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          }
        );
        const readerRaw = await readerResp.text();
        const readerJson = safeParseJsonText<ReaderApiPayload>(readerRaw);
        if (readerResp.ok && readerJson && !readerJson.error) {
          const clean = formatReaderPayloadAsText(readerJson, fullUrl);
          return {
            ok: true,
            status: readerResp.status,
            statusText: 'OK',
            name: 'halaman.txt',
            url: readerJson.url ?? fullUrl,
            mimeType: 'text/plain',
            headers: {},
            sizeKb: Math.max(1, Math.ceil(clean.length / 1024)),
            content: clean,
            cleanTextHint: clean,
          };
        }
      } catch {
        // Ignore fallback failure and report clear non-JSON diagnostic below
      }
    }

    if (isHtmlDocumentString(rawText, resp.headers.get('content-type') ?? undefined)) {
      const title = extractHtmlTitle(rawText);
      return {
        ok: false,
        status: resp.status || 502,
        error: `Proxy jaringan OS mengembalikan HTML non-JSON (HTTP ${resp.status}${title ? `: ${title}` : ''}).`,
      };
    }

    if (!resp.ok) {
      return {
        ok: false,
        status: resp.status,
        error: `HTTP ${resp.status} ${resp.statusText}`.trim(),
      };
    }

    return {
      ok: true,
      status: resp.status,
      statusText: resp.statusText || 'OK',
      name: 'output.txt',
      url: fullUrl,
      mimeType: resp.headers.get('content-type')?.split(';')[0]?.trim() || 'text/plain',
      headers: {},
      sizeKb: Math.max(1, Math.ceil(rawText.length / 1024)),
      content: rawText,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Gagal terhubung ke proxy jaringan OS',
    };
  }
}

// ---------- Help Text Registry ----------

function getHelpOutput(topic?: string): string {
  if (!topic) {
    return [
      'PIXELLINUX SHELL v2.4 — MANUAL RINGKAS',
      '-------------------------------------',
      '[SISTEM BERKAS LINUX & MOUNT OS /mnt/os]',
      '  ls [-la] [dir]   cd <dir|~|..|/>  pwd',
      '  mkdir [-p] <d>   rmdir <d>        rm [-rf] <target>',
      '  cp [-r] <a> <b>  mv <a> <b>       touch <file>',
      '  chmod <m> <f>    chown <u:g> <f>  stat <target>',
      '  nano [file]      man <perintah>   tree / find',
      '',
      '[TEKS, FILTER & KRIPTOGRAFI]',
      '  cat [-n] <f>     head / tail      wc / nl / rev',
      '  grep [-invc]     sed s/a/b/g      sort [-rnu]',
      '  uniq [-c]        cut -d: -f1      tr a-z A-Z',
      '  tee [-a] <f>     xargs <cmd>      diff <a> <b>',
      '  base64 [-d]      sha256sum        openfile <f>',
      '',
      '[JARINGAN, PROSES & SISTEM OS]',
      '  curl / wget      ping [-c 3]      ps / top / kill',
      '  neofetch / df    free / id / which / hostname',
      '  apps / open <id> theme / sound / lang / notify',
      '  notes / contacts / alarms / battery / calc',
      '  run <skrip.sh> (mendukung if/for/while & $(cmd))',
      '',
      'Ketik "man <perintah>" untuk manual lengkap (mis. man nano).',
    ].join('\n');
  }

  const formatted = formatManPage(topic);
  if (formatted) return formatted;
  return `Manual tidak ditemukan untuk "${topic}". Coba: man ls, man nano, man grep, man curl, man run.`;
}

// ---------- Single Pipeline Stage Executor ----------

interface StageResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  clearRequested: boolean;
  exitRequested: boolean;
  openNano?: NanoLaunchPayload | null;
}

function okStage(stdout = '', extra?: Partial<StageResult>): StageResult {
  return {
    stdout,
    stderr: '',
    exitCode: 0,
    clearRequested: false,
    exitRequested: false,
    ...extra,
  };
}

function errStage(stderr: string, exitCode = 1): StageResult {
  return {
    stdout: '',
    stderr,
    exitCode,
    clearRequested: false,
    exitRequested: false,
  };
}

async function runStage(
  rawTokens: string[],
  stdin: string,
  ctx: ShellRuntimeContext,
  depth: number
): Promise<StageResult> {
  if (rawTokens.length === 0) return okStage('');

  let tokens = rawTokens;
  // Support inline VAR=VAL prefix assignment or standalone assignment
  if (tokens.length === 1 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) {
    const eq = tokens[0].indexOf('=');
    const key = tokens[0].slice(0, eq);
    const val = tokens[0].slice(eq + 1);
    ctx.env[key] = val;
    return okStage('');
  }

  const aliasVal = ctx.aliases[tokens[0]];
  if (aliasVal) {
    const expandedAlias = await expandCommandSubstitutions(aliasVal, ctx, depth);
    const aliasTokens = tokenizeArgs(expandedAlias, ctx);
    tokens = [...aliasTokens, ...tokens.slice(1)];
  }

  const cmdRaw = tokens[0];
  const cmd = cmdRaw.toLowerCase();
  const args = tokens.slice(1);
  const home = ctx.env.HOME || DEFAULT_HOME;

  // Allow executing `./script.sh` or `/path/script.sh` directly
  if ((cmdRaw.startsWith('./') || cmdRaw.startsWith('/')) && !BUILTIN_SET.has(cmd)) {
    const targetPath = normalizeLinuxPath(cmdRaw, ctx.cwd, home);
    const node = await statLinuxNode(targetPath);
    if (!node) return errStage(`${cmdRaw}: berkas tidak ditemukan`, 127);
    if (node.type === 'dir') return errStage(`${cmdRaw}: adalah direktori`, 126);
    return executeScriptNode(node, ctx, depth);
  }

  switch (cmd) {
    case 'true':
      return okStage('');

    case 'false':
      return { stdout: '', stderr: '', exitCode: 1, clearRequested: false, exitRequested: false };

    case 'test':
    case '[': {
      const passed = await evalTestCondition(args, ctx);
      return {
        stdout: '',
        stderr: '',
        exitCode: passed ? 0 : 1,
        clearRequested: false,
        exitRequested: false,
      };
    }

    case 'clear':
    case 'cls':
      return okStage('', { clearRequested: true });

    case 'exit':
    case 'quit':
      return okStage('', { exitRequested: true });

    case 'help':
    case '?':
      return okStage(getHelpOutput(args[0]));

    case 'man': {
      if (!args[0]) {
        const topics = Object.keys(LINUX_MAN_PAGES).sort().join(', ');
        return okStage(`Gunakan: man <perintah>\nHalaman manual tersedia:\n${topics}`);
      }
      const doc = formatManPage(args[0]);
      if (!doc) return errStage(`Tidak ada entri manual untuk "${args[0]}"`, 16);
      return okStage(doc);
    }

    case 'which': {
      if (!args[0]) return errStage('Gunakan: which <perintah...>');
      const out: string[] = [];
      let allFound = true;
      for (const name of args) {
        const low = name.toLowerCase();
        if (ctx.aliases[name]) {
          out.push(`${name}: aliased to ${ctx.aliases[name]}`);
        } else if (BUILTIN_SET.has(low)) {
          out.push(`/bin/${low}`);
        } else {
          out.push(`${name} not found`);
          allFound = false;
        }
      }
      return {
        stdout: out.join('\n'),
        stderr: '',
        exitCode: allFound ? 0 : 1,
        clearRequested: false,
        exitRequested: false,
      };
    }

    case 'nano': {
      const targetArg = args[0] ?? 'catatan.txt';
      const targetAbs = normalizeLinuxPath(targetArg, ctx.cwd, home);
      const existing = await statLinuxNode(targetAbs);
      if (existing?.type === 'dir') {
        return errStage(`nano: "${targetArg}" adalah sebuah direktori`);
      }
      return okStage('', {
        openNano: {
          path: existing?.path ?? targetAbs,
          content: existing ? existing.content : '',
          isNew: !existing,
        },
      });
    }

    case 'pwd':
      return okStage(ctx.cwd);

    case 'whoami':
      return okStage(ctx.env.USER || 'pixel');

    case 'id':
      return okStage('uid=1000(pixel) gid=1000(staff) groups=1000(staff),27(sudo)');

    case 'hostname': {
      if (args[0]) {
        const res = await writeLinuxFile('/etc/hostname', `${args[0].trim()}\n`, 'overwrite');
        if (res.error) return errStage(res.error);
        ctx.env.HOSTNAME = args[0].trim();
        return okStage(`Hostname diubah ke: ${args[0].trim()}`);
      }
      const node = await statLinuxNode('/etc/hostname');
      return okStage((node?.content || 'retro-pixel').trim());
    }

    case 'date': {
      const now = new Date();
      return okStage(now.toLocaleString(ctx.os.language === 'id' ? 'id-ID' : 'en-US'));
    }

    case 'uptime': {
      const sec = Math.max(0, Math.floor((Date.now() - ctx.bootTimeMs) / 1000));
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return okStage(`up ${m} min ${s} sec · 1 user · load average: 0.14, 0.10, 0.05`);
    }

    case 'uname': {
      const host = ((await statLinuxNode('/etc/hostname'))?.content || 'retro-pixel').trim();
      return okStage(
        args.includes('-a')
          ? `Linux ${host} 2.4.0-monochrome #1 SMP PixelLinux x86_64 IndexedDB-VFS`
          : 'Linux'
      );
    }

    case 'env':
      return okStage(Object.entries(ctx.env).map(([k, v]) => `${k}=${v}`).join('\n'));

    case 'export': {
      if (args.length === 0) {
        return okStage(Object.entries(ctx.env).map(([k, v]) => `${k}=${v}`).join('\n'));
      }
      for (const item of args) {
        const eq = item.indexOf('=');
        if (eq > 0) {
          ctx.env[item.slice(0, eq).trim()] = item.slice(eq + 1);
        }
      }
      return okStage('');
    }

    case 'unset': {
      for (const key of args) {
        delete ctx.env[key];
      }
      return okStage('');
    }

    case 'alias': {
      if (args.length === 0) {
        const list = Object.entries(ctx.aliases).map(([k, v]) => `alias ${k}='${v}'`);
        return okStage(list.length ? list.join('\n') : '(belum ada alias)');
      }
      const joined = args.join(' ');
      const eq = joined.indexOf('=');
      if (eq <= 0) return errStage('Format: alias nama="perintah"');
      const k = joined.slice(0, eq).trim();
      const v = joined.slice(eq + 1).trim();
      ctx.aliases[k] = v;
      return okStage(`alias ${k}='${v}'`);
    }

    case 'unalias': {
      for (const k of args) {
        delete ctx.aliases[k];
      }
      return okStage('');
    }

    case 'history': {
      const recent = ctx.history.slice(-25);
      return okStage(recent.map((h, i) => `${String(i + 1).padStart(3, ' ')}  ${h}`).join('\n'));
    }

    case 'echo': {
      let interpretEscapes = false;
      let idx = 0;
      while (idx < args.length && /^-[neE]+$/.test(args[idx])) {
        if (args[idx].includes('e')) interpretEscapes = true;
        idx += 1;
      }
      const rawBody = args.slice(idx).join(' ');
      return okStage(interpretEscapes ? decodeEscapes(rawBody) : rawBody);
    }

    case 'cd': {
      const targetRaw = args[0] ?? '~';
      if (targetRaw === '-') {
        const prev = ctx.env.OLDPWD || home;
        ctx.env.OLDPWD = ctx.cwd;
        ctx.cwd = prev;
        ctx.env.PWD = prev;
        return okStage(prev);
      }
      const targetAbs = normalizeLinuxPath(targetRaw, ctx.cwd, home);
      const node = await statLinuxNode(targetAbs);
      if (!node) return errStage(`cd: ${targetRaw}: Direktori tidak ditemukan`);
      if (node.type !== 'dir') return errStage(`cd: ${targetRaw}: Bukan direktori`);
      ctx.env.OLDPWD = ctx.cwd;
      ctx.cwd = node.path;
      ctx.env.PWD = node.path;
      return okStage('');
    }

    case 'ls':
    case 'll':
    case 'dir': {
      const flagTokens = args.filter((a) => a.startsWith('-'));
      const longMode =
        cmd === 'll' || flagTokens.some((f) => f.includes('l'));
      const showAll = flagTokens.some((f) => f.includes('a'));
      const targetArg = args.find((a) => !a.startsWith('-'));
      const targetAbs = targetArg ? normalizeLinuxPath(targetArg, ctx.cwd, home) : ctx.cwd;

      const node = await statLinuxNode(targetAbs);
      if (!node) return errStage(`ls: tidak dapat mengakses '${targetArg ?? targetAbs}': Tidak ditemukan`);

      if (node.type === 'file') {
        const name = getBaseName(node.path);
        const sz = node.sizeBytes ?? node.content.length;
        return okStage(
          longMode
            ? `${formatPermissions(node)} ${node.owner.padEnd(6, ' ')} ${String(sz).padStart(6, ' ')}  ${name}`
            : name
        );
      }

      const { nodes, error } = await listLinuxDir(node.path);
      if (error) return errStage(error);

      const rows: string[] = [];
      if (showAll) {
        rows.push(longMode ? 'drwxr-xr-x pixel  0       .' : '.');
        rows.push(longMode ? 'drwxr-xr-x pixel  0       ..' : '..');
      }
      for (const item of nodes) {
        const name = getBaseName(item.path);
        if (!showAll && name.startsWith('.')) continue;
        const label = item.type === 'dir' ? `${name}/` : name;
        if (longMode) {
          const sz = item.type === 'dir' ? '-' : `${item.sizeBytes ?? item.content.length}B`;
          rows.push(
            `${formatPermissions(item)} ${item.owner.padEnd(6, ' ')} ${sz.padStart(7, ' ')}  ${label}`
          );
        } else {
          rows.push(label);
        }
      }
      if (rows.length === 0) return okStage('(direktori kosong)');
      return okStage(longMode ? rows.join('\n') : rows.join('  '));
    }

    case 'tree': {
      const targetArg = args[0];
      const startAbs = targetArg ? normalizeLinuxPath(targetArg, ctx.cwd, home) : ctx.cwd;
      const node = await statLinuxNode(startAbs);
      if (!node) return errStage(`tree: '${startAbs}' tidak ditemukan`);
      const lines = await buildLinuxTreeString(node.path, 3);
      return okStage(lines.join('\n'));
    }

    case 'find': {
      let startArg = '.';
      let namePattern = '';
      let typeFilter: 'f' | 'd' | null = null;

      for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '-name' && args[i + 1]) {
          namePattern = args[i + 1];
          i += 1;
        } else if (args[i] === '-type' && args[i + 1]) {
          if (args[i + 1] === 'f' || args[i + 1] === 'd') typeFilter = args[i + 1] as 'f' | 'd';
          i += 1;
        } else if (!args[i].startsWith('-') && i === 0) {
          startArg = args[i];
        } else if (!args[i].startsWith('-')) {
          namePattern = `*${args[i]}*`;
        }
      }

      const startAbs = normalizeLinuxPath(startArg, ctx.cwd, home);
      const allNodes = await collectAllLinuxPaths(startAbs);
      if (allNodes.length === 0) return errStage(`find: '${startArg}': Tidak ditemukan`);

      const regex = namePattern ? globToRegex(namePattern) : null;
      const hits = allNodes.filter((n) => {
        if (typeFilter === 'f' && n.type !== 'file') return false;
        if (typeFilter === 'd' && n.type !== 'dir') return false;
        if (regex && !regex.test(getBaseName(n.path))) return false;
        return true;
      });
      return okStage(hits.length ? hits.map((n) => n.path).join('\n') : '(tidak ditemukan)');
    }

    case 'mkdir': {
      const recursive = args.includes('-p');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return errStage('Gunakan: mkdir [-p] <direktori...>');
      const created: string[] = [];
      for (const t of targets) {
        const abs = normalizeLinuxPath(t, ctx.cwd, home);
        const res = await mkdirLinux(abs, recursive);
        if (res.error) return errStage(res.error);
        created.push(abs);
      }
      return okStage(`Direktori dibuat: ${created.join(', ')}`);
    }

    case 'rmdir': {
      if (args.length === 0) return errStage('Gunakan: rmdir <direktori>');
      for (const t of args) {
        const abs = normalizeLinuxPath(t, ctx.cwd, home);
        const res = await removeLinuxNode(abs, false, true);
        if (res.error) return errStage(res.error);
      }
      return okStage('Direktori dihapus.');
    }

    case 'rm':
    case 'del': {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const recursive = flags.includes('r') || flags.includes('R');
      const force = flags.includes('f');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return errStage('Gunakan: rm [-r] [-f] <target...>');

      const removed: string[] = [];
      for (const t of targets) {
        const abs = normalizeLinuxPath(t, ctx.cwd, home);
        const res = await removeLinuxNode(abs, recursive, false);
        if (res.error) {
          if (force) continue;
          return errStage(res.error);
        }
        removed.push(abs);
      }
      return okStage(removed.length ? `Dihapus: ${removed.join(', ')}` : '');
    }

    case 'cp': {
      const recursive = args.includes('-r') || args.includes('-R') || args.includes('-a');
      const items = args.filter((a) => !a.startsWith('-'));
      if (items.length < 2) return errStage('Gunakan: cp [-r] <asal> <tujuan>');
      const srcAbs = normalizeLinuxPath(items[0], ctx.cwd, home);
      const dstAbs = normalizeLinuxPath(items[1], ctx.cwd, home);
      const res = await copyLinuxNode(srcAbs, dstAbs, recursive);
      if (res.error) return errStage(res.error);
      return okStage(`Disalin: ${srcAbs} -> ${res.finalPath}`);
    }

    case 'mv': {
      const items = args.filter((a) => !a.startsWith('-'));
      if (items.length < 2) return errStage('Gunakan: mv <asal> <tujuan>');
      const srcAbs = normalizeLinuxPath(items[0], ctx.cwd, home);
      const dstAbs = normalizeLinuxPath(items[1], ctx.cwd, home);
      const res = await moveLinuxNode(srcAbs, dstAbs);
      if (res.error) return errStage(res.error);
      return okStage(`Dipindahkan: ${srcAbs} -> ${res.finalPath}`);
    }

    case 'touch': {
      if (args.length === 0) return errStage('Gunakan: touch <nama_berkas...>');
      const touched: string[] = [];
      for (const t of args) {
        const abs = normalizeLinuxPath(t, ctx.cwd, home);
        const existing = await statLinuxNode(abs);
        if (existing?.type === 'file') {
          touched.push(existing.path);
          continue;
        }
        const res = await writeLinuxFile(abs, '', 'overwrite');
        if (res.error) return errStage(res.error);
        touched.push(res.node?.path ?? abs);
      }
      return okStage(`Berkas siap: ${touched.join(', ')}`);
    }

    case 'write': {
      if (args.length < 2) return errStage('Gunakan: write <berkas> <teks...>');
      const abs = normalizeLinuxPath(args[0], ctx.cwd, home);
      const res = await writeLinuxFile(abs, args.slice(1).join(' '), 'overwrite');
      if (res.error) return errStage(res.error);
      return okStage(`Disimpan ke ${res.node?.path ?? abs}`);
    }

    case 'chmod': {
      if (args.length < 2) return errStage('Gunakan: chmod <mode|755|+x> <target>');
      const abs = normalizeLinuxPath(args[1], ctx.cwd, home);
      const res = await chmodLinuxNode(abs, args[0]);
      if (res.error) return errStage(res.error);
      return okStage(`Izin ${abs} diubah menjadi ${res.newMode}`);
    }

    case 'chown': {
      if (args.length < 2) return errStage('Gunakan: chown <user[:group]> <target>');
      const abs = normalizeLinuxPath(args[1], ctx.cwd, home);
      const res = await chownLinuxNode(abs, args[0]);
      if (res.error) return errStage(res.error);
      return okStage(`Pemilik ${abs} diubah menjadi ${args[0]}`);
    }

    case 'stat': {
      if (!args[0]) return errStage('Gunakan: stat <target>');
      const abs = normalizeLinuxPath(args[0], ctx.cwd, home);
      const node = await statLinuxNode(abs);
      if (!node) return errStage(`stat: '${args[0]}' tidak ditemukan`);
      const oct = node.mode.toString(8).padStart(4, '0');
      const sz = node.sizeBytes ?? node.content.length;
      const lines = [
        `  Berkas : ${node.path}`,
        `  Tipe   : ${node.type === 'dir' ? 'Direktori' : 'Berkas Reguler'}`,
        `  Ukuran : ${sz} byte`,
        `  Akses  : (${oct}/${formatPermissions(node)})  Pemilik: ${node.owner}:${node.group}`,
      ];
      return okStage(lines.join('\n'));
    }

    case 'cat': {
      const numbered = args.includes('-n');
      const files = args.filter((a) => !a.startsWith('-'));
      if (files.length === 0) {
        if (!stdin) return errStage('Gunakan: cat [-n] <berkas>');
        const lines = stdin.split('\n');
        return okStage(
          numbered ? lines.map((l, i) => `${String(i + 1).padStart(4, ' ')}  ${l}`).join('\n') : stdin
        );
      }
      const chunks: string[] = [];
      for (const f of files) {
        const readRes = await readInputTextOrFile(f, stdin, ctx);
        if (readRes.error) return errStage(readRes.error);
        chunks.push(readRes.text);
      }
      const combined = chunks.join('\n');
      if (numbered) {
        return okStage(
          combined
            .split('\n')
            .map((l, i) => `${String(i + 1).padStart(4, ' ')}  ${l}`)
            .join('\n')
        );
      }
      return okStage(combined);
    }

    case 'head':
    case 'tail': {
      let count = 10;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '-n' && args[i + 1]) {
          count = Math.max(1, Number(args[i + 1]) || 10);
          i += 1;
        } else if (/^-\d+$/.test(args[i])) {
          count = Math.max(1, Number(args[i].slice(1)) || 10);
        } else {
          rest.push(args[i]);
        }
      }
      const readRes = await readInputTextOrFile(rest[0], stdin, ctx);
      if (readRes.error) return errStage(readRes.error);
      const lines = readRes.text.split('\n');
      return okStage((cmd === 'head' ? lines.slice(0, count) : lines.slice(-count)).join('\n'));
    }

    case 'wc': {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const fileArg = args.find((a) => !a.startsWith('-'));
      const readRes = await readInputTextOrFile(fileArg, stdin, ctx);
      if (readRes.error) return errStage(readRes.error);
      const lineCount = readRes.text ? readRes.text.split('\n').length : 0;
      const wordCount = readRes.text.trim() ? readRes.text.trim().split(/\s+/).length : 0;
      const charCount = readRes.text.length;
      if (flags === '-l') return okStage(String(lineCount));
      if (flags === '-w') return okStage(String(wordCount));
      if (flags === '-c') return okStage(String(charCount));
      return okStage(`${lineCount} baris · ${wordCount} kata · ${charCount} byte (${readRes.label})`);
    }

    case 'nl': {
      const readRes = await readInputTextOrFile(args[0], stdin, ctx);
      if (readRes.error) return errStage(readRes.error);
      return okStage(
        readRes.text
          .split('\n')
          .map((l, i) => `${String(i + 1).padStart(4, ' ')}  ${l}`)
          .join('\n')
      );
    }

    case 'rev': {
      const readRes = await readInputTextOrFile(args[0], stdin, ctx);
      if (readRes.error) return errStage(readRes.error);
      return okStage(
        readRes.text
          .split('\n')
          .map((l) => [...l].reverse().join(''))
          .join('\n')
      );
    }

    case 'grep': {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const ignoreCase = flags.includes('i');
      const withNumbers = flags.includes('n');
      const invert = flags.includes('v');
      const countOnly = flags.includes('c');
      const rest = args.filter((a) => !a.startsWith('-'));
      const pattern = rest[0];
      if (!pattern) return errStage('Gunakan: grep [-invc] <pola> [berkas]');

      const readRes = await readInputTextOrFile(rest[1], stdin, ctx);
      if (readRes.error) return errStage(readRes.error);

      let regex: RegExp;
      try {
        regex = new RegExp(pattern, ignoreCase ? 'i' : '');
      } catch {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, ignoreCase ? 'i' : '');
      }

      const lines = readRes.text.split('\n');
      const matched: string[] = [];
      lines.forEach((line, idx) => {
        const hit = regex.test(line);
        if (invert ? !hit : hit) {
          matched.push(withNumbers ? `${idx + 1}:${line}` : line);
        }
      });

      if (countOnly) return okStage(String(matched.length));
      if (matched.length === 0) {
        return { stdout: '', stderr: '', exitCode: 1, clearRequested: false, exitRequested: false };
      }
      return okStage(matched.join('\n'));
    }

    case 'sed': {
      const expr = args[0];
      if (!expr) return errStage("Gunakan: sed 's/pola/pengganti/[g]' [berkas]");
      const parsed = parseSedSubstitute(expr);
      if (!parsed) return errStage(`Ekspresi sed tidak didukung: ${expr}`);

      const readRes = await readInputTextOrFile(args[1], stdin, ctx);
      if (readRes.error) return errStage(readRes.error);

      const flags = `${parsed.global ? 'g' : ''}${parsed.ignoreCase ? 'i' : ''}`;
      let regex: RegExp;
      try {
        regex = new RegExp(parsed.pattern, flags);
      } catch (err) {
        return errStage(err instanceof Error ? err.message : 'Regex sed tidak valid');
      }

      const transformed = readRes.text
        .split('\n')
        .map((line) => line.replace(regex, parsed.replacement))
        .join('\n');
      return okStage(transformed);
    }

    case 'sort': {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const reverse = flags.includes('r');
      const numeric = flags.includes('n');
      const unique = flags.includes('u');
      const fileArg = args.find((a) => !a.startsWith('-'));

      const readRes = await readInputTextOrFile(fileArg, stdin, ctx);
      if (readRes.error) return errStage(readRes.error);

      let rows = readRes.text.split('\n');
      rows.sort((a, b) => {
        const cmp = numeric
          ? (parseFloat(a) || 0) - (parseFloat(b) || 0)
          : a.localeCompare(b);
        return reverse ? -cmp : cmp;
      });
      if (unique) rows = Array.from(new Set(rows));
      return okStage(rows.join('\n'));
    }

    case 'uniq': {
      const countMode = args.includes('-c');
      const fileArg = args.find((a) => !a.startsWith('-'));
      const readRes = await readInputTextOrFile(fileArg, stdin, ctx);
      if (readRes.error) return errStage(readRes.error);

      const rows = readRes.text.split('\n');
      const out: string[] = [];
      let i = 0;
      while (i < rows.length) {
        const cur = rows[i];
        let count = 1;
        while (i + count < rows.length && rows[i + count] === cur) {
          count += 1;
        }
        out.push(countMode ? `${String(count).padStart(4, ' ')} ${cur}` : cur);
        i += count;
      }
      return okStage(out.join('\n'));
    }

    case 'cut': {
      let delim = '\t';
      let fieldsSpec = '';
      let fileArg: string | undefined;

      for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '-d' && args[i + 1] !== undefined) {
          delim = args[i + 1];
          i += 1;
        } else if (a.startsWith('-d') && a.length > 2) {
          delim = a.slice(2);
        } else if (a === '-f' && args[i + 1] !== undefined) {
          fieldsSpec = args[i + 1];
          i += 1;
        } else if (a.startsWith('-f') && a.length > 2) {
          fieldsSpec = a.slice(2);
        } else if (!a.startsWith('-')) {
          fileArg = a;
        }
      }
      if (!fieldsSpec) return errStage('Gunakan: cut [-d pemisah] -f kolom[,kolom2] [berkas]');

      const fieldIndices = fieldsSpec
        .split(',')
        .map((n) => parseInt(n.trim(), 10) - 1)
        .filter((n) => !Number.isNaN(n) && n >= 0);

      const readRes = await readInputTextOrFile(fileArg, stdin, ctx);
      if (readRes.error) return errStage(readRes.error);

      const lines = readRes.text.split('\n').map((line) => {
        const cols = line.split(delim);
        return fieldIndices.map((idx) => cols[idx] ?? '').join(delim);
      });
      return okStage(lines.join('\n'));
    }

    case 'tr': {
      if (args.length < 2) return errStage('Gunakan: tr <set1> <set2> (lewat pipa |)');
      const s1 = expandCharRange(args[0]);
      const s2 = expandCharRange(args[1]);
      if (s2.length === 0) return errStage('SET2 tidak boleh kosong');

      const map = new Map<string, string>();
      for (let i = 0; i < s1.length; i += 1) {
        map.set(s1[i], s2[Math.min(i, s2.length - 1)]);
      }
      const out = Array.from(stdin)
        .map((ch) => map.get(ch) ?? ch)
        .join('');
      return okStage(out);
    }

    case 'tee': {
      const append = args.includes('-a');
      const targetArg = args.find((a) => !a.startsWith('-'));
      if (!targetArg) return errStage('Gunakan: <perintah> | tee [-a] <berkas>');
      const abs = normalizeLinuxPath(targetArg, ctx.cwd, home);
      const res = await writeLinuxFile(abs, stdin, append ? 'append' : 'overwrite');
      if (res.error) return errStage(res.error);
      return okStage(stdin);
    }

    case 'xargs': {
      const baseCmd = args.join(' ').trim() || 'echo';
      const items = stdin
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length === 0) return okStage('');
      const quoted = items.map((s) => `'${s.replace(/'/g, '')}'`).join(' ');
      const subRes = await executeScriptBody(`${baseCmd} ${quoted}`, { ...ctx }, depth + 1);
      const outText = subRes.lines.map((l) => l.text).join('\n');
      return {
        stdout: outText,
        stderr: '',
        exitCode: subRes.lastExitCode,
        clearRequested: subRes.clearRequested,
        exitRequested: subRes.exitRequested,
      };
    }

    case 'diff': {
      if (args.length < 2) return errStage('Gunakan: diff <berkas1> <berkas2>');
      const r1 = await readInputTextOrFile(args[0], '', ctx);
      if (r1.error) return errStage(r1.error);
      const r2 = await readInputTextOrFile(args[1], '', ctx);
      if (r2.error) return errStage(r2.error);

      const a = r1.text.split('\n');
      const b = r2.text.split('\n');
      const maxLen = Math.max(a.length, b.length);
      const diffs: string[] = [];
      for (let i = 0; i < maxLen; i += 1) {
        const la = a[i];
        const lb = b[i];
        if (la !== lb) {
          diffs.push(`@@ baris ${i + 1} @@`);
          if (la !== undefined) diffs.push(`- ${la}`);
          if (lb !== undefined) diffs.push(`+ ${lb}`);
        }
      }
      if (diffs.length === 0) return okStage('(kedua berkas identik)');
      return {
        stdout: diffs.join('\n'),
        stderr: '',
        exitCode: 1,
        clearRequested: false,
        exitRequested: false,
      };
    }

    case 'base64': {
      const decodeMode = args.includes('-d') || args.includes('--decode');
      const fileArg = args.find((a) => !a.startsWith('-'));
      const readRes = await readInputTextOrFile(fileArg, stdin, ctx);
      if (readRes.error) return errStage(readRes.error);
      try {
        return okStage(
          decodeMode ? decodeBase64Utf8(readRes.text) : encodeBase64Utf8(readRes.text)
        );
      } catch {
        return errStage('Input Base64 tidak valid.');
      }
    }

    case 'sha256sum': {
      const readRes = await readInputTextOrFile(args[0], stdin, ctx);
      if (readRes.error) return errStage(readRes.error);
      const hash = await computeSha256Hex(readRes.text);
      return okStage(`${hash}  ${readRes.label}`);
    }

    case 'curl': {
      if (!ctx.os.wifiEnabled) {
        return errStage('curl: (6) WiFi OS nonaktif. Aktifkan WiFi di Pengaturan terlebih dahulu.');
      }
      let silent = false;
      let headOnly = false;
      let includeHeaders = false;
      let rawMode = false;
      let outPath: string | null = null;
      let explicitMethod: string | null = null;
      let bodyParts: string[] = [];
      const reqHeaders: Record<string, string> = {};
      let urlArg = '';

      const addHeaderLine = (line: string) => {
        const colon = line.indexOf(':');
        if (colon > 0) {
          const k = line.slice(0, colon).trim();
          const v = line.slice(colon + 1).trim();
          if (k) reqHeaders[k] = v;
        }
      };

      for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '--raw') {
          rawMode = true;
        } else if (a === '--silent') {
          silent = true;
        } else if (a === '--head') {
          headOnly = true;
        } else if (a === '--include') {
          includeHeaders = true;
        } else if ((a === '-X' || a === '--request') && args[i + 1]) {
          explicitMethod = args[i + 1].toUpperCase();
          i += 1;
        } else if (a.startsWith('-X') && a.length > 2) {
          explicitMethod = a.slice(2).toUpperCase();
        } else if ((a === '-H' || a === '--header') && args[i + 1]) {
          addHeaderLine(args[i + 1]);
          i += 1;
        } else if (
          (a === '-d' ||
            a === '--data' ||
            a === '--data-raw' ||
            a === '--data-binary' ||
            a === '--data-urlencode') &&
          args[i + 1] !== undefined
        ) {
          bodyParts.push(args[i + 1]);
          i += 1;
        } else if (a.startsWith('-d') && a.length > 2) {
          bodyParts.push(a.slice(2));
        } else if ((a === '-A' || a === '--user-agent') && args[i + 1]) {
          reqHeaders['User-Agent'] = args[i + 1];
          i += 1;
        } else if ((a === '-u' || a === '--user') && args[i + 1]) {
          reqHeaders['Authorization'] = `Basic ${encodeBase64Utf8(args[i + 1])}`;
          i += 1;
        } else if ((a === '-o' || a === '--output') && args[i + 1]) {
          outPath = args[i + 1];
          i += 1;
        } else if (a.startsWith('-') && a.length > 1 && !a.startsWith('--')) {
          const flags = a.slice(1);
          if (flags.includes('s') || flags.includes('S')) silent = true;
          if (flags.includes('I')) headOnly = true;
          if (flags.includes('i')) includeHeaders = true;
          if (flags.includes('r')) rawMode = true;
        } else if (!a.startsWith('-')) {
          urlArg = a;
        }
      }
      if (!urlArg) {
        return errStage('Gunakan: curl [-X METHOD] [-H "K: V"] [-d body] [-i|-I|-s|-o file] <URL>');
      }

      const fullUrl = normalizeHttpUrl(urlArg);
      const bodyStr = bodyParts.length > 0 ? bodyParts.join('&') : undefined;
      const method = headOnly
        ? explicitMethod || 'HEAD'
        : explicitMethod || (bodyStr !== undefined ? 'POST' : 'GET');

      const res = await fetchBrowserResource(fullUrl, {
        method,
        headers: reqHeaders,
        body: bodyStr,
      });
      if (!res.ok) {
        return errStage(`curl: ${res.error}`);
      }

      const headerBlock = [
        `HTTP/1.1 ${res.status} ${res.statusText || ''}`.trim(),
        `Url-Akhir: ${res.url}`,
        `Content-Type: ${res.mimeType}`,
        ...Object.entries(res.headers)
          .filter(([k]) => ['date', 'server', 'x-request-id', 'ratelimit-remaining'].includes(k.toLowerCase()))
          .map(([k, v]) => `${k}: ${v}`),
      ].join('\n');

      if (headOnly) {
        return okStage(`${headerBlock}\nSize-Est: ${res.sizeKb} KB`);
      }

      let formattedBody = res.content;
      if (!rawMode) {
        const parsedJson = safeParseJsonText<unknown>(res.content);
        if (parsedJson !== null) {
          formattedBody = JSON.stringify(parsedJson, null, 2);
        } else if (isHtmlDocumentString(res.content, res.mimeType)) {
          formattedBody = res.cleanTextHint ?? htmlToCleanReadableText(res.content, res.url);
        }
      }

      if (outPath) {
        const abs = normalizeLinuxPath(outPath, ctx.cwd, home);
        const toSave = res.content;
        const saved = await writeLinuxFile(abs, toSave, 'overwrite', res.mimeType);
        if (saved.error) return errStage(saved.error);
        return okStage(
          silent ? '' : `HTTP ${res.status} · Disimpan ke ${saved.node?.path ?? abs} (${res.sizeKb} KB)`
        );
      }

      const combinedOutput = includeHeaders
        ? `${headerBlock}\n\n${formattedBody}`
        : res.status >= 400
          ? `[HTTP ${res.status} ${res.statusText}]\n${formattedBody}`
          : formattedBody;

      const maxPreview = 16000;
      const body =
        combinedOutput.length > maxPreview
          ? `${combinedOutput.slice(0, maxPreview)}\n... [dipotong, gunakan curl -o untuk simpan penuh]`
          : combinedOutput;
      return {
        stdout: body,
        stderr: '',
        exitCode: res.status >= 400 ? 22 : 0,
        clearRequested: false,
        exitRequested: false,
      };
    }

    case 'wget': {
      if (!ctx.os.wifiEnabled) {
        return errStage('wget: WiFi OS nonaktif. Aktifkan WiFi di Pengaturan terlebih dahulu.');
      }
      let outName: string | null = null;
      let urlArg = '';
      for (let i = 0; i < args.length; i += 1) {
        if ((args[i] === '-O' || args[i] === '-o') && args[i + 1]) {
          outName = args[i + 1];
          i += 1;
        } else if (!args[i].startsWith('-')) {
          urlArg = args[i];
        }
      }
      if (!urlArg) return errStage('Gunakan: wget [-O nama_berkas] <URL>');

      const fullUrl = normalizeHttpUrl(urlArg);
      const t0 = performance.now();
      const res = await fetchBrowserResource(fullUrl);
      if (!res.ok) {
        return errStage(`wget: gagal mengunduh ${fullUrl} (${res.error})`);
      }

      const targetFile = outName || res.name || 'index.html';
      const targetAbs = normalizeLinuxPath(targetFile, ctx.cwd, home);
      const saved = await writeLinuxFile(targetAbs, res.content, 'overwrite', res.mimeType);
      if (saved.error) return errStage(saved.error);

      const ms = Math.max(1, Math.round(performance.now() - t0));
      return okStage(
        `-- ${fullUrl}\nTersambung [${res.status || 200} OK] · ${res.mimeType}\nTersimpan: '${saved.node?.path ?? targetAbs}' (${res.sizeKb} KB dalam ${ms} ms)`
      );
    }

    case 'ping': {
      if (!ctx.os.wifiEnabled) {
        return errStage('ping: Jaringan tidak terjangkau (WiFi OS nonaktif)');
      }
      let count = 3;
      let hostArg = '';
      for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '-c' && args[i + 1]) {
          count = Math.min(5, Math.max(1, Number(args[i + 1]) || 3));
          i += 1;
        } else if (!args[i].startsWith('-')) {
          hostArg = args[i];
        }
      }
      if (!hostArg) return errStage('Gunakan: ping [-c jumlah] <domain_atau_url>');

      const targetUrl = normalizeHttpUrl(hostArg);
      const hostLabel = new URL(targetUrl).hostname;
      const lines: string[] = [`PING ${hostLabel} (${targetUrl}) via proxy OS:`];
      const times: number[] = [];
      let received = 0;

      for (let seq = 1; seq <= count; seq += 1) {
        const t0 = performance.now();
        try {
          const resp = await fetch(
            `/api/browser/proxy?mode=reader&url=${encodeURIComponent(targetUrl)}`,
            { credentials: 'same-origin' }
          );
          const ms = Math.round(performance.now() - t0);
          const bodyText = await resp.text();
          const parsed = safeParseJsonText<ReaderApiPayload>(bodyText);
          if (resp.ok && parsed && !parsed.error) {
            received += 1;
            times.push(ms);
            lines.push(`seq=${seq} status=${resp.status} waktu=${ms} ms`);
          } else {
            lines.push(
              `seq=${seq} GAGAL (${parsed?.error || `HTTP ${resp.status}`}) waktu=${ms} ms`
            );
          }
        } catch {
          lines.push(`seq=${seq} timeout / host tidak terjangkau`);
        }
      }

      const loss = Math.round(((count - received) / count) * 100);
      lines.push(`--- ${hostLabel} ping statistics ---`);
      lines.push(`${count} paket dikirim, ${received} diterima, ${loss}% packet loss`);
      if (times.length > 0) {
        const min = Math.min(...times);
        const max = Math.max(...times);
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        lines.push(`rtt min/avg/max = ${min}/${avg}/${max} ms`);
      }
      return {
        stdout: lines.join('\n'),
        stderr: '',
        exitCode: received > 0 ? 0 : 1,
        clearRequested: false,
        exitRequested: false,
      };
    }

    case 'ps': {
      const alarms = await db.alarms.toArray();
      const pet = loadTamagotchiState();
      const upSec = Math.max(0, Math.floor((Date.now() - ctx.bootTimeMs) / 1000));
      const rows = [
        '  PID USER     STAT  COMMAND',
        '    1 root     Ss    /sbin/pixel-init',
        '   42 pixel    Sl    pixel-compositor --lcd',
        `  100 pixel    R+    /bin/sh (PixelShell ${upSec}s)`,
        `  210 root     ${ctx.os.wifiEnabled ? 'S ' : 'T '}    wlan0-netd (${ctx.os.wifiEnabled ? 'UP' : 'DOWN'})`,
        `  410 pixel    S     tamagotchi-daemon [${pet.name}:${pet.stage}]`,
      ];
      alarms.forEach((a) => {
        rows.push(
          `${String(300 + (a.id ?? 0)).padStart(5, ' ')} pixel    ${a.enabled ? 'S ' : 'T '}    alarmd ${a.time} "${a.label}"`
        );
      });
      return okStage(rows.join('\n'));
    }

    case 'top':
    case 'htop': {
      const [files, alarms, notesCount] = await Promise.all([
        db.files.toArray(),
        db.alarms.toArray(),
        db.notes.count(),
      ]);
      const pet = loadTamagotchiState();
      const totalKb = files.reduce((s, f) => s + f.sizeKb, 0);
      const upSec = Math.max(0, Math.floor((Date.now() - ctx.bootTimeMs) / 1000));
      const activeAlarms = alarms.filter((a) => a.enabled).length;

      const lines = [
        `top - up ${Math.floor(upSec / 60)}m${upSec % 60}s · Baterai: ${ctx.os.batteryLevel}% · Tema: ${ctx.os.themeId}`,
        `Tasks: ${5 + alarms.length} total · ${1 + activeAlarms} aktif · Catatan: ${notesCount}`,
        `Mem  : 64.0M total, ${(18.4 + totalKb / 1024).toFixed(1)}M dipakai (IndexedDB ${totalKb} KB)`,
        `Pet  : ${pet.name} (Lapar:${Math.round(pet.hunger)}% Senang:${Math.round(pet.happiness)}%)`,
        '---------------------------------------------',
        '  PID  USER   S  %CPU  COMMAND',
        '  100  pixel  R   2.1  PixelShell',
        '   42  pixel  S   1.4  lcd-compositor',
        `  410  pixel  S   0.4  tamagotchi-${pet.stage}`,
        ...alarms.map(
          (a) =>
            `${String(300 + (a.id ?? 0)).padStart(5, ' ')}  pixel  ${a.enabled ? 'S' : 'T'}   0.1  alarmd (${a.time})`
        ),
      ];
      return okStage(lines.join('\n'));
    }

    case 'kill': {
      const pid = Number(args[0]);
      if (!pid) return errStage('Gunakan: kill <PID> (cek daftar PID dengan "ps")');
      if (pid < 300) {
        return errStage(`kill: (${pid}) - Tidak dapat menghentikan proses inti OS`);
      }
      if (pid >= 300 && pid < 410) {
        const alarmId = pid - 300;
        const alarm = await db.alarms.get(alarmId);
        if (!alarm) return errStage(`kill: (${pid}) - Tidak ada proses seperti itu`);
        await db.alarms.update(alarmId, { enabled: false });
        return okStage(`Sinyal SIGTERM dikirim ke alarm #${alarmId} (${alarm.time} dimatikan).`);
      }
      return errStage(`kill: (${pid}) - Tidak ada proses seperti itu`);
    }

    case 'free': {
      const files = await db.files.toArray();
      const usedKb = 18432 + files.reduce((s, f) => s + f.sizeKb, 0);
      const totalKb = 65536;
      const freeKb = Math.max(0, totalKb - usedKb);
      return okStage(
        [
          '               total        used        free',
          `Mem:       ${String(totalKb).padStart(9, ' ')}   ${String(usedKb).padStart(9, ' ')}   ${String(freeKb).padStart(9, ' ')} KB`,
        ].join('\n')
      );
    }

    case 'openfile': {
      if (!args[0]) return errStage('Gunakan: openfile <nama_berkas>');
      const abs = normalizeLinuxPath(args[0], ctx.cwd, home);
      const node = await statLinuxNode(abs);
      if (!node || node.type === 'dir') return errStage(`Berkas tidak ditemukan: ${args[0]}`);
      const name = getBaseName(node.path);
      const mime = node.mimeType ?? 'text/plain';
      if (node.osFileId) {
        if (mime.startsWith('image/')) {
          ctx.os.openApp('gallery', { fileId: node.osFileId });
        } else if (mime.startsWith('audio/')) {
          ctx.os.openApp('music', { fileId: node.osFileId });
        } else if (mime.startsWith('video/')) {
          ctx.os.openApp('video', { fileId: node.osFileId });
        } else {
          ctx.os.openApp('ebook', { fileId: node.osFileId, title: name, textContent: node.content });
        }
      } else {
        ctx.os.openApp('ebook', { title: name, textContent: node.content });
      }
      return okStage(`Membuka ${node.path}...`);
    }

    case 'apps': {
      const q = args[0]?.toLowerCase() ?? '';
      const filtered = ctx.apps.filter(
        (a) =>
          !q ||
          a.id.toLowerCase().includes(q) ||
          a.nameId.toLowerCase().includes(q) ||
          a.nameEn.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      );
      const rows = filtered.map(
        (a) =>
          `${a.id.padEnd(14, ' ')} ${(ctx.os.language === 'id' ? a.nameId : a.nameEn).padEnd(14, ' ')} [${a.category}]`
      );
      return okStage(rows.join('\n'));
    }

    case 'open':
    case 'launch': {
      const q = args[0]?.toLowerCase();
      if (!q) return errStage('Gunakan: open <appId> (cek daftar: apps)');
      const match =
        ctx.apps.find((a) => a.id.toLowerCase() === q) ??
        ctx.apps.find((a) => a.nameId.toLowerCase() === q || a.nameEn.toLowerCase() === q);
      if (!match) return errStage(`Aplikasi "${args[0]}" tidak ditemukan. Ketik "apps".`);
      ctx.os.openApp(match.id);
      return okStage(`Meluncurkan ${ctx.os.language === 'id' ? match.nameId : match.nameEn} (${match.id})...`);
    }

    case 'theme': {
      const target = args[0]?.toLowerCase() as OSThemeId | undefined;
      if (!target) {
        return okStage(`Tema aktif: ${ctx.os.themeId}\nPilihan: ${OS_THEMES.map((t) => t.id).join(', ')}`);
      }
      const valid = OS_THEMES.find((t) => t.id === target);
      if (!valid) return errStage(`Tema tidak valid. Pilihan: ${OS_THEMES.map((t) => t.id).join(', ')}`);
      ctx.os.setTheme(valid.id);
      ctx.env.THEME = valid.id;
      return okStage(`Tema LCD diubah ke: ${valid.id} (${ctx.os.language === 'id' ? valid.nameId : valid.nameEn})`);
    }

    case 'sound': {
      const sub = args[0]?.toLowerCase();
      if (!sub) return okStage(`Audio OS: ${ctx.os.soundEnabled ? 'ON' : 'OFF'} (sound on|off|beep)`);
      if (sub === 'on') {
        ctx.os.setSoundEnabled(true);
        soundEngine.playCue('select');
        return okStage('Suara OS diaktifkan.');
      }
      if (sub === 'off') {
        ctx.os.setSoundEnabled(false);
        return okStage('Suara OS dibisukan.');
      }
      if (sub === 'beep') {
        const freq = Math.min(4000, Math.max(80, Number(args[1]) || 880));
        const ms = Math.min(1200, Math.max(30, Number(args[2]) || 120));
        soundEngine.playTone(freq, ms, 'square', 0.16);
        return okStage(`Beep ${freq} Hz (${ms} ms)`);
      }
      return errStage('Gunakan: sound on | off | beep [hz] [ms]');
    }

    case 'lang': {
      const code = args[0]?.toLowerCase();
      if (code === 'id' || code === 'en') {
        ctx.os.setLanguage(code);
        ctx.env.LANG = code;
        return okStage(`Bahasa OS diubah ke: ${code.toUpperCase()}`);
      }
      return okStage(`Bahasa aktif: ${ctx.os.language} (gunakan: lang id | lang en)`);
    }

    case 'notify': {
      if (args.length < 2) return errStage('Gunakan: notify <judul> <pesan...>');
      ctx.os.pushNotification(args[0], args.slice(1).join(' '), 'terminal');
      return okStage(`Notifikasi dikirim: [${args[0]}]`);
    }

    case 'battery':
      return okStage(
        `Baterai: ${ctx.os.batteryLevel}% (${ctx.os.isCharging ? 'Mengisi Daya' : 'Baterai'}) · WiFi: ${ctx.os.wifiEnabled ? 'Aktif' : 'Nonaktif'}`
      );

    case 'df': {
      const files = await db.files.toArray();
      const lines = ['MOUNT /mnt/os    FILE   UKURAN'];
      let totalKb = 0;
      for (const folder of OS_FOLDERS) {
        const items = files.filter((f) => f.folder === folder);
        const kb = items.reduce((s, f) => s + f.sizeKb, 0);
        totalKb += kb;
        lines.push(`${folder.padEnd(15, ' ')} ${String(items.length).padStart(4, ' ')}   ${String(kb).padStart(4, ' ')} KB`);
      }
      lines.push('------------------------------');
      lines.push(`TOTAL           ${String(files.length).padStart(4, ' ')}   ${String(totalKb).padStart(4, ' ')} KB`);
      return okStage(lines.join('\n'));
    }

    case 'neofetch':
    case 'sysinfo': {
      const [files, notes, contacts, alarms] = await Promise.all([
        db.files.toArray(),
        db.notes.count(),
        db.contacts.count(),
        db.alarms.count(),
      ]);
      const host = ((await statLinuxNode('/etc/hostname'))?.content || 'retro-pixel').trim();
      const totalKb = files.reduce((s, f) => s + f.sizeKb, 0);
      const art = [
        `┌────────┐  ${ctx.env.USER || 'pixel'}@${host}`,
        '│ ▄████▄ │  ------------------',
        '│ █ ▄▄ █ │  OS: Retro Pixel Linux 2.4 LTS',
        '│ ▀████▀ │  Kernel: 2.4.0-monochrome',
        '│ [≡][≡] │  Shell: PixelShell + nano + man',
        `│ 123456 │  Tema: ${ctx.os.themeId} · Baterai: ${ctx.os.batteryLevel}%`,
        `└────────┘  Mount /mnt/os: ${files.length} berkas (${totalKb} KB)`,
        `            Catatan: ${notes} · Kontak: ${contacts} · Alarm: ${alarms}`,
      ];
      return okStage(art.join('\n'));
    }

    case 'notes': {
      const sub = args[0]?.toLowerCase();
      if (!sub) {
        const rows = await db.notes.toArray();
        if (rows.length === 0) return okStage('(tidak ada catatan)');
        return okStage(
          rows.map((n) => `#${n.id} [${n.title}]\n   ${n.body.split('\n')[0].slice(0, 48)}`).join('\n')
        );
      }
      if (sub === 'add') {
        const raw = args.slice(1).join(' ');
        const [titlePart, ...bodyParts] = raw.split('|');
        const title = titlePart?.trim();
        const body = bodyParts.join('|').trim() || title;
        if (!title) return errStage('Gunakan: notes add Judul | Isi catatan');
        const id = await db.notes.add({ title, body, updatedAt: Date.now() });
        return okStage(`Catatan #${id} "${title}" tersimpan.`);
      }
      if (sub === 'rm') {
        const id = Number(args[1]);
        if (!id) return errStage('Gunakan: notes rm <id>');
        await db.notes.delete(id);
        return okStage(`Catatan #${id} dihapus.`);
      }
      return errStage('Gunakan: notes | notes add <judul> | <isi> | notes rm <id>');
    }

    case 'contacts': {
      const q = args.join(' ').toLowerCase();
      const rows = await db.contacts.toArray();
      const filtered = rows.filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q)
      );
      if (filtered.length === 0) return okStage('(kontak tidak ditemukan)');
      return okStage(
        filtered.map((c) => `${c.name.padEnd(12, ' ')} ${c.phone.padEnd(17, ' ')} [${c.group}]`).join('\n')
      );
    }

    case 'alarms': {
      const sub = args[0]?.toLowerCase();
      if (!sub) {
        const rows = await db.alarms.toArray();
        if (rows.length === 0) return okStage('(tidak ada alarm)');
        return okStage(rows.map((a) => `#${a.id} ${a.time} [${a.enabled ? 'ON ' : 'OFF'}] ${a.label}`).join('\n'));
      }
      if (sub === 'add') {
        const time = args[1] ?? '';
        const label = args.slice(2).join(' ') || 'Alarm Terminal';
        if (!/^\d{2}:\d{2}$/.test(time)) return errStage('Gunakan: alarms add <HH:MM> <label>');
        const id = await db.alarms.add({ time, label, enabled: true, days: 'Setiap Hari' });
        return okStage(`Alarm #${id} diset pukul ${time} (${label}).`);
      }
      if (sub === 'toggle') {
        const id = Number(args[1]);
        const item = id ? await db.alarms.get(id) : undefined;
        if (!item) return errStage('Alarm tidak ditemukan. Cek ID via "alarms".');
        await db.alarms.update(id, { enabled: !item.enabled });
        return okStage(`Alarm #${id} (${item.time}) sekarang ${!item.enabled ? 'ON' : 'OFF'}.`);
      }
      return errStage('Gunakan: alarms | alarms add <HH:MM> <label> | alarms toggle <id>');
    }

    case 'calc': {
      const expr = args.join(' ');
      if (!expr) return errStage('Gunakan: calc <ekspresi>, mis. calc (12+8)*2');
      try {
        const val = safeEvalMath(expr);
        const formatted = Number.isInteger(val) ? String(val) : Number(val.toFixed(6)).toString();
        return okStage(`${expr} = ${formatted}`);
      } catch (err) {
        return errStage(err instanceof Error ? err.message : 'Ekspresi matematika tidak valid');
      }
    }

    case 'run':
    case 'sh':
    case 'bash': {
      if (depth >= 3) return errStage('Batas rekursi skrip tercapai (maks 3 tingkat).');
      if (!args[0]) return errStage(`Gunakan: ${cmd} <skrip.sh>`);
      const targetAbs = normalizeLinuxPath(args[0], ctx.cwd, home);
      const node = await statLinuxNode(targetAbs);
      if (!node) return errStage(`Skrip tidak ditemukan: ${args[0]}`);
      if (node.type === 'dir') return errStage(`${args[0]} adalah sebuah direktori`);
      return executeScriptNode(node, ctx, depth);
    }

    default:
      return errStage(`Perintah tidak dikenal: "${cmdRaw}". Ketik "help" atau "man".`, 127);
  }
}

async function executeScriptNode(
  node: LinuxVfsNode,
  ctx: ShellRuntimeContext,
  depth: number
): Promise<StageResult> {
  if (depth >= 3) return errStage('Batas rekursi skrip tercapai (maks 3 tingkat).');
  const scriptRes = await executeScriptBody(node.content, ctx, depth + 1);
  const out = scriptRes.lines.filter((l) => l.kind !== 'err').map((l) => l.text);
  const errs = scriptRes.lines.filter((l) => l.kind === 'err').map((l) => l.text);
  if (errs.length > 0) {
    return {
      stdout: out.join('\n'),
      stderr: errs.join('\n'),
      exitCode: scriptRes.lastExitCode || 1,
      clearRequested: scriptRes.clearRequested,
      exitRequested: scriptRes.exitRequested,
      openNano: scriptRes.openNano,
    };
  }
  return {
    stdout: out.join('\n'),
    stderr: '',
    exitCode: scriptRes.lastExitCode,
    clearRequested: scriptRes.clearRequested,
    exitRequested: scriptRes.exitRequested,
    openNano: scriptRes.openNano,
  };
}

// ---------- Structured Block Script & Chain Execution ----------

function splitStatementsTopLevel(script: string): string[] {
  const stmts: string[] = [];
  const normalized = script.replace(/\r\n/g, '\n');
  let buf = '';
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;
  let atLineStart = true;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];

    // POSIX line continuation (`\` followed by `\n`) outside single quotes
    if (ch === '\\' && quote !== "'" && i + 1 < normalized.length) {
      const nextCh = normalized[i + 1];
      if (nextCh === '\n') {
        i += 1;
        continue;
      }
      buf += ch + nextCh;
      atLineStart = false;
      i += 1;
      continue;
    }

    if ((ch === '"' || ch === "'") && (!quote || quote === ch)) {
      quote = quote === ch ? null : ch;
      buf += ch;
      atLineStart = false;
      continue;
    }

    if (!quote && parenDepth === 0 && ch === '#' && (atLineStart || /\s/.test(normalized[i - 1] ?? ''))) {
      // Skip comment until end of line (keep \n for statement boundary)
      while (i + 1 < normalized.length && normalized[i + 1] !== '\n') {
        i += 1;
      }
      continue;
    }

    if (quote !== "'" && normalized.startsWith('$(', i)) {
      parenDepth += 1;
      buf += '$(';
      atLineStart = false;
      i += 1;
      continue;
    }
    if (quote !== "'" && parenDepth > 0 && ch === ')') {
      parenDepth -= 1;
      buf += ch;
      atLineStart = false;
      continue;
    }

    if (!quote && parenDepth === 0 && (ch === '\n' || ch === ';')) {
      if (buf.trim()) stmts.push(buf.trim());
      buf = '';
      atLineStart = ch === '\n';
      continue;
    }

    buf += ch;
    if (ch === '\n') {
      atLineStart = true;
    } else if (!/[ \t]/.test(ch)) {
      atLineStart = false;
    }
  }

  if (buf.trim()) stmts.push(buf.trim());
  return stmts;
}

async function executeSingleChainString(
  rawInput: string,
  ctx: ShellRuntimeContext,
  depth: number
): Promise<{
  lines: Omit<ShellOutputLine, 'id'>[];
  exitCode: number;
  clearRequested: boolean;
  exitRequested: boolean;
  openNano?: NanoLaunchPayload | null;
}> {
  const outputLines: Omit<ShellOutputLine, 'id'>[] = [];
  let clearRequested = false;
  let exitRequested = false;
  let openNano: NanoLaunchPayload | null = null;
  let lastExitCode = ctx.lastExitCode;

  const chains = parseCommandChains(rawInput);

  for (const chain of chains) {
    if (chain.op === '&&' && lastExitCode !== 0) continue;
    if (chain.op === '||' && lastExitCode === 0) continue;

    const subExpanded = await expandCommandSubstitutions(chain.command, ctx, depth);
    const stages = splitOutsideQuotes(subExpanded, '|');
    let pipeText = '';
    let stageExit = 0;
    let stageErrored = false;

    for (let sIdx = 0; sIdx < stages.length; sIdx += 1) {
      const tokens = tokenizeArgs(stages[sIdx], ctx);
      const { args, redirectMode, redirectTarget } = extractRedirection(tokens);
      const res = await runStage(args, pipeText, ctx, depth);

      if (res.clearRequested) clearRequested = true;
      if (res.exitRequested) exitRequested = true;
      if (res.openNano) openNano = res.openNano;
      stageExit = res.exitCode;

      if (res.stderr) {
        outputLines.push({ kind: 'err', text: res.stderr });
        stageErrored = true;
        stageExit = res.exitCode || 1;
        break;
      }

      if (redirectMode && redirectTarget) {
        const home = ctx.env.HOME || DEFAULT_HOME;
        const abs = normalizeLinuxPath(redirectTarget, ctx.cwd, home);
        const saved = await writeLinuxFile(abs, res.stdout, redirectMode);
        if (saved.error) {
          outputLines.push({ kind: 'err', text: saved.error });
          stageErrored = true;
          stageExit = 1;
          break;
        }
        pipeText = '';
        if (sIdx === stages.length - 1) {
          outputLines.push({
            kind: 'sys',
            text: `[OK] Output ditulis ke ${saved.node?.path ?? abs}`,
          });
        }
      } else {
        pipeText = res.stdout;
      }
    }

    lastExitCode = stageExit;
    ctx.lastExitCode = stageExit;
    if (!stageErrored && pipeText) {
      outputLines.push({ kind: 'out', text: pipeText });
    }
    if (exitRequested || openNano) break;
  }

  return {
    lines: outputLines,
    exitCode: lastExitCode,
    clearRequested,
    exitRequested,
    openNano,
  };
}

function collectBlockEnd(
  stmts: string[],
  startIdx: number,
  openTokens: RegExp,
  closeTokens: RegExp
): number {
  let depth = 1;
  for (let i = startIdx; i < stmts.length; i += 1) {
    const s = stmts[i].trim();
    if (openTokens.test(s)) depth += 1;
    else if (closeTokens.test(s)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

async function executeStatements(
  stmts: string[],
  ctx: ShellRuntimeContext,
  depth: number
): Promise<ShellExecutionResult> {
  const outputLines: Omit<ShellOutputLine, 'id'>[] = [];
  let clearRequested = false;
  let exitRequested = false;
  let openNano: NanoLaunchPayload | null = null;
  let i = 0;

  while (i < stmts.length) {
    const stmt = stmts[i].trim();
    if (!stmt || stmt.startsWith('#')) {
      i += 1;
      continue;
    }

    // `for VAR in ITEM1 ITEM2 ...`
    const forMatch = stmt.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.*)$/);
    if (forMatch) {
      const varName = forMatch[1];
      const rawItems = forMatch[2];
      let doIdx = i + 1;
      if (doIdx < stmts.length && stmts[doIdx].trim() === 'do') {
        doIdx += 1;
      }
      const doneIdx = collectBlockEnd(stmts, doIdx, /^(for|while)\b/, /^done$/);
      if (doneIdx < 0) {
        outputLines.push({ kind: 'err', text: 'Kesalahan sintaks: "for" tanpa "done"' });
        ctx.lastExitCode = 2;
        break;
      }

      const expandedList = await expandCommandSubstitutions(rawItems, ctx, depth);
      const items = tokenizeArgs(expandedList, ctx);
      const bodyStmts = stmts.slice(doIdx, doneIdx);

      for (const item of items) {
        ctx.env[varName] = item;
        const bodyRes = await executeStatements(bodyStmts, ctx, depth);
        outputLines.push(...bodyRes.lines);
        if (bodyRes.clearRequested) clearRequested = true;
        if (bodyRes.exitRequested) exitRequested = true;
        if (bodyRes.openNano) openNano = bodyRes.openNano;
        if (exitRequested || openNano) break;
      }

      i = doneIdx + 1;
      if (exitRequested || openNano) break;
      continue;
    }

    // `while COND`
    const whileMatch = stmt.match(/^while\s+(.*)$/);
    if (whileMatch) {
      const condRaw = whileMatch[1];
      let doIdx = i + 1;
      if (doIdx < stmts.length && stmts[doIdx].trim() === 'do') {
        doIdx += 1;
      }
      const doneIdx = collectBlockEnd(stmts, doIdx, /^(for|while)\b/, /^done$/);
      if (doneIdx < 0) {
        outputLines.push({ kind: 'err', text: 'Kesalahan sintaks: "while" tanpa "done"' });
        ctx.lastExitCode = 2;
        break;
      }

      const bodyStmts = stmts.slice(doIdx, doneIdx);
      let guard = 0;
      while (guard < 150) {
        guard += 1;
        const condRes = await executeSingleChainString(condRaw, ctx, depth);
        outputLines.push(...condRes.lines);
        if (condRes.exitCode !== 0) break;

        const bodyRes = await executeStatements(bodyStmts, ctx, depth);
        outputLines.push(...bodyRes.lines);
        if (bodyRes.clearRequested) clearRequested = true;
        if (bodyRes.exitRequested) exitRequested = true;
        if (bodyRes.openNano) openNano = bodyRes.openNano;
        if (exitRequested || openNano) break;
      }
      if (guard >= 150) {
        outputLines.push({ kind: 'err', text: 'Batas iterasi loop while tercapai (maks 150).' });
        ctx.lastExitCode = 1;
      }

      i = doneIdx + 1;
      if (exitRequested || openNano) break;
      continue;
    }

    // `if COND`
    const ifMatch = stmt.match(/^if\s+(.*)$/);
    if (ifMatch) {
      const fiIdx = collectBlockEnd(stmts, i + 1, /^if\b/, /^fi$/);
      if (fiIdx < 0) {
        outputLines.push({ kind: 'err', text: 'Kesalahan sintaks: "if" tanpa "fi"' });
        ctx.lastExitCode = 2;
        break;
      }

      // Parse branches (if ... then ... elif ... then ... else ... fi) at nesting level 0
      const branches: { cond: string | null; body: string[] }[] = [];
      let curCond: string | null = ifMatch[1];
      let curBody: string[] = [];
      let inThenBody = false;
      let nestedIf = 0;

      for (let k = i + 1; k < fiIdx; k += 1) {
        const s = stmts[k].trim();
        if (/^if\b/.test(s)) nestedIf += 1;
        if (/^fi$/.test(s)) nestedIf -= 1;

        if (nestedIf === 0) {
          if (!inThenBody && s === 'then') {
            inThenBody = true;
            continue;
          }
          const elifM = s.match(/^elif\s+(.*)$/);
          if (elifM) {
            branches.push({ cond: curCond, body: curBody });
            curCond = elifM[1];
            curBody = [];
            inThenBody = false;
            continue;
          }
          if (s === 'else') {
            branches.push({ cond: curCond, body: curBody });
            curCond = null;
            curBody = [];
            inThenBody = true;
            continue;
          }
        }
        curBody.push(stmts[k]);
      }
      branches.push({ cond: curCond, body: curBody });

      for (const br of branches) {
        let takeBranch = false;
        if (br.cond === null) {
          takeBranch = true;
        } else {
          const condRes = await executeSingleChainString(br.cond, ctx, depth);
          outputLines.push(...condRes.lines);
          takeBranch = condRes.exitCode === 0;
        }
        if (takeBranch) {
          const bodyRes = await executeStatements(br.body, ctx, depth);
          outputLines.push(...bodyRes.lines);
          if (bodyRes.clearRequested) clearRequested = true;
          if (bodyRes.exitRequested) exitRequested = true;
          if (bodyRes.openNano) openNano = bodyRes.openNano;
          break;
        }
      }

      i = fiIdx + 1;
      if (exitRequested || openNano) break;
      continue;
    }

    // Standard single chain command
    const res = await executeSingleChainString(stmt, ctx, depth);
    outputLines.push(...res.lines);
    if (res.clearRequested) clearRequested = true;
    if (res.exitRequested) exitRequested = true;
    if (res.openNano) openNano = res.openNano;
    i += 1;
    if (exitRequested || openNano) break;
  }

  return {
    lines: outputLines,
    nextCwd: ctx.cwd,
    nextEnv: { ...ctx.env, PWD: ctx.cwd },
    nextAliases: { ...ctx.aliases },
    lastExitCode: ctx.lastExitCode,
    clearRequested,
    exitRequested,
    openNano,
  };
}

async function executeScriptBody(
  rawScript: string,
  ctx: ShellRuntimeContext,
  depth: number
): Promise<ShellExecutionResult> {
  const stmts = splitStatementsTopLevel(rawScript);
  return executeStatements(stmts, ctx, depth);
}

export async function executeTerminalCommand(
  rawInput: string,
  ctx: ShellRuntimeContext
): Promise<ShellExecutionResult> {
  const host = ((await statLinuxNode('/etc/hostname'))?.content || 'retro-pixel').trim();
  const workingCtx: ShellRuntimeContext = {
    ...ctx,
    cwd: ctx.cwd || DEFAULT_HOME,
    env: {
      ...ctx.env,
      HOME: ctx.env.HOME || DEFAULT_HOME,
      PWD: ctx.cwd || DEFAULT_HOME,
      HOSTNAME: host,
      THEME: ctx.os.themeId,
      LANG: ctx.os.language,
      BATTERY: String(ctx.os.batteryLevel),
    },
    aliases: { ...ctx.aliases },
  };
  return executeScriptBody(rawInput, workingCtx, 0);
}

// ---------- Tab Auto-Complete Engine ----------

export async function autocompleteTerminalInput(
  input: string,
  cwd: string,
  apps: ShellAppSummary[],
  aliases: Record<string, string> = {}
): Promise<{ completed: string; suggestions: string[] }> {
  const trailingSpace = /\s$/.test(input);
  const parts = input.trimStart().split(/\s+/);

  if (parts.length <= 1 && !trailingSpace) {
    const prefix = (parts[0] ?? '').toLowerCase();
    if (!prefix.includes('/')) {
      const pool = Array.from(new Set([...TERMINAL_COMMAND_LIST, ...Object.keys(aliases)])).sort();
      const matches = pool.filter((c) => c.startsWith(prefix));
      if (matches.length === 1) {
        return { completed: `${matches[0]} `, suggestions: [] };
      }
      return { completed: input, suggestions: matches.slice(0, 12) };
    }
  }

  const cmd = parts[0].toLowerCase();
  const currentArg = trailingSpace ? '' : parts[parts.length - 1];
  const baseInput = trailingSpace ? input : input.slice(0, input.length - currentArg.length);

  if (cmd === 'open' || cmd === 'launch') {
    const matches = apps
      .map((a) => a.id)
      .filter((id) => id.toLowerCase().startsWith(currentArg.toLowerCase()));
    if (matches.length === 1) return { completed: `${baseInput}${matches[0]} `, suggestions: [] };
    return { completed: input, suggestions: matches.slice(0, 12) };
  }

  if (cmd === 'theme') {
    const matches = OS_THEMES.map((t) => t.id).filter((id) => id.startsWith(currentArg.toLowerCase()));
    if (matches.length === 1) return { completed: `${baseInput}${matches[0]} `, suggestions: [] };
    return { completed: input, suggestions: matches };
  }

  if (cmd === 'man') {
    const matches = Object.keys(LINUX_MAN_PAGES)
      .sort()
      .filter((m) => m.startsWith(currentArg.toLowerCase()));
    if (matches.length === 1) return { completed: `${baseInput}${matches[0]} `, suggestions: [] };
    return { completed: input, suggestions: matches.slice(0, 12) };
  }

  // Linux VFS & /mnt/os path completion
  const slashIdx = currentArg.lastIndexOf('/');
  const argDir = slashIdx >= 0 ? currentArg.slice(0, slashIdx + 1) : '';
  const namePrefix = slashIdx >= 0 ? currentArg.slice(slashIdx + 1) : currentArg;
  const searchDirAbs =
    argDir === '/'
      ? '/'
      : argDir
        ? normalizeLinuxPath(argDir, cwd, DEFAULT_HOME)
        : cwd;

  const { nodes } = await listLinuxDir(searchDirAbs);
  const candidates = nodes
    .map((n) => {
      const name = getBaseName(n.path);
      return n.type === 'dir' ? `${name}/` : name;
    })
    .filter((name) => name.toLowerCase().startsWith(namePrefix.toLowerCase()))
    .map((name) => `${argDir}${name}`);

  if (candidates.length === 1) {
    const suffix = candidates[0].endsWith('/') ? '' : ' ';
    return { completed: `${baseInput}${candidates[0]}${suffix}`, suggestions: [] };
  }
  return { completed: input, suggestions: candidates.slice(0, 12) };
}
