'use client';

export type OfficeModule = 'docs' | 'sheets' | 'slides';
export type CellFormatType = 'plain' | 'currency' | 'percent';

export interface SheetCellData {
  raw: string;
  bold?: boolean;
  align?: 'left' | 'right';
  format?: CellFormatType;
}

export type SheetCellsMap = Record<string, SheetCellData>;

export type SlideLayout = 'title' | 'bullets' | 'two-col';
export type SlideTheme = 'lcd' | 'ink' | 'paper' | 'blueprint';

export interface OfficeSlide {
  id: string;
  title: string;
  body: string;
  bodyRight?: string;
  layout: SlideLayout;
  theme: SlideTheme;
}

export const OFFICE_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const OFFICE_ROW_COUNT = 16;

export const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MIME_PPTX =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export type OfficeFileKind =
  | 'docx'
  | 'doc'
  | 'xlsx'
  | 'csv'
  | 'pptx'
  | 'slides'
  | 'text'
  | null;

export class OfficeReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfficeReadError';
  }
}

export function getOfficeFileKind(filename: string, mimeType = ''): OfficeFileKind {
  const lower = filename.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) return 'docx';
  if (lower.endsWith('.doc') || mime.includes('msword')) return 'doc';
  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    mime.includes('spreadsheetml') ||
    mime.includes('ms-excel')
  ) {
    return 'xlsx';
  }
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || mime.includes('text/csv')) {
    return 'csv';
  }
  if (lower.endsWith('.pptx') || mime.includes('presentationml')) return 'pptx';
  if (lower.endsWith('.elxslides.json') || lower.endsWith('.slides.json')) return 'slides';
  if (
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm')
  ) {
    return 'text';
  }
  return null;
}

export function isOpenableInOffice(filename: string, mimeType = ''): boolean {
  return getOfficeFileKind(filename, mimeType) !== null;
}

export function stripDangerousOfficeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal mengonversi berkas biner'));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx >= 0 ? dataUrl.slice(0, commaIdx).toLowerCase() : '';
  const payload = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

  if (commaIdx >= 0 && !header.includes(';base64')) {
    try {
      const decoded = decodeURIComponent(payload);
      return new TextEncoder().encode(decoded).buffer;
    } catch {
      return new TextEncoder().encode(payload).buffer;
    }
  }

  let normalized = payload.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }
  const binStr = atob(normalized);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i += 1) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes.buffer;
}

// ==========================================
// 1. WORD (.DOCX) CODEC (Resilient MS Word Reader + Writer)
// ==========================================

const WEB_IMAGE_MIMES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
};

function isWebImageMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m === 'image/png' ||
    m === 'image/jpeg' ||
    m === 'image/jpg' ||
    m === 'image/gif' ||
    m === 'image/webp' ||
    m === 'image/svg+xml' ||
    m === 'image/bmp'
  );
}

function makeUnsupportedMediaSvgUri(label: string): string {
  const safe = label.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="36" viewBox="0 0 220 36"><rect width="220" height="36" fill="#f3f4f6" stroke="#111827" stroke-width="2"/><text x="110" y="22" font-family="monospace" font-size="11" font-weight="bold" fill="#111827" text-anchor="middle">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function extractRtfAsHtml(rtf: string): string {
  const stripped = rtf
    .replace(/\{\\\*\\[^}]+\}/g, '')
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\line\b/g, '\n')
    .replace(/\\tab\b/g, '  ')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .trim();

  const paras = stripped
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${escapeHtmlText(l)}</p>`);

  return paras.join('') || '<p>(Dokumen RTF kosong)</p>';
}

function extractXmlParagraphLines(xmlDoc: Document): string[] {
  const lines: string[] = [];
  const pNodes = Array.from(xmlDoc.getElementsByTagName('*')).filter(
    (el) => el.localName === 'p'
  );
  for (const p of pNodes) {
    const parts: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const ln = el.localName;
      if (ln === 'Choice') return; // Avoid duplicating mc:AlternateContent Choice + Fallback
      if (ln === 't' || ln === 'delText' || ln === 'instrText') {
        if (ln !== 'instrText') parts.push(el.textContent ?? '');
        return;
      }
      if (ln === 'tab') {
        parts.push(' ');
        return;
      }
      el.childNodes.forEach(walk);
    };
    walk(p);
    const line = parts.join('').replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
  }
  return lines;
}

function extractUniqueTextBoxLines(docXml: Document): string[] {
  const collected: string[] = [];
  const seen = new Set<string>();
  const txbxNodes = Array.from(docXml.getElementsByTagName('*')).filter(
    (el) => el.localName === 'txbxContent' || el.localName === 'textbox'
  );

  for (const box of txbxNodes) {
    // Skip duplicate nested txbxContent inside AlternateContent > Choice if Fallback exists
    let cur: Node | null = box.parentNode;
    let inChoiceWithFallback = false;
    while (cur && cur.nodeType === Node.ELEMENT_NODE) {
      const cel = cur as HTMLElement;
      if (cel.localName === 'Choice') {
        const altParent = cel.parentNode as HTMLElement | null;
        if (
          altParent &&
          Array.from(altParent.children).some((c) => c.localName === 'Fallback')
        ) {
          inChoiceWithFallback = true;
          break;
        }
      }
      cur = cur.parentNode;
    }
    if (inChoiceWithFallback) continue;

    const pNodes = Array.from(box.getElementsByTagName('*')).filter(
      (el) => el.localName === 'p'
    );
    for (const p of pNodes) {
      const tNodes = Array.from(p.getElementsByTagName('*')).filter(
        (el) => el.localName === 't'
      );
      const line = tNodes.map((t) => t.textContent ?? '').join('').trim();
      if (line && !seen.has(line)) {
        seen.add(line);
        collected.push(line);
      }
    }
  }
  return collected;
}

async function parseDocxXmlFallback(
  zip: import('jszip'),
  lowerPathMap: Map<string, string>
): Promise<string> {
  const parser = new DOMParser();

  // Locate main document XML (standard or case-insensitive)
  const docKey =
    lowerPathMap.get('word/document.xml') ||
    Array.from(lowerPathMap.entries()).find(([k]) =>
      /^word\/document\d*\.xml$/i.test(k)
    )?.[1];

  if (!docKey) {
    throw new OfficeReadError(
      'Struktur XML utama (.docx) tidak ditemukan di dalam berkas.'
    );
  }

  // Build rId -> data:image/... map from word/_rels/document.xml.rels
  const relMediaMap = new Map<string, string>();
  const docRelsKey = lowerPathMap.get('word/_rels/document.xml.rels');
  if (docRelsKey && zip.files[docRelsKey]) {
    try {
      const relsText = await zip.files[docRelsKey].async('string');
      const relsXml = parser.parseFromString(relsText, 'application/xml');
      const relEls = Array.from(relsXml.getElementsByTagName('*')).filter(
        (el) => el.localName === 'Relationship'
      );
      for (const rel of relEls) {
        const id = rel.getAttribute('Id') || '';
        const type = (rel.getAttribute('Type') || '').toLowerCase();
        const target = rel.getAttribute('Target') || '';
        const mode = (rel.getAttribute('TargetMode') || '').toLowerCase();
        if (!id || !target || mode === 'external' || !type.includes('image')) continue;

        const cleanTarget = target.replace(/^\/+/, '').replace(/^\.\//, '');
        const resolvedLower = cleanTarget.startsWith('word/')
          ? cleanTarget.toLowerCase()
          : `word/${cleanTarget}`.toLowerCase();
        const actualKey = lowerPathMap.get(resolvedLower);
        if (!actualKey || !zip.files[actualKey]) continue;

        const ext = actualKey.split('.').pop()?.toLowerCase() || '';
        const mime = WEB_IMAGE_MIMES[ext];
        if (mime) {
          const b64 = await zip.files[actualKey].async('base64');
          relMediaMap.set(id, `data:${mime};base64,${b64}`);
        } else {
          relMediaMap.set(id, makeUnsupportedMediaSvgUri(`[Gambar ${ext.toUpperCase() || 'Word'}]`));
        }
      }
    } catch {
      // Non-fatal: continue reading text even if rels fails
    }
  }

  const docText = await zip.files[docKey].async('string');
  const xmlDoc = parser.parseFromString(docText, 'application/xml');
  const bodyEl =
    Array.from(xmlDoc.getElementsByTagName('*')).find((el) => el.localName === 'body') ||
    xmlDoc.documentElement;

  const renderParagraph = (pEl: Element): string => {
    const pPr = Array.from(pEl.children).find((c) => c.localName === 'pPr');
    const pStyle = pPr
      ? Array.from(pPr.children)
          .find((c) => c.localName === 'pStyle')
          ?.getAttribute('w:val') ||
        Array.from(pPr.children)
          .find((c) => c.localName === 'pStyle')
          ?.getAttribute('val') ||
        ''
      : '';
    const hasNum = pPr
      ? Array.from(pPr.children).some((c) => c.localName === 'numPr')
      : false;
    const jcEl = pPr ? Array.from(pPr.children).find((c) => c.localName === 'jc') : null;
    const alignVal =
      (jcEl?.getAttribute('w:val') || jcEl?.getAttribute('val') || '').toLowerCase();

    const chunks: string[] = [];

    const walkRuns = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      const ln = el.localName;
      if (ln === 'Choice' || ln === 'txbxContent' || ln === 'pPr') return;

      if (ln === 'r') {
        const rPr = Array.from(el.children).find((c) => c.localName === 'rPr');
        const isBold = rPr
          ? Array.from(rPr.children).some(
              (c) =>
                c.localName === 'b' &&
                c.getAttribute('w:val') !== '0' &&
                c.getAttribute('w:val') !== 'false'
            )
          : false;
        const isItalic = rPr
          ? Array.from(rPr.children).some(
              (c) =>
                c.localName === 'i' &&
                c.getAttribute('w:val') !== '0' &&
                c.getAttribute('w:val') !== 'false'
            )
          : false;
        const isUnderline = rPr
          ? Array.from(rPr.children).some(
              (c) => c.localName === 'u' && c.getAttribute('w:val') !== 'none'
            )
          : false;

        let runHtml = '';
        const walkRunChildren = (rn: Node) => {
          if (rn.nodeType !== Node.ELEMENT_NODE) return;
          const rel = rn as Element;
          const rln = rel.localName;
          if (rln === 'Choice' || rln === 'rPr') return;
          if (rln === 't') {
            runHtml += escapeHtmlText(rel.textContent ?? '');
            return;
          }
          if (rln === 'br' || rln === 'cr') {
            runHtml += '<br/>';
            return;
          }
          if (rln === 'tab') {
            runHtml += '&nbsp;&nbsp;';
            return;
          }
          if (rln === 'blip') {
            const embedId =
              rel.getAttribute('r:embed') ||
              rel.getAttributeNS(
                'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                'embed'
              ) ||
              rel.getAttributeNS(
                'http://purl.oclc.org/ooxml/officeDocument/relationships',
                'embed'
              ) ||
              '';
            const src = embedId ? relMediaMap.get(embedId) : '';
            if (src) {
              runHtml += `<img src="${src}" alt="Gambar Word" />`;
            }
            return;
          }
          if (rln === 'imagedata') {
            const rid =
              rel.getAttribute('r:id') ||
              rel.getAttributeNS(
                'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                'id'
              ) ||
              '';
            const src = rid ? relMediaMap.get(rid) : '';
            if (src) {
              runHtml += `<img src="${src}" alt="Gambar Word" />`;
            }
            return;
          }
          rel.childNodes.forEach(walkRunChildren);
        };
        el.childNodes.forEach(walkRunChildren);

        if (runHtml) {
          if (isBold) runHtml = `<b>${runHtml}</b>`;
          if (isItalic) runHtml = `<i>${runHtml}</i>`;
          if (isUnderline) runHtml = `<u>${runHtml}</u>`;
          chunks.push(runHtml);
        }
        return;
      }

      el.childNodes.forEach(walkRuns);
    };

    pEl.childNodes.forEach(walkRuns);
    const inner = chunks.join('').trim();
    if (!inner) return '';

    const alignAttr =
      alignVal === 'center' || alignVal === 'right' || alignVal === 'justify'
        ? ` style="text-align:${alignVal}"`
        : '';

    const styleLower = pStyle.toLowerCase();
    if (styleLower.includes('title') || styleLower === 'heading1' || styleLower === '1') {
      return `<h1${alignAttr}>${inner}</h1>`;
    }
    if (styleLower === 'heading2' || styleLower === '2') {
      return `<h2${alignAttr}>${inner}</h2>`;
    }
    if (styleLower === 'heading3' || styleLower === '3') {
      return `<h3${alignAttr}>${inner}</h3>`;
    }
    if (hasNum) {
      return `<li>${inner}</li>`;
    }
    return `<p${alignAttr}>${inner}</p>`;
  };

  const renderTable = (tblEl: Element): string => {
    const trNodes = Array.from(tblEl.children).filter((c) => c.localName === 'tr');
    const rowsHtml = trNodes
      .map((tr) => {
        const tcNodes = Array.from(tr.children).filter((c) => c.localName === 'tc');
        const cellsHtml = tcNodes
          .map((tc) => {
            const pNodes = Array.from(tc.children).filter((c) => c.localName === 'p');
            const cellBody = pNodes
              .map(renderParagraph)
              .filter(Boolean)
              .join('')
              .replace(/<\/?p[^>]*>/g, ' ')
              .trim();
            return `<td>${cellBody || '&nbsp;'}</td>`;
          })
          .join('');
        return cellsHtml ? `<tr>${cellsHtml}</tr>` : '';
      })
      .filter(Boolean)
      .join('');
    return rowsHtml
      ? `<table border="1" style="width:100%;border-collapse:collapse;margin:6px 0">${rowsHtml}</table>`
      : '';
  };

  const htmlParts: string[] = [];
  let inList = false;

  const flushList = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };

  Array.from(bodyEl.children).forEach((child) => {
    if (child.localName === 'p') {
      const rendered = renderParagraph(child);
      if (!rendered) return;
      if (rendered.startsWith('<li>')) {
        if (!inList) {
          htmlParts.push('<ul>');
          inList = true;
        }
        htmlParts.push(rendered);
      } else {
        flushList();
        htmlParts.push(rendered);
      }
    } else if (child.localName === 'tbl') {
      flushList();
      const tbl = renderTable(child);
      if (tbl) htmlParts.push(tbl);
    }
  });
  flushList();

  return htmlParts.join('');
}

export async function parseDocxBufferToHtml(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  if (bytes.length < 4) {
    throw new OfficeReadError('Berkas .docx kosong atau terlalu pendek.');
  }

  // Check OLE2 Compound Binary signature (legacy .doc or Word encrypted .docx)
  if (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    const asciiSample = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 32768)));
    if (/EncryptedPackage|EncryptionInfo/i.test(asciiSample)) {
      throw new OfficeReadError(
        'Berkas Word ini terkunci kata sandi/enkripsi. Buka proteksi di Word terlebih dahulu.'
      );
    }
    throw new OfficeReadError(
      'Berkas ini berformat Word lama (.doc 97–2003 biner). Simpan ulang sebagai .docx standar di Word.'
    );
  }

  // Check non-ZIP disguised HTML or RTF renamed as .docx
  const isZipPk = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZipPk) {
    const headText = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.slice(0, Math.min(bytes.length, 4096)))
      .trim();
    if (/^\{\\rtf/i.test(headText)) {
      const fullRtf = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return stripDangerousOfficeHtml(extractRtfAsHtml(fullRtf));
    }
    if (/<(html|!doctype|w:worddocument|body|p|div)/i.test(headText)) {
      const fullHtml = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return stripDangerousOfficeHtml(fullHtml);
    }
    throw new OfficeReadError('Berkas bukan dokumen .docx (OOXML ZIP) yang valid.');
  }

  const JSZipMod = await import('jszip');
  const JSZipCtor = (JSZipMod.default ?? JSZipMod) as typeof JSZipMod.default;
  const rawZip = await JSZipCtor.loadAsync(buf);

  const lowerPathMap = new Map<string, string>();
  Object.keys(rawZip.files).forEach((entryPath) => {
    if (!rawZip.files[entryPath].dir) {
      lowerPathMap.set(entryPath.toLowerCase(), entryPath);
    }
  });

  if (lowerPathMap.has('encryptedpackage') || lowerPathMap.has('encryptioninfo')) {
    throw new OfficeReadError(
      'Berkas Word ini terkunci kata sandi/enkripsi dan tidak dapat dibaca.'
    );
  }

  const parser = new DOMParser();

  // Pre-extract headers, footers, and text boxes from original Word XML
  const headerLines: string[] = [];
  const footerLines: string[] = [];
  let textBoxLines: string[] = [];

  const headerKeys = Array.from(lowerPathMap.entries())
    .filter(([k]) => /^word\/header\d*\.xml$/i.test(k))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  for (const [, actualKey] of headerKeys) {
    try {
      const xmlText = await rawZip.files[actualKey].async('string');
      const doc = parser.parseFromString(xmlText, 'application/xml');
      headerLines.push(...extractXmlParagraphLines(doc));
    } catch {
      // Skip unreadable header
    }
  }

  const footerKeys = Array.from(lowerPathMap.entries())
    .filter(([k]) => /^word\/footer\d*\.xml$/i.test(k))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  for (const [, actualKey] of footerKeys) {
    try {
      const xmlText = await rawZip.files[actualKey].async('string');
      const doc = parser.parseFromString(xmlText, 'application/xml');
      footerLines.push(...extractXmlParagraphLines(doc));
    } catch {
      // Skip unreadable footer
    }
  }

  const mainDocKey =
    lowerPathMap.get('word/document.xml') ||
    Array.from(lowerPathMap.entries()).find(([k]) => /^word\/document\d*\.xml$/i.test(k))?.[1];

  if (mainDocKey) {
    try {
      const mainXmlText = await rawZip.files[mainDocKey].async('string');
      const mainDoc = parser.parseFromString(mainXmlText, 'application/xml');
      textBoxLines = extractUniqueTextBoxLines(mainDoc);
    } catch {
      // Non-fatal
    }
  }

  // Create sanitized ZIP copy so external image links / missing media targets / uppercase paths never crash Mammoth
  const cleanZip = new JSZipCtor();
  const entries = Object.keys(rawZip.files);
  for (const entryPath of entries) {
    const fileObj = rawZip.files[entryPath];
    if (fileObj.dir) continue;
    const normalizedLower = entryPath.toLowerCase();

    // Canonicalize critical Word OOXML paths to lowercase if original Word/tool used uppercase
    let targetPath = entryPath;
    if (normalizedLower === '[content_types].xml') {
      targetPath = '[Content_Types].xml';
    } else if (
      normalizedLower === '_rels/.rels' ||
      normalizedLower.startsWith('word/')
    ) {
      targetPath = normalizedLower;
    }

    if (normalizedLower.endsWith('.rels')) {
      try {
        const relsStr = await fileObj.async('string');
        const relsDoc = parser.parseFromString(relsStr, 'application/xml');
        const relEls = Array.from(relsDoc.getElementsByTagName('*')).filter(
          (el) => el.localName === 'Relationship'
        );
        const relDir = normalizedLower.includes('/_rels/')
          ? normalizedLower.slice(0, normalizedLower.indexOf('/_rels/'))
          : '';

        let mutated = false;
        for (const rel of relEls) {
          const typeAttr = (rel.getAttribute('Type') || '').toLowerCase();
          const modeAttr = (rel.getAttribute('TargetMode') || '').toLowerCase();
          const tgtAttr = rel.getAttribute('Target') || '';
          const isImageRel = typeAttr.includes('/image');

          if (isImageRel) {
            const cleanTgt = tgtAttr.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
            const baseSegments = relDir ? relDir.split('/').filter(Boolean) : [];
            const tgtSegments = cleanTgt.split('/').filter(Boolean);
            const resolvedSegments = cleanTgt.startsWith('word/')
              ? [...tgtSegments]
              : [...baseSegments];
            if (!cleanTgt.startsWith('word/')) {
              for (const seg of tgtSegments) {
                if (seg === '..') {
                  resolvedSegments.pop();
                } else if (seg !== '.') {
                  resolvedSegments.push(seg);
                }
              }
            }
            const resolved = resolvedSegments.join('/').toLowerCase();
            if (
              modeAttr === 'external' ||
              /^https?:\/\//i.test(tgtAttr) ||
              /^file:\/\//i.test(tgtAttr) ||
              !lowerPathMap.has(resolved)
            ) {
              rel.parentNode?.removeChild(rel);
              mutated = true;
            }
          }
        }

        if (mutated) {
          const serialized = new XMLSerializer().serializeToString(relsDoc);
          cleanZip.file(targetPath, serialized);
          continue;
        }
      } catch {
        // Fallback to raw bytes below
      }
    }

    const rawBytes = await fileObj.async('uint8array');
    cleanZip.file(targetPath, rawBytes);
  }

  const sanitizedBuf = await cleanZip.generateAsync({ type: 'arraybuffer' });

  // Stage 1: Mammoth rich HTML conversion with safe browser image handler
  let bodyHtml = '';
  try {
    const mammothMod = await import('mammoth');
    const mammothApi =
      (mammothMod as unknown as { default?: typeof mammothMod }).default ?? mammothMod;

    const result = await mammothApi.convertToHtml(
      { arrayBuffer: sanitizedBuf },
      {
        ignoreEmptyParagraphs: false,
        convertImage: mammothApi.images.imgElement(async (image) => {
          try {
            const mime = (image.contentType || '').toLowerCase();
            if (!isWebImageMime(mime)) {
              const shortExt = mime.split('/').pop()?.toUpperCase() || 'WORD';
              return {
                src: makeUnsupportedMediaSvgUri(`[Gambar ${shortExt}]`),
                alt: `Gambar (${mime || 'Word'})`,
              };
            }
            const b64 = await image.read('base64');
            return {
              src: `data:${mime};base64,${b64}`,
              alt: 'Gambar Dokumen',
            };
          } catch {
            return {
              src: makeUnsupportedMediaSvgUri('[Gambar tidak terbaca]'),
              alt: 'Gambar tidak terbaca',
            };
          }
        }),
      }
    );
    bodyHtml = stripDangerousOfficeHtml(result.value || '').trim();
  } catch {
    // Fall back to Stage 2 direct XML parser below
    bodyHtml = '';
  }

  // Stage 2: Direct OpenXML XML fallback parser if Stage 1 failed or produced empty output
  if (!bodyHtml) {
    bodyHtml = stripDangerousOfficeHtml(
      await parseDocxXmlFallback(rawZip, lowerPathMap)
    ).trim();
  }

  const sections: string[] = [];

  if (headerLines.length > 0) {
    sections.push(
      `<aside data-word-part="header"><b>[Header]</b> ${headerLines
        .map(escapeHtmlText)
        .join(' · ')}</aside>`
    );
  }

  if (bodyHtml) {
    sections.push(bodyHtml);
  }

  // Append text box contents only if not already rendered inside bodyHtml
  if (textBoxLines.length > 0) {
    const plainBody = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const missingBoxes = textBoxLines.filter((line) => !plainBody.includes(line));
    if (missingBoxes.length > 0) {
      sections.push(
        `<aside data-word-part="textbox"><b>[Kotak Teks]</b><br/>${missingBoxes
          .map(escapeHtmlText)
          .join('<br/>')}</aside>`
      );
    }
  }

  if (footerLines.length > 0) {
    sections.push(
      `<aside data-word-part="footer"><b>[Footer]</b> ${footerLines
        .map(escapeHtmlText)
        .join(' · ')}</aside>`
    );
  }

  const finalHtml = sections.join('').trim();
  return finalHtml || '<p>(Dokumen .docx kosong)</p>';
}

interface RunFormat {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export async function buildDocxBlobFromHtml(title: string, html: string): Promise<Blob> {
  const docx = await import('docx');
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html || '<p></p>', 'text/html');

  const collectRuns = (
    node: Node,
    fmt: RunFormat = {}
  ): (InstanceType<typeof docx.TextRun> | InstanceType<typeof docx.ImageRun>)[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent ?? '';
      if (!txt) return [];
      return [
        new docx.TextRun({
          text: txt,
          bold: fmt.bold,
          italics: fmt.italics,
          underline: fmt.underline ? {} : undefined,
          strike: fmt.strike,
        }),
      ];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') {
      return [new docx.TextRun({ break: 1 })];
    }
    if (tag === 'img') {
      const src = el.getAttribute('src') || '';
      const imgMatch = /^data:image\/(png|jpeg|jpg|gif|bmp);base64,(.+)$/i.exec(src);
      if (imgMatch) {
        try {
          const rawExt = imgMatch[1].toLowerCase();
          const imgType: 'png' | 'jpg' | 'gif' | 'bmp' =
            rawExt === 'jpeg' || rawExt === 'jpg'
              ? 'jpg'
              : rawExt === 'gif'
                ? 'gif'
                : rawExt === 'bmp'
                  ? 'bmp'
                  : 'png';
          const imgBuf = dataUrlToArrayBuffer(src);
          return [
            new docx.ImageRun({
              type: imgType,
              data: new Uint8Array(imgBuf),
              transformation: { width: 320, height: 220 },
            }),
          ];
        } catch {
          return [new docx.TextRun({ text: `[${el.getAttribute('alt') || 'Gambar'}]` })];
        }
      }
      const altText = el.getAttribute('alt');
      return altText ? [new docx.TextRun({ text: `[${altText}]` })] : [];
    }

    const styleAttr = (el.getAttribute('style') || '').toLowerCase();
    const nextFmt: RunFormat = {
      bold:
        fmt.bold ||
        tag === 'b' ||
        tag === 'strong' ||
        tag === 'th' ||
        /font-weight\s*:\s*(bold|[6-9]00)/.test(styleAttr),
      italics:
        fmt.italics || tag === 'i' || tag === 'em' || /font-style\s*:\s*italic/.test(styleAttr),
      underline:
        fmt.underline || tag === 'u' || /text-decoration[^;]*underline/.test(styleAttr),
      strike:
        fmt.strike ||
        tag === 's' ||
        tag === 'del' ||
        tag === 'strike' ||
        /text-decoration[^;]*line-through/.test(styleAttr),
    };

    const runs: (InstanceType<typeof docx.TextRun> | InstanceType<typeof docx.ImageRun>)[] = [];
    el.childNodes.forEach((child) => {
      runs.push(...collectRuns(child, nextFmt));
    });
    return runs;
  };

  const resolveAlignment = (el: HTMLElement) => {
    const alignAttr = (el.getAttribute('align') || '').toLowerCase();
    const style = (el.getAttribute('style') || '').toLowerCase();
    if (alignAttr === 'center' || /text-align\s*:\s*center/.test(style)) {
      return docx.AlignmentType.CENTER;
    }
    if (alignAttr === 'right' || /text-align\s*:\s*right/.test(style)) {
      return docx.AlignmentType.RIGHT;
    }
    if (alignAttr === 'justify' || /text-align\s*:\s*justify/.test(style)) {
      return docx.AlignmentType.JUSTIFIED;
    }
    return undefined;
  };

  const blocks: (InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>)[] = [];

  const processBlockNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent ?? '').trim();
      if (txt) {
        blocks.push(
          new docx.Paragraph({
            spacing: { after: 120 },
            children: [new docx.TextRun({ text: txt })],
          })
        );
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'h1') {
      blocks.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_1,
          alignment: resolveAlignment(el),
          spacing: { before: 200, after: 120 },
          children: collectRuns(el, { bold: true }),
        })
      );
      return;
    }
    if (tag === 'h2') {
      blocks.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_2,
          alignment: resolveAlignment(el),
          spacing: { before: 160, after: 100 },
          children: collectRuns(el, { bold: true }),
        })
      );
      return;
    }
    if (tag === 'h3' || tag === 'h4') {
      blocks.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_3,
          alignment: resolveAlignment(el),
          spacing: { before: 120, after: 80 },
          children: collectRuns(el, { bold: true }),
        })
      );
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li');
      items.forEach((li, idx) => {
        const runs = collectRuns(li);
        if (tag === 'ol') {
          blocks.push(
            new docx.Paragraph({
              spacing: { after: 80 },
              indent: { left: 360 },
              children: [new docx.TextRun({ text: `${idx + 1}. ` }), ...runs],
            })
          );
        } else {
          blocks.push(
            new docx.Paragraph({
              bullet: { level: 0 },
              spacing: { after: 80 },
              children: runs.length ? runs : [new docx.TextRun({ text: '' })],
            })
          );
        }
      });
      return;
    }
    if (tag === 'table') {
      const trs = Array.from(el.querySelectorAll('tr'));
      const tableRows = trs
        .map((tr) => {
          const cells = Array.from(tr.children).filter((c) => {
            const ct = c.tagName.toLowerCase();
            return ct === 'td' || ct === 'th';
          });
          if (cells.length === 0) return null;
          return new docx.TableRow({
            children: cells.map((cellEl) => {
              const isHeader = cellEl.tagName.toLowerCase() === 'th';
              const runs = collectRuns(cellEl, { bold: isHeader });
              return new docx.TableCell({
                children: [
                  new docx.Paragraph({
                    children: runs.length ? runs : [new docx.TextRun({ text: '' })],
                  }),
                ],
              });
            }),
          });
        })
        .filter((r): r is InstanceType<typeof docx.TableRow> => r !== null);

      if (tableRows.length > 0) {
        blocks.push(
          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: tableRows,
          })
        );
      }
      return;
    }
    if (tag === 'hr') {
      blocks.push(
        new docx.Paragraph({
          border: {
            bottom: { color: '666666', space: 1, style: docx.BorderStyle.SINGLE, size: 6 },
          },
          spacing: { before: 100, after: 100 },
        })
      );
      return;
    }
    if (tag === 'aside') {
      const runs = collectRuns(el);
      blocks.push(
        new docx.Paragraph({
          border: {
            left: { color: '888888', space: 4, style: docx.BorderStyle.SINGLE, size: 6 },
          },
          indent: { left: 200 },
          spacing: { before: 80, after: 120 },
          children: runs.length ? runs : [new docx.TextRun({ text: '' })],
        })
      );
      return;
    }

    const hasChildBlocks = Array.from(el.children).some((c) =>
      /^(p|div|h1|h2|h3|h4|ul|ol|table|hr|aside)$/i.test(c.tagName)
    );
    if ((tag === 'div' || tag === 'section') && hasChildBlocks) {
      el.childNodes.forEach(processBlockNode);
      return;
    }

    const runs = collectRuns(el);
    blocks.push(
      new docx.Paragraph({
        alignment: resolveAlignment(el),
        spacing: { after: 120 },
        children: runs.length ? runs : [new docx.TextRun({ text: '' })],
      })
    );
  };

  parsed.body.childNodes.forEach(processBlockNode);

  if (blocks.length === 0) {
    blocks.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '' })] }));
  }

  const doc = new docx.Document({
    title: title || 'Dokumen Elixir Office',
    creator: 'Elixir Office',
    sections: [{ children: blocks }],
  });

  const blob = await docx.Packer.toBlob(doc);
  return new Blob([blob], { type: MIME_DOCX });
}

// ==========================================
// 2. SPREADSHEET (.XLSX) CODEC
// ==========================================
export async function parseXlsxBufferToCells(buf: ArrayBuffer): Promise<{
  cells: SheetCellsMap;
  sheetTitle?: string;
}> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array', cellFormula: true });
  const firstSheetName = wb.SheetNames[0];
  const ws = firstSheetName ? wb.Sheets[firstSheetName] : undefined;
  const cells: SheetCellsMap = {};

  if (ws) {
    for (let r = 0; r < OFFICE_ROW_COUNT; r += 1) {
      for (let c = 0; c < OFFICE_COLS.length; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr] as
          | { v?: string | number | boolean; f?: string; t?: string; z?: string }
          | undefined;
        if (!cell) continue;
        const raw = cell.f
          ? `=${cell.f}`
          : cell.v !== undefined && cell.v !== null
            ? String(cell.v)
            : '';
        if (!raw) continue;

        const fmtStr = typeof cell.z === 'string' ? cell.z : '';
        let format: CellFormatType = 'plain';
        if (fmtStr.includes('%')) format = 'percent';
        else if (/rp|idr|\$|#,##0/i.test(fmtStr)) format = 'currency';

        const isNum = cell.t === 'n' || (!Number.isNaN(Number(raw)) && raw !== '');
        cells[`${OFFICE_COLS[c]}${r + 1}`] = {
          raw,
          bold: r === 0,
          align: isNum || raw.startsWith('=') ? 'right' : 'left',
          format,
        };
      }
    }
  }

  return { cells, sheetTitle: firstSheetName };
}

export async function buildXlsxBlobFromCells(
  sheetName: string,
  cells: SheetCellsMap,
  evaluateCellFn: (
    coord: string,
    cellMap: SheetCellsMap
  ) => { display: string; num: number | null; error?: string }
): Promise<Blob> {
  const XLSX = await import('xlsx');
  const ws: Record<string, unknown> = {};
  let maxR = 0;
  let maxC = 0;

  for (let r = 0; r < OFFICE_ROW_COUNT; r += 1) {
    for (let c = 0; c < OFFICE_COLS.length; c += 1) {
      const coord = `${OFFICE_COLS[c]}${r + 1}`;
      const meta = cells[coord];
      if (!meta || !meta.raw) continue;

      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);

      const addr = XLSX.utils.encode_cell({ r, c });
      const ev = evaluateCellFn(coord, cells);
      const numFmt =
        meta.format === 'currency'
          ? '"Rp "#,##0'
          : meta.format === 'percent'
            ? '0%'
            : undefined;

      if (meta.raw.startsWith('=')) {
        ws[addr] = {
          t: ev.num !== null ? 'n' : 's',
          v: ev.num !== null ? ev.num : ev.display,
          f: meta.raw.slice(1),
          ...(numFmt ? { z: numFmt } : {}),
        };
      } else {
        const asNum = Number(meta.raw);
        if (!Number.isNaN(asNum) && meta.raw.trim() !== '') {
          ws[addr] = {
            t: 'n',
            v: asNum,
            ...(numFmt ? { z: numFmt } : {}),
          };
        } else {
          ws[addr] = {
            t: 's',
            v: meta.raw,
          };
        }
      }
    }
  }

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(maxR, 1), c: Math.max(maxC, 1) },
  });
  ws['!cols'] = OFFICE_COLS.map(() => ({ wch: 16 }));

  const wb = XLSX.utils.book_new();
  const safeTab = sheetName.replace(/[\\/?*[\]:]/g, '').trim().slice(0, 31) || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws as unknown as import('xlsx').WorkSheet, safeTab);

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: MIME_XLSX });
}

// ==========================================
// 3. PRESENTATION (.PPTX) CODEC
// ==========================================
export async function parsePptxBufferToSlides(buf: ArrayBuffer): Promise<OfficeSlide[]> {
  const JSZipMod = await import('jszip');
  const JSZip = (JSZipMod as unknown as { default?: typeof JSZipMod }).default ?? JSZipMod;
  const zip = await JSZip.loadAsync(buf);

  const slideFiles = Object.keys(zip.files)
    .map((path) => {
      const m = /^ppt\/slides\/slide(\d+)\.xml$/i.exec(path);
      return m ? { path, num: parseInt(m[1], 10) } : null;
    })
    .filter((entry): entry is { path: string; num: number } => entry !== null)
    .sort((a, b) => a.num - b.num);

  const parser = new DOMParser();
  const slides: OfficeSlide[] = [];

  for (let i = 0; i < slideFiles.length; i += 1) {
    const entry = slideFiles[i];
    const xmlText = await zip.files[entry.path].async('string');
    const doc = parser.parseFromString(xmlText, 'application/xml');

    const shapeBlocks: string[][] = [];
    const shapes = Array.from(doc.getElementsByTagName('*')).filter(
      (el) => el.localName === 'sp'
    );

    for (const sp of shapes) {
      const paragraphs: string[] = [];
      const pNodes = Array.from(sp.getElementsByTagName('*')).filter(
        (el) => el.localName === 'p'
      );
      for (const pNode of pNodes) {
        const tNodes = Array.from(pNode.getElementsByTagName('*')).filter(
          (el) => el.localName === 't'
        );
        const line = tNodes.map((t) => t.textContent ?? '').join('').trim();
        if (line) paragraphs.push(line);
      }
      if (paragraphs.length > 0) {
        shapeBlocks.push(paragraphs);
      }
    }

    const title = shapeBlocks[0]?.[0] || `Slide ${i + 1}`;
    const remainingFirstShape = shapeBlocks[0]?.slice(1) ?? [];
    const otherShapes = shapeBlocks.slice(1);

    let layout: SlideLayout = 'bullets';
    let body = '';
    let bodyRight: string | undefined;

    if (otherShapes.length >= 2 && remainingFirstShape.length === 0) {
      layout = 'two-col';
      body = otherShapes[0].join('\n');
      bodyRight = otherShapes
        .slice(1)
        .map((blk) => blk.join('\n'))
        .join('\n\n');
    } else {
      const allLines = [
        ...remainingFirstShape,
        ...otherShapes.flatMap((blk) => blk),
      ];
      body = allLines.join('\n');
      if (i === 0 && allLines.length <= 2) {
        layout = 'title';
      }
    }

    slides.push({
      id: `pptx-${i + 1}-${Date.now()}`,
      title,
      body: body || ' ',
      bodyRight,
      layout,
      theme: i % 2 === 0 ? 'paper' : 'lcd',
    });
  }

  if (slides.length === 0) {
    slides.push({
      id: `pptx-empty-${Date.now()}`,
      title: 'Presentasi Kosong',
      body: 'Tidak ada teks slide ditemukan di berkas PPTX.',
      layout: 'title',
      theme: 'lcd',
    });
  }

  return slides;
}

const PPTX_THEME_COLORS: Record<
  SlideTheme,
  { fill: string; color: string; accent: string }
> = {
  lcd: { fill: 'D8FF9A', color: '0B1305', accent: '2E4A11' },
  ink: { fill: '0B1120', color: 'F8FAFC', accent: '38BDF8' },
  paper: { fill: 'FAF8F5', color: '111827', accent: '374151' },
  blueprint: { fill: '0F294A', color: 'E0F2FE', accent: '7DD3FC' },
};

export async function buildPptxBlobFromSlides(
  deckTitle: string,
  slides: OfficeSlide[]
): Promise<Blob> {
  const pptxMod = await import('pptxgenjs');
  const PptxGenJS = pptxMod.default;
  const pptx = new PptxGenJS();

  pptx.title = deckTitle || 'Presentasi Elixir Office';
  pptx.author = 'Elixir Office';
  pptx.layout = 'LAYOUT_16x9';

  for (const sl of slides) {
    const palette = PPTX_THEME_COLORS[sl.theme] ?? PPTX_THEME_COLORS.lcd;
    const slide = pptx.addSlide();
    slide.background = { color: palette.fill };

    if (sl.layout === 'title') {
      slide.addText(sl.title || 'Judul Presentasi', {
        x: 0.7,
        y: 1.7,
        w: 8.6,
        h: 1.2,
        fontSize: 32,
        bold: true,
        color: palette.color,
        align: 'center',
        valign: 'middle',
      });
      slide.addText(sl.body || '', {
        x: 1.0,
        y: 3.1,
        w: 8.0,
        h: 1.5,
        fontSize: 16,
        color: palette.accent,
        align: 'center',
        valign: 'top',
      });
    } else if (sl.layout === 'two-col') {
      slide.addText(sl.title || 'Judul Slide', {
        x: 0.6,
        y: 0.45,
        w: 8.8,
        h: 0.7,
        fontSize: 24,
        bold: true,
        color: palette.color,
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 0.6,
        y: 1.22,
        w: 8.8,
        h: 0,
        line: { color: palette.accent, width: 1.5 },
      });
      slide.addText(sl.body || '', {
        x: 0.6,
        y: 1.45,
        w: 4.2,
        h: 3.7,
        fontSize: 15,
        color: palette.color,
        valign: 'top',
      });
      slide.addText(sl.bodyRight || '', {
        x: 5.2,
        y: 1.45,
        w: 4.2,
        h: 3.7,
        fontSize: 15,
        color: palette.color,
        valign: 'top',
      });
    } else {
      slide.addText(sl.title || 'Judul Slide', {
        x: 0.6,
        y: 0.45,
        w: 8.8,
        h: 0.7,
        fontSize: 24,
        bold: true,
        color: palette.color,
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 0.6,
        y: 1.22,
        w: 8.8,
        h: 0,
        line: { color: palette.accent, width: 1.5 },
      });
      slide.addText(sl.body || '', {
        x: 0.6,
        y: 1.45,
        w: 8.8,
        h: 3.7,
        fontSize: 16,
        color: palette.color,
        valign: 'top',
      });
    }
  }

  const out = (await pptx.write({ outputType: 'blob' })) as Blob;
  return new Blob([out], { type: MIME_PPTX });
}
