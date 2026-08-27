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
3. DEPENDENCY INFERENCE:
   - Hotel check-in depends on the inbound flight or train if traveler goes directly.
   - Airport or station transfer depends on the transport leg it serves.
   - Activity depends on hotel if it starts the same day or next morning.
   - First transport leg with no predecessor: dependsOn = [].
4. BUFFER DEFAULTS (operational estimates — not facts extracted from text):
   - International flight landing → next segment: 60 min
   - Domestic flight landing → next segment: 45 min
   - Train arrival → next segment: 20 min
   - Hotel check-in → same-day activity: 30 min
   - Hotel check-out → departure transport: 60 min
   - No dependsOn → bufferMinutes = 0
5. CANCELLATION POLICY — infer conservatively:
   - "free cancellation" stated → { policy: "free", cutoffHours: 24 }
   - Penalty / partial refund mentioned → { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 }
   - Unclear or not stated → { policy: "non-refundable" }
6. COST — convert to INR if needed (use: USD×84, EUR×92, GBP×107). Use 0 if unknown.
7. TIMEZONE — use destination local offset. Default to +05:30 (IST) if uncertain.
8. Sort bookings array by startTime ascending.
9. Output ONLY the JSON object. No markdown fences, no explanation, no extra text.`;

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
    label: 'Flight + Hotel',
    description: 'Domestic flight with hotel booking',
    text: `Subject: Your IndiGo Booking Confirmation — PNR: XY1234
Dear Priya Sharma,

FLIGHT: 6E-2041 | Delhi (DEL) → Mumbai (BOM)
Date: 12 March 2025 | Dep: 07:15 | Arr: 09:25
Seat: 18A | Economy | INR 4,850 | Non-refundable

HOTEL: The Oberoi Mumbai
Check-in: 12 March 2025, 2:00 PM | Check-out: 14 March 2025, 12:00 PM
Room: Deluxe King | INR 22,000 per night | Free cancellation until 10 March`,
  },
  {
    label: 'Train + Activities',
    description: 'IRCTC train with desert safari and heritage walk',
    text: `IRCTC Booking Confirmation — PNR: 4589201345
Train: 12956 Jaipur Superfast | Mumbai Central → Jaipur
18 April 2025 | Dep: 18:50 | Arr: 10:30 next day | 3A Class | INR 1,245

Activity: Camel Safari, Sam Sand Dunes
19 April 2025, 4:00 PM – 8:00 PM | Rajasthan Desert Trails | INR 2,800
50% refund if cancelled 48h before

Heritage Walk — Jaipur Old City
20 April 2025, 8:00 AM – 11:00 AM | Rajputana Tours | INR 900 | Non-refundable`,
  },
];
