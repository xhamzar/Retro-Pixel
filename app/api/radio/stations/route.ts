import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface UnifiedRadioStation {
  id: string;
  source: 'rg' | 'rb';
  name: string;
  city: string;
  country: string;
  genre: string;
  streamUrl?: string;
  rgId?: string;
  secure: boolean;
  bitrate?: number;
}

const RG_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://radio.garden/',
  Origin: 'https://radio.garden',
  Accept: 'application/json',
};

const RB_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

function extractRgId(pageUrl?: string): string | null {
  if (!pageUrl) return null;
  const parts = pageUrl.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || !/^[A-Za-z0-9_-]{3,24}$/.test(last)) return null;
  return last;
}

async function fetchJsonWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRadioBrowser(pathAndQuery: string): Promise<unknown[] | null> {
  for (const base of RB_MIRRORS) {
    const data = await fetchJsonWithTimeout(
      `${base}${pathAndQuery}`,
      {
        'User-Agent': 'RetroPixelOS/2.4 (World Pixel Radio)',
        Accept: 'application/json',
      },
      5500,
    );
    if (Array.isArray(data)) return data;
  }
  return null;
}

interface RbRawStation {
  stationuuid?: string;
  name?: string;
  url_resolved?: string;
  url?: string;
  country?: string;
  state?: string;
  tags?: string;
  bitrate?: number;
  codec?: string;
}

function mapRbStations(rows: unknown[]): UnifiedRadioStation[] {
  const out: UnifiedRadioStation[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    const r = raw as RbRawStation;
    const stream = (r.url_resolved || r.url || '').trim();
    if (!stream.startsWith('https://')) continue;
    const name = (r.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const firstTags = (r.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' · ');

    out.push({
      id: `rb-${r.stationuuid || Buffer.from(stream).toString('base64').slice(0, 12)}`,
      source: 'rb',
      name,
      city: (r.state || r.country || 'World').trim(),
      country: (r.country || 'Global').trim(),
      genre: firstTags || (r.codec ? `${r.codec} Stream` : 'Live Radio'),
      streamUrl: stream,
      secure: true,
      bitrate: typeof r.bitrate === 'number' && r.bitrate > 0 ? r.bitrate : undefined,
    });
  }
  return out;
}

interface RgSearchHit {
  _source?: {
    type?: string;
    page?: {
      url?: string;
      title?: string;
      subtitle?: string;
      secure?: boolean;
      stream?: string;
      place?: { id?: string; title?: string };
      country?: { id?: string; title?: string };
    };
  };
}

interface RgPlaceChannelItem {
  page?: {
    url?: string;
    title?: string;
    secure?: boolean;
    stream?: string;
    place?: { id?: string; title?: string };
    country?: { id?: string; title?: string };
  };
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') || 'country';
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const placeId = (req.nextUrl.searchParams.get('id') || '').trim();
  const cc = (req.nextUrl.searchParams.get('cc') || 'ID').trim().toUpperCase();
  const tag = (req.nextUrl.searchParams.get('tag') || '').trim();

  if (mode === 'place') {
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(placeId)) {
      return NextResponse.json({ error: 'Invalid place ID' }, { status: 400 });
    }
    const cityFallback = (req.nextUrl.searchParams.get('city') || '').trim();
    const rgData = (await fetchJsonWithTimeout(
      `https://radio.garden/api/ara/content/page/${placeId}/channels`,
      RG_HEADERS,
    )) as {
      data?: {
        title?: string;
        content?: Array<{ items?: RgPlaceChannelItem[] }>;
      };
    } | null;

    const stations: UnifiedRadioStation[] = [];
    const lists = rgData?.data?.content || [];
    for (const list of lists) {
      for (const item of list.items || []) {
        const p = item.page;
        const rgId = extractRgId(p?.url);
        if (!p?.title || !rgId || p.secure === false) continue;
        stations.push({
          id: `rg-${rgId}`,
          source: 'rg',
          rgId,
          name: p.title,
          city: p.place?.title || rgData?.data?.title || cityFallback || 'Radio Garden',
          country: p.country?.title || 'World',
          genre: p.stream || 'Radio Garden Live',
          secure: true,
        });
      }
    }

    if (stations.length === 0 && cityFallback) {
      const rbRows = await fetchRadioBrowser(
        `/json/stations/search?name=${encodeURIComponent(cityFallback)}&limit=25&order=clickcount&reverse=true&hidebroken=true`,
      );
      if (rbRows) {
        return NextResponse.json({
          stations: mapRbStations(rbRows),
          placeTitle: cityFallback,
          provider: 'radio-browser-fallback',
        });
      }
    }

    return NextResponse.json({
      stations,
      placeTitle: rgData?.data?.title || cityFallback || '',
      provider: stations.length > 0 ? 'radio-garden' : 'fallback',
    });
  }

  if (mode === 'tag' && tag) {
    const safeTag = tag.replace(/[^a-zA-Z0-9\s-]/g, '').slice(0, 32);
    const rbRows = await fetchRadioBrowser(
      `/json/stations/bytag/${encodeURIComponent(safeTag)}?limit=30&order=clickcount&reverse=true&hidebroken=true`,
    );
    const stations = rbRows ? mapRbStations(rbRows) : [];
    return NextResponse.json({ stations, provider: 'radio-browser' });
  }

  if (mode === 'search') {
    if (q.length < 2) {
      return NextResponse.json({ stations: [] });
    }

    const [rgSearchRaw, rbRows] = await Promise.all([
      fetchJsonWithTimeout(`https://radio.garden/api/search?q=${encodeURIComponent(q)}`, RG_HEADERS),
      fetchRadioBrowser(
        `/json/stations/search?name=${encodeURIComponent(q)}&limit=25&order=clickcount&reverse=true&hidebroken=true`,
      ),
    ]);

    const stations: UnifiedRadioStation[] = [];
    const seenNames = new Set<string>();

    const rgHits = (rgSearchRaw as { hits?: { hits?: RgSearchHit[] } } | null)?.hits?.hits || [];
    for (const hit of rgHits) {
      const p = hit._source?.page;
      if (hit._source?.type !== 'channel' || !p?.title || p.secure === false) continue;
      const rgId = extractRgId(p.url);
      if (!rgId) continue;
      seenNames.add(p.title.toLowerCase());
      stations.push({
        id: `rg-${rgId}`,
        source: 'rg',
        rgId,
        name: p.title,
        city: p.place?.title || p.subtitle || 'Radio Garden',
        country: p.country?.title || 'Global',
        genre: p.stream ? `RG · ${p.stream}` : 'Radio Garden',
        secure: true,
      });
    }

    if (rbRows) {
      for (const st of mapRbStations(rbRows)) {
        if (!seenNames.has(st.name.toLowerCase())) {
          stations.push(st);
        }
      }
    }

    return NextResponse.json({ stations: stations.slice(0, 40) });
  }

  // Default: mode === 'country'
  const safeCc = /^[A-Z]{2}$/.test(cc) ? cc : 'ID';
  const rbRows = await fetchRadioBrowser(
    `/json/stations/bycountrycodeexact/${safeCc}?limit=35&order=clickcount&reverse=true&hidebroken=true`,
  );
  const stations = rbRows ? mapRbStations(rbRows) : [];
  return NextResponse.json({ stations, provider: 'radio-browser' });
}
