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
// ---------------------------------------------------------------------------
// REFUND ELIGIBILITY
// Computed at runtime by calculateRefundEligibility().
// Answers: given the current time and the booking's policy/cutoff, how much
// money would the traveler actually get back if they cancelled right now?
// ---------------------------------------------------------------------------
export interface RefundEligibility {
  /** Computed refund amount in INR (0 = non-refundable) */
  refundAmountINR: number;
  /** Fraction of booking cost returned (0.0 – 1.0) */
  refundPercent: number;
  /** Policy tier that applies right now */
  appliedPolicy: "free" | "partial-refund" | "non-refundable";
  /** Hours remaining until the next (worse) cutoff; null = no further cutoff */
  hoursUntilNextCutoff: number | null;
  /** Human summary of what the traveler gets and what changes when */
  summary: string;
  /** Whether the cancellation qualifies for DGCA statutory compensation */
  dgcaCompensationEligible: boolean;
  /** DGCA statutory compensation amount if eligible (INR) */
  dgcaCompensationINR?: number;
}

export interface Disruption {
  bookingId: string; // The booking directly affected
  disruptionType: "delay" | "cancellation" | "traveler-change";
  delayMinutes?: number; // Required when disruptionType === 'delay'
  reason?: string; // Human-readable cause, e.g. "Air traffic control hold"
  timestamp: string; // ISO 8601 datetime when disruption was reported
  /**
   * Only present when disruptionType === 'traveler-change'.
   * Describes the nature of the voluntary modification (e.g. date change,
   * seat upgrade, added luggage, itinerary restructure).
   */
  travelerChangeReason?: "date-change" | "route-change" | "seat-upgrade" | "cancel-voluntary" | "add-segment" | "other";
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
  /**
   * Present only when 2 concurrent disruptions both impact this booking.
   * Always 2 when set. Undefined/absent for single-disruption entries.
   * Powers the compound badge in the UI.
   */
  compoundDisruptionCount?: 2;
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
// ---------------------------------------------------------------------------
// AVAILABILITY CONTEXT
// Attached to each RecoveryOption to communicate realistic (but deterministic)
// slot metadata. In production this would come from live GDS/OTA API results.
// The fields allow the UI to distinguish "seat count" from "price tier" from
// "distance from original location" without treating options as black boxes.
// ---------------------------------------------------------------------------
export interface AvailabilityContext {
  /** True = same city / airport / zone as the original booking */
  sameLocationZone: boolean;
  /** Named location of the alternative (airport code, hotel area, etc.) */
  alternativeLocation?: string;
  /**
   * Distance delta in km between the original and alternative locations.
   * 0 = same terminal/property. Positive = farther away.
   */
  locationDeltaKm: number;
  /** Estimated remaining seats / slots (deterministic heuristic) */
  availableSlots: number;
  /** Human label for the availability tier */
  availabilityLabel: "filling fast" | "limited" | "available" | "guaranteed";
  /** Pre-computed refund eligibility for the ORIGINAL booking being replaced */
  refundEligibility?: RefundEligibility;
}

export interface RecoveryOption {
  id: string;
  description: string; // Short title, e.g. "Take evening flight 6E-507"
  humanReadableSummary: string; // 1-2 sentences a traveler would understand
  affectedBookingId: string; // Which disrupted booking this replaces
  replacementBooking: Booking; // The new booking to slot in
  costDelta: number; // INR, +/- vs original booking cost
  timeDelta: number; // Minutes, +/- vs original booking start time
  itineraryImpactScore: number; // 0-100 (higher = less disruption to rest of trip)
  /** Availability metadata — always populated by recoveryEngine */
  availability: AvailabilityContext;
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
  /** Traveler persona match percentage (0-100) */
  personaMatchScore?: number;
  /** Persona match explanation (e.g. "Top match for Budget Explorer") */
  personaMatchLabel?: string;
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
// RESILIENCE PILLARS & PROACTIVE AUDIT
// Sub-score components evaluating multi-dimensional trip health.
// ---------------------------------------------------------------------------
export interface ResiliencePillars {
  bufferHealth: {
    score: number; // 0-100
    weight: number; // 0.35
    label: string;
    description: string;
    tightConnectionsCount: number;
  };
  financialExposure: {
    score: number; // 0-100
    weight: number; // 0.25
    nonRefundableTotal: number;
    nonRefundablePercent: number;
    label: string;
    description: string;
  };
  criticalPathRisk: {
    score: number; // 0-100
    weight: number; // 0.25
    chokepointsCount: number;
    chokepointLabels: string[];
    label: string;
    description: string;
  };
  alternativeRedundancy: {
    score: number; // 0-100
    weight: number; // 0.15
    label: string;
    description: string;
  };
}

export interface ResilienceRecommendation {
  id: string;
  type: "buffer" | "policy" | "routing";
  title: string;
  description: string;
  targetBookingId?: string;
}

// ---------------------------------------------------------------------------
// TRIP RISK SCORE (EXTENDED)
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
  /** Multi-factor pillars */
  pillars?: ResiliencePillars;
  /** Actionable resilience suggestions */
  recommendations?: ResilienceRecommendation[];
  /** Executive summary for ops dispatch */
  auditSummary?: string;
}

// ---------------------------------------------------------------------------
// TRAVELER PERSONAS & PREFERENCES
// Enables personalized ranking of recovery options.
// ---------------------------------------------------------------------------
export type TravelerPersonaId =
  | "balanced"
  | "budget"
  | "business"
  | "minimal-disruption"
  | "custom";

export interface TravelerPreferences {
  personaId: TravelerPersonaId;
  costSensitivity: number;      // 0-100 (100 = minimize added cost)
  timeUrgency: number;          // 0-100 (100 = arrive as fast as possible)
  continuityPriority: number;   // 0-100 (100 = protect downstream reservations)
}

export const PERSONA_PRESETS: Record<
  Exclude<TravelerPersonaId, "custom">,
  {
    name: string;
    tagline: string;
    icon: string;
    preferences: TravelerPreferences;
  }
> = {
  balanced: {
    name: "Balanced Traveler",
    tagline: "Equal trade-off between cost, speed, and schedule continuity.",
    icon: "B",
    preferences: {
      personaId: "balanced",
      costSensitivity: 50,
      timeUrgency: 50,
      continuityPriority: 50,
    },
  },
  budget: {
    name: "Budget Explorer",
    tagline: "Avoid extra fees at all costs; comfortable with modest delays.",
    icon: "$",
    preferences: {
      personaId: "budget",
      costSensitivity: 95,
      timeUrgency: 25,
      continuityPriority: 60,
    },
  },
  business: {
    name: "Time-Critical Business",
    tagline: "Arrive at destination earliest; budget is fully flexible.",
    icon: "T",
    preferences: {
      personaId: "business",
      costSensitivity: 15,
      timeUrgency: 95,
      continuityPriority: 70,
    },
  },
  "minimal-disruption": {
    name: "Low-Stress / Continuity",
    tagline: "Keep remaining hotels & tours intact with minimal re-bookings.",
    icon: "S",
    preferences: {
      personaId: "minimal-disruption",
      costSensitivity: 40,
      timeUrgency: 40,
      continuityPriority: 95,
    },
  },
};

// ---------------------------------------------------------------------------
// WHAT-IF SCENARIO
// For interactive proactive sandbox simulation.
// ---------------------------------------------------------------------------
export interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  disruption: Disruption;
  category: "delay" | "cancellation" | "weather";
}

