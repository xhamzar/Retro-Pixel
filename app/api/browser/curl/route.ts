import dns from 'node:dns/promises';
import net from 'node:net';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap
const ALLOWED_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);
const BLOCKED_REQ_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
]);

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
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true;
    }
    return false;
  }
  return true;
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed.');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal')
  ) {
    throw new Error('Local or internal hosts are blocked.');
  }
  if (net.isIP(host)) {
    if (isPrivateOrBlockedIP(host)) throw new Error('Private IP address blocked.');
    return parsed;
  }
  const records = await dns.lookup(host, { all: true });
  if (!records.length) throw new Error(`DNS lookup returned no addresses for ${host}.`);
  for (const rec of records) {
    if (isPrivateOrBlockedIP(rec.address)) {
      throw new Error(`Domain ${host} resolves to a private IP address.`);
    }
  }
  return parsed;
}

export async function POST(req: NextRequest) {
  let reqBody: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  try {
    reqBody = (await req.json()) as typeof reqBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload.' }, { status: 400 });
  }

  const rawUrl = reqBody.url?.trim() || '';
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing target url.' }, { status: 400 });
  }

  const method = (reqBody.method || (reqBody.body !== undefined ? 'POST' : 'GET')).toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: `Unsupported HTTP method: ${method}` }, { status: 400 });
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

  const forwardHeaders: Record<string, string> = {
    'User-Agent': 'RetroPixelOS-Curl/2.4',
    Accept: '*/*',
  };
  if (reqBody.headers && typeof reqBody.headers === 'object') {
    for (const [k, v] of Object.entries(reqBody.headers)) {
      const key = k.trim();
      if (!key || BLOCKED_REQ_HEADERS.has(key.toLowerCase())) continue;
      if (typeof v === 'string') {
        forwardHeaders[key] = v;
      }
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const hasBody = method !== 'GET' && method !== 'HEAD' && reqBody.body !== undefined;

    const upstream = await fetch(parsed.toString(), {
      method,
      headers: forwardHeaders,
      body: hasBody ? reqBody.body : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const finalUrl = upstream.url || parsed.toString();
    await validatePublicUrl(finalUrl);

    const contentType =
      upstream.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
    const contentLength = Number(upstream.headers.get('content-length') || '0');
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Response exceeds 2 MB limit.' }, { status: 413 });
    }

    const buf = method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await upstream.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Response exceeds 2 MB limit.' }, { status: 413 });
    }

    const responseHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        responseHeaders[key] = value;
      }
    });

    const isText =
      method === 'HEAD' ||
      contentType.startsWith('text/') ||
      contentType.includes('json') ||
      contentType.includes('xml') ||
      contentType.includes('javascript') ||
      contentType.includes('x-www-form-urlencoded') ||
      contentType.includes('event-stream');

    const content = isText
      ? buf.toString('utf8')
      : `data:${contentType};base64,${buf.toString('base64')}`;

    const pathname = new URL(finalUrl).pathname;
    const rawName = pathname.split('/').filter(Boolean).pop() || 'response.dat';
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'response.dat';

    return NextResponse.json({
      status: upstream.status,
      statusText: upstream.statusText,
      url: finalUrl,
      name: safeName,
      mimeType: contentType,
      headers: responseHeaders,
      sizeKb: Math.max(1, Math.round(buf.byteLength / 1024)),
      content,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upstream HTTP request failed' },
      { status: 502 }
    );
  }
}
