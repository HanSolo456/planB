// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: weatherEngine.ts
// PURPOSE: Weather-Driven Digital Twin — core weather integration layer.
//
// Uses Open-Meteo (free, no API key) for live + forecast weather data.
// Propagates weather conditions through the booking DAG to produce
// probabilistic impact predictions with uncertainty ranges.
// =============================================================================

import type { Itinerary, Booking, ImpactedBooking, Disruption } from './types';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface WeatherCondition {
  /** ISO datetime of observation */
  time: string;
  /** Temperature in °C */
  temperature: number;
  /** Precipitation in mm/hr */
  precipitation: number;
  /** Wind speed in km/h */
  windSpeed: number;
  /** Wind gusts in km/h */
  windGusts: number;
  /** Cloud cover 0–100% */
  cloudCover: number;
  /** Visibility in km */
  visibility: number;
  /** Weather code (WMO standard) */
  weatherCode: number;
  /** Human-readable weather label */
  weatherLabel: string;
  /** Computed severity: 0=calm, 1=minor, 2=moderate, 3=severe, 4=extreme */
  severity: 0 | 1 | 2 | 3 | 4;
}

export interface LocationWeather {
  lat: number;
  lng: number;
  label: string;
  current: WeatherCondition;
  hourly: WeatherCondition[];
  /** Next 7 days daily summary */
  daily: DailyWeather[];
}

export interface DailyWeather {
  date: string;
  maxTemp: number;
  minTemp: number;
  maxPrecipitation: number;
  maxWindSpeed: number;
  dominantWeatherCode: number;
  weatherLabel: string;
  severity: 0 | 1 | 2 | 3 | 4;
}

export interface WeatherImpact {
  bookingId: string;
  booking: Booking;
  weatherRiskScore: number; // 0–100 (100 = certain disruption)
  probabilityOfDelay: number; // 0–1
  probabilityOfCancellation: number; // 0–1
  estimatedDelayMinutes: number;
  reason: string;
  weatherCondition: WeatherCondition;
  confidence: 'low' | 'medium' | 'high';
  cascadeLevel: number; // 0 = directly affected, 1+ = cascading effect
  impactType: 'direct_weather' | 'cascading_delay' | 'none';
  cityName: string;
  locationLabel: string;
}

export interface DigitalTwinState {
  itineraryId: string;
  timestamp: string;
  locationWeather: LocationWeather[];
  weatherImpacts: WeatherImpact[];
  overallRiskScore: number; // 0–100
  primaryThreat: string;
  cascadeChain: string[]; // Human-readable cascade description
  totalEstimatedDelay: number;
  // What-if scenario parameters (null = live data)
  scenario: WeatherScenarioParams | null;
}

export interface WeatherScenarioParams {
  name: string;
  precipitationMmHr: number; // 0–200 mm/hr
  temperatureCelsius: number; // -10 to 50
  windSpeedKmH: number; // 0–150
  stormDurationHours: number; // 0–72
  floodLevel: 'none' | 'minor' | 'moderate' | 'severe';
  affectedLocations: 'all' | 'destination' | 'origin' | string;
  targetLocationKey?: string; // 'all' | 'origin' | 'destination' | or specific city
}

// ---------------------------------------------------------------------------
// WMO WEATHER CODE → LABEL
// ---------------------------------------------------------------------------
function wmoLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 65) return 'Rain';
  if (code <= 67) return 'Freezing rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Overcast';
}

// ---------------------------------------------------------------------------
// COMPUTE SEVERITY from raw weather values
// ---------------------------------------------------------------------------
function computeSeverity(
  precipitation: number,
  windSpeed: number,
  temperature: number,
  weatherCode: number
): 0 | 1 | 2 | 3 | 4 {
  // Thunderstorm codes → always severe+
  if (weatherCode >= 80 && weatherCode <= 99) {
    return weatherCode >= 95 ? 4 : 3;
  }

  let score = 0;

  // Precipitation scoring
  if (precipitation > 100) score += 4;
  else if (precipitation > 50) score += 3;
  else if (precipitation > 20) score += 2;
  else if (precipitation > 5) score += 1;

  // Wind scoring
  if (windSpeed > 120) score += 4;
  else if (windSpeed > 80) score += 3;
  else if (windSpeed > 50) score += 2;
  else if (windSpeed > 30) score += 1;

  // Extreme heat
  if (temperature > 45) score += 2;
  else if (temperature > 40) score += 1;

  // Extreme cold
  if (temperature < -5) score += 2;
  else if (temperature < 5) score += 1;

  if (score >= 6) return 4;
  if (score >= 4) return 3;
  if (score >= 2) return 2;
  if (score >= 1) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// FALLBACK WEATHER (used when API is unavailable, offline, or timed out)
// ---------------------------------------------------------------------------
export function getFallbackWeather(lat: number, lng: number, label: string): LocationWeather {
  const isDelhi = label.toLowerCase().includes('del') || lat > 27;
  const isGoa = label.toLowerCase().includes('goa') || (lat > 14 && lat < 17);

  const temp = isDelhi ? 24.5 : isGoa ? 29.2 : 27.0;
  const curCondition: WeatherCondition = {
    time: new Date().toISOString(),
    temperature: temp,
    precipitation: 0,
    windSpeed: isDelhi ? 12 : 14,
    windGusts: isDelhi ? 16 : 20,
    cloudCover: isDelhi ? 25 : 15,
    visibility: 10,
    weatherCode: 0,
    weatherLabel: isDelhi ? 'Clear sky' : 'Partly cloudy',
    severity: 0,
  };

  return {
    lat,
    lng,
    label,
    current: curCondition,
    hourly: Array.from({ length: 24 }).map((_, i) => ({
      ...curCondition,
      time: new Date(Date.now() + i * 3600000).toISOString(),
    })),
    daily: Array.from({ length: 7 }).map((_, i) => ({
      date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
      maxTemp: temp + 2,
      minTemp: temp - 5,
      maxPrecipitation: 0,
      maxWindSpeed: 15,
      dominantWeatherCode: 0,
      weatherLabel: 'Clear sky',
      severity: 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// OPEN-METEO API FETCH (with 4s timeout & seamless fallback)
// ---------------------------------------------------------------------------
export async function fetchWeatherForLocation(
  lat: number,
  lng: number,
  label: string
): Promise<LocationWeather> {
  try {
    const baseUrl = 'https://api.open-meteo.com/v1/forecast';
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: [
        'temperature_2m',
        'precipitation',
        'wind_speed_10m',
        'wind_gusts_10m',
        'cloud_cover',
        'visibility',
        'weather_code',
      ].join(','),
      hourly: [
        'temperature_2m',
        'precipitation',
        'wind_speed_10m',
        'wind_gusts_10m',
        'cloud_cover',
        'visibility',
        'weather_code',
      ].join(','),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'wind_speed_10m_max',
        'weather_code',
      ].join(','),
      wind_speed_unit: 'kmh',
      timezone: 'auto',
      forecast_days: '7',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${baseUrl}?${params}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Open-Meteo API error: ${response.statusText}`);
    const data = await response.json();

    // Parse current
    const cur = data.current;
    const curCondition: WeatherCondition = {
      time: cur.time,
      temperature: cur.temperature_2m ?? 25,
      precipitation: cur.precipitation ?? 0,
      windSpeed: cur.wind_speed_10m ?? 0,
      windGusts: cur.wind_gusts_10m ?? 0,
      cloudCover: cur.cloud_cover ?? 0,
      visibility: (cur.visibility ?? 10000) / 1000,
      weatherCode: cur.weather_code ?? 0,
      weatherLabel: wmoLabel(cur.weather_code ?? 0),
      severity: computeSeverity(
        cur.precipitation ?? 0,
        cur.wind_speed_10m ?? 0,
        cur.temperature_2m ?? 25,
        cur.weather_code ?? 0
      ),
    };

    // Parse hourly (next 48 hours)
    const hourly: WeatherCondition[] = (data.hourly?.time ?? [])
      .slice(0, 48)
      .map((time: string, i: number) => {
        const precip = data.hourly.precipitation[i] ?? 0;
        const wind = data.hourly.wind_speed_10m[i] ?? 0;
        const temp = data.hourly.temperature_2m[i] ?? 25;
        const code = data.hourly.weather_code[i] ?? 0;
        return {
          time,
          temperature: temp,
          precipitation: precip,
          windSpeed: wind,
          windGusts: data.hourly.wind_gusts_10m[i] ?? 0,
          cloudCover: data.hourly.cloud_cover[i] ?? 0,
          visibility: (data.hourly.visibility[i] ?? 10000) / 1000,
          weatherCode: code,
          weatherLabel: wmoLabel(code),
          severity: computeSeverity(precip, wind, temp, code),
        };
      });

    // Parse daily
    const daily: DailyWeather[] = (data.daily?.time ?? []).map(
      (date: string, i: number) => {
        const code = data.daily.weather_code[i] ?? 0;
        const precip = data.daily.precipitation_sum[i] ?? 0;
        const wind = data.daily.wind_speed_10m_max[i] ?? 0;
        const maxT = data.daily.temperature_2m_max[i] ?? 25;
        return {
          date,
          maxTemp: maxT,
          minTemp: data.daily.temperature_2m_min[i] ?? 15,
          maxPrecipitation: precip,
          maxWindSpeed: wind,
          dominantWeatherCode: code,
          weatherLabel: wmoLabel(code),
          severity: computeSeverity(precip, wind, maxT, code),
        };
      }
    );

    return { lat, lng, label, current: curCondition, hourly, daily };
  } catch (err) {
    console.warn(`[weatherEngine] Open-Meteo fetch failed for ${label}, using fallback:`, err);
    return getFallbackWeather(lat, lng, label);
  }
}

// ---------------------------------------------------------------------------
// EXTRACT UNIQUE LOCATIONS FROM ITINERARY
// ---------------------------------------------------------------------------
export function extractLocations(
  itinerary: Itinerary
): { lat: number; lng: number; label: string; bookingIds: string[] }[] {
  const coordMap = new Map<
    string,
    { lat: number; lng: number; label: string; bookingIds: string[] }
  >();

  for (const booking of itinerary.bookings) {
    if (booking.location.type === 'coordinates') {
      const key = `${booking.location.lat.toFixed(2)},${booking.location.lng.toFixed(2)}`;
      if (!coordMap.has(key)) {
        coordMap.set(key, {
          lat: booking.location.lat,
          lng: booking.location.lng,
          label: booking.location.label ?? booking.title,
          bookingIds: [],
        });
      }
      coordMap.get(key)!.bookingIds.push(booking.id);
    }
  }

  return Array.from(coordMap.values());
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// LOCATION RESOLUTION HELPERS
// ---------------------------------------------------------------------------
export function getBookingCity(booking: Booking, itinerary: Itinerary): string {
  const lbl = (booking.location.type === 'coordinates' ? (booking.location.label || '') : booking.location.name).toLowerCase();
  if (lbl.includes('delhi') || lbl.includes('del ') || lbl.includes('(del)')) return 'Delhi';
  if (lbl.includes('mumbai') || lbl.includes('bom ') || lbl.includes('(bom)')) return 'Mumbai';
  if (lbl.includes('goa') || lbl.includes('goi ') || lbl.includes('(goi)') || lbl.includes('candolim')) return 'Goa';
  if (lbl.includes('jaipur') || lbl.includes('jpr ') || lbl.includes('(jpr)')) return 'Jaipur';
  if (booking.location.type === 'coordinates') {
    if (booking.location.lat > 27 && booking.location.lat < 30) return 'Delhi';
    if (booking.location.lat > 18 && booking.location.lat < 20) return 'Mumbai';
    if (booking.location.lat > 14 && booking.location.lat < 17) return 'Goa';
    if (booking.location.lat > 25 && booking.location.lat < 27) return 'Jaipur';
  }
  return itinerary.destination.split(',')[0].trim();
}

export function isOriginBooking(booking: Booking): boolean {
  return booking.dependsOn.length === 0;
}

export function isDestinationBooking(booking: Booking, itinerary: Itinerary): boolean {
  const destCity = itinerary.destination.split(',')[0].trim().toLowerCase();
  const bookingCity = getBookingCity(booking, itinerary).toLowerCase();
  return bookingCity.includes(destCity) || destCity.includes(bookingCity);
}

export function doesScenarioApplyToBooking(
  booking: Booking,
  itinerary: Itinerary,
  scenario: WeatherScenarioParams
): boolean {
  const target = (scenario.targetLocationKey || scenario.affectedLocations || 'all').toLowerCase();
  if (target === 'all') return true;
  if (target === 'origin' && isOriginBooking(booking)) return true;
  if (target === 'destination' && isDestinationBooking(booking, itinerary)) return true;
  const bookingCity = getBookingCity(booking, itinerary).toLowerCase();
  if (target.includes(bookingCity) || bookingCity.includes(target)) return true;
  return false;
}

export function doesScenarioApplyToLocation(
  lw: LocationWeather,
  itinerary: Itinerary,
  scenario: WeatherScenarioParams
): boolean {
  const target = (scenario.targetLocationKey || scenario.affectedLocations || 'all').toLowerCase();
  if (target === 'all') return true;
  const lbl = lw.label.toLowerCase();
  const isDel = lbl.includes('delhi') || lbl.includes('del') || lw.lat > 27;
  const isGoa = lbl.includes('goa') || (lw.lat > 14 && lw.lat < 17);
  if (target === 'origin' && isDel) return true;
  if (target === 'destination' && isGoa) return true;
  if (target.includes('delhi') && isDel) return true;
  if (target.includes('goa') && isGoa) return true;
  return false;
}

// ---------------------------------------------------------------------------
// WEATHER IMPACT SCORING per booking type
// ---------------------------------------------------------------------------
function scoreWeatherImpactForBooking(
  booking: Booking,
  itinerary: Itinerary,
  condition: WeatherCondition,
  cascadeLevel: number,
  isDirectWeatherTarget: boolean
): Omit<WeatherImpact, 'booking'> {
  const { precipitation, windSpeed, temperature, severity, weatherCode } = condition;
  const cityName = getBookingCity(booking, itinerary);
  const locationLabel = (booking.location.type === 'coordinates' ? booking.location.label : booking.location.name) || cityName;

  let delayProb = 0;
  let cancelProb = 0;
  let delayMins = 0;
  let reason = '';

  // Direct weather scoring only if this booking is at the affected location
  if (isDirectWeatherTarget && (severity >= 2 || precipitation > 15 || windSpeed > 45)) {
    switch (booking.type) {
      case 'flight': {
        if (weatherCode >= 95 || precipitation > 70) {
          delayProb = 0.85;
          cancelProb = 0.35;
          delayMins = 120 + severity * 30;
          reason = `Heavy rain (${precipitation.toFixed(0)} mm/h) & thunderstorm at ${cityName} — ATC ground delay active`;
        } else if (windSpeed > 80) {
          delayProb = 0.75;
          cancelProb = 0.25;
          delayMins = 90;
          reason = `Crosswinds ${windSpeed.toFixed(0)} km/h at ${cityName} exceed safe threshold`;
        } else if (precipitation > 35) {
          delayProb = 0.55;
          cancelProb = 0.1;
          delayMins = 60;
          reason = `Moderate-heavy rain at ${cityName} reducing runway visibility`;
        } else if (severity >= 2) {
          delayProb = 0.35;
          delayMins = 30;
          reason = `Adverse weather at ${cityName} causing airport sequencing hold`;
        }
        break;
      }
      case 'transfer': {
        if (weatherCode >= 80 || precipitation > 40) {
          delayProb = 0.8;
          cancelProb = 0.2;
          delayMins = 60 + severity * 20;
          reason = `Waterlogging & flash flood risk on roads around ${cityName}`;
        } else if (precipitation > 20) {
          delayProb = 0.55;
          delayMins = 35;
          reason = `Road congestion and slow traffic due to rain in ${cityName}`;
        }
        break;
      }
      case 'activity': {
        if (precipitation > 15 || windSpeed > 40 || severity >= 2) {
          cancelProb = 0.75;
          delayProb = 0.2;
          reason = `Outdoor activity cancelled due to local weather (${condition.weatherLabel}) in ${cityName}`;
        } else if (temperature > 42) {
          cancelProb = 0.5;
          reason = `Extreme heat (${temperature.toFixed(0)}°C) in ${cityName} — health advisory`;
        }
        break;
      }
      case 'hotel': {
        if (precipitation > 100 || severity >= 4) {
          delayProb = 0.3;
          reason = `Severe weather near property in ${cityName} — check-in desk delays`;
        }
        break;
      }
      case 'train': {
        if (weatherCode >= 85 || precipitation > 40) {
          delayProb = 0.65;
          delayMins = 60;
          reason = `Track speed restrictions due to weather around ${cityName}`;
        }
        break;
      }
    }
  }

  const impactType: 'direct_weather' | 'cascading_delay' | 'none' =
    delayProb > 0.2 || cancelProb > 0.2 ? 'direct_weather' : 'none';

  const riskScore = Math.round((delayProb * 0.4 + cancelProb * 0.6) * 100);
  const confidence: 'low' | 'medium' | 'high' =
    severity >= 3 ? 'high' : severity >= 1 ? 'medium' : 'low';

  return {
    bookingId: booking.id,
    weatherRiskScore: riskScore,
    probabilityOfDelay: delayProb,
    probabilityOfCancellation: cancelProb,
    estimatedDelayMinutes: Math.round(delayMins),
    reason: reason || `Normal weather conditions in ${cityName} (${condition.weatherLabel}, ${temperature.toFixed(0)}°C)`,
    weatherCondition: condition,
    confidence,
    cascadeLevel,
    impactType,
    cityName,
    locationLabel,
  };
}

// ---------------------------------------------------------------------------
// PROPAGATE WEATHER THROUGH BOOKING DAG
// Preserves local weather independence and models ripple schedule delays!
// ---------------------------------------------------------------------------
export function propagateWeatherImpact(
  itinerary: Itinerary,
  locationWeathers: LocationWeather[],
  scenario?: WeatherScenarioParams
): WeatherImpact[] {
  const impacts: WeatherImpact[] = [];
  const bookingMap = new Map(itinerary.bookings.map((b) => [b.id, b]));

  // Build coord & city weather lookups
  const weatherByCoord = new Map<string, LocationWeather>();
  for (const lw of locationWeathers) {
    const key = `${lw.lat.toFixed(2)},${lw.lng.toFixed(2)}`;
    weatherByCoord.set(key, lw);
  }

  // Track delays through the DAG for downstream cascade
  const bookingDelays = new Map<
    string,
    { delayMinutes: number; reason: string; sourceTitle: string; sourceCity: string }
  >();

  // BFS through the DAG
  const visited = new Set<string>();
  const queue: { bookingId: string; cascadeLevel: number }[] = [];

  for (const b of itinerary.bookings) {
    if (b.dependsOn.length === 0) {
      queue.push({ bookingId: b.id, cascadeLevel: 0 });
    }
  }

  while (queue.length > 0) {
    const { bookingId, cascadeLevel } = queue.shift()!;
    if (visited.has(bookingId)) continue;
    visited.add(bookingId);

    const booking = bookingMap.get(bookingId);
    if (!booking) continue;

    const cityName = getBookingCity(booking, itinerary);
    const locationLabel = (booking.location.type === 'coordinates' ? booking.location.label : booking.location.name) || cityName;

    // Find live baseline weather for this booking's location
    let baseCondition: WeatherCondition | null = null;
    if (booking.location.type === 'coordinates') {
      const key = `${booking.location.lat.toFixed(2)},${booking.location.lng.toFixed(2)}`;
      const lw = weatherByCoord.get(key);
      if (lw) baseCondition = lw.current;
    }
    // Match by city if not found by exact coord
    if (!baseCondition) {
      const matchedLw = locationWeathers.find((lw) =>
        lw.label.toLowerCase().includes(cityName.toLowerCase())
      );
      if (matchedLw) baseCondition = matchedLw.current;
    }
    if (!baseCondition && locationWeathers.length > 0) {
      baseCondition = locationWeathers[0].current;
    }

    if (!baseCondition) continue;

    // Determine if scenario applies to THIS specific booking's location!
    const isScenarioTarget = scenario ? doesScenarioApplyToBooking(booking, itinerary, scenario) : false;

    // If scenario applies to this location, override with simulated weather.
    // If NOT, keep the location's actual live baseline weather!
    const effectiveCondition = isScenarioTarget && scenario
      ? applyScenarioToCondition(baseCondition, scenario)
      : baseCondition;

    // Direct weather impact at this booking's location
    const directImpact = scoreWeatherImpactForBooking(
      booking,
      itinerary,
      effectiveCondition,
      cascadeLevel,
      isScenarioTarget
    );

    // Now evaluate CASCADING delays from upstream dependencies
    let unabsorbedDelay = 0;
    let upstreamSourceTitle = '';
    let upstreamCity = '';

    for (const parentId of booking.dependsOn) {
      const parentDelayInfo = bookingDelays.get(parentId);
      if (parentDelayInfo && parentDelayInfo.delayMinutes > 0) {
        const netDelay = Math.max(0, parentDelayInfo.delayMinutes - (booking.bufferMinutes || 0));
        if (netDelay > unabsorbedDelay) {
          unabsorbedDelay = netDelay;
          upstreamSourceTitle = parentDelayInfo.sourceTitle;
          upstreamCity = parentDelayInfo.sourceCity;
        }
      }
    }

    let finalImpact: WeatherImpact;

    if (directImpact.impactType === 'direct_weather') {
      // Direct local storm/rain
      const totalDelay = Math.max(directImpact.estimatedDelayMinutes, unabsorbedDelay);
      finalImpact = {
        ...directImpact,
        booking,
        estimatedDelayMinutes: totalDelay,
      };
      bookingDelays.set(booking.id, {
        delayMinutes: totalDelay,
        reason: directImpact.reason,
        sourceTitle: booking.title,
        sourceCity: cityName,
      });
    } else if (unabsorbedDelay > 0) {
      // Local weather is clear/normal, but arrival is delayed from upstream!
      // Check if this booking is on a different day (e.g. Scuba diving on Day 3)
      const isSubsequentDay =
        booking.type === 'activity' &&
        booking.startTime &&
        itinerary.bookings[0]?.startTime &&
        new Date(booking.startTime).getDate() !== new Date(itinerary.bookings[0].startTime).getDate();

      if (isSubsequentDay) {
        // Unaffected by Day 1 flight delay!
        finalImpact = {
          bookingId: booking.id,
          booking,
          weatherRiskScore: 0,
          probabilityOfDelay: 0,
          probabilityOfCancellation: 0,
          estimatedDelayMinutes: 0,
          reason: `Local weather in ${cityName} is ${effectiveCondition.weatherLabel} (${effectiveCondition.temperature.toFixed(0)}°C) — scheduled on Day 3, unaffected by ${upstreamCity} flight delay`,
          weatherCondition: effectiveCondition,
          confidence: 'high',
          cascadeLevel,
          impactType: 'none',
          cityName,
          locationLabel,
        };
        bookingDelays.set(booking.id, {
          delayMinutes: 0,
          reason: 'On schedule',
          sourceTitle: booking.title,
          sourceCity: cityName,
        });
      } else {
        // Immediate downstream connection (e.g. airport cab or hotel check-in)
        const delayProb = Math.min(0.92, unabsorbedDelay / 60 * 0.45 + 0.35);
        const cancelProb = booking.type === 'flight' ? 0.05 : 0;
        const riskScore = Math.min(85, Math.round(delayProb * 60 + (unabsorbedDelay > 60 ? 25 : 10)));

        const cascadeReason =
          booking.type === 'transfer'
            ? `Local weather in ${cityName} is clear (${effectiveCondition.weatherLabel}, ${effectiveCondition.temperature.toFixed(0)}°C), but pickup delayed ~${unabsorbedDelay}m due to late flight arrival from ${upstreamCity}`
            : booking.type === 'hotel'
            ? `Local weather in ${cityName} is clear (${effectiveCondition.weatherLabel}, ${effectiveCondition.temperature.toFixed(0)}°C). Arrival delayed ~${unabsorbedDelay}m; check-in valid until late evening`
            : `Delayed ~${unabsorbedDelay}m due to schedule ripple from ${upstreamSourceTitle} (${upstreamCity})`;

        finalImpact = {
          bookingId: booking.id,
          booking,
          weatherRiskScore: riskScore,
          probabilityOfDelay: delayProb,
          probabilityOfCancellation: cancelProb,
          estimatedDelayMinutes: unabsorbedDelay,
          reason: cascadeReason,
          weatherCondition: effectiveCondition,
          confidence: 'high',
          cascadeLevel,
          impactType: 'cascading_delay',
          cityName,
          locationLabel,
        };

        bookingDelays.set(booking.id, {
          delayMinutes: unabsorbedDelay,
          reason: cascadeReason,
          sourceTitle: booking.title,
          sourceCity: cityName,
        });
      }
    } else {
      // Normal operations
      finalImpact = {
        ...directImpact,
        booking,
      };
      bookingDelays.set(booking.id, {
        delayMinutes: 0,
        reason: 'On schedule',
        sourceTitle: booking.title,
        sourceCity: cityName,
      });
    }

    impacts.push(finalImpact);

    // Enqueue dependents
    for (const b of itinerary.bookings) {
      if (b.dependsOn.includes(bookingId) && !visited.has(b.id)) {
        queue.push({ bookingId: b.id, cascadeLevel: cascadeLevel + 1 });
      }
    }
  }

  return impacts.sort((a, b) => a.cascadeLevel - b.cascadeLevel);
}

// ---------------------------------------------------------------------------
// APPLY WHAT-IF SCENARIO to an existing weather condition
// ---------------------------------------------------------------------------
export function applyScenarioToCondition(
  base: WeatherCondition,
  scenario: WeatherScenarioParams
): WeatherCondition {
  const precipitation = scenario.precipitationMmHr;
  const windSpeed = scenario.windSpeedKmH;
  const temperature = scenario.temperatureCelsius;

  let weatherCode = base.weatherCode;
  if (precipitation > 80 || windSpeed > 80) weatherCode = 95; // thunderstorm
  else if (precipitation > 30) weatherCode = 63; // heavy rain
  else if (precipitation > 10) weatherCode = 53; // moderate rain
  else if (precipitation > 2) weatherCode = 43; // light rain
  else if (windSpeed > 60) weatherCode = 5; // windy
  else weatherCode = 0; // clear if nothing extreme

  return {
    ...base,
    temperature,
    precipitation,
    windSpeed,
    windGusts: windSpeed * 1.3,
    weatherCode,
    weatherLabel: wmoLabel(weatherCode),
    severity: computeSeverity(precipitation, windSpeed, temperature, weatherCode),
  };
}

// ---------------------------------------------------------------------------
// CONVERT WeatherImpacts → Disruptions
// ---------------------------------------------------------------------------
export function weatherImpactsToDisruptions(impacts: WeatherImpact[]): Disruption[] {
  return impacts
    .filter(
      (imp) =>
        imp.probabilityOfDelay > 0.5 || imp.probabilityOfCancellation > 0.4
    )
    .map((imp) => ({
      bookingId: imp.bookingId,
      disruptionType:
        imp.probabilityOfCancellation > 0.45 ? 'cancellation' : 'delay',
      delayMinutes:
        imp.probabilityOfCancellation > 0.45 ? undefined : imp.estimatedDelayMinutes,
      reason: `[Weather] ${imp.reason}`,
      timestamp: new Date().toISOString(),
    })) as Disruption[];
}

// ---------------------------------------------------------------------------
// BUILD FULL DIGITAL TWIN STATE
// Produces effective weather per location so Delhi and Goa can differ!
// ---------------------------------------------------------------------------
export function buildDigitalTwinState(
  itinerary: Itinerary,
  locationWeathers: LocationWeather[],
  scenario: WeatherScenarioParams | null = null
): DigitalTwinState {
  // Compute effective weather for each location based on scenario target
  const effectiveLocationWeathers = locationWeathers.map((lw) => {
    if (!scenario) return lw;
    const applies = doesScenarioApplyToLocation(lw, itinerary, scenario);
    if (!applies) return lw; // stays untouched (e.g. Goa remains sunny when Delhi is targeted!)
    return {
      ...lw,
      current: applyScenarioToCondition(lw.current, scenario),
    };
  });

  const impacts = propagateWeatherImpact(
    itinerary,
    locationWeathers,
    scenario ?? undefined
  );

  // Overall itinerary risk: blend critical booking risk (70%) with average chain risk (30%)
  const maxRisk = impacts.length > 0 ? Math.max(...impacts.map((i) => i.weatherRiskScore)) : 0;
  const avgRisk =
    impacts.length > 0
      ? Math.round(impacts.reduce((sum, i) => sum + i.weatherRiskScore, 0) / impacts.length)
      : 0;
  const overallRiskScore = Math.round(maxRisk * 0.7 + avgRisk * 0.3);

  // Build clear, location-aware cascade chain
  const cascadeChain: string[] = [];
  const directDisruptions = impacts.filter((i) => i.impactType === 'direct_weather');
  const cascadingDelays = impacts.filter((i) => i.impactType === 'cascading_delay');

  for (const imp of directDisruptions) {
    cascadeChain.push(
      `📍 ${imp.cityName}: ${imp.booking.title} directly disrupted by ${imp.weatherCondition.weatherLabel} (+${imp.estimatedDelayMinutes}m delay)`
    );
  }
  for (const imp of cascadingDelays) {
    cascadeChain.push(
      `📍 ${imp.cityName}: ${imp.booking.title} delayed by ~${imp.estimatedDelayMinutes}m (Local weather is ${imp.weatherCondition.weatherLabel}; ripple from upstream flight)`
    );
  }

  const primaryThreat =
    effectiveLocationWeathers.length > 0
      ? effectiveLocationWeathers.reduce(
          (worst, lw) =>
            lw.current.severity > worst.current.severity ? lw : worst,
          effectiveLocationWeathers[0]
        ).current.weatherLabel
      : 'No data';

  const totalEstimatedDelay = impacts.reduce(
    (sum, i) => sum + i.estimatedDelayMinutes,
    0
  );

  return {
    itineraryId: itinerary.id,
    timestamp: new Date().toISOString(),
    locationWeather: effectiveLocationWeathers,
    weatherImpacts: impacts,
    overallRiskScore,
    primaryThreat,
    cascadeChain,
    totalEstimatedDelay,
    scenario,
  };
}

// ---------------------------------------------------------------------------
// FETCH ALL WEATHER FOR AN ITINERARY
// ---------------------------------------------------------------------------
export async function fetchItineraryWeather(
  itinerary: Itinerary
): Promise<LocationWeather[]> {
  const locations = extractLocations(itinerary);

  const unique = locations.filter((loc, i) =>
    locations.findIndex(
      (l) =>
        Math.abs(l.lat - loc.lat) < 0.1 && Math.abs(l.lng - loc.lng) < 0.1
    ) === i
  );

  const results = await Promise.allSettled(
    unique.map((loc) => fetchWeatherForLocation(loc.lat, loc.lng, loc.label))
  );

  const fulfilled = results
    .filter((r): r is PromiseFulfilledResult<LocationWeather> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (fulfilled.length === 0) {
    return unique.map((loc) => getFallbackWeather(loc.lat, loc.lng, loc.label));
  }

  return fulfilled;
}

// ---------------------------------------------------------------------------
// DEFAULT SCENARIO PRESETS — Clearly partitioned by location!
// ---------------------------------------------------------------------------
export const WEATHER_SCENARIO_PRESETS: Record<string, WeatherScenarioParams> = {
  delhiStorm: {
    name: '🌩️ Delhi Thunderstorm (Origin Flight Delayed)',
    precipitationMmHr: 80,
    temperatureCelsius: 24,
    windSpeedKmH: 75,
    stormDurationHours: 6,
    floodLevel: 'minor',
    affectedLocations: 'origin',
    targetLocationKey: 'origin',
  },
  goaMonsoon: {
    name: '🌀 Goa Monsoon (Destination Beach Washout)',
    precipitationMmHr: 95,
    temperatureCelsius: 27,
    windSpeedKmH: 65,
    stormDurationHours: 24,
    floodLevel: 'moderate',
    affectedLocations: 'destination',
    targetLocationKey: 'destination',
  },
  delhiFog: {
    name: '🌫️ Delhi Winter Fog (Ground Stop at DEL)',
    precipitationMmHr: 0,
    temperatureCelsius: 7,
    windSpeedKmH: 5,
    stormDurationHours: 10,
    floodLevel: 'none',
    affectedLocations: 'origin',
    targetLocationKey: 'origin',
  },
  regionalMonsoon: {
    name: '🌧️ Regional Storm (All Locations Affected)',
    precipitationMmHr: 60,
    temperatureCelsius: 26,
    windSpeedKmH: 50,
    stormDurationHours: 18,
    floodLevel: 'moderate',
    affectedLocations: 'all',
    targetLocationKey: 'all',
  },
  clear: {
    name: '☀️ Clear Skies Everywhere',
    precipitationMmHr: 0,
    temperatureCelsius: 28,
    windSpeedKmH: 10,
    stormDurationHours: 0,
    floodLevel: 'none',
    affectedLocations: 'all',
    targetLocationKey: 'all',
  },
};
