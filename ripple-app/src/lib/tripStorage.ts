// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: tripStorage.ts
// PURPOSE: localStorage-backed persistence for user-imported itineraries.
//
// ⚠️  HACKATHON NOTE: localStorage is intentionally used here for zero-infra,
//     zero-backend demo persistence. This is NOT a production pattern.
//     In production: replace with a proper backend API + sync layer (e.g. Firestore,
//     Supabase, or a simple REST service with auth). localStorage has a ~5MB quota,
//     no cross-device sync, and is wiped by private browsing / clearing browser data.
//
// Design decisions:
//   - Seed itineraries (Goa Getaway, Rajasthan Rail Trip) are NEVER stored here.
//     They are always hardcoded in seedData.ts and reset on page reload.
//   - Each trip is stored with a thin TripRecord wrapper: { itinerary, savedAt,
//     lastOpenedAt }. The Itinerary type itself is NOT modified.
//   - All localStorage access is wrapped in try/catch. Failures are logged to
//     console and silently ignored — the app never crashes due to storage issues.
// =============================================================================

import type { Itinerary } from "./types";

// ---------------------------------------------------------------------------
// Storage schema
// ---------------------------------------------------------------------------

/** Key under which all planB trips are stored in localStorage. */
const STORAGE_KEY = "planb_trips_v1";

/**
 * Thin metadata wrapper around each stored itinerary.
 * The Itinerary object itself is stored unmodified.
 */
interface TripRecord {
  itinerary: Itinerary;
  /** ISO 8601 string: when this trip was first saved (or last overwritten). */
  savedAt: string;
  /** ISO 8601 string: when this trip was most recently opened/viewed. */
  lastOpenedAt: string;
}

/** The shape of the root object stored under STORAGE_KEY. */
type TripStore = Record<string, TripRecord>;

/**
 * Generate a friendly, clean, unique ID for a trip (e.g. "trip-goa-7f2a").
 */
export function createTripId(destination?: string): string {
  const cleanDest = destination
    ? destination
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 18)
    : '';
  const rand = Math.random().toString(36).substring(2, 6);
  return cleanDest ? `trip-${cleanDest}-${rand}` : `trip-${Date.now().toString(36)}-${rand}`;
}

// ---------------------------------------------------------------------------
// Internal helpers — never throw
// ---------------------------------------------------------------------------

/** Read the full store from localStorage. Returns empty object on any error. */
function readStore(): TripStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TripStore;
  } catch (err) {
    console.warn("[tripStorage] Failed to read store:", err);
    return {};
  }
}

/** Write the full store to localStorage. Silently fails on quota / private mode. */
function writeStore(store: TripStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn("[tripStorage] Failed to write store:", err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save (or update) a trip in localStorage.
 * - If this is a new trip: sets both savedAt and lastOpenedAt to now.
 * - If this is an update to an existing trip: preserves the original savedAt,
 *   updates lastOpenedAt to now.
 */
export function saveTrip(itinerary: Itinerary): void {
  try {
    const store = readStore();
    const now = new Date().toISOString();
    const existing = store[itinerary.id];
    store[itinerary.id] = {
      itinerary,
      savedAt: existing?.savedAt ?? now,
      lastOpenedAt: now,
    };
    writeStore(store);
  } catch (err) {
    console.warn("[tripStorage] saveTrip failed:", err);
  }
}

/**
 * Returns all saved (user-imported) trips, sorted by lastOpenedAt descending
 * (most recently opened first).
 * Never throws — returns [] on any error.
 */
export function getAllTrips(): Itinerary[] {
  try {
    const store = readStore();
    return Object.values(store)
      .sort(
        (a, b) =>
          new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
      )
      .map((record) => record.itinerary);
  } catch (err) {
    console.warn("[tripStorage] getAllTrips failed:", err);
    return [];
  }
}

/**
 * Retrieve a single trip by ID.
 * Returns null if not found or on any error.
 */
export function getTrip(id: string): Itinerary | null {
  try {
    const store = readStore();
    return store[id]?.itinerary ?? null;
  } catch (err) {
    console.warn("[tripStorage] getTrip failed:", err);
    return null;
  }
}

/**
 * Delete a trip by ID.
 * No-op (and no error) if the trip doesn't exist.
 */
export function deleteTrip(id: string): void {
  try {
    const store = readStore();
    if (id in store) {
      delete store[id];
      writeStore(store);
    }
  } catch (err) {
    console.warn("[tripStorage] deleteTrip failed:", err);
  }
}

/**
 * Update the lastOpenedAt timestamp for a trip without modifying the itinerary.
 * Used when a trip card is tapped/opened in the dashboard.
 * No-op if the trip doesn't exist.
 */
export function touchTrip(id: string): void {
  try {
    const store = readStore();
    if (store[id]) {
      store[id] = { ...store[id], lastOpenedAt: new Date().toISOString() };
      writeStore(store);
    }
  } catch (err) {
    console.warn("[tripStorage] touchTrip failed:", err);
  }
}

/**
 * Returns the lastOpenedAt ISO string for a trip, or null if not stored.
 * Used by the dashboard to display "last viewed X ago" metadata.
 */
export function getLastOpened(id: string): string | null {
  try {
    const store = readStore();
    return store[id]?.lastOpenedAt ?? null;
  } catch (err) {
    console.warn("[tripStorage] getLastOpened failed:", err);
    return null;
  }
}

/**
 * Clear all trips from localStorage.
 */
export function clearAllTrips(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[tripStorage] clearAllTrips failed:", err);
  }
}

