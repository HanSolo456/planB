import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Banknote,
  Shield,
  ChevronRight,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { useAppState } from '../App';
import { generateRecoveryOptions } from '../lib/recoveryEngine';
import { explainRecoveryOption } from '../lib/reasoningEngine';
import type { ScoredRecoveryOption } from '../lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCostDelta(delta: number): { label: string; className: string } {
  if (delta === 0) return { label: 'NO EXTRA COST', className: 'text-[#2B5D5C]' };
  if (delta > 0)
    return {
      label: `+₹${delta.toLocaleString('en-IN')}`,
      className: 'text-[#B8552F]',
    };
  return {
    label: `−₹${Math.abs(delta).toLocaleString('en-IN')} SAVED`,
    className: 'text-[#2B5D5C]',
  };
}

function formatTimeDelta(delta: number): string {
  if (delta === 0) return 'SAME TIME SLOT';
  const h = Math.floor(delta / 60);
  const m = delta % 60;
  if (h === 0) return `+${m}M DELAY`;
  if (m === 0) return `+${h}H DELAY`;
  return `+${h}H ${m}M DELAY`;
}

// ---------------------------------------------------------------------------
// Score bar sub-component (Flat, clean, no glows)
// ---------------------------------------------------------------------------
function ScoreBar({
  label,
  score,
  weight,
  color,
}: {
  label: string;
  score: number;
  weight: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 font-mono text-2xs">
      <span className="text-[#6B6760] w-24 flex-shrink-0 font-medium">
        {label} <span className="text-[#969188]">({weight})</span>
      </span>
      <div
        className="flex-1 h-1.5 rounded-none overflow-hidden"
        style={{ backgroundColor: '#EFECE6' }}
      >
        <div
          className="h-full rounded-none transition-all duration-300"
          style={{
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="font-bold w-8 text-right" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Option card
// ---------------------------------------------------------------------------
function OptionCard({
  option,
  rank,
  isRecommended,
  isSelected,
  isConfirming,
  explanation,
  onSelect,
  onConfirm,
  onCancel,
}: {
  option: ScoredRecoveryOption;
  rank: number;
  isRecommended: boolean;
  isSelected: boolean;
  isConfirming: boolean;
  /** null = loading; string = AI text or fallback */
  explanation: string | null;
  onSelect: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const costFmt = formatCostDelta(option.costDelta);
  const timeFmt = formatTimeDelta(option.timeDelta);

  return (
    <div
      id={`recovery-option-${rank}`}
      className="bg-white rounded-[2px] p-5 border transition-colors duration-150 cursor-pointer relative"
      style={{
        borderColor: isSelected
          ? 'var(--color-confirmed)'
          : isRecommended
          ? '#BDD7D6'
          : 'var(--color-border)',
        borderLeftWidth: isSelected || isRecommended ? '4px' : '1px',
        borderLeftColor: isSelected
          ? 'var(--color-confirmed)'
          : isRecommended
          ? 'var(--color-confirmed)'
          : 'var(--color-border)',
      }}
      onClick={!isConfirming ? onSelect : undefined}
    >
      <div>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            {/* Rank badge */}
            <div
              className="w-7 h-7 rounded-[2px] flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 mt-0.5"
              style={{
                backgroundColor: isRecommended
                  ? 'var(--color-confirmed-bg)'
                  : 'var(--color-bg-surface-alt)',
                border: `1px solid ${isRecommended ? 'var(--color-confirmed-border)' : 'var(--color-border)'}`,
                color: isRecommended ? 'var(--color-confirmed)' : '#6B6760',
              }}
            >
              #{rank}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                {isRecommended && (
                  <span
                    className="font-mono px-2 py-0.5 rounded-[2px] text-2xs font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: 'var(--color-confirmed-bg)',
                      color: 'var(--color-confirmed)',
                      border: '1px solid var(--color-confirmed-border)',
                    }}
                  >
                    ★ #1 RECOMMENDED OPTION
                  </span>
                )}
                <span className="font-mono text-2xs text-[#969188]">
                  ID: {option.id.toUpperCase()}
                </span>
              </div>
              <h3 className="font-display font-bold text-base text-[#1C1B19] leading-snug">
                {option.description}
              </h3>
            </div>
          </div>

          {/* Composite score badge */}
          <div className="flex flex-col items-end flex-shrink-0 font-mono">
            <div
              className="px-2.5 py-1 rounded-[2px] text-xs font-bold"
              style={{
                backgroundColor: isRecommended
                  ? 'var(--color-confirmed-bg)'
                  : 'var(--color-bg-surface-alt)',
                border: `1px solid ${isRecommended ? 'var(--color-confirmed-border)' : 'var(--color-border)'}`,
                color: isRecommended ? 'var(--color-confirmed)' : '#1C1B19',
              }}
            >
              SCORE: {option.compositeScore}/100
            </div>
          </div>
        </div>

        {/* AI dispatcher note — skeleton while loading */}
        <div className="mb-4 ml-10">
          {explanation === null ? (
            // Loading skeleton: two flat hairline bars
            <div className="space-y-1.5 py-0.5">
              <div
                className="h-2.5 rounded-none animate-pulse"
                style={{ width: '80%', backgroundColor: '#EFECE6' }}
              />
              <div
                className="h-2.5 rounded-none animate-pulse"
                style={{ width: '60%', backgroundColor: '#EFECE6' }}
              />
            </div>
          ) : (
            <p className="text-xs text-[#1C1B19] leading-relaxed font-body italic">
              {explanation}
            </p>
          )}
        </div>

        {/* Cost / Time chips (IBM Plex Mono) */}
        <div className="flex flex-wrap gap-2 mb-4 ml-10 font-mono text-2xs">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#FAF8F5] border border-[#DEDAD2] font-semibold"
          >
            <Banknote size={11} className="text-[#969188]" />
            <span className={costFmt.className}>{costFmt.label}</span>
          </span>
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#FAF8F5] border border-[#DEDAD2] font-semibold text-[#1C1B19]"
          >
            <Clock size={11} className="text-[#969188]" />
            <span>{timeFmt}</span>
          </span>
        </div>

        {/* Score breakdown bars */}
        <div
          className="rounded-[2px] px-4 py-3 space-y-2 mb-4 ml-10 bg-[#FAF8F5] border border-[#EBE7DF]"
        >
          <ScoreBar
            label="TRIP IMPACT"
            weight="50%"
            score={option.scoreBreakdown.itineraryScore}
            color="#2B5D5C"
          />
          <ScoreBar
            label="COST EFFICIENCY"
            weight="30%"
            score={option.scoreBreakdown.costScore}
            color="#4A7A79"
          />
          <ScoreBar
            label="TIME MINIMALITY"
            weight="20%"
            score={option.scoreBreakdown.timeScore}
            color="#B8552F"
          />
        </div>

        {/* Action area */}
        {isConfirming ? (
          <div
            className="ml-10 rounded-[2px] p-3.5 bg-[#EDF4F4] border border-[#BDD7D6] animate-slide-down"
          >
            <p className="font-mono text-2xs uppercase tracking-widest text-[#2B5D5C] font-bold mb-1">
              CONFIRM RE-ACCOMMODATION
            </p>
            <p className="text-xs text-[#1C1B19] mb-3 font-body">
              Apply this option to replace the disrupted segment and update downstream schedules?
            </p>
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                id={`confirm-recovery-${rank}`}
                onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[2px] font-bold text-white cursor-pointer bg-[#2B5D5C] hover:bg-[#234d4c] transition-colors"
              >
                <CheckCircle2 size={13} />
                CONFIRM &amp; APPLY
              </button>
              <button
                id={`cancel-recovery-${rank}`}
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                className="px-3.5 py-2 rounded-[2px] font-medium text-[#6B6760] hover:text-[#1C1B19] bg-white border border-[#DEDAD2] cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <div className="ml-10 flex items-center justify-between font-mono text-xs">
            {isSelected ? (
              <span className="text-[#2B5D5C] font-bold flex items-center gap-1.5 text-2xs uppercase">
                <CheckCircle2 size={12} />
                OPTION SELECTED — CLICK BUTTON TO CONFIRM
              </span>
            ) : (
              <span className="text-2xs text-[#969188] uppercase">CLICK CARD OR BUTTON TO SELECT</span>
            )}
            <button
              id={`select-recovery-${rank}`}
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] font-bold transition-colors cursor-pointer border"
              style={{
                backgroundColor: isSelected
                  ? 'var(--color-confirmed)'
                  : '#FFFFFF',
                borderColor: isSelected
                  ? 'var(--color-confirmed)'
                  : 'var(--color-border)',
                color: isSelected ? '#FFFFFF' : '#1C1B19',
              }}
            >
              <span>{isSelected ? 'SELECTED' : 'SELECT'}</span>
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-white rounded-[2px] border border-[#DEDAD2] p-8">
      <div
        className="w-12 h-12 rounded-[2px] flex items-center justify-center bg-[#F9ECEB] border border-[#E3B6B3]"
      >
        <AlertTriangle size={20} className="text-[#9E2B25]" />
      </div>
      <div>
        <h3 className="font-display font-bold text-lg text-[#1C1B19] mb-1">
          No Recovery Options Available
        </h3>
        <p className="text-[#6B6760] text-xs max-w-sm font-body">
          The engine could not resolve candidate alternatives for this specific disruption scenario.
        </p>
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-4 py-2 rounded-[2px] font-mono text-xs font-semibold cursor-pointer border border-[#DEDAD2] bg-[#FAF8F5] text-[#1C1B19] hover:bg-white"
      >
        <ArrowLeft size={13} />
        RETURN TO MANIFEST
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main RecoveryView
// ---------------------------------------------------------------------------
export default function RecoveryView() {
  const {
    selectedItinerary,
    activeDisruption,
    impactedBookings,
    setShowRecoveryOptions,
    applyRecovery,
  } = useAppState();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // null = loading skeleton; string = AI text or fallback
  const [explanations, setExplanations] = useState<Record<string, string | null>>({});

  const sourceBooking = useMemo(
    () =>
      activeDisruption
        ? selectedItinerary.bookings.find((b) => b.id === activeDisruption.bookingId)
        : null,
    [selectedItinerary, activeDisruption]
  );

  const options = useMemo<ScoredRecoveryOption[]>(() => {
    if (!activeDisruption) return [];
    try {
      return generateRecoveryOptions(selectedItinerary, activeDisruption);
    } catch (err) {
      console.error('[planB] generateRecoveryOptions error:', err);
      return [];
    }
  }, [selectedItinerary, activeDisruption]);

  // Fire AI explanations in parallel whenever options are computed.
  // Cache in reasoningEngine prevents redundant calls on back/forward nav.
  useEffect(() => {
    if (!options.length || !activeDisruption) return;
    // Pre-fill all slots with null (triggers skeleton on each card)
    setExplanations(Object.fromEntries(options.map((o) => [o.id, null])));
    // Resolve each explanation independently so fast responses render immediately
    options.forEach((opt) => {
      explainRecoveryOption(opt, activeDisruption, selectedItinerary)
        .then((text) =>
          setExplanations((prev) => ({ ...prev, [opt.id]: text }))
        );
    });
  }, [options, activeDisruption, selectedItinerary]);

  const handleBack = () => setShowRecoveryOptions(false);

  const handleSelect = (id: string) => {
    if (selectedId === id) {
      setConfirmingId(id);
    } else {
      setSelectedId(id);
      setConfirmingId(null);
    }
  };

  const handleConfirm = (option: ScoredRecoveryOption) => {
    applyRecovery(option);
  };

  const handleCancel = () => {
    setConfirmingId(null);
  };

  const brokenCount = impactedBookings.filter((b) => b.severity === 'broken').length;
  const atRiskCount = impactedBookings.filter((b) => b.severity === 'at-risk').length;

  if (!activeDisruption) {
    return <EmptyState onBack={handleBack} />;
  }

  return (
    <div className="animate-slide-down">
      {/* Back nav */}
      <button
        id="back-to-itinerary-btn"
        onClick={handleBack}
        className="flex items-center gap-1.5 font-mono text-xs text-[#6B6760] hover:text-[#1C1B19] cursor-pointer mb-4 transition-colors"
      >
        <ArrowLeft size={13} />
        <span>← RETURN TO DISPATCH MANIFEST</span>
      </button>

      {/* Operations Recovery Context Header */}
      <div className="bg-white rounded-[2px] p-5 mb-6 border border-[#DEDAD2]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-2xs uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-[2px] bg-[#2B5D5C] text-white">
            RE-ACCOMMODATION DISPATCH
          </span>
          <span className="font-mono text-2xs text-[#969188]">·</span>
          <span className="font-mono text-2xs text-[#6B6760]">
            INCIDENT TARGET: {sourceBooking?.title ?? 'DISRUPTED SEGMENT'}
          </span>
        </div>

        <h2 className="font-display font-bold text-2xl text-[#1C1B19]">
          Recovery Options &amp; Re-accommodation Alternatives
        </h2>

        {/* Monospace Incident Status Strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 pt-2.5 border-t border-[#EBE7DF] font-mono text-xs text-[#6B6760]">
          <span>
            REPORTED INCIDENT:{' '}
            <strong className="text-[#9E2B25]">
              {activeDisruption.disruptionType === 'delay'
                ? `+${activeDisruption.delayMinutes}M DELAY`
                : 'CANCELLATION'}
            </strong>
          </span>
          <span className="text-[#DEDAD2]">|</span>
          <span>
            CASCADE IMPACT:{' '}
            {brokenCount > 0 && (
              <strong className="text-[#9E2B25]">{brokenCount} BROKEN</strong>
            )}
            {brokenCount > 0 && atRiskCount > 0 && ', '}
            {atRiskCount > 0 && (
              <strong className="text-[#B8552F]">{atRiskCount} AT RISK</strong>
            )}
            {brokenCount === 0 && atRiskCount === 0 && (
              <strong className="text-[#2B5D5C]">0 BROKEN</strong>
            )}
          </span>
          <span className="text-[#DEDAD2]">|</span>
          <span>
            CANDIDATE SLOTS: <strong className="text-[#1C1B19]">{options.length} GENERATED</strong>
          </span>
        </div>
      </div>

      {/* Options List */}
      {options.length === 0 ? (
        <EmptyState onBack={handleBack} />
      ) : (
        <div className="space-y-4">
          {options.map((opt, idx) => (
            <OptionCard
              key={opt.id}
              option={opt}
              rank={idx + 1}
              isRecommended={idx === 0}
              isSelected={selectedId === opt.id}
              isConfirming={confirmingId === opt.id}
              explanation={explanations[opt.id] ?? null}
              onSelect={() => handleSelect(opt.id)}
              onConfirm={() => handleConfirm(opt)}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {/* Manifest footnote */}
      <div className="mt-6 p-3 bg-[#FAF8F5] border border-[#DEDAD2] rounded-[2px] font-mono text-2xs text-[#6B6760]">
        SCORING WEIGHTS: ITINERARY INTEGRITY 50% · FARE EFFICIENCY 30% · TIME DELTA 20%. SELECTION UPDATES ITINERARY STATE IMMEDIATELY.
      </div>
    </div>
  );
}
