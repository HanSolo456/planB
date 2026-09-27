import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Itinerary } from '../lib/types';
import type { LocationWeather, WeatherImpact } from '../lib/weatherEngine';

interface Props {
  itinerary: Itinerary;
  locationWeathers: LocationWeather[];
  weatherImpacts: WeatherImpact[];
  scenarioActive: boolean;
}

// ---------------------------------------------------------------------------
// SEVERITY COLOR (for Leaflet circles)
// ---------------------------------------------------------------------------
function severityToColor(severity: 0 | 1 | 2 | 3 | 4): string {
  return ['#10B981', '#F59E0B', '#F97316', '#EF4444', '#7C3AED'][severity];
}

function riskToColor(score: number): string {
  if (score >= 70) return '#EF4444';
  if (score >= 40) return '#F97316';
  if (score >= 20) return '#F59E0B';
  return '#10B981';
}

// ---------------------------------------------------------------------------
// BOOKING TYPE EMOJI / MARKER LABEL
// ---------------------------------------------------------------------------
const TYPE_LABEL: Record<string, string> = {
  flight: 'FL',
  transfer: 'TR',
  hotel: 'HT',
  activity: 'AC',
  train: 'RW',
  event: 'EV',
};

// ---------------------------------------------------------------------------
// CREATE CUSTOM MARKER WITH RISK BADGE
// ---------------------------------------------------------------------------
function createWeatherMarker(
  emoji: string,
  riskScore: number,
  isScenario: boolean
): L.DivIcon {
  const color = riskToColor(riskScore);
  const pulse = riskScore > 50;

  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${pulse ? `
          <div style="
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: ${color};
            opacity: 0.2;
            animation: weatherPulse 1.8s ease-in-out infinite;
          "></div>
          <div style="
            position: absolute;
            inset: 4px;
            border-radius: 50%;
            background: ${color};
            opacity: 0.15;
            animation: weatherPulse 1.8s ease-in-out infinite 0.4s;
          "></div>
        ` : ''}
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${isScenario ? '#F1F5F9' : '#FFFFFF'};
          border: 2.5px solid ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          position: relative;
          z-index: 1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18), 0 0 0 3px ${color}30;
        ">
          ${emoji}
        </div>
        ${riskScore > 15 ? `
          <div style="
            position: absolute;
            top: 0;
            right: 0;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${color};
            border: 1px solid #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7px;
            font-weight: 900;
            color: white;
            z-index: 2;
          ">${riskScore}</div>
        ` : ''}
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// WEATHER MAP OVERLAY
// ---------------------------------------------------------------------------
export default function WeatherMapOverlay({
  itinerary,
  locationWeathers,
  weatherImpacts,
  scenarioActive,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map with dark tile layer
    const map = L.map(mapRef.current, {
      center: [20.5937, 78.9629], // India center
      zoom: 5,
      zoomControl: false,
    });

    // Light map tiles — OpenStreetMap (free, no API key required)
    L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    ).addTo(map);

    // Add zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    // Inject pulse animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes weatherPulse {
        0%, 100% { transform: scale(1); opacity: 0.2; }
        50% { transform: scale(1.6); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // UPDATE LAYERS when data changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing layers
    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];

    const bounds: [number, number][] = [];

    // Build impact lookup
    const impactByBookingId = new Map(weatherImpacts.map((i) => [i.bookingId, i]));

    // ── Draw weather location circles ──
    for (const lw of locationWeathers) {
      const color = severityToColor(lw.current.severity);
      const radius = 15000 + lw.current.precipitation * 500 + lw.current.windSpeed * 200;

      // Outer glow ring
      const outerCircle = L.circle([lw.lat, lw.lng], {
        radius: radius * 1.8,
        color: color,
        fillColor: color,
        fillOpacity: 0.04,
        weight: 0,
      }).addTo(map);
      layersRef.current.push(outerCircle);

      // Inner weather bubble
      const circle = L.circle([lw.lat, lw.lng], {
        radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 1.5,
        opacity: 0.6,
      }).addTo(map);

      circle.bindPopup(`
        <div style="
          background: #FFFFFF;
          border: 1px solid ${color}40;
          border-radius: 12px;
          padding: 12px;
          color: #17212B;
          min-width: 200px;
          font-family: system-ui, sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        ">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
            <strong style="font-size:12px;">${lw.label}</strong>
          </div>
          <div style="font-size:11px;color:#4A5568;margin-bottom:6px;">${lw.current.weatherLabel}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
            <div>Temp: <strong style="color:#17212B;">${lw.current.temperature.toFixed(1)}°C</strong></div>
            <div>Rain: <strong style="color:#17212B;">${lw.current.precipitation.toFixed(1)} mm/h</strong></div>
            <div>Wind: <strong style="color:#17212B;">${lw.current.windSpeed.toFixed(0)} km/h</strong></div>
            <div>Cloud: <strong style="color:#17212B;">${lw.current.cloudCover}%</strong></div>
          </div>
          ${scenarioActive ? `<div style="margin-top:8px;padding:6px;background:#FBF0E4;border-radius:6px;font-size:10px;color:#E08A3C;border:1px solid #F0C896;">SIMULATED CONDITIONS</div>` : ''}
        </div>
      `, {
        className: 'leaflet-weather-popup',
      });

      layersRef.current.push(circle);
      bounds.push([lw.lat, lw.lng]);
    }

    // ── Draw booking markers ──
    for (const booking of itinerary.bookings) {
      if (booking.location.type !== 'coordinates') continue;
      const { lat, lng, label } = booking.location;

      const impact = impactByBookingId.get(booking.id);
      const riskScore = impact?.weatherRiskScore ?? 0;
      const emoji = TYPE_LABEL[booking.type] ?? '--';

      const marker = L.marker([lat, lng], {
        icon: createWeatherMarker(emoji, riskScore, scenarioActive),
        zIndexOffset: riskScore > 50 ? 1000 : 0,
      }).addTo(map);

      const impactHtml = impact && riskScore > 5
        ? `
          <div style="margin-top:8px;padding:6px;border-radius:8px;background:${riskToColor(riskScore)}18;border:1px solid ${riskToColor(riskScore)}40;">
            <div style="font-size:10px;font-weight:bold;color:${riskToColor(riskScore)};margin-bottom:2px;">
              ${riskScore}% Weather Risk
            </div>
            <div style="font-size:10px;color:#374151;">${impact.reason}</div>
            <div style="display:flex;gap:8px;margin-top:4px;font-size:10px;">
              <span style="color:#92400E;font-weight:600;">Delay: ${Math.round(impact.probabilityOfDelay * 100)}%</span>
              <span style="color:#991B1B;font-weight:600;">Cancel: ${Math.round(impact.probabilityOfCancellation * 100)}%</span>
            </div>
          </div>
        `
        : `<div style="margin-top:6px;font-size:10px;color:#065F46;font-weight:500;">No significant weather impact</div>`;

      marker.bindPopup(`
        <div style="
          background: #FFFFFF;
          border: 1px solid #DDD8CE;
          border-radius: 12px;
          padding: 12px;
          color: #17212B;
          min-width: 220px;
          font-family: system-ui, sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        ">
          <div style="font-weight:bold;font-size:12px;margin-bottom:4px;">${booking.title}</div>
          <div style="font-size:10px;color:#4A5568;margin-bottom:4px;">${booking.provider}</div>
          <div style="font-size:10px;color:#8896A4;">${label ?? ''}</div>
          ${impactHtml}
        </div>
      `, { className: 'leaflet-weather-popup' });

      layersRef.current.push(marker);
      bounds.push([lat, lng]);
    }

    // ── Draw cascade connections ──
    const sortedByStart = [...itinerary.bookings].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    for (const booking of sortedByStart) {
      if (booking.location.type !== 'coordinates') continue;
      for (const depId of booking.dependsOn) {
        const dep = itinerary.bookings.find((b) => b.id === depId);
        if (!dep || dep.location.type !== 'coordinates') continue;

        const depImpact = impactByBookingId.get(depId);
        const bookImpact = impactByBookingId.get(booking.id);
        const maxRisk = Math.max(
          depImpact?.weatherRiskScore ?? 0,
          bookImpact?.weatherRiskScore ?? 0
        );
        const lineColor = riskToColor(maxRisk);

        const line = L.polyline(
          [
            [dep.location.lat, dep.location.lng],
            [booking.location.lat, booking.location.lng],
          ],
          {
            color: lineColor,
            weight: maxRisk > 30 ? 4 : 3,
            opacity: 1,
            dashArray: maxRisk > 30 ? '8, 5' : '4, 7',
          }
        ).addTo(map);

        layersRef.current.push(line);
      }
    }

    // ── Fit bounds ──
    if (bounds.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 10 });
      } catch { /* silently ignore */ }
    }
  }, [itinerary, locationWeathers, weatherImpacts, scenarioActive]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 z-[400] rounded-xl border p-3 shadow-sm"
        style={{ backgroundColor: 'white', borderColor: '#DDD8CE', backdropFilter: 'blur(8px)' }}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#8896A4' }}>
          Weather Risk
        </p>
        <div className="space-y-1">
          {[
            { color: '#18B7A0', label: 'Low (<20%)' },
            { color: '#E5A93C', label: 'Moderate (20–40%)' },
            { color: '#E08A3C', label: 'High (40–70%)' },
            { color: '#D95C4F', label: 'Severe (>70%)' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[10px]" style={{ color: '#4A5568' }}>{item.label}</span>
            </div>
          ))}
        </div>
        {scenarioActive && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: '#DDD8CE' }}>
            <p className="text-[10px] font-bold" style={{ color: '#E08A3C' }}>Simulation Mode</p>
          </div>
        )}
      </div>

      {/* Popup styles */}
      <style>{`
        .leaflet-weather-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-weather-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-weather-popup .leaflet-popup-tip-container {
          display: none;
        }
        .leaflet-container {
          background: #F7F4EE !important;
        }
      `}</style>
    </div>
  );
}
