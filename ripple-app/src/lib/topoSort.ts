// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: topoSort.ts
// PURPOSE: Topological sort for booking arrays that respects dependsOn links.
//
// WHY this exists:
//   A naive startTime sort breaks when a disruption shifts a booking's
//   startTime past a downstream booking's startTime.
//   Example: a 4-hour flight delay moves the flight from 06:15 → 10:15,
//   which is now *after* the dependent transfer at 09:30.
//   A time-only sort would put the transfer first — wrong both logically
//   and visually, since the transfer can't happen before the flight lands.
//
// ALGORITHM: Kahn's BFS topological sort.
//   Bookings with no dependencies are processed first (sorted by startTime
//   among themselves), then their dependents, and so on.
//   startTime is used only as a *tiebreaker within the same dependency wave*.
// =============================================================================

import type { Booking } from './types';

/**
 * Returns a new array of bookings ordered so that every booking appears
 * after all bookings it `dependsOn`, using `startTime` as a tiebreaker
 * within each dependency wave.
 *
 * Does NOT mutate the input array.
 */
export function topoSortBookings(bookings: Booking[]): Booking[] {
  const bookingMap = new Map<string, Booking>(bookings.map((b) => [b.id, b]));

  // Build in-degree map and reverse adjacency list (upstream → [downstream])
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const b of bookings) {
    // Only count deps that actually exist in this booking set
    const validDeps = b.dependsOn.filter((d) => bookingMap.has(d));
    inDegree.set(b.id, validDeps.length);
    for (const dep of validDeps) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(b.id);
    }
  }

  const result: Booking[] = [];

  // Seed the first wave with all root bookings (no dependencies), sorted by time
  let wave = bookings
    .filter((b) => (inDegree.get(b.id) ?? 0) === 0)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  while (wave.length > 0) {
    result.push(...wave);

    const nextWave: Booking[] = [];
    for (const b of wave) {
      for (const depId of dependents.get(b.id) ?? []) {
        const newDeg = (inDegree.get(depId) ?? 1) - 1;
        inDegree.set(depId, newDeg);
        if (newDeg === 0) {
          const dep = bookingMap.get(depId);
          if (dep) nextWave.push(dep);
        }
      }
    }

    // Sort within the next wave by startTime (tiebreaker only)
    wave = nextWave.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  // Safety net: if there are cycles or orphaned nodes, append them at the end
  if (result.length < bookings.length) {
    const seen = new Set(result.map((b) => b.id));
    for (const b of bookings) {
      if (!seen.has(b.id)) result.push(b);
    }
  }

  return result;
}
