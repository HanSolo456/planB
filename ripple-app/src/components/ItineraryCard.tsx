import { useState } from 'react';
import type { Booking, ImpactedBooking, AtRiskConnection } from '../lib/types';
import { useAppState } from '../App';
import { useWikipediaImage, getWikipediaQueryForBooking } from '../lib/useWikipediaImage';
import DisruptionTrigger from './DisruptionTrigger';
import {
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

interface ItineraryCardProps {
  booking: Booking;
  index: number;
  destination: string;
  isDisruptionSource?: boolean;
  impactedBooking?: ImpactedBooking;
  atRiskConns?: AtRiskConnection[];
}

export default function ItineraryCard({
  booking,
  index,
  destination,
  isDisruptionSource = false,
  impactedBooking,
  atRiskConns = [],
}: ItineraryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { activeDisruptions } = useAppState();
  const activeDisruption = activeDisruptions.find((d) => d.bookingId === booking.id) ?? null;

  // ── Revised time calculation (same logic as BookingCard) ──
  const isDelaySource =
    isDisruptionSource &&
    activeDisruption?.disruptionType === 'delay' &&
    (activeDisruption?.delayMinutes ?? 0) > 0;

  const cascadeDelay =
    !isDisruptionSource &&
    impactedBooking &&
    activeDisruptions.some((d) => d.disruptionType === 'delay') &&
    Number.isFinite(impactedBooking.bufferShortfallMinutes) &&
    impactedBooking.bufferShortfallMinutes > 0
      ? impactedBooking.bufferShortfallMinutes
      : 0;

  const effectiveDelay = isDelaySource ? (activeDisruption?.delayMinutes ?? 0) : cascadeDelay;
  const hasDelay = effectiveDelay > 0;

  function shiftTime(iso: string, mins: number): string {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + mins);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function shiftDate(iso: string, mins: number): string {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + mins);
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // Compute Wikipedia image
  const { query, fallback } = getWikipediaQueryForBooking(booking, destination);
  const imageUrl = useWikipediaImage(query, fallback);

  // Determine status & styling
  const isBroken = impactedBooking?.severity === 'broken';
  const isAtRisk =
    impactedBooking?.severity === 'at-risk' ||
    atRiskConns.length > 0 ||
    booking.status === 'at-risk';

  let statusLabel = 'CONFIRMED';
  let statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/90';
  let stepCircleClass = 'bg-blue-50 border-blue-500 text-blue-700';

  if (index === 2 && isAtRisk) {
    stepCircleClass = 'bg-amber-50 border-amber-500 text-amber-700';
  } else if (index === 3) {
    stepCircleClass = 'bg-teal-50 border-teal-500 text-teal-700';
  } else if (index === 4) {
    stepCircleClass = 'bg-emerald-50 border-emerald-500 text-emerald-700';
  } else if (index === 5) {
    stepCircleClass = 'bg-slate-50 border-slate-500 text-slate-700';
  }

  if (isDisruptionSource || isBroken) {
    statusLabel = isDisruptionSource ? 'REPORTED ISSUE' : 'CONFLICT';
    statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200/90';
    stepCircleClass = 'bg-rose-50 border-rose-500 text-rose-700';
  } else if (isAtRisk) {
    statusLabel = 'AT RISK';
    statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200/90';
  }

  // Extract meta details
  const meta = booking.meta || {};
  const tags: string[] = Array.isArray(meta.tags)
    ? (meta.tags as string[])
    : [
        booking.cancellationPolicy.policy === 'free'
          ? `Free cancellation (${booking.cancellationPolicy.cutoffHours ?? 24}h before)`
          : booking.cancellationPolicy.policy === 'partial-refund'
          ? `Partial refund (${booking.cancellationPolicy.refundPercent ?? 50}%)`
          : 'Non-refundable',
      ];

  const rightSubtext =
    typeof meta.rightSubtext === 'string'
      ? meta.rightSubtext
      : meta.vehicle
      ? String(meta.vehicle)
      : meta.class && meta.seat
      ? `${meta.class} · Seat ${meta.seat}`
      : meta.roomType
      ? `${meta.nights ? `${meta.nights} nights · ` : ''}${meta.roomType}`
      : meta.charter
      ? String(meta.charter)
      : `${booking.provider}`;

  const rawSubtitle =
    typeof meta.subtitle === 'string'
      ? meta.subtitle
      : meta.flightNumber
      ? `${booking.provider} ${meta.flightNumber}`
      : meta.bookingId
      ? `${booking.provider} · ${meta.bookingId}`
      : booking.provider;

  const normTitle = booking.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normSub = (typeof rawSubtitle === 'string' ? rawSubtitle : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isSubtitleRedundant = normTitle === normSub || (normTitle.length > 5 && (normTitle.includes(normSub) || normSub.includes(normTitle)));
  const subtitle = isSubtitleRedundant ? (meta.terminal ? String(meta.terminal) : null) : rawSubtitle;

  // Format date/time strings
  const startDateObj = new Date(booking.startTime);
  const endDateObj = new Date(booking.endTime);

  const formattedDate = startDateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const startTimeStr = startDateObj.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const endTimeStr = endDateObj.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const diffMs = endDateObj.getTime() - startDateObj.getTime();
  const totalMins = Math.round(diffMs / 60000);
  const diffH = Math.floor(totalMins / 60);
  const diffM = totalMins % 60;
  const durationStr = diffH > 0 ? (diffM > 0 ? `${diffH}h ${diffM}m` : `${diffH}h`) : `${diffM}m`;

  const locationName =
    booking.location.type === 'named'
      ? booking.location.name
      : booking.location.label || `${booking.location.lat}, ${booking.location.lng}`;

  return (
    <div className="relative flex items-start gap-3 sm:gap-4 group w-full min-w-0">
      {/* Numbered Step Circle */}
      <div className="flex flex-col items-center flex-shrink-0 z-10 pt-4">
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-display font-bold text-xs sm:text-sm shadow-2xs transition-transform duration-200 group-hover:scale-105 ${stepCircleClass}`}
        >
          {index}
        </div>
      </div>

      {/* Main Card Container */}
      <div
        className={`flex-1 min-w-0 bg-white rounded-2xl border transition-all duration-200 p-4 sm:p-5 shadow-xs hover:shadow-md mb-4 overflow-hidden ${
          isDisruptionSource || isBroken
            ? 'border-rose-300 ring-2 ring-rose-100'
            : isAtRisk
            ? 'border-amber-300/80'
            : 'border-gray-200/90 hover:border-gray-300/90'
        }`}
      >
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start w-full min-w-0">
          {/* Thumbnail Photo on the Left */}
          <div className="w-full sm:w-36 sm:h-28 h-40 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 relative border border-gray-100/80 shadow-2xs">
            {/* Shimmer skeleton shown until image loads */}
            {!imageUrl && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%]" />
            )}
            {imageUrl && (
              <img
                src={imageUrl}
                alt={booking.title}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-100"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Booking Info Body */}
          <div className="flex-1 min-w-0 flex flex-col justify-between w-full">
            {/* Row 1: Title, Status Badge, Price & Class */}
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="font-display font-bold text-base text-gray-900 leading-snug break-words">
                  {booking.title}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-md font-mono text-3xs sm:text-2xs font-bold uppercase tracking-wider border flex-shrink-0 ${statusBadgeClass}`}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Price & Right Subtext */}
              <div className="text-right flex-shrink-0">
                <div
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex items-center gap-1 cursor-pointer font-display font-bold text-base text-gray-900 hover:text-blue-700 transition-colors"
                >
                  <span>₹{booking.cost.toLocaleString('en-IN')}</span>
                  {expanded ? (
                    <ChevronUp size={14} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-400" />
                  )}
                </div>
                {rightSubtext && (
                  <p className="text-xs text-gray-500 font-medium whitespace-nowrap">{rightSubtext}</p>
                )}
              </div>
            </div>

            {/* Row 2: Subtitle / Flight & Provider Code */}
            {subtitle && (
              <p className="text-xs text-gray-600 font-medium mt-0.5 break-words">
                {subtitle}
              </p>
            )}

            {/* Row 3: Timings, Date & Route */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 font-medium mt-2.5 min-w-0">
              {/* Date */}
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                <span>{formattedDate}</span>
              </div>

              {/* Time — with strikethrough + revised when disrupted */}
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock size={13} className={`flex-shrink-0 ${hasDelay ? 'text-amber-500' : 'text-gray-400'}`} />
                {hasDelay ? (
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {/* Original — struck through */}
                    <span className="line-through text-gray-400">
                      {startTimeStr} – {endTimeStr}
                    </span>
                    {/* Revised */}
                    <span className={`font-semibold flex items-center gap-1 ${isDelaySource ? 'text-rose-600' : 'text-amber-600'}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-md ${isDelaySource ? 'bg-rose-100' : 'bg-amber-100'}">
                        +{effectiveDelay}m
                      </span>
                      {shiftTime(booking.startTime, effectiveDelay)} –{' '}
                      {/* For hotels/activities: end is fixed, don't show revised end */}
                      {booking.type === 'hotel' || booking.type === 'activity' || booking.type === 'event'
                        ? <span className="text-gray-500 line-through">{endTimeStr}</span>
                        : shiftTime(booking.endTime, effectiveDelay)
                      }
                    </span>
                    {/* Date shift if the new time crosses midnight */}
                    {shiftDate(booking.startTime, effectiveDelay) !== formattedDate.split(',').slice(1).join(',').trim() && (
                      <span className={`text-[10px] ${isDelaySource ? 'text-rose-500' : 'text-amber-500'}`}>
                        ({shiftDate(booking.startTime, effectiveDelay)})
                      </span>
                    )}
                  </span>
                ) : (
                  <span>{startTimeStr} – {endTimeStr} ({durationStr})</span>
                )}
              </div>

              {/* Location */}
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                <span className="break-words">{locationName}</span>
              </div>
            </div>

            {/* Row 4: Feature Tags & Report Disruption Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-gray-100 min-w-0">
              {/* Tags */}
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {tags.map((tag, tIdx) => (
                  <span
                    key={tIdx}
                    className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-2xs font-medium border border-gray-200/60 break-words"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Report a Disruption Action Button */}
              <div className="flex-shrink-0">
                <DisruptionTrigger booking={booking} isSource={isDisruptionSource} />
              </div>
            </div>
          </div>
        </div>

        {/* Impact Alert Banner inside card if impacted */}
        {impactedBooking && (
          <div
            className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              isBroken
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider text-2xs mb-0.5">
                {isBroken ? 'SCHEDULE CONFLICT DETECTED' : 'TIGHT TIME WINDOW'}
              </p>
              <p className="leading-relaxed">{impactedBooking.reason}</p>
            </div>
          </div>
        )}

        {/* Expandable Specifications Drawer */}
        {expanded && (
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-2xs text-gray-400 block font-semibold uppercase">SEGMENT ID</span>
                <span className="font-mono text-gray-800 font-medium">{booking.id}</span>
              </div>
              <div>
                <span className="text-2xs text-gray-400 block font-semibold uppercase">STATUS</span>
                <span className="font-semibold text-gray-800 capitalize">{booking.status}</span>
              </div>
              <div>
                <span className="text-2xs text-gray-400 block font-semibold uppercase">BUFFER REQUIRED</span>
                <span className="font-mono text-gray-800 font-medium">{booking.bufferMinutes}m</span>
              </div>
              <div>
                <span className="text-2xs text-gray-400 block font-semibold uppercase">CANCELLATION</span>
                <span className="text-gray-800 capitalize">
                  {booking.cancellationPolicy.policy.replace('-', ' ')}
                </span>
              </div>
            </div>

            {booking.meta && Object.keys(booking.meta).length > 0 && (
              <div className="pt-2">
                <span className="text-2xs text-gray-400 block font-semibold uppercase mb-1">ADDITIONAL SPECS</span>
                <div className="flex flex-wrap gap-2 text-2xs">
                  {Object.entries(booking.meta)
                    .filter(([k]) => !['tags', 'subtitle', 'rightSubtext', 'displayTime'].includes(k))
                    .map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-md font-mono"
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

