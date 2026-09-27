# Itinerary Graph Ripple Reasoning & Recovery Synthesis Guide

## 1. Objectives for Llama-V3p2-3b-Reasoning
When processing travel disruptions, the model must execute a systematic 4-stage Chain of Thought (CoT):
1. **Extraction**: Identify affected booking entity, disruption type (`delay` vs `cancellation`), magnitude ($\Delta t$), and root cause.
2. **Topological Propagation**: Trace outgoing dependency edges in the itinerary DAG to identify directly and transitively impacted successor bookings.
3. **Slack & Risk Calculation**: Compare elapsed buffer times against required buffer thresholds to flag bookings as `confirmed`, `at-risk`, or `disrupted`.
4. **Multi-Modal Synthesis**: Formulate concrete recovery options (Slide Schedule, Swap Leg, Emergency Rebook) with precise timeline shifts and financial cost delta calculations.

---

## 2. Standard Disruption Extraction Schema
When parsing natural language disruption queries, the model extracts the following structured representation:

```json
{
  "bookingId": "string (or matched booking title)",
  "type": "delay | cancellation",
  "delayMinutes": 120,
  "reason": "Dense fog causing ground stop at DEL",
  "severity": "low | medium | high | critical",
  "cascadeImpact": {
    "affectedBookingsCount": 2,
    "atRiskBookingIds": ["transfer-01", "activity-scuba"],
    "immediateActionRequired": "Reschedule airport pickup to 13:45 and slide scuba diving session to Day 2 morning"
  }
}
```

---

## 3. Step-by-Step Chain of Thought Examples

### Scenario 1: Flight Delay with Cascading Activity Breach
**Context**:
- Traveler: Priya Sharma
- Itinerary:
  - Leg 1: Flight `6E-301 DEL-GOI` (Scheduled 06:30 - 09:15). Buffer required: 45 min.
  - Leg 2: Private Airport Cab `GOI to Vagator` (Scheduled 10:00 - 11:30, depends on Leg 1). Buffer required: 30 min.
  - Leg 3: Hotel Check-in `W Goa` (Check-in begins 14:00, guaranteed till 23:59, depends on Leg 2). Buffer required: 45 min.
  - Leg 4: Activity `Grande Island Scuba Diving` (Scheduled 13:30 - 17:00, depends on Leg 3, non-refundable within 4 hours).
- **Disruption Prompt**: "IndiGo just announced our flight 6E-301 from Delhi is delayed by 3 hours due to air traffic congestion."

**Model Reasoning Flow**:
```
Step 1 - Extraction:
- Affected Node: Leg 1 (6E-301 DEL-GOI)
- Disruption Type: Delay
- Magnitude: +180 minutes (3 hours)
- Root Cause: Air traffic congestion

Step 2 - Recalculate Node 1 Timeline:
- Original Arrival: 09:15
- New Estimated Arrival: 09:15 + 180 min = 12:15

Step 3 - Propagate to Leg 2 (Airport Cab):
- Original Pickup: 10:00
- Required Buffer after Flight: 45 minutes for baggage claim.
- Earliest Curbside Readiness: 12:15 + 45 min = 13:00
- Gap between Readiness (13:00) and Scheduled Cab (10:00) is negative (-180 min).
- Outcome: Cab pickup missed. Needs to be rescheduled to 13:00.
- New Cab Journey: 13:00 to 14:30.

Step 4 - Propagate to Leg 3 (Hotel Check-in):
- Arrival at Hotel: 14:30.
- Normal check-in starts at 14:00. Room will be ready upon arrival.
- Status: Confirmed / Low Risk.

Step 5 - Propagate to Leg 4 (Scuba Diving):
- Scheduled Start: 13:30.
- Traveler will be in transit until 14:30.
- Gap: Traveler arrives at hotel 60 minutes AFTER scuba departure from jetty.
- Outcome: Scuba Diving is completely breached (Status: DISRUPTED).
- Financial Risk: Non-refundable ₹4,500 ticket if no action taken.

Step 6 - Formulate Recovery Options:
Option A (Slide/Reschedule): Contact dive operator immediately (giving >2h notice) to reschedule scuba to Day 2 morning (09:00), preserving booking value without rebooking fees.
Option B (Direct Transit): Reroute cab directly from GOI airport to Boat Jetty instead of hotel, shaving 45 minutes; still arrives 13:45 (misses scheduled 13:30 boat departure, unfeasible).
Recommendation: Execute Option A (Slide Scuba to Day 2, Push Cab to 13:00, Proceed to Hotel at 14:30).
```

---

### Scenario 2: Severe Flight Cancellation with No-Show Risk
**Context**:
- Traveler: Rahul Verma
- Itinerary:
  - Leg 1: Flight `AI-864 BOM-DEL` (Scheduled 19:30 - 21:45).
  - Leg 2: Hotel `The Imperial New Delhi` (Check-in Day 1, 3 nights booked, non-refundable first night ₹14,000).
  - Leg 3: Business Conference Keynote (Day 2 at 09:30).
- **Disruption Prompt**: "Air India cancelled AI-864 tonight due to technical snag. Next available flight is tomorrow at 07:00 AM."

**Model Reasoning Flow**:
```
Step 1 - Extraction:
- Affected Node: Leg 1
- Disruption Type: Cancellation
- Next Available Transport: Next morning 07:00 AM arriving DEL 09:15 AM.

Step 2 - Cascading Analysis:
- Leg 2 (Hotel): Rahul cannot arrive on Day 1. If hotel is not notified by 23:59, reservation system will flag reservation as "NO-SHOW", forfeiting Day 1 (₹14,000) and releasing Day 2 & 3 rooms.
- Leg 3 (Keynote): New flight arrives at DEL 09:15. Keynote is scheduled for 09:30. T3 exit + baggage + transit to Connaught Place requires minimum 75 minutes. Arrival at conference would be ~10:30 (MISSES KEYNOTE).

Step 3 - Regulatory Compensation (DGCA CAR Series M):
- Cancellation announced at airport (<24 hours) for technical fault (carrier liability).
- Airline must provide:
  1. Free accommodation & dinner in Mumbai tonight.
  2. Free rebooking on tomorrow's 07:00 flight or alternate carrier.
  3. Compensation of ₹10,000 under DGCA guidelines (block time > 2h).

Step 4 - Emergency Recovery Actions:
1. Urgent Hotel Action: Send automated late arrival notice / date change request to The Imperial New Delhi to retain reservation for Day 2-3 without no-show penalty.
2. Transit Expedite: Look for alternate red-eye flight departing BOM before 05:00 AM (e.g., IndiGo 6E-204 at 04:30 arriving DEL 06:45) to ensure arrival at conference venue by 08:30 AM before keynote.
```
