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
      // No dependencies: effective end time = original end time
      effectiveEndTimes.set(bookingId, parseTime(booking.endTime));
      continue;
    }

    // Find the latest "effective end" among all direct dependencies
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
      effectiveEndTimes.set(bookingId, effectiveEnd);
    } else {
      // Buffer is fine: effective end = original end
      effectiveEndTimes.set(bookingId, parseTime(booking.endTime));
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

        impacted.push({
          booking: downBooking,
          reason:
            `Insufficient buffer: needs ${needed} min, ` +
            `only ${available} min available after cascading delay. ` +
            `Shortfall: ${Math.round(shortfall)} min.`,
          bufferShortfallMinutes: Math.round(shortfall),
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

      const depEnd = parseTime(depBooking.endTime);
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
// Uses getAtRiskConnections(itinerary) as the base ground-truth signal.
// Calibrated weights:
//   - Critical connection (buffer shortfall): -40 pts
//   - Tight connection with 0 min surplus: -28 pts (razor-thin, zero slack)
//   - Tight connection with 1-15 min surplus: -20 pts
//   - Tight connection with 16-30 min surplus: -14 pts
//
// Thresholds:
//   - 'low': score >= 75
//   - 'moderate': 40 <= score < 75
//   - 'high': score < 40
// =============================================================================
export function calculateTripRiskScore(itinerary: Itinerary): TripRiskScore {
  const atRiskConns = getAtRiskConnections(itinerary);

  const legRisks = atRiskConns.map((conn) => {
    const isCritical = conn.riskLevel === "critical";
    const surplus = conn.bufferRemaining - conn.booking.bufferMinutes;

    let riskContribution = 0;
    let reason = "";

    if (isCritical) {
      riskContribution = 40;
      reason = `Infeasible schedule: ${conn.bufferShortfallMinutes} min shortfall before start time.`;
    } else if (surplus <= 0) {
      riskContribution = 28;
      reason = `Zero margin: ${conn.bufferRemaining} min transfer window leaves 0 min buffer for upstream delays.`;
    } else if (surplus <= 15) {
      riskContribution = 20;
      reason = `Tight buffer: ${conn.bufferRemaining} min available provides only ${surplus} min safety margin.`;
    } else {
      riskContribution = 14;
      reason = `Limited buffer: ${conn.bufferRemaining} min available provides ${surplus} min safety margin.`;
    }

    const depTitle = conn.dependencyBooking.title.split(" — ")[0];
    const arrTitle = conn.booking.title.split(" — ")[0];
    const connectionLabel = `${depTitle} → ${arrTitle}`;

    return {
      bookingId: conn.booking.id,
      connectionLabel,
      riskContribution,
      reason,
    };
  });

  // Sort legRisks by riskContribution descending (worst offender first)
  legRisks.sort((a, b) => b.riskContribution - a.riskContribution);

  const totalDeductions = legRisks.reduce(
    (sum, item) => sum + item.riskContribution,
    0
  );
  const overallScore = Math.max(0, Math.min(100, 100 - totalDeductions));

  const level: "low" | "moderate" | "high" =
    overallScore >= 75 ? "low" : overallScore >= 40 ? "moderate" : "high";

  return {
    overallScore,
    level,
    legRisks,
  };
}

