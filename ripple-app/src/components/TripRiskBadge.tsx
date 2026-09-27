// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: TripRiskBadge.tsx
// PURPOSE: Prominent whole-itinerary Trip Risk Score gauge.
//   Evaluates scheduling robustness (0-100) and provides an expandable
//   breakdown of vulnerable connections in dispatch-console aesthetic.
// =============================================================================

import { useState, useMemo } from 'react';
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, AlertCircle, Sparkles } from 'lucide-react';
import type { Itinerary } from '../lib/types';
import { calculateTripRiskScore } from '../lib/impactEngine';
import ResilienceAuditModal from './ResilienceAuditModal';
import { useAppState } from '../App';

interface Props {
  itinerary: Itinerary;
}

export default function TripRiskBadge({ itinerary }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const { activeDisruptions, impactedBookings } = useAppState();

  // Recompute live whenever the itinerary or active disruptions change.
  // When disruptions are active the score reflects the post-disruption state:
  // delayed bookings have their endTime shifted, cancelled ones are removed,
  // and each impacted booking adds a flat penalty to the score.
  const riskScore = useMemo(
    () => calculateTripRiskScore(itinerary, activeDisruptions, impactedBookings),
    [itinerary, activeDisruptions, impactedBookings]
  );

  const { overallScore, level, legRisks } = riskScore;

  // Level configuration matching ops manifest tokens
  const config = useMemo(() => {
    switch (level) {
      case 'low':
        return {
          label: 'LOW RISK',
          subtext: 'Schedule buffers are well-calibrated and resilient.',
          color: 'var(--color-confirmed)',
          bgColor: 'var(--color-confirmed-bg)',
          borderColor: 'var(--color-confirmed-border)',
          icon: ShieldCheck,
        };
      case 'moderate':
        return {
          label: 'MODERATE RISK',
          subtext: 'Contains tight transfer buffers vulnerable to minor delays.',
          color: 'var(--color-at-risk)',
          bgColor: 'var(--color-at-risk-bg)',
          borderColor: 'var(--color-at-risk-border)',
          icon: ShieldAlert,
        };
      case 'high':
        return {
          label: 'HIGH RISK',
          subtext: 'Critical timing constraints or zero-margin connections detected.',
          color: 'var(--color-disrupted)',
          bgColor: 'var(--color-disrupted-bg)',
          borderColor: 'var(--color-disrupted-border)',
          icon: ShieldAlert,
        };
    }
  }, [level]);

  const Icon = config.icon;

  // Discrete 10-block console gauge segments (10% each)
  const totalBlocks = 10;
  const activeBlocks = Math.round(overallScore / 10);

  return (
    <div
      className="bg-white rounded-[2px] mb-6 border transition-colors duration-150"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* Main Console Gauge Header */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Score & Risk Pill */}
          <div className="flex items-start sm:items-center gap-4">
            <div
              className="w-10 h-10 rounded-[2px] flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: config.bgColor,
                border: `1px solid ${config.borderColor}`,
                color: config.color,
              }}
            >
              <Icon size={20} strokeWidth={2.2} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-2xs uppercase tracking-widest font-bold text-[#8896A4]">
                  TRIP RESILIENCE GAUGE
                </span>
                <span className="font-mono text-2xs text-[#8896A4]">·</span>
                <span
                  className="font-mono text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px]"
                  style={{
                    backgroundColor: config.bgColor,
                    color: config.color,
                    border: `1px solid ${config.borderColor}`,
                  }}
                >
                  {config.label}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold tracking-tight text-[#17212B]">
                  {overallScore}
                </span>
                <span className="font-mono text-sm text-[#8896A4]">/100</span>
                <span className="text-xs text-[#4A5568] font-body ml-2 hidden md:inline">
                  {config.subtext}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Discrete Segment Gauge & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#EBE7DF]">
            {/* Segmented Terminal Meter */}
            <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 w-full sm:w-auto">
              <span className="font-mono text-2xs uppercase text-[#8896A4]">
                BUFFER INTEGRITY
              </span>
              <div className="flex items-center gap-1" aria-label={`Score: ${overallScore} out of 100`}>
                {Array.from({ length: totalBlocks }).map((_, i) => {
                  const isFilled = i < activeBlocks;
                  return (
                    <div
                      key={i}
                      className="w-2 h-3.5 rounded-[1px] transition-colors duration-150"
                      style={{
                        backgroundColor: isFilled ? config.color : 'var(--color-bg-surface-alt)',
                        border: `1px solid ${isFilled ? config.color : 'var(--color-border)'}`,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Actions: Audit Report + Vulnerabilities Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Audit Report Modal Trigger */}
              <button
                type="button"
                id="open-audit-report-btn"
                onClick={() => setIsAuditModalOpen(true)}
                className="flex-1 sm:flex-initial justify-center font-mono text-2xs uppercase tracking-wider font-bold px-3 py-2 rounded-[2px] border flex items-center gap-1.5 transition-colors cursor-pointer text-white bg-[#17212B] hover:bg-[#363430] border-[#17212B] whitespace-nowrap"
              >
                <Sparkles size={13} className="text-[#E5A93C] flex-shrink-0" />
                <span>AUDIT REPORT</span>
              </button>

              {/* Expand / Details Toggle Button */}
              {legRisks.length > 0 ? (
                <button
                  type="button"
                  id="toggle-risk-breakdown-btn"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex-1 sm:flex-initial justify-center font-mono text-2xs uppercase tracking-wider font-semibold px-3 py-2 rounded-[2px] border flex items-center gap-1.5 transition-colors cursor-pointer text-[#17212B] hover:bg-[#F7F4EE] whitespace-nowrap"
                  style={{ borderColor: 'var(--color-border)' }}
                  aria-expanded={isExpanded}
                >
                  <span>{isExpanded ? 'HIDE' : 'VULNERABILITIES'}</span>
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    style={{ backgroundColor: config.color }}
                  >
                    {legRisks.length}
                  </span>
                  {isExpanded ? <ChevronUp size={13} className="flex-shrink-0" /> : <ChevronDown size={13} className="flex-shrink-0" />}
                </button>
              ) : (
                <div className="font-mono text-2xs uppercase font-bold text-[#0A1E30] px-2.5 py-1.5 rounded-[2px] bg-[#E8EEF4] border border-[#A8C0D4] flex-1 sm:flex-initial text-center whitespace-nowrap">
                  0 RISKS FLAGGED ✓
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Vulnerability Breakdown Table */}
      {isExpanded && legRisks.length > 0 && (
        <div
          className="border-t px-4 py-3 animate-slide-down"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-surface-alt)',
          }}
        >
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <span className="font-mono text-2xs uppercase tracking-widest font-bold text-[#4A5568]">
              SCHEDULE VULNERABILITIES (SORTED BY RISK IMPACT)
            </span>
            <span className="font-mono text-2xs text-[#8896A4]">
              {legRisks.length} CONNECTION{legRisks.length !== 1 ? 'S' : ''} FLAGGED
            </span>
          </div>

          <div className="space-y-2">
            {legRisks.map((risk, index) => (
              <div
                key={`${risk.bookingId}-${index}`}
                className="p-2.5 rounded-[2px] bg-white border flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle
                    size={14}
                    className="flex-shrink-0 mt-0.5"
                    style={{
                      color: risk.riskContribution >= 30 ? 'var(--color-disrupted)' : 'var(--color-at-risk)',
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#17212B]">
                        {risk.connectionLabel}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A5568] font-body mt-0.5">
                      {risk.reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  <span
                    className="font-mono text-xs font-bold px-2 py-0.5 rounded-[2px]"
                    style={{
                      backgroundColor:
                        risk.riskContribution >= 30
                          ? 'var(--color-disrupted-bg)'
                          : 'var(--color-at-risk-bg)',
                      color:
                        risk.riskContribution >= 30
                          ? 'var(--color-disrupted)'
                          : 'var(--color-at-risk)',
                      border: `1px solid ${
                        risk.riskContribution >= 30
                          ? 'var(--color-disrupted-border)'
                          : 'var(--color-at-risk-border)'
                      }`,
                    }}
                  >
                    -{risk.riskContribution} PTS
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deep-Dive Multi-Factor Resilience Audit Modal */}
      <ResilienceAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        itinerary={itinerary}
        riskScore={riskScore}
      />
    </div>
  );
}
