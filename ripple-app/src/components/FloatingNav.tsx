// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: FloatingNav.tsx
// PURPOSE: Minimal floating nav for pages that don't need a full header
//   (import, profile). Two small frosted-glass pill buttons: ← Back (left)
//   and Profile (right). Stays out of the way of page content.
// =============================================================================

import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User } from 'lucide-react';
import { useAppState } from '../App';

interface Props {
  /** Where the back button navigates. Defaults to /app/dashboard */
  backTo?: string;
  /** Override the back label */
  backLabel?: string;
  /** Hide the profile button (e.g. on the profile page itself) */
  hideProfile?: boolean;
}

const pillBase = `
  flex items-center gap-1.5 px-3.5 py-2 rounded-full border
  font-mono text-xs font-semibold cursor-pointer transition-all duration-200
  backdrop-blur-sm
`.trim();

export default function FloatingNav({ backTo = '/app/dashboard', backLabel = 'Back', hideProfile = false }: Props) {
  const navigate = useNavigate();
  const { currentUser, openAuthModal } = useAppState();

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex items-center justify-between px-4 sm:px-6 pointer-events-none">
      {/* ← Back */}
      <button
        onClick={() => navigate(backTo)}
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
        <ChevronLeft size={13} />
        {backLabel}
      </button>

      {/* Profile / Sign in */}
      {!hideProfile && (
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
