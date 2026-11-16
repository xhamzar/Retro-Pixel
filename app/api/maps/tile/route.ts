import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const zRaw = Number(searchParams.get('z'));
  const xRaw = Number(searchParams.get('x'));
  const yRaw = Number(searchParams.get('y'));

  if (
    !Number.isInteger(zRaw) ||
    !Number.isInteger(xRaw) ||
    !Number.isInteger(yRaw) ||
    zRaw < 0 ||
    zRaw > 19
  ) {
    return NextResponse.json({ error: 'Invalid tile coordinates.' }, { status: 400 });
  }

  const maxCoord = 2 ** zRaw;
  const x = ((xRaw % maxCoord) + maxCoord) % maxCoord;
  if (yRaw < 0 || yRaw >= maxCoord) {
    return NextResponse.json({ error: 'Tile Y out of range.' }, { status: 400 });
  }

  const upstreamUrl = `https://tile.openstreetmap.org/${zRaw}/${x}/${yRaw}.png`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'RetroPixelOS/2.4 (OpenStreetMap Pixel GPS Client)',
        Accept: 'image/png,image/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return NextResponse.json({ error: `Tile server status ${resp.status}` }, { status: resp.status });
    }

    const buffer = await resp.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': resp.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tile fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
