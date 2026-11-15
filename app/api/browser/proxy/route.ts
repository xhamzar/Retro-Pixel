import dns from 'node:dns/promises';
import net from 'node:net';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPrivateOrBlockedIP(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateOrBlockedIP(normalized.slice(7));
  }
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true;
    }
    return false;
  }
  return true;
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are supported.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal')
  ) {
    throw new Error('Access to local or internal hosts is blocked.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrBlockedIP(host)) {
      throw new Error('Access to private IP addresses is blocked.');
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) {
      throw new Error('Domain could not be resolved.');
    }
    for (const rec of records) {
      if (isPrivateOrBlockedIP(rec.address)) {
        throw new Error('Domain resolves to a blocked private address.');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('blocked')) {
      throw err;
    }
    throw new Error(`DNS lookup failed for ${host}.`);
  }

  return parsed;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/\s+/g, ' ')
    .trim();
}

function buildErrorHtml(targetUrl: string, title: string, detail: string): string {
  const safeUrl = escapeHtml(targetUrl);
  const safeTitle = escapeHtml(title);
  const safeDetail = escapeHtml(detail);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: monospace; background: #D8FF9A; color: #000; margin: 0; padding: 16px; }
    .box { border: 3px solid #000; background: #BDE879; padding: 14px; max-width: 560px; margin: 0 auto; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    p { font-size: 13px; line-height: 1.45; margin: 6px 0; word-break: break-word; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button { border: 2px solid #000; background: #000; color: #D8FF9A; font-family: monospace; font-weight: bold; padding: 6px 10px; cursor: pointer; font-size: 12px; }
    button.sec { background: #D8FF9A; color: #000; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${safeTitle}</h1>
    <p><strong>URL:</strong> ${safeUrl}</p>
    <p>${safeDetail}</p>
    <div class="actions">
      <button onclick="window.parent.postMessage({ type: 'PIXEL_BROWSER_OPEN_READER', url: ${JSON.stringify(targetUrl)} }, '*')">Coba Mode Baca LCD</button>
      <button class="sec" onclick="window.parent.postMessage({ type: 'PIXEL_BROWSER_SEARCH', query: ${JSON.stringify(targetUrl)} }, '*')">Cari di Web</button>
    </div>
  </div>
  <script>
    window.parent.postMessage({ type: 'PIXEL_BROWSER_LOADED', url: ${JSON.stringify(targetUrl)}, title: ${JSON.stringify(title)} }, '*');
  </script>
</body>
</html>`;
}

function buildNavigationBridgeScript(finalUrl: string): string {
  const safeFinalUrlJson = JSON.stringify(finalUrl);
  return `
<script data-pixel-bridge="true">
(function() {
  var BASE_URL = ${safeFinalUrlJson};
  function notifyLoaded() {
    try {
      window.parent.postMessage({
        type: 'PIXEL_BROWSER_LOADED',
        url: BASE_URL,
        title: document.title || BASE_URL
      }, '*');
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyLoaded);
  } else {
    notifyLoaded();
  }
  window.addEventListener('load', notifyLoaded);

  try {
    var titleEl = document.querySelector('title');
    if (titleEl && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function() {
        window.parent.postMessage({
          type: 'PIXEL_BROWSER_TITLE',
          url: BASE_URL,
          title: document.title || BASE_URL
        }, '*');
      }).observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  } catch (e) {}

  document.addEventListener('click', function(ev) {
    var target = ev.target;
    if (!target || !target.closest) return;
    var link = target.closest('a');
    if (!link) return;
    var rawHref = link.getAttribute('href');
    if (!rawHref) return;
    var trimmed = rawHref.trim();
    if (!trimmed || trimmed.charAt(0) === '#' || trimmed.indexOf('javascript:') === 0 || trimmed.indexOf('mailto:') === 0 || trimmed.indexOf('tel:') === 0) {
      return;
    }
    try {
      var resolved = new URL(trimmed, BASE_URL);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        ev.preventDefault();
        ev.stopPropagation();
        window.parent.postMessage({
          type: 'PIXEL_BROWSER_NAVIGATE',
          url: resolved.toString()
        }, '*');
      }
    } catch (e) {}
  }, true);

  document.addEventListener('submit', function(ev) {
    var form = ev.target;
    if (!form || form.tagName !== 'FORM') return;
    var method = (form.getAttribute('method') || 'GET').toUpperCase();
    if (method !== 'GET') return;
    try {
      var rawAction = form.getAttribute('action') || BASE_URL;
      var targetUrl = new URL(rawAction, BASE_URL);
      var fd = new FormData(form);
      var params = new URLSearchParams();
      fd.forEach(function(val, key) {
        if (typeof val === 'string') params.append(key, val);
      });
      targetUrl.search = params.toString();
      ev.preventDefault();
      ev.stopPropagation();
      window.parent.postMessage({
        type: 'PIXEL_BROWSER_NAVIGATE',
        url: targetUrl.toString()
      }, '*');
    } catch (e) {}
  }, true);

  try {
    window.open = function(u) {
      if (u && typeof u === 'string') {
        try {
          var resolved = new URL(u, BASE_URL);
          window.parent.postMessage({
            type: 'PIXEL_BROWSER_NAVIGATE',
            url: resolved.toString()
          }, '*');
        } catch (e) {}
      }
      return null;
    };
  } catch (e) {}
})();
</script>`;
}

function rewriteHtmlForProxy(html: string, finalUrl: string): string {
  // Strip restrictive frame meta tags and existing base tags
  let out = html
    .replace(/<meta[^>]*http-equiv=["']?(?:X-Frame-Options|Content-Security-Policy)["']?[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '');

  const baseAndViewport = `<base href="${escapeHtml(finalUrl)}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style data-pixel-layout="true">
  html, body { max-width: 100vw !important; overflow-x: auto !important; }
  img, video, svg, table { max-width: 100%; height: auto; }
</style>`;

  if (/<head\b[^>]*>/i.test(out)) {
    out = out.replace(/<head\b([^>]*)>/i, `<head$1>\n${baseAndViewport}`);
  } else if (/<html\b[^>]*>/i.test(out)) {
    out = out.replace(/<html\b([^>]*)>/i, `<html$1>\n<head>${baseAndViewport}</head>`);
  } else {
    out = `<head>${baseAndViewport}</head>\n${out}`;
  }

  const bridge = buildNavigationBridgeScript(finalUrl);
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${bridge}\n</body>`);
  } else {
    out += `\n${bridge}`;
  }

  return out;
}

function extractReaderData(html: string, finalUrl: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : finalUrl;

  // Strip scripts, styles, svgs, noscript, nav, footer
  const cleanedBody = html
    .replace(/<(script|style|noscript|svg|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const paragraphs: string[] = [];
  const blockRegex = /<(h1|h2|h3|h4|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(cleanedBody)) !== null && paragraphs.length < 40) {
    const rawText = match[2].replace(/<[^>]+>/g, ' ');
    const text = decodeHtmlEntities(rawText);
    if (text.length >= 12 && !paragraphs.includes(text)) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length === 0) {
    const fallback = decodeHtmlEntities(cleanedBody.replace(/<[^>]+>/g, ' '));
    if (fallback) {
      paragraphs.push(fallback.slice(0, 1200));
    }
  }

  const links: { text: string; href: string }[] = [];
  const seenHref = new Set<string>();
  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = linkRegex.exec(cleanedBody)) !== null && links.length < 25) {
    const rawHref = match[1].trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
      continue;
    }
    try {
      const resolved = new URL(rawHref, finalUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
      const hrefStr = resolved.toString();
      if (seenHref.has(hrefStr)) continue;
      const text = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ' '));
      if (text.length >= 2) {
        seenHref.add(hrefStr);
        links.push({ text: text.slice(0, 90), href: hrefStr });
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return {
    title,
    url: finalUrl,
    paragraphs,
    links,
  };
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');
  const mode = req.nextUrl.searchParams.get('mode') || 'web';

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let validatedUrl: URL;
  try {
    validatedUrl = await validatePublicUrl(rawUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid URL';
    if (mode === 'reader') {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return new NextResponse(buildErrorHtml(rawUrl, 'URL Tidak Diizinkan', msg), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const upstream = await fetch(validatedUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const finalUrl = upstream.url || validatedUrl.toString();
    await validatePublicUrl(finalUrl);

    const contentType = (upstream.headers.get('content-type') || 'text/html').toLowerCase();

    if (mode === 'reader') {
      const text = await upstream.text();
      if (!upstream.ok) {
        return NextResponse.json(
          { error: `HTTP ${upstream.status} ${upstream.statusText}` },
          { status: upstream.status }
        );
      }
      if (contentType.includes('text/html') || contentType.includes('xhtml')) {
        return NextResponse.json(extractReaderData(text, finalUrl));
      }
      return NextResponse.json({
        title: finalUrl,
        url: finalUrl,
        paragraphs: [text.slice(0, 4000)],
        links: [],
      });
    }

    // Image passthrough
    if (contentType.startsWith('image/')) {
      const buf = await upstream.arrayBuffer();
      return new NextResponse(buf, {
        status: upstream.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // HTML documents
    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const html = await upstream.text();
      if (!upstream.ok && html.length < 200) {
        return new NextResponse(
          buildErrorHtml(
            finalUrl,
            `HTTP ${upstream.status}`,
            `Situs mengembalikan status ${upstream.status} (${upstream.statusText || 'Error'}).`
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }
        );
      }
      const rewritten = rewriteHtmlForProxy(html, finalUrl);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Plain text / JSON / XML formatted nicely inside a retro browser wrapper
    if (
      contentType.includes('text/') ||
      contentType.includes('application/json') ||
      contentType.includes('application/xml')
    ) {
      const rawText = await upstream.text();
      const wrapped = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(finalUrl)}</title>
  <style>
    body { font-family: monospace; background: #fff; color: #111; margin: 0; padding: 12px; font-size: 13px; line-height: 1.4; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
  </style>
</head>
<body>
  <pre>${escapeHtml(rawText.slice(0, 100000))}</pre>
  ${buildNavigationBridgeScript(finalUrl)}
</body>
</html>`;
      return new NextResponse(wrapped, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Binary / downloadable content notice
    return new NextResponse(
      buildErrorHtml(
        finalUrl,
        'Berkas Tidak Dapat Ditampilkan Langsung',
        `Tipe konten (${contentType}) adalah berkas biner atau unduhan dan tidak dapat dirender sebagai halaman web.`
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghubungi server tujuan.';
    if (mode === 'reader') {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return new NextResponse(
      buildErrorHtml(
        validatedUrl.toString(),
        'Gagal Memuat Halaman',
        `Tidak dapat terhubung ke ${validatedUrl.hostname}: ${message}`
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}
