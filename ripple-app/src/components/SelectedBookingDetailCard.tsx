import { useState } from 'react';
import type { Booking, Itinerary } from '../lib/types';
import { useWikipediaImage, getWikipediaQueryForBooking } from '../lib/useWikipediaImage';
import {
  CalendarDays,
  Clock,
  MapPin,
  Armchair,
  Luggage,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Radio,
  ExternalLink,
  Shield,
  Plane,
  Car,
  Hotel,
  Ship,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  booking: Booking;
  itinerary: Itinerary;
  onReportDisruption?: () => void;
  isDisrupted?: boolean;
  isAtRisk?: boolean;
}

export default function SelectedBookingDetailCard({
  booking,
  itinerary,
  onReportDisruption,
  isDisrupted = false,
  isAtRisk = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'policies' | 'live'>('details');
  const [isImageCollapsed, setIsImageCollapsed] = useState(false);

  // Wikipedia image query
  const { query: wikiQuery, fallback: wikiFallback } = getWikipediaQueryForBooking(
    booking,
    itinerary.destination
  );
  const photoUrl = useWikipediaImage(wikiQuery, wikiFallback);

  // Parse dates and times cleanly
  const [startDatePart, startTimePart] = booking.startTime.split('T');
  const [, endTimePart] = booking.endTime.split('T');
  const [y, m, d] = startDatePart.split('-').map(Number);
  const dt = new Date(y, m - 1, d);

  const fullDateFormatted = `${dt.toLocaleDateString('en-US', { weekday: 'short' })}, ${d} ${dt.toLocaleDateString('en-US', { month: 'short' })} ${y}`;

  const startTimeStr = startTimePart ? startTimePart.slice(0, 5) : '00:00';
  const endTimeStr = endTimePart ? endTimePart.slice(0, 5) : '00:00';

  // Duration
  const diffMinutes = Math.round(
    (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / (1000 * 60)
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

  // Title and flight / provider info
  const flightNumberMatch = booking.title.match(/(?:6E|AI|UK|SG|QP|IX|G8)[-\s]?\d+/i) ||
    booking.provider.match(/(?:6E|AI|UK|SG|QP|IX|G8)[-\s]?\d+/i);

  const mainTitle =
    booking.type === 'flight'
      ? flightNumberMatch
        ? `${booking.provider.includes('IndiGo') ? 'IndiGo' : booking.provider.includes('Air India') ? 'Air India' : 'Flight'} ${flightNumberMatch[0]}`
        : booking.title
      : booking.title;

  const subtitle =
    booking.type === 'flight'
      ? booking.title.toLowerCase().includes('return')
        ? 'Return Flight'
        : 'Flight to Goa'
      : booking.type === 'transfer'
      ? 'Airport Transfer'
      : booking.type === 'hotel'
      ? `Resort Stay · ${booking.meta?.roomType || 'Deluxe Room'}`
      : booking.type === 'activity'
      ? 'Sunset Cruise & Sightseeing'
      : booking.title;

  // Route / Location
  const routeString =
    booking.type === 'flight'
      ? booking.title.toLowerCase().includes('return') || booking.id.includes('2')
        ? 'Goa Dabolim (GOI) Terminal 1 → New Delhi (DEL) Terminal 3'
        : 'New Delhi (DEL) Terminal 3 → Goa Dabolim (GOI) Terminal 1'
      : booking.type === 'transfer'
      ? 'Goa Dabolim Airport (GOI) → W Goa Resort, Vagator'
      : booking.location.type === 'named'
      ? booking.location.name
      : booking.location.label || 'Goa, India';

  // Seat / Vehicle / Room
  const seatVehicleRoom: string =
    typeof booking.meta?.rightSubtext === 'string'
      ? booking.meta.rightSubtext
      : booking.type === 'flight'
      ? `${(booking.meta?.class as string) || 'Economy'} · Seat ${(booking.meta?.seat as string) || '14F'}`
      : booking.type === 'transfer'
      ? 'Toyota Innova Crysta · Dedicated Driver'
      : booking.type === 'hotel'
      ? `${(booking.meta?.roomType as string) || 'Ocean View Suite'} · King Bed`
      : 'Private Charter (1 Guest)';

  // Baggage / Extras
  const baggageExtras =
    booking.type === 'flight'
      ? '15 kg check-in + 7 kg cabin'
      : booking.type === 'transfer'
      ? 'Up to 4 large bags + air-conditioned cab'
      : booking.type === 'hotel'
      ? 'Buffet breakfast included for 2 guests'
      : 'Dolphin sighting & refreshments included';

  // Cost formatted
  const formattedCost = `₹${booking.cost.toLocaleString('en-IN')} (Taxes included)`;

  // Refund / Cancellation policy
  const refundPolicyStr =
    booking.cancellationPolicy.policy === 'free'
      ? `Free cancellation (${booking.cancellationPolicy.cutoffHours}h prior)`
      : booking.cancellationPolicy.policy === 'partial-refund'
      ? `Partial refund (₹2,500 fee)`
      : 'Non-refundable';

  // Status tag configuration
  const statusLabel = isDisrupted
    ? 'DISRUPTED'
    : isAtRisk || booking.status === 'at-risk'
    ? 'AT RISK'
    : 'CONFIRMED';

  const statusBadgeClass = isDisrupted
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : isAtRisk || booking.status === 'at-risk'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]';

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden flex flex-col transition-all">
      {/* Top Hero Photo */}
      <div className="relative w-full overflow-hidden bg-gray-900 group">
        {!isImageCollapsed && (
          <div className="relative w-full h-44 sm:h-52 bg-slate-900 overflow-hidden">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={mainTitle}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-950 text-white/60">
                {booking.type === 'flight' ? (
                  <Plane size={36} className="text-white/40" />
                ) : booking.type === 'transfer' ? (
                  <Car size={36} className="text-white/40" />
                ) : booking.type === 'hotel' ? (
                  <Hotel size={36} className="text-white/40" />
                ) : (
                  <Ship size={36} className="text-white/40" />
                )}
                <span className="text-2xs font-mono mt-2 text-white/50">WIKIPEDIA MEDIA</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
          </div>
        )}

        {/* Collapse / Expand image button */}
        <button
          onClick={() => setIsImageCollapsed((c) => !c)}
          title={isImageCollapsed ? 'Show photo' : 'Collapse photo'}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer border border-white/20 z-10"
          aria-label="Toggle photo"
        >
          {isImageCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Card Body */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* Title & Status row */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display font-bold text-lg sm:text-xl text-gray-900 tracking-tight leading-tight">
              {mainTitle}
            </h2>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-mono font-bold uppercase tracking-wider border ${statusBadgeClass}`}
              >
                {statusLabel === 'AT RISK' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                <span>{statusLabel}</span>
              </span>
              <ChevronDown size={18} className="text-gray-400" />
            </div>
          </div>

          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
            {subtitle}
          </p>
        </div>

        {/* Sub-tabs: Details / Policies / Live Status */}
        <div className="flex items-center gap-1 p-1 bg-gray-50/80 rounded-xl border border-gray-100 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'bg-[#EBF3FF] text-[#1D4ED8] shadow-2xs border border-[#DBEAFE]/80'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              activeTab === 'policies'
                ? 'bg-[#EBF3FF] text-[#1D4ED8] shadow-2xs border border-[#DBEAFE]/80'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Policies
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              activeTab === 'live'
                ? 'bg-[#EBF3FF] text-[#1D4ED8] shadow-2xs border border-[#DBEAFE]/80'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Live Status
          </button>
        </div>

        {/* Tab 1: Details View */}
        {activeTab === 'details' && (
          <div className="space-y-3.5 pt-1 text-xs text-gray-700">
            {/* 1. Date */}
            <div className="flex items-center gap-3">
              <div className="w-5 flex justify-center text-gray-500 flex-shrink-0">
                <CalendarDays size={16} />
              </div>
              <span className="font-medium text-gray-800">{fullDateFormatted}</span>
            </div>

            {/* 2. Time & Duration */}
            <div className="flex items-center gap-3">
              <div className="w-5 flex justify-center text-gray-500 flex-shrink-0">
                <Clock size={16} />
              </div>
              <span className="font-medium text-gray-800 font-mono">
                {startTimeStr} → {endTimeStr} <span className="text-gray-500 font-sans">({durationStr})</span>
              </span>
            </div>

            {/* 3. Location / Route */}
            <div className="flex items-start gap-3">
              <div className="w-5 flex justify-center text-gray-500 flex-shrink-0 mt-0.5">
                <MapPin size={16} />
              </div>
              <span className="font-medium text-gray-800 leading-snug">{routeString}</span>
            </div>

            {/* 4. Seat / Class / Room */}
            <div className="flex items-center gap-3">
              <div className="w-5 flex justify-center text-gray-500 flex-shrink-0">
                <Armchair size={16} />
              </div>
              <span className="font-medium text-gray-800">{seatVehicleRoom}</span>
            </div>

            {/* 5. Baggage / Extras */}
            <div className="flex items-center gap-3">
              <div className="w-5 flex justify-center text-gray-500 flex-shrink-0">
                <Luggage size={16} />
              </div>
              <span className="font-medium text-gray-800">{baggageExtras}</span>
            </div>

            {/* 6. Cost */}
            <div className="flex items-center gap-3">
              <div className="w-5 flex justify-center text-gray-500 flex-shrink-0 font-semibold text-sm">
                ₹
              </div>
              <span className="font-medium text-gray-800">{formattedCost}</span>
            </div>

            {/* 7. Refund Policy */}
            <div className="flex items-center gap-3">
              <div className="w-5 flex justify-center text-gray-500 flex-shrink-0">
                <ShieldCheck size={16} />
              </div>
              <span className="font-medium text-gray-800">{refundPolicyStr}</span>
            </div>
          </div>
        )}

        {/* Tab 2: Policies View */}
        {activeTab === 'policies' && (
          booking.type === 'hotel' ? (
            <div className="space-y-3 pt-1 text-xs text-gray-700 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
              <div>
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Shield size={13} className="text-blue-600" />
                  <span>Cancellation Terms</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  {booking.cancellationPolicy.policy === 'free'
                    ? `Free cancellation up to ${booking.cancellationPolicy.cutoffHours ?? 48} hours prior to check-in. Instant automated refund initiation.`
                    : booking.cancellationPolicy.policy === 'partial-refund'
                    ? `Partial refund (${booking.cancellationPolicy.refundPercent ?? 50}%) permitted prior to check-in.`
                    : 'Strict non-refundable booking.'}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60">
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Hotel size={13} className="text-blue-600" />
                  <span>Check-in & Stay Inclusions</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  Standard check-in from 14:00 IST · Check-out by 11:00 IST. Valid Govt photo ID required. Complimentary breakfast & high-speed Wi-Fi included.
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60">
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-600" />
                  <span>Late Arrival & Modifications</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  24-hour front desk. Please notify reception for arrivals after 23:00 to guarantee room hold.
                </p>
              </div>
            </div>
          ) : booking.type === 'activity' ? (
            <div className="space-y-3 pt-1 text-xs text-gray-700 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
              <div>
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Shield size={13} className="text-blue-600" />
                  <span>Cancellation Terms</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  {booking.cancellationPolicy.policy === 'free'
                    ? `100% refund if cancelled up to ${booking.cancellationPolicy.cutoffHours ?? 24} hours before departure.`
                    : booking.cancellationPolicy.policy === 'partial-refund'
                    ? `50% refund if cancelled 24 hours prior; non-refundable within 24 hours.`
                    : 'Strict non-refundable excursion charter.'}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60">
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Ship size={13} className="text-blue-600" />
                  <span>Safety & Inclusions</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  Certified life jackets and crew on board. Dolphin sighting, sunset cruise, and complimentary refreshments included.
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60">
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-600" />
                  <span>Weather & Schedule Guarantee</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  Tours operate subject to maritime weather. Operator provides free rescheduling or 100% refund in case of adverse sea conditions.
                </p>
              </div>
            </div>
          ) : booking.type === 'transfer' ? (
            <div className="space-y-3 pt-1 text-xs text-gray-700 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
              <div>
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Shield size={13} className="text-blue-600" />
                  <span>Cancellation Terms</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  {booking.cancellationPolicy.policy === 'free'
                    ? `Free cancellation up to ${booking.cancellationPolicy.cutoffHours ?? 6} hours before scheduled pickup.`
                    : 'Standard transfer cancellation terms apply.'}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60">
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Car size={13} className="text-blue-600" />
                  <span>Vehicle & Luggage Capacity</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  Air-conditioned executive vehicle. Accommodates up to 4 large suitcases plus cabin luggage.
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60">
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-600" />
                  <span>Flight Delay Guarantee</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  Complimentary 60 minutes waiting time from actual flight touchdown. Pickup adjusts automatically to flight delays.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1 text-xs text-gray-700 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
              <div>
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Shield size={13} className="text-blue-600" />
                  <span>Cancellation Terms</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  {booking.cancellationPolicy.policy === 'free'
                    ? `100% refund if cancelled up to ${booking.cancellationPolicy.cutoffHours} hours before departure. Instant automated refund initiation.`
                    : booking.cancellationPolicy.policy === 'partial-refund'
                    ? 'Partial refund permitted up to 24 hours prior. Standard airline deduction fee applies (approx ₹2,500).'
                    : 'Strict non-refundable fare rules apply. Rescheduling credit may be issued in emergency circumstances.'}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60">
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Luggage size={13} className="text-blue-600" />
                  <span>Baggage & Allowance</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  Check-in: 15 kg per passenger. Cabin luggage: 1 hand baggage up to 7 kg + personal laptop bag.
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200/60">
                <p className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-600" />
                  <span>Reschedule Allowance</span>
                </p>
                <p className="text-gray-600 leading-relaxed text-2xs">
                  Reschedule allowed up to 2 hours before departure subject to fare difference and carrier administrative fee.
                </p>
              </div>
            </div>
          )
        )}

        {/* Tab 3: Live Status View */}
        {activeTab === 'live' && (
          booking.type === 'hotel' ? (
            <div className="space-y-3 pt-1 text-xs text-gray-700 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between pb-2 border-b border-blue-100/80">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDisrupted ? 'bg-rose-400' : isAtRisk ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDisrupted ? 'bg-rose-500' : isAtRisk ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  </span>
                  <span className={`font-bold ${isDisrupted ? 'text-rose-800' : isAtRisk ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {isDisrupted ? 'Reservation Disrupted' : isAtRisk ? 'Late Arrival Advised' : 'Operational & Confirmed'}
                  </span>
                </div>
                <span className="font-mono text-3xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  FRONT DESK DIRECT
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/70">
                  <span className="text-gray-400 block font-mono text-3xs uppercase">Check-in Window</span>
                  <span className="font-bold text-gray-900 text-xs">From 14:00 · 24h Desk</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/70">
                  <span className="text-gray-400 block font-mono text-3xs uppercase">Check-out Time</span>
                  <span className="font-bold text-gray-900 text-xs">By 11:00 IST</span>
                </div>
              </div>

              <div className="text-2xs text-gray-600 flex items-center gap-1.5 pt-1">
                <Info size={12} className="text-blue-600 flex-shrink-0" />
                <span>Front desk notified of schedule. Room held under confirmation {booking.meta?.confirmation as string || 'MAR-9043210'}.</span>
              </div>
            </div>
          ) : booking.type === 'activity' ? (
            <div className="space-y-3 pt-1 text-xs text-gray-700 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between pb-2 border-b border-blue-100/80">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDisrupted ? 'bg-rose-400' : isAtRisk ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDisrupted ? 'bg-rose-500' : isAtRisk ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  </span>
                  <span className={`font-bold ${isDisrupted ? 'text-rose-800' : isAtRisk ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {isDisrupted ? 'Schedule Disrupted' : isAtRisk ? 'Schedule At Risk' : 'Operational & On Schedule'}
                  </span>
                </div>
                <span className="font-mono text-3xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  OPERATOR DISPATCH
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/70">
                  <span className="text-gray-400 block font-mono text-3xs uppercase">Boarding Location</span>
                  <span className="font-bold text-gray-900 text-xs">Chapora River Jetty</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/70">
                  <span className="text-gray-400 block font-mono text-3xs uppercase">Marine Conditions</span>
                  <span className="font-bold text-emerald-700 text-xs">Calm Sea · Clear Sunset</span>
                </div>
              </div>

              <div className="text-2xs text-gray-600 flex items-center gap-1.5 pt-1">
                <Info size={12} className="text-blue-600 flex-shrink-0" />
                <span>Private charter crew on standby. Boarding commences 15 mins before scheduled departure.</span>
              </div>
            </div>
          ) : booking.type === 'transfer' ? (
            <div className="space-y-3 pt-1 text-xs text-gray-700 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between pb-2 border-b border-blue-100/80">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDisrupted ? 'bg-rose-400' : isAtRisk ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDisrupted ? 'bg-rose-500' : isAtRisk ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  </span>
                  <span className={`font-bold ${isDisrupted ? 'text-rose-800' : isAtRisk ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {isDisrupted ? 'Flight Delay Conflict' : isAtRisk ? 'Pickup Time Adjusting' : 'Vehicle Dispatched'}
                  </span>
                </div>
                <span className="font-mono text-3xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  FLEET DISPATCH
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/70">
                  <span className="text-gray-400 block font-mono text-3xs uppercase">Pickup Point</span>
                  <span className="font-bold text-gray-900 text-xs">GOI · Arrival Gate 4</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/70">
                  <span className="text-gray-400 block font-mono text-3xs uppercase">Assigned Cab</span>
                  <span className="font-bold text-gray-900 text-xs">{booking.meta?.vehicle as string || 'Toyota Innova Crysta'}</span>
                </div>
              </div>

              <div className="text-2xs text-gray-600 flex items-center gap-1.5 pt-1">
                <Info size={12} className="text-blue-600 flex-shrink-0" />
                <span>Driver synchronizes with actual flight arrival time. Name placard displayed at exit.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1 text-xs text-gray-700 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between pb-2 border-b border-blue-100/80">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDisrupted ? 'bg-rose-400' : isAtRisk ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDisrupted ? 'bg-rose-500' : isAtRisk ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  </span>
                  <span className={`font-bold ${isDisrupted ? 'text-rose-800' : isAtRisk ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {isDisrupted ? 'Flight Delayed' : isAtRisk ? 'Schedule At Risk' : 'Operational & On-Time'}
                  </span>
                </div>
                <span className="font-mono text-3xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  LIVE RADAR
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/70">
                  <span className="text-gray-400 block font-mono text-3xs uppercase">Departure Terminal</span>
                  <span className="font-bold text-gray-900 text-xs">
                    {booking.title.toLowerCase().includes('return') || booking.id.includes('2')
                      ? 'GOI · Terminal 1'
                      : 'Terminal 3 · Gate 42B'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/70">
                  <span className="text-gray-400 block font-mono text-3xs uppercase">Arrival Terminal</span>
                  <span className="font-bold text-gray-900 text-xs">
                    {booking.title.toLowerCase().includes('return') || booking.id.includes('2')
                      ? 'DEL · Terminal 3'
                      : 'GOI · Terminal 1'}
                  </span>
                </div>
              </div>

              <div className="text-2xs text-gray-600 flex items-center gap-1.5 pt-1">
                <Info size={12} className="text-blue-600 flex-shrink-0" />
                <span>Gate opens 45 mins before scheduled departure. Web check-in completed.</span>
              </div>
            </div>
          )
        )}

        {/* Bottom CTA Button: Report a disruption */}
        {onReportDisruption && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onReportDisruption}
              className="w-full py-3 px-4 rounded-xl border border-rose-200/90 bg-rose-50/50 hover:bg-rose-50 text-rose-600 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs hover:shadow-xs active:scale-[0.99]"
            >
              <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
              <span>Report a disruption</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
