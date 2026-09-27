import { useState } from 'react';
import type { Booking, AtRiskConnection, ImpactedBooking, Location } from '../lib/types';
import { useAppState } from '../App';
import { useWikipediaImage, getWikipediaQueryForBooking } from '../lib/useWikipediaImage';
import DisruptionTrigger from './DisruptionTrigger';
import {
  Plane,
  Train,
  Hotel,
  Car,
  Compass,
  CalendarClock,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';

interface Props {
  booking: Booking;
  atRiskConns: AtRiskConnection[];
  isDisruptionSource?: boolean;
  impactedBooking?: ImpactedBooking;
  legIndex?: number;
  totalLegs?: number;
  destination?: string;
}

// ---------------------------------------------------------------------------
// STATUS CONFIG — clean solid dots + text labels
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  confirmed: {
    label: 'CONFIRMED',
    color: 'var(--color-confirmed)',
    bg: 'var(--color-confirmed-bg)',
    border: 'var(--color-confirmed-border)',
  },
  'at-risk': {
    label: 'AT RISK',
    color: 'var(--color-at-risk)',
    bg: 'var(--color-at-risk-bg)',
    border: 'var(--color-at-risk-border)',
  },
  disrupted: {
    label: 'DISRUPTED',
    color: 'var(--color-disrupted)',
    bg: 'var(--color-disrupted-bg)',
    border: 'var(--color-disrupted-border)',
  },
  recovered: {
    label: 'RESCHEDULED',
    color: 'var(--color-recovered)',
    bg: 'var(--color-recovered-bg)',
    border: 'var(--color-recovered-border)',
  },
  cancelled: {
    label: 'CANCELLED',
    color: 'var(--color-cancelled)',
    bg: 'var(--color-cancelled-bg)',
    border: 'var(--color-cancelled-border)',
  },
} as const;

// ---------------------------------------------------------------------------
// TYPE ICON MAP
// ---------------------------------------------------------------------------
function BookingTypeIcon({ type, color }: { type: Booking['type']; color: string }) {
  const iconProps = { size: 14, color, strokeWidth: 2 };
  switch (type) {
    case 'flight':   return <Plane {...iconProps} />;
    case 'train':    return <Train {...iconProps} />;
    case 'hotel':    return <Hotel {...iconProps} />;
    case 'transfer': return <Car {...iconProps} />;
    case 'activity': return <Compass {...iconProps} />;
    case 'event':    return <CalendarClock {...iconProps} />;
  }
}

function formatLocation(loc: Location): string {
  if (loc.type === 'named') return loc.name;
  return loc.label ?? `${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)}`;
}

export default function BookingCard({
  booking,
  atRiskConns,
  isDisruptionSource = false,
  impactedBooking,
  legIndex,
  totalLegs,
  destination,
}: Props) {
  const { activeDisruptions } = useAppState();
  const [showDetails, setShowDetails] = useState(false);

  // Wikipedia thumbnail — derive destination from location if not passed as prop
  const derivedDestination =
    destination ??
    (booking.location.type === 'named' ? booking.location.name : booking.location.label ?? '');
  const { query: wikiQuery, fallback: wikiFallback } = getWikipediaQueryForBooking(booking, derivedDestination);
  const imageUrl = useWikipediaImage(wikiQuery, wikiFallback);

  // This booking is a disruption source if any active disruption targets its ID
  const activeDisruption = activeDisruptions.find((d) => d.bookingId === booking.id) ?? null;
  const isCompound = impactedBooking?.compoundDisruptionCount === 2;

  const isBroken = impactedBooking?.severity === 'broken';
  const isAtRiskImpacted = impactedBooking?.severity === 'at-risk';
  const hasCritical = atRiskConns.some((c) => c.riskLevel === 'critical');
  const hasTight = atRiskConns.some((c) => c.riskLevel === 'tight');

  // Determine effective status & colors
  let effectiveStatus: Booking['status'] = booking.status;
  if (isDisruptionSource) effectiveStatus = 'disrupted';
  else if (isBroken) effectiveStatus = 'disrupted';
  else if (isAtRiskImpacted || hasCritical || hasTight) effectiveStatus = 'at-risk';
  // Preserve 'recovered' — don't silently downgrade it to 'confirmed'
  else if (booking.status === 'recovered') effectiveStatus = 'recovered';

  const statusCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.confirmed;

  const isAffectedByDisruption = Boolean(activeDisruptions.length > 0 && (isDisruptionSource || impactedBooking));

  return (
    <div
      id={`booking-card-${booking.id}`}
      className={`bg-white rounded-[2px] border border-[#DEDAD2] relative overflow-hidden transition-all duration-200 ${
        isAffectedByDisruption ? 'animate-board-flip' : ''
      } ${isDisruptionSource || isBroken ? 'hazard-stripe-disrupted' : ''}`}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: statusCfg.color,
        // Compound-impact bookings get a visible extra ring so they stand out
        boxShadow: isCompound
          ? `0 0 0 2px #7A1E1A, 0 0 0 4px rgba(122,30,26,0.15)`
          : undefined,
      }}
    >
      {/* Top Hazard Accent Bar for severe incidents */}
      {(isDisruptionSource || isBroken) && (
        <div className="h-1 w-full hazard-stripe-bar-disrupted" aria-hidden="true" />
      )}

      {/* Main card body */}
      <div className="p-4 sm:p-5">
        {/* Row 1: Header metadata & Status indicator */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Aviation Leg Stamp */}
            {legIndex !== undefined && (
              <span className="font-mono text-2xs uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-[2px] bg-[#EFECE6] text-[#4A5568] border border-[#DEDAD2]">
                LEG {String(legIndex).padStart(2, '0')}{totalLegs ? ` / ${String(totalLegs).padStart(2, '0')}` : ''}
              </span>
            )}

            <div
              className="w-5 h-5 rounded-[2px] flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-bg-surface-alt)' }}
            >
              <BookingTypeIcon type={booking.type} color="#17212B" />
            </div>

            <span className="font-mono text-2xs uppercase tracking-widest text-[#4A5568] font-semibold">
              {booking.type} · {booking.provider}
            </span>

            {booking.bufferMinutes > 0 && (
              <span className="font-mono text-2xs text-[#8896A4] hidden sm:inline">
                · REQ BUFFER: {booking.bufferMinutes}M
              </span>
            )}
          </div>

          {/* Solari Split-Flap Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] border solari-flap font-mono text-2xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: statusCfg.bg,
              borderColor: statusCfg.border,
              color: statusCfg.color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: statusCfg.color }}
            />
            <span>
              {isDisruptionSource
                ? 'REPORTED ISSUE'
                : isBroken
                ? 'CONFLICT'
                : isAtRiskImpacted
                ? 'AT RISK'
                : statusCfg.label}
            </span>
            {isCompound && (
              <span
                className="ml-1 px-1 py-0.5 rounded-[1px] font-mono text-2xs font-bold leading-none"
                style={{ backgroundColor: '#7A1E1A', color: '#FFF' }}
                title="Affected by 2 simultaneous disruptions"
              >
                ×2
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Title & Route */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
          {/* Thumbnail */}
          <div className="w-full sm:w-28 sm:h-20 h-36 rounded-[2px] overflow-hidden flex-shrink-0 bg-[#F7F4EE] border border-[#DEDAD2] relative group/img">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={booking.title}
                className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#8896A4]">
                <BookingTypeIcon type={booking.type} color="#8896A4" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Title + location */}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-base text-[#17212B] leading-tight">
              {booking.title}
            </h3>

            <div className="flex items-center gap-1.5 text-xs text-[#4A5568] mt-1">
              <MapPin size={12} className="text-[#8896A4]" />
              <span>{formatLocation(booking.location)}</span>
            </div>
          </div>
        </div>

        {/* Row 3: Operational Timetable / Schedule (IBM Plex Mono) */}
        {(() => {
          // --- RECOVERED BOOKING: show original times struck-through, new times in green ---
          const isRecovered = booking.status === 'recovered' && !!booking.meta?.originalStartTime;
          const recoveredOriginalStart = isRecovered ? (booking.meta!.originalStartTime as string) : null;
          const recoveredOriginalEnd   = isRecovered ? (booking.meta!.originalEndTime   as string) : null;
          const recoveredOriginalCost  = isRecovered ? (booking.meta!.originalCost      as number) : null;

          if (isRecovered && recoveredOriginalStart) {
            const startChanged = recoveredOriginalStart !== booking.startTime;
            const endChanged   = recoveredOriginalEnd && recoveredOriginalEnd !== booking.endTime;
            const costChanged  = recoveredOriginalCost != null && recoveredOriginalCost !== booking.cost;

            return (
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y px-3.5 my-3 rounded-[2px] font-mono transition-colors duration-300"
                style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}
              >
                {/* START TIME */}
                <div className="telemetry-cell">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-2xs text-[#8896A4] uppercase block font-semibold">
                      {booking.type === 'hotel' ? 'CHECK-IN'
                        : booking.type === 'activity' || booking.type === 'event' ? 'STARTS'
                        : booking.type === 'transfer' ? 'PICKUP'
                        : 'DEPARTURE'}
                    </span>
                    {startChanged && (
                      <span className="text-3xs uppercase font-bold px-1 rounded-[1px] bg-green-100 text-green-700">
                        UPDATED
                      </span>
                    )}
                  </div>
                  {startChanged ? (
                    <>
                      <span className="text-xs font-bold line-through text-[#8896A4]">
                        {formatTimeOnly(recoveredOriginalStart)}
                      </span>
                      <span className="text-xs font-bold block text-green-700">
                        {formatTimeOnly(booking.startTime)}
                      </span>
                      <span className="text-2xs block text-green-700">
                        {formatDateOnly(booking.startTime)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-[#17212B]">{formatTimeOnly(booking.startTime)}</span>
                      <span className="text-2xs text-[#4A5568] block">{formatDateOnly(booking.startTime)}</span>
                    </>
                  )}
                </div>

                {/* END TIME */}
                <div className="telemetry-cell">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-2xs text-[#8896A4] uppercase block font-semibold">
                      {booking.type === 'hotel' ? 'CHECK-OUT'
                        : booking.type === 'activity' || booking.type === 'event' ? 'ENDS'
                        : booking.type === 'transfer' ? 'DROP-OFF'
                        : 'ARRIVAL'}
                    </span>
                  </div>
                  {endChanged && recoveredOriginalEnd ? (
                    <>
                      <span className="text-xs font-bold line-through text-[#8896A4]">
                        {formatTimeOnly(recoveredOriginalEnd)}
                      </span>
                      <span className="text-xs font-bold block text-green-700">
                        {formatTimeOnly(booking.endTime)}
                      </span>
                      <span className="text-2xs block text-green-700">
                        {formatDateOnly(booking.endTime)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-[#17212B]">{formatTimeOnly(booking.endTime)}</span>
                      <span className="text-2xs text-[#4A5568] block">{formatDateOnly(booking.endTime)}</span>
                    </>
                  )}
                </div>

                {/* DURATION */}
                <div className="telemetry-cell">
                  <span className="text-2xs text-[#8896A4] uppercase block font-semibold mb-0.5">DURATION</span>
                  <span className="text-xs font-medium text-[#17212B]">
                    {getDurationLabel(booking.startTime, booking.endTime)}
                  </span>
                </div>

                {/* FARE */}
                <div className="telemetry-cell">
                  <span className="text-2xs text-[#8896A4] uppercase block font-semibold mb-0.5">FARE / COST</span>
                  {costChanged && recoveredOriginalCost != null ? (
                    <>
                      <span className="text-xs font-bold line-through text-[#8896A4]">
                        ₹{recoveredOriginalCost.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs font-bold block text-green-700">
                        ₹{booking.cost.toLocaleString('en-IN')}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-[#17212B]">
                      ₹{booking.cost.toLocaleString('en-IN')}
                    </span>
                  )}
                  <span className="text-2xs text-[#8896A4] block">
                    {booking.cancellationPolicy.policy.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          }

          // --- SOURCE BOOKING: direct delay applied ---
          const isDelaySource =
            isDisruptionSource &&
            activeDisruption?.disruptionType === 'delay' &&
            (activeDisruption?.delayMinutes ?? 0) > 0;

          // --- IMPACTED BOOKING: cascade delay = bufferShortfallMinutes ---
          // The impactEngine computes effectiveStart = latestDepEnd + bufferMinutes
          // so shortfall = effectiveStart - originalStart = how many min late this runs.
          const cascadeDelay =
            !isDisruptionSource &&
            impactedBooking &&
            activeDisruptions.some((disruption) => disruption.disruptionType === 'delay') &&
            Number.isFinite(impactedBooking.bufferShortfallMinutes) &&
            impactedBooking.bufferShortfallMinutes > 0
              ? impactedBooking.bufferShortfallMinutes
              : 0;

          const effectiveDelay = isDelaySource
            ? (activeDisruption?.delayMinutes ?? 0)
            : cascadeDelay;

          const hasDisplayedDelay = effectiveDelay > 0;
          const newStart = hasDisplayedDelay ? shiftIso(booking.startTime, effectiveDelay) : null;
          // CHECKOUT / END TIME LOGIC:
          //
          // For the disruption SOURCE (e.g. the delayed flight itself):
          //   Both start and end shift uniformly — the service is simply running late.
          //
          // For a cascade-impacted HOTEL or ACTIVITY/EVENT:
          //   Only the start (check-in / session start) is affected — you arrive late.
          //   The checkout / end time is a FIXED hotel/venue constraint set at booking time.
          //   A delayed check-in does NOT move the checkout: you just get a shorter stay.
          //   Showing a revised 22 Dec checkout because of an 18 Dec flight delay is wrong.
          //   newEnd = null means the CHECK-OUT cell shows the original, unrevised time.
          //
          // For a cascade-impacted TRANSFER:
          //   The ride shifts uniformly (pickup late means drop-off late by the same amount).
          const newEnd = hasDisplayedDelay && newStart
            ? (() => {
                if (!isDelaySource && (booking.type === 'hotel' || booking.type === 'activity' || booking.type === 'event')) {
                  // Checkout/end is fixed by the hotel/venue — do not show a revised time.
                  return null;
                }
                // Flight/train (source) or cascade-impacted transfer: uniform shift.
                return shiftIso(booking.endTime, effectiveDelay);
              })()
            : null;

          // Timetable bg: red for source/broken, amber for cascade at-risk, plain otherwise
          const timetableBg = isDelaySource || isBroken
            ? 'var(--color-disrupted-bg)'
            : cascadeDelay > 0
            ? 'var(--color-at-risk-bg)'
            : '#F7F4EE';
          const timetableBorder = isDelaySource || isBroken
            ? 'var(--color-disrupted-border)'
            : cascadeDelay > 0
            ? 'var(--color-at-risk-border)'
            : '#EBE7DF';
          const newTimeColor = isDelaySource || isBroken
            ? 'var(--color-disrupted)'
            : 'var(--color-at-risk)';

          return (
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y px-3.5 my-3 rounded-[2px] font-mono transition-colors duration-300"
              style={{ backgroundColor: timetableBg, borderColor: timetableBorder }}
            >
              {/* START TIME — label varies by booking type */}
              <div className="telemetry-cell">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-2xs text-[#8896A4] uppercase block font-semibold">
                    {booking.type === 'hotel' ? 'CHECK-IN'
                      : booking.type === 'activity' || booking.type === 'event' ? 'STARTS'
                      : booking.type === 'transfer' ? 'PICKUP'
                      : 'DEPARTURE' /* flight, train */}
                  </span>
                  {hasDisplayedDelay && (
                    <span className="text-3xs uppercase font-bold px-1 rounded-[1px] bg-red-100 text-[#9E2B25]">
                      REVISED
                    </span>
                  )}
                </div>
                {hasDisplayedDelay && newStart ? (
                  <>
                    <span className="text-xs font-bold line-through text-[#8896A4]">
                      {formatTimeOnly(booking.startTime)}
                    </span>
                    <span className="text-xs font-bold block" style={{ color: newTimeColor }}>
                      {formatTimeOnly(newStart)}
                    </span>
                    <span className="text-2xs block" style={{ color: newTimeColor }}>
                      {formatDateOnly(newStart)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold text-[#17212B]">{formatTimeOnly(booking.startTime)}</span>
                    <span className="text-2xs text-[#4A5568] block">{formatDateOnly(booking.startTime)}</span>
                  </>
                )}
              </div>

              {/* END TIME — label varies by booking type */}
              <div className="telemetry-cell">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-2xs text-[#8896A4] uppercase block font-semibold">
                    {booking.type === 'hotel' ? 'CHECK-OUT'
                      : booking.type === 'activity' || booking.type === 'event' ? 'ENDS'
                      : booking.type === 'transfer' ? 'DROP-OFF'
                      : 'ARRIVAL' /* flight, train */}
                  </span>
                  {hasDisplayedDelay && (
                    <span className="text-3xs uppercase font-bold px-1 rounded-[1px] bg-red-100 text-[#9E2B25]">
                      +{effectiveDelay}M
                    </span>
                  )}
                </div>
                {hasDisplayedDelay && newEnd ? (
                  <>
                    <span className="text-xs font-bold line-through text-[#8896A4]">
                      {formatTimeOnly(booking.endTime)}
                    </span>
                    <span className="text-xs font-bold block" style={{ color: newTimeColor }}>
                      {formatTimeOnly(newEnd)}
                    </span>
                    <span className="text-2xs block" style={{ color: newTimeColor }}>
                      {formatDateOnly(newEnd)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold text-[#17212B]">{formatTimeOnly(booking.endTime)}</span>
                    <span className="text-2xs text-[#4A5568] block">{formatDateOnly(booking.endTime)}</span>
                  </>
                )}
              </div>

              {/* DURATION */}
              <div className="telemetry-cell">
                <span className="text-2xs text-[#8896A4] uppercase block font-semibold mb-0.5">DURATION</span>
                {hasDisplayedDelay && newStart && newEnd ? (
                  <>
                    <span className="text-xs font-medium line-through text-[#8896A4]">
                      {getDurationLabel(booking.startTime, booking.endTime)}
                    </span>
                    <span className="text-xs font-medium block" style={{ color: newTimeColor }}>
                      {getDurationLabel(newStart, newEnd)}
                      <span className="ml-1 text-2xs font-bold">(+{effectiveDelay}m)</span>
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-medium text-[#17212B]">
                    {getDurationLabel(booking.startTime, booking.endTime)}
                  </span>
                )}
              </div>

              {/* FARE */}
              <div className="telemetry-cell">
                <span className="text-2xs text-[#8896A4] uppercase block font-semibold mb-0.5">FARE / COST</span>
                <span className="text-xs font-bold text-[#17212B]">
                  ₹{booking.cost.toLocaleString('en-IN')}
                </span>
                <span className="text-2xs text-[#8896A4] block">
                  {booking.cancellationPolicy.policy.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })()}


        {/* Row 4: Disruption Cascade Alert (if impacted) */}
        {impactedBooking && (
          <div
            className="p-3 my-2.5 rounded-[2px] border font-body text-xs"
            style={{
              backgroundColor: isBroken ? 'var(--color-disrupted-bg)' : 'var(--color-at-risk-bg)',
              borderColor: isBroken ? 'var(--color-disrupted-border)' : 'var(--color-at-risk-border)',
            }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={14}
                className="flex-shrink-0 mt-0.5"
                style={{ color: isBroken ? 'var(--color-disrupted)' : 'var(--color-at-risk)' }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-mono text-2xs font-bold uppercase tracking-wider mb-0.5">
                  <span style={{ color: isBroken ? 'var(--color-disrupted)' : 'var(--color-at-risk)' }}>
                    {isBroken ? 'SCHEDULE CONFLICT' : 'TIGHT TIMING'}
                  </span>
                  {impactedBooking.bufferShortfallMinutes > 0 && (
                    <span className="text-[#4A5568]">
                      SHORT BY {impactedBooking.bufferShortfallMinutes} MIN
                    </span>
                  )}
                </div>
                <p className="text-[#17212B] leading-relaxed">
                  {impactedBooking.reason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Row 5: Proactive at-risk buffer alerts (when no active disruption) */}
        {!activeDisruption && atRiskConns.length > 0 && (
          <div className="space-y-1.5 my-2.5">
            {atRiskConns.map((conn) => {
              const isCrit = conn.riskLevel === 'critical';
              return (
                <div
                  key={conn.dependencyBooking.id}
                  className="p-2.5 rounded-[2px] border flex items-start gap-2 font-body text-xs"
                  style={{
                    backgroundColor: isCrit ? 'var(--color-disrupted-bg)' : 'var(--color-at-risk-bg)',
                    borderColor: isCrit ? 'var(--color-disrupted-border)' : 'var(--color-at-risk-border)',
                  }}
                >
                  <Clock
                    size={13}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: isCrit ? 'var(--color-disrupted)' : 'var(--color-at-risk)' }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-mono text-2xs font-bold uppercase tracking-wider mb-0.5">
                      <span style={{ color: isCrit ? 'var(--color-disrupted)' : 'var(--color-at-risk)' }}>
                        {isCrit ? 'CRITICAL TIME WINDOW' : 'TIGHT CONNECTION'}
                      </span>
                      <span className="text-[#4A5568]">
                        BUFFER: {conn.bufferRemaining}M (SHORTFALL: {conn.bufferShortfallMinutes}M)
                      </span>
                    </div>
                    <p className="text-[#17212B] leading-relaxed">
                      Tight transfer after {conn.dependencyBooking.title}. Recommended buffer is {booking.bufferMinutes}m.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Row 6: Action Footer */}
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#EBE7DF]">
          {/* Details toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 font-mono text-2xs text-[#4A5568] hover:text-[#17212B] cursor-pointer"
          >
            <span>{showDetails ? 'HIDE DETAILS' : 'VIEW DETAILS'}</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Report Disruption action */}
          <DisruptionTrigger booking={booking} isSource={isDisruptionSource} />
        </div>

        {/* Drawer: Detailed Specifications */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-[#DEDAD2] font-mono text-xs text-[#4A5568] space-y-2 animate-slide-down">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-2xs text-[#8896A4] block">ID</span>
                <span className="text-[#17212B] font-medium">{booking.id}</span>
              </div>
              <div>
                <span className="text-2xs text-[#8896A4] block">CANCELLATION POLICY</span>
                <span className="text-[#17212B] capitalize">
                  {booking.cancellationPolicy.policy.replace('-', ' ')} ({booking.cancellationPolicy.cutoffHours}h cutoff)
                </span>
              </div>
              <div>
                <span className="text-2xs text-[#8896A4] block">DEPENDS ON</span>
                <span className="text-[#17212B]">
                  {booking.dependsOn.length > 0 ? booking.dependsOn.join(', ') : 'None (Root leg)'}
                </span>
              </div>
            </div>

            {booking.meta && Object.keys(booking.meta).length > 0 && (
              <div className="pt-2 border-t border-[#EBE7DF]">
                <span className="text-2xs text-[#8896A4] block mb-1">METADATA</span>
                <div className="flex flex-wrap gap-2 text-2xs">
                  {Object.entries(booking.meta).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-1.5 py-0.5 bg-[#F7F4EE] border border-[#DEDAD2] text-[#17212B] rounded-[2px]"
                    >
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} IST`;
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDurationLabel(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const totalM = Math.round(diffMs / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Shift an ISO 8601 string by delayMinutes, preserving the original offset. */
function shiftIso(iso: string, delayMinutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + delayMinutes);
  // Re-attach original offset string so display is consistent
  const offsetMatch = iso.match(/([+-]\d{2}:\d{2}|Z)$/);
  const offset = offsetMatch ? offsetMatch[1] : '+05:30';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00${offset}`
  );
}
