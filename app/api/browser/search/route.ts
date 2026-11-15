import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface SearchResultItem {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
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

function resolveDuckDuckGoHref(rawHref: string): string {
  const decoded = decodeHtmlEntities(rawHref);
  try {
    const normalized = decoded.startsWith('//') ? `https:${decoded}` : decoded;
    const u = new URL(normalized, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg) {
      return decodeURIComponent(uddg);
    }
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.toString();
    }
  } catch {
    // ignore malformed href
  }
  return decoded;
}

async function searchDuckDuckGoHtml(query: string): Promise<SearchResultItem[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(8000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results: SearchResultItem[] = [];

  const anchorRegex = /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<(?:a|div)[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/gi;

  const anchors: { url: string; title: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = anchorRegex.exec(html)) !== null) {
    const url = resolveDuckDuckGoHref(m[1]);
    const title = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, ' '));
    if (url.startsWith('http') && title) {
      anchors.push({ url, title, index: m.index });
    }
  }

  const snippets: { text: string; index: number }[] = [];
  while ((m = snippetRegex.exec(html)) !== null) {
    snippets.push({
      text: decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ' ')),
      index: m.index,
    });
  }

  for (let i = 0; i < anchors.length && results.length < 12; i++) {
    const a = anchors[i];
    const nextAnchorIndex = anchors[i + 1]?.index ?? Number.MAX_SAFE_INTEGER;
    const matchedSnippet = snippets.find((s) => s.index > a.index && s.index < nextAnchorIndex);
    let displayUrl = a.url;
    try {
      const parsed = new URL(a.url);
      displayUrl = `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    } catch {
      // keep raw
    }
    results.push({
      title: a.title,
      url: a.url,
      displayUrl,
      snippet: matchedSnippet?.text || '',
    });
  }

  return results;
}

async function searchWikipediaFallback(query: string, lang: string): Promise<SearchResultItem[]> {
  const wikiHost = lang === 'id' ? 'id.wikipedia.org' : 'en.wikipedia.org';
  const apiUrl = `https://${wikiHost}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&srlimit=8&format=json&utf8=1`;
  const res = await fetch(apiUrl, {
    signal: AbortSignal.timeout(7000),
    headers: { 'User-Agent': 'RetroPixelOSBrowser/1.0' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: { search?: { title: string; snippet: string }[] };
  };
  const list = data.query?.search ?? [];
  return list.map((item) => {
    const slug = encodeURIComponent(item.title.replace(/ /g, '_'));
    const url = `https://${wikiHost}/wiki/${slug}`;
    return {
      title: `${item.title} - Wikipedia`,
      url,
      displayUrl: `${wikiHost}/wiki/${item.title.replace(/ /g, '_')}`,
      snippet: decodeHtmlEntities(item.snippet.replace(/<[^>]+>/g, ' ')),
    };
  });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  const lang = req.nextUrl.searchParams.get('lang') || 'id';

  if (!q) {
    return NextResponse.json({ query: '', results: [] });
  }

  try {
    let results = await searchDuckDuckGoHtml(q);
    let source = 'duckduckgo';

    if (results.length === 0) {
      results = await searchWikipediaFallback(q, lang);
      if (results.length === 0 && lang === 'id') {
        results = await searchWikipediaFallback(q, 'en');
      }
      source = 'wikipedia';
    }

    return NextResponse.json({
      query: q,
      source,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ query: q, results: [], error: message }, { status: 200 });
  }
}
