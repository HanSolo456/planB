// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: ImportView.tsx
// PURPOSE: Full import flow — paste → extract → review/edit → confirm.
//   States: PASTE | LOADING | REVIEW | ERROR
// =============================================================================

import { useState, useCallback } from 'react';
import { ArrowLeft, Sparkles, RotateCcw, Check, AlertTriangle, ChevronRight } from 'lucide-react';
import type { Itinerary, Booking } from '../lib/types';
import { extractItineraryFromText, IMPORT_PRESETS } from '../lib/importEngine';
import { useAppState } from '../App';

type ViewState = 'PASTE' | 'LOADING' | 'REVIEW' | 'ERROR';

// ---------------------------------------------------------------------------
// Utility: format ISO datetime as a human-readable short string
// ---------------------------------------------------------------------------
function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// TYPE BADGE — matches BookingCard's visual language
// ---------------------------------------------------------------------------
const TYPE_LABELS: Record<Booking['type'], string> = {
  flight: 'FLIGHT',
  train: 'TRAIN',
  hotel: 'HOTEL',
  transfer: 'TRANSFER',
  activity: 'ACTIVITY',
  event: 'EVENT',
};

const TYPE_COLORS: Record<Booking['type'], string> = {
  flight: '#2B5D5C',
  train: '#2B5D5C',
  hotel: '#4A3728',
  transfer: '#6B6760',
  activity: '#7A4F2B',
  event: '#7A4F2B',
};

function TypeBadge({ type }: { type: Booking['type'] }) {
  return (
    <span
      className="font-mono text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[2px]"
      style={{
        backgroundColor: `${TYPE_COLORS[type]}18`,
        color: TYPE_COLORS[type],
        border: `1px solid ${TYPE_COLORS[type]}40`,
      }}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BOOKING REVIEW CARD — editable title + provider inline
// ---------------------------------------------------------------------------
interface ReviewCardProps {
  booking: Booking;
  index: number;
  onChange: (updated: Booking) => void;
}

function ReviewCard({ booking, index, onChange }: ReviewCardProps) {
  const locationName =
    booking.location.type === 'named'
      ? booking.location.name
      : booking.location.label ?? `${booking.location.lat}, ${booking.location.lng}`;

  return (
    <div
      className="rounded-[2px] p-4"
      style={{ border: '1px solid var(--color-border)', backgroundColor: '#FFFFFF' }}
    >
      {/* Row 1: index + type badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-2xs font-semibold text-[#969188] w-5 text-center"
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <TypeBadge type={booking.type} />
        </div>
        {booking.dependsOn.length > 0 && (
          <span className="font-mono text-2xs text-[#969188]">
            depends on {booking.dependsOn.length} leg{booking.dependsOn.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Editable title */}
      <input
        id={`review-title-${booking.id}`}
        type="text"
        value={booking.title}
        onChange={(e) => onChange({ ...booking, title: e.target.value })}
        className="w-full font-display text-base font-bold bg-transparent outline-none mb-1"
        style={{
          color: 'var(--color-text-main)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '2px',
        }}
        aria-label="Booking title"
      />

      {/* Editable provider */}
      <input
        id={`review-provider-${booking.id}`}
        type="text"
        value={booking.provider}
        onChange={(e) => onChange({ ...booking, provider: e.target.value })}
        className="w-full font-mono text-xs bg-transparent outline-none mb-3 text-[#6B6760]"
        style={{ borderBottom: '1px dashed var(--color-border)', paddingBottom: '2px' }}
        aria-label="Provider"
      />

      {/* Time + location row */}
      <div className="grid grid-cols-2 gap-3 text-xs font-mono text-[#6B6760]">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-[#969188] mb-0.5">
            START
          </p>
          <p>{fmtDateTime(booking.startTime)}</p>
        </div>
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-[#969188] mb-0.5">
            END
          </p>
          <p>{fmtDateTime(booking.endTime)}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs font-mono text-[#969188]">
        <span className="text-2xs">📍</span>
        <span>{locationName}</span>
      </div>

      {/* Cost + buffer */}
      <div className="mt-3 pt-2.5 flex items-center justify-between text-2xs font-mono"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <span className="text-[#6B6760]">
          ₹{booking.cost.toLocaleString('en-IN')}
        </span>
        <span className="text-[#969188]">
          {booking.bufferMinutes > 0 ? `${booking.bufferMinutes} min buffer` : 'no buffer'}
        </span>
        <span
          className="text-2xs font-semibold"
          style={{ color: booking.cancellationPolicy.policy === 'free' ? 'var(--color-confirmed)' : '#969188' }}
        >
          {booking.cancellationPolicy.policy === 'free'
            ? 'FREE CANCEL'
            : booking.cancellationPolicy.policy === 'partial-refund'
            ? 'PARTIAL REFUND'
            : 'NON-REFUNDABLE'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
export default function ImportView() {
  const { addImportedItinerary, setShowImportView } = useAppState();

  const [viewState, setViewState] = useState<ViewState>('PASTE');
  const [rawText, setRawText] = useState('');
  const [extracted, setExtracted] = useState<Itinerary | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0); // 0-100

  // ---- PASTE → LOADING → REVIEW / ERROR
  const handleExtract = useCallback(async () => {
    if (!rawText.trim()) return;
    setViewState('LOADING');
    setProgress(0);
    setErrorMessage('');

    // Animate progress bar while waiting (indeterminate-ish)
    const ticker = setInterval(() => {
      setProgress((p) => Math.min(p + 3, 90));
    }, 200);

    try {
      const result = await extractItineraryFromText(rawText);
      clearInterval(ticker);
      setProgress(100);
      setExtracted(result);
      setTimeout(() => setViewState('REVIEW'), 300);
    } catch (err) {
      clearInterval(ticker);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setViewState('ERROR');
    }
  }, [rawText]);

  // ---- Editing a booking in review state
  const handleBookingChange = useCallback((index: number, updated: Booking) => {
    if (!extracted) return;
    const newBookings = [...extracted.bookings];
    newBookings[index] = updated;
    setExtracted({ ...extracted, bookings: newBookings });
  }, [extracted]);

  // ---- Confirm: commit to AppContext
  const handleConfirm = useCallback(() => {
    if (!extracted) return;
    addImportedItinerary(extracted);
    setShowImportView(false);
  }, [extracted, addImportedItinerary, setShowImportView]);

  // ---- Reset to paste
  const handleStartOver = useCallback(() => {
    setViewState('PASTE');
    setExtracted(null);
    setRawText('');
    setProgress(0);
    setErrorMessage('');
  }, []);

  // ---- Use a preset
  const handlePreset = useCallback((text: string) => {
    setRawText(text);
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          id="import-back-btn"
          onClick={() => setShowImportView(false)}
          className="flex items-center gap-1.5 font-mono text-xs text-[#6B6760] hover:text-[#1C1B19] transition-colors duration-150"
          aria-label="Back to itineraries"
        >
          <ArrowLeft size={14} />
          BACK
        </button>
        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)' }} />
        <p className="font-mono text-2xs uppercase tracking-wider text-[#969188] font-semibold">
          IMPORT TRIP FROM CONFIRMATION TEXT
        </p>
      </div>

      {/* ── PASTE STATE ───────────────────────────────────────────── */}
      {viewState === 'PASTE' && (
        <div className="space-y-4">
          {/* Instructions */}
          <div
            className="p-4 rounded-[2px]"
            style={{ border: '1px solid var(--color-border)', backgroundColor: '#FDFCF9' }}
          >
            <p className="font-display text-lg font-bold mb-1" style={{ color: 'var(--color-text-main)' }}>
              Paste your booking confirmation
            </p>
            <p className="font-mono text-xs text-[#6B6760] leading-relaxed">
              Copy text from a flight confirmation email, hotel booking, train ticket, or any
              combination — the AI will extract each segment into the disruption-ready pipeline.
            </p>
          </div>

          {/* Sample presets */}
          <div>
            <p className="font-mono text-2xs uppercase tracking-wider text-[#969188] font-semibold mb-2">
              TRY A SAMPLE
            </p>
            <div className="grid grid-cols-2 gap-2">
              {IMPORT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  id={`preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => handlePreset(preset.text)}
                  className="text-left p-3 rounded-[2px] transition-colors duration-150 group"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: '#FDFCF9' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-2xs font-semibold uppercase tracking-wider text-[#2B5D5C]">
                      {preset.label}
                    </span>
                    <ChevronRight
                      size={12}
                      className="text-[#969188] group-hover:text-[#1C1B19] transition-colors"
                    />
                  </div>
                  <p className="font-mono text-2xs text-[#6B6760]">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div>
            <p className="font-mono text-2xs uppercase tracking-wider text-[#969188] font-semibold mb-2">
              OR PASTE YOUR OWN
            </p>
            <textarea
              id="import-textarea"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste booking confirmation text here…"
              rows={12}
              className="w-full font-mono text-xs rounded-[2px] p-4 outline-none resize-y leading-relaxed transition-colors duration-150"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: '#FDFCF9',
                color: 'var(--color-text-main)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-confirmed)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>

          {/* Extract CTA */}
          <button
            id="import-extract-btn"
            onClick={handleExtract}
            disabled={!rawText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[2px] font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: rawText.trim() ? 'var(--color-confirmed)' : '#969188',
              color: '#FFFFFF',
            }}
          >
            <Sparkles size={14} />
            EXTRACT ITINERARY
          </button>
        </div>
      )}

      {/* ── LOADING STATE ─────────────────────────────────────────── */}
      {viewState === 'LOADING' && (
        <div
          className="p-8 rounded-[2px] flex flex-col items-center gap-5 text-center"
          style={{ border: '1px solid var(--color-border)', backgroundColor: '#FDFCF9' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-confirmed)18', border: '1.5px solid var(--color-confirmed)40' }}
            >
              <Sparkles size={18} style={{ color: 'var(--color-confirmed)' }} className="animate-pulse" />
            </div>
            <div>
              <p className="font-display text-base font-bold mb-1" style={{ color: 'var(--color-text-main)' }}>
                Extracting your itinerary…
              </p>
              <p className="font-mono text-2xs text-[#969188]">
                Reading segments · inferring dependencies · validating schema
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: '3px', backgroundColor: 'var(--color-border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${progress}%`,
                backgroundColor: 'var(--color-confirmed)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── ERROR STATE ───────────────────────────────────────────── */}
      {viewState === 'ERROR' && (
        <div
          className="p-5 rounded-[2px] space-y-4"
          style={{ border: '1px solid var(--color-disrupted)40', backgroundColor: '#FFF8F7' }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} style={{ color: 'var(--color-disrupted)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-disrupted)' }}>
                Extraction failed
              </p>
              <p className="font-mono text-xs text-[#6B6760] leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <button
            id="import-retry-btn"
            onClick={handleStartOver}
            className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider transition-colors duration-150 text-[#6B6760] hover:text-[#1C1B19]"
          >
            <RotateCcw size={13} />
            TRY AGAIN
          </button>
        </div>
      )}

      {/* ── REVIEW STATE ──────────────────────────────────────────── */}
      {viewState === 'REVIEW' && extracted && (
        <div className="space-y-4">
          {/* Itinerary-level summary */}
          <div
            className="p-4 rounded-[2px]"
            style={{ border: '1.5px solid var(--color-confirmed)', backgroundColor: '#F5FBF8' }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-mono text-2xs uppercase tracking-wider font-semibold"
                style={{ color: 'var(--color-confirmed)' }}>
                EXTRACTION COMPLETE — {extracted.bookings.length} SEGMENTS
              </p>
              <span className="font-mono text-2xs text-[#969188]">
                {extracted.startDate} → {extracted.endDate}
              </span>
            </div>
            <p className="font-display text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
              {extracted.destination}
            </p>
            <p className="font-mono text-2xs text-[#6B6760] mt-0.5">
              {extracted.travelerName} · review and edit before confirming
            </p>
          </div>

          {/* Booking review cards */}
          <div className="space-y-3">
            {extracted.bookings.map((booking, i) => (
              <ReviewCard
                key={booking.id}
                booking={booking}
                index={i}
                onChange={(updated) => handleBookingChange(i, updated)}
              />
            ))}
          </div>

          {/* Confirm / Start Over */}
          <div className="flex items-center gap-3 pt-1">
            <button
              id="import-confirm-btn"
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[2px] font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-150"
              style={{ backgroundColor: 'var(--color-confirmed)', color: '#FFFFFF' }}
            >
              <Check size={14} />
              CONFIRM &amp; USE THIS TRIP
            </button>
            <button
              id="import-startover-btn"
              onClick={handleStartOver}
              className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#6B6760] hover:text-[#1C1B19] transition-colors duration-150"
            >
              <RotateCcw size={13} />
              START OVER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
