import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Booking, Disruption } from '../lib/types';
import { useAppState } from '../App';
import {
  AlertTriangle,
  Clock,
  Ban,
  X,
  Check,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface Props {
  booking: Booking;
  isSource?: boolean;
  buttonClassName?: string;
}

const PRESET_DELAYS = [30, 45, 60, 90, 120, 180];

export default function DisruptionTrigger({ booking, isSource, buttonClassName }: Props) {
  const { activeDisruptions, addDisruption, removeDisruption, hasCapacityForAnotherDisruption } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const [disruptionType, setDisruptionType] = useState<'delay' | 'cancellation'>('delay');
  const [hours, setHours] = useState('1');
  const [mins, setMins] = useState('30');
  const [customReason, setCustomReason] = useState('');
  const [capacityError, setCapacityError] = useState<string | null>(null);

  const totalMins = (parseInt(hours || '0', 10) * 60) + parseInt(mins || '0', 10);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  const activeDisruption = activeDisruptions.find((d) => d.bookingId === booking.id) ?? null;

  const handleOpen = () => {
    if (activeDisruption) {
      setDisruptionType(activeDisruption.disruptionType);
      if (activeDisruption.delayMinutes) {
        setHours(String(Math.floor(activeDisruption.delayMinutes / 60)));
        setMins(String(activeDisruption.delayMinutes % 60));
      }
      setCustomReason(activeDisruption.reason ?? '');
    } else {
      setDisruptionType('delay');
      setHours('1');
      setMins('30');
      setCustomReason('');
    }
    setCapacityError(null);
    setIsOpen(true);
  };

  const handleConfirm = () => {
    const isEditing = Boolean(activeDisruption);
    if (!isEditing && !hasCapacityForAnotherDisruption()) {
      setCapacityError('Resolve or clear an existing disruption before adding another.');
      return;
    }
    const defaultReason =
      disruptionType === 'delay'
        ? `${booking.provider} scheduled delay (+${totalMins}m)`
        : `${booking.title} cancelled by carrier`;

    const disruption: Disruption = {
      bookingId: booking.id,
      disruptionType,
      delayMinutes: disruptionType === 'delay' ? totalMins : undefined,
      reason: customReason.trim() || defaultReason,
      timestamp: new Date().toISOString(),
    };
    addDisruption(disruption);
    setCapacityError(null);
    setIsOpen(false);
  };

  // ── Type-aware labels ──
  const delayLabel = (() => {
    switch (booking.type) {
      case 'flight': return 'Flight was delayed';
      case 'train': return 'Train was delayed';
      case 'hotel': return 'Late arrival / Delayed check-in';
      case 'transfer': return 'Ride was delayed';
      default: return 'It was delayed';
    }
  })();

  const cancelLabel = (() => {
    switch (booking.type) {
      case 'flight': return 'Flight was cancelled';
      case 'train': return 'Train was cancelled';
      case 'hotel': return 'Reservation cancelled';
      case 'transfer': return 'Ride was cancelled';
      default: return 'It was cancelled';
    }
  })();

  const getDisruptedBadgeLabel = () => {
    if (!activeDisruption) return '';
    const typeLabel = { flight: 'Flight', train: 'Train', hotel: 'Stay', transfer: 'Ride', activity: 'Activity', event: 'Event' }[booking.type] ?? 'Booking';
    if (activeDisruption.disruptionType === 'delay') {
      const m = activeDisruption.delayMinutes ?? 0;
      const h = Math.floor(m / 60), rem = m % 60;
      return `${typeLabel} delayed +${h > 0 ? `${h}h ` : ''}${rem > 0 ? `${rem}m` : ''}`;
    }
    return `${typeLabel} cancelled`;
  };

  function clampH(v: string) { const n = parseInt(v, 10); return isNaN(n) ? v : String(Math.min(23, Math.max(0, n))); }
  function clampM(v: string) { const n = parseInt(v, 10); return isNaN(n) ? v : String(Math.min(59, Math.max(0, n))); }

  function applyPreset(m: number) {
    setHours(String(Math.floor(m / 60)));
    setMins(String(m % 60));
  }

  const formatPreset = (m: number) => {
    const h = Math.floor(m / 60), rem = m % 60;
    if (h > 0 && rem === 30) return `${h}.5h`;
    if (h > 0 && rem === 0) return `${h}h`;
    if (h > 0) return `${h}h${rem}m`;
    return `${m}m`;
  };

  // ── isSource badge (active disruption) ──
  if (isSource && activeDisruption) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={handleOpen}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold cursor-pointer border bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>{getDisruptedBadgeLabel()}</span>
          </button>
          <button
            onClick={() => removeDisruption(booking.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 border border-gray-200 cursor-pointer transition-colors"
            title="Clear this disruption"
          >
            <RotateCcw size={11} />
            <span>Clear</span>
          </button>
        </div>
        {isOpen && createPortal(renderModal(), document.body)}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        id={`simulate-btn-${booking.id}`}
        className={
          buttonClassName ||
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs text-rose-700 hover:bg-rose-100/80 bg-rose-50/60 border border-rose-200/90 cursor-pointer transition-colors shadow-2xs'
        }
        title="Report a disruption for this booking"
      >
        <AlertTriangle size={13} className="text-rose-600" />
        <span>Report a disruption</span>
      </button>
      {isOpen && createPortal(renderModal(), document.body)}
    </div>
  );

  function renderModal() {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Zap size={15} />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-gray-900 leading-tight">
                  Report a disruption
                </p>
                <p className="text-[11px] text-gray-500 truncate max-w-[220px]">{booking.title}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto overscroll-contain px-6 py-5 space-y-5">

            {/* What went wrong */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                What happened?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDisruptionType('delay')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                    disruptionType === 'delay'
                      ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Clock size={13} className="flex-shrink-0" />
                  <span>{delayLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisruptionType('cancellation')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                    disruptionType === 'cancellation'
                      ? 'bg-rose-100 border-rose-300 text-rose-900 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Ban size={13} className="flex-shrink-0" />
                  <span>{cancelLabel}</span>
                </button>
              </div>
            </div>

            {/* Delay time picker */}
            {disruptionType === 'delay' ? (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  How long?
                </p>

                {/* Quick presets */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {PRESET_DELAYS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => applyPreset(m)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        totalMins === m
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      +{formatPreset(m)}
                    </button>
                  ))}
                </div>

                {/* H : M stepper */}
                <div className="bg-amber-50/60 rounded-xl border border-amber-100 px-4 py-3">
                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-3">Custom</p>
                  <div className="flex items-end gap-3">
                    {/* Hours */}
                    <div className="flex flex-col items-center gap-1">
                      <button type="button" onClick={() => setHours(String(Math.min(23, (parseInt(hours||'0'))+1)))} className="w-7 h-6 flex items-center justify-center rounded-lg text-amber-700 hover:bg-amber-200 text-xs cursor-pointer">▲</button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={hours}
                        onChange={(e) => setHours(clampH(e.target.value.replace(/\D/g,'')))}
                        onBlur={() => setHours(String(Math.max(0, parseInt(hours||'0',10))))}
                        className="w-12 text-center text-base font-bold text-amber-900 bg-white border border-amber-200 rounded-xl py-1.5 outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <button type="button" onClick={() => setHours(String(Math.max(0, (parseInt(hours||'0'))-1)))} className="w-7 h-6 flex items-center justify-center rounded-lg text-amber-700 hover:bg-amber-200 text-xs cursor-pointer">▼</button>
                      <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-wide">hrs</span>
                    </div>
                    <span className="text-xl font-bold text-amber-600 mb-6">:</span>
                    {/* Minutes */}
                    <div className="flex flex-col items-center gap-1">
                      <button type="button" onClick={() => setMins(String(Math.min(59, (parseInt(mins||'0'))+5)))} className="w-7 h-6 flex items-center justify-center rounded-lg text-amber-700 hover:bg-amber-200 text-xs cursor-pointer">▲</button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mins}
                        onChange={(e) => setMins(clampM(e.target.value.replace(/\D/g,'')))}
                        onBlur={() => setMins(String(Math.max(0, parseInt(mins||'0',10))))}
                        className="w-12 text-center text-base font-bold text-amber-900 bg-white border border-amber-200 rounded-xl py-1.5 outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <button type="button" onClick={() => setMins(String(Math.max(0, (parseInt(mins||'0'))-5)))} className="w-7 h-6 flex items-center justify-center rounded-lg text-amber-700 hover:bg-amber-200 text-xs cursor-pointer">▼</button>
                      <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-wide">min</span>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 mb-7 ml-1">
                      = {totalMins}m total
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-100">
                <Ban size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 leading-relaxed">
                  We'll check everything that depended on this booking and flag what's at risk.
                </p>
              </div>
            )}

            {/* Optional reason */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Anything to note? <span className="normal-case font-normal text-gray-400">(optional)</span>
              </p>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder={
                  disruptionType === 'delay'
                    ? 'e.g. Bad weather, air traffic hold, traffic...'
                    : 'e.g. Cancelled by carrier, service suspended...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300 transition"
              />
            </div>

            {/* Capacity error */}
            {capacityError && (
              <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>{capacityError}</span>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setIsOpen(false); setCapacityError(null); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 cursor-pointer transition-colors"
            >
              Never mind
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={disruptionType === 'delay' && totalMins <= 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-sm"
            >
              <Check size={13} strokeWidth={2.5} />
              <span>Update my trip</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
