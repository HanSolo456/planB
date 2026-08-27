// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: demo.ts
// PURPOSE: Runnable demo script showcasing the full disruption recovery flow.
//
// RUN WITH:
//   npx ts-node src/demo.ts
//
// This script demonstrates exactly what you'd show hackathon judges:
//   1. Load Itinerary A (Goa Getaway)
//   2. Proactive health check — spot the tight connection before any disruption
//   3. Simulate a 3-hour delay on the outbound flight
//   4. Detect the impact cascade across the itinerary
//   5. Generate ranked recovery options
//   6. Apply the top option and show the updated itinerary
// =============================================================================

import { itineraryA, itineraryB } from "./seedData";
import { detectImpact, getAtRiskConnections } from "./impactEngine";
import { generateRecoveryOptions, applyRecoveryOption } from "./recoveryEngine";
import type { Disruption, Itinerary, Booking, ImpactedBooking } from "./types";
import type { ScoredRecoveryOption } from "./types";

// ---------------------------------------------------------------------------
// CONSOLE UTILITIES — make the output readable and judge-friendly
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const RED   = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW= "\x1b[33m";
const CYAN  = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const DIM   = "\x1b[2m";

function header(title: string): void {
  const line = "═".repeat(70);
  console.log(`\n${BOLD}${CYAN}${line}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}${line}${RESET}\n`);
}

function subheader(title: string): void {
  console.log(`\n${BOLD}${MAGENTA}▶ ${title}${RESET}`);
  console.log(`${DIM}${"─".repeat(60)}${RESET}`);
}

function printBooking(booking: Booking, prefix = "  "): void {
  const statusColor =
    booking.status === "confirmed" ? GREEN :
    booking.status === "at-risk"   ? YELLOW :
    booking.status === "disrupted" ? RED :
    booking.status === "recovered" ? CYAN : DIM;

  const start = booking.startTime.substring(0, 16).replace("T", " ");
  const end   = booking.endTime.substring(0, 16).replace("T", " ");

  console.log(
    `${prefix}${BOLD}[${booking.type.toUpperCase().padEnd(8)}]${RESET} ` +
    `${booking.title.padEnd(40)} ` +
    `${DIM}${start} → ${end.substring(11)}${RESET} ` +
    `${statusColor}[${booking.status}]${RESET} ` +
    `${DIM}₹${booking.cost.toLocaleString("en-IN")}${RESET}`
  );

  if (booking.dependsOn.length > 0) {
    console.log(
      `${prefix}${DIM}  ↳ depends on: ${booking.dependsOn.join(", ")} ` +
      `(buffer: ${booking.bufferMinutes} min)${RESET}`
    );
  }
}

function printImpact(impact: ImpactedBooking, idx: number): void {
  const severityColor = impact.severity === "broken" ? RED : YELLOW;
  const severityLabel = impact.severity === "broken"
    ? `${RED}💀 BROKEN${RESET}`
    : `${YELLOW}⚠️  AT RISK${RESET}`;

  console.log(
    `\n  ${BOLD}${idx + 1}. ${impact.booking.title}${RESET} ${severityLabel}`
  );
  console.log(`     ${DIM}Type: ${impact.booking.type} | ID: ${impact.booking.id}${RESET}`);
  console.log(`     ${RED}→ ${impact.reason}${RESET}`);
  if (impact.bufferShortfallMinutes !== Infinity) {
    console.log(
      `     ${DIM}Buffer shortfall: ${impact.bufferShortfallMinutes} min${RESET}`
    );
  }
}

function printRecoveryOption(opt: ScoredRecoveryOption, idx: number): void {
  const rankEmoji = ["🥇", "🥈", "🥉", "4️⃣ "][idx] ?? `${idx + 1}.`;
  const costLabel =
    opt.costDelta > 0 ? `${RED}+₹${opt.costDelta.toLocaleString("en-IN")}${RESET}` :
    opt.costDelta < 0 ? `${GREEN}-₹${Math.abs(opt.costDelta).toLocaleString("en-IN")}${RESET}` :
    `${GREEN}No extra cost${RESET}`;

  console.log(`\n  ${rankEmoji} ${BOLD}${opt.description}${RESET}`);
  console.log(`     ${DIM}ID: ${opt.id}${RESET}`);
  console.log(`     📝 ${opt.humanReadableSummary}`);
  console.log(`     💰 Cost delta: ${costLabel}`);
  console.log(`     ⏱  Time delta: ${opt.timeDelta} min`);
  console.log(
    `     🗺  Itinerary impact score: ` +
    `${BOLD}${opt.itineraryImpactScore}/100${RESET} ` +
    `${DIM}(higher = more of trip intact)${RESET}`
  );
  console.log(
    `     ${BOLD}${GREEN}⭐ Composite score: ${opt.compositeScore}/100${RESET} ` +
    `${DIM}[itinerary:${opt.scoreBreakdown.itineraryScore} cost:${opt.scoreBreakdown.costScore} time:${opt.scoreBreakdown.timeScore}]${RESET}`
  );
  console.log(`     🔄 Replacement booking:`);
  printBooking(opt.replacementBooking, "        ");
}

// =============================================================================
// MAIN DEMO
// =============================================================================

function runDemo(): void {

  // =========================================================================
  // SECTION 0: Show the itinerary
  // =========================================================================
  header("PLAN B — TRAVEL DISRUPTION RECOVERY ENGINE  |  DEMO");

  console.log(`${BOLD}Traveler:${RESET}    ${itineraryA.travelerName}`);
  console.log(`${BOLD}Trip:${RESET}        ${itineraryA.destination}`);
  console.log(`${BOLD}Dates:${RESET}       ${itineraryA.startDate} → ${itineraryA.endDate}`);
  console.log(`${BOLD}Itinerary ID:${RESET} ${itineraryA.id}`);

  subheader("ORIGINAL ITINERARY");
  for (const booking of itineraryA.bookings) {
    printBooking(booking);
  }

  // =========================================================================
  // SECTION 1: Proactive health check BEFORE any disruption
  // =========================================================================
  header("STEP 1 — PROACTIVE CONNECTION HEALTH CHECK");

  console.log(
    `Scanning itinerary for tight connections BEFORE any disruption occurs...\n`
  );

  const atRisk = getAtRiskConnections(itineraryA);

  if (atRisk.length === 0) {
    console.log(`  ${GREEN}✓ All connections have healthy buffers.${RESET}`);
  } else {
    for (const conn of atRisk) {
      const riskColor = conn.riskLevel === "critical" ? RED : YELLOW;
      const riskLabel = conn.riskLevel === "critical"
        ? `${RED}🚨 CRITICAL${RESET}`
        : `${YELLOW}⚠️  TIGHT${RESET}`;

      console.log(`  ${riskLabel} ${BOLD}${conn.booking.title}${RESET}`);
      console.log(
        `         depends on → ${conn.dependencyBooking.title}`
      );
      console.log(
        `         Buffer available: ${conn.bufferRemaining} min | ` +
        `Required: ${conn.booking.bufferMinutes} min | ` +
        `${riskColor}Risk: ${conn.riskLevel}${RESET}`
      );
      if (conn.bufferShortfallMinutes > 0) {
        console.log(`         ${RED}Shortfall: ${conn.bufferShortfallMinutes} min even without any disruption!${RESET}`);
      }
      console.log();
    }
    console.log(
      `  ${YELLOW}⚠️  Found ${atRisk.length} tight connection(s). ` +
      `Even a small delay to the flight will break the transfer.${RESET}`
    );
  }

  // =========================================================================
  // SECTION 2: Simulate the disruption
  // =========================================================================
  header("STEP 2 — DISRUPTION EVENT RECEIVED");

  const disruption: Disruption = {
    bookingId: "flight_del_goi",
    disruptionType: "delay",
    delayMinutes: 180, // 3-hour delay
    reason: "Air Traffic Control hold due to heavy fog at DEL",
    timestamp: new Date().toISOString(),
  };

  console.log(`${RED}${BOLD}🚨 ALERT: Flight Disruption Detected!${RESET}`);
  console.log(`\n  Affected booking: ${BOLD}${disruption.bookingId}${RESET}`);
  console.log(`  Type:             ${BOLD}${disruption.disruptionType.toUpperCase()}${RESET}`);
  console.log(`  Delay:            ${BOLD}${RED}${disruption.delayMinutes} minutes (3 hours)${RESET}`);
  console.log(`  Reason:           ${disruption.reason}`);
  console.log(`  Detected at:      ${new Date(disruption.timestamp).toLocaleTimeString()}`);

  // =========================================================================
  // SECTION 3: Detect impact cascade
  // =========================================================================
  header("STEP 3 — IMPACT CASCADE ANALYSIS");

  console.log(
    `Running dependency graph traversal to find ALL affected bookings...\n`
  );

  const impacts = detectImpact(itineraryA, disruption);

  if (impacts.length === 0) {
    console.log(
      `  ${GREEN}✓ No downstream impact detected. ` +
      `All subsequent bookings have enough buffer.${RESET}`
    );
  } else {
    console.log(
      `  ${RED}${BOLD}Found ${impacts.length} affected booking(s):${RESET}`
    );
    for (let i = 0; i < impacts.length; i++) {
      printImpact(impacts[i], i);
    }
    console.log(
      `\n  ${DIM}Algorithm: Topological sort → BFS from disrupted node → ` +
      `buffer shortfall check at each downstream booking${RESET}`
    );
  }

  // =========================================================================
  // SECTION 4: Generate recovery options
  // =========================================================================
  header("STEP 4 — RECOVERY OPTIONS (Ranked by Composite Score)");

  console.log(
    `Generating alternatives for: ${BOLD}${disruption.bookingId}${RESET}\n`
  );
  console.log(
    `  ${DIM}Scoring weights: Itinerary Impact 50% | Cost 30% | Time 20%${RESET}`
  );

  const options = generateRecoveryOptions(itineraryA, disruption);

  for (let i = 0; i < options.length; i++) {
    printRecoveryOption(options[i], i);
  }

  // =========================================================================
  // SECTION 5: Apply the top recovery option
  // =========================================================================
  header("STEP 5 — APPLYING TOP RECOVERY OPTION");

  const topOption = options[0];
  console.log(
    `Applying: ${BOLD}${GREEN}${topOption.description}${RESET} ` +
    `(score: ${topOption.compositeScore}/100)\n`
  );

  const recoveredItinerary = applyRecoveryOption(itineraryA, topOption);

  console.log(`${BOLD}UPDATED ITINERARY:${RESET}`);
  console.log(`  ${DIM}ID: ${recoveredItinerary.id}${RESET}\n`);

  for (const booking of recoveredItinerary.bookings) {
    printBooking(booking);
  }

  // =========================================================================
  // SECTION 6: Summary
  // =========================================================================
  header("SUMMARY");

  const totalCostBefore = itineraryA.bookings.reduce((s, b) => s + b.cost, 0);
  const totalCostAfter  = recoveredItinerary.bookings.reduce((s, b) => s + b.cost, 0);
  const costChange      = totalCostAfter - totalCostBefore;

  console.log(`  Original trip cost:  ₹${totalCostBefore.toLocaleString("en-IN")}`);
  console.log(
    `  Recovered trip cost: ₹${totalCostAfter.toLocaleString("en-IN")} ` +
    `(${costChange >= 0 ? "+" : ""}₹${costChange.toLocaleString("en-IN")})`
  );
  console.log(`  Bookings impacted:   ${impacts.length}`);
  console.log(`  Recovery options:    ${options.length}`);
  console.log(
    `  Recovery applied:    ${GREEN}${BOLD}${topOption.description}${RESET}`
  );
  console.log(
    `  Itinerary score:     ${GREEN}${BOLD}${topOption.itineraryImpactScore}/100${RESET} ` +
    `— most of the trip stays intact!`
  );

  console.log(
    `\n${BOLD}${GREEN}✅ Recovery complete. Arjun's Goa trip is back on track.${RESET}\n`
  );

  // =========================================================================
  // BONUS: Run a quick demo of Itinerary B just to show the system works
  // for a different structure (optional for judges)
  // =========================================================================
  header("BONUS — ITINERARY B: Rajasthan Rail Trip (No Disruption, Health Check Only)");

  console.log(
    `${BOLD}Traveler:${RESET}    ${itineraryB.travelerName}`
  );
  console.log(`${BOLD}Trip:${RESET}        ${itineraryB.destination}`);

  subheader("Itinerary B Bookings");
  for (const booking of itineraryB.bookings) {
    printBooking(booking);
  }

  subheader("Itinerary B — Proactive Connection Check");
  const atRiskB = getAtRiskConnections(itineraryB);
  if (atRiskB.length === 0) {
    console.log(`  ${GREEN}✓ All connections are comfortable.${RESET}`);
  } else {
    for (const conn of atRiskB) {
      const riskLabel = conn.riskLevel === "critical"
        ? `${RED}🚨 CRITICAL${RESET}` : `${YELLOW}⚠️  TIGHT${RESET}`;
      console.log(
        `  ${riskLabel} ${conn.booking.title} ← ${conn.dependencyBooking.title} ` +
        `(${conn.bufferRemaining} min available, ${conn.booking.bufferMinutes} min required)`
      );
    }
  }

  console.log(`\n${DIM}=== End of Demo ===${RESET}\n`);
}

// Run it!
runDemo();
