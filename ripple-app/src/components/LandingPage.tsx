// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: LandingPage.tsx
// PURPOSE: Zero-auth landing page. CTA routes straight into the app shell.
//   Uses the same manifest aesthetic tokens as the rest of the product —
//   no separate design language, no gradients, no glow.
// =============================================================================

import { Compass, ArrowRight, GitBranch, Zap, FileText, Plane, Hotel, Train } from 'lucide-react';

interface Props {
  onLaunch: () => void;
}

// ---------------------------------------------------------------------------
// Inline landing header — NOT the app Header (no status pill needed here)
// ---------------------------------------------------------------------------
function LandingHeader({ onLaunch }: { onLaunch: () => void }) {
  return (
    <header
      className="sticky top-0 z-50 bg-white border-b"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="max-w-7xl mx-auto px-8 md:px-16 py-3.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-[2px]"
            style={{ backgroundColor: 'var(--color-confirmed)', color: '#FFFFFF' }}
          >
            <Compass size={16} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold tracking-tight text-[#1C1B19] leading-none">
                planB
              </span>
              <span
                className="font-mono text-2xs uppercase tracking-widest px-1.5 py-0.5 rounded-[2px]"
                style={{
                  backgroundColor: 'var(--color-bg-surface-alt)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                OPS MANIFEST
              </span>
            </div>
            <p className="text-xs text-[#6B6760] mt-0.5">
              Real-time Travel Disruption &amp; Re-accommodation Engine
            </p>
          </div>
        </div>

        {/* Header CTA */}
        <button
          id="landing-header-cta"
          onClick={onLaunch}
          className="font-mono text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-[2px] transition-colors duration-150"
          style={{
            backgroundColor: 'var(--color-confirmed)',
            color: '#FFFFFF',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#234d4c')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'var(--color-confirmed)')
          }
        >
          LAUNCH DEMO
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Mini manifest card — decorative static graphic for hero right column
// ---------------------------------------------------------------------------
function MiniManifestCard() {
  const segments = [
    {
      icon: Plane,
      code: 'BA 256',
      route: 'LHR → CDG',
      time: '08:30 → 10:45',
      status: 'CONFIRMED',
      statusColor: 'var(--color-confirmed)',
      statusBg: 'var(--color-confirmed-bg)',
      statusBorder: 'var(--color-confirmed-border)',
      note: null,
    },
    {
      icon: Train,
      code: 'TGV 6217',
      route: 'CDG → LYS',
      time: '13:05 → 15:20',
      status: 'AT RISK',
      statusColor: 'var(--color-at-risk)',
      statusBg: 'var(--color-at-risk-bg)',
      statusBorder: 'var(--color-at-risk-border)',
      note: '137 min buffer',
    },
    {
      icon: Hotel,
      code: 'IBIS LYON',
      route: 'Check-in',
      time: 'After 15:00',
      status: 'DISRUPTED',
      statusColor: 'var(--color-disrupted)',
      statusBg: 'var(--color-disrupted-bg)',
      statusBorder: 'var(--color-disrupted-border)',
      note: null,
    },
  ];

  return (
    <div
      className="rounded-[2px] overflow-hidden select-none"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 12px rgba(28,27,25,0.07)',
      }}
    >
      {/* Card header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-surface-alt)',
        }}
      >
        <div className="flex items-center gap-2">
          <Compass size={11} style={{ color: 'var(--color-confirmed)' }} />
          <span className="font-mono text-2xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-main)' }}>
            ITINERARY MANIFEST
          </span>
        </div>
        <span className="font-mono text-2xs" style={{ color: 'var(--color-text-subtle)' }}>
          3 SEGMENTS
        </span>
      </div>

      {/* Disruption banner */}
      <div
        className="px-4 py-2 flex items-center gap-2 border-b"
        style={{
          borderColor: 'var(--color-disrupted-border)',
          backgroundColor: 'var(--color-disrupted-bg)',
        }}
      >
        <span className="font-mono text-2xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-disrupted)' }}>
          ⚠ BA 256 DELAYED +85 MIN — CASCADE DETECTED
        </span>
      </div>

      {/* Segments */}
      <div>
        {segments.map((seg, i) => {
          const Icon = seg.icon;
          return (
            <div
              key={i}
              className="px-4 py-3"
              style={{ borderBottom: i < segments.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                  <span className="font-mono text-2xs font-bold" style={{ color: 'var(--color-text-main)' }}>
                    {seg.code}
                  </span>
                  <span className="font-mono text-2xs" style={{ color: 'var(--color-text-muted)' }}>
                    {seg.route}
                  </span>
                </div>
                <span
                  className="font-mono text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[1px]"
                  style={{
                    color: seg.statusColor,
                    backgroundColor: seg.statusBg,
                    border: `1px solid ${seg.statusBorder}`,
                  }}
                >
                  {seg.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xs" style={{ color: 'var(--color-text-subtle)' }}>
                  {seg.time}
                </span>
                {seg.note && (
                  <span className="font-mono text-2xs" style={{ color: 'var(--color-at-risk)' }}>
                    {seg.note}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recovery options strip */}
      <div
        className="px-4 py-2.5 flex items-center justify-between border-t"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-confirmed-bg)',
        }}
      >
        <span className="font-mono text-2xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-confirmed)' }}>
          2 RECOVERY OPTIONS FOUND
        </span>
        <ArrowRight size={11} style={{ color: 'var(--color-confirmed)' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step data for "How it works"
// ---------------------------------------------------------------------------
const STEPS = [
  {
    number: '01',
    title: 'Import your trip',
    detail:
      'Paste any booking confirmation — flight, hotel, train, activity. The AI extracts every segment into a structured itinerary in seconds.',
  },
  {
    number: '02',
    title: 'Every dependency mapped',
    detail:
      'planB connects your legs automatically, computing buffer constraints between each booking so it knows exactly what depends on what.',
  },
  {
    number: '03',
    title: 'Disruption hits. Recovery found.',
    detail:
      'Simulate or detect a delay or cancellation. The engine cascades the impact through the graph and surfaces ranked recovery options — instantly.',
  },
];

// ---------------------------------------------------------------------------
// Feature strip data
// ---------------------------------------------------------------------------
const FEATURES = [
  {
    icon: GitBranch,
    label: 'DEPENDENCY-AWARE CASCADE',
    description:
      'Not just "your flight is delayed." We trace every downstream booking that loses its buffer and tell you exactly what breaks and by how much.',
  },
  {
    icon: FileText,
    label: 'AI IMPORT FROM RAW TEXT',
    description:
      'Paste any booking confirmation email or ticket. The AI extracts a structured itinerary instantly — complete with inferred dependencies and buffer times.',
  },
  {
    icon: Zap,
    label: 'GROUNDED RECOVERY REASONING',
    description:
      'Every option comes with a dispatcher note citing the actual cost delta, time delta, and percentage of your trip that stays intact. No invented figures.',
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LandingPage({ onLaunch }: Props) {
  return (
    <div
      className="min-h-screen font-body antialiased"
      style={{
        backgroundColor: 'var(--color-bg-base)',
        color: 'var(--color-text-main)',
      }}
    >
      <LandingHeader onLaunch={onLaunch} />

      <main className="max-w-7xl mx-auto px-8 md:px-16">

        {/* ── 1. HERO ─────────────────────────────────────────────── */}
        <section className="py-20 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {/* Two-column: 60% text / 40% manifest card */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-16 items-center">

            {/* LEFT: headline + subhead + CTA */}
            <div>
              {/* Eyebrow */}
              <p className="font-mono text-2xs uppercase tracking-widest text-[#6B6760] font-semibold mb-5">
                TRAVEL DISRUPTION RECOVERY PLATFORM
              </p>

              {/* Headline */}
              <h1
                className="font-display font-bold leading-[1.1] mb-6"
                style={{
                  fontSize: 'clamp(2.5rem, 4vw, 4rem)',
                  color: 'var(--color-text-main)',
                }}
              >
                When one booking breaks, the rest of your trip shouldn't.
              </h1>

              {/* Subheadline */}
              <p
                className="font-body text-base text-[#6B6760] leading-relaxed mb-10"
                style={{ maxWidth: '52ch' }}
              >
                planB maps the dependency graph of your entire itinerary, detects
                exactly which bookings a disruption breaks, and surfaces ranked
                recovery options with AI-generated reasoning — in seconds.
              </p>

              {/* CTA */}
              <button
                id="landing-hero-cta"
                onClick={onLaunch}
                className="inline-flex items-center gap-2.5 font-mono text-sm font-bold uppercase tracking-wider px-7 py-3.5 rounded-[2px] transition-all duration-150"
                style={{
                  backgroundColor: 'var(--color-confirmed)',
                  color: '#FFFFFF',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#234d4c')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--color-confirmed)')
                }
              >
                LAUNCH DEMO
                <ArrowRight size={15} />
              </button>

              {/* No-auth note */}
              <p className="font-mono text-2xs text-[#969188] mt-4">
                NO LOGIN REQUIRED · LOADS INSTANTLY
              </p>
            </div>

            {/* RIGHT: mini manifest card visual — hidden on small screens */}
            <div className="hidden lg:block">
              <MiniManifestCard />
            </div>
          </div>
        </section>

        {/* ── 2. HOW IT WORKS ─────────────────────────────────────── */}
        <section className="py-16 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <p className="font-mono text-2xs uppercase tracking-widest text-[#969188] font-semibold mb-8">
            HOW IT WORKS
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="p-5 rounded-[2px]"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {/* Step number */}
                <div
                  className="font-mono text-2xs font-bold mb-4 w-8 h-8 rounded-[2px] flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-confirmed-bg)',
                    color: 'var(--color-confirmed)',
                    border: '1px solid var(--color-confirmed-border)',
                  }}
                >
                  {step.number}
                </div>

                {/* Title */}
                <h3
                  className="font-display font-bold text-lg leading-snug mb-2"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  {step.title}
                </h3>

                {/* Detail */}
                <p className="font-body text-xs text-[#6B6760] leading-relaxed">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. WHY THIS IS DIFFERENT ────────────────────────────── */}
        <section className="py-16 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <p className="font-mono text-2xs uppercase tracking-widest text-[#969188] font-semibold mb-8">
            WHY THIS IS DIFFERENT
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px"
            style={{ backgroundColor: 'var(--color-border)' }}
          >
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.label}
                  className="p-5"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={14} style={{ color: 'var(--color-confirmed)', flexShrink: 0 }} />
                    <span
                      className="font-mono text-2xs font-bold uppercase tracking-wider"
                      style={{ color: 'var(--color-confirmed)' }}
                    >
                      {f.label}
                    </span>
                  </div>
                  <p className="font-body text-xs text-[#6B6760] leading-relaxed">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 4. BOTTOM CTA ───────────────────────────────────────── */}
        <section className="py-16 flex flex-col items-center text-center gap-5">
          <p className="font-mono text-2xs uppercase tracking-widest text-[#969188] font-semibold">
            SEE IT IN ACTION
          </p>
          <h2
            className="font-display font-bold text-2xl text-[#1C1B19] leading-snug"
            style={{ maxWidth: '28ch' }}
          >
            Load a demo itinerary and simulate a disruption in under 30 seconds.
          </h2>
          <button
            id="landing-bottom-cta"
            onClick={onLaunch}
            className="inline-flex items-center gap-2.5 font-mono text-sm font-bold uppercase tracking-wider px-7 py-3.5 rounded-[2px] transition-all duration-150"
            style={{
              backgroundColor: 'var(--color-confirmed)',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#234d4c')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'var(--color-confirmed)')
            }
          >
            LAUNCH DEMO
            <ArrowRight size={15} />
          </button>
        </section>

      </main>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer
        className="border-t"
        style={{ borderColor: 'var(--color-border)', backgroundColor: '#FFFFFF' }}
      >
        <div className="max-w-7xl mx-auto px-8 md:px-16 py-4 flex items-center justify-between">
          <p className="font-mono text-2xs text-[#969188]">
            planB · Travel Disruption Recovery Platform
          </p>
          <p className="font-mono text-2xs text-[#969188]">
            NO LOGIN REQUIRED
          </p>
        </div>
      </footer>
    </div>
  );
}
