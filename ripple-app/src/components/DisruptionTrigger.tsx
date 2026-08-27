import { useState } from 'react';
import type { Booking, Disruption } from '../lib/types';
import { useAppState } from '../App';
import {
  AlertTriangle,
  Clock,
  Ban,
  X,
  Check,
  RotateCcw,
} from 'lucide-react';

interface Props {
  booking: Booking;
  isSource?: boolean;
}

export default function DisruptionTrigger({ booking, isSource }: Props) {
  const { activeDisruption, setActiveDisruption, clearDisruption } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const [disruptionType, setDisruptionType] = useState<'delay' | 'cancellation'>('delay');
  const [delayMinutes, setDelayMinutes] = useState<number>(90);
  const [customReason, setCustomReason] = useState<string>('');

  const PRESET_DELAYS = [30, 45, 60, 90, 120, 180];

  const handleOpen = () => {
    if (activeDisruption && activeDisruption.bookingId === booking.id) {
      setDisruptionType(activeDisruption.disruptionType);
      if (activeDisruption.delayMinutes) {
        setDelayMinutes(activeDisruption.delayMinutes);
      }
      setCustomReason(activeDisruption.reason ?? '');
    } else {
      setDisruptionType('delay');
      setDelayMinutes(90);
      setCustomReason('');
    }
    setIsOpen(true);
  };

  const handleConfirm = () => {
    const defaultReason =
      disruptionType === 'delay'
        ? `${booking.provider} scheduled delay (+${delayMinutes}m)`
        : `${booking.title} cancelled by carrier`;

    const disruption: Disruption = {
      bookingId: booking.id,
      disruptionType,
      delayMinutes: disruptionType === 'delay' ? delayMinutes : undefined,
      reason: customReason.trim() || defaultReason,
      timestamp: new Date().toISOString(),
    };

    setActiveDisruption(disruption);
    setIsOpen(false);
  };

  const formatDelayLabel = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${mins}m (${h}h ${m}m)`;
    if (h > 0) return `${mins}m (${h}h)`;
    return `${mins}m`;
  };

  // If this booking is the active disruption source
  if (isSource && activeDisruption) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1.5 font-mono text-2xs">
          <button
            onClick={handleOpen}
            className="flex items-center gap-1 px-2 py-0.5 rounded-[2px] font-semibold cursor-pointer border"
            style={{
              backgroundColor: 'var(--color-disrupted-bg)',
              borderColor: 'var(--color-disrupted-border)',
              color: 'var(--color-disrupted)',
            }}
            title="Edit incident"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#9E2B25]" />
            <span>
              {activeDisruption.disruptionType === 'delay'
                ? `+${activeDisruption.delayMinutes}M DELAY`
                : 'CANCELLED'}
            </span>
          </button>

          <button
            onClick={clearDisruption}
            className="p-1 rounded-[2px] hover:bg-[#EBE7DF] text-[#6B6760] hover:text-[#1C1B19] border border-[#DEDAD2] cursor-pointer"
            title="Reset incident"
            aria-label="Reset incident"
          >
            <RotateCcw size={11} />
          </button>
        </div>

        {isOpen && renderInlineModal()}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        id={`simulate-btn-${booking.id}`}
        className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] font-mono text-2xs text-[#6B6760] hover:text-[#1C1B19] bg-white hover:bg-[#FAF8F5] border border-[#DEDAD2] cursor-pointer transition-colors"
        title="Simulate Disruption on this segment"
      >
        <AlertTriangle size={11} className="text-[#B8552F]" />
        <span>SIMULATE DISRUPTION</span>
      </button>

      {isOpen && renderInlineModal()}
    </div>
  );

  function renderInlineModal() {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B19]/40 backdrop-blur-[2px] animate-slide-down"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}
      >
        <div
          className="w-full max-w-md bg-white rounded-[2px] p-6 border border-[#DEDAD2] shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#DEDAD2]">
            <div>
              <span className="font-mono text-2xs uppercase tracking-widest text-[#969188] font-bold">
                INCIDENT SIMULATOR
              </span>
              <h3 className="font-display font-bold text-lg text-[#1C1B19] leading-snug mt-0.5">
                Simulate Disruption
              </h3>
              <p className="font-mono text-xs text-[#6B6760] truncate max-w-xs mt-0.5">
                TARGET: {booking.title}
              </p>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-[2px] text-[#6B6760] hover:text-[#1C1B19] hover:bg-[#FAF8F5] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Disruption Type Toggle */}
          <div className="mt-4">
            <label className="font-mono text-2xs font-bold uppercase tracking-wider text-[#6B6760] block mb-2">
              SELECT DISRUPTION TYPE
            </label>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setDisruptionType('delay')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-[2px] font-semibold cursor-pointer border transition-colors"
                style={{
                  backgroundColor:
                    disruptionType === 'delay'
                      ? 'var(--color-at-risk-bg)'
                      : '#FFFFFF',
                  borderColor:
                    disruptionType === 'delay'
                      ? 'var(--color-at-risk-border)'
                      : 'var(--color-border)',
                  color:
                    disruptionType === 'delay' ? '#B8552F' : '#6B6760',
                }}
              >
                <Clock size={13} />
                <span>SCHEDULE DELAY</span>
              </button>

              <button
                type="button"
                onClick={() => setDisruptionType('cancellation')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-[2px] font-semibold cursor-pointer border transition-colors"
                style={{
                  backgroundColor:
                    disruptionType === 'cancellation'
                      ? 'var(--color-disrupted-bg)'
                      : '#FFFFFF',
                  borderColor:
                    disruptionType === 'cancellation'
                      ? 'var(--color-disrupted-border)'
                      : 'var(--color-border)',
                  color:
                    disruptionType === 'cancellation' ? '#9E2B25' : '#6B6760',
                }}
              >
                <Ban size={13} />
                <span>CANCELLATION</span>
              </button>
            </div>
          </div>

          {/* Delay controls */}
          {disruptionType === 'delay' ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-2xs font-bold uppercase tracking-wider text-[#6B6760]">
                  DELAY DURATION
                </span>
                <span className="font-bold text-[#B8552F]">
                  +{formatDelayLabel(delayMinutes)}
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="15"
                max="240"
                step="15"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
                className="w-full accent-[#B8552F] cursor-pointer h-1.5 bg-[#EFECE6] rounded-none appearance-none"
              />

              {/* Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 font-mono text-2xs">
                {PRESET_DELAYS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDelayMinutes(mins)}
                    className="px-2 py-1 rounded-[2px] font-medium cursor-pointer border transition-colors"
                    style={{
                      backgroundColor:
                        delayMinutes === mins
                          ? 'var(--color-at-risk-bg)'
                          : '#FFFFFF',
                      borderColor:
                        delayMinutes === mins
                          ? 'var(--color-at-risk-border)'
                          : 'var(--color-border)',
                      color:
                        delayMinutes === mins ? '#B8552F' : '#6B6760',
                    }}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-[2px] bg-[#F9ECEB] border border-[#E3B6B3] flex items-start gap-2.5 text-xs text-[#9E2B25] font-body">
              <Ban size={14} className="flex-shrink-0 mt-0.5" />
              <p>
                Service cancellation will invalidate downstream buffers and trigger a full cascade recalculation on dependent segments.
              </p>
            </div>
          )}

          {/* Reason input */}
          <div className="mt-4">
            <label className="font-mono text-2xs font-bold uppercase tracking-wider text-[#6B6760] block mb-1.5">
              REASON / LOG ENTRY (OPTIONAL)
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={
                disruptionType === 'delay'
                  ? 'e.g. Inbound aircraft late / Weather hold'
                  : 'e.g. Flight cancelled due to crew duty timeout'
              }
              className="w-full px-3 py-2 rounded-[2px] text-xs bg-[#FAF8F5] border border-[#DEDAD2] text-[#1C1B19] placeholder:text-[#969188] focus:outline-none focus:border-[#2B5D5C] font-body"
            />
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-[#DEDAD2] font-mono text-xs">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 rounded-[2px] text-[#6B6760] hover:text-[#1C1B19] hover:bg-[#FAF8F5] border border-[#DEDAD2] cursor-pointer"
            >
              CANCEL
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              id="confirm-disruption-btn"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[2px] font-bold text-white cursor-pointer bg-[#9E2B25] hover:bg-[#85241f] transition-colors"
            >
              <Check size={13} strokeWidth={2.5} />
              <span>APPLY TO MANIFEST</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
