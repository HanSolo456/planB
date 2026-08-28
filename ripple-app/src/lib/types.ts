// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: types.ts
// PURPOSE: All shared TypeScript type definitions (schema / data model)
// No runtime logic lives here — purely types and interfaces.
// =============================================================================

// ---------------------------------------------------------------------------
// LOCATION
// A booking can have a named location or precise GPS coordinates.
// ---------------------------------------------------------------------------
export type Location =
  | { type: "named"; name: string }
  | { type: "coordinates"; lat: number; lng: number; label?: string };

// ---------------------------------------------------------------------------
// CANCELLATION POLICY
// Describes what happens financially when a booking is cancelled.
//   free           → full refund, no penalty
//   partial-refund → a percentage of cost is refunded (refundPercent: 0-100)
//   non-refundable → no money back
// cutoffHours: the deadline (hours before startTime) within which the policy applies.
// e.g. { policy:'free', cutoffHours:24 } means free cancellation if done 24h+ before.
// ---------------------------------------------------------------------------
export interface CancellationPolicy {
  policy: "free" | "partial-refund" | "non-refundable";
  cutoffHours?: number; // hours before startTime the policy is valid
  refundPercent?: number; // 0–100, only relevant when policy = 'partial-refund'
}

// ---------------------------------------------------------------------------
// BOOKING
// The atomic unit of a trip. Every leg — flight, hotel night, taxi,
// scuba dive — is a Booking. Bookings form a DAG (directed acyclic graph)
// via the `dependsOn` field.
//
// dependsOn: IDs of bookings that must complete before this one can start.
//   e.g. A hotel transfer depends on the flight landing first.
//
// bufferMinutes: the MINIMUM time gap (in minutes) required between the end
//   of the last dependency and the start of THIS booking.
//   e.g. 45 min for immigration + baggage claim after an international flight.
//   If a disruption causes actual gap < bufferMinutes, this booking is AT RISK.
// ---------------------------------------------------------------------------
export interface Booking {
  id: string;
  type: "flight" | "train" | "hotel" | "transfer" | "activity" | "event";
  title: string; // Human readable, e.g. "IndiGo 6E-301 DEL-GOI"
  provider: string; // Airline, hotel chain, activity operator, etc.

  startTime: string; // ISO 8601 datetime, e.g. "2024-12-15T06:30:00+05:30"
  endTime: string; // ISO 8601 datetime

  location: Location;

  /** IDs of other bookings this booking directly depends on */
  dependsOn: string[];

  /**
   * Minimum buffer (in minutes) needed AFTER the last dependency ends
   * and BEFORE this booking starts. Accounts for travel time, baggage
   * claim, immigration, getting dressed, etc.
   *
   * If dependsOn is empty, bufferMinutes is 0 (no constraint).
   */
  bufferMinutes: number;

  cost: number; // in INR (or your local currency)
  cancellationPolicy: CancellationPolicy;

  status: "confirmed" | "at-risk" | "disrupted" | "recovered" | "cancelled";

  /** Optional metadata blob for any booking-type-specific fields */
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ITINERARY
// The full trip object: a traveler name, a list of bookings, and any
// trip-level metadata. The bookings array is the source of truth — the
// dependency graph is reconstructed from it on the fly.
// ---------------------------------------------------------------------------
export interface Itinerary {
  id: string;
  travelerName: string;
  destination: string; // Human-readable trip destination label
  startDate: string; // ISO date of first day, e.g. "2024-12-15"
  endDate: string; // ISO date of last day
  bookings: Booking[];
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// DISRUPTION
// Represents an event that breaks or delays one booking.
//   delay       → booking starts/ends later than planned (delayMinutes required)
//   cancellation → booking is entirely removed; must be replaced
// timestamp: when the disruption was detected / reported.
// ---------------------------------------------------------------------------
export interface Disruption {
  bookingId: string; // The booking directly affected
  disruptionType: "delay" | "cancellation";
  delayMinutes?: number; // Required when disruptionType === 'delay'
  reason?: string; // Human-readable cause, e.g. "Air traffic control hold"
  timestamp: string; // ISO 8601 datetime when disruption was reported
}

// ---------------------------------------------------------------------------
// IMPACTED BOOKING
// Returned by detectImpact(). Extends Booking with an explanation of WHY
// this booking is now at risk — very useful for the UI and for judges :)
// ---------------------------------------------------------------------------
export interface ImpactedBooking {
  booking: Booking;
  /** Short, human-readable explanation of the impact */
  reason: string;
  /**
   * How many minutes short this booking is from meeting its buffer requirement.
   * Negative = already fine (should not appear here).
   * Positive = this many minutes are missing.
   */
  bufferShortfallMinutes: number;
  /** Whether this booking is fully broken (cancellation or zero buffer) vs just at risk */
  severity: "at-risk" | "broken";
}

// ---------------------------------------------------------------------------
// RECOVERY OPTION
// A proposed solution to replace or work around a disrupted booking.
// One RecoveryOption replaces exactly ONE disrupted booking with a new one.
// The new booking's startTime/cost may differ.
//
// costDelta    : replacementBooking.cost - original.cost (positive = more expensive)
// timeDelta    : how many minutes later the replacement starts vs original
// itineraryImpactScore : 0-100. 100 = trip fully intact; 0 = trip completely ruined.
//   This is the most important signal — even an expensive option is great
//   if the whole trip stays intact.
// ---------------------------------------------------------------------------
export interface RecoveryOption {
  id: string;
  description: string; // Short title, e.g. "Take evening flight 6E-507"
  humanReadableSummary: string; // 1-2 sentences a traveler would understand
  affectedBookingId: string; // Which disrupted booking this replaces
  replacementBooking: Booking; // The new booking to slot in
  costDelta: number; // INR, +/- vs original booking cost
  timeDelta: number; // Minutes, +/- vs original booking start time
  itineraryImpactScore: number; // 0-100 (higher = less disruption to rest of trip)
}

// ---------------------------------------------------------------------------
// SCORED RECOVERY OPTION
// Wraps RecoveryOption with a composite score for ranking.
// Separated so scoreRecoveryOption() is cleanly testable.
// ---------------------------------------------------------------------------
export interface ScoredRecoveryOption extends RecoveryOption {
  /** Composite score used for ranking (higher = better). Range: 0-100 */
  compositeScore: number;
  /** Breakdown of the composite score for transparency */
  scoreBreakdown: {
    itineraryScore: number; // Weighted itineraryImpactScore contribution
    costScore: number;      // Weighted cost contribution (lower cost = higher score)
    timeScore: number;      // Weighted time contribution (less delay = higher score)
  };
}

// ---------------------------------------------------------------------------
// AT-RISK CONNECTION
// Returned by getAtRiskConnections() — proactive health check with no
// disruption needed. Flags booking pairs where the buffer is dangerously thin.
// ---------------------------------------------------------------------------
export interface AtRiskConnection {
  /** The booking that has a tight constraint */
  booking: Booking;
  /** The dependency booking whose end time creates the constraint */
  dependencyBooking: Booking;
  /** Minutes of buffer remaining between dependency.endTime and booking.startTime */
  bufferRemaining: number;
  /** Minutes below the required buffer (positive = shortage; 0 = exactly on limit) */
  bufferShortfallMinutes: number;
  /** 'tight' = within 30 min of limit; 'critical' = under the limit already */
  riskLevel: "tight" | "critical";
}

// ---------------------------------------------------------------------------
// TRIP RISK SCORE
// Evaluates whole-itinerary schedule robustness (0-100, where 100 = safest).
// ---------------------------------------------------------------------------
export interface TripRiskScore {
  /** 0 to 100, where 100 = safest / fully resilient */
  overallScore: number;
  /** Risk classification: low (>=75), moderate (40-74), high (<40) */
  level: "low" | "moderate" | "high";
  /** Individual connection risk breakdown, sorted by riskContribution descending */
  legRisks: {
    bookingId: string;
    connectionLabel: string;
    riskContribution: number;
    reason: string;
  }[];
}

