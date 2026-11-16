import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RG_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://radio.garden/',
  Origin: 'https://radio.garden',
};

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') || '').trim();
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid Radio Garden channel ID' }, { status: 400 });
  }

  const target = `https://radio.garden/api/ara/content/listen/${id}/channel.mp3`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(target, {
      headers: RG_HEADERS,
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timer);

    const location = resp.headers.get('location');
    if (location && /^https?:\/\//i.test(location)) {
      // Upgrade plain http stream links cleanly only when explicitly requested or report both
      const isHttps = location.toLowerCase().startsWith('https://');
      return NextResponse.json({
        streamUrl: location,
        secure: isHttps,
      });
    }

    return NextResponse.json(
      { error: `Radio Garden returned status ${resp.status} without stream redirect` },
      { status: resp.status >= 400 ? resp.status : 502 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve Radio Garden stream';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
