// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: seedData.ts
// PURPOSE: Hardcoded seed itineraries for demo purposes.
//   These are ALWAYS shown in the dashboard, pinned at the top.
//   They are NEVER saved to localStorage — their state resets on every reload,
//   which is intentional: it makes the demo reliably repeatable.
//
//   SEED_IDS is the single source of truth for the seed/imported distinction.
//   Any code that needs to know "is this a seed trip?" checks SEED_IDS.has(id).
// =============================================================================

import type { Itinerary } from "./types";

// ---------------------------------------------------------------------------
// Seed itinerary A — Goa Getaway (Dec 2024)
// A family beach holiday with tight airport transfer buffer — ideal for
// demonstrating the risk engine with a flight delay disruption.
// ---------------------------------------------------------------------------
export const goaGetaway: Itinerary = {
  id: "seed-goa-2024",
  travelerName: "Arjun Mehta",
  destination: "Goa, India",
  startDate: "2024-12-15",
  endDate: "2024-12-20",
  bookings: [
    {
      id: "goa-flight-del-goi",
      type: "flight",
      title: "IndiGo 6E-301 DEL → GOI",
      provider: "IndiGo Airlines",
      startTime: "2024-12-15T06:30:00+05:30",
      endTime: "2024-12-15T09:00:00+05:30",
      location: { type: "coordinates", lat: 28.5562, lng: 77.1000, label: "Indira Gandhi International Airport (DEL)" },
      dependsOn: [],
      bufferMinutes: 0,
      cost: 8200,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 },
      status: "confirmed",
      meta: { flightNumber: "6E-301", seat: "14A", class: "Economy", destinationIata: "GOI" },
    },
    {
      id: "goa-transfer-airport-hotel",
      type: "transfer",
      title: "Airport → Taj Holiday Village (Private Cab)",
      provider: "Goa Cabs Co.",
      startTime: "2024-12-15T09:45:00+05:30",
      endTime: "2024-12-15T10:45:00+05:30",
      location: { type: "coordinates", lat: 15.3808, lng: 73.8314, label: "Goa International Airport (GOI)" },
      dependsOn: ["goa-flight-del-goi"],
      bufferMinutes: 30,
      cost: 1200,
      cancellationPolicy: { policy: "free", cutoffHours: 2 },
      status: "confirmed",
      meta: { vehicleType: "Sedan", driverContact: "+91-9876543210", destinationCoords: [15.4785, 73.7765] },
    },
    {
      id: "goa-hotel-taj",
      type: "hotel",
      title: "Taj Holiday Village Resort & Spa",
      provider: "Taj Hotels",
      startTime: "2024-12-15T14:00:00+05:30",
      endTime: "2024-12-20T11:00:00+05:30",
      location: { type: "coordinates", lat: 15.4785, lng: 73.7765, label: "Sinquerim, Candolim, North Goa" },
      dependsOn: ["goa-transfer-airport-hotel"],
      bufferMinutes: 15,
      cost: 42000,
      cancellationPolicy: { policy: "non-refundable" },
      status: "confirmed",
      meta: { roomType: "Deluxe Pool View", nights: 5, checkIn: "14:00", checkOut: "11:00" },
    },
    {
      id: "goa-activity-scuba",
      type: "activity",
      title: "Scuba Diving — Sail Rock (Half Day)",
      provider: "Barracuda Diving",
      startTime: "2024-12-17T08:00:00+05:30",
      endTime: "2024-12-17T13:00:00+05:30",
      location: { type: "coordinates", lat: 15.3544, lng: 73.6876, label: "Grand Island, South Goa" },
      dependsOn: ["goa-hotel-taj"],
      bufferMinutes: 0,
      cost: 4500,
      cancellationPolicy: { policy: "free", cutoffHours: 24 },
      status: "confirmed",
      meta: { groupSize: 2, includes: "Equipment, boat transfer, dive master" },
    },
    {
      id: "goa-flight-goi-del-return",
      type: "flight",
      title: "IndiGo 6E-304 GOI → DEL",
      provider: "IndiGo Airlines",
      startTime: "2024-12-20T13:30:00+05:30",
      endTime: "2024-12-20T16:00:00+05:30",
      location: { type: "coordinates", lat: 15.3808, lng: 73.8314, label: "Goa International Airport (GOI)" },
      dependsOn: ["goa-hotel-taj"],
      bufferMinutes: 150,
      cost: 7600,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 },
      status: "confirmed",
      meta: { flightNumber: "6E-304", seat: "22C", class: "Economy", destinationIata: "DEL" },
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed itinerary B — Rajasthan Rail Trip (Jan 2025)
// A heritage rail journey with cascading dependencies — excellent for
// demonstrating chain-reaction disruption when a train is delayed.
// ---------------------------------------------------------------------------
export const rajasthanRailTrip: Itinerary = {
  id: "seed-rajasthan-2025",
  travelerName: "Priya Nair",
  destination: "Rajasthan, India",
  startDate: "2025-01-10",
  endDate: "2025-01-17",
  bookings: [
    {
      id: "raj-flight-bom-del",
      type: "flight",
      title: "Air India AI-865 BOM → DEL",
      provider: "Air India",
      startTime: "2025-01-10T07:15:00+05:30",
      endTime: "2025-01-10T09:20:00+05:30",
      location: { type: "coordinates", lat: 19.0896, lng: 72.8656, label: "Chhatrapati Shivaji Maharaj International Airport (BOM)" },
      dependsOn: [],
      bufferMinutes: 0,
      cost: 6800,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 48, refundPercent: 60 },
      status: "confirmed",
      meta: { flightNumber: "AI-865", seat: "8F", class: "Economy Plus", destinationIata: "DEL" },
    },
    {
      id: "raj-train-del-jpr",
      type: "train",
      title: "Shatabdi Express 12015 DEL → JPR",
      provider: "Indian Railways",
      startTime: "2025-01-10T14:00:00+05:30",
      endTime: "2025-01-10T19:15:00+05:30",
      location: { type: "coordinates", lat: 28.6431, lng: 77.2194, label: "New Delhi Railway Station (NDLS)" },
      dependsOn: ["raj-flight-bom-del"],
      bufferMinutes: 90,
      cost: 2400,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 },
      status: "confirmed",
      meta: { trainNumber: "12015", coach: "CC", pnr: "2451876309" },
    },
    {
      id: "raj-hotel-jpr-rambagh",
      type: "hotel",
      title: "Rambagh Palace, Jaipur",
      provider: "Taj Hotels",
      startTime: "2025-01-10T21:00:00+05:30",
      endTime: "2025-01-13T11:00:00+05:30",
      location: { type: "coordinates", lat: 26.8726, lng: 75.8235, label: "Bhawani Singh Rd, Jaipur" },
      dependsOn: ["raj-train-del-jpr"],
      bufferMinutes: 45,
      cost: 78000,
      cancellationPolicy: { policy: "non-refundable" },
      status: "confirmed",
      meta: { roomType: "Luxury Room", nights: 3 },
    },
    {
      id: "raj-activity-amber-fort",
      type: "activity",
      title: "Amber Fort Heritage Tour (Half Day)",
      provider: "Royal Rajasthan Tours",
      startTime: "2025-01-11T08:00:00+05:30",
      endTime: "2025-01-11T13:00:00+05:30",
      location: { type: "coordinates", lat: 26.9855, lng: 75.8513, label: "Amber Fort, Jaipur" },
      dependsOn: ["raj-hotel-jpr-rambagh"],
      bufferMinutes: 0,
      cost: 3200,
      cancellationPolicy: { policy: "free", cutoffHours: 12 },
      status: "confirmed",
    },
    {
      id: "raj-train-jpr-jsl",
      type: "train",
      title: "Mandor Express 14659 JPR → JSL",
      provider: "Indian Railways",
      startTime: "2025-01-13T15:00:00+05:30",
      endTime: "2025-01-13T22:30:00+05:30",
      location: { type: "coordinates", lat: 26.9194, lng: 75.7871, label: "Jaipur Junction (JP)" },
      dependsOn: ["raj-hotel-jpr-rambagh"],
      bufferMinutes: 60,
      cost: 1800,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 },
      status: "confirmed",
      meta: { trainNumber: "14659", coach: "3A", pnr: "3872410923" },
    },
    {
      id: "raj-hotel-jsl-suryagarh",
      type: "hotel",
      title: "Suryagarh Palace, Jaisalmer",
      provider: "Suryagarh",
      startTime: "2025-01-13T23:30:00+05:30",
      endTime: "2025-01-17T10:00:00+05:30",
      location: { type: "coordinates", lat: 26.8899, lng: 70.8688, label: "Sam Road, Jaisalmer" },
      dependsOn: ["raj-train-jpr-jsl"],
      bufferMinutes: 30,
      cost: 64000,
      cancellationPolicy: { policy: "non-refundable" },
      status: "confirmed",
      meta: { roomType: "Dune View Suite", nights: 4 },
    },
    {
      id: "raj-activity-desert-camp",
      type: "activity",
      title: "Sam Sand Dunes Desert Camp & Camel Safari",
      provider: "Desert Camp Jaisalmer",
      startTime: "2025-01-15T16:00:00+05:30",
      endTime: "2025-01-16T08:00:00+05:30",
      location: { type: "coordinates", lat: 26.8483, lng: 70.5631, label: "Sam Sand Dunes, Jaisalmer" },
      dependsOn: ["raj-hotel-jsl-suryagarh"],
      bufferMinutes: 0,
      cost: 8500,
      cancellationPolicy: { policy: "free", cutoffHours: 48 },
      status: "confirmed",
    },
    {
      id: "raj-flight-jsl-bom-return",
      type: "flight",
      title: "IndiGo 6E-7315 JSL → BOM",
      provider: "IndiGo Airlines",
      startTime: "2025-01-17T12:30:00+05:30",
      endTime: "2025-01-17T14:45:00+05:30",
      location: { type: "coordinates", lat: 26.8887, lng: 70.8649, label: "Jaisalmer Airport (JSA)" },
      dependsOn: ["raj-hotel-jsl-suryagarh"],
      bufferMinutes: 120,
      cost: 9200,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 },
      status: "confirmed",
      meta: { flightNumber: "6E-7315", seat: "5B", class: "Economy", destinationIata: "BOM" },
    },
  ],
};

// ---------------------------------------------------------------------------
// Exports used by the dashboard and persistence layer
// ---------------------------------------------------------------------------
// Seed itinerary C — Goa Trip (Saumitra Matta, Nov 2025)
// Exact match for trip-goa-india-tyqz with flight, transfer, resort, yacht, return flight
// ---------------------------------------------------------------------------
export const goaSaumitraTrip: Itinerary = {
  id: "trip-goa-india-tyqz",
  travelerName: "Saumitra Matta",
  destination: "Goa, India",
  startDate: "2025-11-14",
  endDate: "2025-11-17",
  bookings: [
    {
      id: "bkg-flight-1",
      type: "flight",
      title: "Flight to Goa",
      provider: "IndiGo 6E-5124 · DEL ➔ GOI",
      startTime: "2025-11-14T06:15:00+05:30",
      endTime: "2025-11-14T08:50:00+05:30",
      location: { type: "coordinates", lat: 28.5562, lng: 77.1000, label: "Indira Gandhi International Airport (DEL)" },
      dependsOn: [],
      bufferMinutes: 0,
      cost: 5450,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 },
      status: "confirmed",
      meta: {
        flightNumber: "6E-5124",
        seat: "14F",
        class: "Economy",
        route: "DEL ➔ GOI",
        destinationIata: "GOI",
        destinationCoords: [15.3808, 73.8314],
        terminal: "Terminal 3 ➔ Terminal 1",
        tags: ["15 kg check-in", "7 kg cabin", "Partial refund (₹2,500 fee)"],
        subtitle: "IndiGo 6E-5124 · DEL ➔ GOI",
        rightSubtext: "Economy · Seat 14F",
      },
    },
    {
      id: "bkg-transfer-1",
      type: "transfer",
      title: "Airport Transfer",
      provider: "Goa Miles Executive Transfers · GM-TX-88219",
      startTime: "2025-11-14T09:30:00+05:30",
      endTime: "2025-11-14T10:45:00+05:30",
      location: { type: "coordinates", lat: 15.3808, lng: 73.8314, label: "Dabolim Airport (GOI)" },
      dependsOn: ["bkg-flight-1"],
      bufferMinutes: 45,
      cost: 1850,
      cancellationPolicy: { policy: "free", cutoffHours: 6 },
      status: "at-risk",
      meta: {
        bookingId: "GM-TX-88219",
        vehicle: "Toyota Innova Crysta",
        route: "Dabolim Airport ➔ W Goa, Vagator",
        destinationCoords: [15.5975, 73.7380],
        tags: ["Prepaid", "Free cancellation (6h before)"],
        subtitle: "Goa Miles Executive Transfers · GM-TX-88219",
        rightSubtext: "Toyota Innova Crysta",
      },
    },
    {
      id: "bkg-hotel-1",
      type: "hotel",
      title: "W Goa Resort & Spa",
      provider: "MAR-9043210",
      startTime: "2025-11-14T14:00:00+05:30",
      endTime: "2025-11-17T11:00:00+05:30",
      location: { type: "coordinates", lat: 15.5975, lng: 73.7380, label: "Vagator Beach, Goa" },
      dependsOn: ["bkg-transfer-1"],
      bufferMinutes: 30,
      cost: 48600,
      cancellationPolicy: { policy: "free", cutoffHours: 48 },
      status: "confirmed",
      meta: {
        confirmation: "MAR-9043210",
        roomType: "Ocean View Suite",
        nights: 3,
        tags: ["Breakfast included", "Free cancellation (till 12 Nov)"],
        subtitle: "MAR-9043210",
        rightSubtext: "3 nights · Ocean View Suite",
        displayTime: "Check-in: Fri, 14 Nov, 2:00 PM · Check-out: Mon, 17 Nov, 11:00 AM · Vagator Beach, Goa",
      },
    },
    {
      id: "bkg-activity-1",
      type: "activity",
      title: "Sunset Yacht Cruise",
      provider: "Konkan Coastal Adventures · KCA-YACHT-410",
      startTime: "2025-11-15T16:30:00+05:30",
      endTime: "2025-11-15T19:00:00+05:30",
      location: { type: "coordinates", lat: 15.6042, lng: 73.7420, label: "Chapora River Jetty, Vagator" },
      dependsOn: ["bkg-hotel-1"],
      bufferMinutes: 60,
      cost: 7500,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 },
      status: "confirmed",
      meta: {
        bookingId: "KCA-YACHT-410",
        charter: "Private Charter (1 Guest)",
        tags: ["Dolphin sighting", "50% refund (24h prior)"],
        subtitle: "Konkan Coastal Adventures · KCA-YACHT-410",
        rightSubtext: "Private Charter (1 Guest)",
      },
    },
    {
      id: "bkg-flight-2",
      type: "flight",
      title: "Return Flight",
      provider: "Air India AI-842 · GOI ➔ DEL",
      startTime: "2025-11-17T18:30:00+05:30",
      endTime: "2025-11-17T21:10:00+05:30",
      location: { type: "coordinates", lat: 15.3808, lng: 73.8314, label: "Dabolim Airport (GOI)" },
      dependsOn: ["bkg-hotel-1"],
      bufferMinutes: 120,
      cost: 6920,
      cancellationPolicy: { policy: "free", cutoffHours: 24 },
      status: "confirmed",
      meta: {
        flightNumber: "AI-842",
        seat: "12C",
        class: "Economy Flex",
        route: "GOI ➔ DEL",
        destinationIata: "DEL",
        destinationCoords: [28.5562, 77.1000],
        terminal: "Terminal 1 ➔ Terminal 3",
        tags: ["Free cancellation (24h prior)"],
        subtitle: "Air India AI-842 · GOI ➔ DEL",
        rightSubtext: "Economy Flex · Seat 12C",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Exports used by the dashboard and persistence layer
// ---------------------------------------------------------------------------

/** Ordered array of seed itineraries — always shown pinned in the dashboard. */
export const SEED_ITINERARIES: Itinerary[] = [goaSaumitraTrip, goaGetaway, rajasthanRailTrip];

/**
 * Set of seed itinerary IDs.
 * Use `SEED_IDS.has(id)` anywhere you need to distinguish seed vs. imported trips.
 * This is the single source of truth for that distinction.
 */
export const SEED_IDS: ReadonlySet<string> = new Set(
  SEED_ITINERARIES.map((it) => it.id)
);

// Legacy exports kept for any code that may import them directly
export const itineraryA = goaGetaway;
export const itineraryB = rajasthanRailTrip;
export const seedItineraries: Record<string, Itinerary> = {
  [goaSaumitraTrip.id]: goaSaumitraTrip,
  [goaGetaway.id]: goaGetaway,
  [rajasthanRailTrip.id]: rajasthanRailTrip,
};

