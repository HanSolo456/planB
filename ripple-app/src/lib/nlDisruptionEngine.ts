// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: nlDisruptionEngine.ts
// PURPOSE: Natural-language disruption parser using Groq.
//   Extracts a valid Disruption object or clarification request from traveler input.
//   Matches references ("my flight", "the cab") to active itinerary bookings.
// =============================================================================

import type { Itinerary, Disruption, Booking } from './types';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export interface DisruptionClarification {
  needsClarification: true;
  question: string;
}

export interface DisruptionSuccess {
  needsClarification: false;
  disruption: Disruption;
}

export type ParseDisruptionResult = DisruptionSuccess | DisruptionClarification;

// ---------------------------------------------------------------------------
// GROQ CONFIG — matches importEngine.ts & reasoningEngine.ts pattern
// ---------------------------------------------------------------------------
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

// ---------------------------------------------------------------------------
// SYSTEM PROMPT BUILDER
// ---------------------------------------------------------------------------
function buildSystemPrompt(bookings: Booking[]): string {
  const simplifiedBookings = bookings.map((b) => ({
    id: b.id,
    type: b.type,
    title: b.title,
    provider: b.provider,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
  }));

  return `You are a flight and travel operations dispatch parser for planB.
Your task is to analyze a traveler's natural language disruption statement, match it to a specific booking from their active itinerary, and return a structured disruption JSON.

ACTIVE ITINERARY BOOKINGS:
${JSON.stringify(simplifiedBookings, null, 2)}

DISRUPTION SPECIFICATION:
- "disruptionType" must be either "delay" or "cancellation".
- For delays: extract or calculate "delayMinutes" as an integer (e.g., "3 hours" = 180, "45 mins" = 45, "half an hour" = 30, "1h 15m" = 75).
- If the user mentions delay without any time magnitude (e.g. "my flight is delayed"), set needsClarification to true and ask how many minutes or hours it is delayed.
- For cancellations: disruptionType is "cancellation" and delayMinutes must not be present.

MATCHING & AMBIGUITY RULES:
1. Match the user's reference (e.g. "my flight", "the cab", "hotel", "indigo flight", "train") against the active bookings by type, provider, or title.
2. If there is only ONE booking of that type in the itinerary (e.g., only 1 hotel and the user says "my hotel was cancelled"), match it unambiguously.
3. If there are MULTIPLE bookings that could fit (e.g., two flights and user says "my flight is delayed 2 hours"), or if the user's reference is completely ambiguous, do NOT guess. Set "needsClarification": true and formulate a concise, professional operational question asking the user to specify which booking they mean, referencing the conflicting options by provider and title.
4. If the statement refers to a service not in the active itinerary, set "needsClarification": true and ask for clarification, stating that the mentioned service was not found in the manifest.

OUTPUT SCHEMA:
Return ONLY a valid JSON object matching one of the two shapes below:

Case A (Unambiguous Disruption):
{
  "needsClarification": false,
  "bookingId": "<exact id from active bookings, e.g. bkg-flight-1>",
  "disruptionType": "delay" | "cancellation",
  "delayMinutes": <number, required if delay>,
  "reason": "<concise 1-sentence ops cause, e.g. Inbound flight delayed 180 min>"
}

Case B (Ambiguous or Missing Details):
{
  "needsClarification": true,
  "question": "<clarifying question specifying the ambiguity or asking for missing delay time>"
}`;
}

// ---------------------------------------------------------------------------
// GROQ API CALL (OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------
async function callGroqForDisruption(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      'Groq API key not configured. Add VITE_GROQ_API_KEY to your .env.local file or Vercel environment.'
    );
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq API ${response.status}: ${body || response.statusText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Groq returned empty response.');
  }

  return content;
}

// ---------------------------------------------------------------------------
// MAIN PARSE FUNCTION
// ---------------------------------------------------------------------------
export async function parseDisruptionFromText(
  userText: string,
  itinerary: Itinerary,
  clarificationHistory?: { originalQuery: string; clarificationQuestion: string }
): Promise<ParseDisruptionResult> {
  if (!userText.trim()) {
    throw new Error('Please enter a disruption description to simulate.');
  }

  if (!itinerary.bookings || itinerary.bookings.length === 0) {
    throw new Error('The current itinerary contains no bookings to disrupt.');
  }

  const systemPrompt = buildSystemPrompt(itinerary.bookings);

  let promptContent = userText.trim();
  if (clarificationHistory) {
    promptContent = `Original traveler request: "${clarificationHistory.originalQuery}"\nOperational question asked: "${clarificationHistory.clarificationQuestion}"\nTraveler answer: "${userText.trim()}"`;
  }

  const rawJson = await callGroqForDisruption(systemPrompt, promptContent);

  // Strip possible markdown fences
  const cleaned = rawJson
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error('Failed to parse AI disruption response as JSON.');
  }

  // Check for clarification
  if (parsed.needsClarification === true) {
    const question = typeof parsed.question === 'string' && parsed.question.trim()
      ? parsed.question.trim()
      : 'Could you please specify which booking and how many minutes it is delayed or if it is cancelled?';
    return {
      needsClarification: true,
      question,
    };
  }

  // Validate Case A: Unambiguous disruption
  const bookingId = parsed.bookingId as string | undefined;
  if (!bookingId || typeof bookingId !== 'string') {
    throw new Error('AI could not identify a specific booking ID.');
  }

  // Ensure returned bookingId actually exists in the itinerary
  const matchingBooking = itinerary.bookings.find((b) => b.id === bookingId);
  if (!matchingBooking) {
    throw new Error(
      `Identified booking "${bookingId}" was not found in the active itinerary.`
    );
  }

  const rawType = parsed.disruptionType as string | undefined;
  const disruptionType: 'delay' | 'cancellation' =
    rawType === 'cancellation' ? 'cancellation' : 'delay';

  let delayMinutes: number | undefined = undefined;
  if (disruptionType === 'delay') {
    const parsedMins = Number(parsed.delayMinutes);
    delayMinutes = Number.isFinite(parsedMins) && parsedMins > 0 ? Math.round(parsedMins) : 60;
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
  };
}
