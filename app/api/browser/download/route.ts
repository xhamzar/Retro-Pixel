import dns from 'node:dns/promises';
import net from 'node:net';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap for safe local storage

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
    throw new Error('Only HTTP and HTTPS URLs are allowed.');
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('Local hosts are blocked.');
  }
  if (net.isIP(host)) {
    if (isPrivateOrBlockedIP(host)) throw new Error('Private IP blocked.');
    return parsed;
  }
  const records = await dns.lookup(host, { all: true });
  if (!records.length) throw new Error('DNS lookup returned no addresses.');
  for (const rec of records) {
    if (isPrivateOrBlockedIP(rec.address)) {
      throw new Error('Domain resolves to private IP.');
    }
  }
  return parsed;
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim() || '';
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = await validatePublicUrl(rawUrl);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid URL' },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RetroPixelOS-Downloader/1.0',
      },
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return NextResponse.json({ error: `HTTP ${upstream.status} ${upstream.statusText}` }, { status: 502 });
    }

    const finalUrl = upstream.url || parsed.toString();
    await validatePublicUrl(finalUrl);

    const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
    const contentLength = Number(upstream.headers.get('content-length') || '0');
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 2 MB browser limit.' }, { status: 413 });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 2 MB browser limit.' }, { status: 413 });
    }

    const pathname = new URL(finalUrl).pathname;
    const rawName = pathname.split('/').filter(Boolean).pop() || 'downloaded_file';
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'downloaded_file';

    const isText =
      contentType.startsWith('text/') ||
      contentType.includes('json') ||
      contentType.includes('xml') ||
      contentType.includes('javascript');

    const content = isText
      ? buf.toString('utf8')
      : `data:${contentType};base64,${buf.toString('base64')}`;

    return NextResponse.json({
      name: safeName,
      url: finalUrl,
      mimeType: contentType,
      sizeKb: Math.max(1, Math.round(buf.byteLength / 1024)),
      content,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 502 }
    );
  }
}
