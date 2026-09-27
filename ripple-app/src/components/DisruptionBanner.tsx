import { useAppState } from '../App';
import { RotateCcw, ArrowRight, Clock, Ban, AlertTriangle, Zap } from 'lucide-react';

export default function DisruptionBanner() {
  const {
    activeDisruptions,
    impactedBookings,
    selectedItinerary,
    setShowRecoveryOptions,
    removeDisruption,
    clearAllDisruptions,
  } = useAppState();

  if (activeDisruptions.length === 0 || !selectedItinerary) return null;

  const brokenCount  = impactedBookings.filter((b) => b.severity === 'broken').length;
  const atRiskCount  = impactedBookings.filter((b) => b.severity === 'at-risk').length;
  const isDual       = activeDisruptions.length >= 2;

  function formatDelay(mins: number) {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  return (
    <div className="mb-6 rounded-2xl border border-rose-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Thin accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400" />

      <div className="p-4 sm:p-5">
        {/* ── Header row ── */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <Zap size={15} className="text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-900">
                  {isDual ? 'Multiple disruptions reported' : 'Disruption reported'}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 uppercase tracking-wide">
                  Action needed
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {impactedBookings.length > 0
                  ? `${impactedBookings.length} booking${impactedBookings.length > 1 ? 's' : ''} affected downstream`
                  : 'No downstream bookings affected'}
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isDual && (
              <button
                onClick={clearAllDisruptions}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 cursor-pointer transition-colors"
              >
                <RotateCcw size={12} />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={() => setShowRecoveryOptions(true)}
              id="view-recovery-btn"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 cursor-pointer transition-colors shadow-sm"
            >
              <span>See how to fix</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* ── Disruption pills ── */}
        <div className="flex flex-col gap-2">
          {activeDisruptions.map((d) => {
            const booking = selectedItinerary.bookings.find((b) => b.id === d.bookingId);
            const isDelay = d.disruptionType === 'delay';
            const downstream = impactedBookings.filter((ib) =>
              selectedItinerary.bookings.find((b) => b.id === ib.booking.id)
            );

            return (
              <div
                key={d.bookingId}
                className="flex items-start gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100"
              >
                {/* Type icon */}
                <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {isDelay
                    ? <Clock size={13} className="text-rose-600" />
                    : <Ban size={13} className="text-rose-600" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-900 truncate">
                      {booking?.title ?? d.bookingId}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${
                      isDelay
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isDelay ? `+${formatDelay(d.delayMinutes ?? 0)} delay` : 'Cancelled'}
                    </span>
                  </div>
                  {d.reason && (
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">{d.reason}</p>
                  )}
                </div>

                {/* Clear */}
                <button
                  onClick={() => removeDisruption(d.bookingId)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-rose-100 cursor-pointer transition-colors flex-shrink-0"
                  title="Clear this disruption"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Impact summary ── */}
        {impactedBookings.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                Downstream impact
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Summary counts */}
              {brokenCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {brokenCount} conflict{brokenCount > 1 ? 's' : ''}
                </span>
              )}
              {atRiskCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {atRiskCount} at risk
                </span>
              )}
              {/* Individual impacted bookings */}
              {impactedBookings.map((ib) => (
                <span
                  key={ib.booking.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
                    ib.severity === 'broken'
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    ib.severity === 'broken' ? 'bg-rose-500' : 'bg-amber-400'
                  }`} />
                  <span className="truncate max-w-[140px]">{ib.booking.title}</span>
                  {ib.bufferShortfallMinutes > 0 && Number.isFinite(ib.bufferShortfallMinutes) && (
                    <span className="text-[9px] font-bold opacity-70">
                      -{ib.bufferShortfallMinutes}m
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
