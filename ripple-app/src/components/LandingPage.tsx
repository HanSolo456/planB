// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: LandingPage.tsx
// PURPOSE: Redesigned landing page. Rich, detailed, well-organised.
//   Preserves the manifest aesthetic tokens — no alien design language.
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useLenis } from 'lenis/react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, GitBranch, Zap, FileText,
  Shield, Clock, Upload, AlertTriangle, RefreshCw, Map, Database
} from 'lucide-react';
import PlanBLogo from './PlanBLogo';
import FooterAwareBlur from './FooterAwareBlur';
import type { AppUser } from '../App';
import { formatUserName } from '../App';

interface Props {
  onLaunch: () => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  currentUser?: AppUser | null;
  onSignOut?: () => void;
}

// ---------------------------------------------------------------------------
// CSS injected once for landing-only animations
// ---------------------------------------------------------------------------
const LANDING_STYLES = `
  @keyframes lp-fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lp-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes lp-ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes lp-dot-pulse {
    0%,100% { transform: scale(0.85); opacity: 0.6; }
    50%     { transform: scale(1.2);  opacity: 1; }
  }
  @keyframes lp-shimmer {
    from { background-position: -200% center; }
    to   { background-position: 200% center; }
  }
  .lp-fade-up   { animation: lp-fade-up  0.55s cubic-bezier(0.16,1,0.3,1) both; }
  .lp-fade-in   { animation: lp-fade-in  0.45s ease both; }
  .lp-delay-1   { animation-delay: 0.08s; }
  .lp-delay-2   { animation-delay: 0.16s; }
  .lp-delay-3   { animation-delay: 0.24s; }
  .lp-delay-4   { animation-delay: 0.32s; }
  .lp-ticker    { animation: lp-ticker 28s linear infinite; }
  .lp-dot-pulse { animation: lp-dot-pulse 2.4s ease-in-out infinite; }
  .lp-shimmer-text {
    background: linear-gradient(
      90deg,
      var(--color-text-main) 0%,
      var(--color-confirmed) 40%,
      var(--color-text-main) 60%,
      var(--color-text-main) 100%
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: lp-shimmer 3.5s linear infinite;
  }
  .lp-feature-card:hover { background-color: var(--color-bg-card-hover); }
  .lp-step-card:hover    { border-color: var(--color-confirmed-border) !important; }
  .lp-quote-card:hover   { border-color: var(--color-confirmed-border) !important; }
  section[id] {
    scroll-margin-top: 5.5rem;
  }
`;

// ---------------------------------------------------------------------------
// Inline landing header
// ---------------------------------------------------------------------------
interface LandingHeaderProps {
  onLaunch: () => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  currentUser?: AppUser | null;
  onSignOut?: () => void;
  scrolled: boolean;
}

function LandingHeader({ onLaunch, onOpenAuth, currentUser, onSignOut, scrolled }: LandingHeaderProps) {
  const userName = currentUser ? (currentUser.name || formatUserName(currentUser)) : '';
  const lenis = useLenis();

  return (
    <header
      className="fixed top-3 sm:top-4 inset-x-3 sm:inset-x-6 lg:inset-x-8 max-w-7xl mx-auto z-50 rounded-2xl md:rounded-full border transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.72)',
        borderColor: scrolled ? 'rgba(229, 225, 216, 0.95)' : 'rgba(229, 225, 216, 0.70)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        boxShadow: scrolled
          ? '0 12px 32px -4px rgba(28, 27, 25, 0.08), 0 4px 12px -2px rgba(28, 27, 25, 0.04)'
          : '0 6px 20px -4px rgba(28, 27, 25, 0.04), 0 2px 6px -1px rgba(28, 27, 25, 0.02)',
      }}
    >
      <div className="px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 flex items-center justify-between">
        <PlanBLogo size={34} />

        {/* Nav links — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-6">
          {[['The Problem', '#problem'], ['The Solution', '#solution'], ['Features', '#features'], ['How It Works', '#how-it-works']].map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                lenis?.scrollTo(href, { offset: -90, duration: 1.2 });
              }}
              className="font-mono text-2xs uppercase tracking-widest font-semibold transition-colors duration-150 cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-confirmed)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-muted)')}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser ? (
            <>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-xs border"
                style={{ backgroundColor: 'rgba(242, 240, 235, 0.85)', borderColor: 'var(--color-border)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#102A43] lp-dot-pulse" />
                <span className="font-semibold text-[#17212B] max-w-[95px] sm:max-w-[180px] truncate">
                  {userName}
                </span>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="ml-1 text-2xs font-bold uppercase tracking-wider text-[#8896A4] hover:text-[#102A43] cursor-pointer transition-colors"
                  >
                    SIGN OUT
                  </button>
                )}
              </div>
              <button
                id="landing-header-cta"
                onClick={onLaunch}
                className="font-mono text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full transition-colors duration-150 cursor-pointer"
                style={{ backgroundColor: 'var(--color-confirmed)', color: '#FFFFFF' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0A1E30')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed)')}
              >
                GO TO TRIPS
              </button>
            </>
          ) : (
            <>
              {onOpenAuth && (
                <button
                  id="landing-header-signin-btn"
                  onClick={() => onOpenAuth()}
                  className="font-mono text-xs font-semibold uppercase tracking-wider px-3.5 py-2 rounded-full transition-colors duration-150 cursor-pointer border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-main)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-confirmed)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-confirmed)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-main)';
                  }}
                >
                  SIGN IN
                </button>
              )}
              <button
                id="landing-header-cta"
                onClick={onLaunch}
                className="font-mono text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full transition-colors duration-150 cursor-pointer"
                style={{ backgroundColor: 'var(--color-confirmed)', color: '#FFFFFF' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0A1E30')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed)')}
              >
                LAUNCH DEMO
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Live disruption ticker
// ---------------------------------------------------------------------------
const TICKER_EVENTS = [
  'BA 256 LHR→CDG  +85 MIN DELAY  —  CASCADE DETECTED  —  2 RECOVERY OPTIONS FOUND',
  'TGV 6217 CDG→LYS  —  CONNECTION AT RISK  —  137 MIN BUFFER REMAINING',
  'EK 512 DXB→BOM  CANCELLED  —  3 AFFECTED BOOKINGS  —  REROUTE OPTIONS SURFACED',
  'SQ 322 SIN→LHR  +40 MIN  —  HOTEL CHECK-IN BUFFER TIGHT  —  ALTERNATE FOUND',
  'AI 302 DEL→MUM  GATE CHANGE  —  IMPACT MINIMAL  —  BUFFER INTACT',
];

function DisruptionTicker() {
  const content = TICKER_EVENTS.join('   ·   ');
  return (
    <div
      className="overflow-hidden py-2 border-b select-none"
      style={{ backgroundColor: 'var(--color-disrupted-bg)', borderColor: 'var(--color-disrupted-border)' }}
    >
      {/* whitespace-nowrap on BOTH the outer and inner element — prevents any wrapping */}
      <div style={{ display: 'flex', whiteSpace: 'nowrap', width: 'max-content' }} className="lp-ticker">
        {[content, content].map((c, i) => (
          <span
            key={i}
            className="font-mono text-2xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--color-disrupted)', paddingRight: '6rem', flexShrink: 0 }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}



// ---------------------------------------------------------------------------
// Problem statement data (Side photo + small caption)
// ---------------------------------------------------------------------------
interface ProblemItem {
  number: string;
  tag: string;
  headline: string;
  caption: string;
  takeaway: string;
  photoContext: string;
  impactStat: string;
  image: string;
  imageAlt: string;
}

const PROBLEMS: ProblemItem[] = [
  {
    number: '01',
    tag: 'SILOED ALERTS',
    headline: 'Airlines alert you in isolation.',
    caption:
      'You get a routine push alert that your flight is delayed 90 minutes. But the airline has no idea you have a connecting high-speed train or hotel check-in cutoff. You are left alone to calculate the blast radius.',
    takeaway: 'Zero cross-provider visibility leaves travelers stranded.',
    photoContext: 'Terminal Departure Board · Gate Disruption',
    impactStat: '0% Provider Sync',
    image: '/problem-delayed-board.jpg',
    imageAlt: 'Airport terminal departure board showing cancelled and delayed flights',
  },
  {
    number: '02',
    tag: 'CASCADE COLLAPSE',
    headline: 'One delay quietly cancels your whole trip.',
    caption:
      'Travel is an interconnected chain of fragile buffer windows. When a 40-minute runway delay eats your slack, your rental car is given away as a no-show, connections are missed, and non-refundable tickets are forfeit.',
    takeaway: 'Buffers evaporate without warning across separate bookings.',
    photoContext: 'Stranded Passenger · 23:40 Local Time',
    impactStat: '82% Delays Cascade',
    image: '/problem-stranded-traveler.jpg',
    imageAlt: 'Stranded traveler sitting on luggage late at night looking at phone travel alerts',
  },
  {
    number: '03',
    tag: 'CHAOTIC SUPPORT',
    headline: 'Standing in 2-hour lines to gamble blind.',
    caption:
      'When mass delays strike, help desks bottleneck with 200-person lines and 90-minute phone queues. Exhausted travelers are forced into frantic midnight rebookings without knowing fare rules or onward connection feasibility.',
    takeaway: 'High-stakes rebooking decisions made with zero actionable data.',
    photoContext: 'Customer Service Desk · Terminal Bottleneck',
    impactStat: '2.5hr Queue Wait',
    image: '/problem-rebooking-queue.jpg',
    imageAlt: 'Crowded airport customer service desk line with frustrated travelers waiting to rebook',
  },
];

// ---------------------------------------------------------------------------
// Solution statement data (Side photo + small caption, mirrored layout)
// ---------------------------------------------------------------------------
interface SolutionItem {
  number: string;
  tag: string;
  headline: string;
  caption: string;
  takeaway: string;
  photoContext: string;
  impactStat: string;
  image: string;
  imageAlt: string;
}

const SOLUTIONS: SolutionItem[] = [
  {
    number: '01',
    tag: 'DEPENDENCY GRAPH',
    headline: 'Every booking linked into one living network.',
    caption:
      'Paste your confirmation emails or upload a ticket. planB connects flights, trains, hotel check-ins, and car rentals into an interconnected dependency graph with live buffer tracking.',
    takeaway: 'Full cross-provider awareness replaces isolated blind spots.',
    photoContext: 'Live Itinerary Sync · Buffer Monitored',
    impactStat: '100% Leg Visibility',
    image: '/solution-smart-graph.jpg',
    imageAlt: 'Composed traveler in modern airport lounge reviewing organized live journey itinerary on smartphone',
  },
  {
    number: '02',
    tag: 'CASCADE ENGINE',
    headline: 'Instant blast-radius calculation when delays strike.',
    caption:
      'When runway congestion or a gate delay threatens your buffer, planB immediately evaluates downstream consequences across your entire journey before you even touch down.',
    takeaway: 'Know which onward legs survive before chaos hits the ground.',
    photoContext: 'Proactive Alert · 45-Min Lead Time',
    impactStat: '< 3s Cascade Calc',
    image: '/solution-reroute-flow.jpg',
    imageAlt: 'Confident traveler walking through modern airport terminal gate with live travel updates',
  },
  {
    number: '03',
    tag: 'GROUNDED RECOVERY',
    headline: 'Ranked rebooking options with real cost & policy math.',
    caption:
      'Skip the 200-person service lines. planB surfaces ranked recovery alternatives grounded in actual fare rules, refund eligibility, and arrival feasibility — then updates your trip with one tap.',
    takeaway: 'High-confidence recovery without panic or midnight guesswork.',
    photoContext: 'Fast-Track Recovery · Zero Desk Queues',
    impactStat: '1-Tap Rebuild',
    image: '/solution-seamless-arrival.jpg',
    imageAlt: 'Smiling traveler stepping onto high-speed train platform arriving smoothly at destination',
  },
];

// ---------------------------------------------------------------------------
// Stats strip data
// ---------------------------------------------------------------------------
const STATS = [
  { value: '< 3s', label: 'Disruption analysis time' },
  { value: '100%', label: 'Dependency-aware cascade' },
  { value: 'AI', label: 'Grounded recovery reasoning' },
  { value: 'Zero', label: 'Login required to try it' },
];

// ---------------------------------------------------------------------------
// How it works steps
// ---------------------------------------------------------------------------
const STEPS = [
  {
    number: '01',
    icon: Upload,
    title: 'Import your trip',
    detail:
      'Paste any booking confirmation — flight, hotel, train, activity. Or upload a file. The AI parser extracts every segment into a structured itinerary in seconds, inferring dependencies and buffer windows automatically.',
    tag: 'AI IMPORT',
  },
  {
    number: '02',
    icon: Map,
    title: 'Every dependency mapped',
    detail:
      'planB connects your legs automatically, building a dependency graph that knows what relies on what. It computes buffer constraints between each booking so it understands exactly how much slack each segment has.',
    tag: 'GRAPH ENGINE',
  },
  {
    number: '03',
    icon: AlertTriangle,
    title: 'Simulate or detect a disruption',
    detail:
      'Describe any disruption in plain English — a delayed flight, cancelled hotel, missed transfer, weather closure, or a change you initiated yourself. The cascade engine traces every downstream booking that loses its buffer instantly, across all booking types.',
    tag: 'NL DISRUPTION',
  },
  {
    number: '04',
    icon: RefreshCw,
    title: 'Recovery selected → itinerary updated',
    detail:
      'The engine surfaces ranked recovery options grounded in real cost delta, time delta, refund eligibility, and itinerary impact score. Select one and the itinerary updates automatically — live segment states, buffers, and dependency links all recalculated.',
    tag: 'GROUNDED AI',
  },
];

// ---------------------------------------------------------------------------
// Top 3 Core Features
// ---------------------------------------------------------------------------
const FEATURES = [
  {
    icon: GitBranch,
    label: 'DEPENDENCY CASCADE ENGINE',
    headline: 'Not just "your flight is delayed."',
    description:
      'planB builds a directed dependency graph of your entire itinerary. When a disruption hits, it traces every downstream booking that loses its buffer and tells you exactly what breaks, by how much, and in what order.',
    tags: ['Impact score', 'Buffer tracking', 'Cascade graph'],
  },
  {
    icon: FileText,
    label: 'AI IMPORT — PASTE ANYTHING',
    headline: 'Booking confirmation? Paste it.',
    description:
      'Raw email, PDF text, ticket screenshot copy — the AI parser extracts a fully structured itinerary with inferred dependencies, transport types, and segment timing. Upload a file or paste raw text. Both work instantly.',
    tags: ['Multi-format', 'File upload', 'Auto-dependency inference'],
  },
  {
    icon: Zap,
    label: 'GROUNDED RECOVERY REASONING',
    headline: 'Every option has a real explanation.',
    description:
      'AI generates a dispatcher note for each recovery option, citing the actual cost delta, time delta, refund eligibility, cancellation policy impact, and the percentage of your trip that stays intact. The model is forbidden from inventing figures not in your data.',
    tags: ['Cost delta', 'Refund eligibility', 'Cancellation policy'],
  },
];

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionEyebrow({ label, centered = false }: { label: string; centered?: boolean }) {
  return (
    <p
      className={`font-mono text-2xs uppercase tracking-widest font-semibold mb-4 ${centered ? 'text-center' : ''}`}
      style={{ color: 'var(--color-text-subtle)' }}
    >
      {label}
    </p>
  );
}

function SectionHeadline({ text, centered = false }: { text: string; centered?: boolean }) {
  return (
    <h2
      className={`font-display font-bold leading-tight mb-5 ${centered ? 'text-center mx-auto' : ''}`}
      style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.4rem)', color: 'var(--color-text-main)', maxWidth: centered ? '28ch' : undefined }}
    >
      {text}
    </h2>
  );
}

function TrustPill({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px]"
      style={{ backgroundColor: 'var(--color-bg-surface-alt)', border: '1px solid var(--color-border)' }}
    >
      <Icon size={10} style={{ color: 'var(--color-text-subtle)' }} />
      <span className="font-mono text-2xs uppercase tracking-widest font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
        {label}
      </span>
    </div>
  );
}

function StoryItem({ children, className }: { children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 90%", "center center", "end 10%"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.45, 0.55, 1], [0.15, 1, 1, 0.15]);
  const scale = useTransform(scrollYProgress, [0, 0.45, 0.55, 1], [0.96, 1, 1, 0.96]);
  const y = useTransform(scrollYProgress, [0, 0.45, 0.55, 1], [40, 0, 0, -40]);

  return (
    <motion.div ref={ref} style={{ opacity, scale, y }} className={className}>
      {children}
    </motion.div>
  );
}

function ScrollFadeIn({
  children,
  className = '',
  delay = 0,
  yOffset = 24,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Scroll-Linked Text Reveal
// ---------------------------------------------------------------------------
// Scroll-Linked Text Reveal
// ---------------------------------------------------------------------------
function RevealWord({ word, progress, range }: { word: string; progress: any; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.32, 1]);
  const color = useTransform(progress, range, ["rgba(255, 255, 255, 0.42)", "rgba(255, 255, 255, 1)"]);
  const textShadow = useTransform(progress, range, [
    "0 1px 6px rgba(0,0,0,0.7)",
    "0 0 20px rgba(255,255,255,0.75), 0 2px 12px rgba(0,0,0,0.9)",
  ]);

  return (
    <motion.span
      style={{ opacity, color, textShadow }}
      className="inline-block mr-[0.28em] font-medium transition-colors"
    >
      {word}
    </motion.span>
  );
}

function ScrollRevealText({ text, progress, range }: { text: string; progress: any; range: [number, number] }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => {
        const step = (range[1] - range[0]) / words.length;
        const start = range[0] + i * step;
        const end = Math.min(start + step * 1.5, range[1]);
        return <RevealWord key={i} word={word} progress={progress} range={[start, end]} />;
      })}
    </>
  );
}

function CinematicTransition() {
  const containerRef = useRef<HTMLElement>(null);

  // 1. Entry scroll: card expands as it scrolls from bottom of viewport up to top
  const { scrollYProgress: entryProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "start start"],
  });

  const scale = useTransform(entryProgress, [0.15, 1], [0.88, 1]);
  const borderRadius = useTransform(entryProgress, [0.15, 1], ["2.5rem", "0rem"]);
  const textOpacity = useTransform(entryProgress, [0.35, 0.95], [0, 1]);
  const textY = useTransform(entryProgress, [0.35, 0.95], [30, 0]);

  // 2. Sticky scroll: from the exact instant the card sticks at top:0 until it releases
  const { scrollYProgress: stickyProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <section ref={containerRef} className="relative h-[200vh]" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="sticky top-0 w-full h-screen flex items-center justify-center overflow-hidden z-20">
        <motion.div
          className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center"
          style={{ scale, borderRadius }}
        >
          <img
            src="/Paris-2048x1506.png"
            alt="Paris skyline"
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ filter: 'blur(2px) brightness(0.82)', transform: 'scale(1.02)' }}
            loading="lazy"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: [
                'radial-gradient(ellipse at 50% 50%, rgba(8,24,38,0.30) 0%, rgba(8,24,38,0.65) 100%)',
                'linear-gradient(to bottom, rgba(8,24,38,0.45) 0%, rgba(8,24,38,0.15) 40%, rgba(8,24,38,0.60) 100%)',
              ].join(', '),
            }}
          />
          <motion.div
            className="relative z-10 max-w-4xl mx-auto px-4 sm:px-8 text-center"
            style={{ opacity: textOpacity, y: textY }}
          >
            <h2
              className="font-display font-bold tracking-tight leading-[1.15] mb-5 text-white"
              style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)', textShadow: '0 4px 30px rgba(0,0,0,0.7)' }}
            >
              <span>Here comes Plan B — </span>
              <em
                className="font-serif italic font-normal"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: 'rgba(255, 255, 255, 0.95)', textShadow: '0 4px 30px rgba(0,0,0,0.7)' }}
              >
                the solution.
              </em>
            </h2>
            <p
              className="font-body text-base sm:text-lg leading-relaxed max-w-2xl mx-auto text-white"
              style={{ textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}
            >
              <ScrollRevealText
                text="Stop scrambling in the dark. Plan B turns disconnected tickets into an intelligent dependency graph that anticipates cascade failure before it happens, and rebuilds your journey in seconds."
                progress={stickyProgress}
                range={[0.06, 0.84]}
              />
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LandingPage({ onLaunch, onOpenAuth, currentUser, onSignOut }: Props) {
  const userName = currentUser ? (currentUser.name || formatUserName(currentUser)) : '';
  const [scrolled, setScrolled] = useState(false);
  const lenis = useLenis((l) => setScrolled(l.scroll > 12));

  useEffect(() => {
    if (!lenis) {
      const handleScroll = () => setScrolled(window.scrollY > 12);
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [lenis]);

  return (
    <div
      className="min-h-screen font-body antialiased"
      style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-main)' }}
    >
      <style>{LANDING_STYLES}</style>

      <LandingHeader
        onLaunch={onLaunch}
        onOpenAuth={onOpenAuth}
        currentUser={currentUser}
        onSignOut={onSignOut}
        scrolled={scrolled}
      />

      {/* Footer blur disabled for now */}
      {/* <FooterAwareBlur /> */}

      <main>

        {/* ═══ 1. HERO ═══════════════════════════════════════════════════ */}
        <section
          id="hero"
          className="relative w-full h-screen min-h-[100dvh] overflow-hidden border-b select-none flex flex-col items-center justify-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <img
            src="/Sydney-2048x1506.png"
            alt="Sydney Harbour"
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{
              filter: 'blur(2.5px) brightness(0.88)',
              transform: 'scale(1.03)',
            }}
            loading="eager"
            fetchPriority="high"
          />

          {/* Full-photo gradient — balanced vignette for optimal center contrast */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: [
                'radial-gradient(ellipse at 50% 50%, rgba(8,24,38,0.15) 20%, rgba(8,24,38,0.55) 100%)',
                'linear-gradient(to bottom, rgba(8,24,38,0.45) 0%, rgba(8,24,38,0.10) 30%, rgba(8,24,38,0.20) 70%, rgba(8,24,38,0.65) 100%)',
              ].join(', '),
            }}
          />

          {/* Centerpiece: 3 words bold on top + 1 italic word below */}
          <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto lp-fade-up">
            <h1 className="leading-[1.12] text-white">
              <span
                className="block font-bold tracking-tight"
                style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: 'clamp(2.2rem, 6vw, 4.4rem)',
                  letterSpacing: '-0.03em',
                  textShadow: '0 4px 30px rgba(0,0,0,0.65)',
                }}
              >
                When bookings break,
              </span>
              <em
                className="block mt-2 sm:mt-3"
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontWeight: 400,
                  fontStyle: 'italic',
                  fontSize: 'clamp(2.1rem, 5.5vw, 4.2rem)',
                  letterSpacing: '-0.01em',
                  color: 'rgba(255, 255, 255, 0.95)',
                  textShadow: '0 4px 30px rgba(0,0,0,0.65)',
                }}
              >
                recover.
              </em>
            </h1>
          </div>

          {/* Very bottom: scroll down indicator */}
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 lp-fade-in lp-delay-2">
            <button
              type="button"
              onClick={() => {
                if (lenis) {
                  lenis.scrollTo('#problem', { offset: -70, duration: 1.2 });
                } else {
                  document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none pointer-events-auto transition-transform hover:-translate-y-0.5 duration-200"
              aria-label="Scroll down to explore"
            >
              {/* Scroll Down */}
              <span
                className="font-mono text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-white/75 group-hover:text-white transition-colors duration-200 select-none"
                style={{ textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}
              >
                Scroll Down
              </span>

              <div
                className="w-4.5 h-7 rounded-full border border-white/40 group-hover:border-white/80 flex items-start justify-center p-1 transition-all duration-200 backdrop-blur-sm bg-white/5"
                style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
              >
                <div className="w-1 h-1.5 rounded-full bg-white/85 group-hover:bg-white animate-[bounce_1.6s_infinite]" />
              </div>
              <svg
                className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-all duration-200 group-hover:translate-y-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </section>



        {/* ═══ 2. THE PROBLEM SECTION ══════════════════════════════════ */}
        <section
          id="problem"
          className="py-24 border-b"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-base)' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16">

            {/* Section intro */}
            <ScrollFadeIn className="mb-16 md:mb-20 max-w-2xl">
              <SectionEyebrow label="THE PROBLEM RIGHT NOW" />
              <h2
                className="font-display font-bold leading-tight tracking-tight mt-2"
                style={{ fontSize: 'clamp(1.8rem, 3.2vw, 2.75rem)', color: 'var(--color-text-main)' }}
              >
                Bookings are sold in silos.<br />
                They collapse in chain reactions.
              </h2>
            </ScrollFadeIn>

            {/* Problem list: One side photo, other side small caption with generous spacing */}
            <div className="space-y-20 md:space-y-32">
              {PROBLEMS.map((p, index) => {
                const isReversed = index % 2 === 1;
                return (
                  <StoryItem
                    key={p.number}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 xl:gap-28 items-center"
                  >
                    {/* Photo Column */}
                    <div
                      className={`lg:col-span-6 ${isReversed ? 'lg:order-2' : 'lg:order-1'
                        }`}
                    >
                      <div
                        className="relative rounded-2xl overflow-hidden border group bg-stone-100 shadow-sm"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        {/* Photo */}
                        <img
                          src={p.image}
                          alt={p.imageAlt}
                          className="w-full h-auto aspect-[16/10] object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                          loading="lazy"
                        />

                        {/* Gradient vignette */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              'linear-gradient(to top, rgba(12, 10, 9, 0.6) 0%, rgba(12, 10, 9, 0.1) 50%, transparent 100%)',
                          }}
                        />

                        {/* Photo contextual labels on image */}
                        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex items-center justify-between pointer-events-none">
                          <span className="font-mono text-2xs font-medium px-2.5 py-1 rounded bg-black/60 text-white/90 backdrop-blur-md">
                            {p.photoContext}
                          </span>
                          <span
                            className="font-mono text-2xs font-bold px-2.5 py-1 rounded text-white uppercase tracking-wider backdrop-blur-md"
                            style={{ backgroundColor: 'rgba(220, 91, 82, 0.9)' }}
                          >
                            {p.impactStat}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Small Caption Column with directional breathing room */}
                    <div
                      className={`lg:col-span-6 ${isReversed
                        ? 'lg:order-1 lg:pr-6 xl:pr-12'
                        : 'lg:order-2 lg:pl-6 xl:pl-12'
                        }`}
                    >
                      {/* Number & Tag badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="font-mono text-xs font-bold px-2.5 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgba(220, 91, 82, 0.1)',
                            color: 'var(--color-disrupted)',
                            border: '1px solid rgba(220, 91, 82, 0.25)',
                          }}
                        >
                          {p.number}
                        </span>
                        <span className="font-mono text-2xs uppercase tracking-wider font-semibold text-stone-500">
                          {p.tag}
                        </span>
                      </div>

                      {/* Headline */}
                      <h3
                        className="font-display font-bold text-xl sm:text-2xl lg:text-3xl leading-snug tracking-tight mb-3"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {p.headline}
                      </h3>

                      {/* Small Caption explaining what the issue is */}
                      <p
                        className="font-body text-sm sm:text-base leading-relaxed"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {p.caption}
                      </p>

                      {/* Key takeaway */}
                      <div
                        className="mt-6 pt-4 border-t flex items-start gap-2.5"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: 'var(--color-disrupted)' }}
                        />
                        <p className="font-mono text-xs leading-normal" style={{ color: 'var(--color-text-main)' }}>
                          <span className="font-bold text-stone-900">The Problem: </span>
                          <span style={{ color: 'var(--color-text-muted)' }}>{p.takeaway}</span>
                        </p>
                      </div>
                    </div>
                  </StoryItem>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ TRANSITION BANNER ═══════════════════════════════════════ */}
        <CinematicTransition />

        {/* ═══ 3. THE SOLUTION SECTION ═══════════════════════════════════ */}
        <section
          id="solution"
          className="pt-12 pb-24 border-b"
          style={{ borderColor: 'var(--color-border)', backgroundColor: '#FFFFFF' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16">

            {/* Section intro */}
            <ScrollFadeIn className="mb-16 md:mb-20 max-w-2xl">
              <SectionEyebrow label="THE PLAN B SOLUTION" />
              <h2
                className="font-display font-bold leading-tight tracking-tight mt-2"
                style={{ fontSize: 'clamp(1.8rem, 3.2vw, 2.75rem)', color: 'var(--color-text-main)' }}
              >
                Intelligent dependency mapping.<br />
                Instant, self-healing recovery.
              </h2>
            </ScrollFadeIn>

            {/* Solution list: One side photo, other side small caption with generous spacing (just like Problem Statement) */}
            <div className="space-y-20 md:space-y-32">
              {SOLUTIONS.map((s, index) => {
                const isReversed = index % 2 === 1;
                return (
                  <StoryItem
                    key={s.number}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 xl:gap-28 items-center"
                  >
                    {/* Photo Column */}
                    <div
                      className={`lg:col-span-6 ${isReversed ? 'lg:order-2' : 'lg:order-1'
                        }`}
                    >
                      <div
                        className="relative rounded-2xl overflow-hidden border group bg-stone-100 shadow-sm"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        {/* Photo */}
                        <img
                          src={s.image}
                          alt={s.imageAlt}
                          className="w-full h-auto aspect-[16/10] object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                          loading="lazy"
                        />

                        {/* Gradient vignette */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              'linear-gradient(to top, rgba(12, 10, 9, 0.55) 0%, rgba(12, 10, 9, 0.05) 50%, transparent 100%)',
                          }}
                        />

                        {/* Photo contextual labels on image */}
                        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex items-center justify-between pointer-events-none">
                          <span className="font-mono text-2xs font-medium px-2.5 py-1 rounded bg-black/60 text-white/90 backdrop-blur-md">
                            {s.photoContext}
                          </span>
                          <span
                            className="font-mono text-2xs font-bold px-2.5 py-1 rounded text-white uppercase tracking-wider backdrop-blur-md"
                            style={{ backgroundColor: 'rgba(16,42,67,0.95)' }}
                          >
                            {s.impactStat}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Small Caption Column with directional breathing room */}
                    <div
                      className={`lg:col-span-6 ${isReversed
                        ? 'lg:order-1 lg:pr-6 xl:pr-12'
                        : 'lg:order-2 lg:pl-6 xl:pl-12'
                        }`}
                    >
                      {/* Number & Tag badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="font-mono text-xs font-bold px-2.5 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgba(16,42,67,0.1)',
                            color: 'var(--color-confirmed)',
                            border: '1px solid rgba(16,42,67,0.25)',
                          }}
                        >
                          {s.number}
                        </span>
                        <span className="font-mono text-2xs uppercase tracking-wider font-semibold text-stone-500">
                          {s.tag}
                        </span>
                      </div>

                      {/* Headline */}
                      <h3
                        className="font-display font-bold text-xl sm:text-2xl lg:text-3xl leading-snug tracking-tight mb-3"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {s.headline}
                      </h3>

                      {/* Small Caption explaining how Plan B solves it */}
                      <p
                        className="font-body text-sm sm:text-base leading-relaxed"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {s.caption}
                      </p>

                      {/* Key takeaway */}
                      <div
                        className="mt-6 pt-4 border-t flex items-start gap-2.5"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: 'var(--color-confirmed)' }}
                        />
                        <p className="font-mono text-xs leading-normal" style={{ color: 'var(--color-text-main)' }}>
                          <span className="font-bold text-stone-900">The Solution: </span>
                          <span style={{ color: 'var(--color-text-muted)' }}>{s.takeaway}</span>
                        </p>
                      </div>
                    </div>
                  </StoryItem>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ 4. FEATURES DEEP DIVE ═════════════════════════════════════ */}
        <section
          id="features"
          className="py-24 border-b"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-surface-alt)' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16">
            <ScrollFadeIn className="max-w-2xl mb-14">
              <SectionEyebrow label="FEATURES & CAPABILITIES" />
              <SectionHeadline text="Every layer of the disruption problem, solved." />
              <p className="font-body text-base" style={{ color: 'var(--color-text-muted)' }}>
                Generic travel apps notify you that your flight is delayed. planB tells you what that means for every other booking in your trip — and what to do about it.
              </p>
            </ScrollFadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <ScrollFadeIn
                    key={f.label}
                    delay={0.1 * (i + 1)}
                    className="lp-feature-card p-7 sm:p-8 rounded-xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between"
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)' }}
                  >
                    <div>
                      <div className="flex items-center gap-2.5 mb-5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'var(--color-confirmed-bg)', border: '1px solid var(--color-confirmed-border)' }}
                        >
                          <Icon size={16} style={{ color: 'var(--color-confirmed)' }} />
                        </div>
                        <span className="font-mono text-2xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-confirmed)' }}>
                          {f.label}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-lg leading-snug mb-3" style={{ color: 'var(--color-text-main)' }}>
                        {f.headline}
                      </h3>

                      <p className="font-body text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
                        {f.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      {f.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-mono text-2xs px-2 py-0.5 rounded-[2px]"
                          style={{ backgroundColor: 'var(--color-bg-surface-alt)', color: 'var(--color-text-subtle)', border: '1px solid var(--color-border)' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </ScrollFadeIn>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ 5. HOW IT WORKS ═══════════════════════════════════════════ */}
        <section
          id="how-it-works"
          className="py-24 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16">
            <ScrollFadeIn className="max-w-2xl mb-14">
              <SectionEyebrow label="HOW IT WORKS" />
              <SectionHeadline text="From booking paste to recovery options in under a minute." />
              <p className="font-body text-base" style={{ color: 'var(--color-text-muted)' }}>
                No complex setup. No manual configuration. The entire workflow is designed to be zero-friction from the first paste.
              </p>
            </ScrollFadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <ScrollFadeIn
                    key={step.number}
                    delay={0.08 * (i + 1)}
                    className="lp-step-card p-6 rounded-lg transition-all duration-300 hover:shadow-md relative flex flex-col justify-between"
                    style={{ border: '1px solid var(--color-border)', backgroundColor: '#FFFFFF' }}
                  >
                    <div>
                      {/* Step badge row */}
                      <div className="flex items-center justify-between mb-5">
                        <div
                          className="font-mono text-2xs font-bold w-8 h-8 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: 'var(--color-confirmed-bg)', color: 'var(--color-confirmed)', border: '1px solid var(--color-confirmed-border)' }}
                        >
                          {step.number}
                        </div>
                        <span
                          className="font-mono text-2xs px-1.5 py-0.5 rounded-[2px]"
                          style={{ backgroundColor: 'var(--color-bg-surface-alt)', color: 'var(--color-text-subtle)', border: '1px solid var(--color-border)' }}
                        >
                          {step.tag}
                        </span>
                      </div>

                      <Icon size={20} className="mb-4" style={{ color: 'var(--color-confirmed)' }} />

                      <h3 className="font-display font-bold text-base leading-snug mb-2.5" style={{ color: 'var(--color-text-main)' }}>
                        {step.title}
                      </h3>
                      <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                        {step.detail}
                      </p>
                    </div>

                    {/* Step connector */}
                    {i < STEPS.length - 1 && (
                      <div
                        className="hidden xl:flex absolute top-9 -right-3 items-center justify-center w-6"
                        style={{ zIndex: 1 }}
                      >
                        <ArrowRight size={12} style={{ color: 'var(--color-border)' }} />
                      </div>
                    )}
                  </ScrollFadeIn>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ 6. STATS STRIP ════════════════════════════════════════════ */}
        <section
          id="stats"
          className="border-b"
          style={{ borderColor: 'var(--color-border)', backgroundColor: '#FFFFFF' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16">
            <ScrollFadeIn>
              <div className="grid grid-cols-2 md:grid-cols-4">
                {STATS.map((stat, i) => (
                  <div
                    key={stat.label}
                    className="px-6 py-10 text-center"
                    style={{ borderRight: i < STATS.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                  >
                    <p
                      className="font-display font-bold mb-1.5"
                      style={{ fontSize: 'clamp(1.8rem, 2.8vw, 2.5rem)', color: 'var(--color-confirmed)' }}
                    >
                      {stat.value}
                    </p>
                    <p className="font-mono text-2xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollFadeIn>
          </div>
        </section>

      </main>

      {/* ═══ 7. BOTTOM CTA ═══════════════════════════════════════════════ */}
      <div className="relative overflow-hidden border-t" style={{ borderColor: 'var(--color-border)' }}>
        <img
          src="/San Francisco-2048x1506.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          style={{ filter: 'blur(2px) brightness(0.65)', transform: 'scale(1.03)' }}
          loading="lazy"
        />

        {/* Vignette overlay fading into solid dark at the bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'radial-gradient(ellipse at 50% 40%, rgba(8,24,38,0.25) 0%, rgba(8,24,38,0.70) 100%)',
              'linear-gradient(to bottom, rgba(8,24,38,0.40) 0%, rgba(8,24,38,0.20) 35%, rgba(8,24,38,0.95) 90%, #080706 100%)',
            ].join(', '),
          }}
        />

        <section className="relative py-28 sm:py-36 overflow-hidden select-none">
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 text-center">
            <ScrollFadeIn>
              <h2
                className="font-display font-bold leading-tight mb-5 mx-auto text-white"
                style={{
                  fontSize: 'clamp(2rem, 3.5vw, 3.2rem)',
                  textShadow: '0 4px 30px rgba(0,0,0,0.85)',
                  maxWidth: '26ch',
                }}
              >
                Load a demo itinerary. Simulate a disruption. Recovery options in 10 seconds.
              </h2>
              <p
                className="font-body text-base sm:text-lg leading-relaxed mb-10 mx-auto text-white/85"
                style={{ textShadow: '0 2px 14px rgba(0,0,0,0.85)', maxWidth: '48ch' }}
              >
                No setup. No account. The demo loads instantly with a prebuilt multi-leg itinerary ready to disrupt.
              </p>

              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <button
                  id="landing-bottom-cta"
                  onClick={onLaunch}
                  className="inline-flex items-center gap-2.5 font-mono text-sm font-bold uppercase tracking-wider px-8 py-4 rounded-[2px] transition-all duration-150 cursor-pointer shadow-lg hover:shadow-xl"
                  style={{ backgroundColor: 'var(--color-confirmed)', color: '#FFFFFF' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0A1E30')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed)')}
                >
                  {currentUser ? 'GO TO YOUR TRIPS' : 'LAUNCH DEMO'}
                  <ArrowRight size={16} />
                </button>

                {!currentUser && onOpenAuth && (
                  <button
                    id="landing-bottom-signin"
                    onClick={() => onOpenAuth('signup')}
                    className="inline-flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-wider px-7 py-4 rounded-[2px] border transition-all duration-150 cursor-pointer backdrop-blur-md"
                    style={{
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      color: '#FFFFFF',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#5EEAD4';
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255, 255, 255, 0.3)';
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                  >
                    CREATE ACCOUNT
                  </button>
                )}
              </div>

            </ScrollFadeIn>
          </div>
        </section>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="relative overflow-hidden" style={{ backgroundColor: '#080706', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Main footer content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-12">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">

            {/* Left — Logo + tagline */}
            <div className="flex flex-col gap-3 min-w-[200px]" style={{ '--color-text-main': '#ffffff', '--color-text-muted': '#9ca3af' } as React.CSSProperties}>
              <PlanBLogo size={32} subtitle="" />
              <p className="font-mono text-xs leading-relaxed max-w-[220px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Travel disruption recovery,<br />built for the real world.
              </p>
            </div>

            {/* Nav links */}
            <div className="flex flex-col sm:flex-row gap-8 sm:gap-16">
              <div className="flex flex-col gap-3">
                <p className="font-mono text-2xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>Product</p>
                {[['The Problem', '#problem'], ['The Solution', '#solution'], ['Features', '#features'], ['How It Works', '#how-it-works']].map(([label, href]) => (
                  <a key={label} href={href}
                    onClick={(e) => { e.preventDefault(); lenis?.scrollTo(href, { offset: -90, duration: 1.2 }); }}
                    className="font-mono text-2xs uppercase tracking-widest transition-colors duration-150 cursor-pointer"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#ffffff')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)')}
                  >{label}</a>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-mono text-2xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>Company</p>
                {[['About', '#'], ['Blog', '#'], ['Careers', '#'], ['Press', '#']].map(([label, href]) => (
                  <a key={label} href={href}
                    className="font-mono text-2xs uppercase tracking-widest transition-colors duration-150 cursor-pointer"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#ffffff')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)')}
                  >{label}</a>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-mono text-2xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>Legal</p>
                {[['Privacy Policy', '#'], ['Terms of Service', '#'], ['Cookie Policy', '#']].map(([label, href]) => (
                  <a key={label} href={href}
                    className="font-mono text-2xs uppercase tracking-widest transition-colors duration-150 cursor-pointer"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#ffffff')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)')}
                  >{label}</a>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative z-10" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="font-mono text-2xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              © {new Date().getFullYear()} planB · Travel Disruption Recovery Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
