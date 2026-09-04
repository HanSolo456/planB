import { useState } from 'react';
import type { Booking, AtRiskConnection, ImpactedBooking, Location } from '../lib/types';
import { useAppState } from '../App';
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
    label: 'RECOVERED',
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
  const iconProps = { size: 15, color, strokeWidth: 2 };
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
}: Props) {
  const { activeDisruption } = useAppState();
  const [showDetails, setShowDetails] = useState(false);

  const isBroken = impactedBooking?.severity === 'broken';
  const isAtRiskImpacted = impactedBooking?.severity === 'at-risk';
  const hasCritical = atRiskConns.some((c) => c.riskLevel === 'critical');
  const hasTight = atRiskConns.some((c) => c.riskLevel === 'tight');

  // Determine effective status & colors
  let effectiveStatus: Booking['status'] = booking.status;
  if (isDisruptionSource) effectiveStatus = 'disrupted';
  else if (isBroken) effectiveStatus = 'disrupted';
  else if (isAtRiskImpacted || hasCritical || hasTight) effectiveStatus = 'at-risk';

  const statusCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.confirmed;

  const isAffectedByDisruption = Boolean(activeDisruption && (isDisruptionSource || impactedBooking));

  return (
    <div
      id={`booking-card-${booking.id}`}
      className={`bg-white rounded-[2px] border border-[#DEDAD2] relative overflow-hidden ${
        isAffectedByDisruption ? 'animate-board-flip' : ''
      }`}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: statusCfg.color,
      }}
    >
      {/* Main card body */}
      <div className="p-4 sm:p-5">
        {/* Row 1: Header metadata & Status indicator */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-[2px] flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-bg-surface-alt)' }}
            >
              <BookingTypeIcon type={booking.type} color="#1C1B19" />
            </div>

            <span className="font-mono text-2xs uppercase tracking-widest text-[#6B6760] font-semibold">
              {booking.type} · {booking.provider}
            </span>
          </div>

          {/* Status Indicator (Solid dot + label) */}
          <div className="flex items-center gap-1.5 font-mono text-2xs font-bold uppercase tracking-wider">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: statusCfg.color }}
            />
            <span style={{ color: statusCfg.color }}>
              {isDisruptionSource
                ? 'SOURCE INCIDENT'
                : isBroken
                ? 'BROKEN'
                : isAtRiskImpacted
                ? 'AT RISK (IMPACT)'
                : statusCfg.label}
            </span>
          </div>
        </div>

        {/* Row 2: Title & Route */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-3">
          <h3 className="font-display font-bold text-base text-[#1C1B19] leading-tight">
            {booking.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-[#6B6760] flex-shrink-0">
            <MapPin size={12} className="text-[#969188]" />
            <span>{formatLocation(booking.location)}</span>
          </div>
        </div>

        {/* Row 3: Operational Timetable / Schedule (IBM Plex Mono) */}
        {(() => {
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
            activeDisruption?.disruptionType === 'delay' &&
            impactedBooking.bufferShortfallMinutes > 0
              ? impactedBooking.bufferShortfallMinutes
              : 0;

          const effectiveDelay = isDelaySource
            ? (activeDisruption?.delayMinutes ?? 0)
            : cascadeDelay;

          const hasDisplayedDelay = effectiveDelay > 0;
          const newStart = hasDisplayedDelay ? shiftIso(booking.startTime, effectiveDelay) : null;
          const newEnd   = hasDisplayedDelay ? shiftIso(booking.endTime,   effectiveDelay) : null;

          // Timetable bg: red for source/broken, amber for cascade at-risk, plain otherwise
          const timetableBg = isDelaySource || isBroken
            ? 'var(--color-disrupted-bg)'
            : cascadeDelay > 0
            ? 'var(--color-at-risk-bg)'
            : '#FAF8F5';
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
              {/* DEPARTURE */}
              <div>
                <span className="text-2xs text-[#969188] uppercase block">DEPARTURE</span>
                {hasDisplayedDelay && newStart ? (
                  <>
                    <span className="text-xs font-bold line-through text-[#969188]">
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
                    <span className="text-xs font-bold text-[#1C1B19]">{formatTimeOnly(booking.startTime)}</span>
                    <span className="text-2xs text-[#6B6760] block">{formatDateOnly(booking.startTime)}</span>
                  </>
                )}
              </div>

              {/* ARRIVAL */}
              <div>
                <span className="text-2xs text-[#969188] uppercase block">ARRIVAL</span>
                {hasDisplayedDelay && newEnd ? (
                  <>
                    <span className="text-xs font-bold line-through text-[#969188]">
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
                    <span className="text-xs font-bold text-[#1C1B19]">{formatTimeOnly(booking.endTime)}</span>
                    <span className="text-2xs text-[#6B6760] block">{formatDateOnly(booking.endTime)}</span>
                  </>
                )}
              </div>

              {/* DURATION */}
              <div>
                <span className="text-2xs text-[#969188] uppercase block">DURATION</span>
                {hasDisplayedDelay && newStart && newEnd ? (
                  <>
                    <span className="text-xs font-medium line-through text-[#969188]">
                      {getDurationLabel(booking.startTime, booking.endTime)}
                    </span>
                    <span className="text-xs font-medium block" style={{ color: newTimeColor }}>
                      {getDurationLabel(newStart, newEnd)}
                      <span className="ml-1 text-2xs font-bold">(+{effectiveDelay}m)</span>
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-medium text-[#1C1B19]">
                    {getDurationLabel(booking.startTime, booking.endTime)}
                  </span>
                )}
              </div>

              {/* FARE */}
              <div>
                <span className="text-2xs text-[#969188] uppercase block">FARE / COST</span>
                <span className="text-xs font-bold text-[#1C1B19]">
                  ₹{booking.cost.toLocaleString('en-IN')}
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
                    {isBroken ? 'CASCADE FAILURE' : 'BUFFER SHORTFALL'}
                  </span>
                  {impactedBooking.bufferShortfallMinutes > 0 && (
                    <span className="text-[#6B6760]">
                      SHORTFALL: {impactedBooking.bufferShortfallMinutes}M
                    </span>
                  )}
                </div>
                <p className="text-[#1C1B19] leading-relaxed">
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
                        {isCrit ? 'CRITICAL BUFFER' : 'TIGHT CONNECTION'}
                      </span>
                      <span className="text-[#6B6760]">
                        BUFFER: {conn.bufferRemaining}M (SHORTFALL: {conn.bufferShortfallMinutes}M)
                      </span>
                    </div>
                    <p className="text-[#1C1B19] leading-relaxed">
                      Tight transfer after {conn.dependencyBooking.title}. Required buffer is {booking.bufferMinutes}m.
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
            className="flex items-center gap-1 font-mono text-2xs text-[#6B6760] hover:text-[#1C1B19] cursor-pointer"
          >
            <span>{showDetails ? 'HIDE SPECIFICATIONS' : 'VIEW SPECIFICATIONS'}</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Simulate Disruption inline action */}
          <DisruptionTrigger booking={booking} isSource={isDisruptionSource} />
        </div>

        {/* Drawer: Detailed Specifications */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-[#DEDAD2] font-mono text-xs text-[#6B6760] space-y-2 animate-slide-down">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-2xs text-[#969188] block">ID</span>
                <span className="text-[#1C1B19] font-medium">{booking.id}</span>
              </div>
              <div>
                <span className="text-2xs text-[#969188] block">CANCELLATION POLICY</span>
                <span className="text-[#1C1B19] capitalize">
                  {booking.cancellationPolicy.policy.replace('-', ' ')} ({booking.cancellationPolicy.cutoffHours}h cutoff)
                </span>
              </div>
              <div>
                <span className="text-2xs text-[#969188] block">DEPENDS ON</span>
                <span className="text-[#1C1B19]">
                  {booking.dependsOn.length > 0 ? booking.dependsOn.join(', ') : 'None (Root leg)'}
                </span>
              </div>
            </div>

            {booking.meta && Object.keys(booking.meta).length > 0 && (
              <div className="pt-2 border-t border-[#EBE7DF]">
                <span className="text-2xs text-[#969188] block mb-1">METADATA</span>
                <div className="flex flex-wrap gap-2 text-2xs">
                  {Object.entries(booking.meta).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-1.5 py-0.5 bg-[#FAF8F5] border border-[#DEDAD2] text-[#1C1B19] rounded-[2px]"
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
