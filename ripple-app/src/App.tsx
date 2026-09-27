import { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition, { pageScope } from './components/PageTransition';
import type { Itinerary, Disruption, ImpactedBooking, ScoredRecoveryOption } from './lib/types';
import { detectCombinedImpact } from './lib/impactEngine';
import { applyRecoveryOption } from './lib/recoveryEngine';
import { SEED_IDS, SEED_ITINERARIES, goaSaumitraTrip } from './lib/seedData';
import * as localTripStorage from './lib/tripStorage';
import * as cloudTripStorage from './lib/cloudTripStorage';
import { supabase } from './lib/supabase';
// FloatingNav and CustomCursor are always-visible chrome — keep them eager
import FloatingNav from './components/FloatingNav';
import CustomCursor from './components/CustomCursor';

// ---------------------------------------------------------------------------
// Route-level code splitting — each page is a separate JS chunk that only
// downloads when the user actually navigates to that route.
// ---------------------------------------------------------------------------
const LandingPage    = lazy(() => import('./components/LandingPage'));
const LoginPage      = lazy(() => import('./components/LoginPage'));
const TripDashboard  = lazy(() => import('./components/TripDashboard'));
const ItineraryView  = lazy(() => import('./components/ItineraryView'));
const RecoveryView   = lazy(() => import('./components/RecoveryView'));
const ImportView     = lazy(() => import('./components/ImportView'));
const ProfilePanel   = lazy(() => import('./components/ProfilePanel'));
const SharedTripView = lazy(() => import('./components/SharedTripView'));
const DigitalTwinView = lazy(() => import('./components/DigitalTwinView'));

// Minimal spinner shown while a lazy chunk is downloading
function RouteSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div
        className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--color-confirmed)', borderTopColor: 'transparent' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// App-level state shape
// ---------------------------------------------------------------------------
export interface AppUser {
  id: string;
  email: string;
  name?: string;
}

export function formatUserName(user?: { email?: string; name?: string } | null): string {
  if (!user) return '';
  if (user.name && user.name.trim()) return user.name.trim();
  if (!user.email) return 'User';

  const prefix = user.email.split('@')[0];
  if (prefix.toLowerCase() === 'saumitramatta') {
    return 'Saumitra Matta';
  }

  const parts = prefix.split(/[._\-\d]+/).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }

  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export interface AppState {
  // Auth state & actions
  currentUser: AppUser | null;
  updateDisplayName?: (name: string) => void;
  isAuthLoading: boolean;
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  signOut: () => Promise<void>;

  // Storage error handling
  storageError: string | null;
  clearStorageError: () => void;

  // Trip lists
  importedItineraries: Itinerary[];

  // Currently open trip
  selectedItinerary: Itinerary | null;
  setSelectedItinerary: (it: Itinerary) => void;
  clearSelectedItinerary: () => void;

  // ---------------------------------------------------------------------------
  // DUAL-DISRUPTION STATE
  //
  // activeDisruptions: the canonical array, max length 2.
  // activeDisruption: computed alias → the "selected" disruption for RecoveryView.
  //   When 1 active: activeDisruption === activeDisruptions[0].
  //   When 2 active: set by RecoveryView's picker via setRecoveryTargetDisruption().
  //   When 0 active: null.
  // ---------------------------------------------------------------------------
  activeDisruptions: Disruption[];
  activeDisruption: Disruption | null; // computed alias — for backward-compat with RecoveryView

  /** Add a disruption. Silently ignored if already at capacity (caller should check first). */
  addDisruption: (d: Disruption) => void;
  /** Remove one disruption by bookingId (other disruption's cascade stays alive). */
  removeDisruption: (bookingId: string) => void;
  /** Clear all disruptions. */
  clearAllDisruptions: () => void;
  /** Returns true if a new disruption can be added (count < 3). */
  hasCapacityForAnotherDisruption: () => boolean;

  /** Called by RecoveryView's disruption picker to pin which disruption is being resolved. */
  setRecoveryTargetDisruption: (d: Disruption | null) => void;

  impactedBookings: ImpactedBooking[];
  showRecoveryOptions: boolean;
  setShowRecoveryOptions: (show: boolean) => void;
  clearDisruption: () => void; // kept for backward-compat (= clearAllDisruptions)
  applyRecovery: (option: ScoredRecoveryOption) => void;
  recoverySuccessMessage: string | null;
  clearRecoverySuccess: () => void;

  /** Transfer simulated weather disruption into Plan B active recovery */
  applyWeatherDisruptionToItinerary: (
    it: Itinerary,
    disruptions: Disruption | Disruption[],
    openRecovery?: boolean
  ) => void;

  // Import + persistence
  addImportedItinerary: (it: Itinerary) => void;
  removeImportedItinerary: (id: string) => void;

  // Helpers
  isSeedTrip: (id: string) => boolean;
}

const AppContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppProvider');
  return ctx;
}


// ---------------------------------------------------------------------------
// TripRouteWrapper — renders ItineraryView for /app/trip/:tripId or /app/dashboard/:tripId
// ---------------------------------------------------------------------------
function TripRouteWrapper() {
  const { tripId } = useParams<{ tripId: string }>();
  const {
    selectedItinerary,
    setSelectedItinerary,
    importedItineraries,
    showRecoveryOptions,
    isAuthLoading,
  } = useAppState();

  const foundTrip = useMemo(() => {
    if (!tripId) return null;
    if (selectedItinerary && selectedItinerary.id === tripId) {
      return selectedItinerary;
    }
    const fromImported = importedItineraries.find((it) => it.id === tripId);
    if (fromImported) return fromImported;

    const fromSeed = SEED_ITINERARIES.find((it) => it.id === tripId);
    if (fromSeed) return fromSeed;

    const fromLocal = localTripStorage.getTrip(tripId);
    if (fromLocal) return fromLocal;

    if (tripId && (tripId === 'trip-goa-india-tyqz' || tripId.startsWith('trip-goa'))) {
      return { ...goaSaumitraTrip, id: tripId };
    }

    return null;
  }, [tripId, selectedItinerary, importedItineraries]);

  // Synchronize with app state when loading a trip directly by URL.
  // Uses a ref to track the last-synced tripId so that clearSelectedItinerary
  // (which nullifies selectedItinerary) doesn't cause this effect to re-select
  // the trip and fight the navigation back to the dashboard.
  const lastSyncedTripId = useRef<string | null>(null);

  useEffect(() => {
    if (foundTrip && lastSyncedTripId.current !== tripId) {
      lastSyncedTripId.current = tripId ?? null;
      if (!selectedItinerary || selectedItinerary.id !== foundTrip.id) {
        setSelectedItinerary(foundTrip);
      }
    }
  }, [foundTrip, tripId, selectedItinerary]);

  // Reset the ref when tripId changes (e.g. navigating between different trips)
  useEffect(() => {
    return () => {
      lastSyncedTripId.current = null;
    };
  }, [tripId]);

  if (!foundTrip) {
    if (isAuthLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-3"
            style={{ borderColor: 'var(--color-confirmed)', borderTopColor: 'transparent' }}
          />
          <p className="font-mono text-xs uppercase tracking-wider text-[#4A5568]">
            Loading trip...
          </p>
        </div>
      );
    }
    return <Navigate to="/app/dashboard" replace />;
  }

  if (showRecoveryOptions) {
    return <RecoveryView />;
  }

  return <ItineraryView itinerary={foundTrip} />;
}

// ---------------------------------------------------------------------------
// Dashboard layout — shared shell for /app/dashboard, /app/trip/:tripId, /app/import
// ---------------------------------------------------------------------------
function DashboardLayout() {
  const location = useLocation();
  const { selectedItinerary } = useAppState();

  const isTwin = location.pathname.startsWith('/app/twin/');
  const twinTripId = isTwin ? location.pathname.split('/app/twin/')[1] : null;
  const isRecovery = location.pathname.startsWith('/app/recovery');
  const isTrip =
    location.pathname.startsWith('/app/trip/');
  const isDashboard =
    location.pathname === '/app/dashboard' || location.pathname === '/app/dashboard/';
  const isImport = location.pathname === '/app/import';
  const isProfile = location.pathname === '/app/profile';

  const recoveryBackTo = selectedItinerary ? `/app/trip/${selectedItinerary.id}` : '/app/dashboard';
  const recoveryBackLabel = selectedItinerary ? 'Back to trip' : 'All trips';

  return (
    <div
      className="min-h-screen font-body antialiased overflow-x-hidden"
      style={{
        backgroundColor: 'var(--color-bg-base)',
        color: 'var(--color-text-main)',
      }}
    >
      {/* Floating pill nav on trip, twin, import and profile — minimal, consistent */}
      {isTrip && <FloatingNav backLabel="All trips" backTo="/app/dashboard" rightAction="simulate" />}
      {isRecovery && <FloatingNav backLabel={recoveryBackLabel} backTo={recoveryBackTo} rightAction="simulate" />}
      {isTwin && (
        <FloatingNav
          backLabel="Trip view"
          backTo={twinTripId ? `/app/trip/${twinTripId}` : '/app/dashboard'}
          rightAction="none"
        />
      )}
      {isImport && <FloatingNav backLabel="Back" rightAction="profile" />}
      {isProfile && <FloatingNav backLabel="All trips" backTo="/app/dashboard" rightAction="simulate" />}

      <main
        className={`max-w-screen-2xl mx-auto pb-6 md:pb-8 ${
          isDashboard
            ? 'pt-0'
            : isTrip
            ? 'px-4 sm:px-6 md:px-8 pt-16'
            : 'px-4 sm:px-6 md:px-8 pt-16'
        }`}
      >
        <Suspense fallback={<RouteSpinner />}>
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname} variant="nested">
              <Routes location={location}>
                <Route path="dashboard" element={<TripDashboard />} />
                <Route path="trip/:tripId" element={<TripRouteWrapper />} />
                <Route path="dashboard/:tripId" element={<TripRouteWrapper />} />
                <Route path="import" element={<ImportView />} />
                <Route path="recovery" element={<RecoveryView />} />
                <Route path="profile" element={<ProfilePanel />} />
                <Route path="twin/:tripId" element={<DigitalTwinView />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </PageTransition>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root App — owns all shared state, provides context, defines top-level routes
// ---------------------------------------------------------------------------
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth state
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Imported itineraries: starts from local storage, updated on cloud sync
  const [importedItins, setImportedItins] = useState<Itinerary[]>(() =>
    localTripStorage.getAllTrips()
  );

  const [selectedItinerary, setSelectedItineraryState] = useState<Itinerary | null>(null);

  // ---------------------------------------------------------------------------
  // DUAL-DISRUPTION STATE
  // ---------------------------------------------------------------------------
  const [activeDisruptions, setActiveDisruptions] = useState<Disruption[]>([]);
  const [recoveryTargetDisruption, setRecoveryTargetDisruptionState] = useState<Disruption | null>(null);

  const [showRecoveryOptions, setShowRecoveryOptionsState] = useState<boolean>(false);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);

  const isSeedTrip = useCallback((id: string) => SEED_IDS.has(id), []);

  const updateDisplayName = useCallback((name: string) => {
    setCurrentUser((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const extractUser = useCallback((user: { id: string; email?: string; user_metadata?: Record<string, any> }): AppUser => {
    const metadataName =
      (user.user_metadata?.display_name as string) ||
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) || '';
    const name = metadataName && metadataName.trim()
      ? metadataName.trim()
      : formatUserName({ email: user.email });
    return {
      id: user.id,
      email: user.email || '',
      name,
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Supabase Auth State Tracking & Cloud Trips Sync
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    // 1. Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(extractUser(session.user));
        try {
          const trips = await cloudTripStorage.getAllTrips();
          setImportedItins(trips);
        } catch (err) {
          console.warn('[App] Failed to load cloud trips on session init:', err);
        }
      } else {
        setCurrentUser(null);
        setImportedItins(localTripStorage.getAllTrips());
      }
      setIsAuthLoading(false);
    });

    // 2. Auth state subscription (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setCurrentUser(extractUser(session.user));
          try {
            const trips = await cloudTripStorage.getAllTrips();
            setImportedItins(trips);
          } catch (err) {
            console.warn('[App] Failed to load cloud trips on auth change:', err);
          }
        } else {
          setCurrentUser(null);
          // Switched to guest mode: load local trips
          setImportedItins(localTripStorage.getAllTrips());
        }
        setIsAuthLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [extractUser]);

  const openAuthModal = useCallback(
    (mode?: 'signin' | 'signup') => {
      navigate(mode === 'signup' ? '/login?mode=signup' : '/login');
    },
    [navigate]
  );
  const clearStorageError = useCallback(() => setStorageError(null), []);

  const signOut = useCallback(async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[App] Sign out error:', err);
      }
    }
    setCurrentUser(null);
    setImportedItins(localTripStorage.getAllTrips());
    setSelectedItineraryState(null);
    setActiveDisruptions([]);
    setRecoveryTargetDisruptionState(null);
    setShowRecoveryOptionsState(false);
    navigate('/app/dashboard');
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Computed: activeDisruption (singular alias — RecoveryView backward-compat)
  // ---------------------------------------------------------------------------
  const activeDisruption: Disruption | null = useMemo(() => {
    if (recoveryTargetDisruption) return recoveryTargetDisruption;
    return activeDisruptions[0] ?? null;
  }, [activeDisruptions, recoveryTargetDisruption]);

  // ---------------------------------------------------------------------------
  // Computed: impactedBookings — via detectCombinedImpact
  // ---------------------------------------------------------------------------
  const impactedBookings = useMemo<ImpactedBooking[]>(() => {
    if (activeDisruptions.length === 0 || !selectedItinerary) return [];
    try {
      return detectCombinedImpact(selectedItinerary, activeDisruptions);
    } catch (err) {
      console.error('Impact detection error:', err);
      return [];
    }
  }, [selectedItinerary, activeDisruptions]);

  const setShowRecoveryOptions = useCallback((show: boolean) => {
    setShowRecoveryOptionsState(show);
    if (show) {
      navigate('/app/recovery');
    } else {
      if (selectedItinerary) {
        navigate(`/app/trip/${selectedItinerary.id}`);
      } else {
        navigate('/app/dashboard');
      }
    }
  }, [navigate, selectedItinerary]);

  // ---------------------------------------------------------------------------
  // Disruption management
  // ---------------------------------------------------------------------------
  const hasCapacityForAnotherDisruption = useCallback(
    () => activeDisruptions.length < 3,
    [activeDisruptions]
  );

  const addDisruption = useCallback((d: Disruption) => {
    setActiveDisruptions((prev) => {
      if (prev.length >= 3) return prev;
      if (prev.some((x) => x.bookingId === d.bookingId)) {
        return prev.map((x) => (x.bookingId === d.bookingId ? d : x));
      }
      return [...prev, d];
    });
  }, []);

  const removeDisruption = useCallback((bookingId: string) => {
    setActiveDisruptions((prev) => prev.filter((d) => d.bookingId !== bookingId));
    setRecoveryTargetDisruptionState((prev) =>
      prev?.bookingId === bookingId ? null : prev
    );
  }, []);

  const clearAllDisruptions = useCallback(() => {
    setActiveDisruptions([]);
    setRecoveryTargetDisruptionState(null);
    setShowRecoveryOptionsState(false);
    if (selectedItinerary) {
      navigate(`/app/trip/${selectedItinerary.id}`);
    } else {
      navigate('/app/dashboard');
    }
  }, [navigate, selectedItinerary]);

  const clearDisruption = clearAllDisruptions;

  const setRecoveryTargetDisruption = useCallback((d: Disruption | null) => {
    setRecoveryTargetDisruptionState(d);
  }, []);

  // ---------------------------------------------------------------------------
  // Trip management
  // ---------------------------------------------------------------------------
  const setSelectedItinerary = useCallback((it: Itinerary) => {
    setSelectedItineraryState((prev) => {
      if (prev?.id !== it.id) {
        setActiveDisruptions([]);
        setRecoveryTargetDisruptionState(null);
        setShowRecoveryOptionsState(false);
      }
      return it;
    });
    setRecoverySuccessMessage(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (!SEED_IDS.has(it.id)) {
      if (currentUser) {
        cloudTripStorage.touchTrip(it.id).catch((err) => {
          console.warn('[App] Failed to touch trip in cloud:', err);
        });
      } else {
        localTripStorage.touchTrip(it.id);
      }
    }
    navigate(`/app/trip/${it.id}`);
  }, [currentUser, navigate]);

  const applyWeatherDisruptionToItinerary = useCallback(
    (
      targetItinerary: Itinerary,
      disruptions: Disruption | Disruption[],
      openRecovery: boolean = true
    ) => {
      const disruptionList = Array.isArray(disruptions) ? disruptions : [disruptions];
      if (disruptionList.length === 0) return;

      setSelectedItineraryState(targetItinerary);
      setActiveDisruptions(disruptionList);
      setRecoveryTargetDisruptionState(disruptionList[0]);
      setShowRecoveryOptionsState(openRecovery);
      setRecoverySuccessMessage(null);

      if (openRecovery) {
        navigate('/app/recovery');
      } else {
        navigate(`/app/trip/${targetItinerary.id}`);
      }
    },
    [navigate]
  );

  const clearSelectedItinerary = useCallback(() => {
    setSelectedItineraryState(null);
    setActiveDisruptions([]);
    setRecoveryTargetDisruptionState(null);
    setShowRecoveryOptionsState(false);
    setRecoverySuccessMessage(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    navigate('/app/dashboard');
  }, [navigate]);

  const applyRecovery = useCallback((option: ScoredRecoveryOption) => {
    if (!selectedItinerary) return;
    const recovered = applyRecoveryOption(selectedItinerary, option);
    setSelectedItineraryState(recovered);

    // Persist recovered state only for imported trips, not seeds
    if (!SEED_IDS.has(selectedItinerary.id)) {
      setImportedItins((prev) =>
        prev.map((it) => (it.id === recovered.id ? recovered : it))
      );

      if (currentUser) {
        cloudTripStorage.saveTrip(recovered).catch((err) => {
          console.warn('[App] Failed to save recovery to cloud:', err);
          setStorageError("Couldn't save updated trip to your account. Your changes remain active locally.");
        });
      } else {
        localTripStorage.saveTrip(recovered);
      }
    }

    // Remove only the disruption we just resolved
    const resolvedBookingId = option.affectedBookingId;
    setActiveDisruptions((prev) => prev.filter((d) => d.bookingId !== resolvedBookingId));
    setRecoveryTargetDisruptionState(null);
    setShowRecoveryOptionsState(false);
    setRecoverySuccessMessage(
      `Recovery applied: ${option.description}. ${option.costDelta > 0
        ? `₹${option.costDelta.toLocaleString('en-IN')} extra cost.`
        : option.costDelta < 0
          ? `₹${Math.abs(option.costDelta).toLocaleString('en-IN')} saved.`
          : 'No additional cost.'
      } Affected booking is now recovered.`
    );
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    navigate(`/app/trip/${recovered.id}`);
  }, [selectedItinerary, currentUser, navigate]);

  const clearRecoverySuccess = useCallback(() => {
    setRecoverySuccessMessage(null);
  }, []);

  /**
   * Confirm an imported itinerary from the ImportView.
   * Saves to Supabase if logged in, or localStorage if guest.
   */
  const addImportedItinerary = useCallback(async (it: Itinerary) => {
    // Generate clean, readable trip ID (e.g. trip-goa-7f2a) if not already formatted
    const tripId = it.id && it.id.startsWith('trip-')
      ? it.id
      : localTripStorage.createTripId(it.destination);
    const normalizedItinerary: Itinerary = { ...it, id: tripId };

    // Update in-memory state immediately so UI is responsive
    setImportedItins((prev) => {
      const deduped = prev.filter((p) => p.id !== normalizedItinerary.id);
      return [normalizedItinerary, ...deduped];
    });
    setSelectedItineraryState(normalizedItinerary);
    setActiveDisruptions([]);
    setRecoveryTargetDisruptionState(null);
    setShowRecoveryOptionsState(false);
    setRecoverySuccessMessage(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    navigate(`/app/trip/${normalizedItinerary.id}`);

    if (currentUser) {
      try {
        await cloudTripStorage.saveTrip(normalizedItinerary);
        setStorageError(null);
      } catch (err) {
        console.error('[App] Failed to save trip to Supabase:', err);
        // Error handling requirement: NEVER crash or lose state
        setStorageError("Couldn't save to your account, try again. Trip is kept in memory.");
        localTripStorage.saveTrip(normalizedItinerary);
      }
    } else {
      localTripStorage.saveTrip(normalizedItinerary);
    }
  }, [currentUser, navigate]);

  /**
   * Delete an imported trip from storage and React state.
   */
  const removeImportedItinerary = useCallback(async (id: string) => {
    setImportedItins((prev) => prev.filter((it) => it.id !== id));
    if (selectedItinerary?.id === id) {
      setSelectedItineraryState(null);
      setActiveDisruptions([]);
      setRecoveryTargetDisruptionState(null);
      setShowRecoveryOptionsState(false);
      setRecoverySuccessMessage(null);
      navigate('/app/dashboard');
    }

    if (currentUser) {
      try {
        await cloudTripStorage.deleteTrip(id);
      } catch (err) {
        console.error('[App] Failed to delete trip from Supabase:', err);
        setStorageError("Couldn't delete trip from your account. Please try again.");
      }
    } else {
      localTripStorage.deleteTrip(id);
    }
  }, [currentUser, selectedItinerary, navigate]);

  return (
    <>
    {<CustomCursor />}
    <AppContext.Provider
      value={{
        currentUser,
        updateDisplayName,
        isAuthLoading,
        openAuthModal,
        signOut,
        storageError,
        clearStorageError,
        importedItineraries: importedItins,
        selectedItinerary,
        setSelectedItinerary,
        clearSelectedItinerary,
        activeDisruptions,
        activeDisruption,
        addDisruption,
        removeDisruption,
        clearAllDisruptions,
        hasCapacityForAnotherDisruption,
        setRecoveryTargetDisruption,
        impactedBookings,
        showRecoveryOptions,
        setShowRecoveryOptions,
        clearDisruption,
        applyRecovery,
        recoverySuccessMessage,
        clearRecoverySuccess,
        applyWeatherDisruptionToItinerary,
        addImportedItinerary,
        removeImportedItinerary,
        isSeedTrip,
      }}
    >
      <Suspense fallback={<RouteSpinner />}>
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition
            key={pageScope(location.pathname)}
            variant={location.pathname === '/login' ? 'login' : 'page'}
          >
            <Routes location={location}>
              <Route
                path="/"
                element={
                  <LandingPage
                    onLaunch={() => navigate('/app/dashboard')}
                    onOpenAuth={openAuthModal}
                    currentUser={currentUser}
                    onSignOut={signOut}
                  />
                }
              />

              <Route
                path="/login"
                element={
                  isAuthLoading ? (
                    <div
                      className="min-h-screen flex items-center justify-center"
                      style={{ backgroundColor: 'var(--color-bg-base)' }}
                    >
                      <div
                        className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: 'var(--color-confirmed)', borderTopColor: 'transparent' }}
                      />
                    </div>
                  ) : currentUser ? (
                    <Navigate to="/app/dashboard" replace />
                  ) : (
                    <LoginPage
                      onAuthSuccess={async (email) => {
                        if (supabase) {
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.user) {
                              setCurrentUser(extractUser(session.user));
                              const cloudTrips = await cloudTripStorage.getAllTrips();
                              setImportedItins(cloudTrips);
                            } else {
                              setCurrentUser({ id: 'temp', email, name: formatUserName({ email }) });
                            }
                          } catch (err) {
                            console.warn('[App] Error syncing session on login:', err);
                          }
                        }
                        navigate('/app/dashboard');
                      }}
                    />
                  )
                }
              />

              <Route path="/app/*" element={<DashboardLayout />} />
              <Route path="/share/:shareToken" element={<SharedTripView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PageTransition>
        </AnimatePresence>
      </Suspense>

    </AppContext.Provider>
    </>
  );
}
