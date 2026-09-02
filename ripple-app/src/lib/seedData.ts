// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: seedData.ts
// PURPOSE: Exports an empty itinerary list by default.
//   Users import their own trips via the Import PNR flow.
//   The sampleItinerary below is only used as a preset in the import UI.
// =============================================================================

import type { Itinerary } from "./types";

// No seed itineraries pre-loaded — app starts empty.
// Users bring their own trips via the import engine.
export const itineraryA: Itinerary | null = null;
export const itineraryB: Itinerary | null = null;

export const seedItineraries: Record<string, Itinerary> = {};
