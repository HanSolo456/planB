// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: PlanBLogo.tsx
// PURPOSE: Official planB vector logo & brand mark component.
//   Features the signature reroute trajectory curve (Plan B),
//   origin/destination waypoints, and flight delta navigational icon.
// =============================================================================

import React from 'react';

interface PlanBLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  subtitle?: string;
  badge?: string;
}

export const PlanBLogoMark: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="planB Logo Mark"
    >
      {/* Background Frame / Ops Stamp */}
      <rect width="48" height="48" rx="8" fill="#2B5D5C" />
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="6.5"
        stroke="#3F7E7C"
        strokeWidth="1.5"
      />

      {/* Manifest Corner Grid Ticks */}
      <line x1="6" y1="6" x2="10" y2="6" stroke="#5EEAD4" strokeWidth="1.2" opacity="0.6" />
      <line x1="6" y1="6" x2="6" y2="10" stroke="#5EEAD4" strokeWidth="1.2" opacity="0.6" />
      <line x1="42" y1="42" x2="38" y2="42" stroke="#5EEAD4" strokeWidth="1.2" opacity="0.6" />
      <line x1="42" y1="42" x2="42" y2="38" stroke="#5EEAD4" strokeWidth="1.2" opacity="0.6" />

      {/* Origin Waypoint (Node A) */}
      <circle cx="12" cy="34" r="3" fill="#FFFFFF" />

      {/* Original Disrupted Path (Dashed with warning marker) */}
      <path
        d="M14 32L24 22"
        stroke="#E8C9BD"
        strokeWidth="1.8"
        strokeDasharray="2 2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="24" cy="22" r="2.5" fill="#B8552F" stroke="#FAF1EB" strokeWidth="1" />

      {/* Recovery Reroute Curve (Plan B trajectory: Teal arc ascending to destination) */}
      <path
        d="M12 34C14 18 24 12 36 12"
        stroke="#5EEAD4"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Destination Waypoint (Node B) */}
      <circle cx="36" cy="12" r="3.5" fill="#FFFFFF" />
      <circle cx="36" cy="12" r="1.5" fill="#2B5D5C" />

      {/* Navigational Flight Delta */}
      <path
        d="M26 15.5L31.5 13.5L29 19L27 17.5L26 15.5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};

export default function PlanBLogo({
  size = 32,
  className = '',
  showWordmark = true,
  subtitle = 'Real-time Travel Disruption & Re-accommodation Engine',
  badge = 'OPS MANIFEST',
}: PlanBLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PlanBLogoMark size={size} />

      {showWordmark && (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tight text-[#1C1B19] leading-none">
              planB
            </span>
            {badge && (
              <span
                className="font-mono text-2xs uppercase tracking-widest px-1.5 py-0.5 rounded-[2px]"
                style={{
                  backgroundColor: 'var(--color-bg-surface-alt)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[#6B6760] mt-0.5 font-normal leading-tight">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
