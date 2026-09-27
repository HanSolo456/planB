import PlanBLogo from './PlanBLogo';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../App';
import { ChevronLeft, User } from 'lucide-react';

export default function Header() {
  const {
    activeDisruption,
    impactedBookings,
    selectedItinerary,
    clearSelectedItinerary,
    currentUser,
    openAuthModal,
  } = useAppState();
  const navigate = useNavigate();

  return (
    <header
      className="fixed top-3 sm:top-4 inset-x-3 sm:inset-x-6 lg:inset-x-8 max-w-7xl mx-auto z-50 rounded-2xl md:rounded-full border transition-all duration-300"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderColor: 'var(--color-border)',
        backdropFilter: 'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        boxShadow: '0 4px 16px -4px rgba(28, 27, 25, 0.07), 0 1px 4px -1px rgba(28, 27, 25, 0.04)',
      }}
    >
      <div className="px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3">

        {/* Left — Logo + Back nav */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <PlanBLogo size={30} />
          ) : (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="cursor-pointer focus:outline-none"
              aria-label="Go to home page"
            >
              <PlanBLogo size={30} />
            </button>
          )}

          {/* ← All trips — only when a trip is open */}
          {selectedItinerary && (
            <button
              id="header-back-to-dashboard"
              onClick={clearSelectedItinerary}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-colors duration-150 border flex-shrink-0"
              style={{
                color: 'var(--color-text-muted)',
                borderColor: 'var(--color-border)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-confirmed)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-confirmed-border)';
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-confirmed-bg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
              title="Back to all trips"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">All trips</span>
            </button>
          )}
        </div>

        {/* Right — Status pill + Profile/Sign-in */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Disruption / trip status pill */}
          {activeDisruption ? (
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold animate-board-flip"
              style={{
                backgroundColor: 'var(--color-disrupted-bg)',
                border: '1px solid var(--color-disrupted-border)',
                color: 'var(--color-disrupted)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                style={{ backgroundColor: 'var(--color-disrupted)' }}
              />
              <span className="truncate">
                Disruption active · {impactedBookings.length}{' '}
                {impactedBookings.length === 1 ? 'leg' : 'legs'} affected
              </span>
            </div>
          ) : selectedItinerary ? (
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: 'var(--color-confirmed-bg)',
                border: '1px solid var(--color-confirmed-border)',
                color: 'var(--color-confirmed)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: 'var(--color-confirmed)' }}
              />
              <span className="truncate max-w-[160px]">
                {selectedItinerary.destination}
                <span className="text-[var(--color-text-subtle)] font-normal ml-1">· All clear</span>
              </span>
            </div>
          ) : null}

          {/* Profile pill (logged in) or Sign in button (guest) */}
          {currentUser ? (
            <button
              id="header-user-profile-btn"
              onClick={() => navigate('/app/profile')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border cursor-pointer transition-colors"
              style={{ backgroundColor: 'var(--color-bg-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }}
              title="View profile"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-confirmed)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-confirmed)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-main)';
              }}
            >
              <User size={13} style={{ color: 'var(--color-confirmed)' }} />
              Profile
            </button>
          ) : (
            <button
              id="header-signin-btn"
              onClick={() => openAuthModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors duration-150 cursor-pointer border"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-surface-alt)',
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
    </header>
  );
}
