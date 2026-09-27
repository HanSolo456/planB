// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: SharedTripView.tsx
// PURPOSE: Public, read-only view of a shared itinerary.
//   Loads the trip by share token from Supabase (or decodes the inline
//   base64 guest token). Renders a stripped-down page — no disruption
//   controls, no import/auth actions — just the itinerary manifest.
//   Accessible to anyone with the link, no login required.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedTrip } from '../lib/cloudTripStorage';
import type { Itinerary } from '../lib/types';
import {
  MapPin, Calendar, Layers, ArrowRight, AlertCircle, Clock,
  ExternalLink, CheckCircle2, Download, Pencil,
} from 'lucide-react';
import PlanBLogo from './PlanBLogo';

// ---------------------------------------------------------------------------
// Minimal booking row for the read-only view
// ---------------------------------------------------------------------------
const TYPE_LABELS: Record<string, string> = {
  flight: 'FLIGHT',
  train: 'TRAIN',
  hotel: 'HOTEL',
  transfer: 'TRANSFER',
  activity: 'ACTIVITY',
  event: 'EVENT',
};

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string; label: string }> = {
  confirmed:  { color: 'var(--color-confirmed)',  bg: 'var(--color-confirmed-bg)',  border: 'var(--color-confirmed-border)',  label: 'CONFIRMED' },
  'at-risk':  { color: 'var(--color-at-risk)',    bg: 'var(--color-at-risk-bg)',    border: 'var(--color-at-risk-border)',    label: 'AT RISK' },
  disrupted:  { color: 'var(--color-disrupted)',  bg: 'var(--color-disrupted-bg)',  border: 'var(--color-disrupted-border)',  label: 'DISRUPTED' },
  recovered:  { color: 'var(--color-confirmed)',  bg: 'var(--color-confirmed-bg)',  border: 'var(--color-confirmed-border)',  label: 'RECOVERED' },
  cancelled:  { color: '#4A5568',                 bg: '#F5F3EF',                    border: '#DEDAD2',                        label: 'CANCELLED' },
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function BookingRow({ booking, index, total }: { booking: Itinerary['bookings'][number]; index: number; total: number }) {
  const status = STATUS_STYLES[booking.status] ?? STATUS_STYLES.confirmed;
  const typeLabel = TYPE_LABELS[booking.type] ?? booking.type.toUpperCase();
  const location = booking.location.type === 'named'
    ? booking.location.name
    : booking.location.label ?? `${booking.location.lat.toFixed(2)}, ${booking.location.lng.toFixed(2)}`;

  return (
    <div
      className="rounded-[2px] border bg-white overflow-hidden"
      style={{ borderColor: 'var(--color-border)', borderLeftWidth: '3px', borderLeftColor: status.color }}
    >
      {/* Header strip */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ backgroundColor: 'var(--color-bg-surface-alt)', borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs font-bold text-[#4A5568]">
            LEG {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <span className="font-mono text-2xs text-[#8896A4]">·</span>
          <span className="font-mono text-2xs font-semibold text-[#4A5568] uppercase tracking-widest">
            {typeLabel}
          </span>
          <span className="font-mono text-2xs text-[#8896A4] hidden sm:inline">·</span>
          <span className="font-mono text-2xs text-[#8896A4] hidden sm:inline">{booking.provider}</span>
        </div>
        <span
          className="font-mono text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] border"
          style={{ color: status.color, backgroundColor: status.bg, borderColor: status.border }}
        >
          {status.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display font-bold text-base text-[#17212B] leading-tight">{booking.title}</h3>
          <div className="flex items-center gap-1 text-xs text-[#8896A4] flex-shrink-0">
            <MapPin size={11} />
            <span className="font-mono text-2xs">{location}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-2xs">
          <div className="bg-[#F7F4EE] border border-[#EBE7DF] rounded-[2px] px-2.5 py-1.5">
            <p className="text-[#8896A4] uppercase font-semibold mb-0.5">
              {booking.type === 'hotel' ? 'CHECK-IN' : booking.type === 'transfer' ? 'PICKUP' : 'DEPARTURE'}
            </p>
            <p className="text-[#17212B] font-semibold text-xs">{formatDateTime(booking.startTime)}</p>
          </div>
          <div className="bg-[#F7F4EE] border border-[#EBE7DF] rounded-[2px] px-2.5 py-1.5">
            <p className="text-[#8896A4] uppercase font-semibold mb-0.5">
              {booking.type === 'hotel' ? 'CHECK-OUT' : booking.type === 'transfer' ? 'DROP-OFF' : 'ARRIVAL'}
            </p>
            <p className="text-[#17212B] font-semibold text-xs">{formatDateTime(booking.endTime)}</p>
          </div>
          <div className="bg-[#F7F4EE] border border-[#EBE7DF] rounded-[2px] px-2.5 py-1.5">
            <p className="text-[#8896A4] uppercase font-semibold mb-0.5">COST</p>
            <p className="text-[#17212B] font-semibold text-xs">₹{booking.cost.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-[#F7F4EE] border border-[#EBE7DF] rounded-[2px] px-2.5 py-1.5">
            <p className="text-[#8896A4] uppercase font-semibold mb-0.5">BUFFER</p>
            <p className="text-[#17212B] font-semibold text-xs">
              {booking.bufferMinutes > 0 ? `${booking.bufferMinutes} min` : '—'}
            </p>
          </div>
        </div>

        {booking.meta && Object.keys(booking.meta).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {Object.entries(booking.meta).map(([k, v]) => (
              <span
                key={k}
                className="font-mono text-2xs px-1.5 py-0.5 rounded-[2px] border"
                style={{ backgroundColor: '#F5F3EF', borderColor: '#DEDAD2', color: '#4A5568' }}
              >
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SharedTripView
// ---------------------------------------------------------------------------
export default function SharedTripView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [allowEdit, setAllowEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareToken) {
      setError('Invalid share link.');
      setLoading(false);
      return;
    }
    getSharedTrip(shareToken)
      .then((res) => {
        if (!res) {
          setError('This share link is invalid or has expired.');
        } else {
          setItinerary(res.itinerary);
          setAllowEdit(res.allowEdit);
        }
      })
      .catch(() => setError('Failed to load the shared itinerary. Please try again.'))
      .finally(() => setLoading(false));
  }, [shareToken]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — silently ignore
    }
  };

  /** Navigate to the import screen pre-loaded with the current share URL so the
   *  user can import the trip (with or without editing rights). */
  const handleImportTrip = useCallback(() => {
    // Pass the share token as a query param — ImportView can pick it up
    // to pre-fill the scan modal, or we just drop them at import with the
    // share link pre-populated.  For now we navigate to /app/import and
    // let the user paste the URL; a future enhancement could deep-link into
    // the ScanTripModal automatically.
    navigate('/app/import');
  }, [navigate]);

  const totalCost = itinerary
    ? itinerary.bookings.reduce((s, b) => s + b.cost, 0)
    : 0;

  const sortedBookings = itinerary
    ? [...itinerary.bookings].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
    : [];

  return (
    <div
      className="min-h-screen font-body antialiased"
      style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-main)' }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur-sm"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/')}
            className="cursor-pointer focus:outline-none"
            aria-label="Go to planB home"
          >
            <PlanBLogo size={28} />
          </button>

          <div className="flex items-center gap-2 font-mono text-2xs text-[#8896A4] min-w-0">
            <span className="uppercase tracking-widest font-semibold">SHARED ITINERARY</span>
            {itinerary && (
              <>
                <span className="text-[#DEDAD2]">·</span>
                <span className="truncate text-[#4A5568] font-semibold">{itinerary.destination}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: copied ? 'var(--color-confirmed-bg)' : 'var(--color-bg-surface-alt)',
                borderColor: copied ? 'var(--color-confirmed-border)' : 'var(--color-border)',
                color: copied ? 'var(--color-confirmed)' : 'var(--color-text-muted)',
              }}
            >
              {copied ? <CheckCircle2 size={12} /> : <ExternalLink size={12} />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy link'}</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--color-confirmed)', color: '#FFFFFF' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0c8578')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed)')}
            >
              <ExternalLink size={12} />
              <span>Try planB</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--color-confirmed)', borderTopColor: 'transparent' }}
            />
            <p className="font-mono text-xs uppercase tracking-wider text-[#4A5568]">
              Loading shared itinerary…
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="flex flex-col items-center gap-4 py-24 text-center"
          >
            <AlertCircle size={32} style={{ color: 'var(--color-disrupted)' }} />
            <p className="font-mono text-xs uppercase tracking-widest text-[#4A5568]">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="font-mono text-xs font-semibold underline cursor-pointer"
              style={{ color: 'var(--color-confirmed)' }}
            >
              ← Go to planB
            </button>
          </div>
        )}

        {/* Itinerary */}
        {!loading && itinerary && (
          <>
            {/* Manifest header card */}
            <div
              className="rounded-[2px] border p-5 bg-white"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-mono text-2xs uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-[2px] bg-[#EFECE6] text-[#17212B] border border-[#DEDAD2]">
                      SHARED MANIFEST
                    </span>
                    <span className="font-mono text-2xs text-[#8896A4] font-semibold">
                      REF: {itinerary.id.toUpperCase()}
                    </span>
                  </div>
                  <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#17212B] tracking-tight">
                    {itinerary.destination}
                  </h1>
                  <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-xs text-[#4A5568] font-body">
                    <span>
                      Traveler:{' '}
                      <span className="font-semibold text-[#17212B]">{itinerary.travelerName}</span>
                    </span>
                    <span className="mx-2 text-[#DEDAD2] hidden sm:inline">|</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} className="text-[#8896A4]" />
                      <span className="font-mono text-2xs">
                        {formatDateOnly(itinerary.startDate)}{' '}
                        <ArrowRight size={10} className="inline" />{' '}
                        {formatDateOnly(itinerary.endDate)}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 font-mono text-left flex-shrink-0">
                  <div className="bg-[#F7F4EE] border border-[#EBE7DF] rounded-[2px] px-3 py-2 min-w-[90px]">
                    <p className="text-2xs text-[#8896A4] uppercase font-semibold mb-0.5">SEGMENTS</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-[#17212B]">{itinerary.bookings.length}</span>
                      <span className="text-3xs text-[#8896A4]">LEGS</span>
                    </div>
                  </div>
                  <div className="bg-[#F7F4EE] border border-[#EBE7DF] rounded-[2px] px-3 py-2 min-w-[90px]">
                    <p className="text-2xs text-[#8896A4] uppercase font-semibold mb-0.5">TOTAL FARE</p>
                    <span className="text-base font-bold text-[#17212B]">
                      ₹{totalCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Permission notice — content depends on allowEdit */}
            <div
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-[2px] border font-mono text-2xs"
              style={
                allowEdit
                  ? { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D4ED8' }
                  : { backgroundColor: 'var(--color-confirmed-bg)', borderColor: 'var(--color-confirmed-border)', color: 'var(--color-confirmed)' }
              }
            >
              {allowEdit ? (
                <>
                  <Pencil size={13} className="flex-shrink-0" />
                  <span>
                    <strong>Editing allowed</strong> · The owner has given you permission to import and edit this trip.{' '}
                    <button
                      onClick={handleImportTrip}
                      className="underline cursor-pointer font-semibold"
                    >
                      Import it now
                    </button>
                    {' '}to add it to your trips.
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} className="flex-shrink-0" />
                  <span>
                    <strong>Read-only view</strong> · This itinerary was shared with you.{' '}
                    <button
                      onClick={() => navigate('/login')}
                      className="underline cursor-pointer font-semibold"
                    >
                      Sign up for planB
                    </button>{' '}
                    to manage your own trips and get disruption alerts.
                  </span>
                </>
              )}
            </div>

            {/* Timeline: booking rows */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-2xs uppercase tracking-wider text-[#4A5568] font-semibold flex items-center gap-1.5">
                  <Layers size={11} />
                  ITINERARY · {sortedBookings.length} SEGMENTS
                </p>
                <p className="font-mono text-2xs text-[#8896A4] flex items-center gap-1">
                  <Clock size={11} />
                  CHRONOLOGICAL
                </p>
              </div>

              <div className="relative pl-6 sm:pl-8">
                {/* Timeline spine */}
                <div
                  className="absolute left-2.5 sm:left-3.5 top-3 bottom-8 w-[1px] bg-[#DEDAD2]"
                  aria-hidden="true"
                />
                <div className="space-y-5">
                  {sortedBookings.map((booking, idx) => (
                    <div key={booking.id} className="relative">
                      {/* Diamond node */}
                      <div
                        className="absolute -left-[19px] sm:-left-[23px] top-6 w-2.5 h-2.5 rotate-45 border z-10"
                        style={{ backgroundColor: 'var(--color-confirmed)', borderColor: '#FFFFFF' }}
                      />
                      <BookingRow booking={booking} index={idx + 1} total={sortedBookings.length} />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* CTA footer */}
            <div
              className="rounded-[2px] border p-5 text-center space-y-3"
              style={{ backgroundColor: 'var(--color-bg-surface-alt)', borderColor: 'var(--color-border)' }}
            >
              {allowEdit ? (
                <>
                  <p className="font-display font-bold text-lg text-[#17212B]">
                    Ready to make this trip yours?
                  </p>
                  <p className="font-body text-sm text-[#4A5568] max-w-[52ch] mx-auto">
                    The owner has allowed editing. Import this trip into planB to track it, simulate disruptions, and get real-time recovery options.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={handleImportTrip}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-semibold cursor-pointer transition-colors"
                      style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e40af')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1D4ED8')}
                    >
                      <Download size={14} />
                      Import &amp; edit this trip
                    </button>
                    <button
                      onClick={() => navigate('/login')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-semibold cursor-pointer transition-colors border"
                      style={{ backgroundColor: 'transparent', color: 'var(--color-confirmed)', borderColor: 'var(--color-confirmed-border)' }}
                    >
                      Get started free
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-display font-bold text-lg text-[#17212B]">
                    Want disruption protection for your trips?
                  </p>
                  <p className="font-body text-sm text-[#4A5568] max-w-[52ch] mx-auto">
                    planB monitors your itinerary in real time and surfaces recovery options the moment something goes wrong.
                  </p>
                  <button
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-semibold cursor-pointer transition-colors"
                    style={{ backgroundColor: 'var(--color-confirmed)', color: '#FFFFFF' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0c8578')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed)')}
                  >
                    Get started free
                    <ArrowRight size={14} />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
