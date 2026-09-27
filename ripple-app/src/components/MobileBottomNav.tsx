import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ListOrdered,
  CalendarDays,
  MapPin,
  CloudRain,
  User,
} from 'lucide-react';

export type MobileTabKey = 'itinerary' | 'timeline' | 'map' | 'twin' | 'profile';

interface TabItem {
  id: MobileTabKey;
  label: string;
  icon: React.ElementType;
  tint?: string;
  activeTint?: string;
  badge?: number | boolean;
}

interface Props {
  activeTab: MobileTabKey;
  onTabSelect: (tab: MobileTabKey) => void;
  disruptionCount?: number;
  hasWeatherAlert?: boolean;
}

export default function MobileBottomNav({
  activeTab,
  onTabSelect,
  hasWeatherAlert = false,
}: Props) {
  const tabs = useMemo<TabItem[]>(
    () => [
      {
        id: 'itinerary',
        label: 'Itinerary',
        icon: ListOrdered,
        activeTint: 'var(--color-confirmed)',
      },
      {
        id: 'timeline',
        label: 'Timeline',
        icon: CalendarDays,
        activeTint: 'var(--color-confirmed)',
      },
      {
        id: 'map',
        label: 'Map',
        icon: MapPin,
        activeTint: 'var(--color-confirmed)',
      },
      {
        id: 'twin',
        label: 'Digital Twin',
        icon: CloudRain,
        tint: hasWeatherAlert ? '#2563EB' : undefined,
        activeTint: '#2563EB',
        badge: hasWeatherAlert,
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: User,
        activeTint: 'var(--color-confirmed)',
      },
    ],
    [hasWeatherAlert]
  );

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab)
  );

  const [visualIndex, setVisualIndex] = useState(activeIndex);
  const [animating, setAnimating] = useState(false);
  const [indicatorDurationMs, setIndicatorDurationMs] = useState(180);

  useEffect(() => {
    if (!animating) {
      setVisualIndex(activeIndex);
    }
  }, [activeIndex, animating]);

  const handleTabPress = async (targetId: MobileTabKey, targetIndex: number) => {
    if (animating) return;

    if (targetIndex === activeIndex) {
      return;
    }

    setAnimating(true);
    const distance = Math.abs(targetIndex - visualIndex);
    const duration = Math.min(460, 140 + distance * 80);
    setIndicatorDurationMs(duration);
    setVisualIndex(targetIndex);

    // Let glide complete before triggering action
    await new Promise((resolve) => setTimeout(resolve, duration + 20));
    setAnimating(false);
    onTabSelect(targetId);
  };

  // Dynamic indicator styling based on the active tab
  const indicatorBg = useMemo(() => {
    if (visualIndex === 3) return 'rgba(37, 99, 235, 0.10)'; // Twin (blue)
    return 'rgba(16, 42, 67, 0.08)'; // Default (brand navy)
  }, [visualIndex]);

  const indicatorBorder = useMemo(() => {
    if (visualIndex === 3) return '1px solid rgba(37, 99, 235, 0.20)';
    return '1px solid rgba(16, 42, 67, 0.08)';
  }, [visualIndex]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <nav
      className="lg:hidden fixed inset-x-0 z-[9999] pointer-events-none"
      style={{
        position: 'fixed',
        bottom: '10px',
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
      aria-label="Mobile Navigation"
    >
      {/* Centered max-width container pushed down snugly to screen bottom */}
      <div className="px-2.5 sm:px-4 max-w-lg mx-auto pointer-events-auto">
        <div
          className="relative rounded-2xl p-1 shadow-2xl transition-all"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 10px 35px rgba(16, 42, 67, 0.16), 0 2px 10px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* Shared active indicator that glides between tabs */}
          <div
            aria-hidden="true"
            className="absolute rounded-xl pointer-events-none"
            style={{
              top: 4,
              bottom: 4,
              left: 4,
              width: `calc((100% - 8px) / ${tabs.length})`,
              transform: `translateX(${visualIndex * 100}%)`,
              transition: `transform ${indicatorDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease, border-color 200ms ease`,
              background: indicatorBg,
              border: indicatorBorder,
            }}
          />

          <div
            className="relative z-10 grid"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map(({ id, label, icon: Icon, tint, activeTint, badge }, idx) => {
              const active = idx === visualIndex;
              const activeColor = activeTint || 'var(--color-confirmed)';
              const inactiveColor = tint || 'var(--color-text-muted)';

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    void handleTabPress(id, idx);
                  }}
                  disabled={animating}
                  className={`nav-tab active:scale-95 transition-all duration-150 relative ${
                    active ? 'active' : ''
                  }`}
                  style={{
                    color: active ? activeColor : inactiveColor,
                  }}
                  aria-selected={active}
                  aria-label={label}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon size={17} strokeWidth={active ? 2.5 : 1.7} />
                    {badge && typeof badge === 'number' && badge > 0 && (
                      <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-white leading-none">
                        {badge}
                      </span>
                    )}
                    {badge && typeof badge === 'boolean' && (
                      <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <span
                    className="truncate max-w-full font-medium"
                    style={{ fontSize: '10px', letterSpacing: '-0.01em' }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>,
    document.body
  );
}
