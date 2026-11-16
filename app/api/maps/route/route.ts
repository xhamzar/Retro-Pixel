import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TravelMode = 'driving' | 'foot' | 'bike';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateFallbackDuration(meters: number, mode: TravelMode): number {
  const speedMps = mode === 'foot' ? 1.35 : mode === 'bike' ? 4.4 : 11.0;
  return Math.max(10, Math.round(meters / speedMps));
}

interface OsrmRoutePayload {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: [number, number][];
    };
    legs?: {
      steps?: {
        name?: string;
        distance?: number;
        maneuver?: {
          type?: string;
          modifier?: string;
        };
      }[];
    }[];
  }[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const fromLat = Number(searchParams.get('fromLat'));
  const fromLng = Number(searchParams.get('fromLng'));
  const toLat = Number(searchParams.get('toLat'));
  const toLng = Number(searchParams.get('toLng'));
  const modeRaw = searchParams.get('mode') || 'driving';
  const mode: TravelMode = modeRaw === 'foot' || modeRaw === 'bike' ? modeRaw : 'driving';

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return NextResponse.json({ error: 'Invalid route coordinates.' }, { status: 400 });
  }

  const profile = mode === 'foot' ? 'foot' : mode === 'bike' ? 'bike' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'RetroPixelOS/2.4 (OpenStreetMap Pixel GPS Client)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const rawText = await resp.text();
    let parsed: OsrmRoutePayload | null = null;
    try {
      parsed = JSON.parse(rawText) as OsrmRoutePayload;
    } catch {
      parsed = null;
    }

    const firstRoute = parsed?.routes?.[0];
    const coords = firstRoute?.geometry?.coordinates;
    if (firstRoute && Array.isArray(coords) && coords.length >= 2) {
      const latLngs: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);
      const rawSteps = firstRoute.legs?.[0]?.steps ?? [];
      const steps = rawSteps
        .slice(0, 12)
        .map((st) => {
          const action = [st.maneuver?.type, st.maneuver?.modifier].filter(Boolean).join(' ');
          const street = st.name?.trim() || 'jalan';
          const dist = Math.round(st.distance ?? 0);
          return `${action ? `${action} -> ` : ''}${street} (${dist}m)`;
        });

      return NextResponse.json({
        distanceMeters: Math.round(firstRoute.distance ?? haversineMeters(fromLat, fromLng, toLat, toLng)),
        durationSeconds: Math.round(firstRoute.duration ?? estimateFallbackDuration(firstRoute.distance ?? 0, mode)),
        coordinates: latLngs,
        steps,
        mode,
        isFallback: false,
      });
    }
  } catch {
    // Fall back to direct great-circle route below
  }

  const directMeters = Math.round(haversineMeters(fromLat, fromLng, toLat, toLng));
  return NextResponse.json({
    distanceMeters: directMeters,
    durationSeconds: estimateFallbackDuration(directMeters, mode),
    coordinates: [
      [fromLat, fromLng],
      [toLat, toLng],
    ],
    steps: [`Direct heading (${directMeters}m)`],
    mode,
    isFallback: true,
  });
}
