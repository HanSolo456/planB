import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SEED_ITINERARIES } from '../lib/seedData';
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
  ListOrdered,
  Map as MapIcon,
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
} from '../lib/weatherEngine';
import {
  fetchSocialSignals,
  getInitialSocialFeed,
  formatRelativeTime,
  type SocialSignalFeed,
  type SocialSignal,
} from '../lib/socialSignalEngine';
import WeatherMapOverlay from './WeatherMapOverlay';

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
function ImpactRow({ impact }: { impact: WeatherImpact }) {
  const delayPct = Math.round(impact.probabilityOfDelay * 100);
  const cancelPct = Math.round(impact.probabilityOfCancellation * 100);
  const score = impact.weatherRiskScore;

  const typeEmoji: Record<string, string> = {
    flight: 'FL', transfer: 'TR', hotel: 'HT', activity: 'AC', train: 'RW', event: 'EV',
  };

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
// LOCATION WEATHER CARD
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
// MAIN DIGITAL TWIN VIEW — matches the existing app light theme
// ---------------------------------------------------------------------------
export default function DigitalTwinView() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { selectedItinerary, importedItineraries } = useAppState();

  // Find itinerary — check selected, imported, and seed trips
  const itinerary =
    selectedItinerary?.id === tripId
      ? selectedItinerary
      : importedItineraries.find((it) => it.id === tripId)
      ?? SEED_ITINERARIES.find((it) => it.id === tripId)
      ?? selectedItinerary;

  // State
  const [twinState, setTwinState] = useState<DigitalTwinState | null>(null);
  const [socialFeed, setSocialFeed] = useState<SocialSignalFeed | null>(() =>
    itinerary ? getInitialSocialFeed(itinerary.destination) : null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [locationWeathers, setLocationWeathers] = useState<LocationWeather[]>([]);
  const [activeTab, setActiveTab] = useState<'impacts' | 'social' | 'map'>('impacts');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [scenarioActive, setScenarioActive] = useState(false);

  // What-if scenario state — default to active simulation values so Run Simulation immediately demonstrates impact
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
    <div className="w-full space-y-6 font-body">

      {/* ── Breadcrumb & header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/app/trip/${itinerary.id}`)}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ChevronLeft size={16} />
            <span>{itinerary.destination}</span>
          </button>
          <ChevronRight size={14} style={{ color: 'var(--color-text-subtle)' }} />
          <div className="flex items-center gap-1.5">
            <CloudRain size={15} style={{ color: 'var(--color-confirmed)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
              Weather Digital Twin
            </span>
          </div>
          {scenarioActive && (
            <span
              className="text-xs font-mono font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--color-at-risk-bg)', color: 'var(--color-at-risk)', border: '1px solid var(--color-at-risk-border)' }}
            >
              SIMULATION ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scenarioActive && (
            <button
              onClick={resetToLive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:shadow-sm"
              style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <RotateCcw size={13} />
              Reset to Live
            </button>
          )}
          <button
            onClick={() => loadWeather()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:shadow-sm"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
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

      {/* ── MAIN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── LEFT: Controls ── */}
        <div className="lg:col-span-4 space-y-4">

          {/* Overall Risk Score */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: riskBg(overallRisk), borderColor: riskBorder(overallRisk) }}
          >
            <p className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-subtle)' }}>
              Overall Weather Risk Score
            </p>
            {isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-confirmed)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Fetching live weather…</span>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black leading-none font-mono" style={{ color: riskColor(overallRisk) }}>
                    {overallRisk}
                  </span>
                  <span className="text-sm mb-1" style={{ color: 'var(--color-text-subtle)' }}>/100</span>
                  <span
                    className="mb-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono"
                    style={{ backgroundColor: riskBg(overallRisk), color: riskColor(overallRisk), border: `1px solid ${riskBorder(overallRisk)}` }}
                  >
                    {riskLabel(overallRisk)}
                  </span>
                </div>
                <div className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  {scenarioActive ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-xs leading-snug" style={{ color: riskColor(overallRisk) }}>
                        {twinState?.primaryThreat || 'Simulated weather disruption'}
                      </p>
                      <p className="text-[11px] leading-tight" style={{ color: 'var(--color-text-subtle)' }}>
                        Weighted: 70% critical flight risk + 30% chain ripple
                      </p>
                    </div>
                  ) : overallRisk === 0 ? (
                    <div className="space-y-0.5">
                      <p className="font-medium text-xs" style={{ color: 'var(--color-recovered)' }}>
                        Live weather: Clear & on schedule
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                        Run simulation below to test severe storms or delays.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs">{twinState?.primaryThreat ?? 'Live monitoring'}</p>
                  )}
                </div>
                {twinState && twinState.totalEstimatedDelay > 0 && (
                  <p className="text-xs mt-2 font-medium font-mono" style={{ color: riskColor(overallRisk) }}>
                    ~{Math.round(twinState.totalEstimatedDelay / 60)}h total chain delay
                  </p>
                )}
              </>
            )}
          </div>

          {/* Social Pulse Quick Card */}
          {socialFeed && (
            <button
              onClick={() => setActiveTab('social')}
              className="w-full text-left rounded-2xl border p-4 transition-all hover:shadow-sm"
              style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--color-text-subtle)' }}>
                  <MessageSquare size={13} style={{ color: 'var(--color-confirmed)' }} />
                  Social Pulse — {socialFeed.destination}
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--color-confirmed)' }}>
                  View →
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                    Community Mood: <span style={{ color: riskColor(100 - socialFeed.communityMoodScore) }}>{socialFeed.communityMoodScore}/100</span>
                  </p>
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>
                    Top signal: {socialFeed.topConcern || 'Traveler alerts'}
                  </p>
                </div>
                <span
                  className="text-xs font-mono font-bold px-2 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: riskBg(100 - socialFeed.communityMoodScore),
                    color: riskColor(100 - socialFeed.communityMoodScore),
                    border: `1px solid ${riskBorder(100 - socialFeed.communityMoodScore)}`,
                  }}
                >
                  {socialFeed.signals.length} posts
                </span>
              </div>
            </button>
          )}

          {/* Scenario Presets */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
          >
            <p className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-subtle)' }}>
              Scenario Presets
            </p>
            <div className="space-y-2">
              {Object.entries(WEATHER_SCENARIO_PRESETS).map(([key, preset]) => {
                const isActive = selectedPreset === key;
                return (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all border"
                    style={{
                      backgroundColor: isActive ? 'var(--color-confirmed-bg)' : 'var(--color-bg-surface-alt)',
                      borderColor: isActive ? 'var(--color-confirmed-border)' : 'var(--color-border-subtle)',
                      color: isActive ? 'var(--color-confirmed)' : 'var(--color-text-muted)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{preset.name}</span>
                      {isActive && <Zap size={13} style={{ color: 'var(--color-confirmed)' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* What-If Sliders */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
          >
            <p className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-subtle)' }}>
              What-If Parameters
            </p>

            {/* Target Location Selector */}
            <div className="mb-5 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <p className="font-mono text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-subtle)' }}>
                <MapPin size={13} style={{ color: 'var(--color-confirmed)' }} />
                Simulate Weather At
              </p>
              <div
                className="grid grid-cols-3 gap-1.5 p-1 rounded-xl"
                style={{ backgroundColor: 'var(--color-bg-surface-alt)', border: '1px solid var(--color-border-subtle)' }}
              >
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
                      className="px-2 py-1.5 rounded-lg text-xs font-bold transition-all text-center"
                      style={{
                        backgroundColor: isSelected ? 'var(--color-confirmed)' : 'transparent',
                        color: isSelected ? '#FFFFFF' : 'var(--color-text-muted)',
                      }}
                    >
                      {loc.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--color-text-subtle)' }}>
                {(() => {
                  const firstLoc = itinerary?.bookings[0]?.location;
                  const firstLocName = firstLoc ? (firstLoc.type === 'coordinates' ? (firstLoc.label || '') : firstLoc.name) : '';
                  const originLabel = firstLocName.includes('DEL') ? 'Delhi' : 'Origin';
                  return (scenario.targetLocationKey || scenario.affectedLocations) === 'origin'
                    ? `Simulates weather only in ${originLabel}. Flights delay; ${itinerary?.destination?.split(',')[0]?.trim() || 'destination'} stays sunny with cascading arrival delays.`
                    : (scenario.targetLocationKey || scenario.affectedLocations) === 'destination'
                    ? `Simulates weather only in ${itinerary?.destination?.split(',')[0]?.trim() || 'Goa'}. Beach activities & local cabs disrupted; flight departure remains on time.`
                    : 'Simulates severe weather across the entire travel corridor simultaneously.';
                })()}
              </p>
            </div>

            <div className="space-y-5">
              <WeatherSlider
                label="Rainfall"
                icon={<Droplets size={13} />}
                value={scenario.precipitationMmHr}
                min={0} max={200} step={5} unit="mm/h"
                onChange={(v) => setScenario((s) => ({ ...s, precipitationMmHr: v, name: 'Custom Scenario' }))}
              />
              <WeatherSlider
                label="Temperature"
                icon={<Thermometer size={13} />}
                value={scenario.temperatureCelsius}
                min={-10} max={50} step={1} unit="°C"
                onChange={(v) => setScenario((s) => ({ ...s, temperatureCelsius: v, name: 'Custom Scenario' }))}
              />
              <WeatherSlider
                label="Wind Speed"
                icon={<Wind size={13} />}
                value={scenario.windSpeedKmH}
                min={0} max={150} step={5} unit="km/h"
                onChange={(v) => setScenario((s) => ({ ...s, windSpeedKmH: v, name: 'Custom Scenario' }))}
              />
              <WeatherSlider
                label="Storm Duration"
                icon={<Clock size={13} />}
                value={scenario.stormDurationHours}
                min={0} max={72} step={1} unit="hrs"
                onChange={(v) => setScenario((s) => ({ ...s, stormDurationHours: v, name: 'Custom Scenario' }))}
              />

              {/* Flood Level */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  <Waves size={13} />
                  Flood Level
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['none', 'minor', 'moderate', 'severe'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setScenario((s) => ({ ...s, floodLevel: level, name: 'Custom Scenario' }))}
                      className="px-2 py-2 rounded-lg text-xs font-bold capitalize border transition-all"
                      style={{
                        backgroundColor: scenario.floodLevel === level ? 'var(--color-confirmed-bg)' : 'var(--color-bg-surface-alt)',
                        borderColor: scenario.floodLevel === level ? 'var(--color-confirmed-border)' : 'var(--color-border-subtle)',
                        color: scenario.floodLevel === level ? 'var(--color-confirmed)' : 'var(--color-text-subtle)',
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
              style={{
                backgroundColor: isSimulating ? 'var(--color-bg-surface-alt)' : 'var(--color-confirmed)',
                color: isSimulating ? 'var(--color-text-muted)' : 'white',
              }}
            >
              {isSimulating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Simulating…
                </>
              ) : (
                <>
                  <Play size={15} />
                  Run Simulation
                </>
              )}
            </button>
          </div>

          {/* Cascade Chain */}
          {twinState && twinState.cascadeChain.length > 0 && (
            <div
              className="rounded-2xl border p-5"
              style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
              <p className="font-mono text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-subtle)' }}>
                <Activity size={13} />
                Cascade Chain
              </p>
              <div className="space-y-3">
                {twinState.cascadeChain.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 font-mono"
                      style={{ backgroundColor: riskBg(overallRisk), color: riskColor(overallRisk), border: `1px solid ${riskBorder(overallRisk)}` }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-sm leading-snug" style={{ color: 'var(--color-text-muted)' }}>{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Main Content ── */}
        <div className="lg:col-span-8 space-y-4">

          {/* Tab Switcher — matches the existing view switcher in ItineraryView */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl border shadow-2xs w-full"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
          >
            {([
              {
                key: 'impacts',
                icon: <AlertTriangle size={14} />,
                label: 'Impact Analysis',
                badge: highRiskCount > 0 ? `${highRiskCount} at risk` : `${allImpacts.length} items`,
                badgeColor: highRiskCount > 0 ? 'var(--color-disrupted)' : 'var(--color-text-subtle)',
                badgeBg: highRiskCount > 0 ? 'var(--color-disrupted-bg)' : 'var(--color-bg-surface-alt)',
              },
              {
                key: 'map',
                icon: <MapIcon size={14} />,
                label: 'Live Map',
                badge: 'Spatial',
                badgeColor: 'var(--color-confirmed)',
                badgeBg: 'var(--color-confirmed-bg)',
              },
              {
                key: 'social',
                icon: <MessageSquare size={14} />,
                label: 'Social Pulse',
                badge: `${socialFeed?.signals.length ?? 4} signals`,
                badgeColor: 'var(--color-confirmed)',
                badgeBg: 'var(--color-confirmed-bg)',
              },
            ] as const).map(({ key, icon, label, badge, badgeColor, badgeBg }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                style={
                  activeTab === key
                    ? { backgroundColor: 'var(--color-confirmed-bg)', color: 'var(--color-confirmed)' }
                    : { color: 'var(--color-text-muted)' }
                }
              >
                {icon}
                <span>{label}</span>
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: badgeBg, color: badgeColor }}
                >
                  {badge}
                </span>
              </button>
            ))}
          </div>

          {/* ── TAB: IMPACT ANALYSIS ── */}
          {activeTab === 'impacts' && (
            <div className="space-y-4">
              {/* Weather Cards */}
              {!isLoading && (twinState?.locationWeather ?? locationWeathers).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(twinState?.locationWeather ?? locationWeathers).map((lw, i) => <LocationWeatherCard key={i} lw={lw} />)}
                </div>
              )}

              {/* Impacts */}
              <div
                className="rounded-2xl border"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                    <AlertTriangle size={15} style={{ color: 'var(--color-at-risk)' }} />
                    Booking Impact Analysis
                    {scenarioActive && (
                      <span
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--color-at-risk-bg)', color: 'var(--color-at-risk)' }}
                      >
                        SIMULATED
                      </span>
                    )}
                  </p>
                  <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
                    {highRiskCount > 0 ? (
                      <span className="font-bold mr-1" style={{ color: 'var(--color-at-risk)' }}>
                        {highRiskCount} at risk ·
                      </span>
                    ) : null}
                    {allImpacts.length} bookings
                  </span>
                </div>

                <div className="p-5">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-confirmed)' }} />
                    </div>
                  ) : allImpacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <CheckCircle2 size={32} style={{ color: 'var(--color-recovered)' }} className="mb-2" />
                      <p className="text-sm font-bold" style={{ color: 'var(--color-recovered)' }}>All Clear</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                        No weather impacts recorded
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {allImpacts.map((impact) => <ImpactRow key={impact.bookingId} impact={impact} />)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: MAP ── */}
          {activeTab === 'map' && (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ height: '500px', borderColor: 'var(--color-border)' }}
            >
              {isLoading ? (
                <div
                  className="h-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-bg-surface-alt)' }}
                >
                  <Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-confirmed)' }} />
                </div>
              ) : (
                <WeatherMapOverlay
                  itinerary={itinerary}
                  locationWeathers={twinState?.locationWeather ?? locationWeathers}
                  weatherImpacts={twinState?.weatherImpacts ?? []}
                  scenarioActive={scenarioActive}
                />
              )}
            </div>
          )}

          {/* ── TAB: SOCIAL PULSE ── */}
          {activeTab === 'social' && (
            <div className="space-y-4">
              {/* Community Mood */}
              {socialFeed && (
                <div
                  className="rounded-2xl border p-5"
                  style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                      <Globe size={15} style={{ color: 'var(--color-confirmed)' }} />
                      Community Mood — {socialFeed.destination}
                    </p>
                    <span className="text-xs font-mono" style={{ color: 'var(--color-text-subtle)' }}>
                      {new Date(socialFeed.fetchedAt).toLocaleTimeString()}
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
                          <TrendingDown size={14} style={{ color: 'var(--color-disrupted)' }} />
                        ) : socialFeed.communityMoodScore < 60 ? (
                          <Minus size={14} style={{ color: 'var(--color-at-risk)' }} />
                        ) : (
                          <TrendingUp size={14} style={{ color: 'var(--color-recovered)' }} />
                        )}
                        <span className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                          {socialFeed.communityMoodScore < 30 ? 'High Concern' : socialFeed.communityMoodScore < 60 ? 'Mixed Reports' : 'Mostly Calm'}
                        </span>
                      </div>
                      {socialFeed.topConcern && (
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Top concern: <span style={{ color: 'var(--color-at-risk)' }}>{socialFeed.topConcern}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
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
                className="rounded-2xl border"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                    <MessageSquare size={15} style={{ color: 'var(--color-confirmed)' }} />
                    Live Social Signals
                  </p>
                  <button
                    onClick={loadSocialSignals}
                    className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-70"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <RefreshCw size={12} className={isSocialLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>

                <div className="p-5">
                  {isSocialLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-confirmed)' }} />
                    </div>
                  ) : (socialFeed?.signals.length ?? 0) === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-subtle)' }}>
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
        </div>
      </div>

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
    </div>
  );
}
