import PlanBLogo from './PlanBLogo';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../App';
import { Plus } from 'lucide-react';

export default function Header() {
  const { activeDisruption, impactedBookings, selectedItinerary } = useAppState();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-50 border-b bg-white"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="max-w-7xl mx-auto px-8 md:px-16 py-3.5 flex items-center justify-between gap-4">
        {/* Brand stamp + Wordmark */}
        <PlanBLogo size={34} />

        {/* Right side: status pill + import CTA */}
        <div className="flex items-center gap-3">
          {/* Operational Status Pill */}
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
                DISRUPTION ACTIVE ({impactedBookings.length}{' '}
                {impactedBookings.length === 1 ? 'LEG' : 'LEGS'} IMPACTED)
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
              {selectedItinerary ? (
                <span>
                  {selectedItinerary.destination.toUpperCase()}
                  <span className="text-[#969188] font-normal ml-1 hidden sm:inline">— ALL NOMINAL</span>
                </span>
              ) : (
                <span>STATUS: NO TRIP LOADED</span>
              )}
            </div>
          )}

          {/* Import CTA — always visible */}
          <button
            id="header-import-btn"
            onClick={() => navigate('/app/import')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] font-mono text-xs font-semibold uppercase tracking-wider transition-colors duration-150"
            style={{
              backgroundColor: 'var(--color-confirmed)',
              color: '#FFFFFF',
            }}
          >
            <Plus size={12} />
            IMPORT TRIP
          </button>
        </div>
      </div>
    </header>
  );
}
