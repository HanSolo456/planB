// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: EmptyDashboard.tsx
// PURPOSE: Empty state shown on the dashboard when no itinerary has been imported.
//   Prompts user to go to the Import page and optionally load the sample trip.
// =============================================================================

import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, Sparkles } from 'lucide-react';
import { PlanBLogoMark } from './PlanBLogo';

export default function EmptyDashboard() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Logo mark */}
      <PlanBLogoMark size={56} className="mb-6 opacity-80" />

      {/* Headline */}
      <p className="font-mono text-2xs uppercase tracking-widest text-[#969188] font-semibold mb-3">
        NO ITINERARY LOADED
      </p>
      <h2 className="font-display font-bold text-3xl text-[#1C1B19] tracking-tight mb-3">
        Your manifest is empty.
      </h2>
      <p className="font-body text-sm text-[#6B6760] max-w-[42ch] leading-relaxed mb-10">
        Paste any booking confirmation — flight, hotel, train, transfer, activity — and planB will
        build the full dependency graph and make it disruption-ready in seconds.
      </p>

      {/* Primary CTA */}
      <button
        id="empty-import-cta"
        onClick={() => navigate('/app/import')}
        className="inline-flex items-center gap-2.5 font-mono text-sm font-bold uppercase tracking-wider px-6 py-3 rounded-[2px] transition-colors duration-150 mb-4 cursor-pointer"
        style={{ backgroundColor: 'var(--color-confirmed)', color: '#FFFFFF' }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#234d4c')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed)')
        }
      >
        <FileText size={15} />
        IMPORT A TRIP
        <ArrowRight size={15} />
      </button>

      {/* Hint about sample */}
      <button
        id="empty-sample-cta"
        onClick={() => navigate('/app/import')}
        className="inline-flex items-center gap-2 font-mono text-xs text-[#6B6760] hover:text-[#2B5D5C] transition-colors duration-150 cursor-pointer"
      >
        <Sparkles size={12} />
        Try the sample Goa trip confirmation
      </button>

      {/* Feature chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-12">
        {[
          'Flight confirmations',
          'Hotel bookings',
          'Train tickets',
          'Airport transfers',
          'Activities & tours',
        ].map((label) => (
          <span
            key={label}
            className="font-mono text-2xs px-3 py-1.5 rounded-[2px]"
            style={{
              backgroundColor: 'var(--color-bg-surface-alt)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
