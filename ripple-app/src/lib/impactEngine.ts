// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: impactEngine.ts
// PURPOSE: Core disruption impact detection.
//
// EXPORTS:
//   detectImpact(itinerary, disruption)     → ImpactedBooking[]
//   getAtRiskConnections(itinerary)         → AtRiskConnection[]
//   getEffectiveEndTime(booking, disruption) → Date  (utility)
//
// ZERO external dependencies — only uses native Date math.
// =============================================================================

import type {
  Itinerary,
  Booking,
  Disruption,
  ImpactedBooking,
  AtRiskConnection,
  TripRiskScore,
} from "./types";

// ---------------------------------------------------------------------------
// UTILITY: Parse an ISO datetime string to a Date object.
// We do this in one place so we don't scatter `new Date()` everywhere.
// ---------------------------------------------------------------------------
function parseTime(iso: string): Date {
  return new Date(iso);
}

// ---------------------------------------------------------------------------
// UTILITY: Minutes between two Date objects (end - start).
// Returns a positive number if end > start, negative if end < start.
// ---------------------------------------------------------------------------
function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60_000;
}

// ---------------------------------------------------------------------------
// UTILITY: Add a number of minutes to a Date, return a new Date.
// ---------------------------------------------------------------------------
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

// ---------------------------------------------------------------------------
// UTILITY: Build a Map of bookingId → Booking for O(1) lookups.
// We need this to traverse the dependency graph efficiently.
// ---------------------------------------------------------------------------
function buildBookingMap(bookings: Booking[]): Map<string, Booking> {
  return new Map(bookings.map((b) => [b.id, b]));
}

// ---------------------------------------------------------------------------
// UTILITY: getHotelReferenceTime
//
// Returns the correct "completed at" reference time for a booking when used
// as a dependency by a downstream segment.
//
// WHY THIS EXISTS:
//   For flights, trains, and transfers the traveller is physically "done" at
//   the endTime (arrival / drop-off).  Downstream segments must start after
//   that moment + their required buffer.
//
//   For hotels the semantics are different.  The hotel's endTime is CHECKOUT
//   (e.g. 11:00 on the last day).  But activities and transports that happen
//   DURING the stay don't need to wait until checkout — they need the traveller
//   to have ARRIVED (check-in = startTime).  Using endTime (checkout) as the
//   reference makes mid-stay activities appear impossibly far in the past and
//   generates false broken/at-risk results.
//
//   The one exception — a booking that explicitly departs FROM the hotel
//   (return flight, outbound train) — also depends on the hotel, but uses
//   bufferMinutes measured from checkout.  Those still work correctly:
//   using startTime (check-in) as reference only makes the buffer appear
//   *larger* (more generous) for the return leg, which is safe — the actual
//   risk for that connection is captured via its large bufferMinutes value
//   (e.g. 150 min for "checkout at 11:00, airport by 12:30").
// ---------------------------------------------------------------------------
function getHotelReferenceTime(booking: Booking): Date {
  return parseTime(
    booking.type === 'hotel' ? booking.startTime : booking.endTime
  );
}

// ---------------------------------------------------------------------------
// UTILITY: Build the REVERSE dependency graph.
//
// Forward graph:  transfer dependsOn → [flight]
// Reverse graph:  flight → [transfer, hotel, ...]  (things that depend on flight)
//
// We need the reverse graph to do a forward BFS/DFS from the disrupted
// booking and find everything downstream.
// ---------------------------------------------------------------------------
function buildReverseDependencyGraph(
  bookings: Booking[]
): Map<string, string[]> {
  const reverse = new Map<string, string[]>();

  // Initialize every booking with an empty downstream list
  for (const booking of bookings) {
    reverse.set(booking.id, []);
  }

  // For each booking, add it as a downstream of each of its dependencies
  for (const booking of bookings) {
    for (const depId of booking.dependsOn) {
      const downstream = reverse.get(depId) ?? [];
      downstream.push(booking.id);
      reverse.set(depId, downstream);
    }
  }

  return reverse;
}

// =============================================================================
// EXPORTED UTILITY: getEffectiveEndTime
//
// Returns the effective end time of a booking after a disruption is applied.
// If the disruption is on this booking and is a delay, the end time shifts.
// If the disruption is a cancellation, we return the original end time
// (the caller is responsible for treating it as "booking no longer exists").
//
// This is exported so the recovery engine can use it when building alternatives.
// =============================================================================
export function getEffectiveEndTime(
  booking: Booking,
  disruption: Disruption
): Date {
  const originalEnd = parseTime(booking.endTime);

  if (
    booking.id === disruption.bookingId &&
    disruption.disruptionType === "delay" &&
    disruption.delayMinutes !== undefined
  ) {
    // Shift the end time forward by the delay amount
    return addMinutes(originalEnd, disruption.delayMinutes);
  }

  return originalEnd;
}

// =============================================================================
// CORE FUNCTION: detectImpact
//
// Algorithm:
//   1. Find the disrupted booking in the itinerary.
//   2. Build a reverse dependency graph (downstream → upstream).
//   3. BFS from the disrupted booking, visiting all downstream bookings.
//   4. For each downstream booking, compute:
//        - The "effective end time" of its dependencies (accounting for delays
//          that have cascaded through the graph so far).
//        - The available buffer = booking.startTime − max(dep.effectiveEndTime)
//        - Whether that buffer meets booking.bufferMinutes requirement.
//   5. If buffer < required, mark it as ImpactedBooking with reason + severity.
//
// KEY INSIGHT on cascade:
//   When a flight is delayed, the transfer after it also effectively starts late.
//   When the transfer is late, the hotel check-in is also affected.
//   We track the "effective end time" for each visited node as we propagate,
//   so downstream impacts compound correctly (it's not just +3h uniformly).
//
// PARAMETERS:
//   itinerary  - The full trip object
//   disruption - The event to simulate
//
// RETURNS:
//   Array of ImpactedBooking — bookings that are broken or at risk.
//   Does NOT mutate the itinerary.
// =============================================================================
export function detectImpact(
  itinerary: Itinerary,
  disruption: Disruption
): ImpactedBooking[] {
  const bookingMap = buildBookingMap(itinerary.bookings);
  const reverseGraph = buildReverseDependencyGraph(itinerary.bookings);

  // Validate: disrupted booking must exist in this itinerary
  const disruptedBooking = bookingMap.get(disruption.bookingId);
  if (!disruptedBooking) {
    throw new Error(
      `Disruption references unknown bookingId: "${disruption.bookingId}"`
    );
  }

  // -----------------------------------------------------------------------
  // STEP 1: Compute effective end times for every booking in the itinerary.
  //
  // We process bookings in topological order (dependencies before dependents)
  // so that when we compute a booking's effective end time, all its
  // dependencies' effective end times are already known.
  //
  // effectiveEndTimes[id] = the "real" end time of booking `id`, accounting
  //   for any cascading delays that have propagated from the disruption.
  // -----------------------------------------------------------------------
  const effectiveEndTimes = new Map<string, Date>();

  // Topological sort: simple iterative approach using a queue.
  // A booking is "ready" when all its dependencies have been processed.
  const inDegree = new Map<string, number>();
  for (const booking of itinerary.bookings) {
    inDegree.set(booking.id, booking.dependsOn.length);
  }

  // Queue starts with all bookings that have no dependencies (in-degree 0)
  const queue: string[] = [];
  for (const booking of itinerary.bookings) {
    if (booking.dependsOn.length === 0) {
      queue.push(booking.id);
    }
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    topoOrder.push(currentId);

    // Decrement in-degree of all downstream bookings
    const downstream = reverseGraph.get(currentId) ?? [];
    for (const downId of downstream) {
      const newDegree = (inDegree.get(downId) ?? 0) - 1;
      inDegree.set(downId, newDegree);
      if (newDegree === 0) {
        queue.push(downId);
      }
    }
  }

  // -----------------------------------------------------------------------
  // STEP 2: Walk the topological order, computing effective end times.
  //
  // For the disrupted booking:
  //   - If delay: effectiveEnd = originalEnd + delayMinutes
  //   - If cancellation: mark as "no end time" (undefined in map)
  //
  // For each subsequent booking:
  //   - Find the latest effective end time of all its dependencies.
  //   - Compute available buffer = booking.startTime − latestDepEnd.
  //   - If available < bufferMinutes, the booking's effective start is pushed out.
  //   - effectiveEnd = effectiveStart + duration (preserve trip duration).
  // -----------------------------------------------------------------------

  for (const bookingId of topoOrder) {
    const booking = bookingMap.get(bookingId)!;

    if (bookingId === disruption.bookingId) {
      // Apply the disruption directly to the source booking
      if (disruption.disruptionType === "cancellation") {
        // Cancelled: no effective end time. Downstream checks will handle this.
        effectiveEndTimes.set(bookingId, new Date(NaN)); // NaN = "does not exist"
      } else {
        // Delay: shift end time forward
        const original = parseTime(booking.endTime);
        const delayed = addMinutes(original, disruption.delayMinutes ?? 0);
        effectiveEndTimes.set(bookingId, delayed);
      }
      continue;
    }

    // For non-disrupted bookings: check if any of their dependencies
    // have cascading delays that affect this booking's feasibility.
    if (booking.dependsOn.length === 0) {
      // No dependencies: store the correct reference time for THIS booking's type.
      // Hotels store startTime (check-in) — see getHotelReferenceTime() for rationale.
      effectiveEndTimes.set(bookingId, getHotelReferenceTime(booking));
      continue;
    }

    // Find the latest effective reference time among all direct dependencies.
    // Each dependency contributes its own type-correct reference time.
    let latestDepEndTime: Date | null = null;
    for (const depId of booking.dependsOn) {
      const depEffectiveEnd = effectiveEndTimes.get(depId);
      if (!depEffectiveEnd) continue;
      if (isNaN(depEffectiveEnd.getTime())) {
        // A dependency was cancelled — this booking is automatically broken
        latestDepEndTime = new Date(NaN);
        break;
      }
      if (latestDepEndTime === null || depEffectiveEnd > latestDepEndTime) {
        latestDepEndTime = depEffectiveEnd;
      }
    }

    if (!latestDepEndTime || isNaN(latestDepEndTime.getTime())) {
      // Can't determine dep end — carry forward NaN (dependency was cancelled)
      effectiveEndTimes.set(bookingId, new Date(NaN));
      continue;
    }

    // Compute how much buffer is actually available
    const bookingStart = parseTime(booking.startTime);
    const availableBuffer = minutesBetween(latestDepEndTime, bookingStart);

    if (availableBuffer < booking.bufferMinutes) {
      // Buffer is insufficient: booking's effective start must be pushed out.
      // effectiveStart = latestDepEnd + requiredBuffer
      const effectiveStart = addMinutes(latestDepEndTime, booking.bufferMinutes);
      const originalDuration = minutesBetween(
        parseTime(booking.startTime),
        parseTime(booking.endTime)
      );
      const effectiveEnd = addMinutes(effectiveStart, originalDuration);
      // Store the type-correct reference time for THIS (now-shifted) booking.
      // For hotels: effectiveStart IS the shifted check-in → store that.
      // For others: store effectiveEnd (arrival time after the pushed duration).
      effectiveEndTimes.set(
        bookingId,
        booking.type === 'hotel' ? effectiveStart : effectiveEnd
      );
    } else {
      // Buffer is fine: store type-correct reference time.
      effectiveEndTimes.set(bookingId, getHotelReferenceTime(booking));
    }
  }

  // -----------------------------------------------------------------------
  // STEP 3: BFS from the disrupted booking through the reverse graph.
  // Collect all bookings that are directly or transitively downstream.
  // Then check each one against the effective end times to determine impact.
  // -----------------------------------------------------------------------
  const impacted: ImpactedBooking[] = [];
  const visited = new Set<string>();
  const bfsQueue: string[] = [disruption.bookingId];

  while (bfsQueue.length > 0) {
    const currentId = bfsQueue.shift()!;

    // Visit all downstream bookings of the current node
    const downstream = reverseGraph.get(currentId) ?? [];
    for (const downId of downstream) {
      if (visited.has(downId)) continue;
      visited.add(downId);
      bfsQueue.push(downId); // Continue BFS deeper

      const downBooking = bookingMap.get(downId)!;
      const downEffectiveEnd = effectiveEndTimes.get(downId);

      // If the effective end is NaN, the booking is BROKEN (dep was cancelled)
      if (!downEffectiveEnd || isNaN(downEffectiveEnd.getTime())) {
        impacted.push({
          booking: downBooking,
          reason: disruption.disruptionType === "cancellation"
            ? `Dependency "${disruption.bookingId}" was cancelled — this booking can no longer be fulfilled`
            : `Dependency chain leads to a cancelled booking`,
          bufferShortfallMinutes: Infinity,
          severity: "broken",
        });
        continue;
      }

      // Compute actual buffer for this booking
      let latestDepEnd: Date | null = null;
      for (const depId of downBooking.dependsOn) {
        const depEff = effectiveEndTimes.get(depId);
        if (!depEff || isNaN(depEff.getTime())) continue;
        if (latestDepEnd === null || depEff > latestDepEnd) {
          latestDepEnd = depEff;
        }
      }

      if (!latestDepEnd) continue;

      const bookingStart = parseTime(downBooking.startTime);
      const availableBuffer = minutesBetween(latestDepEnd, bookingStart);
      const shortfall = downBooking.bufferMinutes - availableBuffer;

      if (shortfall > 0) {
        // Buffer shortage — classify severity
        const severity = shortfall >= downBooking.bufferMinutes ? "broken" : "at-risk";
        const needed = downBooking.bufferMinutes;
        const available = Math.round(availableBuffer);

        // effectiveDelayMinutes = how far forward the booking's start must
        // shift: (latestDepEnd + requiredBuffer) − originalStart.
        // This is what the UI needs to show "~~09:30~~ → 12:45", not
        // the shortfall (which is only the missing buffer slice).
        const effectiveStart = addMinutes(latestDepEnd, downBooking.bufferMinutes);
        const effectiveDelayMinutes = Math.round(
          minutesBetween(parseTime(downBooking.startTime), effectiveStart)
        );

        impacted.push({
          booking: downBooking,
          reason:
            `Insufficient buffer: needs ${needed} min, ` +
            `only ${available} min available after cascading delay. ` +
            `Shortfall: ${Math.round(shortfall)} min.`,
          bufferShortfallMinutes: Math.round(shortfall),
          effectiveDelayMinutes,
          severity,
        });
      }
    }
  }

  return impacted;
}

// =============================================================================
// PROACTIVE FUNCTION: getAtRiskConnections
//
// Checks the itinerary WITHOUT any disruption and flags any booking-pairs
// where the scheduled buffer is uncomfortably tight. This powers the
// "proactive warnings" feature in the UI.
//
// A connection is flagged if:
//   - riskLevel = 'critical': available buffer < required bufferMinutes
//     (this booking is ALREADY cutting it too close even without disruption)
//   - riskLevel = 'tight': available buffer is within 30 minutes of the minimum
//     (still fine, but one small hiccup breaks it)
//
// PARAMETERS:
//   itinerary - The full trip (no disruption needed)
//
// RETURNS:
//   Array of AtRiskConnection, sorted by bufferShortfallMinutes descending
//   (worst cases first).
// =============================================================================
export function getAtRiskConnections(
  itinerary: Itinerary
): AtRiskConnection[] {
  const bookingMap = buildBookingMap(itinerary.bookings);
  const TIGHT_THRESHOLD_MINUTES = 30; // If buffer - required < 30 min, flag as 'tight'

  const atRisk: AtRiskConnection[] = [];

  for (const booking of itinerary.bookings) {
    if (booking.dependsOn.length === 0) continue; // No dependencies, nothing to check

    for (const depId of booking.dependsOn) {
      const depBooking = bookingMap.get(depId);
      if (!depBooking) continue;

      // Use the type-correct reference time: check-in for hotels, arrival for others.
      const depEnd = getHotelReferenceTime(depBooking);
      const bookingStart = parseTime(booking.startTime);
      const availableBuffer = minutesBetween(depEnd, bookingStart);
      const shortfall = booking.bufferMinutes - availableBuffer;

      if (shortfall > 0) {
        // Already critical: the schedule is infeasible even without disruption
        atRisk.push({
          booking,
          dependencyBooking: depBooking,
          bufferRemaining: Math.round(availableBuffer),
          bufferShortfallMinutes: Math.round(shortfall),
          riskLevel: "critical",
        });
      } else {
        const surplus = availableBuffer - booking.bufferMinutes;
        if (surplus <= TIGHT_THRESHOLD_MINUTES) {
          // Tight: technically fine, but any small delay breaks it.
          // surplus = 0 means exactly on the limit (still counts as tight).
          atRisk.push({
            booking,
            dependencyBooking: depBooking,
            bufferRemaining: Math.round(availableBuffer),
            bufferShortfallMinutes: 0, // Not a shortfall yet, just tight
            riskLevel: "tight",
          });
        }
      }
    }
  }

  // Sort: critical first, then by shortfall magnitude
  return atRisk.sort((a, b) => {
    if (a.riskLevel === "critical" && b.riskLevel !== "critical") return -1;
    if (a.riskLevel !== "critical" && b.riskLevel === "critical") return 1;
    return b.bufferShortfallMinutes - a.bufferShortfallMinutes;
  });
}

// =============================================================================
// PROACTIVE FUNCTION: calculateTripRiskScore
//
// Computes an overall itinerary scheduling robustness score (0-100).
// 100 = perfectly resilient / safe schedule.
//
// Optionally accepts `disruptions` to score the POST-DISRUPTION state:
//   - Delay disruptions: shifts the affected booking's endTime forward so
//     that downstream buffer gaps are correctly widened in the analysis.
//   - Cancellation disruptions: removes the booking entirely so every
//     downstream booking that dependsOn it becomes orphaned / broken.
//   - Each impacted booking in `impactedBookings` adds an extra flat penalty
//     (broken = -25 pts, at-risk = -10 pts) on top of the buffer analysis.
//
// Uses getAtRiskConnections(itinerary) as the base ground-truth signal.
// Calibrated weights:
//   - Critical connection (buffer shortfall): 20 pts base + 1 pt per
//     shortfall minute, capped at 40 pts total
//   - Tight connection with 0 min surplus: 28 pts (razor-thin, zero slack)
//   - Tight connection with 1-15 min surplus: 20 pts
//   - Tight connection with 16-30 min surplus: 14 pts
//
// Non-linear diminishing returns multipliers (by severity rank):
//   - 1st: 1.00 (100%)
//   - 2nd: 0.75 (75%)
//   - 3rd: 0.50 (50%)
//   - 4th: 0.35 (35%)
//   - 5th+: 0.25 (25%)
//
// Thresholds:
//   - 'low': score >= 75
//   - 'moderate': 40 <= score < 75
//   - 'high': score < 40
// =============================================================================
export function calculateTripRiskScore(
  itinerary: Itinerary,
  disruptions?: Disruption[],
  impactedBookings?: ImpactedBooking[]
): TripRiskScore {
  // Build a virtual itinerary snapshot that reflects active disruptions.
  // This is done purely for the buffer-gap calculation below — the original
  // itinerary object is never mutated.
  let scoringItinerary: Itinerary = itinerary;
  if (disruptions && disruptions.length > 0) {
    const cancelledIds = new Set(
      disruptions.filter((d) => d.disruptionType === 'cancellation').map((d) => d.bookingId)
    );
    const virtualBookings: Booking[] = itinerary.bookings
      .filter((b) => !cancelledIds.has(b.id))
      .map((b) => {
        const delay = disruptions.find(
          (d) => d.bookingId === b.id && d.disruptionType === 'delay'
        );
        if (delay && delay.delayMinutes) {
          // Shift endTime forward by the delay so downstream buffers collapse
          const shiftedEnd = addMinutes(parseTime(b.endTime), delay.delayMinutes);
          return { ...b, endTime: shiftedEnd.toISOString() };
        }
        return b;
      });
    scoringItinerary = { ...itinerary, bookings: virtualBookings };
  }
  const atRiskConns = getAtRiskConnections(scoringItinerary);

  const BASE_WEIGHTS = {
    critical: 20,
    zeroSlack: 28,
    moderateSlack: 20,
    comfortableSlack: 14,
  };

  const DECAY_FACTORS = [1.0, 0.75, 0.5, 0.35, 0.25];

  // First extract raw points and reasons for each connection
  const rawLegs = atRiskConns.map((conn) => {
    const isCritical = conn.riskLevel === "critical";
    const surplus = conn.bufferRemaining - conn.booking.bufferMinutes;

    let rawPoints = 0;
    let baseReason = "";

    if (isCritical) {
      rawPoints = BASE_WEIGHTS.critical + Math.min(20, conn.bufferShortfallMinutes);
      baseReason = `Infeasible schedule: ${conn.bufferShortfallMinutes} min shortfall before start time.`;
    } else if (surplus <= 0) {
      rawPoints = BASE_WEIGHTS.zeroSlack;
      baseReason = `Zero margin: ${conn.bufferRemaining} min transfer window leaves 0 min buffer for upstream delays.`;
    } else if (surplus <= 15) {
      rawPoints = BASE_WEIGHTS.moderateSlack;
      baseReason = `Tight buffer: ${conn.bufferRemaining} min available provides only ${surplus} min safety margin.`;
    } else {
      rawPoints = BASE_WEIGHTS.comfortableSlack;
      baseReason = `Limited buffer: ${conn.bufferRemaining} min available provides ${surplus} min safety margin.`;
    }

    const depTitle = conn.dependencyBooking.title.split(" — ")[0];
    const arrTitle = conn.booking.title.split(" — ")[0];
    const connectionLabel = `${depTitle} → ${arrTitle}`;

    return {
      bookingId: conn.booking.id,
      connectionLabel,
      rawPoints,
      baseReason,
    };
  });

  // Sort descending by raw severity so worst offender gets 1.0 factor
  rawLegs.sort((a, b) => b.rawPoints - a.rawPoints);

  // Apply diminishing returns factor according to severity rank
  const legRisks = rawLegs.map((item, idx) => {
    const factor =
      idx < DECAY_FACTORS.length
        ? DECAY_FACTORS[idx]
        : DECAY_FACTORS[DECAY_FACTORS.length - 1];
    const riskContribution = Math.round(item.rawPoints * factor);
    return {
      bookingId: item.bookingId,
      connectionLabel: item.connectionLabel,
      riskContribution,
      reason: item.baseReason,
    };
  });

  const totalDeductions = legRisks.reduce(
    (sum, item) => sum + item.riskContribution,
    0
  );

  // Extra flat penalty per disrupted booking (layered on top of buffer gaps).
  // broken = -25 pts each, at-risk = -10 pts each.
  const disruptionPenalty = (impactedBookings ?? []).reduce((sum, ib) => {
    return sum + (ib.severity === 'broken' ? 25 : 10);
  }, 0);

  const bufferScore = Math.max(0, Math.min(100, 100 - totalDeductions - disruptionPenalty));

  // --- PILLAR 2: Financial Cancellation Exposure (25%) ---
  const totalCost = itinerary.bookings.reduce((sum, b) => sum + (b.cost || 0), 0);
  let nonRefundableCost = 0;
  for (const b of itinerary.bookings) {
    if (b.cancellationPolicy?.policy === "non-refundable") {
      nonRefundableCost += b.cost || 0;
    } else if (b.cancellationPolicy?.policy === "partial-refund") {
      const refundPercent = b.cancellationPolicy.refundPercent ?? 50;
      nonRefundableCost += Math.round((b.cost || 0) * (1 - refundPercent / 100));
    }
  }
  const nonRefundablePercent = totalCost > 0 ? Math.round((nonRefundableCost / totalCost) * 100) : 0;
  // Score: 100 = fully refundable, scaled down to 30 if 100% non-refundable
  const financialScore = Math.round(Math.max(25, 100 - (nonRefundablePercent * 0.72)));

  // --- PILLAR 3: Critical Path & Single Point of Failure (25%) ---
  // Identify chokepoint bookings that have 2 or more downstream bookings depending on them
  const downstreamCounts = new Map<string, number>();
  for (const b of itinerary.bookings) {
    for (const depId of b.dependsOn) {
      downstreamCounts.set(depId, (downstreamCounts.get(depId) ?? 0) + 1);
    }
  }

  const chokepointBookings: Booking[] = [];
  for (const [bId, count] of downstreamCounts.entries()) {
    if (count >= 2) {
      const found = itinerary.bookings.find((b) => b.id === bId);
      if (found) chokepointBookings.push(found);
    }
  }

  // Chokepoints with tight buffers or high penalties degrade critical path health
  let criticalPathPenalty = 0;
  for (const cp of chokepointBookings) {
    const isAtRisk = atRiskConns.some((c) => c.booking.id === cp.id || c.dependencyBooking.id === cp.id);
    criticalPathPenalty += isAtRisk ? 28 : 12;
  }
  const criticalPathScore = Math.max(30, Math.min(100, 100 - criticalPathPenalty));

  // --- PILLAR 4: Alternative Redundancy & Recovery Slack (15%) ---
  // Legs arriving late at night (>20:00) have low same-day redundancy
  let lateArrivalCount = 0;
  for (const b of itinerary.bookings) {
    if (b.type === "flight" || b.type === "train") {
      const endHour = new Date(b.endTime).getHours();
      if (endHour >= 20 || endHour <= 4) {
        lateArrivalCount++;
      }
    }
  }
  const redundancyPenalty = lateArrivalCount * 18;
  const redundancyScore = Math.max(35, Math.min(100, 100 - redundancyPenalty));

  // `overallScore` remains the connection-based Trip Risk Score. The audit
  // factors below are supplementary context and must never replace it with a
  // weighted composite.
  const overallScore = bufferScore;

  const level: "low" | "moderate" | "high" =
    overallScore >= 75 ? "low" : overallScore >= 40 ? "moderate" : "high";

  // --- ACTIONABLE RESILIENCE RECOMMENDATIONS ---
  const recommendations: import("./types").ResilienceRecommendation[] = [];

  if (atRiskConns.length > 0) {
    const worst = atRiskConns[0];
    const surplus = worst.bufferRemaining - worst.booking.bufferMinutes;
    const recommendedExtension = Math.max(30, 45 - Math.max(0, surplus));
    recommendations.push({
      id: `rec-buffer-${worst.booking.id}`,
      type: "buffer",
      title: `Extend ${worst.booking.title.split(" — ")[0]} transfer buffer by +${recommendedExtension} min`,
      description: `Current connection has only ${worst.bufferRemaining}m slack. Adding a ${recommendedExtension}m buffer absorbs upstream flight/train delays safely.`,
      targetBookingId: worst.booking.id,
    });
  }

  if (nonRefundablePercent >= 40) {
    recommendations.push({
      id: "rec-policy-protection",
      type: "policy",
      title: `Protect ₹${nonRefundableCost.toLocaleString("en-IN")} in non-refundable bookings`,
      description: `${nonRefundablePercent}% of itinerary spend has zero cancellation refund. Consider flexible rebooking protection or travel delay insurance.`,
    });
  }

  if (chokepointBookings.length > 0) {
    const cp = chokepointBookings[0];
    recommendations.push({
      id: `rec-chokepoint-${cp.id}`,
      type: "routing",
      title: `Decouple secondary activities from ${cp.title.split(" — ")[0]}`,
      description: `${downstreamCounts.get(cp.id)} subsequent activities depend directly on this leg. Allow independent scheduling to prevent single-point-of-failure cascades.`,
      targetBookingId: cp.id,
    });
  }

  const pillars: import("./types").ResiliencePillars = {
    bufferHealth: {
      score: bufferScore,
      weight: 0.35,
      label: "Buffer & Slack Health",
      description: `${atRiskConns.length === 0 ? "All connection windows meet buffer targets." : `${atRiskConns.length} connection(s) operate under tight timing margins.`}`,
      tightConnectionsCount: atRiskConns.length,
    },
    financialExposure: {
      score: financialScore,
      weight: 0.25,
      nonRefundableTotal: nonRefundableCost,
      nonRefundablePercent,
      label: "Cancellation & Refund Protection",
      description: `₹${nonRefundableCost.toLocaleString("en-IN")} (${nonRefundablePercent}% of trip) is non-refundable if disrupted.`,
    },
    criticalPathRisk: {
      score: criticalPathScore,
      weight: 0.25,
      chokepointsCount: chokepointBookings.length,
      chokepointLabels: chokepointBookings.map((b) => b.title.split(" — ")[0]),
      label: "Single Point of Failure / Hubs",
      description: `${chokepointBookings.length} hub booking(s) hold up downstream branches.`,
    },
    alternativeRedundancy: {
      score: redundancyScore,
      weight: 0.15,
      label: "Same-Day Redundancy",
      description: `${lateArrivalCount === 0 ? "Favorable flight arrival times with ample same-day rebooking options." : `${lateArrivalCount} late-night arrival(s) limit same-day recovery options.`}`,
    },
  };

  const auditSummary =
    atRiskConns.length === 0
      ? `Schedule buffers meet their targets. ${nonRefundablePercent}% of trip spend remains exposed to cancellation terms.`
      : `${atRiskConns.length} connection(s) need attention. The factor detail below identifies buffer, financial, dependency, and recovery considerations.`;

  return {
    overallScore,
    level,
    legRisks,
    pillars,
    recommendations,
    auditSummary,
  };
}

// =============================================================================
// ADDITIVE EXPORT: detectCombinedImpact
//
// Handles up to 3 concurrent disruptions on the same itinerary.
// Calls the existing detectImpact() once per disruption — NO logic duplication.
//
// Merge rules for a booking that appears in multiple impact sets:
//   severity            → worst across all (broken > at-risk)
//   bufferShortfallMins → Math.max() of all  (worst case, NOT sum — avoids double-count)
//   reason              → all causes concatenated clearly
//   compoundDisruptionCount → 2  (powers the compound badge; always 2 = "multi-factor")
//
// Single-disruption passthrough:
//   When disruptions.length === 1, every booking falls into the
//   "only in A" branch → output is identical to detectImpact().
//
// DOES NOT MODIFY detectImpact. Safe to call alongside it.
// =============================================================================
export function detectCombinedImpact(
  itinerary: Itinerary,
  disruptions: Disruption[]
): ImpactedBooking[] {
  if (disruptions.length === 0) return [];

  // Single-disruption passthrough: identical to existing detectImpact path
  if (disruptions.length === 1) {
    return detectImpact(itinerary, disruptions[0]);
  }

  // Run independent BFS traversals for each disruption (up to 3 supported)
  const allResults = disruptions.map((d) => detectImpact(itinerary, d));

  // Build O(1) lookup maps keyed by bookingId, one per disruption
  const allMaps = allResults.map(
    (result) => new Map<string, ImpactedBooking>(result.map((ib) => [ib.booking.id, ib]))
  );

  // Union of all affected booking IDs across every disruption
  const allIds = new Set<string>(allMaps.flatMap((m) => [...m.keys()]));

  const merged: ImpactedBooking[] = [];

  for (const id of allIds) {
    const hits = allMaps.map((m) => m.get(id)).filter((x): x is ImpactedBooking => x !== undefined);

    if (hits.length === 1) {
      // Only one disruption impacts this booking — pass through unchanged
      merged.push(hits[0]);
    } else {
      // COMPOUND: multiple disruptions hit this booking
      // Rule 1: severity — take the worst (broken > at-risk)
      const severity: 'at-risk' | 'broken' =
        hits.some((h) => h.severity === 'broken') ? 'broken' : 'at-risk';

      // Rule 2: bufferShortfallMinutes — take max (worst-case, NOT sum)
      const bufferShortfallMinutes = Math.max(...hits.map((h) => h.bufferShortfallMinutes));

      // Rule 3: reason — all causes, clearly labelled
      const reason = `Broken by ${hits.length} factors: ` +
        hits.map((h, i) => `[Factor ${i + 1}: ${h.reason}]`).join(' AND ');

      merged.push({
        booking: hits[0].booking, // all hits refer to the same source booking
        reason,
        bufferShortfallMinutes,
        severity,
        compoundDisruptionCount: 2, // UI badge: always 2 = "multi-factor compound"
      });
    }
  }

  return merged;
}
