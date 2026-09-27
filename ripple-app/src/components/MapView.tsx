import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Plane,
  Car,
  Hotel,
  Ship,
  Train,
  ChevronDown,
  CheckCircle2,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import type { Booking, Itinerary, ImpactedBooking, Disruption } from '../lib/types';
import { useWikipediaImage, useBookingPhotos } from '../lib/useWikipediaImage';

interface Props {
  itinerary: Itinerary;
  sortedBookings: Booking[];
  selectedBookingId?: string;
  onSelectBooking?: (id: string) => void;
  activeDisruptions?: Disruption[];
  impactedMap?: Map<string, ImpactedBooking>;
}

// ---------------------------------------------------------------------------
// IATA airport coordinate lookup — used to draw realistic flight arcs between
// airports when a flight booking's origin/destination is known by IATA code.
// ---------------------------------------------------------------------------
const IATA_COORDS: Record<string, [number, number]> = {
  DEL: [28.5562, 77.1000], // Indira Gandhi International, New Delhi
  GOI: [15.3808, 73.8314], // Goa International (Dabolim)
  BOM: [19.0896, 72.8656], // Chhatrapati Shivaji Maharaj, Mumbai
  BLR: [13.1986, 77.7066], // Kempegowda International, Bengaluru
  MAA: [12.9941, 80.1709], // Chennai International
  HYD: [17.2403, 78.4294], // Rajiv Gandhi International, Hyderabad
  CCU: [22.6542, 88.4467], // Netaji Subhas Chandra Bose, Kolkata
  AMD: [23.0771, 72.6347], // Sardar Vallabhbhai Patel, Ahmedabad
  JAI: [26.8242, 75.8122], // Jaipur International
  JSA: [26.8887, 70.8649], // Jaisalmer Airport
  IDR: [22.7218, 75.8011], // Devi Ahilya Bai Holkar, Indore
  PNQ: [18.5793, 73.9089], // Pune Airport
  COK: [ 9.9957, 76.2711], // Cochin International
  TRV: [ 8.4824, 76.9199], // Trivandrum International
  IXC: [30.6735, 76.7885], // Chandigarh International
  SXR: [33.9870, 74.7742], // Sheikh ul-Alam, Srinagar
  LKO: [26.7606, 80.8893], // Chaudhary Charan Singh, Lucknow
  PAT: [25.5913, 85.0879], // Jay Prakash Narayan, Patna
  IXB: [26.6813, 88.3286], // Bagdogra (Siliguri)
  IXL: [34.1359, 77.5465], // Kushok Bakula Rimpochee Airport, Leh (Ladakh)
  IXJ: [32.6891, 74.8374], // Jammu Airport
  ATQ: [31.7096, 74.7973], // Sri Guru Ram Dass Jee, Amritsar
  IXD: [25.7231, 82.8584], // Allahabad (Prayagraj) Airport
  VNS: [25.4524, 82.8593], // Lal Bahadur Shastri, Varanasi
  NAG: [21.0922, 79.0472], // Dr. Babasaheb Ambedkar, Nagpur
  GAU: [26.1061, 91.5859], // Lokpriya Gopinath Bordoloi, Guwahati
  DIB: [27.4839, 95.0169], // Dibrugarh Airport
  IMP: [27.1450, 93.8975], // Imphal Airport
  MYQ: [11.7700, 76.6597], // Calicut International (Kozhikode)
  TIR: [13.6325, 79.5433], // Tirupati Airport
  HBX: [15.3617, 75.0150], // Hubli Airport
  DXB: [25.2528, 55.3644], // Dubai International
  AUH: [24.4330, 54.6511], // Abu Dhabi International
  DOH: [25.2731, 51.6080], // Hamad International, Doha
  SIN: [ 1.3644, 103.9915], // Singapore Changi
  KUL: [ 2.7456, 101.7099], // Kuala Lumpur International
  BKK: [13.6900, 100.7501], // Suvarnabhumi, Bangkok
  LHR: [51.4700, -0.4543], // London Heathrow
  CDG: [49.0097,  2.5479], // Paris Charles de Gaulle
  FRA: [50.0379,  8.5622], // Frankfurt Airport
  AMS: [52.3105,  4.7683], // Amsterdam Schiphol
  JFK: [40.6413, -73.7781], // New York JFK
  EWR: [40.6895, -74.1745], // Newark Liberty
  ORD: [41.9742, -87.9073], // O'Hare International, Chicago
  LAX: [33.9425, -118.4081], // Los Angeles International
  SFO: [37.6213, -122.3790], // San Francisco International
  SYD: [-33.9399, 151.1753], // Sydney Kingsford Smith
  MEL: [-37.6690, 144.8410], // Melbourne Airport
};

// ---------------------------------------------------------------------------
// Nominatim geocoder — resolves any place name or IATA code that isn't in
// the static table. Results are cached in module scope so repeated renders
// don't re-fetch the same place.
// ---------------------------------------------------------------------------
const geocodeCache = new Map<string, [number, number] | null>();

async function geocodePlace(query: string): Promise<[number, number] | null> {
  if (geocodeCache.has(query)) return geocodeCache.get(query)!;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) { geocodeCache.set(query, null); return null; }
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) { geocodeCache.set(query, null); return null; }
    const coord: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    geocodeCache.set(query, coord);
    return coord;
  } catch {
    geocodeCache.set(query, null);
    return null;
  }
}

/** Resolve all named/unresolvable bookings to coords via Nominatim. */
function useGeocodeResolution(bookings: Booking[]): Map<string, [number, number]> {
  const [resolved, setResolved] = useState<Map<string, [number, number]>>(new Map());

  useEffect(() => {
    const unresolved = bookings.filter((b) => {
      if (b.location.type === 'coordinates') return false;
      // named location — need geocoding
      return true;
    });
    // Also resolve flights where destinationCoords is missing
    const flightsNeedingDest = bookings.filter((b) => {
      if (b.type !== 'flight') return false;
      if (b.meta?.destinationCoords) return false;
      const iata = b.meta?.destinationIata as string | undefined;
      if (iata && IATA_COORDS[iata]) return false;
      return true;
    });

    if (unresolved.length === 0 && flightsNeedingDest.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates = new Map<string, [number, number]>();

      for (const b of unresolved) {
        if (cancelled) break;
        const name = (b.location as { type: 'named'; name: string }).name;
        const coord = await geocodePlace(name);
        if (coord) updates.set(b.id, coord);
      }

      for (const b of flightsNeedingDest) {
        if (cancelled) break;
        const iata = b.meta?.destinationIata as string | undefined;
        const query = iata ? `${iata} airport` : (b.meta?.destinationLabel as string | undefined) ?? '';
        if (!query) continue;
        const coord = await geocodePlace(query);
        if (coord) updates.set(`${b.id}__dest`, coord);
      }

      if (!cancelled && updates.size > 0) {
        setResolved((prev) => {
          const next = new Map(prev);
          updates.forEach((v, k) => next.set(k, v));
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [bookings]);

  return resolved;
}


// Key format: "ORIG-DEST" (alphabetically sorted so DEL-GOI === GOI-DEL lookup).
// Each entry is an array of intermediate [lat, lng] waypoints between the two airports.
// ---------------------------------------------------------------------------
const FLIGHT_WAYPOINTS: Record<string, [number, number][]> = {
  'DEL-GOI': [
    [25.20, 76.50], // Kota, Rajasthan
    [20.50, 75.20], // Aurangabad, Maharashtra
    [17.30, 74.40], // Kolhapur
  ],
  'DEL-BOM': [
    [26.45, 75.80], // Ajmer
    [23.18, 74.60], // Vadodara approach
  ],
  'DEL-BLR': [
    [23.50, 76.80], // Central MP
    [18.00, 76.00], // Solapur
  ],
  'BOM-DEL': [
    [23.18, 74.60],
    [26.45, 75.80],
  ],
  'GOI-DEL': [
    [17.30, 74.40],
    [20.50, 75.20],
    [25.20, 76.50],
  ],
  'BOM-GOI': [
    [18.00, 73.50],
    [16.50, 73.60],
  ],
  'GOI-BOM': [
    [16.50, 73.60],
    [18.00, 73.50],
  ],
  'JSA-BOM': [
    [25.30, 72.00],
    [23.00, 72.50],
    [20.00, 73.00],
  ],
  'BLR-IXL': [
    [18.50, 77.50], // Central Deccan
    [24.00, 77.00], // Near Bhopal
    [28.60, 77.20], // Delhi NCR
    [32.00, 76.50], // Himachal foothills
  ],
  'IXL-BLR': [
    [32.00, 76.50],
    [28.60, 77.20],
    [24.00, 77.00],
    [18.50, 77.50],
  ],
  'DEL-IXL': [
    [30.50, 77.50], // Dehradun area
    [32.50, 77.30], // Shimla/Kinnaur
  ],
  'IXL-DEL': [
    [32.50, 77.30],
    [30.50, 77.50],
  ],
  'BOM-IXL': [
    [23.00, 76.50],
    [27.00, 76.50],
    [30.50, 77.00],
    [32.50, 77.30],
  ],
  'IXL-BOM': [
    [32.50, 77.30],
    [30.50, 77.00],
    [27.00, 76.50],
    [23.00, 76.50],
  ],
  'SXR-IXL': [
    [34.05, 75.50],
  ],
  'IXL-SXR': [
    [34.05, 75.50],
  ],
};

/** Get waypoints for a flight between two IATA codes (handles both directions). */
function getFlightWaypoints(fromIata: string, toIata: string): [number, number][] {
  const key = `${fromIata}-${toIata}`;
  const reverseKey = `${toIata}-${fromIata}`;
  return FLIGHT_WAYPOINTS[key] ?? FLIGHT_WAYPOINTS[reverseKey] ?? [];
}

/** Extract IATA code from a location label like "Indira Gandhi International Airport (DEL)". */
function extractIata(label: string): string | null {
  const match = label.match(/\(([A-Z]{3})\)/);
  return match ? match[1] : null;
}

/** Resolve a booking's map coordinate — static table first, then geocoded fallback. */
function resolveCoord(booking: Booking, geocoded?: Map<string, [number, number]>): [number, number] | null {
  if (booking.location.type === 'coordinates') {
    return [booking.location.lat, booking.location.lng];
  }
  // Try to extract IATA from named label
  const iata = extractIata(booking.location.name);
  if (iata && IATA_COORDS[iata]) return IATA_COORDS[iata];
  // Fallback: runtime-geocoded value
  return geocoded?.get(booking.id) ?? null;
}

/** Get destination coords for a flight — meta first, then static table, then geocoded. */
function resolveFlightDest(booking: Booking, geocoded?: Map<string, [number, number]>): [number, number] | null {
  if (!booking.meta) return null;
  const destCoords = booking.meta.destinationCoords as [number, number] | undefined;
  if (destCoords) return destCoords;
  const destIata = booking.meta.destinationIata as string | undefined;
  if (destIata && IATA_COORDS[destIata]) return IATA_COORDS[destIata];
  // Fallback: runtime-geocoded value keyed as `{id}__dest`
  return geocoded?.get(`${booking.id}__dest`) ?? null;
}

// ---------------------------------------------------------------------------
// Badge colours & icons per booking type
// ---------------------------------------------------------------------------
const TYPE_COLOR: Record<string, string> = {
  flight:   '#2563EB',
  transfer: '#F97316',
  hotel:    '#16A34A',
  activity: '#16A34A',
  train:    '#7C3AED',
  event:    '#DB2777',
};

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  flight:   Plane,
  transfer: Car,
  hotel:    Hotel,
  activity: Ship,
  train:    Train,
  event:    Plane,
};


// ---------------------------------------------------------------------------
// Build the HTML for a map pin card
// ---------------------------------------------------------------------------
function buildPinHtml(
  number: number | string,
  badgeColor: string,
  title: string,
  subtitle: string,
  photoUrl?: string,
): string {
  const thumb = photoUrl
    ? `<img src="${photoUrl}" alt="" style="width:42px;height:32px;border-radius:8px;object-fit:cover;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.15);" />`
    : `<div style="width:34px;height:34px;border-radius:9999px;background:${badgeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`;

  return `
    <div style="display:flex;align-items:center;filter:drop-shadow(0 8px 16px rgba(0,0,0,0.12));cursor:pointer;">
      <div style="width:24px;height:24px;border-radius:9999px;background:${badgeColor};color:#FFFFFF;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px ${badgeColor}66;z-index:10;margin-right:-8px;flex-shrink:0;">
        ${number}
      </div>
      <div style="background:rgba(255,255,255,0.97);backdrop-filter:blur(8px);border-radius:18px;padding:6px 14px 6px 14px;display:flex;align-items:center;gap:9px;border:1px solid #E2E8F0;">
        ${thumb}
        <div style="line-height:1.25;">
          <div style="font-weight:700;font-size:12px;color:#0F172A;white-space:nowrap;">${title}</div>
          <div style="font-size:10px;color:#64748B;font-weight:500;white-space:nowrap;">${subtitle}</div>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Build departure pin HTML (for flight origin that isn't a numbered stop)
// ---------------------------------------------------------------------------
function buildDeparturePinHtml(label: string, sublabel: string): string {
  return `
    <div style="display:flex;align-items:center;filter:drop-shadow(0 8px 16px rgba(0,0,0,0.12));cursor:pointer;">
      <div style="width:24px;height:24px;border-radius:9999px;background:#2563EB;color:#FFFFFF;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(37,99,235,0.4);z-index:10;margin-right:-8px;flex-shrink:0;">
        ✈
      </div>
      <div style="background:rgba(255,255,255,0.97);backdrop-filter:blur(8px);border-radius:18px;padding:6px 14px 6px 14px;display:flex;align-items:center;gap:9px;border:1px solid #E2E8F0;">
        <div style="width:34px;height:34px;border-radius:9999px;background:#1E3A8A;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
          </svg>
        </div>
        <div style="line-height:1.25;">
          <div style="font-weight:700;font-size:12px;color:#0F172A;white-space:nowrap;">${label}</div>
          <div style="font-size:10px;color:#64748B;font-weight:500;white-space:nowrap;">${sublabel}</div>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MapView({
  itinerary,
  sortedBookings,
  selectedBookingId,
  onSelectBooking,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const [activeLeg, setActiveLeg] = useState<number | null>(null);
  const [tileLayerType, setTileLayerType] = useState<'voyager' | 'osm'>('osm');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'both' | 'route' | 'summary' | 'map'>('both');

  // Header photo — Wikipedia image for destination, fallback to Unsplash
  const destQuery = itinerary.destination.split(',')[0].trim();
  const wikiHeader = useWikipediaImage(destQuery);
  const headerPhoto = wikiHeader;
  const bookingPhotos = useBookingPhotos(sortedBookings, itinerary.destination);

  // Geocode any named locations that aren't in the static IATA table
  const geocoded = useGeocodeResolution(sortedBookings);

  // ---------------------------------------------------------------------------
  // Derive route items from actual booking data
  // ---------------------------------------------------------------------------
  const routeItems = useMemo(() => {
    return sortedBookings.map((b, idx) => {
      const coord = resolveCoord(b, geocoded);
      // For flights, the "pin" goes at the destination (where you land/depart to)
      // but if no destination coord, fall back to origin coord
      const destCoord = b.type === 'flight' ? resolveFlightDest(b, geocoded) : null;
      const latLng: [number, number] = coord ?? [20.5937, 78.9629]; // fallback: center of India

      const badgeColor = TYPE_COLOR[b.type] ?? '#2563EB';
      const Icon = TYPE_ICON[b.type] ?? Plane;

      // Derive short subtitle from provider or meta
      let subtitle = b.provider.split('·')[0].trim();
      if (b.type === 'flight' && b.meta?.flightNumber) {
        subtitle = String(b.meta.flightNumber);
      }
      if (b.type === 'transfer' && b.meta?.vehicle) {
        subtitle = String(b.meta.vehicle);
      }

      // Short right-panel code
      let rightCode = b.type.toUpperCase();
      if (b.meta?.route) rightCode = String(b.meta.route).replace('➔', '→');

      return {
        id: b.id,
        number: idx + 1,
        title: b.title,
        subtitle,
        badgeColor,
        icon: Icon,
        rightCode,
        latLng,
        destCoord,
        type: b.type,
        booking: b,
      };
    });
  }, [sortedBookings, geocoded]);

  // Checklist items for right panel — derived from route items
  const checklistItems = useMemo(() => {
    return routeItems.map((item) => ({
      label: item.title,
      sub: item.rightCode,
      number: item.number,
    }));
  }, [routeItems]);

  // ---------------------------------------------------------------------------
  // Date range display
  // ---------------------------------------------------------------------------
  const dateRange = useMemo(() => {
    const fmt = (d: string) => {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    return `${fmt(itinerary.startDate)} – ${fmt(itinerary.endDate)}`;
  }, [itinerary.startDate, itinerary.endDate]);

  // ---------------------------------------------------------------------------
  // Leaflet map initialisation — async so Nominatim geocoding completes first
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;

    async function buildAndRender() {
      // ── Resolve all coords before touching the DOM ──
      // This ensures we draw everything in one pass, no partial-then-redraw flicker.
      const coordMap = new Map<string, [number, number]>();
      const destCoordMap = new Map<string, [number, number]>();

      await Promise.all(
        sortedBookings.map(async (b) => {
          // Origin
          if (b.location.type === 'coordinates') {
            coordMap.set(b.id, [b.location.lat, b.location.lng]);
          } else {
            const iata = extractIata(b.location.name);
            const c = (iata && IATA_COORDS[iata]) ?? await geocodePlace(b.location.name);
            if (c) coordMap.set(b.id, c);
          }

          // Flight destination
          if (b.type === 'flight') {
            const destCoords = b.meta?.destinationCoords as [number, number] | undefined;
            if (destCoords) {
              destCoordMap.set(b.id, destCoords);
            } else {
              const destIata = (b.meta?.destinationIata as string | undefined)
                ?? b.title.match(/→\s*([A-Z]{3})\b/)?.[1];
              if (destIata) {
                const c = IATA_COORDS[destIata] ?? await geocodePlace(`${destIata} airport`);
                if (c) destCoordMap.set(b.id, c);
              }
            }
          }
        })
      );

      if (cancelled) return;

      // ── Tear down old map instance, build fresh ──
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (!mapContainerRef.current || cancelled) return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        fadeAnimation: true,
      });
      mapInstanceRef.current = map;

      const tileUrl = tileLayerType === 'voyager'
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: tileLayerType === 'voyager' ? 'abcd' : 'abc',
        attribution: tileLayerType === 'voyager'
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      markersRef.current = {};
      const localCoords: [number, number][] = [];

      routeItems.forEach((item, idx) => {
        const b = item.booking;

        if (b.type === 'flight') {
          const originCoord = coordMap.get(b.id) ?? null;
          const destCoord = destCoordMap.get(b.id) ?? null;

          if (originCoord && destCoord) {
            const originLabel = b.location.type === 'coordinates'
              ? (b.location.label ?? '') : b.location.name;
            const originIata = extractIata(originLabel);
            const destIata = (b.meta?.destinationIata as string | undefined)
              ?? b.title.match(/→\s*([A-Z]{3})\b/)?.[1];

            const midpoints = (originIata && destIata)
              ? getFlightWaypoints(originIata, destIata) : [];
            const flightPath: [number, number][] = [originCoord, ...midpoints, destCoord];

            L.polyline(flightPath, { color: '#2563EB', weight: 2, opacity: 0.8, dashArray: '6, 5', lineCap: 'round' }).addTo(map);

            // Midpoint airplane icon
            const midPoint = flightPath[Math.floor(flightPath.length / 2)];
            L.marker(midPoint, {
              icon: L.divIcon({
                html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#FFFFFF;border:2px solid #2563EB;box-shadow:0 4px 12px rgba(37,99,235,0.25);transform:rotate(-45deg);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg></div>`,
                className: 'custom-leaflet-marker', iconSize: [30, 30], iconAnchor: [15, 15],
              }),
              interactive: false, zIndexOffset: -10,
            }).addTo(map);

            // Departure pin — skip if previous stop ends at same location
            const prevCoord = idx > 0
              ? (routeItems[idx - 1].booking.type === 'flight'
                  ? destCoordMap.get(routeItems[idx - 1].booking.id)
                  : coordMap.get(routeItems[idx - 1].booking.id)) ?? null
              : null;
            const sameOriginAsPrev = prevCoord &&
              Math.abs(prevCoord[0] - originCoord[0]) < 0.01 &&
              Math.abs(prevCoord[1] - originCoord[1]) < 0.01;

            if (!sameOriginAsPrev) {
              const shortName = originIata ? `${originIata} Airport` : originLabel.split(',')[0] || 'Departure';
              L.marker(originCoord, {
                icon: L.divIcon({ html: buildDeparturePinHtml(shortName, 'Departure'), className: 'custom-leaflet-marker', iconSize: [180, 48], iconAnchor: [12, 24] }),
                zIndexOffset: 100,
              }).addTo(map);
            }

            // Numbered arrival pin
            const arrivalLabel = destIata ? `${destIata} Airport` : 'Arrival';
            const arrMarker = L.marker(destCoord, {
              icon: L.divIcon({ html: buildPinHtml(item.number, item.badgeColor, arrivalLabel, item.subtitle), className: 'custom-leaflet-marker', iconSize: [200, 48], iconAnchor: [12, 24] }),
              zIndexOffset: 200,
            }).addTo(map);
            markersRef.current[item.id] = arrMarker;
            arrMarker.on('click', () => { setActiveLeg(item.number); if (onSelectBooking) onSelectBooking(b.id); });
            localCoords.push(destCoord);

          } else if (destCoord) {
            // Origin unknown — at least pin the arrival
            const destIata = (b.meta?.destinationIata as string | undefined) ?? b.title.match(/→\s*([A-Z]{3})\b/)?.[1];
            const arrMarker = L.marker(destCoord, {
              icon: L.divIcon({ html: buildPinHtml(item.number, item.badgeColor, destIata ? `${destIata} Airport` : item.title, item.subtitle), className: 'custom-leaflet-marker', iconSize: [200, 48], iconAnchor: [12, 24] }),
              zIndexOffset: 200,
            }).addTo(map);
            markersRef.current[item.id] = arrMarker;
            arrMarker.on('click', () => { setActiveLeg(item.number); if (onSelectBooking) onSelectBooking(b.id); });
            localCoords.push(destCoord);
          }

        } else {
          // ── Ground leg ──
          const coord = coordMap.get(b.id) ?? null;
          if (!coord) return;

          // Connecting line from previous stop
          const prevCoord: [number, number] | null = (() => {
            if (idx === 0) return null;
            const prev = routeItems[idx - 1];
            return (prev.booking.type === 'flight'
              ? destCoordMap.get(prev.booking.id)
              : coordMap.get(prev.booking.id)) ?? null;
          })();

          if (prevCoord) {
            L.polyline([prevCoord, coord], { color: '#2563EB', weight: 2, opacity: 0.75, dashArray: '6, 5', lineCap: 'round' }).addTo(map);
          }

          const photo = bookingPhotos[b.id];
          const marker = L.marker(coord, {
            icon: L.divIcon({ html: buildPinHtml(item.number, item.badgeColor, item.title, item.subtitle, photo), className: 'custom-leaflet-marker', iconSize: [220, 48], iconAnchor: [12, 24] }),
            zIndexOffset: 200,
          }).addTo(map);
          markersRef.current[item.id] = marker;
          marker.on('click', () => { setActiveLeg(item.number); if (onSelectBooking) onSelectBooking(b.id); });
          localCoords.push(coord);
        }
      });

      if (localCoords.length > 0) {
        map.fitBounds(L.latLngBounds(localCoords), {
          paddingTopLeft: [300, 60],
          paddingBottomRight: [300, 60],
          maxZoom: 13,
        });
      }
    }

    buildAndRender().catch(console.warn);

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [sortedBookings, tileLayerType, onSelectBooking, bookingPhotos]);

  // Pan to a leg on click
  const handleSelectLeg = (legNumber: number) => {
    setActiveLeg(legNumber);
    const target = routeItems.find((r) => r.number === legNumber);
    if (!target || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(target.latLng, 13, { duration: 0.9 });
  };

  const handleResetBounds = useCallback(() => {
    setActiveLeg(null);
    if (!mapInstanceRef.current) return;
    const localCoords: [number, number][] = [];
    routeItems.forEach((item) => {
      if (item.booking.type === 'flight') {
        const d = resolveFlightDest(item.booking, geocoded);
        if (d) localCoords.push(d);
      } else {
        const c = resolveCoord(item.booking, geocoded);
        if (c) localCoords.push(c);
      }
    });
    if (localCoords.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(localCoords), {
        paddingTopLeft: [300, 60],
        paddingBottomRight: [300, 60],
        maxZoom: 13,
      });
    }
  }, [routeItems, geocoded]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-gray-200/90 shadow-xs bg-[#EAF2F8] select-none transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none h-screen'
          : 'h-[620px] sm:h-[680px] lg:h-[720px]'
      }`}
    >
      {/* Leaflet map */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ── Mobile tabs ── */}
      <div className="absolute top-3 left-3 right-3 z-30 lg:hidden flex items-center justify-between gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-gray-200/90 shadow-sm">
        {(['route', 'map', 'summary'] as const).map((panel) => (
          <button
            key={panel}
            onClick={() => setMobilePanel(mobilePanel === panel ? 'both' : panel)}
            className={`flex-1 py-1 px-2.5 rounded-lg text-xs font-semibold transition-all capitalize ${
              mobilePanel === panel
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {panel === 'route' ? 'Trip Route' : panel === 'map' ? 'Map View' : 'Summary'}
          </button>
        ))}
      </div>

      {/* ── LEFT PANEL: Trip Route ── */}
      <div
        className={`absolute left-5 top-5 z-20 w-72 sm:w-80 transition-all duration-200 ${
          mobilePanel === 'summary' || mobilePanel === 'map' ? 'hidden lg:block' : 'block'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-xl border border-gray-100/90">
          <h3 className="font-display font-bold text-gray-900 text-base mb-5 tracking-tight">
            Trip Route
          </h3>
          <div className="relative space-y-4">
            {routeItems.map((leg, index) => {
              const Icon = leg.icon;
              const isSelected = activeLeg === leg.number;
              const isLast = index === routeItems.length - 1;
              return (
                <div
                  key={leg.id}
                  onClick={() => handleSelectLeg(leg.number)}
                  className={`group relative flex items-center justify-between p-2 -mx-2 rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70 border border-blue-200/80 shadow-2xs'
                      : 'hover:bg-gray-50/80 border border-transparent'
                  }`}
                >
                  <div className="relative flex items-center gap-3 min-w-0">
                    <div className="relative flex items-center justify-center flex-shrink-0">
                      {!isLast && (
                        <div className="absolute top-6 bottom-[-22px] w-[2px] bg-gray-200 left-1/2 -translate-x-1/2" aria-hidden="true" />
                      )}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white z-10 shadow-2xs transition-transform group-hover:scale-105"
                        style={{ backgroundColor: leg.badgeColor }}
                      >
                        {leg.number}
                      </div>
                    </div>
                    <span className={`text-xs sm:text-sm font-semibold truncate transition-colors ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
                      {leg.title}
                    </span>
                  </div>
                  <Icon size={16} className={`flex-shrink-0 ml-2 transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: Trip Summary ── */}
      <div
        className={`absolute right-5 top-5 z-20 w-72 sm:w-80 transition-all duration-200 ${
          mobilePanel === 'route' || mobilePanel === 'map' ? 'hidden lg:block' : 'block'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl border border-gray-100/90">
          <div className="relative h-24 sm:h-28 w-full overflow-hidden bg-gray-100">
            {headerPhoto ? (
              <img src={headerPhoto} alt={itinerary.destination} className="w-full h-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-display font-bold text-gray-900 text-base leading-tight">
                {itinerary.destination}
              </h3>
              <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            </div>
            <p className="text-xs text-gray-500 font-medium mb-4">{dateRange}</p>
            <div className="space-y-3">
              {checklistItems.map((item) => {
                const isSelected = activeLeg === item.number;
                return (
                  <div
                    key={item.number}
                    onClick={() => handleSelectLeg(item.number)}
                    className={`flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-50/70 border border-emerald-200/60'
                        : 'hover:bg-gray-50/80 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 size={17} className="text-emerald-600 fill-emerald-600/20 flex-shrink-0" />
                      <span className="text-xs font-semibold text-gray-800 truncate">{item.label}</span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap ml-1">{item.sub}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Controls ── */}
      <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2">
        <button onClick={handleResetBounds} title="Reset map view" className="p-2 rounded-xl bg-white/95 hover:bg-white border border-gray-200/90 shadow-md text-gray-700 hover:text-gray-900 transition-all cursor-pointer">
          <RotateCcw size={15} />
        </button>
        <button
          onClick={() => setTileLayerType(tileLayerType === 'osm' ? 'voyager' : 'osm')}
          title={tileLayerType === 'osm' ? 'Switch to Carto Voyager (requires API key)' : 'Switch to OpenStreetMap Standard'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white border border-gray-200/90 shadow-md text-xs font-semibold text-gray-700 hover:text-gray-900 transition-all cursor-pointer"
        >
          <Layers size={13} />
          <span>{tileLayerType === 'osm' ? 'OSM Standard' : 'Voyager'}</span>
        </button>
        <button onClick={() => mapInstanceRef.current?.zoomIn()} title="Zoom in" className="p-2 rounded-xl bg-white/95 hover:bg-white border border-gray-200/90 shadow-md text-gray-700 hover:text-gray-900 transition-all cursor-pointer">
          <ZoomIn size={15} />
        </button>
        <button onClick={() => mapInstanceRef.current?.zoomOut()} title="Zoom out" className="p-2 rounded-xl bg-white/95 hover:bg-white border border-gray-200/90 shadow-md text-gray-700 hover:text-gray-900 transition-all cursor-pointer">
          <ZoomOut size={15} />
        </button>
        <button onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} className="p-2 rounded-xl bg-white/95 hover:bg-white border border-gray-200/90 shadow-md text-gray-700 hover:text-gray-900 transition-all cursor-pointer">
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 left-4 z-20 text-[10px] font-mono text-gray-500/80 bg-white/80 px-2 py-0.5 rounded-md backdrop-blur-xs border border-gray-200/40">
        Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>
      </div>
    </div>
  );
}
