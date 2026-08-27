import { useState, useMemo, useCallback, createContext, useContext } from 'react';
import { itineraryA, itineraryB } from './lib/seedData';
import type { Itinerary, Disruption, ImpactedBooking, ScoredRecoveryOption } from './lib/types';
import { detectImpact } from './lib/impactEngine';
import { applyRecoveryOption } from './lib/recoveryEngine';
import Header from './components/Header';
import ItineraryView from './components/ItineraryView';
import RecoveryView from './components/RecoveryView';
import ItineraryTabs from './components/ItineraryTabs';
import ImportView from './components/ImportView';
import LandingPage from './components/LandingPage';

// ---------------------------------------------------------------------------
// App-level state shape — structured so disruption + recovery view can slot in
// cleanly in the next iteration.
// ---------------------------------------------------------------------------
export interface AppState {
  selectedItinerary: Itinerary;
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
  showImportView: boolean;
  setShowImportView: (show: boolean) => void;
  addImportedItinerary: (it: Itinerary) => void;
}

const AppContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppProvider');
  return ctx;
}

// Seed itineraries — imported trips get appended at runtime
const SEED_ITINERARIES: Itinerary[] = [itineraryA, itineraryB];

export default function App() {
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [itineraries, setItineraries] = useState<Itinerary[]>(SEED_ITINERARIES);
  const [selectedItinerary, setSelectedItineraryState] = useState<Itinerary>(itineraryA);
  const [activeDisruption, setActiveDisruption] = useState<Disruption | null>(null);
  const [showRecoveryOptions, setShowRecoveryOptions] = useState<boolean>(false);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);
  const [showImportView, setShowImportView] = useState<boolean>(false);

  // Derive impacted bookings whenever activeDisruption or selectedItinerary changes
  const impactedBookings = useMemo<ImpactedBooking[]>(() => {
    if (!activeDisruption) return [];
    try {
      return detectImpact(selectedItinerary, activeDisruption);
    } catch (err) {
      console.error('Impact detection error:', err);
      return [];
    }
  }, [selectedItinerary, activeDisruption]);

  const clearDisruption = useCallback(() => {
    setActiveDisruption(null);
    setShowRecoveryOptions(false);
  }, []);

  const setSelectedItinerary = useCallback((it: Itinerary) => {
    setSelectedItineraryState(it);
    setActiveDisruption(null);
    setShowRecoveryOptions(false);
    setRecoverySuccessMessage(null);
  }, []);

  const applyRecovery = useCallback((option: ScoredRecoveryOption) => {
    const recovered = applyRecoveryOption(selectedItinerary, option);
    setSelectedItineraryState(recovered);
    setActiveDisruption(null);
    setShowRecoveryOptions(false);
    setRecoverySuccessMessage(
      `Recovery applied: ${option.description}. ${
        option.costDelta > 0
          ? `₹${option.costDelta.toLocaleString('en-IN')} extra cost.`
          : option.costDelta < 0
          ? `₹${Math.abs(option.costDelta).toLocaleString('en-IN')} saved.`
          : 'No additional cost.'
      } Affected booking is now recovered.`
    );
  }, [selectedItinerary]);

  const clearRecoverySuccess = useCallback(() => {
    setRecoverySuccessMessage(null);
  }, []);

  const addImportedItinerary = useCallback((it: Itinerary) => {
    setItineraries((prev) => {
      // Avoid duplicates if the same import is confirmed twice
      const deduped = prev.filter((p) => p.id !== it.id);
      return [...deduped, it];
    });
    // Immediately select the newly imported itinerary and clear any active state
    setSelectedItineraryState(it);
    setActiveDisruption(null);
    setShowRecoveryOptions(false);
    setRecoverySuccessMessage(null);
  }, []);

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
        showImportView,
        setShowImportView,
        addImportedItinerary,
      }}
    >
      {/* Landing page renders outside AppContext so it has no status pill */}
      {showLanding ? (
        <LandingPage onLaunch={() => setShowLanding(false)} />
      ) : (
      <div
        className="min-h-screen font-body antialiased"
        style={{
          backgroundColor: 'var(--color-bg-base)',
          color: 'var(--color-text-main)',
        }}
      >
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-8">
          {/* Import view replaces everything below the header */}
          {showImportView ? (
            <ImportView />
          ) : (
            <>
              {!showRecoveryOptions && (
                <ItineraryTabs itineraries={itineraries} />
              )}
              {showRecoveryOptions
                ? <RecoveryView />
                : <ItineraryView itinerary={selectedItinerary} />
              }
            </>
          )}
        </main>
      </div>
      )}
    </AppContext.Provider>
  );
}

