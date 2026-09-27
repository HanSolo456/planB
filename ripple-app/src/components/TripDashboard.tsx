// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: TripDashboard.tsx
// PURPOSE: Top-level dashboard showing all trips as a grid of manifest cards.
//   Seed trips are pinned first with a "SAMPLE TRIP" chip.
//   Imported trips appear after, sorted by last opened.
//   Each imported card has a delete action (with inline confirm step).
//   An "Import New Trip" card at the end routes to ImportView.
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Calendar, PlusCircle, Trash2, Bookmark, AlertCircle,
  ShieldCheck, Shield, ShieldAlert, CloudOff,
  Search, SlidersHorizontal, User, ChevronRight,
} from 'lucide-react';
import type { Itinerary } from '../lib/types';
import { calculateTripRiskScore } from '../lib/impactEngine';
import { getLastOpened } from '../lib/tripStorage';
import { useAppState, formatUserName } from '../App';
import PlanBLogo from './PlanBLogo';
import { useWikipediaImage } from '../lib/useWikipediaImage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}, ${e.getFullYear()}`;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'NEVER';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}D AGO`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Risk score config — maps level to the manifest status-color language
// ---------------------------------------------------------------------------
interface RiskConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ElementType;
}

function getRiskConfig(level: 'low' | 'moderate' | 'high'): RiskConfig {
  switch (level) {
    case 'low':
      return {
        label: 'LOW RISK',
        color: 'var(--color-confirmed)',
        bg: 'var(--color-confirmed-bg)',
        border: 'var(--color-confirmed-border)',
        Icon: ShieldCheck,
      };
    case 'moderate':
      return {
        label: 'MOD RISK',
        color: 'var(--color-at-risk)',
        bg: 'var(--color-at-risk-bg)',
        border: 'var(--color-at-risk-border)',
        Icon: ShieldAlert,
      };
    case 'high':
      return {
        label: 'HIGH RISK',
        color: 'var(--color-disrupted)',
        bg: 'var(--color-disrupted-bg)',
        border: 'var(--color-disrupted-border)',
        Icon: Shield,
      };
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Destination thumbnail — Wikipedia REST API
//
// Priority order:
//   1. Local bundled image (fast, offline-safe)
//   2. Wikipedia page summary thumbnail (free, no key, great coverage)
//   3. null → card renders a plain dark gradient placeholder
//
// Results are cached in a module-level Map so navigating away and back
// doesn't re-fetch, and all cards for the same destination share one request.
// ---------------------------------------------------------------------------
const LOCAL_DESTINATION_IMAGES: Array<{ keywords: string[]; src: string }> = [
  { keywords: ['london', 'uk', 'england', 'britain'], src: '/London-2048x1506.png' },
  { keywords: ['paris', 'france'], src: '/Paris-2048x1506.png' },
  { keywords: ['san francisco', 'sf', 'california', 'bay area'], src: '/San Francisco-2048x1506.png' },
  { keywords: ['sydney', 'australia'], src: '/Sydney-2048x1506.png' },
];

function getLocalImage(destination: string): string | null {
  const lower = destination.toLowerCase();
  const match = LOCAL_DESTINATION_IMAGES.find(({ keywords }) =>
    keywords.some((kw) => lower.includes(kw))
  );
  return match ? match.src : null;
}

// Module-level cache is now the shared wikiImageCache from useWikipediaImage.ts —
// so any destination fetched on the dashboard is instantly available in the trip view.

function useDestinationPhoto(destination: string): string | null {
  const local = getLocalImage(destination);
  const query = destination.split(',')[0].trim();
  const wiki = useWikipediaImage(local ? '' : query);
  return local || wiki || null;
}

// ---------------------------------------------------------------------------
// Trip card — shared by both seed and imported trips
// ---------------------------------------------------------------------------
interface TripCardProps {
  itinerary: Itinerary;
  isSeed: boolean;
  onOpen: (it: Itinerary) => void;
  onDelete?: (id: string) => void;
}

function TripCard({ itinerary, isSeed, onOpen, onDelete }: TripCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const riskScore = useMemo(
    () => calculateTripRiskScore(itinerary),
    [itinerary]
  );
  const risk = getRiskConfig(riskScore.level);
  const RiskIcon = risk.Icon;
  const lastOpened = isSeed ? null : getLastOpened(itinerary.id);
  const thumbnail = useDestinationPhoto(itinerary.destination);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setConfirmDelete(true);
    },
    []
  );

  const handleConfirmDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(itinerary.id);
    },
    [itinerary.id, onDelete]
  );

  const handleCancelDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setConfirmDelete(false);
    },
    []
  );

  return (
    <div
      className="relative flex flex-col rounded-[4px] cursor-pointer group overflow-hidden transition-all duration-200"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
      onClick={() => onOpen(itinerary)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-confirmed)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(16,42,67,0.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${itinerary.destination}`}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(itinerary)}
      id={`trip-card-${itinerary.id}`}
    >
      {/* ── Hero thumbnail — full-width banner ────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ height: '280px' }}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={itinerary.destination}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          // Placeholder while fetching or on miss — dark gradient with destination initials
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1C2B2B 0%, #243D3C 60%, #1a3030 100%)' }}
          >
            <span
              className="font-display font-bold text-5xl select-none"
              style={{ color: 'rgba(255,255,255,0.08)', letterSpacing: '0.05em' }}
            >
              {itinerary.destination.split(',')[0].trim().slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Scrim — stronger on left so text on bottom-left reads cleanly */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0.05) 65%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        {/* Top-left: label chip */}
        <div className="absolute top-4 left-4">
          {isSeed ? (
            <span
              className="inline-flex items-center gap-1 font-mono text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[2px]"
              style={{
                backgroundColor: 'rgba(0,0,0,0.50)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              <Bookmark size={9} />
              SAMPLE
            </span>
          ) : (
            <span
              className="font-mono text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[2px]"
              style={{
                backgroundColor: 'rgba(0,0,0,0.50)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              IMPORTED
            </span>
          )}
        </div>

        {/* Top-right: delete button, revealed on hover */}
        {!isSeed && !confirmDelete && (
          <button
            onClick={handleDeleteClick}
            className="absolute top-4 right-4 flex items-center justify-center w-7 h-7 rounded-full cursor-pointer transition-all duration-150 opacity-0 group-hover:opacity-100"
            style={{
              backgroundColor: 'rgba(0,0,0,0.50)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
            }}
            aria-label={`Delete ${itinerary.destination}`}
            title="Delete trip"
            id={`delete-trip-${itinerary.id}`}
          >
            <Trash2 size={12} />
          </button>
        )}

        {/* Bottom of image — destination name + meta + view trip all live here */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h3
              className="font-display font-bold text-2xl leading-tight text-white truncate mb-0.5"
              title={itinerary.destination}
            >
              {itinerary.destination}
            </h3>
            <p className="font-mono text-xs text-white/70 truncate">
              {formatDateRange(itinerary.startDate, itinerary.endDate)}
              <span className="mx-2 text-white/30">·</span>
              <span className="text-white/90 font-semibold">{itinerary.bookings.length}</span> bookings
              {!isSeed && (
                <>
                  <span className="mx-2 text-white/30">·</span>
                  {formatRelativeTime(lastOpened)}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Risk badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px]"
              style={{
                backgroundColor: 'rgba(0,0,0,0.50)',
                border: `1px solid rgba(255,255,255,0.18)`,
              }}
            >
              <RiskIcon size={12} style={{ color: '#fff' }} />
              <span className="font-mono text-xs font-bold tabular-nums" style={{ color: '#fff' }}>
                {riskScore.overallScore}
              </span>
              <span className="font-mono text-2xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {risk.label}
              </span>
            </div>

            {/* View trip CTA */}
            <span
              className="font-mono text-xs font-semibold uppercase tracking-wider flex items-center gap-1 px-3 py-1.5 rounded-[2px] transition-all duration-150"
              style={{
                backgroundColor: 'rgba(0,0,0,0.50)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#fff',
              }}
            >
              view trip
              <ChevronRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* ── Delete confirm overlay ────────────────────────────────────── */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6"
          style={{
            backgroundColor: 'rgba(255,255,255,0.97)',
            border: '1.5px solid var(--color-disrupted-border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 font-mono text-xs font-semibold"
            style={{ color: 'var(--color-disrupted)' }}>
            <AlertCircle size={14} />
            DELETE THIS TRIP?
          </div>
          <p className="font-mono text-2xs text-center" style={{ color: '#4A5568' }}>
            This removes it from local storage.<br />Cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmDelete}
              className="font-mono text-2xs font-semibold px-3 py-1.5 rounded-[2px] cursor-pointer uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--color-disrupted)',
                color: '#FFF',
                border: '1px solid var(--color-disrupted)',
              }}
              id={`confirm-delete-${itinerary.id}`}
            >
              DELETE
            </button>
            <button
              onClick={handleCancelDelete}
              className="font-mono text-2xs font-semibold px-3 py-1.5 rounded-[2px] cursor-pointer uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--color-bg-surface-alt)',
                color: '#4A5568',
                border: '1px solid var(--color-border)',
              }}
              id={`cancel-delete-${itinerary.id}`}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Header — landing-page-style rounded header with welcome + profile
// ---------------------------------------------------------------------------
function DashboardHeader() {
  const { currentUser, openAuthModal } = useAppState();
  const navigate = useNavigate();
  const userName = currentUser
    ? currentUser.name || formatUserName(currentUser)
    : null;

  return (
    <div
      className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 rounded-2xl md:rounded-full border"
      style={{
        backgroundColor: 'transparent',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Left — logo (clickable → landing when guest/demo) */}
      <div className="flex items-center gap-3 min-w-0">
        {currentUser ? (
          <PlanBLogo size={30} />
        ) : (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="cursor-pointer focus:outline-none flex-shrink-0"
            aria-label="Go to home page"
          >
            <PlanBLogo size={30} />
          </button>
        )}
      </div>

      {/* Right — profile button or sign-in */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {currentUser ? (
          <button
            id="dashboard-header-profile-btn"
            onClick={() => navigate('/app/profile')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border font-mono text-xs font-semibold transition-colors duration-150 cursor-pointer"
            style={{
              backgroundColor: 'var(--color-confirmed-bg)',
              borderColor: 'var(--color-confirmed-border)',
              color: 'var(--color-confirmed)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed)';
              (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed-bg)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-confirmed)';
            }}
            title="View your profile"
          >
            <User size={13} />
            <span className="hidden sm:inline">Profile</span>
          </button>
        ) : (
          <button
            id="dashboard-header-signin-btn"
            onClick={() => openAuthModal()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border font-mono text-xs font-semibold transition-colors duration-150 cursor-pointer"
            style={{
              backgroundColor: 'var(--color-bg-surface-alt)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-confirmed)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-confirmed)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
            }}
          >
            <User size={13} />
            <span>Sign in</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import CTA card
// ---------------------------------------------------------------------------
function ImportCard() {
  const navigate = useNavigate();
  return (
    <button
      id="dashboard-import-card"
      onClick={() => navigate('/app/import')}
      className="flex flex-col items-center justify-center gap-3 p-6 rounded-[2px] cursor-pointer transition-colors duration-150 min-h-[180px] w-full text-left"
      style={{
        border: '1px dashed var(--color-border)',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-confirmed)';
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#E8EEF4';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
      }}
    >
      <PlusCircle size={24} style={{ color: 'var(--color-confirmed)' }} />
      <div className="text-center">
        <p
          className="font-mono text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'var(--color-confirmed)' }}
        >
          IMPORT YOUR TRIP
        </p>
        <p className="font-mono text-2xs" style={{ color: '#8896A4' }}>
          Paste a booking confirmation or upload a file
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------
function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="font-mono text-2xs uppercase tracking-wider text-[#4A5568] font-semibold">
        {label}
      </p>
      {count !== undefined && (
        <span className="font-mono text-2xs text-[#8896A4]">
          {count} {count === 1 ? 'TRIP' : 'TRIPS'}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main TripDashboard
// ---------------------------------------------------------------------------
export default function TripDashboard() {
  const {
    importedItineraries,
    setSelectedItinerary,
    removeImportedItinerary,
    currentUser,
    openAuthModal,
    storageError,
    clearStorageError,
  } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'recent' | 'risk'>('all');

  const handleOpen = useCallback(
    (it: Itinerary) => {
      setSelectedItinerary(it);
    },
    [setSelectedItinerary]
  );

  const filteredItineraries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return importedItineraries.filter((it) => {
      const matchesSearch = !normalizedQuery || [it.destination, it.travelerName, it.id]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesFilter = filterMode === 'all'
        || (filterMode === 'recent' && Boolean(getLastOpened(it.id)))
        || (filterMode === 'risk' && calculateTripRiskScore(it).level !== 'low');
      return matchesSearch && matchesFilter;
    });
  }, [filterMode, importedItineraries, searchQuery]);

  const hasImported = importedItineraries.length > 0;
  const hasFilteredTrips = filteredItineraries.length > 0;
  const filterLabel = filterMode === 'recent' ? 'Recently opened' : filterMode === 'risk' ? 'At risk' : 'All trips';

  return (
    <div className="space-y-6">
      {/* ── Dashboard Header — matches landing page header sizing ───────── */}
      <div className="mx-3 sm:mx-6 lg:mx-8 pt-3 sm:pt-4">
        <DashboardHeader />
      </div>

      {/* ── All content below uses standard horizontal padding ───────────── */}
      <div className="px-4 sm:px-8 md:px-16 space-y-6">

      {/* ── Welcome greeting ────────────────────────────────────────────── */}
      <div>
        <h1
          className="font-display font-bold text-2xl sm:text-3xl leading-tight"
          style={{ color: 'var(--color-text-main)' }}
        >
          {currentUser ? (
            <>
              Welcome,{' '}
              <em style={{ fontStyle: 'italic' }}>
                {currentUser.name || formatUserName(currentUser)}
              </em>
            </>
          ) : (
            'Welcome to planB'
          )}
        </h1>
        {!currentUser && (
          <p className="font-mono text-2xs uppercase tracking-widest text-[#8896A4] mt-1">
            Guest mode · no account required
          </p>
        )}
      </div>

      {/* ── Trip Search ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-subtle)' }}
          />
          <input
            id="dashboard-trip-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search trips, destinations, or travelers"
            aria-label="Search trips, destinations, or travelers"
            className="w-full h-11 pl-10 pr-4 rounded-xl border bg-white font-body text-sm outline-none transition-colors placeholder:text-[#9B968D] focus:border-[#102A43]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }}
          />
        </label>
        <div className="relative">
          <button
            id="dashboard-trip-filter"
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            className="h-11 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 rounded-xl border bg-white font-mono text-xs font-semibold cursor-pointer transition-colors hover:border-[#102A43]"
            style={{ borderColor: filterMode === 'all' ? 'var(--color-border)' : 'var(--color-confirmed-border)', color: 'var(--color-text-muted)' }}
            aria-expanded={filterOpen}
            aria-haspopup="menu"
          >
            <SlidersHorizontal size={15} />
            <span>Filter{filterMode !== 'all' ? `: ${filterLabel}` : ''}</span>
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border bg-white p-1.5 shadow-lg" style={{ borderColor: 'var(--color-border)' }} role="menu">
              {(['all', 'recent', 'risk'] as const).map((mode) => {
                const labels = { all: 'All trips', recent: 'Recently opened', risk: 'At risk' };
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setFilterMode(mode);
                      setFilterOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg font-mono text-xs cursor-pointer transition-colors hover:bg-[#F2F0EB]"
                    style={{ color: mode === filterMode ? 'var(--color-confirmed)' : 'var(--color-text-muted)' }}
                    role="menuitem"
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* ── Storage Error Notification ─────────────────────────────────── */}
      {storageError && (
        <div
          className="flex items-center justify-between p-3.5 rounded-[2px] font-mono text-xs border"
          style={{
            backgroundColor: 'var(--color-disrupted-bg)',
            borderColor: 'var(--color-disrupted-border)',
            color: 'var(--color-disrupted)',
          }}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{storageError}</span>
          </div>
          <button
            onClick={clearStorageError}
            className="font-mono text-2xs uppercase tracking-wider font-bold underline cursor-pointer hover:opacity-80"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* ── Guest Notification Banner ─────────────────────────────────── */}
      {!currentUser && (
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-[2px] border font-mono text-2xs"
          style={{
            backgroundColor: 'var(--color-bg-surface-alt)',
            borderColor: 'var(--color-border)',
            color: '#4A5568',
          }}
        >
          <div className="flex items-center gap-2">
            <CloudOff size={14} className="text-[#8896A4] flex-shrink-0" />
            <span>
              <strong className="text-[#17212B]">GUEST MODE:</strong> Trips are stored in your browser's local cache. Sign in to save them to your account.
            </span>
          </div>
          <button
            id="dashboard-signin-prompt-btn"
            onClick={() => openAuthModal()}
            className="font-bold text-[#0A1E30] hover:underline cursor-pointer uppercase tracking-wider flex-shrink-0"
          >
            SIGN IN TO SAVE →
          </button>
        </div>
      )}

      {/* ── Your Trips ────────────────────────────────────────────────── */}
      <section>
        <SectionLabel
          label="YOUR UPCOMING TRIPS"
          count={filteredItineraries.length}
        />

        {hasFilteredTrips ? (
          <div className="flex flex-col gap-3">
            {filteredItineraries.map((it) => (
              <TripCard
                key={it.id}
                itinerary={it}
                isSeed={false}
                onOpen={handleOpen}
                onDelete={removeImportedItinerary}
              />
            ))}
            <ImportCard />
          </div>
        ) : hasImported ? (
          <div
            className="rounded-[2px] px-6 py-10 flex flex-col items-center text-center gap-3"
            style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-alt)' }}
          >
            <Search size={22} style={{ color: 'var(--color-text-subtle)' }} />
            <p className="font-mono text-xs uppercase tracking-widest text-[#4A5568] font-semibold">
              NO MATCHING TRIPS
            </p>
            <p className="font-body text-sm text-[#4A5568] max-w-[40ch] leading-relaxed">
              Try a different search or filter.
            </p>
          </div>
        ) : (
          /* Empty state for imported trips */
          <div
            className="rounded-[2px] px-6 py-10 flex flex-col items-center text-center gap-4"
            style={{
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-surface-alt)',
            }}
          >
            <p className="font-mono text-2xs uppercase tracking-widest text-[#8896A4] font-semibold">
              NO SAVED TRIPS
            </p>
            <p className="font-body text-sm text-[#4A5568] max-w-[40ch] leading-relaxed">
              Import any booking confirmation — flight, hotel, train, transfer — and planB will
              build your itinerary and keep it disruption-ready.
            </p>
            <div className="w-full max-w-xs mt-2">
              <ImportCard />
            </div>
          </div>
        )}
      </section>

      {/* ── Guest footnote ────────────────────────────────────────────── */}
      {!currentUser && (
        <p className="font-mono text-2xs text-[#C7C3BC] text-center pb-2">
          Trips are saved in your browser's local storage — no account required.
        </p>
      )}
      </div>{/* end padded content */}
    </div>
  );
}
