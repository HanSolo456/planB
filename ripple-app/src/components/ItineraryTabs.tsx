import { MapPin, Calendar, User, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Itinerary } from '../lib/types';
import { useAppState } from '../App';

interface Props {
  itineraries: Itinerary[];
}

export default function ItineraryTabs({ itineraries }: Props) {
  const navigate = useNavigate();
  const { selectedItinerary, setSelectedItinerary } = useAppState();

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2.5">
        <p className="font-mono text-2xs uppercase tracking-wider text-[#6B6760] font-semibold">
          ACTIVE MANIFEST / DISPATCH SCHEDULE
        </p>
        <span className="font-mono text-2xs text-[#969188]">
          {itineraries.length} ITINERARIES LOADED
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {itineraries.map((it) => {
          const isSelected = it.id === selectedItinerary?.id;
          return (
            <button
              key={it.id}
              onClick={() => setSelectedItinerary(it)}
              className="text-left p-4 rounded-[2px] transition-colors duration-150 cursor-pointer relative"
              style={{
                backgroundColor: isSelected ? '#FFFFFF' : 'var(--color-bg-surface-alt)',
                border: isSelected
                  ? '1.5px solid var(--color-confirmed)'
                  : '1px solid var(--color-border)',
              }}
              aria-pressed={isSelected}
              id={`tab-${it.id}`}
            >
              {/* Top meta row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-wider">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-confirmed)' : '#969188',
                    }}
                  />
                  <span style={{ color: isSelected ? 'var(--color-confirmed)' : '#6B6760' }}>
                    {isSelected ? 'ACTIVE DISPATCH' : 'IN RESERVE'}
                  </span>
                </div>

                <span className="font-mono text-2xs text-[#969188]">
                  ID: {it.id.toUpperCase()}
                </span>
              </div>

              {/* Destination in serif */}
              <h2
                className="font-display text-lg font-bold leading-tight mb-2"
                style={{ color: isSelected ? '#1C1B19' : '#6B6760' }}
              >
                {it.destination}
              </h2>

              {/* Manifest summary data */}
              <div className="space-y-1 text-xs text-[#6B6760]">
                <div className="flex items-center gap-1.5 font-mono">
                  <Calendar size={12} className="text-[#969188] flex-shrink-0" />
                  <span>{formatDateRange(it.startDate, it.endDate)}</span>
                </div>

                <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#EBE7DF] font-mono text-2xs text-[#6B6760]">
                  <span className="flex items-center gap-1">
                    <User size={10} className="text-[#969188]" />
                    {it.travelerName}
                  </span>
                  <span className="font-semibold text-[#1C1B19]">
                    {it.bookings.length} LEGS / BOOKINGS
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Import Trip — entry point */}
      <button
        id="tab-import-trip"
        onClick={() => navigate('/app/import')}
        className="w-full text-left p-4 rounded-[2px] transition-colors duration-150 cursor-pointer flex items-center justify-between group"
        style={{
          backgroundColor: 'var(--color-bg-surface-alt)',
          border: '1px dashed var(--color-border)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-confirmed)';
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F5FBF8';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-bg-surface-alt)';
        }}
      >
        <div className="flex items-center gap-3">
          <PlusCircle size={16} style={{ color: 'var(--color-confirmed)', flexShrink: 0 }} />
          <div>
            <p className="font-mono text-2xs font-semibold uppercase tracking-wider mb-0.5"
              style={{ color: 'var(--color-confirmed)' }}>
              IMPORT YOUR OWN TRIP
            </p>
            <p className="font-mono text-2xs text-[#969188]">
              Paste a booking confirmation to extract an itinerary
            </p>
          </div>
        </div>
        <span className="font-mono text-2xs text-[#969188] group-hover:text-[#1C1B19] transition-colors">
          →
        </span>
      </button>
    </div>
  );
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}, ${e.getFullYear()}`;
}
