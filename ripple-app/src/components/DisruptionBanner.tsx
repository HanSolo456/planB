import { useAppState } from '../App';
import {
  RotateCcw,
  ArrowRight,
  Clock,
  Ban,
  AlertTriangle,
} from 'lucide-react';

export default function DisruptionBanner() {
  const {
    activeDisruption,
    impactedBookings,
    selectedItinerary,
    setShowRecoveryOptions,
    clearDisruption,
  } = useAppState();

  if (!activeDisruption) return null;
  if (!selectedItinerary) return null;

  const sourceBooking = selectedItinerary.bookings.find(
    (b) => b.id === activeDisruption.bookingId
  );

  const brokenCount = impactedBookings.filter((b) => b.severity === 'broken').length;
  const atRiskCount = impactedBookings.filter((b) => b.severity === 'at-risk').length;
  const isDelay = activeDisruption.disruptionType === 'delay';

  const handleViewRecovery = () => {
    setShowRecoveryOptions(true);
  };

  return (
    <div
      className="p-4 mb-6 rounded-[2px] border animate-slide-down"
      style={{
        backgroundColor: 'var(--color-disrupted-bg)',
        borderColor: 'var(--color-disrupted-border)',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Incident Details */}
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-[2px] flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{
              backgroundColor: 'var(--color-disrupted)',
              color: '#FFFFFF',
            }}
          >
            {isDelay ? <Clock size={16} strokeWidth={2.2} /> : <Ban size={16} strokeWidth={2.2} />}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-2xs uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-[2px] bg-[#9E2B25] text-white">
                INCIDENT REPORT
              </span>
              <span className="font-mono text-xs font-semibold text-[#9E2B25]">
                REF: {sourceBooking?.title ?? activeDisruption.bookingId}
              </span>
            </div>

            <h3 className="font-display font-bold text-base text-[#1C1B19] mt-1">
              {isDelay
                ? `Operational Delay: +${activeDisruption.delayMinutes} Minutes Reported`
                : 'Service Cancellation Notice'}
            </h3>

            <p className="text-xs text-[#6B6760] mt-0.5 leading-relaxed font-body">
              {activeDisruption.reason ? (
                <span className="italic font-medium text-[#1C1B19]">"{activeDisruption.reason}" — </span>
              ) : null}
              {impactedBookings.length === 0 ? (
                <span className="font-mono text-xs font-semibold text-[#2B5D5C]">
                  CASCADE CHECK: All downstream buffers intact.
                </span>
              ) : (
                <span className="font-mono text-xs">
                  CASCADE IMPACT:{' '}
                  <strong className="text-[#9E2B25] font-bold">
                    {impactedBookings.length}
                  </strong>{' '}
                  downstream {impactedBookings.length === 1 ? 'booking' : 'bookings'} affected (
                  {brokenCount > 0 && (
                    <span className="text-[#9E2B25] font-bold">
                      {brokenCount} broken
                    </span>
                  )}
                  {brokenCount > 0 && atRiskCount > 0 && ', '}
                  {atRiskCount > 0 && (
                    <span className="text-[#B8552F] font-bold">
                      {atRiskCount} at risk
                    </span>
                  )}
                  )
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:self-center flex-shrink-0 font-mono text-xs">
          <button
            onClick={clearDisruption}
            id="clear-disruption-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-[2px] font-medium text-[#6B6760] hover:text-[#1C1B19] hover:bg-white border border-[#DEDAD2] cursor-pointer transition-colors bg-white/60"
            title="Reset incident and restore clean schedule"
          >
            <RotateCcw size={12} />
            <span>RESET INCIDENT</span>
          </button>

          <button
            onClick={handleViewRecovery}
            id="view-recovery-btn"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[2px] font-bold text-white cursor-pointer transition-colors hover:bg-[#234d4c]"
            style={{
              backgroundColor: 'var(--color-confirmed)',
            }}
          >
            <span>RECOVERY OPTIONS</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
