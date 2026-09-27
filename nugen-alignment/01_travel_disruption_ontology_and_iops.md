# Travel Disruption Intelligence & IROPS Recovery Ontology

## 1. Domain Overview
In travel technology and passenger logistics, an **Irregular Operation (IROPS)** occurs when scheduled travel events deviate from their planned execution due to external disruptions (adverse weather, technical malfunctions, air traffic management flow control, rail blockades, or labor actions).

Traditional travel booking platforms treat bookings as isolated transactions (a flight booking, a hotel reservation, a car rental). However, a real-world passenger journey is fundamentally a **Directed Acyclic Graph (DAG)** of interdependent obligations, where:
- Nodes represent **Bookings** ($B_i$) with start times, end times, financial values, and contractual cancellation penalties.
- Directed Edges represent **Temporal Dependencies** ($B_i \to B_j$), stating that booking $B_j$ cannot be successfully attended or initiated until booking $B_i$ has completed.
- Each dependency edge possesses a **Buffer Constraint** ($\Delta_{ij}$), representing the minimum physical and operational transit window required between the completion of $B_i$ and the commencement of $B_j$.

When an upstream disruption occurs on node $B_i$, its impact cascades down the graph along connected edges. The goal of Domain-Aligned Disruption Intelligence is to:
1. Parse natural-language disruption notices and extract structured disruption attributes.
2. Propagate delay minutes and cancellation flags through the dependency graph.
3. Compute slack and buffer erosion across downstream nodes.
4. Synthesize optimal multi-modal recovery plans balancing schedule continuity, financial penalty minimization, and passenger fatigue.

---

## 2. Core Itinerary Data Model & Taxonomy

### 2.1 Booking Entities
Every travel element in an itinerary belongs to one of six primitive types:
- **Flight**: Scheduled commercial air transit between IATA airport codes (e.g., DEL -> GOI). Characterized by terminal gates, boarding deadlines (normally 25-45 minutes before departure), baggage claim windows, and strict regulatory rights.
- **Train**: Scheduled rail transport between station codes. Characterized by platform arrival, intermediate junctions, and fixed boarding windows.
- **Transfer**: Ground transportation (private cab, shuttle, rental car, ride-hail) bridging transit hubs to accommodation or venues.
- **Hotel**: Lodging accommodations characterized by check-in check-out windows (e.g., check-in starting at 14:00 or 15:00, check-out at 11:00 or 12:00) and strict no-show forfeiture rules.
- **Activity**: Time-bound tourism or leisure reservations (scuba diving, museum tours, guided treks, boat charters) with non-flexible start times and strict cancellation cutoff thresholds.
- **Event**: High-stakes time-invariant bookings (weddings, conferences, concerts, keynote speeches) where delay tolerance is near zero.

### 2.2 Dependency & Buffer Thresholds
Buffer ($\tau_{\text{buffer}}$) is defined as the minimum non-negotiable idle time required between the end timestamp of predecessor node $B_A$ and the start timestamp of successor node $B_B$:

$$\text{Actual Gap} = \text{StartTime}(B_B) - \text{EndTime}(B_A)$$

$$\text{Slack} = \text{Actual Gap} - \tau_{\text{buffer}}(B_A \to B_B)$$

If $\text{Slack} < 0$, the successor node $B_B$ enters **AT-RISK** or **DISRUPTED** state because the physical transition cannot be executed in time.

#### Standard Empirical Buffer Benchmarks:
1. **Domestic Flight to Ground Transfer**:
   - Carry-on luggage only: minimum 30 minutes.
   - Checked baggage claim: minimum 45 to 60 minutes.
   - Deplaning, baggage belt delivery, and curbside pick-up walk: 45 minutes baseline.
2. **International Flight to Domestic Connection / Transfer**:
   - Minimum 90 to 120 minutes (accounting for immigration, customs inspection, luggage re-check, and security re-clearance).
3. **Airport Ground Transfer to Hotel Check-in**:
   - Estimated road travel duration + 20 minutes traffic/loading buffer.
4. **Hotel Check-in to Scheduled Activity**:
   - Minimum 45 to 60 minutes (unpacking, room key issuance, freshening up, short local transit).
5. **Activity to Dinner / Evening Event**:
   - Minimum 45 minutes return transit and preparation buffer.

---

## 3. Disruption Types & Severity Mechanics

Disruptions are categorized into two primary operational classes:

### 3.1 Delay Disruption
- An event where the start or completion time of booking $B_i$ is shifted forward by $\Delta t$ minutes, while the service remains operational.
- **Propagation Formula**:
  $$\text{New End Time}(B_i) = \text{Original End Time}(B_i) + \Delta t$$
- **Cascading Condition**: For any downstream node $B_k$ dependent on $B_i$:
  $$\text{New Slack}(B_i \to B_k) = (\text{StartTime}(B_k) - \text{New End Time}(B_i)) - \tau_{\text{buffer}}(B_i \to B_k)$$
  If $\text{New Slack} < 0$, node $B_k$ is breached and must either be:
  - **Slid** forward by $|\text{New Slack}|$ minutes (if the provider permits delayed entry).
  - **Rescheduled** to a subsequent time slot or day.
  - **Cancelled / Swapped** if a fixed cutoff cannot be accommodated.

### 3.2 Cancellation Disruption
- An event where booking $B_i$ is completely voided and will not operate.
- **Cascade Consequence**: All immediate and transitive descendants of $B_i$ whose prerequisites cannot be satisfied are rendered unreachable unless an alternate precursor can be substituted.
- **Immediate Action**: Calculate total non-refundable exposure across the disconnected subtree and trigger replacement leg synthesis (e.g., rebooking alternate flight, train, or road route).

### 3.3 Disruption Severity Classification Matrix
- **LOW**: $\Delta t \le 30 \text{ min}$, or buffer slack remains $\ge 15 \text{ min}$. No downstream schedule changes required; passenger is alerted for proactive monitoring.
- **MEDIUM**: $30 \text{ min} < \Delta t \le 120 \text{ min}$, or downstream buffer slack is eroded to $< 0 \text{ min}$ on flexible bookings (e.g., hotel check-in or private transfer). Contained via transfer rescheduling or hotel late check-in notification.
- **HIGH / CRITICAL**: $\Delta t > 120 \text{ min}$, complete cancellation, or downstream buffer breach on fixed-time, non-refundable events (e.g., missing a connecting flight, concert ticket, or charter boat). Requires immediate autonomous rebooking and financial loss mitigation.

---

## 4. Autonomous Recovery Strategies

When a disruption cascades through an itinerary DAG, the recovery engine generates three distinct operational strategies to present to the passenger:

### Strategy 1: "Slide Schedule" (Minimal Friction / Conservative)
- **Concept**: Retain existing bookings but dynamically shift timestamps forward where providers accommodate flexibility.
- **When to Use**: When downstream activities operate on open or rolling time windows (e.g., self-guided tours, flexible museum passes, hotel check-in) and transfers can be pushed back without fees.
- **Financial Impact**: Zero or minimal rebooking penalties.

### Strategy 2: "Swap Leg" (Time-Preserving / Balanced)
- **Concept**: Replace the disrupted or bottlenecked leg with a faster or alternate modal transport to preserve downstream high-value bookings.
- **Examples**:
  - Replacing a delayed connecting flight with an express high-speed train or highway cab.
  - Switching arrival airport ground transport from shared shuttle to private express taxi.
  - Swapping Day 1 activities with Day 2 downtime to maintain all scheduled bookings over the trip's duration.
- **Financial Impact**: Moderate delta cost, fully offset by preserving high-value downstream activities.

### Strategy 3: "Emergency Rebook & Refund" (Defensive / Maximum Cost Protection)
- **Concept**: Cancel unattainable downstream legs before contractual cutoff windows expire to recover maximum refunds under cancellation policies; rebook primary transport on next guaranteed slot.
- **When to Use**: When a flight cancellation or major delay (> 4 hours) renders same-day itinerary completion impossible.
- **Key Protocol**:
  - Issue immediate notification to hotel to prevent "No-Show" cancellation of multi-night bookings.
  - Claim 100% statutory refunds under aviation regulations.
  - Trigger travel insurance documentation package with timestamped disruption logs.
