// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: nugenDisruptionEngine.ts
// PURPOSE: Nugen Intelligence integration for domain-aligned travel disruption parsing.
//
// ARCHITECTURE (Base AI Model → Nugen Alignment → Domain-Specific Model → Inference):
//   1. Base model: nugen-llama3-v3p2-3b-instruct (Nugen-hosted LLaMA 3.2 3B)
//   2. Domain alignment: Applied via structured travel-disruption system prompt,
//      mimicking the customization layer that Nugen's alignment API provides.
//      Full pipeline: upload corpus → create alignment → get model_id → run inference.
//   3. Inference: POST https://api.nugen.in/api/v3/inference/chat/completions
//      using the aligned/base model to parse real-time travel disruptions.
//
// This engine powers the "What if...?" disruption assistant in planB, replacing
// and augmenting generic LLM calls with a travel-operations-specific model.
// =============================================================================

import type { Itinerary, Disruption, Booking } from './types';

// ---------------------------------------------------------------------------
// NUGEN API CONFIG
// ---------------------------------------------------------------------------
// Use a same-origin proxy path instead of calling api.nugen.in directly.
// Browser → same-origin request (no CORS) → proxy → api.nugen.in
//   Dev:  Vite server.proxy  /nugen-api → https://api.nugen.in
//   Prod: Vercel rewrites    /nugen-api/(.*) → https://api.nugen.in/$1
const NUGEN_API_URL = '/nugen-api/api/v3/inference/chat/completions';

// Base model available on Nugen for travel-domain alignment.
// In production: replace with your aligned model_id obtained after running:
//   POST /api/v3/alignment-projects/create  (with travel disruption corpus)
//   GET  /api/v3/alignment-projects/{id}/status  → model_id when COMPLETED
// We use this base model directly here; Nugen's inference-time alignment
// (confidence_score) still provides domain quality signals.
const NUGEN_BASE_MODEL = 'nugen-llama3-v3p2-3b-instruct';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export interface NugenDisruptionClarification {
  needsClarification: true;
  question: string;
}

export interface NugenDisruptionSuccess {
  needsClarification: false;
  disruption: Disruption;
  confidenceScore?: number | null; // Nugen-specific: alignment confidence 0-100
  nugenModelId?: string;
}

export type NugenParseResult = NugenDisruptionSuccess | NugenDisruptionClarification;

// ---------------------------------------------------------------------------
// TRAVEL-DOMAIN SYSTEM PROMPT (mimics Nugen alignment corpus)
// This system prompt embodies the domain knowledge that would be captured
// in a Nugen alignment corpus of travel disruption case studies.
// ---------------------------------------------------------------------------
function buildTravelDomainPrompt(bookings: Booking[], activeDisruption?: Disruption | null): string {
  const simplifiedBookings = bookings.map((b) => ({
    id: b.id,
    type: b.type,
    title: b.title,
    provider: b.provider,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
  }));

  const activeDisruptionSection = activeDisruption
    ? `\nACTIVELY SIMULATED DISRUPTION (already applied):
${JSON.stringify({
  bookingId: activeDisruption.bookingId,
  disruptionType: activeDisruption.disruptionType,
  delayMinutes: activeDisruption.delayMinutes ?? 0,
  reason: activeDisruption.reason,
}, null, 2)}
If the traveler's message is an UPDATE to this same booking (e.g. "delayed 1 more hour"), extract the ADDITIONAL delay, NOT the total. Set "isAbsoluteTotal": true only if they state a new total (e.g. "now 4 hours total").\n`
    : '';

  return `You are a NUGEN-INTELLIGENCE-POWERED travel disruption operations parser for planB, a travel disruption recovery platform.

DOMAIN EXPERTISE (Nugen Travel Disruption Alignment Corpus):
- IATA-standard disruption categories: DELAY, CANX (cancellation), DIVERT, RETURN
- Airport operations: gate changes, tarmac delays, ATC holds, crew rest violations
- Airline delay codes: crew availability, aircraft mechanical, weather, air traffic
- Ground transport disruptions: traffic, vehicle breakdown, driver no-show
- Hotel disruptions: overbooking, early/late check-in, property issues
- Cascade impact analysis: how upstream delays affect downstream bookings
- Travel advisory vocabulary: IROPS (irregular operations), rebooking windows, STPC

ACTIVE ITINERARY BOOKINGS:
${JSON.stringify(simplifiedBookings, null, 2)}
${activeDisruptionSection}
DISRUPTION PARSING RULES:
- "disruptionType" must be "delay" or "cancellation"
- For delays: extract "delayMinutes" as integer (e.g. "3 hours" = 180, "45 mins" = 45, "half an hour" = 30, "1h 15m" = 75)
- If delay time is unspecified (e.g. "my flight is delayed"), set needsClarification=true and ask for the duration
- For cancellations: disruptionType="cancellation", no delayMinutes needed
- Match user references ("my flight", "the cab", "IndiGo", "hotel") to itinerary bookings by type/provider/title
- If only ONE booking of that type exists, match it unambiguously
- If MULTIPLE bookings match, set needsClarification=true with a question naming the options
- If service not found in manifest, set needsClarification=true stating the service was not found

OUTPUT FORMAT: Return ONLY valid JSON, one of two shapes:

Case A (Resolved):
{"needsClarification":false,"bookingId":"<exact id>","disruptionType":"delay"|"cancellation","delayMinutes":<number>,"isAbsoluteTotal":<boolean>,"reason":"<1-sentence ops cause>"}

Case B (Needs Info):
{"needsClarification":true,"question":"<precise operational clarifying question>"}`;
}

// ---------------------------------------------------------------------------
// NUGEN API CALL
// Endpoint: POST /api/v3/inference/chat/completions
// Auth: Bearer token (VITE_NUGEN_API_KEY)
// Returns raw response with confidence_score from Nugen alignment engine
// ---------------------------------------------------------------------------
interface NugenAPIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  confidence_score?: number | null;
}

async function callNugenAPI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<{ content: string; confidenceScore?: number | null; modelId?: string }> {
  const response = await fetch(NUGEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Session-ID': `planb-disruption-${Date.now()}`,
    },
    body: JSON.stringify({
      model: NUGEN_BASE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Nugen API ${response.status}: ${body || response.statusText}`);
  }

  const data = (await response.json()) as NugenAPIResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('Nugen Intelligence returned an empty response.');
  }

  return {
    content,
    confidenceScore: data.confidence_score ?? null,
    modelId: data.model,
  };
}

// ---------------------------------------------------------------------------
// MAIN PARSE FUNCTION (Nugen-powered)
// ---------------------------------------------------------------------------
export async function parseDisruptionWithNugen(
  userText: string,
  itinerary: Itinerary,
  clarificationHistory?: { originalQuery: string; clarificationQuestion: string },
  activeDisruption?: Disruption | null
): Promise<NugenParseResult> {
  const apiKey = import.meta.env.VITE_NUGEN_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      'Nugen Intelligence API key not configured. Add VITE_NUGEN_API_KEY to your .env.local file.'
    );
  }

  if (!userText.trim()) {
    throw new Error('Please enter a disruption description to simulate.');
  }

  if (!itinerary.bookings || itinerary.bookings.length === 0) {
    throw new Error('The current itinerary contains no bookings to disrupt.');
  }

  const systemPrompt = buildTravelDomainPrompt(itinerary.bookings, activeDisruption);

  let promptContent = userText.trim();
  if (clarificationHistory) {
    promptContent = `Original traveler request: "${clarificationHistory.originalQuery}"\nOperational question asked: "${clarificationHistory.clarificationQuestion}"\nTraveler answer: "${userText.trim()}"`;
  }

  const { content: rawJson, confidenceScore, modelId } = await callNugenAPI(
    systemPrompt,
    promptContent,
    apiKey
  );

  const cleaned = rawJson
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error('Nugen Intelligence returned a non-JSON response. Please try again.');
  }

  if (parsed.needsClarification === true) {
    const question =
      typeof parsed.question === 'string' && parsed.question.trim()
        ? parsed.question.trim()
        : 'Could you please specify which booking and how many minutes it is delayed or if it is cancelled?';
    return { needsClarification: true, question };
  }

  const bookingId = parsed.bookingId as string | undefined;
  if (!bookingId || typeof bookingId !== 'string') {
    throw new Error('Nugen could not identify a specific booking from your description.');
  }

  const matchingBooking = itinerary.bookings.find((b) => b.id === bookingId);
  if (!matchingBooking) {
    throw new Error(`Nugen identified booking "${bookingId}" but it was not found in the itinerary.`);
  }

  const rawType = parsed.disruptionType as string | undefined;
  const disruptionType: 'delay' | 'cancellation' =
    rawType === 'cancellation' ? 'cancellation' : 'delay';

  let delayMinutes: number | undefined = undefined;
  if (disruptionType === 'delay') {
    const parsedMins = Number(parsed.delayMinutes);
    const extractedMins =
      Number.isFinite(parsedMins) && parsedMins > 0 ? Math.round(parsedMins) : 60;
    const isAbsoluteTotal = parsed.isAbsoluteTotal === true;

    if (
      !isAbsoluteTotal &&
      activeDisruption &&
      activeDisruption.disruptionType === 'delay' &&
      activeDisruption.bookingId === bookingId &&
      typeof activeDisruption.delayMinutes === 'number'
    ) {
      delayMinutes = activeDisruption.delayMinutes + extractedMins;
    } else {
      delayMinutes = extractedMins;
    }
  }

  const reason =
    typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim()
      : disruptionType === 'delay'
      ? `${matchingBooking.provider} delay (+${delayMinutes}m)`
      : `${matchingBooking.title} cancelled`;

  const disruption: Disruption = {
    bookingId: matchingBooking.id,
    disruptionType,
    delayMinutes,
    reason,
    timestamp: new Date().toISOString(),
  };

  return {
    needsClarification: false,
    disruption,
    confidenceScore,
    nugenModelId: modelId,
  };
}

// ---------------------------------------------------------------------------
// UTILITY: Check if Nugen API key is configured
// ---------------------------------------------------------------------------
export function isNugenConfigured(): boolean {
  const key = import.meta.env.VITE_NUGEN_API_KEY as string | undefined;
  return typeof key === 'string' && key.trim().length > 0;
}
