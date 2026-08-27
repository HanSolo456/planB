import { Compass } from 'lucide-react';
import { useAppState } from '../App';

export default function Header() {
  const { activeDisruption, impactedBookings } = useAppState();

  return (
    <header
      className="sticky top-0 z-50 border-b bg-white"
      style={{
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand stamp + Wordmark */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-[2px]"
            style={{
              backgroundColor: 'var(--color-confirmed)',
              color: '#FFFFFF',
            }}
          >
            <Compass size={16} strokeWidth={2.2} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight text-[#1C1B19] leading-none">
                planB
              </h1>
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

        {/* Operational Status Pill */}
        <div>
          {activeDisruption ? (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] font-mono text-xs font-semibold"
              style={{
                backgroundColor: 'var(--color-disrupted-bg)',
                border: '1px solid var(--color-disrupted-border)',
                color: 'var(--color-disrupted)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: 'var(--color-disrupted)' }}
              />
              <span>
                DISRUPTION ACTIVE ({impactedBookings.length} {impactedBookings.length === 1 ? 'LEG' : 'LEGS'} IMPACTED)
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] font-mono text-xs font-medium"
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
              <span>STATUS: ALL NOMINAL</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
