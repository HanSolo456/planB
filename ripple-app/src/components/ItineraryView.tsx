import { useMemo, useEffect } from 'react';
import type { Itinerary, Booking, AtRiskConnection, ImpactedBooking } from '../lib/types';
import { getAtRiskConnections } from '../lib/impactEngine';
import { useAppState } from '../App';
import BookingCard from './BookingCard';
import DisruptionBanner from './DisruptionBanner';
import DisruptionAssistant from './DisruptionAssistant';
import TripRiskBadge from './TripRiskBadge';
import { calculateTripRiskScore } from '../lib/impactEngine';
import { Clock, CheckCircle2, X } from 'lucide-react';

interface Props {
  itinerary: Itinerary;
}

export default function ItineraryView({ itinerary }: Props) {
  const { activeDisruption, impactedBookings, recoverySuccessMessage, clearRecoverySuccess } = useAppState();

  // Auto-dismiss success toast after 6 seconds
  useEffect(() => {
    if (!recoverySuccessMessage) return;
    const t = setTimeout(clearRecoverySuccess, 6000);
    return () => clearTimeout(t);
  }, [recoverySuccessMessage, clearRecoverySuccess]);

  // Sort bookings chronologically
  const sortedBookings = useMemo(
    () =>
      [...itinerary.bookings].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    [itinerary]
  );

  // Quick lookup for impacted bookings: bookingId -> ImpactedBooking
  const impactedMap = useMemo(() => {
    const map = new Map<string, ImpactedBooking>();
    for (const ib of impactedBookings) {
      map.set(ib.booking.id, ib);
    }
    return map;
  }, [impactedBookings]);

  // Compute at-risk connections proactively (no disruption)
  const atRiskConnections = useMemo(() => getAtRiskConnections(itinerary), [itinerary]);

  // Build a quick-lookup: bookingId → AtRiskConnection[]
  const atRiskByBookingId = useMemo(() => {
    const map = new Map<string, AtRiskConnection[]>();
    for (const conn of atRiskConnections) {
      const existing = map.get(conn.booking.id) ?? [];
      existing.push(conn);
      map.set(conn.booking.id, existing);
    }
    return map;
  }, [atRiskConnections]);

  // Build dependency map for visual connection lines
  const bookingMap = useMemo(() => {
    return new Map(itinerary.bookings.map((b) => [b.id, b]));
  }, [itinerary]);

  // Total cost
  const totalCost = useMemo(
    () => itinerary.bookings.reduce((sum, b) => sum + b.cost, 0),
    [itinerary]
  );

  // Overall Trip Risk Score
  const tripRisk = useMemo(() => calculateTripRiskScore(itinerary), [itinerary]);

  return (
    <div>
      {/* Recovery Success Toast */}
      {recoverySuccessMessage && (
        <div
          className="p-3.5 mb-5 rounded-[2px] border flex items-start justify-between gap-3 animate-slide-down"
          style={{
            backgroundColor: 'var(--color-confirmed-bg)',
            borderColor: 'var(--color-confirmed-border)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              size={16}
              className="flex-shrink-0 mt-0.5"
              style={{ color: 'var(--color-confirmed)' }}
            />
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest font-bold text-[#2B5D5C] mb-0.5">
                RE-ACCOMMODATION APPLIED ✓
              </p>
              <p className="text-xs text-[#1C1B19] leading-relaxed font-body">
                {recoverySuccessMessage}
              </p>
            </div>
          </div>
          <button
            id="dismiss-recovery-toast-btn"
            onClick={clearRecoverySuccess}
            className="text-[#6B6760] hover:text-[#1C1B19] cursor-pointer flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Active Disruption Summary Banner */}
      <DisruptionBanner />

      {/* Operations Dispatch Summary Card */}
      <div className="bg-white rounded-[2px] p-5 mb-6 border border-[#DEDAD2]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-2xs uppercase tracking-widest font-bold text-[#969188]">
                DISPATCH MANIFEST
              </span>
              <span className="font-mono text-2xs text-[#969188]">·</span>
              <span className="font-mono text-2xs text-[#6B6760]">
                REF: {itinerary.id.toUpperCase()}
              </span>
            </div>
            <h2 className="font-display font-bold text-2xl text-[#1C1B19] tracking-tight">
              {itinerary.destination}
            </h2>
            <p className="text-xs text-[#6B6760] mt-0.5 font-body">
              Traveler: <span className="font-semibold text-[#1C1B19]">{itinerary.travelerName}</span>
            </p>
          </div>

          {/* Operational Metrics (IBM Plex Mono) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-center sm:text-right border-t sm:border-t-0 sm:border-l border-[#EBE7DF] pt-3 sm:pt-0 sm:pl-5">
            <div>
              <span className="text-2xs text-[#969188] uppercase block">TOTAL SEGMENTS</span>
              <span className="text-base font-bold text-[#1C1B19]">{itinerary.bookings.length}</span>
            </div>
            <div>
              <span className="text-2xs text-[#969188] uppercase block">TOTAL FARE</span>
              <span className="text-base font-bold text-[#1C1B19]">
                ₹{totalCost.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-2xs text-[#969188] uppercase block">BUFFER RISKS</span>
              <span
                className="text-base font-bold"
                style={{
                  color: atRiskConnections.length > 0 ? '#B8552F' : '#2B5D5C',
                }}
              >
                {atRiskConnections.length}
              </span>
            </div>
            <div>
              <span className="text-2xs text-[#969188] uppercase block">RESILIENCE</span>
              <span
                className="text-base font-bold"
                style={{
                  color:
                    tripRisk.level === 'low'
                      ? 'var(--color-confirmed)'
                      : tripRisk.level === 'moderate'
                      ? 'var(--color-at-risk)'
                      : 'var(--color-disrupted)',
                }}
              >
                {tripRisk.overallScore}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Risk Score & Resilience Console Gauge */}
      <TripRiskBadge itinerary={itinerary} />

      {/* Natural Language Disruption Assistant Terminal */}
      <DisruptionAssistant itinerary={itinerary} />

      {/* Itinerary Timeline */}
      <div className="relative pl-6 sm:pl-8">
        {/* Dependency Spine (1px hairline rule) */}
        <div
          className="absolute left-2.5 sm:left-3.5 top-3 bottom-8 w-[1px] bg-[#DEDAD2]"
          aria-hidden="true"
        />

        <div className="space-y-6">
          {sortedBookings.map((booking, idx) => {
            const isDisruptionSource = activeDisruption?.bookingId === booking.id;
            const impactedBooking = impactedMap.get(booking.id);
            const atRiskConns = atRiskByBookingId.get(booking.id) ?? [];

            // Calculate buffer with previous booking
            const prevBooking = idx > 0 ? sortedBookings[idx - 1] : null;
            const bufferMinutes = prevBooking
              ? Math.round(
                  (new Date(booking.startTime).getTime() - new Date(prevBooking.endTime).getTime()) /
                    60000
                )
              : null;

            return (
              <div key={booking.id} className="relative">
                {/* Diamond connector notch on the spine */}
                <div
                  className="absolute -left-[19px] sm:-left-[23px] top-6 w-2.5 h-2.5 rotate-45 border transition-colors duration-150 z-10"
                  style={{
                    backgroundColor: isDisruptionSource
                      ? '#9E2B25'
                      : impactedBooking?.severity === 'broken'
                      ? '#9E2B25'
                      : impactedBooking?.severity === 'at-risk' || atRiskConns.length > 0
                      ? '#B8552F'
                      : '#2B5D5C',
                    borderColor: '#FFFFFF',
                  }}
                  title={`Segment node: ${booking.title}`}
                />

                {/* Inter-booking Buffer indicator */}
                {bufferMinutes !== null && bufferMinutes >= 0 && (
                  <div className="mb-2 flex items-center gap-2 font-mono text-2xs text-[#969188]">
                    <Clock size={11} className="text-[#969188]" />
                    <span>
                      GROUND TRANSFER BUFFER: <strong className="text-[#6B6760]">{formatBufferDuration(bufferMinutes)}</strong>
                    </span>
                    {booking.dependsOn.length > 0 && (
                      <span>
                        · DEPENDS ON: {booking.dependsOn.map((depId) => bookingMap.get(depId)?.title.split(' ')[0] ?? depId).join(', ')}
                      </span>
                    )}
                  </div>
                )}

                {/* Booking card */}
                <BookingCard
                  booking={booking}
                  atRiskConns={atRiskConns}
                  isDisruptionSource={isDisruptionSource}
                  impactedBooking={impactedBooking}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatBufferDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
