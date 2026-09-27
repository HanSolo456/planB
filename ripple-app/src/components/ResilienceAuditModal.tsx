// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: ResilienceAuditModal.tsx
// PURPOSE: Deep-dive multi-factor trip resilience audit modal.
//   Visualizes Buffer Health, Financial Exposure, Single Points of Failure,
//   and Actionable Resilience Recommendations.
// =============================================================================

import {
  X,
  ShieldCheck,
  Clock,
  Banknote,
  GitBranch,
  RotateCcw,
  Sparkles,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import type { Itinerary, TripRiskScore } from '../lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itinerary: Itinerary;
  riskScore: TripRiskScore;
}

export default function ResilienceAuditModal({
  isOpen,
  onClose,
  itinerary,
  riskScore,
}: Props) {
  if (!isOpen) return null;

  const { pillars, recommendations = [], auditSummary } = riskScore;

  const getPillarColor = (score: number) => {
    if (score >= 75) return '#0A1E30';
    if (score >= 45) return '#B8552F';
    return '#A33B26';
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
      style={{ backgroundColor: 'rgba(28, 27, 25, 0.65)', backdropFilter: 'blur(3px)' }}
    >
      <div
        data-lenis-prevent
        className="bg-white rounded-[2px] w-full max-w-4xl border border-[#DEDAD2] shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-modal-title"
      >
        {/* Header Bar */}
        <div className="bg-[#17212B] text-[#F7F4EE] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-[#363430]">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[2px] bg-[#0A1E30] flex items-center justify-center text-white flex-shrink-0">
              <ShieldCheck size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-mono text-3xs sm:text-2xs uppercase tracking-widest text-[#B8552F] font-bold">
                  DIAGNOSTIC TELEMETRY
                </span>
                <span className="text-[#4A5568]">·</span>
                <span className="font-mono text-3xs sm:text-2xs text-[#8896A4]">REF: {itinerary.id.toUpperCase()}</span>
              </div>
              <h2 id="audit-modal-title" className="font-display font-bold text-sm sm:text-lg text-white">
                Itinerary Resilience & Vulnerability Audit
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] border border-[#524E48] hover:border-[#F7F4EE] text-xs font-mono text-[#DEDAD2] hover:text-white transition-colors cursor-pointer"
              title="Print Audit Manifest"
            >
              <Printer size={14} />
              <span>PRINT REPORT</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-[2px] border border-[#524E48] hover:border-[#F7F4EE] text-[#DEDAD2] hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Audit context: the Trip Risk Badge is the only overall score. */}
          <div className="bg-[#F7F4EE] border border-[#EBE7DF] rounded-[2px] p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-5">
              <div>
                <div>
                  <h3 className="font-display font-bold text-lg text-[#17212B]">
                    {itinerary.destination} — Resilience factor detail
                  </h3>
                  <p className="text-xs text-[#4A5568] mt-1 max-w-xl font-body">
                    {auditSummary}
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-[#EBE7DF] text-right">
                <span className="font-mono text-3xs text-[#8896A4] uppercase">Primary Traveler</span>
                <span className="text-xs font-semibold text-[#17212B]">{itinerary.travelerName}</span>
                <span className="font-mono text-2xs text-[#4A5568] mt-0.5">
                  {itinerary.bookings.length} Bookings · {itinerary.startDate}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Pillars Breakdown */}
          {pillars && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-mono text-2xs uppercase tracking-widest font-bold text-[#17212B]">
                    Resilience factors
                  </h4>
                  <p className="text-2xs text-[#4A5568] mt-1">
                    These contributing factors add context to the single Trip Risk Score shown in the Trip Risk Badge.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Pillar 1: Buffer Slack Health */}
                <div className="bg-white border border-[#EBE7DF] p-4 rounded-[2px]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-[#0A1E30]" />
                      <span className="font-bold text-xs text-[#17212B] font-body">
                        {pillars.bufferHealth.label}
                      </span>
                    </div>
                    <span
                      className="font-mono text-3xs font-bold text-[#8896A4]"
                      style={{ color: getPillarColor(pillars.bufferHealth.score) }}
                    >
                      WEIGHT 35%
                    </span>
                  </div>
                  <div className="w-full bg-[#EFECE6] h-1.5 rounded-none mb-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pillars.bufferHealth.score}%`,
                        backgroundColor: getPillarColor(pillars.bufferHealth.score),
                      }}
                    />
                  </div>
                  <p className="text-2xs text-[#4A5568] font-body leading-relaxed">
                    {pillars.bufferHealth.description}
                  </p>
                </div>

                {/* Pillar 2: Financial Exposure */}
                <div className="bg-white border border-[#EBE7DF] p-4 rounded-[2px]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Banknote size={16} className="text-[#B8552F]" />
                      <span className="font-bold text-xs text-[#17212B] font-body">
                        {pillars.financialExposure.label}
                      </span>
                    </div>
                    <span
                      className="font-mono text-3xs font-bold text-[#8896A4]"
                      style={{ color: getPillarColor(pillars.financialExposure.score) }}
                    >
                      WEIGHT 25%
                    </span>
                  </div>
                  <div className="w-full bg-[#EFECE6] h-1.5 rounded-none mb-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pillars.financialExposure.score}%`,
                        backgroundColor: getPillarColor(pillars.financialExposure.score),
                      }}
                    />
                  </div>
                  <p className="text-2xs text-[#4A5568] font-body leading-relaxed">
                    {pillars.financialExposure.description}
                  </p>
                </div>

                {/* Pillar 3: Single Point of Failure */}
                <div className="bg-white border border-[#EBE7DF] p-4 rounded-[2px]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <GitBranch size={16} className="text-[#3F4F6B]" />
                      <span className="font-bold text-xs text-[#17212B] font-body">
                        {pillars.criticalPathRisk.label}
                      </span>
                    </div>
                    <span
                      className="font-mono text-3xs font-bold text-[#8896A4]"
                      style={{ color: getPillarColor(pillars.criticalPathRisk.score) }}
                    >
                      WEIGHT 25%
                    </span>
                  </div>
                  <div className="w-full bg-[#EFECE6] h-1.5 rounded-none mb-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pillars.criticalPathRisk.score}%`,
                        backgroundColor: getPillarColor(pillars.criticalPathRisk.score),
                      }}
                    />
                  </div>
                  <p className="text-2xs text-[#4A5568] font-body leading-relaxed">
                    {pillars.criticalPathRisk.description}
                    {pillars.criticalPathRisk.chokepointLabels.length > 0 && (
                      <span className="font-mono text-3xs text-[#17212B] block mt-1">
                        Hubs: {pillars.criticalPathRisk.chokepointLabels.join(', ')}
                      </span>
                    )}
                  </p>
                </div>

                {/* Pillar 4: Alternative Redundancy */}
                <div className="bg-white border border-[#EBE7DF] p-4 rounded-[2px]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <RotateCcw size={16} className="text-[#0A1E30]" />
                      <span className="font-bold text-xs text-[#17212B] font-body">
                        {pillars.alternativeRedundancy.label}
                      </span>
                    </div>
                    <span
                      className="font-mono text-3xs font-bold text-[#8896A4]"
                      style={{ color: getPillarColor(pillars.alternativeRedundancy.score) }}
                    >
                      WEIGHT 15%
                    </span>
                  </div>
                  <div className="w-full bg-[#EFECE6] h-1.5 rounded-none mb-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pillars.alternativeRedundancy.score}%`,
                        backgroundColor: getPillarColor(pillars.alternativeRedundancy.score),
                      }}
                    />
                  </div>
                  <p className="text-2xs text-[#4A5568] font-body leading-relaxed">
                    {pillars.alternativeRedundancy.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actionable recommendations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#B8552F]" />
                <h4 className="font-mono text-2xs uppercase tracking-widest font-bold text-[#17212B]">
                  Proactive Resilience Recommendations ({recommendations.length})
                </h4>
              </div>
            </div>

            {recommendations.length === 0 ? (
              <div className="bg-[#F7F4EE] border border-[#EBE7DF] p-4 text-center rounded-[2px]">
                <CheckCircle2 size={20} className="mx-auto text-[#0A1E30] mb-1.5" />
                <p className="text-xs font-semibold text-[#17212B]">Optimal Itinerary Configuration</p>
                <p className="text-2xs text-[#4A5568] mt-0.5">
                  No structural vulnerabilities detected. All buffer margins and cancellation terms meet recommended thresholds.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recommendations.map((rec) => {
                  return (
                    <div
                      key={rec.id}
                      className="p-3.5 rounded-[2px] border bg-white border-[#DEDAD2] flex items-start gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-6 h-6 rounded-[2px] flex items-center justify-center flex-shrink-0 mt-0.5 border bg-[#F7F4EE] border-[#DEDAD2] text-[#8896A4]"
                        >
                          <Sparkles size={14} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="font-body font-bold text-xs text-[#17212B]">
                              {rec.title}
                            </span>
                            <span className="font-mono text-3xs uppercase px-1.5 py-0.5 bg-[#EFECE6] text-[#4A5568] rounded-[2px]">
                              {rec.type.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-[#4A5568] font-body leading-relaxed">
                            {rec.description}
                          </p>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F7F4EE] border-t border-[#DEDAD2] px-4 sm:px-6 py-3 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span className="text-3xs sm:text-2xs text-[#8896A4] font-mono text-center sm:text-left">
            planB INTELLIGENT TRAVEL RESILIENCE ENGINE
          </span>
          <button
            onClick={onClose}
            type="button"
            className="w-full sm:w-auto px-4 py-2 bg-[#17212B] hover:bg-[#363430] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-[2px] cursor-pointer transition-colors"
          >
            DISMISS AUDIT
          </button>
        </div>
      </div>
    </div>
  );
}
