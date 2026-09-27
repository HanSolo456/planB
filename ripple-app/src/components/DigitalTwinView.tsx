import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SEED_ITINERARIES } from '../lib/seedData';
import MobileBottomNav, { type MobileTabKey } from './MobileBottomNav';
import {
  Cloud,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  Activity,
  Waves,
  MessageSquare,
  ArrowUpRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Zap,
  ThumbsDown,
  ThumbsUp,
  MessageCircle,
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  X,
  Play,
  RotateCcw,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  CloudRain,
  Map as MapIcon,
  Sun,
  CloudLightning,
  CloudFog,
  Snowflake,
  Eye,
  Compass,
  SlidersHorizontal,
} from 'lucide-react';
import { useAppState } from '../App';
import {
  fetchItineraryWeather,
  buildDigitalTwinState,
  getFallbackWeather,
  extractLocations,
  WEATHER_SCENARIO_PRESETS,
  type WeatherScenarioParams,
  type DigitalTwinState,
  type LocationWeather,
  type WeatherImpact,
  type WeatherCondition,
} from '../lib/weatherEngine';
import {
  fetchSocialSignals,
  getInitialSocialFeed,
  formatRelativeTime,
  type SocialSignalFeed,
  type SocialSignal,
} from '../lib/socialSignalEngine';
import WeatherMapOverlay from './WeatherMapOverlay';
import type { Disruption } from '../lib/types';

// ---------------------------------------------------------------------------
// HELPERS — using the app's existing CSS variable color palette
// ---------------------------------------------------------------------------
function riskColor(score: number): string {
  if (score >= 70) return 'var(--color-disrupted)';
  if (score >= 40) return 'var(--color-at-risk)';
  if (score >= 20) return '#E5A93C';
  return 'var(--color-recovered)';
}

function riskBg(score: number): string {
  if (score >= 70) return 'var(--color-disrupted-bg)';
  if (score >= 40) return 'var(--color-at-risk-bg)';
  if (score >= 20) return '#FBF0E4';
  return 'var(--color-recovered-bg)';
}

function riskBorder(score: number): string {
  if (score >= 70) return 'var(--color-disrupted-border)';
  if (score >= 40) return 'var(--color-at-risk-border)';
  if (score >= 20) return '#F0C896';
  return 'var(--color-recovered-border)';
}

function riskLabel(score: number): string {
  if (score >= 70) return 'SEVERE';
  if (score >= 40) return 'HIGH';
  if (score >= 20) return 'MODERATE';
  return 'LOW';
}

function sentimentIcon(s: SocialSignal['sentiment']) {
  if (s === 'urgent') return <AlertCircle size={14} className="text-red-500 flex-shrink-0" />;
  if (s === 'negative') return <ThumbsDown size={14} className="flex-shrink-0" style={{ color: 'var(--color-at-risk)' }} />;
  if (s === 'positive') return <ThumbsUp size={14} className="flex-shrink-0" style={{ color: 'var(--color-recovered)' }} />;
  return <Minus size={14} className="text-gray-400 flex-shrink-0" />;
}

// ---------------------------------------------------------------------------
// WEATHER BACKDROP THEMES (Wikipedia / Public Domain Photography)
// Vivid photography with directional light gradient for crisp readability
// ---------------------------------------------------------------------------
export interface WeatherBackdropTheme {
  type: 'sunny' | 'rain' | 'thunderstorm' | 'cloudy' | 'fog' | 'snow';
  name: string;
  sourceTitle: string;
  sourceUrl: string;
  imageUrl: string;
  lightGradient: string;
  accentColor: string;
}

const WEATHER_BACKDROPS: Record<string, WeatherBackdropTheme> = {
  sunny: {
    type: 'sunny',
    name: 'Clear & Sunny',
    sourceTitle: 'Wikipedia / Public Domain: Sunny Sky',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sky_Clouds_Sea.jpg',
    imageUrl: '/weather/sunny.jpg',
    lightGradient: 'linear-gradient(to right, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.60) 45%, rgba(255, 255, 255, 0.15) 80%, transparent 100%)',
    accentColor: '#D97706',
  },
  rain: {
    type: 'rain',
    name: 'Rain & Wet Conditions',
    sourceTitle: 'Wikipedia / Public Domain: Rain over Holma marina',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rain_over_Holma_marina.jpg',
    imageUrl: '/weather/rain.jpg',
    lightGradient: 'linear-gradient(to right, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.60) 45%, rgba(255, 255, 255, 0.15) 80%, transparent 100%)',
    accentColor: '#0284C7',
  },
  thunderstorm: {
    type: 'thunderstorm',
    name: 'Thunderstorm & Convective Storm',
    sourceTitle: 'Wikipedia / Public Domain: Lightning Pritzerbe Storm',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lightning_Pritzerbe_01_(MK).jpg',
    imageUrl: '/weather/thunderstorm.jpg',
    lightGradient: 'linear-gradient(to right, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.60) 45%, rgba(255, 255, 255, 0.15) 80%, transparent 100%)',
    accentColor: '#7C3AED',
  },
  cloudy: {
    type: 'cloudy',
    name: 'Overcast & Low Ceiling',
    sourceTitle: 'Wikipedia / Public Domain: Cumulus clouds',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cumulus_clouds_in_fair_weather.jpeg',
    imageUrl: '/weather/cloudy.jpg',
    lightGradient: 'linear-gradient(to right, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.60) 45%, rgba(255, 255, 255, 0.15) 80%, transparent 100%)',
    accentColor: '#475569',
  },
  fog: {
    type: 'fog',
    name: 'Fog & Mist Obstruction',
    sourceTitle: 'Wikipedia / Public Domain: Trees in fog on Loch Tay',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Trees_in_fog_on_the_northern_side_of_Loch_Tay,_Scottish_Highlands,_Scotland.jpg',
    imageUrl: '/weather/fog.jpg',
    lightGradient: 'linear-gradient(to right, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.60) 45%, rgba(255, 255, 255, 0.15) 80%, transparent 100%)',
    accentColor: '#475569',
  },
  snow: {
    type: 'snow',
    name: 'Snow & Freezing Conditions',
    sourceTitle: 'Wikimedia Commons / Public Domain: Winter Snow',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Snow_on_trees.jpg',
    imageUrl: '/weather/snow.jpg',
    lightGradient: 'linear-gradient(to right, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.60) 45%, rgba(255, 255, 255, 0.15) 80%, transparent 100%)',
    accentColor: '#0D9488',
  },
};

function getWeatherTheme(c: WeatherCondition | undefined): WeatherBackdropTheme {
  if (!c) return WEATHER_BACKDROPS.sunny;
  const code = c.weatherCode;
  const lbl = (c.weatherLabel || '').toLowerCase();
  const precip = c.precipitation || 0;
  const wind = c.windSpeed || 0;

  if (
    code === 95 || code === 96 || code === 99 ||
    lbl.includes('thunder') ||
    lbl.includes('storm') ||
    lbl.includes('lightning') ||
    (precip >= 35 && wind >= 40)
  ) {
    return WEATHER_BACKDROPS.thunderstorm;
  }

  if (
    precip > 1.5 ||
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    lbl.includes('rain') ||
    lbl.includes('shower') ||
    lbl.includes('drizzle') ||
    lbl.includes('monsoon') ||
    lbl.includes('squall')
  ) {
    return WEATHER_BACKDROPS.rain;
  }

  if (
    (code >= 71 && code <= 77) ||
    (code >= 85 && code <= 86) ||
    lbl.includes('snow') ||
    lbl.includes('blizzard') ||
    lbl.includes('freez')
  ) {
    return WEATHER_BACKDROPS.snow;
  }

  if (
    code === 45 || code === 48 ||
    c.visibility < 2 ||
    lbl.includes('fog') ||
    lbl.includes('mist') ||
    lbl.includes('haze') ||
    lbl.includes('smog')
  ) {
    return WEATHER_BACKDROPS.fog;
  }

  if (
    c.cloudCover > 55 ||
    code === 2 || code === 3 ||
    lbl.includes('cloud') ||
    lbl.includes('overcast')
  ) {
    return WEATHER_BACKDROPS.cloudy;
  }

  return WEATHER_BACKDROPS.sunny;
}

function getPlaceShortName(label: string, index: number, total: number): { city: string; role: string } {
  const l = (label || '').toLowerCase();
  let city = label || 'Destination';
  if (l.includes('delhi')) city = 'Delhi';
  else if (l.includes('goa')) city = 'Goa';
  else if (l.includes('mumbai')) city = 'Mumbai';
  else if (l.includes('jaipur')) city = 'Jaipur';
  else if (l.includes('bangalore') || l.includes('bengaluru')) city = 'Bengaluru';
  else if (label.includes(',')) city = label.split(',')[0].trim();
  else if (label.length > 20) city = label.slice(0, 18) + '…';

  const role = index === 0 ? 'Origin' : index === total - 1 ? 'Destination' : 'Stopover';
  return { city, role };
}

function getCompassHeading(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
  return directions[index];
}

function getOperationalWeatherSummary(c: WeatherCondition, city: string, role: string): string {
  const lbl = (c.weatherLabel || '').toLowerCase();
  if (c.weatherCode === 95 || c.weatherCode === 96 || c.weatherCode === 99 || lbl.includes('thunder') || lbl.includes('lightning')) {
    return `Severe convective thunderstorm activity over ${city}. Airport ground hold procedures and lightning safety alerts active. Expect 60–120m runway holding patterns.`;
  }
  if (c.precipitation >= 20 || lbl.includes('monsoon') || lbl.includes('heavy rain')) {
    return `Intense rainfall (${c.precipitation.toFixed(0)} mm/h) causing standing water and restricted taxiway speeds at ${city}. Ground transfers experiencing traffic delays.`;
  }
  if (c.precipitation > 2 || lbl.includes('rain') || lbl.includes('shower')) {
    return `Passing rain showers and wet tarmac at ${city}. Visual approach maintained; minor turnaround delays possible for baggage handling and boarding.`;
  }
  if (c.visibility < 2 || lbl.includes('fog') || lbl.includes('mist')) {
    return `Dense mist and low visibility (${c.visibility.toFixed(1)} km) requiring low-visibility instrument procedures (CAT II/III ILS) at ${city}.`;
  }
  if (c.windSpeed >= 45) {
    return `Strong atmospheric crosswinds (${c.windSpeed.toFixed(0)} km/h) with turbulence on descent corridor into ${city}.`;
  }
  if (c.cloudCover > 60) {
    return `Overcast cloud ceiling at ${city}. Stable flight corridors and normal transit operations across ${role.toLowerCase()} transit links.`;
  }
  return `Clear, sunny skies and calm atmospheric conditions across ${city}. Smooth flight operations and optimal outdoor travel conditions.`;
}

// ---------------------------------------------------------------------------
// WEATHER BACKDROP IMAGE COMPONENT (LIGHT MODE)
// ---------------------------------------------------------------------------
function WeatherBackdropImage({
  theme,
  alt,
}: {
  theme: WeatherBackdropTheme;
  alt: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Crisp weather photo with high visibility */}
      <img
        src={theme.imageUrl}
        alt={alt}
        className="w-full h-full object-cover object-center transition-all duration-700 ease-out opacity-90"
        loading="eager"
      />
      {/* Directional light scrim: frosted white on left for crisp dark text, transparent on right for full photo visibility */}
      <div
        className="absolute inset-0 transition-all duration-700 pointer-events-none"
        style={{ background: theme.lightGradient }}
      />
    </div>
  );
}

function WeatherIconDisplay({ type }: { type: WeatherBackdropTheme['type'] }) {
  switch (type) {
    case 'sunny':
      return <Sun className="w-12 h-12 text-amber-500 animate-[spin_24s_linear_infinite] flex-shrink-0" />;
    case 'thunderstorm':
      return <CloudLightning className="w-12 h-12 text-purple-600 animate-pulse flex-shrink-0" />;
    case 'rain':
      return <CloudRain className="w-12 h-12 text-sky-600 flex-shrink-0" />;
    case 'cloudy':
      return <Cloud className="w-12 h-12 text-slate-500 flex-shrink-0" />;
    case 'fog':
      return <CloudFog className="w-12 h-12 text-slate-500 flex-shrink-0" />;
    case 'snow':
      return <Snowflake className="w-12 h-12 text-teal-600 animate-pulse flex-shrink-0" />;
    default:
      return <Sun className="w-12 h-12 text-amber-500 flex-shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// SLIDER COMPONENT — styled to match app inputs
// ---------------------------------------------------------------------------
function WeatherSlider({
  label,
  icon,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const clr = riskColor(pct);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color: 'var(--color-text-main)' }}>
          {value}
          <span className="text-xs font-normal ml-0.5" style={{ color: 'var(--color-text-subtle)' }}>{unit}</span>
        </span>
      </div>
      <div className="relative h-2">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: clr }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 h-full"
          style={{ cursor: 'pointer' }}
          aria-label={label}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IMPACT ROW — matches ItineraryCard style
// ---------------------------------------------------------------------------
function ImpactRow({
  impact,
  onResolve,
}: {
  impact: WeatherImpact;
  onResolve?: (impact: WeatherImpact) => void;
}) {
  const delayPct = Math.round(impact.probabilityOfDelay * 100);
  const cancelPct = Math.round(impact.probabilityOfCancellation * 100);
  const score = impact.weatherRiskScore;

  const typeEmoji: Record<string, string> = {
    flight: 'FL', transfer: 'TR', hotel: 'HT', activity: 'AC', train: 'RW', event: 'EV',
  };

  const isDisrupted = score >= 20 || delayPct >= 30 || cancelPct >= 20;

  return (
    <div
      className="rounded-xl border p-4 transition-colors"
      style={{
        backgroundColor: riskBg(score),
        borderColor: riskBorder(score),
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xs font-mono font-bold text-gray-400 mt-0.5 flex-shrink-0 w-6 text-center">{typeEmoji[impact.booking.type] ?? '--'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                {impact.booking.title}
              </p>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 font-mono"
                style={{
                  backgroundColor: 'var(--color-bg-surface-alt)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {impact.cityName}
              </span>
              {impact.impactType === 'direct_weather' && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 font-mono"
                  style={{
                    backgroundColor: 'var(--color-disrupted-bg)',
                    color: 'var(--color-disrupted)',
                    border: '1px solid var(--color-disrupted-border)',
                  }}
                >
                  Direct Weather Disruption
                </span>
              )}
              {impact.impactType === 'cascading_delay' && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 font-mono"
                  style={{
                    backgroundColor: 'var(--color-at-risk-bg)',
                    color: 'var(--color-at-risk)',
                    border: '1px solid var(--color-at-risk-border)',
                  }}
                >
                  Cascading Schedule Ripple
                </span>
              )}
            </div>
            <span
              className="text-xs font-black px-2 py-0.5 rounded-full flex-shrink-0 font-mono"
              style={{ backgroundColor: riskBg(score), color: riskColor(score), border: `1px solid ${riskBorder(score)}` }}
            >
              {score}%
            </span>
          </div>

          <p className="text-xs leading-relaxed mb-2.5 font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {impact.reason}
          </p>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1">
                <Clock size={12} style={{ color: 'var(--color-at-risk)' }} />
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
                  Delay: <span className="font-bold" style={{ color: 'var(--color-at-risk)' }}>{delayPct}%</span>
                  {impact.estimatedDelayMinutes > 0 && ` (+${impact.estimatedDelayMinutes}m)`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <X size={12} style={{ color: 'var(--color-disrupted)' }} />
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
                  Cancel: <span className="font-bold" style={{ color: 'var(--color-disrupted)' }}>{cancelPct}%</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Cloud size={12} style={{ color: 'var(--color-text-subtle)' }} />
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
                  Local: <span className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>{impact.weatherCondition.weatherLabel} ({impact.weatherCondition.temperature.toFixed(0)}°C)</span>
                </span>
              </div>
              {impact.cascadeLevel > 0 && (
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
                  ↺ ripple L{impact.cascadeLevel}
                </span>
              )}
            </div>

            {onResolve && isDisrupted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(impact);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-2xs transition-all ml-auto"
                title="Launch Plan B multi-agent recovery for this disruption"
              >
                <Zap size={11} className="text-amber-300" />
                <span>Solve in Plan B →</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SOCIAL SIGNAL CARD
// ---------------------------------------------------------------------------
function SignalCard({ signal }: { signal: SocialSignal }) {
  const bgMap: Record<SocialSignal['sentiment'], string> = {
    urgent: 'var(--color-disrupted-bg)',
    negative: 'var(--color-at-risk-bg)',
    positive: 'var(--color-recovered-bg)',
    neutral: 'var(--color-bg-surface)',
  };
  const borderMap: Record<SocialSignal['sentiment'], string> = {
    urgent: 'var(--color-disrupted-border)',
    negative: 'var(--color-at-risk-border)',
    positive: 'var(--color-recovered-border)',
    neutral: 'var(--color-border)',
  };

  return (
    <a
      href={signal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border p-3.5 transition-all hover:shadow-sm"
      style={{ backgroundColor: bgMap[signal.sentiment], borderColor: borderMap[signal.sentiment] }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        {sentimentIcon(signal.sentiment)}
        <p className="text-sm font-semibold leading-snug flex-1 line-clamp-2" style={{ color: 'var(--color-text-main)' }}>
          {signal.title}
        </p>
        <ExternalLink size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-subtle)' }} />
      </div>
      {signal.snippet && (
        <p className="text-xs leading-relaxed line-clamp-2 mb-2 ml-6" style={{ color: 'var(--color-text-muted)' }}>
          {signal.snippet}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 ml-6">
        <div className="flex items-center gap-2">
          {signal.subreddit && (
            <span className="text-xs font-mono" style={{ color: 'var(--color-confirmed)' }}>r/{signal.subreddit}</span>
          )}
          {signal.upvotes !== undefined && (
            <span className="text-xs font-mono flex items-center gap-0.5" style={{ color: 'var(--color-text-subtle)' }}>
              <ArrowUpRight size={11} />
              {signal.upvotes.toLocaleString()}
            </span>
          )}
          {signal.comments !== undefined && (
            <span className="text-xs font-mono flex items-center gap-0.5" style={{ color: 'var(--color-text-subtle)' }}>
              <MessageCircle size={11} />
              {signal.comments}
            </span>
          )}
        </div>
        <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
          {formatRelativeTime(signal.postedAt)}
        </span>
      </div>
      {signal.matchedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 ml-6">
          {signal.matchedKeywords.map((kw) => (
            <span
              key={kw}
              className="text-xs px-1.5 py-0.5 rounded-full font-mono"
              style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-subtle)' }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

// ---------------------------------------------------------------------------
// LOCATION WEATHER CARD (For Impact view)
// ---------------------------------------------------------------------------
function LocationWeatherCard({ lw }: { lw: LocationWeather }) {
  const c = lw.current;
  const score = c.severity * 25;

  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MapPin size={12} style={{ color: 'var(--color-confirmed)' }} />
            <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-main)' }}>{lw.label}</p>
          </div>
          <p className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
            {lw.lat.toFixed(2)}°N, {lw.lng.toFixed(2)}°E
          </p>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono flex-shrink-0"
          style={{ backgroundColor: riskBg(score), color: riskColor(score), border: `1px solid ${riskBorder(score)}` }}
        >
          {riskLabel(score)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        {[
          { Icon: Thermometer, value: `${c.temperature.toFixed(1)}°C`, label: 'Temp' },
          { Icon: Droplets, value: `${c.precipitation.toFixed(1)} mm/h`, label: 'Rain' },
          { Icon: Wind, value: `${c.windSpeed.toFixed(0)} km/h`, label: 'Wind' },
          { Icon: Cloud, value: `${c.cloudCover}%`, label: 'Cloud' },
        ].map(({ Icon, value, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon size={13} style={{ color: 'var(--color-text-subtle)' }} />
            <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-main)' }}>{value}</span>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg px-3 py-2 text-xs font-medium"
        style={{ backgroundColor: 'var(--color-bg-surface-alt)', color: 'var(--color-text-muted)' }}
      >
        {c.weatherLabel}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN DIGITAL TWIN VIEW
// ---------------------------------------------------------------------------
export default function DigitalTwinView() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const {
    selectedItinerary,
    importedItineraries,
    applyWeatherDisruptionToItinerary,
  } = useAppState();

  // Find itinerary — check selected, imported, and seed trips
  const itinerary =
    selectedItinerary?.id === tripId
      ? selectedItinerary
      : importedItineraries.find((it) => it.id === tripId)
      ?? SEED_ITINERARIES.find((it) => it.id === tripId)
      ?? selectedItinerary;

  // State
  const [twinState, setTwinState] = useState<DigitalTwinState | null>(null);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(0);

  const handleMobileNavSelect = useCallback((tab: MobileTabKey) => {
    if (!itinerary) return;
    if (tab === 'itinerary') {
      navigate(`/app/trip/${itinerary.id}?view=itinerary`);
    } else if (tab === 'timeline') {
      navigate(`/app/trip/${itinerary.id}?view=timeline`);
    } else if (tab === 'map') {
      navigate(`/app/trip/${itinerary.id}?view=map`);
    } else if (tab === 'twin') {
      // already on digital twin
    } else if (tab === 'profile') {
      navigate('/app/profile');
    }
  }, [itinerary, navigate]);

  const [socialFeed, setSocialFeed] = useState<SocialSignalFeed | null>(() =>
    itinerary ? getInitialSocialFeed(itinerary.destination) : null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [locationWeathers, setLocationWeathers] = useState<LocationWeather[]>([]);
  const [activeTab, setActiveTab] = useState<'weather' | 'impacts' | 'scenarios' | 'variables' | 'map' | 'social'>('weather');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [scenarioActive, setScenarioActive] = useState(false);

  // What-if scenario state — default to active simulation values
  const [scenario, setScenario] = useState<WeatherScenarioParams>({
    name: 'Delhi Thunderstorm',
    precipitationMmHr: 75,
    temperatureCelsius: 24,
    windSpeedKmH: 60,
    stormDurationHours: 6,
    floodLevel: 'minor',
    affectedLocations: 'origin',
    targetLocationKey: 'origin',
  });

  // FETCH LIVE WEATHER
  const loadWeather = useCallback(async () => {
    if (!itinerary) return;
    setIsLoading(true);
    try {
      let weathers = await fetchItineraryWeather(itinerary);
      if (!weathers || weathers.length === 0) {
        weathers = extractLocations(itinerary).map((l) => getFallbackWeather(l.lat, l.lng, l.label));
      }
      setLocationWeathers(weathers);
      const state = buildDigitalTwinState(itinerary, weathers, null);
      setTwinState(state);
    } catch (err) {
      console.error('[DigitalTwin] Weather fetch error:', err);
      const fallback = extractLocations(itinerary).map((l) => getFallbackWeather(l.lat, l.lng, l.label));
      setLocationWeathers(fallback);
      setTwinState(buildDigitalTwinState(itinerary, fallback, null));
    } finally {
      setIsLoading(false);
    }
  }, [itinerary]);

  // FETCH SOCIAL SIGNALS
  const loadSocialSignals = useCallback(async () => {
    if (!itinerary) return;
    setIsSocialLoading(true);
    try {
      const topWeather = locationWeathers[0]?.current?.weatherLabel ?? 'weather';
      const feed = await fetchSocialSignals(itinerary.destination, topWeather);
      setSocialFeed(feed);
    } catch (err) {
      console.error('[DigitalTwin] Social signals error:', err);
    } finally {
      setIsSocialLoading(false);
    }
  }, [itinerary, locationWeathers]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  useEffect(() => {
    if (!isLoading && locationWeathers.length > 0) {
      loadSocialSignals();
    }
  }, [isLoading, locationWeathers, loadSocialSignals]);

  // RUN SIMULATION
  const runSimulation = useCallback(() => {
    if (!itinerary) return;
    setIsSimulating(true);

    const baseWeathers =
      locationWeathers.length > 0
        ? locationWeathers
        : extractLocations(itinerary).map((l) => getFallbackWeather(l.lat, l.lng, l.label));

    // If user clicks Run Simulation with 0 rain and low wind, boost to 75mm so there is a visible storm impact
    const activeScenario =
      scenario.precipitationMmHr === 0 && scenario.windSpeedKmH <= 15
        ? {
            ...scenario,
            precipitationMmHr: 75,
            windSpeedKmH: 60,
            name: `${(scenario.targetLocationKey || scenario.affectedLocations) === 'origin' ? 'Delhi' : (scenario.targetLocationKey || scenario.affectedLocations) === 'destination' ? 'Goa' : 'Regional'} Storm`,
          }
        : scenario;

    if (activeScenario !== scenario) {
      setScenario(activeScenario);
    }

    setTimeout(() => {
      const state = buildDigitalTwinState(itinerary, baseWeathers, activeScenario);
      setTwinState(state);
      setScenarioActive(true);
      setIsSimulating(false);
    }, 400);
  }, [itinerary, locationWeathers, scenario]);

  const resetToLive = useCallback(() => {
    if (!itinerary) return;
    const baseWeathers =
      locationWeathers.length > 0
        ? locationWeathers
        : extractLocations(itinerary).map((l) => getFallbackWeather(l.lat, l.lng, l.label));
    const state = buildDigitalTwinState(itinerary, baseWeathers, null);
    setTwinState(state);
    setScenarioActive(false);
    setSelectedPreset(null);
    setScenario({
      name: 'Custom Scenario',
      precipitationMmHr: 0,
      temperatureCelsius: 28,
      windSpeedKmH: 10,
      stormDurationHours: 0,
      floodLevel: 'none',
      affectedLocations: 'origin',
      targetLocationKey: 'origin',
    });
  }, [itinerary, locationWeathers]);

  const applyPreset = useCallback((key: string) => {
    const preset = WEATHER_SCENARIO_PRESETS[key];
    if (!preset || !itinerary) return;
    setScenario(preset);
    setSelectedPreset(key);
    setIsSimulating(true);

    const baseWeathers =
      locationWeathers.length > 0
        ? locationWeathers
        : extractLocations(itinerary).map((l) => getFallbackWeather(l.lat, l.lng, l.label));

    setTimeout(() => {
      const state = buildDigitalTwinState(itinerary, baseWeathers, preset);
      setTwinState(state);
      setScenarioActive(true);
      setIsSimulating(false);
    }, 400);
  }, [itinerary, locationWeathers]);

  // Launch Plan B Recovery from predicted weather impacts
  const handleTransferToPlanB = useCallback(
    (specificImpact?: WeatherImpact) => {
      if (!itinerary) return;

      if (specificImpact) {
        const isCancel = specificImpact.probabilityOfCancellation > 0.4;
        const disruption: Disruption = {
          bookingId: specificImpact.bookingId,
          disruptionType: isCancel ? 'cancellation' : 'delay',
          delayMinutes: isCancel ? undefined : (specificImpact.estimatedDelayMinutes || 90),
          reason: `[Weather Disruption] ${specificImpact.reason}`,
          timestamp: new Date().toISOString(),
        };
        applyWeatherDisruptionToItinerary(itinerary, disruption, true);
        return;
      }

      // Collect candidate disrupted bookings from simulation or live telemetry
      const candidates = (twinState?.weatherImpacts ?? []).filter(
        (imp) => imp.weatherRiskScore >= 20 || imp.probabilityOfDelay >= 0.3 || imp.probabilityOfCancellation >= 0.2
      );

      let disruptions: Disruption[] = [];
      if (candidates.length > 0) {
        disruptions = candidates.slice(0, 2).map((imp) => {
          const isCancel = imp.probabilityOfCancellation > 0.4;
          return {
            bookingId: imp.bookingId,
            disruptionType: isCancel ? 'cancellation' : 'delay',
            delayMinutes: isCancel ? undefined : (imp.estimatedDelayMinutes || 90),
            reason: `[Weather Disruption] ${imp.reason}`,
            timestamp: new Date().toISOString(),
          };
        });
      } else {
        const highest = [...(twinState?.weatherImpacts ?? [])].sort(
          (a, b) => b.weatherRiskScore - a.weatherRiskScore
        )[0] ?? twinState?.weatherImpacts[0];

        if (highest) {
          const isCancel = highest.probabilityOfCancellation > 0.4;
          disruptions = [{
            bookingId: highest.bookingId,
            disruptionType: isCancel ? 'cancellation' : 'delay',
            delayMinutes: isCancel ? undefined : (highest.estimatedDelayMinutes || 90),
            reason: `[Weather Disruption] ${highest.reason}`,
            timestamp: new Date().toISOString(),
          }];
        } else if (itinerary.bookings.length > 0) {
          disruptions = [{
            bookingId: itinerary.bookings[0].id,
            disruptionType: 'delay',
            delayMinutes: 120,
            reason: `[Weather Disruption] Ground hold and thunderstorm at origin airport (+120m delay)`,
            timestamp: new Date().toISOString(),
          }];
        }
      }

      applyWeatherDisruptionToItinerary(itinerary, disruptions, true);
    },
    [itinerary, applyWeatherDisruptionToItinerary, twinState]
  );

  // Display locations list (deduplicated by city name)
  const displayLocations: LocationWeather[] = useMemo(() => {
    let rawList: LocationWeather[] = [];
    if (twinState?.locationWeather && twinState.locationWeather.length > 0) {
      rawList = twinState.locationWeather;
    } else if (locationWeathers.length > 0) {
      rawList = locationWeathers;
    } else if (itinerary) {
      rawList = extractLocations(itinerary).map((l) => getFallbackWeather(l.lat, l.lng, l.label));
    }
    const seenCities = new Set<string>();
    return rawList.filter((loc, idx) => {
      const { city } = getPlaceShortName(loc.label, idx, rawList.length);
      const normalized = city.toLowerCase();
      if (seenCities.has(normalized)) return false;
      seenCities.add(normalized);
      return true;
    });
  }, [twinState?.locationWeather, locationWeathers, itinerary]);

  // Active location and its theme
  const safeLocationIndex = selectedLocationIndex < displayLocations.length ? selectedLocationIndex : 0;
  const activeLocation = displayLocations[safeLocationIndex] ?? displayLocations[0];
  const activeCondition = activeLocation?.current ?? getFallbackWeather(28.61, 77.20, 'Delhi').current;
  const currentTheme = getWeatherTheme(activeCondition);
  const activePlaceInfo = activeLocation
    ? getPlaceShortName(activeLocation.label, safeLocationIndex, displayLocations.length)
    : { city: itinerary?.destination?.split(',')[0] || 'Destination', role: 'Main' };

  const isTargetOfScenario = useMemo(() => {
    if (!scenarioActive) return false;
    const key = (scenario.targetLocationKey || scenario.affectedLocations || 'all');
    if (key === 'all') return true;
    if (key === 'origin' && safeLocationIndex === 0) return true;
    if (key === 'destination' && safeLocationIndex === displayLocations.length - 1) return true;
    return false;
  }, [scenarioActive, scenario.targetLocationKey, scenario.affectedLocations, safeLocationIndex, displayLocations.length]);

  if (!itinerary) {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <div>
          <p className="font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>No trip found</p>
          <button onClick={() => navigate('/app/dashboard')} className="text-sm underline" style={{ color: 'var(--color-confirmed)' }}>
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  const overallRisk = twinState?.overallRiskScore ?? 0;
  const allImpacts = twinState?.weatherImpacts ?? [];
  const highRiskCount = allImpacts.filter((i) => i.weatherRiskScore > 20).length;

  return (
    <div className="w-full space-y-6 font-body pb-24 lg:pb-8">

      {/* ── Subheader & Quick Status ── */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100 shadow-2xs">
            <CloudRain size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-base sm:text-lg text-gray-900 leading-tight">
                Weather Digital Twin
              </h1>
              {scenarioActive && (
                <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-amber-50 text-amber-700 border border-amber-200">
                  SIMULATION
                </span>
              )}
            </div>
            <p className="text-2xs sm:text-xs text-gray-500 font-medium truncate mt-0.5">
              Atmospheric telemetry & disruption forecasting for {itinerary.destination}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {scenarioActive && (
            <button
              onClick={resetToLive}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          <button
            onClick={() => loadWeather()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Simulation sandbox banner (if active) ── */}
      {scenarioActive && (
        <div
          className="rounded-xl border p-4 flex items-start gap-3"
          style={{ backgroundColor: 'var(--color-at-risk-bg)', borderColor: 'var(--color-at-risk-border)' }}
        >
          <Zap size={18} style={{ color: 'var(--color-at-risk)' }} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-at-risk)', color: 'white' }}>
                WHAT-IF SANDBOX ACTIVE
              </span>
              <span className="font-mono text-xs" style={{ color: 'var(--color-text-subtle)' }}>NON-DESTRUCTIVE SIMULATION</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
              Simulating: {scenario.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {scenario.precipitationMmHr}mm/h rain · {scenario.temperatureCelsius}°C · {scenario.windSpeedKmH} km/h wind — changes are not applied to your live trip
            </p>
          </div>
          <button onClick={resetToLive} className="flex-shrink-0 hover:opacity-70 transition-opacity" style={{ color: 'var(--color-text-subtle)' }}>
            <X size={16} />
          </button>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* UNIFIED TAB SWITCHER — Weather is Tab 1, always shown first           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        {/* Tab Bar */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none sm:grid sm:grid-cols-6">
            {([
              {
                key: 'weather' as const,
                icon: <CloudRain size={15} className="flex-shrink-0" />,
                label: 'Weather',
                shortLabel: 'Weather',
                badge: activeCondition ? `${activeCondition.temperature.toFixed(0)}°C` : 'Live',
                badgeColor: '#0369A1',
                badgeBg: '#E0F2FE',
              },
              {
                key: 'impacts' as const,
                icon: <AlertTriangle size={15} className="flex-shrink-0" />,
                label: 'Impact Analysis',
                shortLabel: 'Impacts',
                badge: highRiskCount > 0 ? `${highRiskCount} risk` : `${allImpacts.length}`,
                badgeColor: highRiskCount > 0 ? '#DC2626' : '#64748B',
                badgeBg: highRiskCount > 0 ? '#FEE2E2' : '#F1F5F9',
              },
              {
                key: 'scenarios' as const,
                icon: <Zap size={15} className="flex-shrink-0" />,
                label: 'What-If Scenarios',
                shortLabel: 'Scenarios',
                badge: scenarioActive ? 'ACTIVE' : 'Presets',
                badgeColor: scenarioActive ? '#B45309' : '#1E293B',
                badgeBg: scenarioActive ? '#FEF3C7' : '#F1F5F9',
              },
              {
                key: 'variables' as const,
                icon: <SlidersHorizontal size={15} className="flex-shrink-0" />,
                label: 'Atmospheric Variables',
                shortLabel: 'Variables',
                badge: 'Controls',
                badgeColor: '#1E293B',
                badgeBg: '#F1F5F9',
              },
              {
                key: 'map' as const,
                icon: <MapIcon size={15} className="flex-shrink-0" />,
                label: 'Radar Live Map',
                shortLabel: 'Radar',
                badge: 'Spatial',
                badgeColor: '#1E293B',
                badgeBg: '#F1F5F9',
              },
              {
                key: 'social' as const,
                icon: <MessageSquare size={15} className="flex-shrink-0" />,
                label: 'Social Pulse',
                shortLabel: 'Pulse',
                badge: `${socialFeed?.signals.length ?? 4}`,
                badgeColor: '#1E293B',
                badgeBg: '#F1F5F9',
              },
            ]).map(({ key, icon, label, shortLabel, badge, badgeColor, badgeBg }) => {
              const isCur = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap min-w-max sm:min-w-0 ${
                    isCur
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                  }`}
                >
                  {icon}
                  <span className="hidden md:inline truncate">{label}</span>
                  <span className="md:hidden truncate">{shortLabel}</span>
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={
                      isCur
                        ? { backgroundColor: 'rgba(255,255,255,0.22)', color: '#FFFFFF' }
                        : { backgroundColor: badgeBg, color: badgeColor }
                    }
                  >
                    {badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TAB: WEATHER ── */}
        {activeTab === 'weather' && (
          <div className="space-y-3">
            {/* Weather Tabs according to the place */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest mr-1 flex items-center gap-1 flex-shrink-0">
                  <MapPin size={12} className="text-blue-600" />
                  Places:
                </span>
                {displayLocations.map((loc, idx) => {
                  const isSelected = safeLocationIndex === idx;
                  const theme = getWeatherTheme(loc.current);
                  const placeInfo = getPlaceShortName(loc.label, idx, displayLocations.length);
    
                  return (
                    <button
                      key={`${loc.lat}-${loc.lng}-${idx}`}
                      onClick={() => setSelectedLocationIndex(idx)}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap border"
                      style={
                        isSelected
                          ? {
                              backgroundColor: 'var(--color-confirmed)',
                              borderColor: 'var(--color-confirmed)',
                              color: '#FFFFFF',
                              boxShadow: '0 2px 8px rgba(16,42,67,0.22)',
                            }
                          : {
                              backgroundColor: 'var(--color-bg-surface)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-muted)',
                            }
                      }
                    >
                      <span className="font-bold">{placeInfo.city}</span>
                      <span className="font-mono font-bold ml-1">
                        {loc.current.temperature.toFixed(0)}°C
                      </span>
                      <span className="text-[11px] opacity-90">
                        {theme.type === 'sunny' ? '☀️' : theme.type === 'thunderstorm' ? '⛈️' : theme.type === 'rain' ? '🌧️' : theme.type === 'cloudy' ? '☁️' : theme.type === 'fog' ? '🌫️' : '❄️'}
                      </span>
                    </button>
                  );
                })}
              </div>
    
              <div className="flex items-center gap-2 text-xs font-mono text-gray-500 ml-auto">
                <span>Live Weather Box</span>
              </div>
            </div>
    
            {/* The Weather Box with Backdrop Photo */}
            <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-200/90 bg-white shadow-sm text-gray-900">
              {/* Dynamic Backdrop photo from Wikipedia / Wikimedia Commons with Unsplash fallback */}
              <WeatherBackdropImage
                theme={currentTheme}
                alt={`${activePlaceInfo.city} - ${currentTheme.name}`}
              />
    
              {/* Weather Box Inner Content */}
              <div className="relative z-10 p-5 sm:p-7 md:p-8 flex flex-col justify-between min-h-[380px] sm:min-h-[420px]">
                {/* Top Bar inside Box */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200/80">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-display font-extrabold text-gray-900 tracking-tight truncate">
                        {activePlaceInfo.city}
                      </h2>
                      {activeLocation && (
                        <span className="text-xs text-gray-500 font-mono hidden sm:inline">
                          ({activeLocation.lat.toFixed(2)}°N, {activeLocation.lng.toFixed(2)}°E)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 font-medium truncate mt-0.5">
                      {activeLocation?.label || itinerary.destination}
                    </p>
                  </div>
    
                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                    {/* Simulation Badge if active */}
                    {scenarioActive && isTargetOfScenario && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        <Zap size={12} className="fill-amber-900" />
                        SIMULATION ACTIVE
                      </span>
                    )}
    
                    {/* Public Domain Attribution */}
                    <a
                      href={currentTheme.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] font-mono text-gray-600 hover:text-gray-900 bg-white/90 hover:bg-white px-2.5 py-1 rounded-full border border-gray-200/90 shadow-2xs transition-all"
                      title="Click to view image source on Wikimedia Commons"
                    >
                      <span>📷 {currentTheme.sourceTitle.split(':')[1]?.trim() || 'Wikipedia Photo'}</span>
                      <ExternalLink size={10} className="text-gray-400" />
                    </a>
                  </div>
                </div>
    
                {/* Center: Hero Temperature & Operational Synopsis */}
                <div className="my-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-2 max-w-xl">
                    <div className="flex items-center gap-4">
                      <WeatherIconDisplay type={currentTheme.type} />
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-gray-900">
                            {activeCondition.temperature.toFixed(0)}
                          </span>
                          <span className="text-2xl sm:text-3xl font-light text-gray-500 font-mono">°C</span>
                          <span className="ml-3 text-xs sm:text-sm font-mono px-2 py-0.5 rounded-md bg-gray-100/90 text-gray-600 border border-gray-200/80">
                            Feels {activeCondition.temperature > 25 ? (activeCondition.temperature + 2).toFixed(0) : (activeCondition.temperature - 1).toFixed(0)}°C
                          </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mt-0.5">
                          {activeCondition.weatherLabel}
                        </h3>
                      </div>
                    </div>
    
                    {/* Real-time traveler operational condition description */}
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium bg-white/85 backdrop-blur-sm p-3 sm:p-3.5 rounded-xl border border-gray-200/80 shadow-2xs mt-3">
                      {getOperationalWeatherSummary(activeCondition, activePlaceInfo.city, activePlaceInfo.role)}
                    </p>
                  </div>
    
                  {/* Quick Place switcher arrows */}
                  {displayLocations.length > 1 && (
                    <div className="flex items-center gap-2 self-start md:self-end">
                      <button
                        onClick={() => setSelectedLocationIndex((prev) => (prev > 0 ? prev - 1 : displayLocations.length - 1))}
                        className="p-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-700 shadow-2xs transition-all cursor-pointer"
                        title="Previous location weather"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs font-mono text-gray-600 px-1">
                        {safeLocationIndex + 1} / {displayLocations.length}
                      </span>
                      <button
                        onClick={() => setSelectedLocationIndex((prev) => (prev < displayLocations.length - 1 ? prev + 1 : 0))}
                        className="p-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-700 shadow-2xs transition-all cursor-pointer"
                        title="Next location weather"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
    
                {/* Bottom: Telemetry Glassmorphism Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4 border-t border-gray-200/80">
                  {/* 1. Rainfall */}
                  <div className="p-3 rounded-xl bg-white/85 backdrop-blur-sm border border-gray-200/90 shadow-2xs hover:border-gray-300 transition-all">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-1">
                      <Droplets size={12} className="text-sky-600" />
                      <span>Precipitation</span>
                    </div>
                    <p className="text-base font-bold font-mono text-gray-900">
                      {activeCondition.precipitation.toFixed(1)} <span className="text-xs font-normal text-gray-500">mm/h</span>
                    </p>
                    <span className="text-[10px] text-gray-500">
                      {activeCondition.precipitation > 20 ? 'Torrential' : activeCondition.precipitation > 5 ? 'Heavy Rain' : activeCondition.precipitation > 0 ? 'Light Rain' : 'Dry'}
                    </span>
                  </div>
    
                  {/* 2. Wind */}
                  <div className="p-3 rounded-xl bg-white/85 backdrop-blur-sm border border-gray-200/90 shadow-2xs hover:border-gray-300 transition-all">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-1">
                      <Wind size={12} className="text-emerald-600" />
                      <span>Wind Speed</span>
                    </div>
                    <p className="text-base font-bold font-mono text-gray-900">
                      {activeCondition.windSpeed.toFixed(0)} <span className="text-xs font-normal text-gray-500">km/h</span>
                    </p>
                    <span className="text-[10px] text-gray-500">
                      Gusts: {(activeCondition.windGusts || activeCondition.windSpeed * 1.25).toFixed(0)} km/h
                    </span>
                  </div>
    
                  {/* 3. Cloud Cover */}
                  <div className="p-3 rounded-xl bg-white/85 backdrop-blur-sm border border-gray-200/90 shadow-2xs hover:border-gray-300 transition-all">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-1">
                      <Cloud size={12} className="text-slate-600" />
                      <span>Cloud Cover</span>
                    </div>
                    <p className="text-base font-bold font-mono text-gray-900">
                      {activeCondition.cloudCover}%
                    </p>
                    <span className="text-[10px] text-gray-500">
                      {activeCondition.cloudCover > 80 ? 'Overcast Ceiling' : activeCondition.cloudCover > 40 ? 'Scattered' : 'Clear Sky'}
                    </span>
                  </div>
    
                  {/* 4. Visibility */}
                  <div className="p-3 rounded-xl bg-white/85 backdrop-blur-sm border border-gray-200/90 shadow-2xs hover:border-gray-300 transition-all">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-1">
                      <Eye size={12} className="text-amber-600" />
                      <span>Visibility</span>
                    </div>
                    <p className="text-base font-bold font-mono text-gray-900">
                      {activeCondition.visibility.toFixed(1)} <span className="text-xs font-normal text-gray-500">km</span>
                    </p>
                    <span className="text-[10px] text-gray-500">
                      {activeCondition.visibility >= 9 ? 'Full Visibility' : activeCondition.visibility >= 4 ? 'Moderate' : 'Low Mist/Fog'}
                    </span>
                  </div>
    
                  {/* 5. Peak Gusts */}
                  <div className="p-3 rounded-xl bg-white/85 backdrop-blur-sm border border-gray-200/90 shadow-2xs hover:border-gray-300 transition-all">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-1">
                      <Wind size={12} className="text-cyan-600" />
                      <span>Peak Gusts</span>
                    </div>
                    <p className="text-base font-bold font-mono text-gray-900">
                      {activeCondition.windGusts.toFixed(0)} <span className="text-xs font-normal text-gray-500">km/h</span>
                    </p>
                    <span className="text-[10px] text-gray-500">
                      {activeCondition.windGusts > 50 ? 'Strong Gusts' : 'Standard Gusts'}
                    </span>
                  </div>
    
                  {/* 6. Disruption Risk */}
                  <div className="p-3 rounded-xl bg-white/85 backdrop-blur-sm border border-gray-200/90 shadow-2xs hover:border-gray-300 transition-all">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-1">
                      <AlertTriangle size={12} className="text-orange-500" />
                      <span>Local Risk</span>
                    </div>
                    <p className="text-base font-bold font-mono text-gray-900">
                      {riskLabel(activeCondition.severity * 25)}
                    </p>
                    <span className="text-[10px] text-gray-500">
                      Severity: {activeCondition.severity}/4 ({activeCondition.severity * 25}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

      <section
        className="rounded-2xl border p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ backgroundColor: riskBg(overallRisk), borderColor: riskBorder(overallRisk) }}
      >
        <div className="flex items-start sm:items-center gap-4">
          <div className="flex items-baseline gap-1 flex-shrink-0">
            <span className="text-4xl sm:text-5xl font-black leading-none font-mono" style={{ color: riskColor(overallRisk) }}>
              {overallRisk}
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>/100</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono"
                style={{ backgroundColor: riskBg(overallRisk), color: riskColor(overallRisk), border: `1px solid ${riskBorder(overallRisk)}` }}
              >
                {riskLabel(overallRisk)} DISRUPTION RISK
              </span>
              {twinState && twinState.totalEstimatedDelay > 0 && (
                <span className="text-xs font-mono font-bold" style={{ color: riskColor(overallRisk) }}>
                  ~{Math.round(twinState.totalEstimatedDelay / 60)}h total chain ripple
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>
              {scenarioActive
                ? (twinState?.primaryThreat || `Simulated ${scenario.name} active`)
                : overallRisk === 0
                ? 'Corridor clear: All connections operating on schedule'
                : (twinState?.primaryThreat || 'Live telemetry monitoring')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-start md:self-auto">
          {(highRiskCount > 0 || scenarioActive || overallRisk > 0) && (
            <button
              type="button"
              onClick={() => handleTransferToPlanB()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold cursor-pointer shadow-xs transition-all hover:opacity-95"
              style={{
                background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
              }}
              title="Transfer predicted weather impacts into Plan B multi-agent recovery solver"
            >
              <Zap size={14} className="text-amber-300" />
              <span>Launch Plan B Recovery</span>
            </button>
          )}
        </div>
      </section>

          </div>
        )}
        {/* ── TAB 1: IMPACT ANALYSIS ── */}
        {activeTab === 'impacts' && (
          <div className="space-y-4">
            <div
              className="rounded-2xl border bg-white shadow-2xs"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b gap-3 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                    <AlertTriangle size={17} style={{ color: 'var(--color-at-risk)' }} />
                    Booking Impact Analysis
                    {scenarioActive && (
                      <span
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                      >
                        SIMULATED
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Real-time flight & accommodation vulnerability assessments based on atmospheric corridor telemetry
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(highRiskCount > 0 || scenarioActive) && (
                    <button
                      type="button"
                      onClick={() => handleTransferToPlanB()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs sm:text-sm font-bold cursor-pointer shadow-xs transition-all hover:opacity-95"
                      style={{
                        background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
                      }}
                      title="Transfer weather disruption predictions into Plan B multi-agent recovery"
                    >
                      <Zap size={14} className="text-amber-300" />
                      <span>Launch Plan B Recovery</span>
                    </button>
                  )}
                  <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
                    {highRiskCount > 0 ? (
                      <span className="font-bold mr-1" style={{ color: 'var(--color-at-risk)' }}>
                        {highRiskCount} at risk ·
                      </span>
                    ) : null}
                    {allImpacts.length} bookings
                  </span>
                </div>
              </div>

              <div className="p-5">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-blue-600" />
                  </div>
                ) : allImpacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 size={36} style={{ color: 'var(--color-recovered)' }} className="mb-2" />
                    <p className="text-sm font-bold" style={{ color: 'var(--color-recovered)' }}>All Clear</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                      No weather impacts or transit delays recorded across travel corridor
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allImpacts.map((impact) => (
                      <ImpactRow
                        key={impact.bookingId}
                        impact={impact}
                        onResolve={handleTransferToPlanB}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cascade Chain if Disruption detected */}
            {twinState && twinState.cascadeChain.length > 0 && (
              <div
                className="rounded-2xl border p-5 shadow-2xs bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <p className="font-mono text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5 font-bold" style={{ color: 'var(--color-text-subtle)' }}>
                  <Activity size={14} className="text-blue-600" />
                  Cascade Chain Ripple
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {twinState.cascadeChain.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 font-mono"
                        style={{ backgroundColor: riskBg(overallRisk), color: riskColor(overallRisk), border: `1px solid ${riskBorder(overallRisk)}` }}
                      >
                        {i + 1}
                      </div>
                      <p className="text-sm leading-snug text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regional Telemetry Stations */}
            {!isLoading && displayLocations.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="font-mono text-xs uppercase tracking-widest text-gray-500 font-bold">
                  Corridor Telemetry Stations
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {displayLocations.map((lw, i) => (
                    <LocationWeatherCard key={i} lw={lw} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: WHAT-IF SCENARIOS (PRESETS) ── */}
        {activeTab === 'scenarios' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    Disruption Simulation Presets
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select a realistic weather emergency scenario to stress-test your itinerary graph in a safe sandbox
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {scenarioActive && (
                    <button
                      onClick={resetToLive}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 cursor-pointer transition-all"
                    >
                      <RotateCcw size={13} />
                      <span>Reset Live Weather</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('variables')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 cursor-pointer transition-all"
                  >
                    <SlidersHorizontal size={13} />
                    <span>Custom Variables</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(WEATHER_SCENARIO_PRESETS).map(([key, preset]) => {
                  const isActive = selectedPreset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[120px] ${
                        isActive
                          ? 'border-blue-500 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-gray-200 bg-gray-50/60 hover:bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-sm text-gray-900">{preset.name}</span>
                        {isActive ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-gray-400 group-hover:text-gray-600">➔</span>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-gray-600 font-mono">
                        <p>🌧️ {preset.precipitationMmHr} mm/h rain</p>
                        <p>💨 {preset.windSpeedKmH} km/h wind · ⏳ {preset.stormDurationHours}h</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cascade Chain if scenario active */}
            {twinState && twinState.cascadeChain.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-xs uppercase tracking-widest flex items-center gap-1.5 font-bold text-gray-700">
                    <Activity size={14} className="text-orange-500" />
                    Simulated Ripple Chain Impact
                  </p>
                  <button
                    onClick={() => handleTransferToPlanB()}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Send to Plan B Solver</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {twinState.cascadeChain.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 font-mono"
                        style={{ backgroundColor: riskBg(overallRisk), color: riskColor(overallRisk), border: `1px solid ${riskBorder(overallRisk)}` }}
                      >
                        {i + 1}
                      </div>
                      <p className="text-sm leading-snug text-gray-800">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ATMOSPHERIC VARIABLES (CONTROLS & SLIDERS) ── */}
        {activeTab === 'variables' && (
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <SlidersHorizontal size={17} className="text-blue-600" />
                  Atmospheric Variables Workbench
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Fine-tune granular weather telemetry parameters and run forward-simulations
                </p>
              </div>

              {scenarioActive && (
                <button
                  onClick={resetToLive}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw size={13} />
                  <span>Reset Live</span>
                </button>
              )}
            </div>

            {/* Target Location Selector */}
            <div className="pb-4 border-b border-gray-200">
              <p className="font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5 text-gray-600 font-bold">
                <MapPin size={13} className="text-blue-600" />
                Simulate Weather At Specific Corridor Node
              </p>
              <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-gray-50 border border-gray-200 max-w-lg">
                {(() => {
                  const firstLoc = itinerary?.bookings[0]?.location;
                  const firstLocName = firstLoc ? (firstLoc.type === 'coordinates' ? (firstLoc.label || '') : firstLoc.name) : '';
                  const originLabel = firstLocName.includes('DEL') ? 'Delhi' : 'Origin';
                  return [
                    { id: 'all', label: 'All Places' },
                    { id: 'origin', label: originLabel },
                    {
                      id: 'destination',
                      label: `${itinerary?.destination?.split(',')[0]?.trim() || 'Destination'}`,
                    },
                  ];
                })().map((loc) => {
                  const isSelected =
                    (scenario.targetLocationKey || scenario.affectedLocations || 'all') === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() =>
                        setScenario((s) => ({
                          ...s,
                          targetLocationKey: loc.id,
                          affectedLocations: loc.id,
                          name: 'Custom Scenario',
                        }))
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                      }`}
                    >
                      {loc.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {(() => {
                  const firstLoc = itinerary?.bookings[0]?.location;
                  const firstLocName = firstLoc ? (firstLoc.type === 'coordinates' ? (firstLoc.label || '') : firstLoc.name) : '';
                  const originLabel = firstLocName.includes('DEL') ? 'Delhi' : 'Origin';
                  return (scenario.targetLocationKey || scenario.affectedLocations) === 'origin'
                    ? `Simulates weather strictly in ${originLabel}. Departure flights will ground-delay, while ${itinerary?.destination?.split(',')[0]?.trim() || 'destination'} stays calm.`
                    : (scenario.targetLocationKey || scenario.affectedLocations) === 'destination'
                    ? `Simulates weather strictly in ${itinerary?.destination?.split(',')[0]?.trim() || 'Goa'}. Hotel transfers and outdoor excursions are impacted while outbound departure remains green.`
                    : 'Simulates severe convective storm conditions across the entire transit corridor simultaneously.';
                })()}
              </p>
            </div>

            {/* Slider Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <WeatherSlider
                label="Rainfall Intensity"
                icon={<Droplets size={14} className="text-sky-500" />}
                value={scenario.precipitationMmHr}
                min={0} max={200} step={5} unit="mm/h"
                onChange={(v) => setScenario((s) => ({ ...s, precipitationMmHr: v, name: 'Custom Scenario' }))}
              />
              <WeatherSlider
                label="Ambient Temperature"
                icon={<Thermometer size={14} className="text-red-500" />}
                value={scenario.temperatureCelsius}
                min={-10} max={50} step={1} unit="°C"
                onChange={(v) => setScenario((s) => ({ ...s, temperatureCelsius: v, name: 'Custom Scenario' }))}
              />
              <WeatherSlider
                label="Peak Wind Speed"
                icon={<Wind size={14} className="text-teal-500" />}
                value={scenario.windSpeedKmH}
                min={0} max={150} step={5} unit="km/h"
                onChange={(v) => setScenario((s) => ({ ...s, windSpeedKmH: v, name: 'Custom Scenario' }))}
              />
              <WeatherSlider
                label="Expected Storm Duration"
                icon={<Clock size={14} className="text-purple-500" />}
                value={scenario.stormDurationHours}
                min={0} max={72} step={1} unit="hrs"
                onChange={(v) => setScenario((s) => ({ ...s, stormDurationHours: v, name: 'Custom Scenario' }))}
              />
            </div>

            {/* Flood Level Selection */}
            <div className="pt-2">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-gray-600 mb-2 flex items-center gap-1.5">
                <Waves size={14} className="text-blue-500" />
                Ground Standing Water / Flood Severity
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['none', 'minor', 'moderate', 'severe'] as const).map((level) => {
                  const isSelected = scenario.floodLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setScenario((s) => ({ ...s, floodLevel: level, name: 'Custom Scenario' }))}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={runSimulation}
                disabled={isSimulating}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60 cursor-pointer shadow-xs"
              >
                {isSimulating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Simulating Disruption Cascades…
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Run Digital Twin Simulation
                  </>
                )}
              </button>

              <button
                onClick={() => setActiveTab('impacts')}
                className="text-xs font-semibold text-gray-500 hover:text-gray-900 cursor-pointer"
              >
                View resulting impacts in Impact Analysis ➔
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 4: RADAR LIVE MAP ── */}
        {activeTab === 'map' && (
          <div
            className="rounded-2xl border overflow-hidden bg-white shadow-2xs"
            style={{ height: 'calc(100vh - 220px)', minHeight: '520px', borderColor: 'var(--color-border)' }}
          >
            {isLoading ? (
              <div
                className="h-full flex items-center justify-center bg-gray-50"
              >
                <Loader2 size={24} className="animate-spin text-blue-600" />
              </div>
            ) : (
              <WeatherMapOverlay
                itinerary={itinerary}
                locationWeathers={displayLocations}
                weatherImpacts={twinState?.weatherImpacts ?? []}
                scenarioActive={scenarioActive}
              />
            )}
          </div>
        )}

        {/* ── TAB 5: SOCIAL PULSE ── */}
        {activeTab === 'social' && (
          <div className="space-y-4">
            {/* Community Mood */}
            {socialFeed && (
              <div
                className="rounded-2xl border p-5 bg-white shadow-2xs"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                    <Globe size={16} className="text-blue-600" />
                    Community Mood — {socialFeed.destination}
                  </p>
                  <span className="text-xs font-mono text-gray-500">
                    Fetched {new Date(socialFeed.fetchedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className="text-4xl font-black font-mono"
                    style={{ color: riskColor(100 - socialFeed.communityMoodScore) }}
                  >
                    {socialFeed.communityMoodScore}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {socialFeed.communityMoodScore < 30 ? (
                        <TrendingDown size={15} style={{ color: 'var(--color-disrupted)' }} />
                      ) : socialFeed.communityMoodScore < 60 ? (
                        <Minus size={15} style={{ color: 'var(--color-at-risk)' }} />
                      ) : (
                        <TrendingUp size={15} style={{ color: 'var(--color-recovered)' }} />
                      )}
                      <span className="text-sm font-bold text-gray-900">
                        {socialFeed.communityMoodScore < 30 ? 'High Disruption Concern' : socialFeed.communityMoodScore < 60 ? 'Mixed Traveler Reports' : 'Calm & Normal Operations'}
                      </span>
                    </div>
                    {socialFeed.topConcern && (
                      <p className="text-xs text-gray-500">
                        Top passenger concern: <span className="font-semibold text-gray-700">{socialFeed.topConcern}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full overflow-hidden bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${socialFeed.communityMoodScore}%`,
                      backgroundColor: riskColor(100 - socialFeed.communityMoodScore),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Signal Feed */}
            <div
              className="rounded-2xl border bg-white shadow-2xs"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                <p className="text-sm font-bold flex items-center gap-2 text-gray-900">
                  <MessageSquare size={15} className="text-blue-600" />
                  Live Traveler & Airport Social Signals
                </p>
                <button
                  onClick={loadSocialSignals}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  <RefreshCw size={12} className={isSocialLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              <div className="p-5">
                {isSocialLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={22} className="animate-spin text-blue-600" />
                  </div>
                ) : (socialFeed?.signals.length ?? 0) === 0 ? (
                  <p className="text-sm text-center py-6 text-gray-500">
                    No social signals found for this destination
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {socialFeed!.signals.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Slider thumb CSS */}
      <style>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--color-confirmed);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        input[type='range']::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--color-confirmed);
          cursor: pointer;
          border: 2px solid white;
        }
      `}</style>

      {/* Mobile Bottom Navigation Bar */}
      {itinerary && (
        <MobileBottomNav
          activeTab="twin"
          onTabSelect={handleMobileNavSelect}
        />
      )}
    </div>
  );
}
