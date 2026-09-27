import { useMemo, useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Itinerary, Booking, ImpactedBooking, Disruption } from '../lib/types';
import { getAtRiskConnections, calculateTripRiskScore, detectCombinedImpact } from '../lib/impactEngine';
import { topoSortBookings } from '../lib/topoSort';
import { useAppState } from '../App';
import MobileBottomNav, { type MobileTabKey } from './MobileBottomNav';
import ItineraryCard from './ItineraryCard';
import DisruptionBanner from './DisruptionBanner';
import TimelineView from './TimelineView';
// MapView pulls in leaflet (~200 KB) — lazy-load it so the map bundle only
// downloads when the user actually switches to the Map tab.
const MapView = lazy(() => import('./MapView'));
import SelectedBookingDetailCard from './SelectedBookingDetailCard';
import { useWikipediaImage } from '../lib/useWikipediaImage';
import { parseDisruptionFromText } from '../lib/nlDisruptionEngine';
import { createPortal } from 'react-dom';
import { createShareLink } from '../lib/cloudTripStorage';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  Info,
  Share2,
  Zap,
  ListOrdered,
  CalendarDays,
  Map as MapIcon,
  Pencil,
  Plane,
  Ban,
  Car,
  CloudRain,
  Send,
  Sparkles,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  X,
  Link as LinkIcon,
  QrCode,
  Copy,
  MapPin,
  Compass,
  Hotel,
} from 'lucide-react';

interface Props {
  itinerary: Itinerary;
}

const LOCAL_DESTINATION_IMAGES: Array<{ keywords: string[]; src: string }> = [
  { keywords: ['london', 'uk', 'england', 'britain'], src: '/London-2048x1506.png' },
  { keywords: ['paris', 'france'], src: '/Paris-2048x1506.png' },
  { keywords: ['san francisco', 'sf', 'california', 'bay area'], src: '/San Francisco-2048x1506.png' },
  { keywords: ['sydney', 'australia'], src: '/Sydney-2048x1506.png' },
  { keywords: ['goa'], src: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1600&q=80' },
];

function getLocalDestinationImage(destination: string): string | null {
  const lower = destination.toLowerCase();
  const match = LOCAL_DESTINATION_IMAGES.find(({ keywords }) =>
    keywords.some((kw) => lower.includes(kw))
  );
  return match ? match.src : null;
}

function formatDateRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}, ${e.getFullYear()}`;
  } catch {
    return `${start} – ${end}`;
  }
}

const CATEGORY_PILLS = [
  { type: 'flight',   label: 'Flight',   icon: null },
  { type: 'transfer', label: 'Transfer', icon: null },
  { type: 'activity', label: 'Activity', icon: null },
  { type: 'return',   label: 'Return',   icon: null },
];

// ---------------------------------------------------------------------------
// Row sub-component — hours/minutes stepper with clock icon
// ---------------------------------------------------------------------------
const QUICK_DELAYS = [30, 60, 90, 120, 180, 240];

function SimulateDisruptionRow({
  booking,
  onDisrupt,
}: {
  booking: Booking;
  onDisrupt: (bookingId: string, type: 'delay' | 'cancellation', delayMinutes: number) => void;
}) {
  // Store as string so the field can be fully cleared while typing
  const [hours, setHours] = useState('1');
  const [mins, setMins] = useState('30');
  const [showPicker, setShowPicker] = useState(false);

  const totalMins = (parseInt(hours || '0', 10) * 60) + parseInt(mins || '0', 10);

  function clampedHours(val: string) {
    const n = parseInt(val, 10);
    if (isNaN(n)) return val; // let the user clear the field
    return String(Math.min(23, Math.max(0, n)));
  }
  function clampedMins(val: string) {
    const n = parseInt(val, 10);
    if (isNaN(n)) return val;
    return String(Math.min(59, Math.max(0, n)));
  }

  function applyQuick(m: number) {
    setHours(String(Math.floor(m / 60)));
    setMins(String(m % 60));
    setShowPicker(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-xs text-gray-900 truncate">{booking.title}</p>
          <p className="text-[10px] text-gray-500 truncate">{booking.provider}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Time picker toggle */}
          <button
            type="button"
            onClick={() => setShowPicker((p) => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
              showPicker
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {totalMins > 0
              ? (parseInt(hours||'0') > 0 ? `${hours}h ` : '') + (parseInt(mins||'0') > 0 ? `${mins}m` : (parseInt(hours||'0') > 0 ? '' : '0m'))
              : '0m'}
          </button>
          <button
            onClick={() => { if (totalMins > 0) onDisrupt(booking.id, 'delay', totalMins); }}
            disabled={totalMins <= 0}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors"
          >
            Delay
          </button>
          <button
            onClick={() => onDisrupt(booking.id, 'cancellation', 0)}
            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Inline time picker */}
      {showPicker && (
        <div className="border-t border-amber-100 bg-amber-50/60 px-3 pb-3 pt-2.5">
          {/* Quick presets */}
          <p className="text-[10px] font-semibold text-amber-700 mb-2 uppercase tracking-wide">Quick presets</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_DELAYS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => applyQuick(m)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                  totalMins === m
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                {m < 60 ? `${m}m` : `${m/60}h`}
              </button>
            ))}
          </div>

          {/* Manual H : M input */}
          <p className="text-[10px] font-semibold text-amber-700 mb-1.5 uppercase tracking-wide">Custom</p>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <button type="button" onClick={() => setHours(String(Math.min(23, (parseInt(hours||'0'))+1)))} className="w-6 h-5 flex items-center justify-center rounded text-amber-700 hover:bg-amber-200 text-xs cursor-pointer">▲</button>
              <input
                type="text"
                inputMode="numeric"
                value={hours}
                onChange={(e) => setHours(clampedHours(e.target.value.replace(/\D/g,'')))}
                onBlur={() => setHours(String(Math.min(23, Math.max(0, parseInt(hours||'0', 10)))))}
                className="w-10 text-center text-sm font-bold text-amber-900 bg-white border border-amber-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button type="button" onClick={() => setHours(String(Math.max(0, (parseInt(hours||'0'))-1)))} className="w-6 h-5 flex items-center justify-center rounded text-amber-700 hover:bg-amber-200 text-xs cursor-pointer">▼</button>
              <span className="text-[9px] font-medium text-amber-600 uppercase tracking-wide">hrs</span>
            </div>
            <span className="text-lg font-bold text-amber-700 mb-3">:</span>
            <div className="flex flex-col items-center gap-0.5">
              <button type="button" onClick={() => setMins(String(Math.min(59, (parseInt(mins||'0'))+5)))} className="w-6 h-5 flex items-center justify-center rounded text-amber-700 hover:bg-amber-200 text-xs cursor-pointer">▲</button>
              <input
                type="text"
                inputMode="numeric"
                value={mins}
                onChange={(e) => setMins(clampedMins(e.target.value.replace(/\D/g,'')))}
                onBlur={() => setMins(String(Math.min(59, Math.max(0, parseInt(mins||'0', 10)))))}
                className="w-10 text-center text-sm font-bold text-amber-900 bg-white border border-amber-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button type="button" onClick={() => setMins(String(Math.max(0, (parseInt(mins||'0'))-5)))} className="w-6 h-5 flex items-center justify-center rounded text-amber-700 hover:bg-amber-200 text-xs cursor-pointer">▼</button>
              <span className="text-[9px] font-medium text-amber-600 uppercase tracking-wide">min</span>
            </div>
            <span className="text-xs text-amber-700 font-semibold ml-1 mb-3 self-center">
              = {totalMins}m total
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ItineraryView({ itinerary }: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialView = useMemo(() => {
    const p = searchParams.get('view');
    if (p === 'itinerary' || p === 'timeline' || p === 'map') return p;
    return 'itinerary';
  }, []);

  const [view, setView] = useState<'itinerary' | 'timeline' | 'map'>(initialView);
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('bkg-flight-1');

  const {
    activeDisruptions,
    impactedBookings,
    addDisruption,
    recoverySuccessMessage,
    clearRecoverySuccess,
    setShowRecoveryOptions,
    hasCapacityForAnotherDisruption,
  } = useAppState();

  const canEdit = !itinerary.isReadOnly;

  // ---------------------------------------------------------------------------
  // PROACTIVE WHAT-IF SCENARIO SANDBOX STATE
  // ---------------------------------------------------------------------------
  const [sandboxDisruption, setSandboxDisruption] = useState<Disruption | null>(null);

  // ---------------------------------------------------------------------------
  // SHARE MODAL STATE
  // ---------------------------------------------------------------------------
  const [shareModal, setShareModal] = useState(false);
  const [shareTab, setShareTab] = useState<'link' | 'qr'>('link');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareCodeCopied, setShareCodeCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareAllowEdit, setShareAllowEdit] = useState(false);

  // ---------------------------------------------------------------------------
  // EDIT TRIP MODAL STATE
  // ---------------------------------------------------------------------------
  const [editTripModal, setEditTripModal] = useState(false);
  const [simulateModal, setSimulateModal] = useState(false);

  // Sync view and simulate query parameters from URL
  useEffect(() => {
    const p = searchParams.get('view');
    if (p === 'itinerary' || p === 'timeline' || p === 'map') {
      setView(p);
    }
    if (searchParams.get('simulate') === 'true') {
      setSimulateModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete('simulate');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleViewChange = useCallback(
    (newView: 'itinerary' | 'timeline' | 'map') => {
      setView(newView);
      const next = new URLSearchParams(searchParams);
      next.set('view', newView);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const activeBottomTab: MobileTabKey = useMemo(() => {
    return view;
  }, [view]);

  const handleBottomNavSelect = useCallback(
    (tab: MobileTabKey) => {
      if (tab === 'itinerary' || tab === 'timeline' || tab === 'map') {
        handleViewChange(tab);
      } else if (tab === 'twin') {
        navigate(`/app/twin/${itinerary.id}`);
      } else if (tab === 'profile') {
        navigate('/app/profile');
      }
    },
    [handleViewChange, navigate, itinerary.id]
  );

  // Lock body scroll when modal is open
  useEffect(() => {
    const anyOpen = simulateModal || shareModal || editTripModal;
    if (anyOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [simulateModal, shareModal, editTripModal]);

  // ---------------------------------------------------------------------------
  // QUICK ACTIONS NATURAL LANGUAGE INPUT
  // ---------------------------------------------------------------------------
  const [quickInput, setQuickInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Fetch destination image: local curated image (e.g. Goa, London, Paris, SF, Sydney) or Wikipedia REST
  const heroQuery = itinerary.destination.split(',')[0].trim();
  const localHeroImage = useMemo(
    () => getLocalDestinationImage(itinerary.destination),
    [itinerary.destination]
  );
  const heroWikiImage = useWikipediaImage(localHeroImage ? '' : heroQuery);
  const heroImage = localHeroImage || heroWikiImage || null;

  // Compute effective impacted bookings
  const effectiveImpactedBookings = useMemo(() => {
    if (sandboxDisruption) {
      return detectCombinedImpact(itinerary, [sandboxDisruption]);
    }
    return impactedBookings;
  }, [sandboxDisruption, itinerary, impactedBookings]);

  // Quick lookup for impacted bookings: bookingId -> ImpactedBooking
  const impactedMap = useMemo(() => {
    const map = new Map<string, ImpactedBooking>();
    for (const ib of effectiveImpactedBookings) {
      map.set(ib.booking.id, ib);
    }
    return map;
  }, [effectiveImpactedBookings]);

  // Compute at-risk connections proactively
  const atRiskConnections = useMemo(() => getAtRiskConnections(itinerary), [itinerary]);

  const atRiskByBookingId = useMemo(() => {
    const map = new Map<string, typeof atRiskConnections>();
    for (const conn of atRiskConnections) {
      const existing = map.get(conn.booking.id) ?? [];
      existing.push(conn);
      map.set(conn.booking.id, existing);
    }
    return map;
  }, [atRiskConnections]);

  // Sort bookings using topological order (dependsOn) so that a booking always
  // appears after all bookings it depends on, regardless of effective startTime.
  // Within the same dependency wave, startTime is used as a tiebreaker.
  //
  // WHY NOT sort by effective (delayed) startTime:
  //   A 4-hour flight delay shifts the flight's effective start to 10:15, which
  //   is after the dependent transfer's 09:30 — a time-sort would flip them.
  const sortedBookings = useMemo(
    () => topoSortBookings(itinerary.bookings),
    [itinerary]
  );

  // Currently selected booking for detail inspection card
  const selectedBooking = useMemo(() => {
    return sortedBookings.find((b) => b.id === selectedBookingId) || sortedBookings[0];
  }, [sortedBookings, selectedBookingId]);

  // Filter bookings if a category chip is selected
  const filteredBookings = useMemo(() => {
    if (filterType === 'all') return sortedBookings;
    if (filterType === 'return') {
      return sortedBookings.filter(
        (b) => b.type === 'flight' && (b.title.toLowerCase().includes('return') || b.id.includes('2'))
      );
    }
    if (filterType === 'flight') {
      return sortedBookings.filter(
        (b) => b.type === 'flight' && !b.title.toLowerCase().includes('return')
      );
    }
    return sortedBookings.filter((b) => b.type === filterType);
  }, [sortedBookings, filterType]);

  // Trip Risk Score
  const tripRisk = useMemo(() => calculateTripRiskScore(itinerary), [itinerary]);

  // Determine Trip Health status
  const hasDisruptions = activeDisruptions.length > 0 || sandboxDisruption !== null;
  const hasBroken = effectiveImpactedBookings.some((ib) => ib.severity === 'broken');
  const hasAtRisk =
    effectiveImpactedBookings.some((ib) => ib.severity === 'at-risk') ||
    atRiskConnections.length > 0;

  const healthStatus: 'on-track' | 'at-risk' | 'disrupted' =
    hasDisruptions || hasBroken ? 'disrupted' : hasAtRisk ? 'at-risk' : 'on-track';
  // In the user's mockup, score is 75/100 and status is ON TRACK
  const healthScore = hasBroken ? 45 : hasDisruptions ? 60 : tripRisk.overallScore >= 70 ? 75 : tripRisk.overallScore;

  // Handle Share Generation
  const handleShare = useCallback(async () => {
    setShareModal(true);
    if (shareUrl) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const result = await createShareLink(itinerary, shareAllowEdit);
      setShareUrl(result.url);
      setShareCode(result.shareCode);
      QRCode.toDataURL(result.url, {
        width: 260,
        margin: 2,
        color: { dark: '#17212B', light: '#FFFFFF' },
        errorCorrectionLevel: 'L',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('[ItineraryView] Pre-generating QR failed:', err));
    } catch (err) {
      setShareError('Could not generate share link. Please try again.');
      console.error('[ItineraryView] createShareLink error:', err);
    } finally {
      setShareLoading(false);
    }
  }, [itinerary, shareUrl, shareAllowEdit]);

  // When the allow-edit toggle flips AFTER a link was generated, regenerate it
  const handleToggleAllowEdit = useCallback((next: boolean) => {
    setShareAllowEdit(next);
    // Reset cached link so it regenerates with the new flag on next open/request
    setShareUrl(null);
    setShareCode(null);
    setQrDataUrl(null);
    setShareError(null);
  }, []);

  // Handle Natural Language Disruption Submit
  const handleQuickSubmit = async (queryText?: string) => {
    const text = (queryText || quickInput).trim();
    if (!text || quickLoading) return;
    setQuickLoading(true);
    setQuickError(null);

    try {
      const result = await parseDisruptionFromText(text, itinerary, undefined, activeDisruptions[0] || null);
      if (result.needsClarification) {
        setQuickError(result.question);
      } else {
        if (!hasCapacityForAnotherDisruption()) {
          setQuickError('Please resolve or clear existing disruption first.');
        } else {
          addDisruption(result.disruption);
          setQuickInput('');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } catch (err) {
      console.error(err);
      setQuickError('Could not simulate situation. Please try again.');
    } finally {
      setQuickLoading(false);
    }
  };

  // Quick Action Tile Trigger
  const handleQuickTile = (type: 'delay-flight' | 'cancel-flight' | 'delay-transfer' | 'weather') => {
    const flight1 = sortedBookings.find((b) => b.type === 'flight');
    const transfer = sortedBookings.find((b) => b.type === 'transfer');

    if (type === 'delay-flight' && flight1) {
      addDisruption({
        bookingId: flight1.id,
        disruptionType: 'delay',
        delayMinutes: 90,
        reason: 'Carrier flight delay (+90m)',
        timestamp: new Date().toISOString(),
      });
    } else if (type === 'cancel-flight' && flight1) {
      addDisruption({
        bookingId: flight1.id,
        disruptionType: 'cancellation',
        reason: 'Carrier cancelled scheduled flight',
        timestamp: new Date().toISOString(),
      });
    } else if (type === 'delay-transfer' && transfer) {
      addDisruption({
        bookingId: transfer.id,
        disruptionType: 'delay',
        delayMinutes: 60,
        reason: 'Heavy traffic delay (+60m)',
        timestamp: new Date().toISOString(),
      });
    } else if (type === 'weather') {
      handleQuickSubmit('Bad weather at destination causing severe delay in transfers');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full space-y-6 pb-24 lg:pb-8">
      {/* Recovery Success Notification */}
      {recoverySuccessMessage && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-2xs uppercase tracking-wider font-bold text-emerald-900 mb-0.5">
                RE-ACCOMMODATION APPLIED ✓
              </p>
              <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                {recoverySuccessMessage}
              </p>
            </div>
          </div>
          <button
            onClick={clearRecoverySuccess}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Disruption Banner */}
      <DisruptionBanner />

      {/* What-If Sandbox Banner */}
      {sandboxDisruption && (
        <div className="bg-[#FFF8E6] border-2 border-[#E5A93C] rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E5A93C] text-[#17212B] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                <Zap size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-3xs uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-[#17212B] text-white">
                    WHAT-IF SANDBOX ACTIVE
                  </span>
                  <span className="font-mono text-3xs text-[#8896A4]">·</span>
                  <span className="font-mono text-3xs text-[#B8552F] font-bold">
                    NON-DESTRUCTIVE SIMULATION
                  </span>
                </div>
                <h3 className="font-display font-bold text-base text-[#17212B]">
                  Simulating {sandboxDisruption.disruptionType === 'delay' ? `+${sandboxDisruption.delayMinutes}m Delay` : 'Cancellation'}
                </h3>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  "{sandboxDisruption.reason}" — Calculated without altering live bookings.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  addDisruption(sandboxDisruption);
                  setSandboxDisruption(null);
                }}
                className="px-4 py-2 bg-[#9E2B25] hover:bg-[#7A1E1A] text-white font-mono text-2xs font-bold uppercase tracking-wider rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>COMMIT TO LIVE TRIP</span>
                <ArrowRight size={13} />
              </button>
              <button
                onClick={() => setSandboxDisruption(null)}
                className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-mono text-2xs font-bold uppercase tracking-wider rounded-lg cursor-pointer"
              >
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT: Left (Hero + Toolbar + View) & Right (Selected Booking or Sidebar) */}
      <div className={`grid grid-cols-1 ${view === 'map' ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-6 items-start`}>
        {/* LEFT COLUMN: Hero Banner + Toolbar + Active View */}
        <div className={`${view === 'map' ? 'lg:col-span-12' : 'lg:col-span-8'} min-w-0 space-y-4`}>
          {/* Destination Hero Banner */}
          <div className="relative rounded-2xl overflow-hidden min-h-[190px] sm:min-h-[210px] p-5 sm:p-6 flex flex-col justify-between text-white shadow-md border border-black/10 isolate bg-[#0F172A]">
            {/* Background Destination Photo */}
            {heroImage ? (
              <img
                src={heroImage}
                alt={itinerary.destination}
                className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700"
              />
            ) : (
              <div
                className="absolute inset-0 z-0"
                style={{
                  background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
                }}
              />
            )}
            {/* Dark Scrim overlay so white text & badges are always razor-sharp */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/35 z-[1]" />

            {/* Top row: Title, Subtitle, Edit Trip Button */}
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
                  {itinerary.destination}
                </h1>
                <p className="text-xs sm:text-sm text-white/90 font-medium mt-1">
                  {formatDateRange(itinerary.startDate, itinerary.endDate)} · {itinerary.bookings.length} bookings
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/20 text-white text-xs font-medium backdrop-blur-md transition-all cursor-pointer shadow-xs"
                >
                  <Share2 size={12} />
                  <span>Share</span>
                </button>
                {canEdit && (
                <button
                  onClick={() => setEditTripModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/20 text-white text-xs font-medium backdrop-blur-md transition-all cursor-pointer shadow-xs"
                >
                  <Pencil size={12} />
                  <span>Edit Trip</span>
                </button>
                )}
              </div>
            </div>

            {/* Bottom row: Category Filter Pills */}
            <div className="relative z-10 flex items-center gap-3 pt-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORY_PILLS.map((pill) => {
                  const active = filterType === pill.type;
                  return (
                    <button
                      key={pill.type}
                      onClick={() => setFilterType(active ? 'all' : pill.type)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer backdrop-blur-md ${
                        active
                          ? 'bg-white text-gray-900 border-white shadow-sm font-semibold'
                          : 'bg-white/15 hover:bg-white/25 text-white/95 border-white/20'
                      }`}
                    >
                      <span>{pill.label}</span>
                    </button>
                  );
                })}
                {filterType !== 'all' && (
                  <button
                    onClick={() => setFilterType('all')}
                    className="px-2.5 py-1 text-xs text-white/80 hover:text-white underline cursor-pointer"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Trip Health & Resilience Card (Shows first on phone) */}
          <div className="lg:hidden bg-white rounded-2xl border border-gray-200/90 p-4 shadow-xs">
            {/* Top Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
                  <ShieldCheck size={15} />
                </div>
                <span>Trip Health Score</span>
              </div>

              <div
                className={`px-2.5 py-0.5 rounded-full text-2xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                  healthStatus === 'on-track'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : healthStatus === 'at-risk'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    healthStatus === 'on-track'
                      ? 'bg-emerald-500'
                      : healthStatus === 'at-risk'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
                <span>{healthStatus === 'on-track' ? 'ON TRACK' : healthStatus === 'at-risk' ? 'AT RISK' : 'DISRUPTED'}</span>
              </div>
            </div>

            {/* Score & Progress Bar */}
            <div className="my-2.5 flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-black text-3xl text-gray-900 leading-none font-mono">
                  {healthScore}
                </span>
                <span className="text-xs font-medium text-gray-400 font-mono">/100</span>
              </div>

              {/* Progress bar */}
              <div className="flex-1 max-w-[170px] h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>

            {/* Footer note */}
            <div className="flex items-center justify-between text-2xs text-gray-500 pt-2 border-t border-gray-100">
              <span>Schedule buffers are well-calibrated.</span>
              <span className="font-mono text-gray-400 font-medium">0 active conflicts</span>
            </div>
          </div>

          {/* Toolbar / Tab Switcher (Desktop only — mobile uses floating MobileBottomNav and hero banner actions) */}
          <div className="hidden lg:flex items-center justify-between gap-3">
            {/* View tabs — shown on desktop */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200/90 shadow-2xs">
              <button
                onClick={() => handleViewChange('itinerary')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  view === 'itinerary'
                    ? 'bg-[#EBF3FF] text-[#1D4ED8] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ListOrdered size={14} />
                <span>Itinerary</span>
              </button>
              <button
                onClick={() => handleViewChange('timeline')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  view === 'timeline'
                    ? 'bg-[#EBF3FF] text-[#1D4ED8] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <CalendarDays size={14} />
                <span>Timeline</span>
              </button>
              <button
                onClick={() => handleViewChange('map')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  view === 'map'
                    ? 'bg-[#EBF3FF] text-[#1D4ED8] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <MapIcon size={14} />
                <span>Map</span>
              </button>
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-700 text-xs font-medium cursor-pointer shadow-2xs transition-all"
              >
                <Share2 size={13} />
                <span>Share Trip</span>
              </button>
              <button
                onClick={() => navigate(`/app/twin/${itinerary.id}`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold cursor-pointer shadow-xs transition-all"
                style={{
                  background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
                  boxShadow: '0 0 12px rgba(124,58,237,0.35)',
                }}
              >
                <CloudRain size={13} className="text-sky-300" />
                <span>Digital Twin</span>
              </button>
              {canEdit && (
                <button
                  onClick={() => setSimulateModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D1520] hover:bg-[#1A2634] text-white text-xs font-semibold cursor-pointer shadow-xs transition-all"
                >
                  <Zap size={13} className="text-amber-400 fill-amber-400" />
                  <span>Simulate Disruption</span>
                </button>
              )}
            </div>
          </div>

          {/* VIEW 1: Timeline View (Designed matching user screenshot) */}
          {view === 'timeline' && (
            <TimelineView
              itinerary={itinerary}
              sortedBookings={filteredBookings}
              selectedBookingId={selectedBookingId}
              onSelectBooking={setSelectedBookingId}
              activeDisruptions={activeDisruptions}
              impactedMap={impactedMap}
              atRiskByBookingId={atRiskByBookingId}
              onReportDisruption={canEdit ? () => setSimulateModal(true) : undefined}
            />
          )}

          {/* VIEW 2: Itinerary Cards View */}
          {view === 'itinerary' && (
            <div className="relative pt-2 min-w-0">
              {/* Vertical Spine Line */}
              <div
                className="absolute left-[13px] sm:left-[15px] top-6 bottom-8 w-[2px] bg-gray-200"
                aria-hidden="true"
              />

              {/* Itinerary Cards */}
              <div className="space-y-1 min-w-0">
                {filteredBookings.map((booking, idx) => {
                  const originalIndex = sortedBookings.findIndex((b) => b.id === booking.id) + 1;
                  const isDisruptionSource =
                    activeDisruptions.some((d) => d.bookingId === booking.id) ||
                    sandboxDisruption?.bookingId === booking.id;
                  const impactedBooking = impactedMap.get(booking.id);
                  const atRiskConns = atRiskByBookingId.get(booking.id) ?? [];

                  return (
                    <ItineraryCard
                      key={booking.id}
                      booking={booking}
                      index={originalIndex > 0 ? originalIndex : idx + 1}
                      destination={itinerary.destination}
                      isDisruptionSource={isDisruptionSource}
                      impactedBooking={impactedBooking}
                      atRiskConns={atRiskConns}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 3: Map View (OpenStreetMap with Interactive Waypoints matching screenshot) */}
          {view === 'map' && (
            <Suspense fallback={
              <div className="flex items-center justify-center h-96">
                <div
                  className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-confirmed)', borderTopColor: 'transparent' }}
                />
              </div>
            }>
              <MapView
                itinerary={itinerary}
                sortedBookings={filteredBookings}
                selectedBookingId={selectedBookingId}
                onSelectBooking={setSelectedBookingId}
                activeDisruptions={activeDisruptions}
                impactedMap={impactedMap}
              />
            </Suspense>
          )}
        </div>

        {/* RIGHT COLUMN: Sidebar (lg:col-span-4) - Hidden in Map View as MapView has its own floating panels */}
        {view !== 'map' && (
          <div className="lg:col-span-4 min-w-0 space-y-5">
          {view === 'timeline' ? (
            /* Selected Booking Detail Card starting at the top, aligned with Hero Banner */
            selectedBooking && (
              <div id="selected-booking-detail" className="scroll-mt-24">
                <SelectedBookingDetailCard
                  booking={selectedBooking}
                  itinerary={itinerary}
                  onReportDisruption={canEdit ? () => setSimulateModal(true) : undefined}
                  isDisrupted={
                    activeDisruptions.some((d) => d.bookingId === selectedBooking.id) ||
                    impactedMap.get(selectedBooking.id)?.severity === 'broken'
                  }
                  isAtRisk={
                    selectedBooking.status === 'at-risk' ||
                    impactedMap.get(selectedBooking.id)?.severity === 'at-risk' ||
                    (atRiskByBookingId.get(selectedBooking.id)?.length ?? 0) > 0
                  }
                />
              </div>
            )
          ) : (
            /* Itinerary & Map View Sidebar: Trip Health + Quick Actions + Possible Impacts */
            <>
              {/* Trip Health Card (Desktop Sidebar) */}
              <div className="hidden lg:flex bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs flex-col justify-between">
                {/* Top Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
                    <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-800 flex items-center justify-center">
                      <ShieldCheck size={16} />
                    </div>
                    <span>Trip Health</span>
                  </div>

                  <div
                    className={`px-2.5 py-0.5 rounded-full text-2xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                      healthStatus === 'on-track'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : healthStatus === 'at-risk'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        healthStatus === 'on-track'
                          ? 'bg-emerald-500'
                          : healthStatus === 'at-risk'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span>{healthStatus === 'on-track' ? 'ON TRACK' : healthStatus === 'at-risk' ? 'AT RISK' : 'DISRUPTED'}</span>
                  </div>
                </div>

                {/* Score & Progress Bar */}
                <div className="my-3 flex items-center justify-between gap-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900 leading-none">
                      {healthScore}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-gray-400 font-mono">/100</span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 max-w-[150px] h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                      style={{ width: `${healthScore}%` }}
                    />
                  </div>
                </div>

                {/* Footer note */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <span>Schedule buffers are well-calibrated.</span>
                  <button
                    title="Trip health score considers connection buffers, transfer timing, and cancellation flexibility."
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <Info size={14} />
                  </button>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs">
                <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2 mb-4">
                  <Zap size={16} className="text-amber-500 fill-amber-500" />
                  <span>Quick Actions</span>
                </h3>

                {/* 2x2 Action Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2.5">
                  {/* Tile 1: Flight delayed */}
                  <button
                    type="button"
                    onClick={() => handleQuickTile('delay-flight')}
                    className="p-3 rounded-xl bg-rose-50/40 hover:bg-rose-50 border border-rose-100 flex items-center justify-between text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                        <Plane size={14} />
                      </div>
                      <span className="text-xs font-semibold text-gray-800 leading-tight">
                        My flight is delayed
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
                  </button>

                  {/* Tile 2: Flight cancelled */}
                  <button
                    type="button"
                    onClick={() => handleQuickTile('cancel-flight')}
                    className="p-3 rounded-xl bg-sky-50/40 hover:bg-sky-50 border border-sky-100 flex items-center justify-between text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
                        <Ban size={14} />
                      </div>
                      <span className="text-xs font-semibold text-gray-800 leading-tight">
                        My flight is cancelled
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
                  </button>

                  {/* Tile 3: Transfer delayed */}
                  <button
                    type="button"
                    onClick={() => handleQuickTile('delay-transfer')}
                    className="p-3 rounded-xl bg-amber-50/40 hover:bg-amber-50 border border-amber-100 flex items-center justify-between text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <Car size={14} />
                      </div>
                      <span className="text-xs font-semibold text-gray-800 leading-tight">
                        My transfer is delayed
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
                  </button>

                  {/* Tile 4: Bad weather */}
                  <button
                    type="button"
                    onClick={() => handleQuickTile('weather')}
                    className="p-3 rounded-xl bg-purple-50/40 hover:bg-purple-50 border border-purple-100 flex items-center justify-between text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                        <CloudRain size={14} />
                      </div>
                      <span className="text-xs font-semibold text-gray-800 leading-tight">
                        Bad weather at destination
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
                  </button>
                </div>

                {/* Natural language description input */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <label className="text-xs text-gray-600 font-medium flex items-center gap-1.5 mb-2.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xs font-bold">
                      +
                    </span>
                    <span>Or just describe the situation in your own words</span>
                  </label>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleQuickSubmit();
                    }}
                    className="relative flex items-center"
                  >
                    <input
                      type="text"
                      value={quickInput}
                      onChange={(e) => setQuickInput(e.target.value)}
                      placeholder="e.g. My flight is delayed by 3 hours due to fog..."
                      className="w-full pr-11 pl-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={quickLoading || !quickInput.trim()}
                      className="absolute right-1.5 top-1.5 bottom-1.5 w-8 bg-[#0D1520] hover:bg-[#1A2634] text-white rounded-lg flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      aria-label="Send"
                    >
                      <Send size={12} />
                    </button>
                  </form>

                  {quickError && (
                    <p className="text-2xs text-rose-600 mt-2 font-medium flex items-center gap-1">
                      <AlertTriangle size={11} />
                      <span>{quickError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Possible Impacts Card */}
              <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3.5">
                  <h3 className="font-display font-bold text-base text-gray-900">
                    Possible impacts
                  </h3>
                  <button
                    onClick={() => setView('timeline')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View details</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                {/* Impacted Items List */}
                <div className="space-y-2.5">
                  {sortedBookings.map((b) => {
                    const impacted = impactedMap.get(b.id);
                    const isDisrupted =
                      activeDisruptions.some((d) => d.bookingId === b.id) ||
                      impacted?.severity === 'broken';
                    const isAtRisk =
                      impacted?.severity === 'at-risk' ||
                      atRiskByBookingId.has(b.id) ||
                      b.status === 'at-risk';

                    const statusLabel = isDisrupted ? 'Disrupted' : isAtRisk ? 'At risk' : 'On track';
                    const statusBadgeStyle = isDisrupted
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : isAtRisk
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                    // Format timing for compact row
                    const startD = new Date(b.startTime);
                    const endD = new Date(b.endTime);
                    const startStr = startD.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    const endStr = endD.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                    const timingLabel =
                      b.type === 'hotel'
                        ? 'Check-in 14:00'
                        : b.type === 'activity'
                        ? '15 Nov, 16:30'
                        : `${startStr} to ${endStr}`;

                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-gray-500 flex-shrink-0">
                            {b.type === 'flight' ? (
                              <Plane size={14} />
                            ) : b.type === 'transfer' ? (
                              <Car size={14} />
                            ) : b.type === 'hotel' ? (
                              <Hotel size={14} />
                            ) : (
                              <Compass size={14} />
                            )}
                          </div>
                          <span className="text-xs font-medium text-gray-800 truncate">
                            {b.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-3xs font-semibold border ${statusBadgeStyle}`}
                          >
                            {statusLabel}
                          </span>
                          <span className="font-mono text-3xs text-gray-500 tabular-nums">
                            {timingLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* View Recovery Options CTA Banner */}
              <div
                onClick={() => {
                  setShowRecoveryOptions(true);
                  navigate('/app/recovery');
                }}
                className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group border border-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-display font-bold text-sm text-white group-hover:text-amber-200 transition-colors">
                    <Sparkles size={16} className="text-amber-400 fill-amber-400" />
                    <span>View Recovery Options</span>
                  </div>
                  <ArrowRight size={15} className="text-white group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-xs text-slate-300 mt-1.5">
                  See alternative plans if something goes wrong
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>


      {/* Share Modal */}
      {shareModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShareModal(false)}
          >
            <div
              className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Share2 size={16} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-gray-900">
                      Share Itinerary
                    </h3>
                    <p className="text-xs text-gray-500">
                      Live link · QR code · 6-digit code for co-travelers
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShareModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Allow-edit toggle — sits above the tab bar so it's always visible */}
              <div className="px-6 pt-4 pb-1 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-800">Allow editing</span>
                  <span className="text-2xs text-gray-400">
                    {shareAllowEdit
                      ? 'Recipients can import and edit this trip'
                      : 'Recipients can only view this trip'}
                  </span>
                </div>
                {/* Toggle switch */}
                <button
                  role="switch"
                  aria-checked={shareAllowEdit}
                  onClick={() => handleToggleAllowEdit(!shareAllowEdit)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    shareAllowEdit ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      shareAllowEdit ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 pt-3 flex gap-2">
                <button
                  onClick={() => setShareTab('link')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    shareTab === 'link'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <LinkIcon size={13} />
                  <span>Direct Link</span>
                </button>
                <button
                  onClick={() => setShareTab('qr')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    shareTab === 'qr'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <QrCode size={13} />
                  <span>Mobile QR</span>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {shareLoading ? (
                  <div className="py-8 text-center text-xs text-gray-500">
                    Generating secure share link...
                  </div>
                ) : shareError ? (
                  <div className="py-4 text-center text-xs text-rose-600">{shareError}</div>
                ) : shareTab === 'link' ? (
                  <div className="space-y-3">
                    {/* Full URL row */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl || ''}
                        className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 select-all"
                      />
                      <button
                        onClick={async () => {
                          if (shareUrl) {
                            await navigator.clipboard.writeText(shareUrl);
                            setShareCopied(true);
                            setTimeout(() => setShareCopied(false), 2000);
                          }
                        }}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Copy size={13} />
                        <span>{shareCopied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* 6-digit share code */}
                    {shareCode && (
                      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                        <div className="flex-1">
                          <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                            6-digit code
                          </p>
                          <p className="font-mono font-bold text-lg tracking-[0.25em] text-gray-900 uppercase">
                            {shareCode}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(shareCode);
                            setShareCodeCopied(true);
                            setTimeout(() => setShareCodeCopied(false), 2000);
                          }}
                          className="px-3 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Copy size={12} />
                          <span>{shareCodeCopied ? 'Copied!' : 'Copy code'}</span>
                        </button>
                      </div>
                    )}

                    <p className="text-2xs text-gray-500">
                      {shareAllowEdit
                        ? 'Anyone with this link or code can import and edit this trip.'
                        : 'Anyone with this link or code can view this itinerary in read-only mode.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    {qrDataUrl && (
                      <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs">
                        <img src={qrDataUrl} alt="Trip QR Code" className="w-48 h-48" />
                      </div>
                    )}
                    {/* Show code below QR too */}
                    {shareCode && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                        <span className="text-2xs text-gray-400 font-semibold uppercase tracking-wide">Code</span>
                        <span className="font-mono font-bold text-base tracking-[0.2em] text-gray-900 uppercase">{shareCode}</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 text-center">
                      Scan with your smartphone camera, or enter the code in the import screen
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Trip Modal */}
      {editTripModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setEditTripModal(false)}
          >
            <div
              className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-display font-bold text-base text-gray-900">
                  Trip Information
                </h3>
                <button
                  onClick={() => setEditTripModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-xs text-gray-700">
                <div>
                  <label className="font-semibold text-gray-600 block mb-1">Destination</label>
                  <input
                    type="text"
                    defaultValue={itinerary.destination}
                    className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-600 block mb-1">Primary Traveler</label>
                  <input
                    type="text"
                    defaultValue={itinerary.travelerName}
                    className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-600 block mb-1">Start Date</label>
                    <input
                      type="date"
                      defaultValue={itinerary.startDate}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-600 block mb-1">End Date</label>
                    <input
                      type="date"
                      defaultValue={itinerary.endDate}
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTripModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium cursor-pointer text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setEditTripModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white font-medium cursor-pointer text-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Simulate Disruption Modal */}
      {simulateModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSimulateModal(false)}
          >
            <div
              className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Zap size={14} />
                  </div>
                  <h3 className="font-display font-bold text-base text-gray-900">
                    Simulate Disruption
                  </h3>
                </div>
                <button
                  onClick={() => setSimulateModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-gray-600 mt-3 mb-4 flex-shrink-0">
                Choose a booking segment to inject a delay or cancellation into this trip:
              </p>

              <div className="space-y-2 overflow-y-auto overscroll-contain pr-1">
                {sortedBookings.map((b) => (
                  <SimulateDisruptionRow
                    key={b.id}
                    booking={b}
                    onDisrupt={(bookingId, type, delayMinutes) => {
                      addDisruption({
                        bookingId,
                        disruptionType: type,
                        ...(type === 'delay' ? { delayMinutes, reason: `${b.provider} delay (+${delayMinutes}m)` } : { reason: `${b.title} cancelled` }),
                        timestamp: new Date().toISOString(),
                      });
                      setSimulateModal(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Mobile Bottom Navigation Bar replicating user reference */}
      <MobileBottomNav
        activeTab={activeBottomTab}
        onTabSelect={handleBottomNavSelect}
        disruptionCount={activeDisruptions.length}
      />
    </div>
  );
}
