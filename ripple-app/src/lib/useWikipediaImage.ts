import { useState, useEffect } from 'react';
import type { Booking } from './types';

// Module-level cache: populated lazily from the Wikipedia API, never pre-seeded
// with hardcoded URLs (those go stale as Wikimedia changes available thumbnail sizes).
// Exported so TripDashboard, ItineraryView, and MapView share the same cache —
// when a destination or booking image is fetched on any surface, it's instantly available everywhere.
export const wikiImageCache = new Map<string, string>();
const inflightLookups = new Map<string, Promise<string>>();

const WIKI_HEADERS = {
  Accept: 'application/json',
  'Api-User-Agent': 'planB/1.0 (itinerary photos; https://github.com/planB)',
};

const GENERIC_WIKI_TITLES = new Set([
  'yacht',
  'boat',
  'sailboat',
  'sailing',
  'cruise ship',
  'cruise',
  'cruises',
  'spa',
  'hotel',
  'resort',
  'car',
  'automobile',
  'taxi',
  'tourism',
  'travel',
  'transport',
  'transportation',
  'tour',
  'drive',
  'activity',
  'private',
  'freediving',
  'scuba diving',
]);

const TITLE_FILLER = new Set([
  'full',
  'half',
  'day',
  'days',
  'night',
  'nights',
  'overnight',
  'private',
  'guided',
  'guide',
  'guides',
  'heritage',
  'self',
  'drive',
  'drives',
  'tour',
  'tours',
  'excursion',
  'excursions',
  'experience',
  'experiences',
  'package',
  'packages',
  'activity',
  'activities',
  'adventure',
  'adventures',
  'sightseeing',
  'ticket',
  'tickets',
  'pass',
  'passes',
  'entry',
  'visit',
  'visiting',
  'trip',
  'trips',
  'booking',
  'charter',
  'chartered',
  'premium',
  'deluxe',
  'standard',
  'group',
  'shared',
  'exclusive',
  'sunrise',
  'sunset',
  'morning',
  'afternoon',
  'evening',
  'hour',
  'hours',
  'hrs',
  'hr',
  'min',
  'mins',
  'minutes',
  'with',
  'from',
  'and',
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'by',
  'via',
  'near',
  'including',
  'includes',
  'return',
  'one',
  'way',
  'yacht',
  'yachting',
  'cruise',
  'cruises',
  'cruising',
  'boat',
  'boats',
  'boating',
  'scuba',
  'diving',
  'dive',
  'dives',
  'diver',
  'divers',
  'snorkel',
  'snorkeling',
  'camel',
  'safari',
  'camp',
  'camps',
  'camping',
  'desert',
  'resort',
  'spa',
  'hotel',
  'hotels',
  'villa',
  'villas',
  'inn',
  'suites',
  'suite',
  'stay',
  'homestay',
  'hostel',
  'lodge',
  'retreat',
  'motel',
  'jetty',
  'pier',
  'wharf',
  'lobby',
  'pickup',
  'drop',
  'dropoff',
  'meeting',
  'point',
  'dolphin',
  'dolphins',
  'sighting',
  'sightings',
  'transfers',
  'transfer',
  'cab',
  'cabs',
  'taxi',
  'taxis',
  'shuttle',
  'shuttles',
  'executive',
  'gate',
  'gates',
  'terminal',
  'terminals',
  'arrival',
  'arrivals',
  'departure',
  'departures',
  'station',
  'platform',
  'stop',
  'concourse',
  'counter',
  'stand',
  'lot',
  'parking',
  'exit',
  'entrance',
  'floor',
  'level',
  'bay',
  'pillar',
  'pnr',
]);

const ADDRESS_FILLER =
  /\b(road|rd|street|st|ave|avenue|lane|ln|nh-?\d*|highway|old|new|sector|block|plot|phase)\b/i;

const AIRLINE_QUERIES: Array<{ match: RegExp; query: string }> = [
  { match: /\bindigo\b|\b6e[\s-]?\d/i, query: 'IndiGo' },
  { match: /\bair[\s-]?india[\s-]?express\b|\bix[\s-]?\d/i, query: 'Air India Express' },
  { match: /\bair[\s-]?india\b|\bai[\s-]\d/i, query: 'Air India' },
  { match: /\bvistara\b|\buk[\s-]\d/i, query: 'Vistara' },
  { match: /\bspicejet\b|\bsg[\s-]\d/i, query: 'SpiceJet' },
  { match: /\bgo[\s-]?first\b|\bg8[\s-]\d/i, query: 'Go First' },
  { match: /\bakasa\b|\bqp[\s-]\d/i, query: 'Akasa Air' },
  { match: /\bemirates\b|\bek[\s-]\d/i, query: 'Emirates (airline)' },
  { match: /\blufthansa\b|\blh[\s-]\d/i, query: 'Lufthansa' },
  { match: /\bbritish[\s-]?airways\b|\bba[\s-]\d/i, query: 'British Airways' },
  { match: /\bqatar\b|\bqr[\s-]\d/i, query: 'Qatar Airways' },
  { match: /\bsingapore[\s-]?airlines\b|\bsq[\s-]\d/i, query: 'Singapore Airlines' },
];

function destCity(destination: string): string {
  return destination.split(',')[0]?.trim() || '';
}

function locationText(booking: Booking): string {
  if (booking.location.type === 'named') return booking.location.name.trim();
  return (booking.location.label ?? '').trim();
}

const TOKEN_ALIASES: Record<string, string[]> = {
  tso: ['tso', 'lake'],
  lake: ['lake', 'tso'],
  thiksey: ['thiksey', 'thikse', 'tikse'],
  thikse: ['thikse', 'thikse', 'tikse'],
  monastery: ['monastery', 'gompa'],
  gompa: ['gompa', 'monastery'],
};

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => {
      if (!t || TITLE_FILLER.has(t)) return false;
      return t.length >= 1;
    })
    .filter((t) => t.length >= 2 || /[a-z]/.test(t));
}

function expandToken(token: string): string[] {
  return TOKEN_ALIASES[token] ?? [token];
}

function tokenOverlap(query: string, title: string): number {
  const titleExpanded = new Set(significantTokens(title).flatMap(expandToken));
  const queryTokens = significantTokens(query);
  if (queryTokens.length === 0) return 0;
  return queryTokens.filter((t) => expandToken(t).some((alias) => titleExpanded.has(alias))).length;
}

function overlapNeeded(queryTokenCount: number): number {
  if (queryTokenCount <= 1) return 1;
  if (queryTokenCount === 2) return 2;
  return Math.ceil(queryTokenCount * 0.6);
}

/** Strip duration / product wording so "Pangong Tso Full-Day Private Drive" → "Pangong Tso". */
export function cleanPlaceQuery(raw: string): string {
  let text = raw
    .replace(/[—–]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(full|half)[-\s]?days?\b/gi, ' ')
    .replace(/\bself[-\s]?drive\b/gi, ' ')
    .replace(/\b\d+\s*(h|hr|hrs|hours?|mins?|minutes?|days?|nights?)\b/gi, ' ')
    .replace(/[/|,.:;]+/g, ' ');

  const kept = text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, '');
      if (!lower) return /^\d+$/.test(w) === false && w.length > 1;
      if (TITLE_FILLER.has(lower)) return false;
      if (lower.length === 1 && /[a-z]/.test(lower)) return true;
      return true;
    });

  return kept.join(' ').trim();
}

/**
 * Extracts a specific landmark, beach, river, or locality from multi-segment location strings.
 * e.g. "W Goa Resort & Spa, Vagator Beach, Goa" → "Vagator Beach"
 *      "Chapora River Jetty, Vagator, Goa" → "Chapora River"
 *      "Dabolim Airport (GOI) Terminal 1 Arrival Gate 4" → "Dabolim Airport"
 */
export function extractSpecificPlaceFromLocation(
  loc: string,
  destination: string,
  title = ''
): string {
  const destClean = destCity(destination).toLowerCase();
  const titleClean = cleanPlaceQuery(title).toLowerCase();
  const parts = loc.split(/[,|;·–—\n]+/).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const cleaned = cleanPlaceQuery(part);
    if (!cleaned || cleaned.length < 3) continue;
    const lower = cleaned.toLowerCase();
    if (lower === destClean || lower === destination.toLowerCase()) continue;
    if (titleClean && (lower === titleClean || titleClean.includes(lower))) continue;
    if (
      ADDRESS_FILLER.test(part) &&
      !/(beach|lake|river|fort|palace|island|dune|monastery|gompa|airport|harbor|port|creek|hill|mountain|valley|cove|bay)/i.test(
        part
      )
    ) {
      continue;
    }
    return cleaned;
  }
  return '';
}

function cacheKeyFor(query: string, fallbackQuery?: string): string {
  return `${query.trim()}::${(fallbackQuery || '').trim()}`;
}

/**
 * Given a booking and destination, derives the best Wikipedia article/search
 * query and a destination fallback used when the specific place has no page.
 */
export function getWikipediaQueryForBooking(
  booking: Booking,
  destination: string
): { query: string; fallback: string } {
  const destClean = destCity(destination);
  const title = booking.title.trim();
  const provider = booking.provider.trim();
  const loc = locationText(booking);
  const haystack = `${title} ${provider}`;

  if (booking.type === 'flight') {
    for (const airline of AIRLINE_QUERIES) {
      if (airline.match.test(haystack)) {
        return { query: airline.query, fallback: destClean };
      }
    }
    const providerQuery = cleanPlaceQuery(provider);
    return { query: providerQuery || 'Airline', fallback: destClean };
  }

  if (booking.type === 'train') {
    const cleanedTitle = cleanPlaceQuery(
      title.replace(/\b\d{3,5}\b/g, ' ').replace(/\b[A-Z]{3}\b/g, ' ')
    );
    return { query: cleanedTitle || 'Indian_Railways', fallback: destClean };
  }

  if (booking.type === 'hotel') {
    const hotelQuery = cleanPlaceQuery(title);
    const specificLoc = extractSpecificPlaceFromLocation(loc, destination, title);
    // If specific place found in location (e.g. "Vagator Beach", "Candolim", "Sinquerim"),
    // use hotelQuery as primary and specificLoc as fallback!
    // If hotelQuery has no page on Wikipedia (like W Goa), it falls back to Vagator Beach.
    // If hotelQuery DOES have a page (like The Grand Dragon Ladakh or Suryagarh), it uses that.
    if (specificLoc) {
      return { query: hotelQuery || specificLoc, fallback: specificLoc };
    }
    return { query: hotelQuery || destClean, fallback: destClean };
  }

  if (booking.type === 'transfer') {
    const specificLoc = extractSpecificPlaceFromLocation(loc, destination, title);
    if (specificLoc) {
      return { query: specificLoc, fallback: destClean };
    }
    const place = cleanPlaceQuery(loc);
    return { query: place || destClean, fallback: destClean };
  }

  if (booking.type === 'activity' || booking.type === 'event') {
    const fromTitle = cleanPlaceQuery(title);
    const specificLoc = extractSpecificPlaceFromLocation(loc, destination, title);

    if (fromTitle && fromTitle.toLowerCase() !== destClean.toLowerCase()) {
      return { query: fromTitle, fallback: specificLoc || destClean };
    }

    if (specificLoc) {
      return { query: specificLoc, fallback: destClean };
    }

    return { query: destClean || fromTitle, fallback: destClean };
  }

  return { query: destClean || cleanPlaceQuery(title), fallback: destClean };
}

interface WikiSummary {
  title?: string;
  type?: string;
  description?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

interface WikiMediaItem {
  title?: string;
  type?: string;
  leadImage?: boolean;
  caption?: { text?: string; html?: string };
  srcset?: Array<{ src?: string }>;
}

// Strict filter to reject maps, administrative divisions, diagrams, logos, coats of arms,
// coins, stamps, census/population data, and botanical/herbarium specimen close-ups.
const UNHELPFUL_MEDIA =
  /iss\d|view_of_earth|satellite|sentinel|locator_map|orthographic|flag_of|coat_of_arms|wordmark|\blogo\b|\.svg(\?|$)|wikimedia.*map|\bmap\b|\bmaps\b|\btaluka\b|\btalukas\b|\bdistrict\b|\bdistricts\b|\bsubdivision\b|\bdivision\b|\badministrative\b|\bmunicipality\b|\bcarto|\btopograph|\bchart\b|\bdiagram\b|\bschematic\b|\bgraph\b|\bplot\b|\btable\b|\bplan\b|\bblueprint\b|\bfloorplan\b|\blayout\b|\bboundary\b|\bboundaries\b|\bseal\b|\bemblem\b|\binsignia\b|\bshield\b|\bcrest\b|\bbadge\b|\bcoin\b|\bstamp\b|\bbanknote\b|\bcensus\b|\bdemograph|\bpopulation\b|\bclimate\b|\bweather\b|\btemperature\b|\brainfall\b|herbarium|specimen|flower_&_fruit|inflorescence|foliage|seedpod|cardamomum|pclmaps|tile_ni_|survey_of_india|18\d{2}|\.pdf(\?|$)|\.webm(\?|$)|disambiguation/i;

function absWikiUrl(src: string): string {
  if (!src) return '';
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('http')) return src;
  return '';
}

function isUnhelpfulMedia(fileTitle: string, url = '', caption = ''): boolean {
  const combined = `${fileTitle} ${url} ${caption}`.toLowerCase();
  return UNHELPFUL_MEDIA.test(combined);
}

function imageFromSummary(data: WikiSummary | null): string {
  if (!data) return '';
  const title = (data.title || '').trim().toLowerCase();
  if (data.type === 'disambiguation') return '';
  if (GENERIC_WIKI_TITLES.has(title)) return '';
  const src = data.originalimage?.source || data.thumbnail?.source || '';
  if (!src) return '';
  if (isUnhelpfulMedia(data.title || '', src, data.description || '')) return '';
  return src;
}

function pickScenicMedia(items: WikiMediaItem[], query: string): string {
  let bestSrc = '';
  let bestScore = 0;

  for (const item of items) {
    if (item.type && item.type !== 'image') continue;
    const fileTitle = item.title || '';
    const caption = item.caption?.text || '';
    const srcset = item.srcset ?? [];
    const raw = srcset[srcset.length - 1]?.src || srcset[0]?.src || '';
    const src = absWikiUrl(raw);
    if (!src || isUnhelpfulMedia(fileTitle, src, caption)) continue;

    let score = 2;
    score += tokenOverlap(query, fileTitle) * 4;
    if (caption) score += tokenOverlap(query, caption) * 3;
    if (item.leadImage) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestSrc = src;
    }
  }

  return bestSrc;
}

async function wikiJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: WIKI_HEADERS });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchMediaImage(articleTitle: string, query: string): Promise<string> {
  const encoded = encodeURIComponent(articleTitle.replace(/\s+/g, '_'));
  const data = await wikiJson<{ items?: WikiMediaItem[] }>(
    `https://en.wikipedia.org/api/rest_v1/page/media-list/${encoded}`
  );
  return pickScenicMedia(data?.items ?? [], query);
}

interface CommonsPage {
  title?: string;
  imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string }>;
}

async function fetchCommonsImage(query: string): Promise<string> {
  // Guard against overly generic or single-character Commons queries (e.g. "W")
  const tokens = significantTokens(query).filter((t) => t.length >= 3);
  if (tokens.length === 0) return '';

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '1280',
  });
  const data = await wikiJson<{ query?: { pages?: Record<string, CommonsPage> } }>(
    `https://commons.wikimedia.org/w/api.php?${params.toString()}`
  );
  const pages = Object.values(data?.query?.pages ?? {});
  let bestSrc = '';
  let bestScore = 0;

  for (const page of pages) {
    const fileTitle = page.title || '';
    const info = page.imageinfo?.[0];
    const mime = info?.mime || '';
    if (mime && !mime.startsWith('image/')) continue;
    if (mime === 'image/svg+xml') continue;
    const src = info?.thumburl || info?.url || '';
    if (!src || isUnhelpfulMedia(fileTitle, src, '')) continue;
    if (!isUsableTitle(fileTitle.replace(/^File:/i, ''), query)) continue;

    const score = 2 + tokenOverlap(query, fileTitle) * 4;
    if (score > bestScore) {
      bestScore = score;
      bestSrc = src;
    }
  }

  return bestSrc;
}

async function fetchSummary(articleTitle: string): Promise<WikiSummary | null> {
  const encoded = encodeURIComponent(articleTitle.replace(/\s+/g, '_'));
  return wikiJson<WikiSummary>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
  );
}

async function searchArticles(search: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: search,
    srlimit: '8',
    srnamespace: '0',
    format: 'json',
    origin: '*',
  });
  const data = await wikiJson<{
    query?: { search?: Array<{ title: string }> };
  }>(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
  const hits = (data?.query?.search ?? []).map((hit) => hit.title);
  return hits.sort((a, b) => tokenOverlap(search, b) - tokenOverlap(search, a));
}

function isUsableTitle(articleTitle: string, query: string): boolean {
  const lower = articleTitle.trim().toLowerCase();
  if (GENERIC_WIKI_TITLES.has(lower)) return false;
  if (/^list of\b/i.test(articleTitle)) return false;
  const q = query.trim().toLowerCase();
  if (q.length >= 3 && lower.includes(q)) return true;
  const queryTokens = significantTokens(query);
  if (queryTokens.length === 0) return true;
  return tokenOverlap(query, articleTitle) >= overlapNeeded(queryTokens.length);
}

async function imageForArticle(articleTitle: string, query: string): Promise<string> {
  // 1. Primary choice: official Wikipedia lead image from summary!
  const summary = await fetchSummary(articleTitle);
  const fromSummary = imageFromSummary(summary);
  if (fromSummary) return fromSummary;

  // 2. Secondary choice: scenic photo from article media list
  const scenic = await fetchMediaImage(articleTitle, query);
  if (scenic) return scenic;

  // 3. Fallback: search Commons for article title
  return fetchCommonsImage(articleTitle);
}

export async function resolveWikipediaImage(
  query: string,
  fallbackQuery?: string
): Promise<string> {
  const primary = query.trim();
  const fallback = (fallbackQuery || '').trim();
  if (!primary) return '';

  const tryTitles: string[] = [primary];
  if (fallback && fallback.toLowerCase() !== primary.toLowerCase()) {
    tryTitles.push(`${primary} ${fallback}`);
  }

  // 1. Direct article lookups for primary candidate titles
  for (const title of tryTitles) {
    const summary = await fetchSummary(title);
    if (!summary?.title || summary.type === 'disambiguation') continue;
    if (GENERIC_WIKI_TITLES.has(summary.title.trim().toLowerCase())) continue;
    if (!isUsableTitle(summary.title, primary) && !isUsableTitle(summary.title, title)) continue;
    const src = await imageForArticle(summary.title, primary);
    if (src) return src;
  }

  // 2. Wikipedia search hits for primary
  for (const search of tryTitles) {
    const hits = await searchArticles(search);
    for (const hit of hits) {
      if (!isUsableTitle(hit, primary) && !isUsableTitle(hit, search)) continue;
      const src = await imageForArticle(hit, primary);
      if (src) return src;
    }
  }

  // 3. Fallback candidates (locality or destination)
  if (fallback && fallback.toLowerCase() !== primary.toLowerCase()) {
    const src = await imageForArticle(fallback, fallback);
    if (src) return src;
    const commonsFallback = await fetchCommonsImage(fallback);
    if (commonsFallback) return commonsFallback;
  }

  // 4. Commons search as last resort
  const commonsPrimary = await fetchCommonsImage(primary);
  if (commonsPrimary) return commonsPrimary;

  return '';
}

export function lookupWikipediaImage(query: string, fallbackQuery?: string): Promise<string> {
  const key = cacheKeyFor(query, fallbackQuery);
  if (wikiImageCache.has(key)) {
    return Promise.resolve(wikiImageCache.get(key)!);
  }
  const pending = inflightLookups.get(key);
  if (pending) return pending;

  const request = resolveWikipediaImage(query, fallbackQuery)
    .then((src) => {
      wikiImageCache.set(key, src);
      if (query.trim()) {
        wikiImageCache.set(query.trim(), src);
        wikiImageCache.set(query.trim().replace(/\s+/g, '_'), src);
      }
      inflightLookups.delete(key);
      return src;
    })
    .catch(() => {
      inflightLookups.delete(key);
      return '';
    });

  inflightLookups.set(key, request);
  return request;
}

/**
 * React hook that fetches a Wikipedia thumbnail for the given article title
 * or place-name search. Results are cached in-memory so each unique query
 * only hits the API once.
 */
export function useWikipediaImage(query: string, fallbackQuery?: string): string {
  const cacheKey = cacheKeyFor(query, fallbackQuery);

  const [photoUrl, setPhotoUrl] = useState<string>(
    () => wikiImageCache.get(cacheKey) ?? wikiImageCache.get(query.trim()) ?? wikiImageCache.get(query.replace(/\s+/g, '_')) ?? ''
  );

  useEffect(() => {
    if (!query.trim()) return;

    if (wikiImageCache.has(cacheKey)) {
      setPhotoUrl(wikiImageCache.get(cacheKey)!);
      return;
    }

    let cancelled = false;

    lookupWikipediaImage(query, fallbackQuery).then((src) => {
      if (!cancelled) setPhotoUrl(src);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, query, fallbackQuery]);

  return photoUrl;
}

/** Batch-fetch Wikipedia photos for map pins and other non-card surfaces. */
export function useBookingPhotos(
  bookings: Booking[],
  destination: string
): Record<string, string> {
  const signature = bookings.map((b) => `${b.id}:${b.title}`).join('|');
  const [photos, setPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      bookings.map(async (booking) => {
        const { query, fallback } = getWikipediaQueryForBooking(booking, destination);
        const src = await lookupWikipediaImage(query, fallback);
        return [booking.id, src] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      setPhotos(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [signature, destination]);

  return photos;
}
