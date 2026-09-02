import { useState, useMemo, useCallback, createContext, useContext } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import type { Itinerary, Disruption, ImpactedBooking, ScoredRecoveryOption } from './lib/types';
import { detectImpact } from './lib/impactEngine';
import { applyRecoveryOption } from './lib/recoveryEngine';
import Header from './components/Header';
import ItineraryView from './components/ItineraryView';
import RecoveryView from './components/RecoveryView';
import ItineraryTabs from './components/ItineraryTabs';
import ImportView from './components/ImportView';
import LandingPage from './components/LandingPage';
import EmptyDashboard from './components/EmptyDashboard';

// ---------------------------------------------------------------------------
// App-level state shape
// ---------------------------------------------------------------------------
export interface AppState {
  selectedItinerary: Itinerary | null;
  setSelectedItinerary: (it: Itinerary) => void;
  activeDisruption: Disruption | null;
  setActiveDisruption: (d: Disruption | null) => void;
  impactedBookings: ImpactedBooking[];
  showRecoveryOptions: boolean;
  setShowRecoveryOptions: (show: boolean) => void;
  clearDisruption: () => void;
  applyRecovery: (option: ScoredRecoveryOption) => void;
  recoverySuccessMessage: string | null;
  clearRecoverySuccess: () => void;
  // Import feature
  addImportedItinerary: (it: Itinerary) => void;
}

const AppContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Dashboard layout — shared shell for /app/dashboard, /app/import, /app/recovery
// Matches the exact horizontal coverage of the landing/home page (max-w-7xl px-8 md:px-16)
// ---------------------------------------------------------------------------
function DashboardLayout({ itineraries }: { itineraries: Itinerary[] }) {
  const { selectedItinerary, showRecoveryOptions } = useAppState();

  return (
    <div
      className="min-h-screen font-body antialiased"
      style={{
        backgroundColor: 'var(--color-bg-base)',
        color: 'var(--color-text-main)',
      }}
    >
      <Header />
      <main className="max-w-7xl mx-auto px-8 md:px-16 py-8">
        <Routes>
          <Route
            path="dashboard"
            element={
              selectedItinerary === null ? (
                <EmptyDashboard />
              ) : (
                <>
                  {!showRecoveryOptions && (
                    <ItineraryTabs itineraries={itineraries} />
                  )}
                  <ItineraryView itinerary={selectedItinerary} />
                </>
              )
            }
          />
          <Route path="import" element={<ImportView />} />
          <Route path="recovery" element={<RecoveryView />} />
          {/* Fallback: redirect /app/* to /app/dashboard */}
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Root App — owns all shared state, provides context, defines top-level routes
// ---------------------------------------------------------------------------
export default function App() {
  const navigate = useNavigate();

  // No seed itineraries — starts completely empty
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedItinerary, setSelectedItineraryState] = useState<Itinerary | null>(null);
  const [activeDisruption, setActiveDisruption] = useState<Disruption | null>(null);
  const [showRecoveryOptions, setShowRecoveryOptionsState] = useState<boolean>(false);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);

  const impactedBookings = useMemo<ImpactedBooking[]>(() => {
    if (!activeDisruption || !selectedItinerary) return [];
    try {
      return detectImpact(selectedItinerary, activeDisruption);
    } catch (err) {
      console.error('Impact detection error:', err);
      return [];
    }
  }, [selectedItinerary, activeDisruption]);

  const setShowRecoveryOptions = useCallback((show: boolean) => {
    setShowRecoveryOptionsState(show);
    if (show) {
      navigate('/app/recovery');
    } else {
      navigate('/app/dashboard');
    }
  }, [navigate]);

  const clearDisruption = useCallback(() => {
    setActiveDisruption(null);
    setShowRecoveryOptionsState(false);
    navigate('/app/dashboard');
  }, [navigate]);

  const setSelectedItinerary = useCallback((it: Itinerary) => {
    setSelectedItineraryState(it);
    setActiveDisruption(null);
    setShowRecoveryOptionsState(false);
    setRecoverySuccessMessage(null);
    navigate('/app/dashboard');
  }, [navigate]);

  const applyRecovery = useCallback((option: ScoredRecoveryOption) => {
    if (!selectedItinerary) return;
    const recovered = applyRecoveryOption(selectedItinerary, option);
    setSelectedItineraryState(recovered);
    setActiveDisruption(null);
    setShowRecoveryOptionsState(false);
    setRecoverySuccessMessage(
      `Recovery applied: ${option.description}. ${option.costDelta > 0
        ? `₹${option.costDelta.toLocaleString('en-IN')} extra cost.`
        : option.costDelta < 0
          ? `₹${Math.abs(option.costDelta).toLocaleString('en-IN')} saved.`
          : 'No additional cost.'
      } Affected booking is now recovered.`
    );
    navigate('/app/dashboard');
  }, [selectedItinerary, navigate]);

  const clearRecoverySuccess = useCallback(() => {
    setRecoverySuccessMessage(null);
  }, []);

  const addImportedItinerary = useCallback((it: Itinerary) => {
    setItineraries((prev) => {
      const deduped = prev.filter((p) => p.id !== it.id);
      return [...deduped, it];
    });
    setSelectedItineraryState(it);
    setActiveDisruption(null);
    setShowRecoveryOptionsState(false);
    setRecoverySuccessMessage(null);
    navigate('/app/dashboard');
  }, [navigate]);

  return (
    <AppContext.Provider
      value={{
        selectedItinerary,
        setSelectedItinerary,
        activeDisruption,
        setActiveDisruption,
        impactedBookings,
        showRecoveryOptions,
        setShowRecoveryOptions,
        clearDisruption,
        applyRecovery,
        recoverySuccessMessage,
        clearRecoverySuccess,
        addImportedItinerary,
      }}
    >
      <Routes>
        {/* Landing page */}
        <Route
          path="/"
          element={<LandingPage onLaunch={() => navigate('/app/dashboard')} />}
        />

        {/* Main app shell at /app/* */}
        <Route
          path="/app/*"
          element={<DashboardLayout itineraries={itineraries} />}
        />

        {/* Catch-all: redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppContext.Provider>
  );
}
