# planB — Standout Hackathon Features Implementation Plan

This document outlines the high-impact competitive features designed to make **planB** stand out against every other team in the hackathon.

---

## 🏆 Feature Roadmap (High to Low Priority)

| Rank | Feature | Why It Wins Hackathons | Complexity | Status |
|:---:|:---|:---|:---:|:---:|
| **1** | **Multi-Factor Resilience Score & Proactive Audit Engine** | Moves platform from *reactive panic tool* to *proactive travel intelligence*. Evaluates Buffer Health, Financial Refund Risk, Dependency Criticality, and Alternative Availability. | High | ✅ Complete |
| **2** | **Traveler Persona & Dynamic Preference Weighting** | Solves the core hackathon requirement: travelers care about different trade-offs (Budget vs. Speed vs. Minimal Disruption). Dynamic re-ranking with match percentages. | High | ✅ Complete |
| **3** | **Interactive Animated Ripple Cascade in Dependency Graph** | Unforgettable visual demo for judges: click any node or run cascade to watch the failure propagate across time and space with pulse waves. | High | ✅ Complete |
| **4** | **"What-If?" Proactive Scenario Sandbox** | Allows travelers and ops teams to simulate disruptions before they happen (e.g., "What if flight delayed 2h?"), preview downstream costs, and prepare backup plans risk-free. | Medium | ✅ Complete |

---

## Feature 1: Multi-Factor Resilience Score & Proactive Audit Engine (HIGH) — ✅ COMPLETE
- **4 Composite Sub-Scores**:
  1. **Buffer Health (35%)**: Ratio of available buffer to required buffer across all dependent connections.
  2. **Financial Risk Exposure (25%)**: Computes non-refundable total and ratio vs total trip cost.
  3. **Critical Path & Single Point of Failure (25%)**: Identification of "chokepoint" nodes where a failure collapses 2+ downstream bookings.
  4. **Alternative Redundancy (15%)**: Assesses whether alternatives (e.g., same-day flights/trains) are feasible.
- **Actionable Resilience Fixes**: Concrete recommendations that simulate score gains (e.g., *"Extend Delhi transfer buffer by +45m to gain +14 resilience points"*).
- **ResilienceAuditModal**: Accessible via the "AUDIT REPORT" button in `TripRiskBadge`, complete with print manifest, 4-pillar breakdown meters, and interactive simulation.

---

## Feature 2: Traveler Preference Engine & Multi-Criteria Recovery Scoring (HIGH-MID) — ✅ COMPLETE
- **Persona Presets**:
  - 🎒 **Budget Explorer**: Heavily penalizes added cost; accepts modest delays or off-peak slots.
  - ⚡ **Time-Critical / Business**: Prioritizes earliest arrival and minimum schedule slippage; budget is flexible.
  - 🧘 **Low-Stress / Minimal Changes**: Minimizes rebooked legs; keeps remaining hotels & tours intact.
  - ⚖️ **Balanced**: Equal balance between cost, speed, and schedule continuity.
- **Custom Sliders**: Fine-tune Cost Sensitivity, Time Urgency, and Schedule Continuity percentages.
- **Dynamic Re-Ranking**: Real-time re-scoring of recovery plans with transparent match scores (e.g. `98% MATCH FOR BUDGET EXPLORER`) displayed on each recovery option card.

---

## Feature 3: Interactive Animated Ripple Cascade in Dependency Graph (MID-HIGH) — ✅ COMPLETE
- **Live Ripple Simulation**:
  - Click any node in the Dependency Graph to trigger an automated cascade simulation.
  - Watch the pulse wave emanate from the origin node along dependency edges.
  - Native SVG `<animateMotion>` traveling glowing particles along bezier edges.
  - Step-by-step controller: `[PLAY]`, `[PAUSE]`, `[PREV]`, `[NEXT]`, and `[RESET]` with live textual explanation of failure propagation.

---

## Feature 4: "What-If?" Proactive Scenario Sandbox (MID) — ✅ COMPLETE
- **Non-Destructive Sandbox Mode**:
  - Quick scenario presets in the Dispatch Manifest:
    - ⚡ `3-Hour Flight Hold`
    - 🌧️ `Monsoon Storm Cancellation`
    - 🚕 `+45m Airport Gridlock`
  - High-visibility Amber Sandbox Banner showing simulated delay/cancellation and downstream ripple without modifying saved trip data.
  - Instant options to:
    - `COMMIT TO LIVE TRIP`: Promotes simulation into an active disruption and triggers recovery re-accommodation.
    - `EXIT SANDBOX`: Restores normal live itinerary view.
  - Full integration with Natural Language `DisruptionAssistant` so travelers can simulate custom queries safely before committing.
