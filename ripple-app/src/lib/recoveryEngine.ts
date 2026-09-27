// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: recoveryEngine.ts
// PURPOSE: Generate, score, and apply recovery options for a disrupted booking.
//
// EXPORTS:
//   generateRecoveryOptions(itinerary, disruption)  → ScoredRecoveryOption[]
//   scoreRecoveryOption(option, weights?)           → ScoredRecoveryOption
//   applyRecoveryOption(itinerary, option)          → Itinerary
// =============================================================================

import type {
  Itinerary,
  Booking,
  Disruption,
  RecoveryOption,
  ScoredRecoveryOption,
  TravelerPreferences,
} from "./types";

// ---------------------------------------------------------------------------
// SCORING WEIGHTS
// These control how much each factor contributes to the composite score.
// They must sum to 1.0. Exported so the caller can tune them.
//
// Default rationale:
//   - itinerary impact (0.5): Most important — keeping the rest of the trip
//     intact is what a traveler cares about most.
//   - cost (0.3): Second priority — nobody wants to pay a lot more.
//   - time (0.2): Least important — a delay is annoying but manageable.
// ---------------------------------------------------------------------------
export interface ScoringWeights {
  itineraryImpact: number; // 0–1
  cost: number; // 0–1
  time: number; // 0–1
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  itineraryImpact: 0.5,
  cost: 0.3,
  time: 0.2,
};

// ---------------------------------------------------------------------------
// INTERNAL CONSTANTS — bounds used for normalising score components.
// Adjust these if your cost/time ranges differ significantly.
// ---------------------------------------------------------------------------
const MAX_COST_DELTA_INR = 10_000; // A costDelta above this = worst possible cost score
const MAX_TIME_DELTA_MIN = 480;    // A timeDelta above 8 hours = worst possible time score

// ---------------------------------------------------------------------------
// UTILITY: Add minutes to an ISO datetime string, return new ISO string.
// Preserves the original timezone offset (e.g. +05:30).
//
// WHY NOT toISOString(): toISOString() converts to UTC. Simply replacing the
// trailing 'Z' with '+05:30' produces the wrong wall-clock time because the
// number itself is already UTC, not IST. We instead:
//   1. Parse the offset from the original string (e.g. "+05:30" → +330 min)
//   2. Shift the epoch ms by addMinutes
//   3. Add the offset to get the local (IST) wall-clock time in UTC space
//   4. Format manually so the displayed HH:MM matches the local time
// ---------------------------------------------------------------------------
function shiftISOTime(iso: string, addMinutes: number): string {
  // Parse the timezone offset from the original string
  const offsetMatch = iso.match(/([+-])(\d{2}):(\d{2})$/);
  const offsetSign  = offsetMatch ? (offsetMatch[1] === "+" ? 1 : -1) : 1;
  const offsetMins  = offsetMatch
    ? offsetSign * (parseInt(offsetMatch[2]) * 60 + parseInt(offsetMatch[3]))
    : 330; // Default to IST (+05:30 = 330 min)
  const offsetStr   = offsetMatch ? offsetMatch[0] : "+05:30";

  // Shift the instant in time
  const originalMs = new Date(iso).getTime();
  const shiftedMs  = originalMs + addMinutes * 60_000;

  // Convert to wall-clock local time: add offset to get local time in "UTC space"
  const localMs    = shiftedMs + offsetMins * 60_000;
  const localDate  = new Date(localMs);

  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${localDate.getUTCFullYear()}-` +
    `${pad(localDate.getUTCMonth() + 1)}-` +
    `${pad(localDate.getUTCDate())}T` +
    `${pad(localDate.getUTCHours())}:` +
    `${pad(localDate.getUTCMinutes())}:00` +
    offsetStr
  );
}

// ---------------------------------------------------------------------------
// UTILITY: Generate a simple unique ID for replacement bookings.
// ---------------------------------------------------------------------------
function makeId(prefix: string, suffix: string | number): string {
  return `${prefix}_recovery_${suffix}`;
}

// ---------------------------------------------------------------------------
// UTILITY: Get the original booking from the itinerary.
// Throws if not found — the caller must pass a valid disruption.
// ---------------------------------------------------------------------------
function getOriginalBooking(itinerary: Itinerary, bookingId: string): Booking {
  const booking = itinerary.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    throw new Error(`Booking "${bookingId}" not found in itinerary "${itinerary.id}"`);
  }
  return booking;
}

// ---------------------------------------------------------------------------
// INTERNAL: Compute itineraryImpactScore for a replacement booking.
//
// This estimates how much of the REMAINING itinerary stays intact if we
// accept this recovery option. Higher = better.
//
// Algorithm:
//   1. Count total downstream bookings after the disrupted one.
//   2. For each downstream booking, check if the replacement's timing
//      allows the booking to proceed without breaking its buffer.
//   3. savedCount / totalDownstream → impact ratio → scale to 0–100.
//
// For simplicity (this is a hackathon prototype), we use a heuristic:
//   - If timeDelta ≤ 60 min: 95 (barely any downstream impact)
//   - If timeDelta ≤ 120 min: 80 (a couple bookings may need rescheduling)
//   - If timeDelta ≤ 240 min: 60 (significant downstream disruption)
//   - If timeDelta > 240 min: 30 (most of the trip is affected)
//   - Cancellation recovery (timeDelta = 0 but new slot): 85 (trip resumes normally)
//
// In a production system this would call detectImpact() on the projected
// itinerary — but that creates circular dependency and adds complexity for
// a hackathon demo.
// ---------------------------------------------------------------------------
function estimateItineraryImpactScore(
  timeDelta: number,
  isReplacement: boolean
): number {
  if (isReplacement && timeDelta === 0) return 85; // Exact replacement
  if (timeDelta <= 60) return 95;
  if (timeDelta <= 120) return 80;
  if (timeDelta <= 240) return 60;
  if (timeDelta <= 360) return 40;
  return 25;
}

// =============================================================================
// EXPORTED FUNCTION: scoreRecoveryOption
//
// Computes the composite score for a single RecoveryOption.
// Scores are normalised to 0–100 per dimension, then weighted.
//
// PARAMETERS:
//   option  - The RecoveryOption to score
//   weights - (optional) Custom weights; defaults to DEFAULT_WEIGHTS
//
// RETURNS: ScoredRecoveryOption with compositeScore and breakdown.
// =============================================================================
export function scoreRecoveryOption(
  option: RecoveryOption,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoredRecoveryOption {
  // Validate weights sum to ~1.0
  const weightSum = weights.itineraryImpact + weights.cost + weights.time;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(
      `Scoring weights must sum to 1.0. Got: ${weightSum.toFixed(2)}`
    );
  }

  // --- ITINERARY IMPACT SCORE (already 0–100, higher = better) ---
  const itineraryScore = option.itineraryImpactScore;

  // --- COST SCORE (0–100, lower costDelta = higher score) ---
  // Clamp costDelta to [0, MAX] then invert: 100 = free, 0 = very expensive.
  // Negative costDelta (cheaper than original) = bonus → cap at 100.
  const clampedCost = Math.min(Math.max(option.costDelta, 0), MAX_COST_DELTA_INR);
  const costScore = Math.round(100 - (clampedCost / MAX_COST_DELTA_INR) * 100);

  // --- TIME SCORE (0–100, smaller timeDelta = higher score) ---
  // Clamp timeDelta to [0, MAX] then invert.
  const clampedTime = Math.min(Math.max(option.timeDelta, 0), MAX_TIME_DELTA_MIN);
  const timeScore = Math.round(100 - (clampedTime / MAX_TIME_DELTA_MIN) * 100);

  // --- COMPOSITE SCORE ---
  const compositeScore = Math.round(
    itineraryScore * weights.itineraryImpact +
    costScore      * weights.cost +
    timeScore      * weights.time
  );

  return {
    ...option,
    compositeScore,
    scoreBreakdown: { itineraryScore, costScore, timeScore },
  };
}

// =============================================================================
// INTERNAL: Generate recovery options for a DELAYED booking.
//
// Strategy:
//   Option 1 (best case): Accept the delay — reschedule immediately after.
//   Option 2: Take the next available service (e.g. next flight / bus).
//   Option 3: Take a premium / faster alternative (higher cost, less delay).
//   Option 4: If transfer/activity — cancel it and replace with different timing.
//
// All replacement bookings are mocked but realistic. In production, these
// would come from live availability APIs.
// =============================================================================
function generateDelayRecoveries(
  original: Booking,
  disruption: Disruption,
  itinerary: Itinerary
): RecoveryOption[] {
  const delayMin = disruption.delayMinutes ?? 0;
  const options: RecoveryOption[] = [];

  // -------------------------------------------------------------------------
  // OPTION 1: Wait it out — accept the delay and proceed with existing booking.
  // Best when the downstream bookings have enough slack to absorb the delay.
  // -------------------------------------------------------------------------
  {
    const replacement: Booking = {
      ...original,
      id: makeId(original.id, "accept"),
      title: `${original.title} (Delayed)`,
      startTime: shiftISOTime(original.startTime, delayMin),
      endTime: shiftISOTime(original.endTime, delayMin),
      status: "at-risk",
    };

    const impactScore = estimateItineraryImpactScore(delayMin, false);

    options.push({
      id: makeId(original.id, "opt1"),
      description: `Accept ${Math.round(delayMin / 60)}h ${delayMin % 60}m delay`,
      humanReadableSummary:
        `Your ${original.title} is delayed by ${delayMin} minutes. ` +
        `You can wait at the terminal — the booking shifts to ${shiftISOTime(original.startTime, delayMin).substring(11, 16)} IST. ` +
        `Downstream bookings may need adjustment.`,
      affectedBookingId: original.id,
      replacementBooking: replacement,
      costDelta: 0,
      timeDelta: delayMin,
      itineraryImpactScore: impactScore,
    });
  }

  // -------------------------------------------------------------------------
  // OPTION 2: Next available service — similar type, departs after the delay.
  // E.g. the next IndiGo flight 2 hours later. Slightly more expensive.
  // -------------------------------------------------------------------------
  {
    // Assume next service departs 90 minutes after the delayed original start
    const nextDepartureShift = delayMin + 90;
    const nextDuration = Math.round(
      (new Date(original.endTime).getTime() - new Date(original.startTime).getTime()) / 60_000
    );
    const replacement: Booking = {
      ...original,
      id: makeId(original.id, "next-svc"),
      title: getNextServiceTitle(original),
      provider: original.provider,
      startTime: shiftISOTime(original.startTime, nextDepartureShift),
      endTime: shiftISOTime(original.startTime, nextDepartureShift + nextDuration),
      cost: original.cost + 800,
      status: "confirmed",
    };

    const impactScore = estimateItineraryImpactScore(nextDepartureShift, false);

    options.push({
      id: makeId(original.id, "opt2"),
      description: `Take next available ${original.type}`,
      humanReadableSummary:
        `Switch to the next ${original.type} departing at ` +
        `${shiftISOTime(original.startTime, nextDepartureShift).substring(11, 16)} IST. ` +
        `Costs ₹800 more but gets you back on track sooner.`,
      affectedBookingId: original.id,
      replacementBooking: replacement,
      costDelta: 800,
      timeDelta: nextDepartureShift,
      itineraryImpactScore: impactScore,
    });
  }

  // -------------------------------------------------------------------------
  // OPTION 3: Premium / faster alternative.
  // E.g. a business-class upgrade that gets priority boarding and departs
  // at the soonest slot. Significantly more expensive but least delay.
  // -------------------------------------------------------------------------
  {
    const premiumShift = Math.max(delayMin - 30, delayMin); // small improvement on delay
    const originalDuration = Math.round(
      (new Date(original.endTime).getTime() - new Date(original.startTime).getTime()) / 60_000
    );
    const replacement: Booking = {
      ...original,
      id: makeId(original.id, "premium"),
      title: `${original.title} [Premium / Priority]`,
      provider: original.provider,
      startTime: shiftISOTime(original.startTime, premiumShift),
      endTime: shiftISOTime(original.startTime, premiumShift + originalDuration),
      cost: original.cost + 3500,
      cancellationPolicy: { policy: "partial-refund", cutoffHours: 24, refundPercent: 70 },
      status: "confirmed",
      meta: { ...original.meta, class: "Business / Premium", priorityBoarding: true },
    };

    const impactScore = estimateItineraryImpactScore(premiumShift, false);

    options.push({
      id: makeId(original.id, "opt3"),
      description: `Upgrade to premium / priority option`,
      humanReadableSummary:
        `Upgrade to a premium-class ${original.type} departing at ` +
        `${shiftISOTime(original.startTime, premiumShift).substring(11, 16)} IST. ` +
        `Costs ₹3,500 extra but offers priority service and minimal additional wait.`,
      affectedBookingId: original.id,
      replacementBooking: replacement,
      costDelta: 3500,
      timeDelta: premiumShift,
      itineraryImpactScore: impactScore,
    });
  }

  // -------------------------------------------------------------------------
  // OPTION 4 (Context-sensitive): For transfers and activities, offer a
  // rebooking to a different time slot rather than the same service delayed.
  // -------------------------------------------------------------------------
  if (original.type === "transfer" || original.type === "activity") {
    const rebookShift = delayMin + 60; // 1h after the delay, a fresh slot
    const originalDuration = Math.round(
      (new Date(original.endTime).getTime() - new Date(original.startTime).getTime()) / 60_000
    );
    const replacement: Booking = {
      ...original,
      id: makeId(original.id, "rebook"),
      title: `${original.title} [Rescheduled]`,
      startTime: shiftISOTime(original.startTime, rebookShift),
      endTime: shiftISOTime(original.startTime, rebookShift + originalDuration),
      cost: original.cost + 200,
      status: "confirmed",
    };

    const impactScore = estimateItineraryImpactScore(rebookShift, true);

    options.push({
      id: makeId(original.id, "opt4"),
      description: `Rebook for a later time slot`,
      humanReadableSummary:
        `Cancel your current slot and rebook the same ${original.type} ` +
        `for ${shiftISOTime(original.startTime, rebookShift).substring(11, 16)} IST. ` +
        `Small rebooking fee of ₹200. ` +
        `This is the most seamless option for the rest of your trip.`,
      affectedBookingId: original.id,
      replacementBooking: replacement,
      costDelta: 200,
      timeDelta: rebookShift,
      itineraryImpactScore: impactScore,
    });
  }

  return options;
}

// =============================================================================
// INTERNAL: Generate recovery options for a CANCELLED booking.
//
// Strategy:
//   Option 1: Find equivalent service from a different provider (same cost range).
//   Option 2: Premium alternative — more expensive, guaranteed slot.
//   Option 3: Partial trip modification — skip this leg, restructure the trip.
// =============================================================================
function generateCancellationRecoveries(
  original: Booking,
  disruption: Disruption,
  itinerary: Itinerary
): RecoveryOption[] {
  const options: RecoveryOption[] = [];
  const originalDuration = Math.round(
    (new Date(original.endTime).getTime() - new Date(original.startTime).getTime()) / 60_000
  );

  // -------------------------------------------------------------------------
  // OPTION 1: Equivalent replacement from a different provider.
  // Same time slot, similar cost, different vendor.
  // -------------------------------------------------------------------------
  {
    const replacement: Booking = {
      ...original,
      id: makeId(original.id, "alt-provider"),
      title: `Alternative ${original.type}: ${getAlternativeTitle(original)}`,
      provider: getAlternativeProvider(original),
      cost: original.cost + 500,
      status: "confirmed",
    };

    options.push({
      id: makeId(original.id, "opt1"),
      description: `Book equivalent from alternate provider`,
      humanReadableSummary:
        `Your ${original.title} was cancelled. We found a similar ` +
        `${original.type} from ${replacement.provider} at approximately ` +
        `the same time. Costs ₹500 more.`,
      affectedBookingId: original.id,
      replacementBooking: replacement,
      costDelta: 500,
      timeDelta: 0,
      itineraryImpactScore: 90, // Same time slot = trip almost fully intact
    });
  }

  // -------------------------------------------------------------------------
  // OPTION 2: Premium alternative — get a guaranteed confirmed slot.
  // -------------------------------------------------------------------------
  {
    const replacement: Booking = {
      ...original,
      id: makeId(original.id, "premium-alt"),
      title: `Premium ${original.type}: ${getPremiumTitle(original)}`,
      provider: getPremiumProvider(original),
      cost: original.cost + 2500,
      cancellationPolicy: { policy: "free", cutoffHours: 48 },
      status: "confirmed",
      meta: { ...original.meta, premiumBooking: true },
    };

    options.push({
      id: makeId(original.id, "opt2"),
      description: `Upgrade to premium guaranteed alternative`,
      humanReadableSummary:
        `Book a premium-tier ${original.type} from ${replacement.provider} ` +
        `with free cancellation. Costs ₹2,500 extra but guarantees your slot ` +
        `and keeps the rest of your trip intact.`,
      affectedBookingId: original.id,
      replacementBooking: replacement,
      costDelta: 2500,
      timeDelta: 0,
      itineraryImpactScore: 95,
    });
  }

  // -------------------------------------------------------------------------
  // OPTION 3: Rescheduled slot — 2 hours later, cheaper (off-peak pricing).
  // -------------------------------------------------------------------------
  {
    const replacement: Booking = {
      ...original,
      id: makeId(original.id, "later-slot"),
      title: `${getAlternativeTitle(original)} [Later Slot]`,
      provider: getAlternativeProvider(original),
      startTime: shiftISOTime(original.startTime, 120),
      endTime: shiftISOTime(original.startTime, 120 + originalDuration),
      cost: original.cost - 300, // Off-peak discount
      status: "confirmed",
    };

    options.push({
      id: makeId(original.id, "opt3"),
      description: `Later time slot — off-peak pricing`,
      humanReadableSummary:
        `A later slot at ${shiftISOTime(original.startTime, 120).substring(11, 16)} IST is available ` +
        `and is actually ₹300 cheaper. You'll arrive 2 hours later but ` +
        `the rest of your trip adjusts smoothly.`,
      affectedBookingId: original.id,
      replacementBooking: replacement,
      costDelta: -300,
      timeDelta: 120,
      itineraryImpactScore: 78,
    });
  }

  return options;
}

// =============================================================================
// EXPORTED FUNCTION: generateRecoveryOptions
//
// Entry point: given a disruption, generate 2–4 realistic recovery options
// and return them ranked by composite score (highest first).
//
// PARAMETERS:
//   itinerary  - The full trip
//   disruption - The event to recover from
//
// RETURNS:
//   ScoredRecoveryOption[] sorted descending by compositeScore.
// =============================================================================
export function generateRecoveryOptions(
  itinerary: Itinerary,
  disruption: Disruption,
  preferences?: TravelerPreferences
): ScoredRecoveryOption[] {
  const original = getOriginalBooking(itinerary, disruption.bookingId);

  // Derive weights from preferences if provided
  let weights = DEFAULT_WEIGHTS;
  if (preferences) {
    const rawImpact = Math.max(0.1, preferences.continuityPriority);
    const rawCost = Math.max(0.1, preferences.costSensitivity);
    const rawTime = Math.max(0.1, preferences.timeUrgency);
    const sum = rawImpact + rawCost + rawTime;
    weights = {
      itineraryImpact: rawImpact / sum,
      cost: rawCost / sum,
      time: rawTime / sum,
    };
  }

  // Generate raw options based on disruption type
  const rawOptions: RecoveryOption[] =
    disruption.disruptionType === "delay"
      ? generateDelayRecoveries(original, disruption, itinerary)
      : generateCancellationRecoveries(original, disruption, itinerary);

  // Score each option
  const scored = rawOptions.map((opt) => {
    const scoredOpt = scoreRecoveryOption(opt, weights);

    // Compute persona match score (0-100)
    let personaMatchScore = scoredOpt.compositeScore;
    let personaMatchLabel = "Balanced Fit";

    if (preferences) {
      if (preferences.personaId === "budget") {
        const costSavingRatio = Math.max(0, 100 - Math.max(0, opt.costDelta) / 30);
        personaMatchScore = Math.round(costSavingRatio * 0.7 + opt.itineraryImpactScore * 0.3);
        personaMatchLabel = opt.costDelta <= 0 ? "Top Budget Pick (₹0 Extra)" : "Moderate Budget Impact";
      } else if (preferences.personaId === "business") {
        const speedRatio = Math.max(0, 100 - Math.max(0, opt.timeDelta) / 2);
        personaMatchScore = Math.round(speedRatio * 0.7 + opt.itineraryImpactScore * 0.3);
        personaMatchLabel = opt.timeDelta <= 30 ? "Fastest Arrival Option" : "Express Transit Alternative";
      } else if (preferences.personaId === "minimal-disruption") {
        personaMatchScore = Math.round(opt.itineraryImpactScore * 0.85 + (100 - Math.min(100, Math.max(0, opt.timeDelta) / 4)) * 0.15);
        personaMatchLabel = opt.itineraryImpactScore >= 85 ? "Maximum Schedule Continuity" : "Preserves Core Bookings";
      }
    }

    return {
      ...scoredOpt,
      personaMatchScore,
      personaMatchLabel,
    };
  });

  // Sort descending: best score first
  return scored.sort((a, b) => b.compositeScore - a.compositeScore);
}

// =============================================================================
// EXPORTED FUNCTION: applyRecoveryOption
//
// Returns a NEW Itinerary (immutable — original is not mutated) with:
//   1. The disrupted booking replaced by the recovery option's replacement.
//   2. The disrupted booking's status set to 'disrupted' (kept in history).
//   3. Previously 'at-risk' bookings reset to 'confirmed' (the recovery
//      resolves the cascade — in a production system you'd re-run detectImpact
//      on the new itinerary to verify, but for demo purposes we optimistically
//      clear them).
//   4. The replacement booking inserted in the correct chronological position.
//
// PARAMETERS:
//   itinerary - Original itinerary (will NOT be mutated)
//   option    - The chosen RecoveryOption
//
// RETURNS:
//   A brand new Itinerary object.
// =============================================================================
export function applyRecoveryOption(
  itinerary: Itinerary,
  option: RecoveryOption
): Itinerary {
  // The replacement booking must keep the original booking's ID so that all
  // downstream bookings whose `dependsOn` arrays reference the original ID
  // continue to resolve correctly. This is the key fix: without it, a second
  // disruption on the replacement has no cascade effect because nothing in
  // the graph points at the synthetic `_recovery_` ID.
  // Look up the original booking so we can stamp its times into meta.
  // This is what powers the "strikethrough original → new time" rendering in BookingCard.
  const originalBooking = itinerary.bookings.find((b) => b.id === option.affectedBookingId);

  const replacementWithOriginalId: Booking = {
    ...option.replacementBooking,
    id: option.affectedBookingId,
    status: "recovered" as const,
    meta: {
      ...option.replacementBooking.meta,
      // Stamp original times so BookingCard can show strikethrough
      originalStartTime: originalBooking?.startTime,
      originalEndTime: originalBooking?.endTime,
      originalCost: originalBooking?.cost,
      recoveredFrom: option.description,
    },
  };

  // Deep clone bookings (no mutation).
  // At-risk bookings are reset to 'confirmed' (not 'recovered') so the
  // DisruptionTrigger button continues to render normally on them and
  // they can be disrupted again in subsequent scenarios.
  const updatedBookings: Booking[] = itinerary.bookings.map((booking) => {
    if (booking.id === option.affectedBookingId) {
      // The original slot is replaced — we drop it below.
      return { ...booking, status: "disrupted" as const };
    }
    if (booking.status === "at-risk") {
      return { ...booking, status: "confirmed" as const };
    }
    return { ...booking };
  });

  // Swap the disrupted slot for the replacement (same ID, new details),
  // then re-sort chronologically.
  const bookingsWithReplacement = [
    ...updatedBookings.filter((b) => b.id !== option.affectedBookingId),
    replacementWithOriginalId,
  ].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Keep the itinerary ID stable so the importedItins list stays in sync.
  // Only stamp a recovery marker in meta, not in the ID itself.
  return {
    ...itinerary,
    bookings: bookingsWithReplacement,
    meta: {
      ...itinerary.meta,
      recoveryApplied: option.id,
      recoveryTimestamp: new Date().toISOString(),
      recoveryDescription: option.description,
    },
  };
}

// =============================================================================
// PRIVATE HELPERS — Title and provider name generators for mock alternatives.
// In production these would come from live API search results.
// =============================================================================

function getNextServiceTitle(original: Booking): string {
  const map: Record<string, string> = {
    flight: original.title.replace(/6E-(\d+)/, (_, n) => `6E-${parseInt(n) + 200}`),
    train: original.title.replace(/(\d{5})/, (_, n) => `${parseInt(n) + 1}`),
    transfer: `${original.provider} — Next Available Vehicle`,
    activity: `${original.title} [Next Time Slot]`,
    hotel: original.title,
    event: original.title,
  };
  return map[original.type] ?? `${original.title} [Next Available]`;
}

function getAlternativeTitle(original: Booking): string {
  const map: Record<string, string> = {
    flight: original.title.includes("DEL")
      ? "Air India AI-873 DEL → GOI"
      : "SpiceJet SG-104 GOI → DEL",
    train: "Superfast Express — Alternative Train",
    transfer: "Ola/Uber — On-demand Cab",
    activity: `${original.title} — Alternate Operator`,
    hotel: `${original.title} [Alternate]`,
    event: `${original.title} [Alternate Venue]`,
  };
  return map[original.type] ?? `Alternative ${original.type}`;
}

function getAlternativeProvider(original: Booking): string {
  const map: Record<string, string> = {
    flight: "Air India",
    train: "Indian Railways (Alternate)",
    transfer: "Ola / Uber",
    activity: `${original.provider} (Alternate)`,
    hotel: "OYO / MakeMyTrip Hotels",
    event: "Alternate Venue",
  };
  return map[original.type] ?? "Alternate Provider";
}

function getPremiumTitle(original: Booking): string {
  const map: Record<string, string> = {
    flight: "Vistara UK-971 — Business Class",
    train: "Tejas Express — Executive Class",
    transfer: "Luxury Sedan — Hertz / Myles",
    activity: `${original.title} — Premium Private Experience`,
    hotel: `${original.title} [Suite Upgrade]`,
    event: `${original.title} [VIP Experience]`,
  };
  return map[original.type] ?? `Premium ${original.type}`;
}

function getPremiumProvider(original: Booking): string {
  const map: Record<string, string> = {
    flight: "Vistara",
    train: "IRCTC Tejas Express",
    transfer: "Luxury Chauffeur Services",
    activity: `${original.provider} (Private Charter)`,
    hotel: original.provider,
    event: "Premium Events Partner",
  };
  return map[original.type] ?? `${original.provider} (Premium)`;
}
