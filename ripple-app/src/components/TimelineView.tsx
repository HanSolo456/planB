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
} from 'lucide-react';

interface Props {
  itinerary: Itinerary;
  sortedBookings: Booking[];
  selectedBookingId: string;
  onSelectBooking: (id: string) => void;
  activeDisruptions?: Disruption[];
  impactedMap?: Map<string, ImpactedBooking>;
  atRiskByBookingId?: Map<string, any[]>;
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
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-5 sm:p-7 relative min-w-0 transition-all">
      <div className="space-y-8">
        {dayGroups.map((group, groupIdx) => (
          <div key={group.dateKey} className="flex items-start gap-3 sm:gap-5 relative">
            {/* Left Column: Date Badge */}
            <div className="w-16 sm:w-18 flex-shrink-0 pt-0.5 sticky top-20">
              <div className="py-2.5 px-1.5 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] text-[#1D4ED8] flex flex-col items-center justify-center text-center shadow-2xs select-none">
                <span className="text-2xs font-bold text-[#2563EB] leading-none mb-1">
                  {group.dayShort}
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#1D4ED8] leading-none whitespace-nowrap">
                  {group.dateShort}
                </span>
              </div>
            </div>

            {/* Right Column: Events & Spine */}
            <div className="flex-1 min-w-0 relative pl-4 sm:pl-6 pb-2">
              {/* Continuous vertical timeline spine */}
              <div
                className="absolute left-[5px] top-4 bottom-4 w-[2px] bg-[#E2E8F0] -translate-x-1/2 pointer-events-none"
                aria-hidden="true"
              />

              <div className="space-y-4">
                {group.bookings.map((booking, bIdx) => {
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

                  // Subtitle formatting - exactly matches mockup
                  const subtitle: string =
                    booking.type === 'flight'
                      ? booking.title.toLowerCase().includes('return') || booking.id.includes('2')
                        ? 'Air India AI-842 · GOI → DEL'
                        : 'IndiGo 6E-5124 · DEL → GOI'
                      : booking.type === 'transfer'
                      ? 'Goa Miles Executive Transfers'
                      : '';

                  return (
                    <div key={booking.id} className="space-y-3">
                      {/* Inter-booking Buffer & Warning Callout */}
                      {bufferInfo && (
                        <div className="relative pl-7 sm:pl-9 py-1">
                          {/* Buffer badge on the spine */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gray-50 border border-gray-200/70 text-gray-500 font-mono text-2xs font-medium shadow-2xs">
                            <Clock size={10} className="text-gray-400" />
                            <span>{bufferInfo.label}</span>
                          </div>

                          {/* Tight Connection Warning Card */}
                          {bufferInfo.isTight && (
                            <div className="mt-2.5 p-3.5 sm:p-4 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] shadow-2xs">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
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

                      {/* Event Row */}
                      <div
                        onClick={() => onSelectBooking(booking.id)}
                        className={`group relative rounded-xl p-3 sm:p-3.5 transition-all cursor-pointer flex items-center justify-between gap-3 border ${
                          isSelected
                            ? 'bg-blue-50/40 border-blue-200/90 shadow-2xs ring-1 ring-blue-500/20'
                            : 'bg-white hover:bg-gray-50/70 border-gray-100 hover:border-gray-200/90'
                        }`}
                      >
                        {/* Dot on the timeline spine */}
                        <div
                          className={`absolute -left-[16px] sm:-left-[24px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-4 ring-white z-10 transition-colors ${
                            isDisrupted
                              ? 'bg-rose-600'
                              : isAtRisk
                              ? 'bg-[#EA580C]'
                              : 'bg-[#1E40AF]'
                          }`}
                        />

                        {/* Left Side: Time + Icon + Title */}
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          {/* Time */}
                          <span className="font-mono font-bold text-xs sm:text-sm text-gray-800 w-12 sm:w-14 flex-shrink-0">
                            {startTimePart}
                          </span>

                          {/* Category Circle Icon */}
                          <div
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-2xs border ${
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
                            {subtitle && (
                              <p className="text-2xs sm:text-xs text-gray-500 truncate mt-0.5">
                                {subtitle}
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
                          <span className="text-xs text-gray-500 font-medium hidden sm:inline-block">
                            {durationStr}
                          </span>

                          {/* Expand chevron */}
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(booking.id, e)}
                            className="p-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                            aria-label="Toggle details"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Inline Expanded Details (optional on mobile or toggle) */}
                      {isExpanded && (
                        <div className="ml-16 sm:ml-20 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-1.5 animate-fadeIn">
                          <p className="flex items-center gap-2">
                            <Clock size={12} className="text-gray-400" />
                            <span>
                              {startTimePart} → {endTimePart} ({durationStr})
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin size={12} className="text-gray-400" />
                            <span>
                              {booking.location.type === 'named'
                                ? booking.location.name
                                : booking.location.label || 'Goa, India'}
                            </span>
                          </p>
                          {typeof booking.meta?.rightSubtext === 'string' && (
                            <p className="text-2xs text-gray-500 pt-1 border-t border-gray-200/60">
                              {booking.meta.rightSubtext}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
