// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: seedData.ts
// PURPOSE: Two realistic sample itineraries for development and demo use.
//
// ITINERARY A — "Goa Getaway" (Delhi → Goa → Delhi)
//   The DEMO itinerary. Deliberately includes a tight 45-min buffer between
//   the flight landing and the hotel transfer, so a 3-hour flight delay
//   creates a dramatic cascade of broken bookings — perfect for judges.
//
// ITINERARY B — "Rajasthan Rail Trip" (Mumbai → Jaipur → Jodhpur → Mumbai)
//   A train-based trip with activities, showing variety and different
//   dependency patterns.
// =============================================================================

import type { Itinerary, Booking } from "./types";

// ---------------------------------------------------------------------------
// HELPER: building ISO datetime strings inline without a library.
// Format: "YYYY-MM-DDTHH:mm:00+05:30" (IST)
// ---------------------------------------------------------------------------
function ist(date: string, time: string): string {
  return `${date}T${time}:00+05:30`;
}

// =============================================================================
// ITINERARY A — Goa Getaway
//
// DEPENDENCY GRAPH:
//
//  [flight_del_goi]
//        |
//        | (bufferMinutes: 45 — baggage + exit airport)  <-- TIGHT CONNECTION!
//        v
//  [transfer_airport_hotel]
//        |
//        | (bufferMinutes: 30 — check-in formalities)
//        v
//  [hotel_goa] ------> [activity_scuba]  (independent of transfer, depends on hotel)
//        |
//        | (bufferMinutes: 120 — get to airport + check-in + security)
//        v
//  [flight_goi_del]  (return flight)
//
// WHAT HAPPENS WITH A 3-HOUR DELAY:
//   - flight_del_goi lands 180 min late → actual gap to transfer = 45 - 180 = -135 min
//     → transfer is BROKEN (severity: broken, shortfall: 135 min)
//   - transfer now runs late → hotel check-in window missed
//     → hotel is AT RISK (severity: at-risk)
//   - scuba dive is a fixed-time slot next morning, depends on hotel check-in
//     → scuba is AT RISK (might miss early morning slot)
//   - return flight depends on hotel checkout — if hotel stay is disrupted, flag it too
// =============================================================================

export const itineraryA: Itinerary = {
  id: "itin-A-goa-2024",
  travelerName: "Arjun Mehta",
  destination: "Goa, India",
  startDate: "2024-12-15",
  endDate: "2024-12-18",
  bookings: [

    // -------------------------------------------------------------------------
    // BOOKING 1: Outbound Flight — Delhi (DEL) to Goa (GOI)
    // Scheduled: 06:30 → 09:00 (2h 30m flight)
    // This is the booking that will be disrupted in the demo.
    // -------------------------------------------------------------------------
    {
      id: "flight_del_goi",
      type: "flight",
      title: "IndiGo 6E-301 DEL → GOI",
      provider: "IndiGo",
      startTime: ist("2024-12-15", "06:30"),
      endTime:   ist("2024-12-15", "09:00"),
      location: { type: "named", name: "Indira Gandhi International Airport, Delhi" },
      dependsOn: [], // First booking — no dependencies
      bufferMinutes: 0,
      cost: 5800,
      cancellationPolicy: {
        policy: "partial-refund",
        cutoffHours: 24,
        refundPercent: 50,
      },
      status: "confirmed",
      meta: { flightNumber: "6E-301", airline: "IndiGo", seatClass: "Economy" },
    },

    // -------------------------------------------------------------------------
    // BOOKING 2: Airport Transfer — Goa Airport to Calangute Hotel
    // Scheduled: 09:45 → 10:30 (45 min drive)
    //
    // ⚠️  TIGHT CONNECTION: bufferMinutes = 45
    //   Gap between flight landing (09:00) and transfer pickup (09:45) = 45 min.
    //   Any delay > 0 minutes on the flight makes this stressful.
    //   A 3-hour delay makes this IMPOSSIBLE (flight now lands at 12:00,
    //   but transfer was at 09:45 — 135 minutes in the past).
    // -------------------------------------------------------------------------
    {
      id: "transfer_airport_hotel",
      type: "transfer",
      title: "Pre-booked Taxi: GOA Airport → Calangute Hotel",
      provider: "Goa Cabs (Ravi Taxi Service)",
      startTime: ist("2024-12-15", "09:45"),
      endTime:   ist("2024-12-15", "10:30"),
      location: { type: "named", name: "Goa International Airport, Dabolim" },
      dependsOn: ["flight_del_goi"],
      bufferMinutes: 45, // 45 min to collect bags + exit airport + find taxi
      cost: 900,
      cancellationPolicy: {
        policy: "non-refundable",
        cutoffHours: 2,
      },
      status: "confirmed",
      meta: { vehicleType: "Sedan", driverContact: "+91-9876543210" },
    },

    // -------------------------------------------------------------------------
    // BOOKING 3: Hotel — 3 nights in Calangute, Goa
    // Check-in: 12:00 on Dec 15 | Check-out: 12:00 on Dec 18
    // Depends on transfer arriving (buffer: 30 min for check-in formalities)
    // -------------------------------------------------------------------------
    {
      id: "hotel_goa",
      type: "hotel",
      title: "The Leela Goa — Deluxe Sea View Room",
      provider: "The Leela Hotels",
      startTime: ist("2024-12-15", "12:00"),
      endTime:   ist("2024-12-18", "12:00"),
      location: { type: "named", name: "Calangute, North Goa" },
      dependsOn: ["transfer_airport_hotel"],
      bufferMinutes: 30, // 30 min check-in formalities after arriving
      cost: 18000, // Total for 3 nights
      cancellationPolicy: {
        policy: "free",
        cutoffHours: 48,
      },
      status: "confirmed",
      meta: { roomType: "Deluxe Sea View", nights: 3, checkInWindow: "12:00–22:00" },
    },

    // -------------------------------------------------------------------------
    // BOOKING 4: Activity — Scuba Diving Tour (Fixed Time Slot!)
    // Dec 16, 07:00 – 10:00 (morning slot — must leave hotel by 06:30)
    // Depends on hotel check-in (need a place to store gear and sleep first)
    // Buffer: 60 min to get geared up and reach the dive site from hotel
    //
    // NOTE: This is a fixed, non-flexible time slot. If hotel check-in
    // is badly disrupted and they arrive late night, they may be too
    // exhausted / unprepared for a 07:00 dive.
    // -------------------------------------------------------------------------
    {
      id: "activity_scuba",
      type: "activity",
      title: "Scuba Diving Tour — Grand Island",
      provider: "Barracuda Diving, Goa",
      startTime: ist("2024-12-16", "07:00"),
      endTime:   ist("2024-12-16", "10:00"),
      location: { type: "named", name: "Grand Island, South Goa" },
      dependsOn: ["hotel_goa"],
      bufferMinutes: 60, // Need to be checked in and rested before an early dive
      cost: 2500,
      cancellationPolicy: {
        policy: "partial-refund",
        cutoffHours: 24,
        refundPercent: 25,
      },
      status: "confirmed",
      meta: { groupSize: 1, equipment: "provided", certificationRequired: false },
    },

    // -------------------------------------------------------------------------
    // BOOKING 5: Return Flight — Goa (GOI) to Delhi (DEL)
    // Scheduled: Dec 18, 15:00 → 17:30
    // Depends on hotel checkout (which is 12:00)
    // Buffer: 120 min to pack, reach airport, check-in, clear security
    // -------------------------------------------------------------------------
    {
      id: "flight_goi_del",
      type: "flight",
      title: "IndiGo 6E-502 GOI → DEL",
      provider: "IndiGo",
      startTime: ist("2024-12-18", "15:00"),
      endTime:   ist("2024-12-18", "17:30"),
      location: { type: "named", name: "Goa International Airport, Dabolim" },
      dependsOn: ["hotel_goa"],
      bufferMinutes: 120, // Pack + hotel to airport + check-in + security
      cost: 6200,
      cancellationPolicy: {
        policy: "partial-refund",
        cutoffHours: 24,
        refundPercent: 50,
      },
      status: "confirmed",
      meta: { flightNumber: "6E-502", airline: "IndiGo", seatClass: "Economy" },
    },

  ],
};

// =============================================================================
// ITINERARY B — Rajasthan Rail Explorer
//
// DEPENDENCY GRAPH:
//
//  [train_mumbai_jaipur]
//        |
//        | (bufferMinutes: 30)
//        v
//  [hotel_jaipur]
//        |
//        +---> [activity_amber_fort]  (depends on hotel, next morning)
//        |
//        +---> [train_jaipur_jodhpur]
//                    |
//                    | (bufferMinutes: 45)
//                    v
//              [hotel_jodhpur]
//                    |
//                    +---> [activity_mehrangarh]
//                    |
//                    +---> [train_jodhpur_mumbai]  (return)
// =============================================================================

export const itineraryB: Itinerary = {
  id: "itin-B-rajasthan-2024",
  travelerName: "Priya Sharma",
  destination: "Rajasthan, India",
  startDate: "2024-12-20",
  endDate: "2024-12-25",
  bookings: [

    // -------------------------------------------------------------------------
    // BOOKING 1: Train Mumbai → Jaipur
    // Rajdhani Express. Overnight train: departs 17:40, arrives 11:00 next day
    // -------------------------------------------------------------------------
    {
      id: "train_mumbai_jaipur",
      type: "train",
      title: "Rajdhani Express 12955 — Mumbai → Jaipur",
      provider: "Indian Railways",
      startTime: ist("2024-12-20", "17:40"),
      endTime:   ist("2024-12-21", "11:00"),
      location: { type: "named", name: "Mumbai Central Station" },
      dependsOn: [],
      bufferMinutes: 0,
      cost: 2800,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 48, refundPercent: 75 },
      status: "confirmed",
      meta: { trainNumber: "12955", class: "3A", pnr: "8721456123" },
    },

    // -------------------------------------------------------------------------
    // BOOKING 2: Hotel Jaipur — 2 nights
    // Check-in after train arrives (30 min to get there by rickshaw)
    // -------------------------------------------------------------------------
    {
      id: "hotel_jaipur",
      type: "hotel",
      title: "Rambagh Palace — Heritage Room",
      provider: "Taj Hotels",
      startTime: ist("2024-12-21", "12:00"),
      endTime:   ist("2024-12-23", "11:00"),
      location: { type: "named", name: "Bhawani Singh Rd, Jaipur" },
      dependsOn: ["train_mumbai_jaipur"],
      bufferMinutes: 30,
      cost: 22000,
      cancellationPolicy: { policy: "free", cutoffHours: 72 },
      status: "confirmed",
      meta: { nights: 2, checkInWindow: "12:00–22:00" },
    },

    // -------------------------------------------------------------------------
    // BOOKING 3: Activity — Amber Fort Guided Tour (9:00 AM sharp)
    // Fixed time slot on Dec 22 (day 2 of Jaipur stay).
    //
    // DEPENDENCY DESIGN NOTE:
    // This activity depends on train_mumbai_jaipur (not the hotel), because
    // the impact engine uses a booking's ENDTIME as the dependency reference.
    // Using hotel_jaipur.endTime (checkout: Dec 23 11:00) would make the
    // Dec 22 09:00 activity appear CRITICAL even without any disruption.
    // The real constraint: traveler must arrive in Jaipur AND rest overnight.
    //   train arrives Dec 21 11:00 + 1320 min (22h) = Dec 22 09:00 ✓
    // -------------------------------------------------------------------------
    {
      id: "activity_amber_fort",
      type: "activity",
      title: "Amber Fort Private Heritage Tour",
      provider: "Royal Rajasthan Tours",
      startTime: ist("2024-12-22", "09:00"),
      endTime:   ist("2024-12-22", "12:30"),
      location: { type: "named", name: "Amber Fort, Jaipur" },
      dependsOn: ["train_mumbai_jaipur"], // depends on arrival, not hotel checkout
      bufferMinutes: 1320, // 22 hours — must arrive day before and rest overnight
      cost: 3500,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 },
      status: "confirmed",
      meta: { groupType: "private", languages: ["English", "Hindi"] },
    },

    // -------------------------------------------------------------------------
    // BOOKING 4: Train Jaipur → Jodhpur
    // Departs Jaipur Dec 23 at 12:30. Hotel checkout is 11:00.
    // Buffer: 90 min (hotel to station + luggage)
    // -------------------------------------------------------------------------
    {
      id: "train_jaipur_jodhpur",
      type: "train",
      title: "Mandore Express 14853 — Jaipur → Jodhpur",
      provider: "Indian Railways",
      startTime: ist("2024-12-23", "12:30"),
      endTime:   ist("2024-12-23", "17:15"),
      location: { type: "named", name: "Jaipur Junction Railway Station" },
      dependsOn: ["hotel_jaipur"],
      bufferMinutes: 90, // Station is 20 min away; need buffer for luggage etc.
      cost: 650,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 48, refundPercent: 75 },
      status: "confirmed",
      meta: { trainNumber: "14853", class: "2A" },
    },

    // -------------------------------------------------------------------------
    // BOOKING 5: Hotel Jodhpur — 2 nights
    // Check-in after train arrives at 17:15. Buffer: 45 min (station to hotel).
    // -------------------------------------------------------------------------
    {
      id: "hotel_jodhpur",
      type: "hotel",
      title: "Umaid Bhawan Palace — Luxury Suite",
      provider: "Taj Hotels",
      startTime: ist("2024-12-23", "18:00"),
      endTime:   ist("2024-12-25", "11:00"),
      location: { type: "named", name: "Circuit House Rd, Jodhpur" },
      dependsOn: ["train_jaipur_jodhpur"],
      bufferMinutes: 45,
      cost: 35000,
      cancellationPolicy: { policy: "free", cutoffHours: 72 },
      status: "confirmed",
      meta: { nights: 2 },
    },

    // -------------------------------------------------------------------------
    // BOOKING 6: Activity — Mehrangarh Fort Sunset Tour
    // Fixed 4 PM slot on Dec 24 (day 2 of Jodhpur stay).
    //
    // DEPENDENCY DESIGN NOTE:
    // Same pattern as Amber Fort — depends on train arrival (Dec 23 17:15),
    // not hotel_jodhpur.endTime (Dec 25 11:00), to avoid false CRITICAL flags.
    //   train arrives Dec 23 17:15 + 1365 min (~22h45m) = Dec 24 16:00 ✓
    // -------------------------------------------------------------------------
    {
      id: "activity_mehrangarh",
      type: "activity",
      title: "Mehrangarh Fort Sunset Heritage Tour",
      provider: "Jodhpur Heritage Walks",
      startTime: ist("2024-12-24", "16:00"),
      endTime:   ist("2024-12-24", "18:30"),
      location: { type: "named", name: "Mehrangarh Fort, Jodhpur" },
      dependsOn: ["train_jaipur_jodhpur"], // depends on arrival, not hotel checkout
      bufferMinutes: 1365, // ~22h45m — arrive day before, overnight rest + travel to fort
      cost: 2200,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 30 },
      status: "confirmed",
      meta: { includes: "guided tour + sunset photography session" },
    },

    // -------------------------------------------------------------------------
    // BOOKING 7: Return Train — Jodhpur → Mumbai
    // Departs Dec 25 at 13:30. Hotel checkout 11:00. Buffer: 90 min.
    // -------------------------------------------------------------------------
    {
      id: "train_jodhpur_mumbai",
      type: "train",
      title: "Mandore Express 14854 — Jodhpur → Mumbai",
      provider: "Indian Railways",
      startTime: ist("2024-12-25", "13:30"),
      endTime:   ist("2024-12-26", "07:40"),
      location: { type: "named", name: "Jodhpur Junction Railway Station" },
      dependsOn: ["hotel_jodhpur"],
      bufferMinutes: 90,
      cost: 750,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 48, refundPercent: 75 },
      status: "confirmed",
      meta: { trainNumber: "14854", class: "3A" },
    },

  ],
};

// Convenience: all seed itineraries in a lookup map
export const seedItineraries: Record<string, Itinerary> = {
  [itineraryA.id]: itineraryA,
  [itineraryB.id]: itineraryB,
};
