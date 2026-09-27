// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: FloatingNav.tsx
// PURPOSE: Minimal floating nav for pages. Two small frosted-glass pill buttons:
//   ← Back (left) and Simulate Disruption / Profile (right).
// =============================================================================

import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, User, Zap } from 'lucide-react';
import { useAppState } from '../App';

interface Props {
  /** Where the back button navigates. Defaults to /app/dashboard */
  backTo?: string;
  /** Override the back label */
  backLabel?: string;
  /** Right button action: 'simulate' (on trip views), 'profile' (on other pages), or 'none' */
  rightAction?: 'simulate' | 'profile' | 'none';
  /** Optional custom callback when simulate is clicked */
  onSimulate?: () => void;
  /** Hide the right button */
  hideProfile?: boolean;
}

const pillBase = `
  flex items-center gap-1.5 px-3.5 py-2 rounded-full border
  font-mono text-xs font-semibold cursor-pointer transition-all duration-200
  backdrop-blur-sm
`.trim();

export default function FloatingNav({
  backTo = '/app/dashboard',
  backLabel = 'Back',
  rightAction = 'profile',
  onSimulate,
  hideProfile = false,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, openAuthModal } = useAppState();

  const handleSimulateClick = () => {
    if (onSimulate) {
      onSimulate();
      return;
    }
    const search = new URLSearchParams(location.search);
    search.set('simulate', 'true');
    navigate(`${location.pathname}?${search.toString()}`);
  };

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex items-center justify-between px-4 sm:px-6 pointer-events-none">
      {/* ← Back */}
      <button
        onClick={() => navigate(backTo)}
        className={pillBase}
        style={{
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-muted)',
          pointerEvents: 'auto',
          boxShadow: '0 2px 8px rgba(28,27,25,0.08)',
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.borderColor = 'var(--color-confirmed)';
          b.style.color = 'var(--color-confirmed)';
          b.style.backgroundColor = 'rgba(255,255,255,0.95)';
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.borderColor = 'var(--color-border)';
          b.style.color = 'var(--color-text-muted)';
          b.style.backgroundColor = 'rgba(255,255,255,0.85)';
        }}
      >
        <ChevronLeft size={13} />
        {backLabel}
      </button>

      {/* Right button: Simulate Disruption (on trip pages) */}
      {!hideProfile && rightAction === 'simulate' && (
        <button
          onClick={handleSimulateClick}
          className={pillBase}
          style={{
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderColor: 'rgba(217, 119, 6, 0.45)',
            color: '#B45309',
            pointerEvents: 'auto',
            boxShadow: '0 2px 10px rgba(217, 119, 6, 0.14)',
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = '#D97706';
            b.style.color = '#78350F';
            b.style.backgroundColor = 'rgba(254, 243, 199, 0.95)';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = 'rgba(217, 119, 6, 0.45)';
            b.style.color = '#B45309';
            b.style.backgroundColor = 'rgba(255,255,255,0.92)';
          }}
          id="btn-simulate-disruption-header"
          title="Simulate Disruption"
        >
          <Zap size={13} className="text-amber-500 fill-amber-500" />
          <span>Simulate Disruption</span>
        </button>
      )}

      {/* Right button: Profile / Sign in (when rightAction === 'profile') */}
      {!hideProfile && rightAction === 'profile' && (
        currentUser ? (
          <button
            onClick={() => navigate('/app/profile')}
            className={pillBase}
            style={{
              backgroundColor: 'rgba(255,255,255,0.82)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'auto',
              boxShadow: '0 2px 8px rgba(28,27,25,0.08)',
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-confirmed)';
              b.style.color = 'var(--color-confirmed)';
              b.style.backgroundColor = 'rgba(255,255,255,0.95)';
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-border)';
              b.style.color = 'var(--color-text-muted)';
              b.style.backgroundColor = 'rgba(255,255,255,0.82)';
            }}
          >
            <User size={13} style={{ color: 'var(--color-confirmed)' }} />
            Profile
          </button>
        ) : (
          <button
            onClick={() => openAuthModal()}
            className={pillBase}
            style={{
              backgroundColor: 'rgba(255,255,255,0.82)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'auto',
              boxShadow: '0 2px 8px rgba(28,27,25,0.08)',
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-confirmed)';
              b.style.color = 'var(--color-confirmed)';
              b.style.backgroundColor = 'rgba(255,255,255,0.95)';
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-border)';
              b.style.color = 'var(--color-text-muted)';
              b.style.backgroundColor = 'rgba(255,255,255,0.82)';
            }}
          >
            <User size={13} />
            Sign in
          </button>
        )
      )}
    </div>
  );
}

