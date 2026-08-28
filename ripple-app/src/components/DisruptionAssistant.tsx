// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: DisruptionAssistant.tsx
// PURPOSE: Conversational Ops Command Terminal for simulating disruptions.
//   Accepts natural-language inputs, resolves them via parseDisruptionFromText,
//   and triggers the existing disruption/recovery loop via setActiveDisruption.
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Send,
  Loader2,
  AlertTriangle,
  RotateCcw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import type { Itinerary } from '../lib/types';
import { parseDisruptionFromText } from '../lib/nlDisruptionEngine';
import { useAppState } from '../App';

interface Props {
  itinerary: Itinerary;
}

interface ClarificationState {
  originalQuery: string;
  question: string;
}

const PRESET_PROMPTS = [
  'Flight delayed 3 hours',
  'What if my flight is cancelled?',
  'Airport transfer cab stuck in traffic for 45 mins',
];

export default function DisruptionAssistant({ itinerary }: Props) {
  const { activeDisruption, setActiveDisruption, clearDisruption } = useAppState();

  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
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

      const result = await parseDisruptionFromText(textToSubmit, itinerary, historyParam);

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
        setActiveDisruption(result.disruption);
      }
    } catch (err) {
      console.error('[DisruptionAssistant] Parse error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to analyze disruption scenario.';
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
      {/* Terminal Title Bar */}
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
            <Terminal size={12} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xs uppercase tracking-widest font-bold text-[#1C1B19]">
                NATURAL LANGUAGE DISRUPTION DISPATCH
              </span>
              <span className="font-mono text-2xs text-[#969188]">·</span>
              <span className="font-mono text-2xs text-[#6B6760]">
                AI OPS TERMINAL
              </span>
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
              INCIDENT ACTIVE
            </span>
          )}
          <button
            type="button"
            className="text-[#6B6760] hover:text-[#1C1B19] p-0.5 cursor-pointer"
            aria-label={isExpanded ? 'Collapse terminal' : 'Expand terminal'}
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Instructions / Status Description */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#6B6760] font-body">
            <p>
              Type any operational disruption in plain English. The dispatch parser maps your scenario directly to the active itinerary graph.
            </p>
            {activeDisruption && (
              <button
                type="button"
                onClick={clearDisruption}
                className="inline-flex items-center gap-1 font-mono text-2xs uppercase text-[#9E2B25] hover:text-[#7A1E1A] font-semibold cursor-pointer flex-shrink-0"
              >
                <RotateCcw size={11} />
                <span>RESET ACTIVE INCIDENT</span>
              </button>
            )}
          </div>

          {/* Preset Chips */}
          {!clarification && !isLoading && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="font-mono text-2xs uppercase text-[#969188] mr-1">
                QUICK SCENARIOS:
              </span>
              {PRESET_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setInput(prompt);
                    handleSubmit(prompt);
                  }}
                  className="font-mono text-2xs px-2.5 py-1 rounded-[2px] border transition-colors duration-150 cursor-pointer text-[#4A3728] hover:text-[#1C1B19]"
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
                        DISPATCH INQUIRY · AMBIGUITY DETECTED
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#1C1B19] leading-snug font-body">
                      {clarification.question}
                    </p>
                    <p className="font-mono text-2xs text-[#6B6760] mt-1.5">
                      INITIAL QUERY: &ldquo;{clarification.originalQuery}&rdquo;
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelClarification}
                  className="font-mono text-2xs text-[#6B6760] hover:text-[#1C1B19] uppercase tracking-wider flex-shrink-0 cursor-pointer underline"
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
                    PARSER NOTICE
                  </span>
                  <p className="text-xs text-[#1C1B19] font-body">{error}</p>
                  <p className="text-2xs text-[#6B6760] mt-1 font-body">
                    Tip: Try specifying the flight/service number or delay duration, or use the manual &ldquo;Simulate Disruption&rdquo; button on any booking card below.
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
                    ? 'Type your answer to clarify (e.g. "The outbound flight" or "IndiGo")...'
                    : 'e.g. "What if my flight is delayed 3 hours?" or "The cab is cancelled"'
                }
                className="w-full font-mono text-xs px-3.5 py-2.5 rounded-[2px] border transition-colors outline-none focus:border-[#2B5D5C] placeholder:text-[#969188] placeholder:font-body"
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
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#234d4c';
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
                  <span>PARSING...</span>
                </>
              ) : (
                <>
                  <span>DISPATCH</span>
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
