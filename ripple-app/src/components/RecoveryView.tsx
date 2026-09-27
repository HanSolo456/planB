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
  Layers,
  Ban,
  Star,
  TrendingUp,
  Wallet,
  Timer,
  X,
} from 'lucide-react';
import { useAppState } from '../App';
import { generateRecoveryOptions } from '../lib/recoveryEngine';
import { explainRecoveryOption } from '../lib/reasoningEngine';
import type { Disruption, ScoredRecoveryOption, TravelerPreferences } from '../lib/types';
import { PERSONA_PRESETS } from '../lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCostDelta(delta: number): { label: string; positive: boolean; neutral: boolean } {
  if (delta === 0) return { label: 'No extra cost', positive: false, neutral: true };
  if (delta > 0) return { label: `+₹${delta.toLocaleString('en-IN')}`, positive: false, neutral: false };
  return { label: `Saves ₹${Math.abs(delta).toLocaleString('en-IN')}`, positive: true, neutral: false };
}

function formatTimeDelta(delta: number): { label: string; neutral: boolean } {
  if (delta === 0) return { label: 'Same timing', neutral: true };
  const h = Math.floor(delta / 60);
  const m = delta % 60;
  if (h === 0) return { label: `${m}m later`, neutral: false };
  if (m === 0) return { label: `${h}h later`, neutral: false };
  return { label: `${h}h ${m}m later`, neutral: false };
}

function getTripFitLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: 'Trip stays on track', color: '#166534', bg: '#dcfce7' };
  if (score >= 65) return { label: 'Minor adjustments needed', color: '#92400e', bg: '#fef3c7' };
  return { label: 'Some plans may shift', color: '#991b1b', bg: '#fee2e2' };
}

// ---------------------------------------------------------------------------
// Metric Pill
// ---------------------------------------------------------------------------
function MetricPill({
  icon: Icon,
  label,
  valueColor,
  bg,
  border,
}: {
  icon: React.ElementType;
  label: string;
  valueColor: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: bg, border: `1px solid ${border}`, color: valueColor }}
    >
      <Icon size={12} />
      <span>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Option Card — clean, human-readable
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
  explanation: string | null;
  onSelect: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const costFmt = formatCostDelta(option.costDelta);
  const timeFmt = formatTimeDelta(option.timeDelta);
  const tripFit = getTripFitLabel(option.itineraryImpactScore);
  const fitLabel = option.compositeScore >= 80 ? 'Great fit' : option.compositeScore >= 60 ? 'Good fit' : 'Acceptable';
  const fitColor = option.compositeScore >= 80 ? '#166534' : option.compositeScore >= 60 ? '#92400e' : '#991b1b';
  const fitBg   = option.compositeScore >= 80 ? '#dcfce7' : option.compositeScore >= 60 ? '#fef3c7' : '#fee2e2';

  return (
    <div
      id={`recovery-option-${rank}`}
      className="rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden"
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: isSelected ? '#0A1E30' : isRecommended ? '#A8C0D4' : '#E5E7EB',
        borderWidth: isSelected ? '2px' : '1px',
        boxShadow: isSelected
          ? '0 4px 16px rgba(10,30,48,0.12)'
          : isRecommended
          ? '0 2px 8px rgba(10,30,48,0.06)'
          : '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onClick={!isConfirming ? onSelect : undefined}
    >
      <div className="p-5">
        {/* Header row: rank + title + fit badge in one natural line */}
        <div className="flex items-start gap-3 mb-3">
          {/* Rank circle */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
            style={{
              backgroundColor: isRecommended ? '#0A1E30' : '#F3F4F6',
              color: isRecommended ? '#FFFFFF' : '#6B7280',
            }}
          >
            {rank}
          </div>

          {/* Title + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-base text-gray-900 leading-snug">
                {option.description}
              </h3>
              {/* Fit badge — inline next to title, not floating right */}
              <span
                className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: fitBg, color: fitColor }}
              >
                {fitLabel}
              </span>
              {isRecommended && (
                <span
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: '#0A1E30', color: '#FFFFFF' }}
                >
                  <Star size={10} fill="currentColor" />
                  Best match
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AI explanation */}
        <div className="ml-10 mb-4">
          {explanation === null ? (
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width: '85%' }} />
              <div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width: '65%' }} />
            </div>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">{explanation}</p>
          )}
        </div>

        {/* Metric pills */}
        <div className="ml-10 flex flex-wrap gap-2 mb-4">
          <MetricPill
            icon={Wallet}
            label={costFmt.label}
            valueColor={costFmt.positive ? '#166534' : costFmt.neutral ? '#374151' : '#991b1b'}
            bg={costFmt.positive ? '#dcfce7' : costFmt.neutral ? '#F9FAFB' : '#FEF3F2'}
            border={costFmt.positive ? '#bbf7d0' : costFmt.neutral ? '#E5E7EB' : '#fecaca'}
          />
          <MetricPill
            icon={Timer}
            label={timeFmt.label}
            valueColor={timeFmt.neutral ? '#374151' : '#92400e'}
            bg={timeFmt.neutral ? '#F9FAFB' : '#fefce8'}
            border={timeFmt.neutral ? '#E5E7EB' : '#fde68a'}
          />
          <MetricPill
            icon={TrendingUp}
            label={tripFit.label}
            valueColor={tripFit.color}
            bg={tripFit.bg}
            border={tripFit.bg}
          />
        </div>

        {/* Divider */}
        <div className="ml-10 border-t border-gray-100 pt-3">
          {/* Action area */}
          {isConfirming ? (
            <div
              className="rounded-xl p-4 border"
              style={{ backgroundColor: '#F0F7FF', borderColor: '#BFDBFE' }}
            >
              <p className="text-sm font-semibold text-gray-800 mb-1">Apply this option?</p>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                This will update your itinerary with the replacement booking and adjust your remaining schedule.
              </p>
              <div className="flex items-center gap-2">
                <button
                  id={`confirm-recovery-${rank}`}
                  onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-colors"
                  style={{ backgroundColor: '#0A1E30' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a3a56')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0A1E30')}
                >
                  <CheckCircle2 size={14} />
                  Confirm &amp; apply
                </button>
                <button
                  id={`cancel-recovery-${rank}`}
                  onClick={(e) => { e.stopPropagation(); onCancel(); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <X size={13} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {isSelected ? (
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-green-600" />
                  Selected — click again to confirm
                </span>
              ) : (
                <span className="text-xs text-gray-400">Click to select this option</span>
              )}
              <button
                id={`select-recovery-${rank}`}
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border transition-all"
                style={{
                  backgroundColor: isSelected ? '#0A1E30' : '#FFFFFF',
                  borderColor: isSelected ? '#0A1E30' : '#D1D5DB',
                  color: isSelected ? '#FFFFFF' : '#374151',
                }}
              >
                <span>{isSelected ? 'Selected' : 'Choose this'}</span>
                {!isSelected && <ChevronRight size={13} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-50 border border-red-100">
        <AlertTriangle size={20} className="text-red-500" />
      </div>
      <div>
        <h3 className="font-semibold text-lg text-gray-900 mb-1">No alternatives found</h3>
        <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
          We couldn't automatically find replacement options for this disruption. You may need to contact the provider directly.
        </p>
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white transition-colors"
      >
        <ArrowLeft size={13} />
        Back to itinerary
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disruption Selector — shown when 2 disruptions are active
// ---------------------------------------------------------------------------
function DisruptionSelector({
  disruptions,
  itineraryBookings,
  onSelect,
  onBack,
}: {
  disruptions: Disruption[];
  itineraryBookings: { id: string; title: string; type: string }[];
  onSelect: (d: Disruption) => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-slide-down">
      <button
        id="back-to-itinerary-btn"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 cursor-pointer mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to itinerary</span>
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <Layers size={11} />
            Multiple disruptions
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Which issue do you want to fix first?</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          You have two disruptions reported. Fix one at a time — resolving the first keeps the second active so you can deal with it next.
        </p>
      </div>

      {/* Disruption cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {disruptions.map((d, idx) => {
          const booking = itineraryBookings.find((b) => b.id === d.bookingId);
          const isDelay = d.disruptionType === 'delay';
          return (
            <button
              key={d.bookingId}
              id={`select-disruption-${idx}`}
              onClick={() => onSelect(d)}
              className="text-left bg-white rounded-2xl p-5 border cursor-pointer transition-all hover:shadow-md hover:border-gray-400 group"
              style={{ borderColor: '#FCA5A5', borderLeftWidth: '4px' }}
            >
              {/* Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                  Issue {idx + 1}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  {isDelay
                    ? <><Clock size={11} className="inline" /> {d.delayMinutes}m delay</>
                    : <><Ban size={11} className="inline" /> Cancelled</>
                  }
                </span>
              </div>

              {/* Booking title */}
              <p className="font-semibold text-base text-gray-900 leading-snug mb-1">
                {booking?.title ?? d.bookingId}
              </p>

              {/* Reason */}
              {d.reason && (
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">"{d.reason}"</p>
              )}

              {/* CTA */}
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 group-hover:text-gray-900 mt-3">
                <span>Find alternatives</span>
                <ChevronRight size={14} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Persona chip
// ---------------------------------------------------------------------------
function PersonaChip({
  label,
  icon,
  tagline,
  isSelected,
  onClick,
}: {
  label: string;
  icon: string;
  tagline: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-3 rounded-xl border cursor-pointer transition-all text-left"
      style={{
        backgroundColor: isSelected ? '#0A1E30' : '#FFFFFF',
        borderColor: isSelected ? '#0A1E30' : '#E5E7EB',
        color: isSelected ? '#FFFFFF' : '#374151',
        boxShadow: isSelected ? '0 2px 8px rgba(10,30,48,0.2)' : '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : '#E5E7EB', color: isSelected ? '#FFFFFF' : '#374151' }}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs font-semibold leading-tight">{label}</div>
        <div className="text-xs leading-tight mt-0.5" style={{ color: isSelected ? '#94a3b8' : '#9CA3AF' }}>
          {tagline}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Disruption summary pill
// ---------------------------------------------------------------------------
function DisruptionPill({ disruption }: { disruption: Disruption }) {
  const isDelay = disruption.disruptionType === 'delay';
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
      {isDelay ? <Clock size={11} /> : <Ban size={11} />}
      {isDelay ? `${disruption.delayMinutes} min delay` : 'Cancelled'}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main RecoveryView
// ---------------------------------------------------------------------------
export default function RecoveryView() {
  const {
    selectedItinerary,
    activeDisruptions,
    activeDisruption,
    impactedBookings,
    setShowRecoveryOptions,
    setRecoveryTargetDisruption,
    applyRecovery,
  } = useAppState();

  const [pickedDisruption, setPickedDisruption] = useState<Disruption | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string | null>>({});
  const [preferences, setPreferences] = useState<TravelerPreferences>(
    PERSONA_PRESETS.balanced.preferences
  );

  const targetDisruption: Disruption | null = useMemo(() => {
    if (activeDisruptions.length === 1) return activeDisruptions[0];
    return pickedDisruption;
  }, [activeDisruptions, pickedDisruption]);

  const sourceBooking = useMemo(
    () =>
      targetDisruption && selectedItinerary
        ? selectedItinerary.bookings.find((b) => b.id === targetDisruption.bookingId)
        : null,
    [selectedItinerary, targetDisruption]
  );

  const options = useMemo<ScoredRecoveryOption[]>(() => {
    if (!targetDisruption || !selectedItinerary) return [];
    try {
      return generateRecoveryOptions(selectedItinerary, targetDisruption, preferences);
    } catch (err) {
      console.error('[planB] generateRecoveryOptions error:', err);
      return [];
    }
  }, [selectedItinerary, targetDisruption, preferences]);

  useEffect(() => {
    if (!options.length || !targetDisruption || !selectedItinerary) return;
    setExplanations(Object.fromEntries(options.map((o) => [o.id, null])));
    options.forEach((opt) => {
      explainRecoveryOption(opt, targetDisruption, selectedItinerary)
        .then((text) =>
          setExplanations((prev) => ({ ...prev, [opt.id]: text }))
        );
    });
  }, [options, targetDisruption, selectedItinerary]);

  const handleBack = () => {
    setPickedDisruption(null);
    setRecoveryTargetDisruption(null);
    setShowRecoveryOptions(false);
  };

  const handlePickDisruption = (d: Disruption) => {
    setPickedDisruption(d);
    setRecoveryTargetDisruption(d);
    setSelectedId(null);
    setConfirmingId(null);
    setExplanations({});
  };

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
    setPickedDisruption(null);
    setRecoveryTargetDisruption(null);
  };

  const handleCancel = () => {
    setConfirmingId(null);
  };

  const brokenCount = impactedBookings.filter((b) => b.severity === 'broken').length;
  const atRiskCount = impactedBookings.filter((b) => b.severity === 'at-risk').length;
  const totalAffected = brokenCount + atRiskCount;

  // No disruptions active at all
  if (activeDisruptions.length === 0) {
    return <EmptyState onBack={handleBack} />;
  }

  // MULTI-DISRUPTION: show the selector if the user hasn't picked yet
  if (activeDisruptions.length >= 2 && !pickedDisruption) {
    return (
      <DisruptionSelector
        disruptions={activeDisruptions}
        itineraryBookings={selectedItinerary?.bookings ?? []}
        onSelect={handlePickDisruption}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="animate-slide-down">
      {/* Back nav */}
      <button
        id="back-to-itinerary-btn"
        onClick={
          activeDisruptions.length >= 2
            ? () => { setPickedDisruption(null); setRecoveryTargetDisruption(null); }
            : handleBack
        }
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 cursor-pointer mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        {activeDisruptions.length >= 2 ? 'Back to disruptions' : 'Back to itinerary'}
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6">
        {/* Disruption type + booking name */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {targetDisruption && <DisruptionPill disruption={targetDisruption} />}
          <span className="text-sm text-gray-400">·</span>
          <span className="text-sm text-gray-500 font-medium truncate">
            {sourceBooking?.title ?? 'Affected booking'}
          </span>
          {activeDisruptions.length >= 2 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <Layers size={11} />
              Another issue still active
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          How do you want to fix this?
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          {options.length > 0
            ? `We found ${options.length} ways to get your trip back on track. Pick the one that works best for you.`
            : 'Looking for alternatives…'}
        </p>

        {/* Impact summary — only shown when there are downstream effects */}
        {totalAffected > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {brokenCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
                <AlertTriangle size={12} />
                {brokenCount} booking{brokenCount > 1 ? 's' : ''} conflicting
              </span>
            )}
            {atRiskCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                <Clock size={12} />
                {atRiskCount} booking{atRiskCount > 1 ? 's' : ''} at risk
              </span>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Priority selector                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          What matters most to you?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(PERSONA_PRESETS) as (keyof typeof PERSONA_PRESETS)[]).map((key) => {
            const preset = PERSONA_PRESETS[key];
            const isSelected = preferences.personaId === key;
            return (
              <PersonaChip
                key={key}
                label={preset.name}
                icon={preset.icon}
                tagline={preset.tagline}
                isSelected={isSelected}
                onClick={() => setPreferences(preset.preferences)}
              />
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Options list                                                         */}
      {/* ------------------------------------------------------------------ */}
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

      {/* ------------------------------------------------------------------ */}
      {/* Footer note                                                          */}
      {/* ------------------------------------------------------------------ */}
      <p className="mt-6 text-xs text-gray-400 leading-relaxed">
        Options are ranked by how well they preserve your overall trip, then by cost and timing.
        Applying an option updates your itinerary immediately.
        {activeDisruptions.length >= 2 && (
          <span className="text-amber-600 font-medium">
            {' '}Fixing this one will keep the other disruption active — you'll handle it next.
          </span>
        )}
      </p>
    </div>
  );
}
