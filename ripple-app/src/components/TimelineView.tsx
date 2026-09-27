import { useState, useMemo } from 'react';
import type { Booking, Itinerary, ImpactedBooking, Disruption } from '../lib/types';
import {
  Plane,
  Car,
  Hotel,
  Ship,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  CheckCircle2,
  CalendarDays,
  Armchair,
  Luggage,
  ShieldCheck,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface Props {
  itinerary: Itinerary;
  sortedBookings: Booking[];
  selectedBookingId: string;
  onSelectBooking: (id: string) => void;
  activeDisruptions?: Disruption[];
  impactedMap?: Map<string, ImpactedBooking>;
  atRiskByBookingId?: Map<string, any[]>;
  onReportDisruption?: (bookingId?: string) => void;
}

interface DayGroup {
  dateKey: string;
  dayShort: string;
  dateShort: string;
  bookings: Booking[];
}

export default function TimelineView({
  itinerary,
  sortedBookings,
  selectedBookingId,
  onSelectBooking,
  activeDisruptions = [],
  impactedMap = new Map(),
  atRiskByBookingId = new Map(),
  onReportDisruption,
}: Props) {
  // Allow inline toggling of row expand details
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Group bookings by date
  const dayGroups: DayGroup[] = useMemo(() => {
    const groups: Record<string, DayGroup> = {};

    sortedBookings.forEach((b) => {
      const [datePart] = b.startTime.split('T');
      if (!groups[datePart]) {
        const [y, m, d] = datePart.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const dayShort = dt.toLocaleDateString('en-US', { weekday: 'short' });
        const dateShort = `${d} ${dt.toLocaleDateString('en-US', { month: 'short' })}`;

        groups[datePart] = {
          dateKey: datePart,
          dayShort,
          dateShort,
          bookings: [],
        };
      }
      groups[datePart].bookings.push(b);
    });

    return Object.values(groups);
  }, [sortedBookings]);

  // Buffer calculation between two bookings
  const calculateBuffer = (prev: Booking, next: Booking) => {
    const prevEnd = new Date(prev.endTime).getTime();
    const nextStart = new Date(next.startTime).getTime();
    const diffMs = nextStart - prevEnd;
    if (diffMs <= 0) return null;

    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;

    const label =
      hours > 0 && mins > 0
        ? `${hours}h ${mins}m buffer`
        : hours > 0
        ? `${hours}h buffer`
        : `${mins} min buffer`;

    const isTight =
      (prev.type === 'flight' && next.type === 'transfer' && diffMinutes < 60) ||
      (prev.type === 'transfer' && next.type === 'flight' && diffMinutes < 90) ||
      (next.status === 'at-risk' && diffMinutes <= 45);

    return { diffMinutes, label, isTight };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 sm:p-7 relative min-w-0 transition-all">
      <div className="space-y-10 sm:space-y-9">
        {dayGroups.map((group) => (
          <div key={group.dateKey} className="relative">
            {/* Mobile-only Horizontal Day Header Divider */}
            <div className="sm:hidden flex items-center justify-between gap-2.5 mb-5 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] text-[#1D4ED8] shadow-2xs font-bold text-xs">
                <CalendarDays size={13} className="text-[#2563EB]" />
                <span>{group.dayShort}, {group.dateShort}</span>
              </div>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-blue-200 via-blue-100 to-transparent" />
              <span className="text-3xs font-mono font-semibold text-gray-400 uppercase tracking-wider">
                {group.bookings.length} {group.bookings.length === 1 ? 'stop' : 'stops'}
              </span>
            </div>

            <div className="flex items-start sm:gap-5 relative">
              {/* Desktop Left Column: Sticky Date Badge */}
              <div className="hidden sm:flex w-16 sm:w-18 flex-shrink-0 pt-0.5 sticky top-20 flex-col">
                <div className="py-2.5 px-1.5 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] text-[#1D4ED8] flex flex-col items-center justify-center text-center shadow-2xs select-none">
                  <span className="text-2xs font-bold text-[#2563EB] leading-none mb-1">
                    {group.dayShort}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#1D4ED8] leading-none whitespace-nowrap">
                    {group.dateShort}
                  </span>
                </div>
              </div>

              {/* Right Column (Mobile: Full Width with Left Spine): Events & Spine */}
              <div className="flex-1 min-w-0 relative pl-5 sm:pl-7 pb-4 sm:pb-2">
                {/* Continuous vertical timeline spine */}
                <div
                  className="absolute left-[5px] sm:left-[7px] top-4 bottom-4 w-[2px] bg-[#E2E8F0] -translate-x-1/2 pointer-events-none"
                  aria-hidden="true"
                />

                <div className="space-y-6 sm:space-y-4">
                  {group.bookings.map((booking) => {
                    const globalIdx = sortedBookings.findIndex((b) => b.id === booking.id);
                    const prevBooking = globalIdx > 0 ? sortedBookings[globalIdx - 1] : null;
                    const bufferInfo = prevBooking ? calculateBuffer(prevBooking, booking) : null;

                    const isDisrupted =
                      activeDisruptions.some((d) => d.bookingId === booking.id) ||
                      impactedMap.get(booking.id)?.severity === 'broken';

                    const isAtRisk =
                      booking.status === 'at-risk' ||
                      impactedMap.get(booking.id)?.severity === 'at-risk' ||
                      (atRiskByBookingId.get(booking.id)?.length ?? 0) > 0 ||
                      (bufferInfo?.isTight && booking.type === 'transfer');

                    const isSelected = selectedBookingId === booking.id;
                    const isExpanded = !!expandedRows[booking.id];

                    // Formatted times
                    const startTimePart = booking.startTime.split('T')[1]?.slice(0, 5) || '00:00';
                    const endTimePart = booking.endTime.split('T')[1]?.slice(0, 5) || '00:00';

                    // Duration text
                    const diffMinutes = Math.round(
                      (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) /
                        (1000 * 60)
                    );
                    const durHours = Math.floor(diffMinutes / 60);
                    const durMins = diffMinutes % 60;
                    const durationStr =
                      booking.meta?.nights
                        ? `${booking.meta.nights} nights`
                        : durHours > 0 && durMins > 0
                        ? `${durHours}h ${durMins}m`
                        : durHours > 0
                        ? `${durHours}h`
                        : `${durMins}m`;

                    // Subtitle / Secondary details
                    const defaultSubtitle: string =
                      booking.type === 'flight'
                        ? booking.title.toLowerCase().includes('return') || booking.id.includes('2')
                          ? 'Air India AI-842 · GOI → DEL'
                          : 'IndiGo 6E-5124 · DEL → GOI'
                        : booking.type === 'transfer'
                        ? 'Goa Miles Executive Transfers · Sedan'
                        : booking.type === 'hotel'
                        ? `${booking.meta?.roomType || 'Deluxe Room'} · Benaulim`
                        : 'Grand Island Sunset Cruise · Mandovi';

                    // Route / location summary
                    const locationLabel =
                      booking.location.type === 'named'
                        ? booking.location.name
                        : booking.location.label || 'Goa, India';

                    // Prevent duplicate title & subtitle (e.g. "IndiGo 6E-5124 DEL→GOI" vs "IndiGo 6E-5124 · DEL → GOI")
                    const normTitle = booking.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const normSub = defaultSubtitle.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const isRedundant =
                      normTitle === normSub ||
                      normTitle.includes(normSub) ||
                      normSub.includes(normTitle);

                    const secondaryText = isRedundant
                      ? booking.meta?.terminal
                        ? String(booking.meta.terminal)
                        : booking.meta?.class && booking.meta?.seat
                        ? `${booking.meta.class} · Seat ${booking.meta.seat}`
                        : booking.meta?.vehicle
                        ? String(booking.meta.vehicle)
                        : locationLabel
                      : defaultSubtitle;

                    return (
                      <div key={booking.id} className="space-y-5 sm:space-y-4">
                        {/* Inter-booking Buffer & Warning Callout */}
                        {bufferInfo && (
                          <div className="relative pl-4 sm:pl-7 py-3 sm:py-2">
                            {/* Buffer badge on the spine */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-200/90 text-gray-600 font-mono text-xs font-semibold shadow-2xs">
                              <Clock size={12} className="text-gray-400" />
                              <span>{bufferInfo.label}</span>
                            </div>

                            {/* Tight Connection Warning Card */}
                            {bufferInfo.isTight && (
                              <div className="mt-4 sm:mt-2.5 p-4 sm:p-4 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] shadow-2xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" />
                                  <h4 className="font-bold text-xs sm:text-sm text-amber-950">
                                    Tight connection
                                  </h4>
                                </div>
                                <p className="text-xs text-amber-900/80 pl-4.5 leading-relaxed">
                                  Only {bufferInfo.diffMinutes} minutes between flight and transfer. Consider a larger buffer.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Event Card */}
                        <div
                          onClick={() => {
                            onSelectBooking(booking.id);
                            setExpandedRows((prev) => ({ ...prev, [booking.id]: !prev[booking.id] }));
                          }}
                          className={`group relative rounded-2xl p-4 sm:p-4 transition-all cursor-pointer border shadow-2xs ${
                            isSelected
                              ? 'bg-blue-50/50 border-blue-400/90 ring-1 ring-blue-500/20'
                              : 'bg-white hover:bg-gray-50/70 border-gray-200/90 hover:border-gray-300'
                          }`}
                        >
                          {/* Dot on the timeline spine */}
                          <div
                            className={`absolute -left-[16px] sm:-left-[24px] top-5 sm:top-1/2 sm:-translate-y-1/2 w-2.5 h-2.5 rounded-full ring-4 ring-white z-10 transition-colors ${
                              isDisrupted
                                ? 'bg-rose-600'
                                : isAtRisk
                                ? 'bg-[#EA580C]'
                                : 'bg-[#1E40AF]'
                            }`}
                          />

                          {/* ======================================================== */}
                          {/* MOBILE LAYOUT (< sm): Spacious, De-congested 2-Tier Design */}
                          {/* ======================================================== */}
                          <div className="sm:hidden flex flex-col gap-3">
                            {/* Tier 1: Category Icon + Title/Details + Status Badge + Chevron */}
                            <div className="flex items-start justify-between gap-3 min-w-0">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                {/* Category Icon */}
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs border ${
                                    isDisrupted
                                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                                      : isAtRisk
                                      ? 'bg-[#FFEDD5] text-[#EA580C] border-[#FED7AA]'
                                      : 'bg-[#EFF6FF] text-[#2563EB] border-blue-100'
                                  }`}
                                >
                                  {booking.type === 'flight' ? (
                                    <Plane size={16} />
                                  ) : booking.type === 'transfer' ? (
                                    <Car size={16} />
                                  ) : booking.type === 'hotel' ? (
                                    <Hotel size={16} />
                                  ) : (
                                    <Ship size={16} />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h3 className="font-display font-bold text-sm text-gray-900 leading-tight truncate">
                                    {booking.title}
                                  </h3>
                                  {secondaryText && (
                                    <p className="text-2xs text-gray-500 font-medium truncate mt-0.5">
                                      {secondaryText}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-start gap-1.5 flex-shrink-0 pt-0.5">
                                {/* Status Badge */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-mono font-bold uppercase tracking-wider border shadow-2xs ${
                                    isDisrupted
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : isAtRisk
                                      ? 'bg-[#FFEDD5] text-[#C2410C] border-[#FDBA74]'
                                      : 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]'
                                  }`}
                                >
                                  {isAtRisk && <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />}
                                  <span>{isDisrupted ? 'DISRUPTED' : isAtRisk ? 'AT RISK' : 'CONFIRMED'}</span>
                                </span>

                                {/* Chevron button */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleExpand(booking.id, e)}
                                  className="p-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer rounded"
                                  aria-label="Toggle details"
                                >
                                  {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                              </div>
                            </div>

                            {/* Tier 2: Time Window & Duration Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="font-bold text-gray-900">{startTimePart}</span>
                                <span className="text-gray-400 text-2xs">→</span>
                                <span className="font-semibold text-gray-700">{endTimePart}</span>
                                <span className="ml-1.5 text-3xs font-mono font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200/60">
                                  {durationStr}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-2xs text-gray-500 font-medium truncate max-w-[130px]">
                                <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                                <span className="truncate">{locationLabel.split(',')[0]}</span>
                              </div>
                            </div>
                          </div>

                          {/* ======================================================== */}
                          {/* DESKTOP LAYOUT (>= sm): Spacious Single-Row Layout */}
                          {/* ======================================================== */}
                          <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
                            {/* Left Side: Time + Icon + Title */}
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                              {/* Time */}
                              <span className="font-mono font-bold text-xs sm:text-sm text-gray-800 w-12 sm:w-14 flex-shrink-0">
                                {startTimePart}
                              </span>

                              {/* Category Circle Icon */}
                              <div
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs border ${
                                  isDisrupted
                                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                                    : isAtRisk
                                    ? 'bg-[#FFEDD5] text-[#EA580C] border-[#FED7AA]'
                                    : 'bg-[#EFF6FF] text-[#2563EB] border-blue-100'
                                }`}
                              >
                                {booking.type === 'flight' ? (
                                  <Plane size={18} />
                                ) : booking.type === 'transfer' ? (
                                  <Car size={18} />
                                ) : booking.type === 'hotel' ? (
                                  <Hotel size={18} />
                                ) : (
                                  <Ship size={18} />
                                )}
                              </div>

                              {/* Titles */}
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                                  {booking.title}
                                </h3>
                                {secondaryText && (
                                  <p className="text-2xs sm:text-xs text-gray-500 truncate mt-0.5">
                                    {secondaryText}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right Side: Status Badge + Duration + Chevron */}
                            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                              {/* Status Badge */}
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs sm:text-2xs font-mono font-bold uppercase tracking-wider border ${
                                  isDisrupted
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : isAtRisk
                                    ? 'bg-[#FFEDD5] text-[#C2410C] border-[#FDBA74]'
                                    : 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]'
                                }`}
                              >
                                {isAtRisk && <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />}
                                <span>{isDisrupted ? 'DISRUPTED' : isAtRisk ? 'AT RISK' : 'CONFIRMED'}</span>
                              </span>

                              {/* Duration */}
                              <span className="text-xs text-gray-500 font-medium">
                                {durationStr}
                              </span>

                              {/* Expand chevron */}
                              <button
                                type="button"
                                onClick={(e) => toggleExpand(booking.id, e)}
                                className="p-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer rounded hover:bg-gray-100"
                                aria-label="Toggle details"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </div>

                          {/* ======================================================== */}
                          {/* INLINE EXPANDED DETAILS (Responsive & Rich on Mobile) */}
                          {/* ======================================================== */}
                          {isExpanded && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-3 pt-3 border-t border-gray-100 sm:ml-16 sm:pl-0 space-y-2.5 text-xs text-gray-600 animate-fadeIn"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50/80 p-3 rounded-xl border border-gray-200/80">
                                <p className="flex items-center gap-2 text-gray-700 font-medium">
                                  <Clock size={13} className="text-blue-600 flex-shrink-0" />
                                  <span>
                                    {startTimePart} → {endTimePart} ({durationStr})
                                  </span>
                                </p>
                                <p className="flex items-center gap-2 text-gray-700 font-medium">
                                  <MapPin size={13} className="text-rose-500 flex-shrink-0" />
                                  <span className="truncate">{locationLabel}</span>
                                </p>
                                {typeof booking.meta?.rightSubtext === 'string' && (
                                  <p className="flex items-center gap-2 text-gray-600 col-span-1 sm:col-span-2">
                                    <Armchair size={13} className="text-indigo-500 flex-shrink-0" />
                                    <span>{booking.meta.rightSubtext}</span>
                                  </p>
                                )}
                                <p className="flex items-center gap-2 text-gray-600">
                                  <Luggage size={13} className="text-amber-600 flex-shrink-0" />
                                  <span>
                                    {booking.type === 'flight'
                                      ? '15 kg check-in + 7 kg cabin'
                                      : 'Included baggage'}
                                  </span>
                                </p>
                                <p className="flex items-center gap-2 text-gray-600">
                                  <ShieldCheck size={13} className="text-emerald-600 flex-shrink-0" />
                                  <span>
                                    {booking.cancellationPolicy.policy === 'free'
                                      ? 'Free cancellation'
                                      : booking.cancellationPolicy.policy === 'partial-refund'
                                      ? 'Partial refund available'
                                      : 'Non-refundable'}
                                  </span>
                                </p>
                              </div>

                              {/* Mobile Quick Action Buttons inside Expanded Card */}
                              <div className="flex items-center justify-between gap-2 pt-1 sm:hidden">
                                {onReportDisruption && (
                                  <button
                                    type="button"
                                    onClick={() => onReportDisruption(booking.id)}
                                    className="flex-1 py-1.5 px-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-2xs font-semibold flex items-center justify-center gap-1.5 hover:bg-rose-100 transition-colors"
                                  >
                                    <AlertTriangle size={12} className="text-rose-600" />
                                    <span>Report issue</span>
                                  </button>
                                )}
                                <a
                                  href="#selected-booking-detail"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const el = document.getElementById('selected-booking-detail');
                                    el?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className="flex-1 py-1.5 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-2xs font-semibold flex items-center justify-center gap-1 transition-colors"
                                >
                                  <span>View full card</span>
                                  <ArrowRight size={12} />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
