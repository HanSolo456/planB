// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: DisruptionAssistant.tsx
// PURPOSE: Exploratory "What if...?" scenario tester.
//   Accepts natural-language questions, resolves them via parseDisruptionFromText,
//   and triggers the existing disruption/recovery loop via addDisruption.
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  RotateCcw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Itinerary, Disruption } from '../lib/types';
import { parseDisruptionFromText } from '../lib/nlDisruptionEngine';
import { isNugenConfigured } from '../lib/nugenDisruptionEngine';
import { useAppState } from '../App';

interface Props {
  itinerary: Itinerary;
  onSimulateInSandbox?: (d: Disruption) => void;
}

interface ClarificationState {
  originalQuery: string;
  question: string;
}

const PRESET_PROMPTS = [
  'What if my flight is delayed 3 hours?',
  'What happens if my flight is cancelled?',
  'What if our airport cab gets stuck in traffic for 45 mins?',
];

// Nugen badge shown when API key is configured
const NugenBadge = () => (
  <span
    className="inline-flex items-center gap-1 font-mono text-2xs px-1.5 py-0.5 rounded-[2px] border flex-shrink-0"
    style={{
      backgroundColor: '#EEF6FF',
      borderColor: '#93C5FD',
      color: '#1D4ED8',
    }}
    title="Powered by Nugen Intelligence — travel-domain-aligned AI model"
  >
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="3.5" fill="#3B82F6" />
      <circle cx="4" cy="4" r="1.5" fill="white" />
    </svg>
    NUGEN AI
  </span>
);

export default function DisruptionAssistant({ itinerary, onSimulateInSandbox }: Props) {
  const { activeDisruptions, addDisruption, clearAllDisruptions, hasCapacityForAnotherDisruption } = useAppState();
  const activeDisruption = activeDisruptions[0] ?? null;

  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<ClarificationState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Clear clarification state when active itinerary or active disruption resets
  useEffect(() => {
    setClarification(null);
    setError(null);
  }, [itinerary.id]);

  const handleSubmit = async (overrideText?: string) => {
    const textToSubmit = (overrideText ?? input).trim();
    if (!textToSubmit || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const historyParam = clarification
        ? {
            originalQuery: clarification.originalQuery,
            clarificationQuestion: clarification.question,
          }
        : undefined;

      const result = await parseDisruptionFromText(textToSubmit, itinerary, historyParam, activeDisruption);

      if (result.needsClarification) {
        setClarification({
          originalQuery: clarification ? clarification.originalQuery : textToSubmit,
          question: result.question,
        });
        setInput('');
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        // Disruption successfully resolved!
        setClarification(null);
        setInput('');
        if (onSimulateInSandbox) {
          onSimulateInSandbox(result.disruption);
        } else if (!hasCapacityForAnotherDisruption()) {
          setError(
            'Clear an existing disruption before testing another scenario.'
          );
        } else {
          addDisruption(result.disruption);
        }
      }
    } catch (err) {
      console.error('[DisruptionAssistant] Parse error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to test this scenario.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCancelClarification = () => {
    setClarification(null);
    setInput('');
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div
      className="bg-white rounded-[2px] mb-6 border transition-all duration-150"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* Title Bar */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b cursor-pointer select-none"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-surface-alt)',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-5 h-5 rounded-[2px] flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: activeDisruption ? 'var(--color-disrupted)' : 'var(--color-confirmed)',
              color: '#FFFFFF',
            }}
          >
            <Sparkles size={12} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-2xs uppercase tracking-widest font-bold text-[#17212B]">
                Test a Scenario · "What if...?"
              </span>
              <span className="font-mono text-2xs text-[#8896A4]">·</span>
              <span className="text-2xs text-[#4A5568]">
                Optional · Explore hypothetical delays
              </span>
              {isNugenConfigured() && <NugenBadge />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeDisruption && (
            <span
              className="font-mono text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] border"
              style={{
                backgroundColor: 'var(--color-disrupted-bg)',
                color: 'var(--color-disrupted)',
                borderColor: 'var(--color-disrupted-border)',
              }}
            >
              SCENARIO ACTIVE
            </span>
          )}
          <button
            type="button"
            className="text-[#4A5568] hover:text-[#17212B] p-0.5 cursor-pointer"
            aria-label={isExpanded ? 'Collapse scenario tester' : 'Expand scenario tester'}
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Instructions / Status Description */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#4A5568] font-body">
            <p>
              Curious what would happen if your flight is delayed or traffic slows you down? Ask here in plain words to see how your trip holds up before anything goes wrong.
              {isNugenConfigured() && (
                <span className="ml-1 font-mono text-2xs text-[#1D4ED8]">
                  · Powered by Nugen Intelligence (travel-domain AI)
                </span>
              )}
            </p>
            {activeDisruption && (
              <button
                type="button"
                onClick={clearAllDisruptions}
                className="inline-flex items-center gap-1 font-mono text-2xs uppercase text-[#9E2B25] hover:text-[#7A1E1A] font-semibold cursor-pointer flex-shrink-0"
              >
                <RotateCcw size={11} />
                <span>RESET SCENARIO{activeDisruptions.length > 1 ? 'S' : ''}</span>
              </button>
            )}
          </div>

          {/* Preset Chips */}
          {!clarification && !isLoading && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="font-mono text-2xs uppercase text-[#8896A4] mr-1">
                TRY ASKING:
              </span>
              {PRESET_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setInput(prompt);
                    handleSubmit(prompt);
                  }}
                  className="font-mono text-2xs px-2.5 py-1 rounded-[2px] border transition-colors duration-150 cursor-pointer text-[#4A3728] hover:text-[#17212B]"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg-base)',
                  }}
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
          )}

          {/* Clarification Box */}
          {clarification && (
            <div
              className="p-3 rounded-[2px] border animate-slide-down"
              style={{
                backgroundColor: 'var(--color-at-risk-bg)',
                borderColor: 'var(--color-at-risk-border)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <HelpCircle
                    size={15}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: 'var(--color-at-risk)' }}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-mono text-2xs uppercase tracking-widest font-bold"
                        style={{ color: 'var(--color-at-risk)' }}
                      >
                        WHICH BOOKING DID YOU MEAN?
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#17212B] leading-snug font-body">
                      {clarification.question}
                    </p>
                    <p className="font-mono text-2xs text-[#4A5568] mt-1.5">
                      YOUR QUESTION: &ldquo;{clarification.originalQuery}&rdquo;
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelClarification}
                  className="font-mono text-2xs text-[#4A5568] hover:text-[#17212B] uppercase tracking-wider flex-shrink-0 cursor-pointer underline"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div
              className="p-3 rounded-[2px] border animate-slide-down flex items-start justify-between gap-3"
              style={{
                backgroundColor: 'var(--color-disrupted-bg)',
                borderColor: 'var(--color-disrupted-border)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  size={15}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--color-disrupted)' }}
                />
                <div>
                  <span className="font-mono text-2xs uppercase tracking-widest font-bold text-[#9E2B25] block mb-0.5">
                    NOTE
                  </span>
                  <p className="text-xs text-[#17212B] font-body">{error}</p>
                  <p className="text-2xs text-[#4A5568] mt-1 font-body">
                    Tip: Try naming the specific flight, hotel, or delay duration, or use the "Report a disruption" button on any booking card above.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setError(null)}
                className="font-mono text-2xs text-[#9E2B25] hover:text-[#7A1E1A] uppercase tracking-wider flex-shrink-0 cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          )}

          {/* Input & Action Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={
                  clarification
                    ? 'Type your answer (e.g. "The morning flight" or "IndiGo")...'
                    : 'e.g. "What if my flight is delayed 2 hours?" or "What if the cab is late?"'
                }
                className="w-full text-xs px-3.5 py-2.5 rounded-[2px] border transition-colors outline-none focus:border-[#0A1E30] placeholder:text-[#8896A4] font-body"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: clarification
                    ? 'var(--color-at-risk-border)'
                    : 'var(--color-border)',
                  color: 'var(--color-text-main)',
                }}
              />
            </div>

            <button
              type="button"
              id="submit-nl-disruption-btn"
              onClick={() => handleSubmit()}
              disabled={isLoading || !input.trim()}
              className="font-mono text-xs font-semibold uppercase tracking-wider px-4 py-2.5 rounded-[2px] transition-colors duration-150 inline-flex items-center gap-2 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: 'var(--color-confirmed)',
                color: '#FFFFFF',
              }}
              onMouseEnter={(e) => {
                if (!isLoading && input.trim()) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#071526';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  'var(--color-confirmed)';
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>CHECKING...</span>
                </>
              ) : (
                <>
                  <span>TEST SCENARIO</span>
                  <Send size={12} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
