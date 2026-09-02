// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: importEngine.ts
// PURPOSE: Extract a valid Itinerary object from raw booking text via LLM.
//   - Builds a tightly-scoped system prompt that includes the full schema.
//   - Calls Anthropic claude-sonnet-4-6 (client-side, no API key header — platform provides it).
//   - Validates the raw JSON response before returning.
//   - Throws descriptive errors on bad API responses or schema violations.
// DO NOT MODIFY: src/lib/impactEngine.ts or src/lib/recoveryEngine.ts
// =============================================================================

import type { Itinerary, Booking, CancellationPolicy, Location } from './types';

// ---------------------------------------------------------------------------
// EXTRACTION PROMPT
// Sends the full schema as inline TypeScript + strict rules for the LLM.
// ---------------------------------------------------------------------------
const EXTRACTION_SYSTEM_PROMPT = `You are a travel itinerary data-extraction engine.

The user will paste raw text from booking confirmation emails, tickets, hotel confirmations, or any travel document. Your job is to extract every distinct booking segment and return a valid JSON object matching the TypeScript schema below — NOTHING ELSE. No explanation, no markdown fences, no preamble.

TYPESCRIPT SCHEMA (produce JSON that satisfies this exactly):

interface CancellationPolicy {
  policy: "free" | "partial-refund" | "non-refundable";
  cutoffHours?: number;       // hours before startTime the policy applies
  refundPercent?: number;     // 0–100, only when policy is "partial-refund"
}

interface Booking {
  id: string;           // slug format: "bkg-{type}-{n}", e.g. "bkg-flight-1"
  type: "flight" | "train" | "hotel" | "transfer" | "activity" | "event";
  title: string;        // e.g. "IndiGo 6E-301 DEL→GOI"
  provider: string;     // airline, hotel chain, operator, etc.
  startTime: string;    // ISO 8601 with offset, e.g. "2024-12-15T06:30:00+05:30"
  endTime: string;
  location: { type: "named"; name: string } | { type: "coordinates"; lat: number; lng: number; label?: string };
  dependsOn: string[];  // IDs of bookings that must complete before this one
  bufferMinutes: number; // min gap needed after last dependency ends
  cost: number;         // numeric, in INR
  cancellationPolicy: CancellationPolicy;
  status: "confirmed";  // always "confirmed" for freshly imported bookings
  meta?: Record<string, unknown>;
}

interface Itinerary {
  id: string;            // always "imported-trip-1"
  travelerName: string;  // extract from text; default to "Traveler"
  destination: string;   // primary destination, e.g. "Goa, India"
  startDate: string;     // "YYYY-MM-DD"
  endDate: string;       // "YYYY-MM-DD"
  bookings: Booking[];   // sorted chronologically by startTime
}

RULES:
1. Extract EVERY segment: flights, trains, hotels, airport transfers, activities, events.
2. ID slugs: "bkg-flight-1", "bkg-hotel-1", "bkg-transfer-1", "bkg-activity-1", etc.
   - If there are multiple hotels, use "bkg-hotel-1", "bkg-hotel-2", etc.
   - If there are multiple flights, use "bkg-flight-1", "bkg-flight-2", etc.
3. ONE SEGMENT PER BOOKING BLOCK: Each numbered block ("--- BOOKING 1 ---", "--- SEGMENT 1 ---")
   MUST produce exactly ONE entry. NEVER merge two blocks even if same property/provider.
4. DEPENDENCY CHAIN — follow the physical traveller sequence:
   a. First transport leg (flight/train): dependsOn = [], bufferMinutes = 0.
   b. Airport/station TRANSFER: dependsOn = [that flight/train ID], bufferMinutes = 45 (domestic) or 60 (international).
   c. HOTEL with a transfer: dependsOn = [the transfer ID], bufferMinutes = 30 (check-in formalities).
      HOTEL without a transfer: dependsOn = [the inbound flight/train ID], bufferMinutes = 45 or 60.
   d. ACTIVITIES during a hotel stay (startTime is between hotel check-in and checkout):
      — dependsOn = [the inbound FLIGHT or TRAIN id, NOT the hotel id].
      — CRITICAL: The impact engine uses endTime (checkout) as reference for hotel deps.
        Depending on the hotel would create a false huge negative shortfall for mid-stay activities.
      — bufferMinutes = a small MINIMUM REQUIRED value: 60 min for same-day activities,
        1440 min (24h) if the activity is the next calendar day (overnight rest needed).
        DO NOT set bufferMinutes to the actual available time. It is the minimum required gap.
   e. RETURN transport (flight/train/bus): dependsOn = [the hotel id], bufferMinutes = 60.
   f. Hotel extension (second stay at same property): dependsOn = [the day-trip activity that bridges
      the two stay periods, or the previous hotel id if nothing bridges them], bufferMinutes = 30.
5. BUFFER SEMANTICS — CRITICAL: bufferMinutes is the MINIMUM REQUIRED gap, NOT the actual gap.
   Never set bufferMinutes by calculating (childStartTime - parentEndTime). Use these standards:
   - Domestic flight landing → next segment: 45 min required
   - International flight landing → next segment: 60 min required
   - Train arrival → next segment: 20 min required
   - Transfer drop-off → hotel check-in: 30 min required
   - Hotel check-in → next-day activity: 1440 min required (must arrive and sleep)
   - Hotel check-in → same-day activity (later same day): 60 min required
   - Hotel check-out → departure transport: 60 min required
   - No dependsOn: bufferMinutes = 0
6. CANCELLATION POLICY — infer conservatively:
   - "free cancellation" stated → { policy: "free", cutoffHours: 24 }
   - Penalty / partial refund mentioned → { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 }
   - Unclear or not stated → { policy: "non-refundable" }
7. COST — convert to INR if needed (use: USD×84, EUR×92, GBP×107). Use 0 if unknown.
8. TIMEZONE — use destination local offset. Default to +05:30 (IST) if uncertain.
9. Sort bookings array by startTime ascending.
10. Output ONLY the JSON object. No markdown fences, no explanation, no extra text.`;

// ---------------------------------------------------------------------------
// GROQ API CALL (OpenAI-compatible endpoint)
// Auth via VITE_GROQ_API_KEY env var — never hardcoded.
// response_format: { type: 'json_object' } forces valid JSON output.
// ---------------------------------------------------------------------------
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

async function callGroq(userText: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      'Groq API key not configured. Add VITE_GROQ_API_KEY to your .env.local file.'
    );
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user',   content: userText.trim() },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Groq API returned ${response.status}: ${body || response.statusText}`
    );
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned an empty response.');
  }

  return content.trim();
}

// ---------------------------------------------------------------------------
// RUNTIME TYPE VALIDATOR
// Guards against malformed LLM output before any data touches AppContext.
// ---------------------------------------------------------------------------
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidLocation(v: unknown): v is Location {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.type === 'named') return isNonEmptyString(o.name);
  if (o.type === 'coordinates')
    return typeof o.lat === 'number' && typeof o.lng === 'number';
  return false;
}

function isValidCancellationPolicy(v: unknown): v is CancellationPolicy {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!['free', 'partial-refund', 'non-refundable'].includes(o.policy as string)) return false;
  if (o.cutoffHours !== undefined && typeof o.cutoffHours !== 'number') return false;
  if (o.refundPercent !== undefined && typeof o.refundPercent !== 'number') return false;
  return true;
}

const VALID_BOOKING_TYPES = new Set([
  'flight', 'train', 'hotel', 'transfer', 'activity', 'event',
]);

function isValidBooking(v: unknown): v is Booking {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;

  return (
    isNonEmptyString(o.id) &&
    VALID_BOOKING_TYPES.has(o.type as string) &&
    isNonEmptyString(o.title) &&
    isNonEmptyString(o.provider) &&
    isNonEmptyString(o.startTime) &&
    isNonEmptyString(o.endTime) &&
    isValidLocation(o.location) &&
    Array.isArray(o.dependsOn) &&
    typeof o.bufferMinutes === 'number' &&
    typeof o.cost === 'number' &&
    isValidCancellationPolicy(o.cancellationPolicy) &&
    o.status === 'confirmed'
  );
}

export function validateItinerary(raw: unknown): raw is Itinerary {
  if (typeof raw !== 'object' || raw === null) return false;
  const o = raw as Record<string, unknown>;

  if (!isNonEmptyString(o.id)) return false;
  if (!isNonEmptyString(o.travelerName)) return false;
  if (!isNonEmptyString(o.destination)) return false;
  if (!isNonEmptyString(o.startDate)) return false;
  if (!isNonEmptyString(o.endDate)) return false;
  if (!Array.isArray(o.bookings) || o.bookings.length === 0) return false;
  if (!o.bookings.every(isValidBooking)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// MAIN EXPORT: extractItineraryFromText
// Takes raw pasted text → validated Itinerary object.
// Throws on API failure or schema validation failure.
// ---------------------------------------------------------------------------
export async function extractItineraryFromText(rawText: string): Promise<Itinerary> {
  if (!rawText.trim()) {
    throw new Error('No text provided. Please paste your booking confirmation.');
  }

  const llmOutput = await callGroq(rawText);

  // Strip accidental markdown fences just in case
  const cleaned = llmOutput
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      'The AI returned output that could not be parsed as JSON. Please try again or simplify your input.'
    );
  }

  if (!validateItinerary(parsed)) {
    throw new Error(
      'The AI response did not match the expected itinerary format. Please try again.'
    );
  }

  // Ensure a unique ID so multiple imports don't clash
  (parsed as Itinerary).id = `imported-${Date.now()}`;

  return parsed as Itinerary;
}

// ---------------------------------------------------------------------------
// SAMPLE PRESETS — clickable examples in the ImportView UI
// ---------------------------------------------------------------------------
export interface ImportPreset {
  label: string;
  description: string;
  text: string;
}

export const IMPORT_PRESETS: ImportPreset[] = [
  {
    label: 'Goa Trip — Saumitra Matta',
    description: 'Flight + transfer + resort + yacht cruise + return flight (5 segments)',
    text: `================================================================================
CONFIRMATION & E-TICKET RECEIPT — TRIP TO GOA (GOI)
Booking Reference / PNR: 6E-VK893N
Passenger Name: Saumitra Matta
Date of Issue: 15 October 2025
================================================================================

--- SEGMENT 1: OUTBOUND FLIGHT ---
Airline: IndiGo Airlines
Flight: 6E-5124 (Airbus A321neo)
Route: New Delhi (DEL) Terminal 3 → Goa Dabolim (GOI) Terminal 1
Departure: 14 November 2025 at 06:15 IST
Arrival: 14 November 2025 at 08:50 IST
Duration: 2h 35m | Non-Stop
Class: Economy Saver (Seat 14F)
Baggage: 15 kg check-in + 7 kg cabin
Fare: ₹5,450 (Taxes & Fees included)
Cancellation Policy: Partial refund (₹2,500 airline fee applies if cancelled 24h prior)

--- SEGMENT 2: PRE-BOOKED AIRPORT TRANSFER ---
Provider: Goa Miles Executive Transfers
Booking ID: GM-TX-88219
Pickup Location: Dabolim Airport (GOI) Terminal 1 Arrival Gate 4
Drop-off Location: W Goa, Vagator Beach, Goa
Pickup Time: 14 November 2025 at 09:30 IST
Estimated Drop-off: 14 November 2025 at 10:45 IST
Vehicle: Toyota Innova Crysta (Air Conditioned)
Total Cost: ₹1,850 (Prepaid)
Cancellation Policy: Free cancellation up to 6 hours before pickup

--- SEGMENT 3: RESORT & HOTEL RESERVATION ---
Property: W Goa Resort & Spa
Confirmation No: MAR-9043210
Address: Vagator Beach, Bardez, Goa 403509
Check-in: 14 November 2025 (Check-in from 14:00 IST)
Check-out: 17 November 2025 (Check-out by 11:00 IST)
Nights: 3 Nights
Room Type: Spectacular Ocean View King Suite (Breakfast included)
Guest: Saumitra Matta (1 Adult)
Total Room Tariff: ₹48,600 (₹16,200/night + taxes)
Cancellation Policy: Free cancellation until 12 November 2025, 23:59 IST (Full refund)

--- SEGMENT 4: SCHEDULED EXCURSION / ACTIVITY ---
Operator: Konkan Coastal Adventures
Activity: Private Sunset Yacht Cruise & Dolphin Sighting
Booking ID: KCA-YACHT-410
Location: Chapora River Jetty, Vagator, Goa
Date & Time: 15 November 2025 | 16:30 IST – 19:00 IST
Pass: 1 Guest Private Charter
Amount: ₹7,500
Cancellation Policy: 50% refund if cancelled 24 hours prior; non-refundable within 24 hours

--- SEGMENT 5: RETURN FLIGHT ---
Airline: Air India
Flight: AI-842
Route: Goa Dabolim (GOI) Terminal 1 → New Delhi (DEL) Terminal 3
Departure: 17 November 2025 at 18:30 IST
Arrival: 17 November 2025 at 21:10 IST
Duration: 2h 40m | Non-Stop
Class: Economy Flex (Seat 12C)
Fare: ₹6,920
Cancellation Policy: Free cancellation up to 24 hours before scheduled departure

================================================================================
Total Paid: ₹70,320 INR | Payment Mode: Credit Card (HDFC ending in 4092)
================================================================================`,
  },
  {
    label: 'Ladakh Expedition — Rohan Kapoor',
    description: 'Flight + hotel + Pangong Lake drive + monastery tour + return flight (6 segments)',
    text: `================================================================================
MULTI-BOOKING CONFIRMATION SUMMARY — LADAKH TRIP (IXL)
Master Booking ID: MXB-2025-LAD-00712
Lead Passenger: Rohan Kapoor
Date of Issue: 02 November 2025
================================================================================

--- BOOKING 1: OUTBOUND FLIGHT ---
Carrier: Air India Express
Flight: IX-537
Route: Bengaluru (BLR) Terminal 2 → Leh Kushok Bakula Rimpochhe Airport (IXL)
Departure: 22 November 2025 at 05:45 IST
Arrival: 22 November 2025 at 09:20 IST (via 1 stop Delhi — no plane change)
Class: Economy | Seat 8B
Fare: ₹9,840 (inclusive of taxes)
Baggage: 15 kg check-in + 7 kg cabin
Cancellation Policy: ₹3,500 fee if cancelled within 48 hours of departure

--- BOOKING 2: HOTEL CHECK-IN (NIGHT 1 & 2 — ACCLIMATIZATION DAYS) ---
Property: The Grand Dragon Ladakh
Confirmation: GDL-NOV-5591
Address: Old Road, Karzoo, Leh, Ladakh 194101
Check-in: 22 November 2025 at 11:00 IST
Check-out: 24 November 2025 at 10:00 IST
Room: Deluxe Room with Mountain View (2 Nights)
Total: ₹12,400 (₹6,200/night, breakfast included)
NOTE: Guest must rest on arrival day — high altitude (3,500 m). No strenuous activity for first 24 hours.
Cancellation: Free cancellation until 20 November 2025

--- BOOKING 3: DAY EXCURSION — PANGONG LAKE (FIXED DATE) ---
Operator: Leh Adventure Tours
Tour: Pangong Tso Full-Day Private Drive
Booking Ref: LAT-PANG-991
Pickup from Hotel: 24 November 2025 at 05:30 IST
Return to Hotel: 24 November 2025 at 20:00 IST
Route: Leh → Chang La Pass (5,360 m) → Pangong Lake → Return
Vehicle: Toyota Land Cruiser (4WD, heated)
Inclusions: Packed lunch, Photography stops, Inner Line Permit (ILP)
Price: ₹8,500 per vehicle (1 pax)
Cancellation: 50% refund if cancelled 48h prior. Non-refundable within 48 hours.
⚠️ Weather Advisory: Route via Chang La subject to sudden snowfall. Operator may reschedule.

--- BOOKING 4: HOTEL CHECK-IN (NIGHT 3 & 4) ---
Property: The Grand Dragon Ladakh (continued stay)
Confirmation: GDL-NOV-5591-EXT
Check-in: 24 November 2025 at 21:00 IST (post Pangong return)
Check-out: 26 November 2025 at 10:00 IST
Room: Same Deluxe Room (2 Nights)
Total: ₹12,400
Cancellation: Non-refundable (extension booking)

--- BOOKING 5: HALF-DAY GUIDED TOUR ---
Operator: Ladakh Heritage Walks
Tour: Thiksey Monastery & Shey Palace Private Tour
Booking ID: LHW-MONK-314
Date: 25 November 2025 | 08:00 IST – 13:00 IST
Meeting Point: Hotel Lobby
Guide: English-speaking certified heritage guide
Price: ₹3,200
Cancellation: Full refund if cancelled 24h prior

--- BOOKING 6: RETURN FLIGHT ---
Carrier: IndiGo
Flight: 6E-6417
Route: Leh (IXL) → Bengaluru (BLR) Terminal 2 (via Delhi, no plane change)
Departure: 26 November 2025 at 11:30 IST
Arrival: 26 November 2025 at 17:45 IST
Class: Economy Saver | Seat 22F
Fare: ₹8,290
Baggage: 15 kg check-in + 7 kg cabin
Cancellation Policy: Partial refund — ₹3,000 fee applies if cancelled within 24h

================================================================================
Total Trip Value: ₹54,630 INR
Payment: SBI Credit Card ending 7731
Emergency Helpline: +91 1800-103-9999 | Email: bookings@mountainxpeditions.com
================================================================================`,
  },
];
