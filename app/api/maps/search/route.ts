import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NominatimItem {
  place_id?: number | string;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  type?: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    let url = '';
    if (lat !== null && lon !== null) {
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        return NextResponse.json({ error: 'Invalid lat/lon' }, { status: 400 });
      }
      url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(latNum))}&lon=${encodeURIComponent(String(lonNum))}&zoom=16`;
    } else {
      if (!q || q.length < 2) {
        return NextResponse.json({ results: [] });
      }
      url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
    }

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'RetroPixelOS/2.4 (OpenStreetMap Pixel GPS Client)',
        Accept: 'application/json',
        'Accept-Language': 'id,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const rawText = await resp.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return NextResponse.json({
        results: [],
        error: `Geocoder returned non-JSON response (${resp.status})`,
      });
    }

    if (lat !== null && lon !== null && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const item = parsed as NominatimItem;
      return NextResponse.json({
        result: {
          id: String(item.place_id ?? 'rev'),
          name: item.name || item.display_name?.split(',')[0] || `${lat}, ${lon}`,
          displayName: item.display_name || `${lat}, ${lon}`,
          lat: Number(item.lat ?? lat),
          lng: Number(item.lon ?? lon),
          type: item.type || 'place',
        },
      });
    }

    const arr = Array.isArray(parsed) ? (parsed as NominatimItem[]) : [];
    const results = arr
      .map((item) => {
        const latVal = Number(item.lat);
        const lngVal = Number(item.lon);
        if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) return null;
        const shortName = item.name?.trim() || item.display_name?.split(',')[0]?.trim() || 'Lokasi';
        return {
          id: String(item.place_id ?? `${latVal},${lngVal}`),
          name: shortName,
          displayName: item.display_name || shortName,
          lat: latVal,
          lng: lngVal,
          type: item.type || 'place',
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ results: [], error: message }, { status: 200 });
  }
}
