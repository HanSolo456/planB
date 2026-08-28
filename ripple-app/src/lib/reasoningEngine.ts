// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: reasoningEngine.ts
// PURPOSE: AI-generated natural-language reasoning for each recovery option.
//   Uses the same Groq/OpenAI-compatible API pattern as importEngine.ts.
//   Results are cached in-memory so navigating back/forth doesn't re-fire.
// DO NOT MODIFY: src/lib/impactEngine.ts or src/lib/recoveryEngine.ts
// =============================================================================

import type { ScoredRecoveryOption, Disruption, Itinerary } from './types';

// ---------------------------------------------------------------------------
// GROQ CONFIG — mirrors importEngine.ts pattern exactly
// ---------------------------------------------------------------------------
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

// ---------------------------------------------------------------------------
// IN-MEMORY CACHE
// Key: `{bookingId}:{disruptionType}:{delayMinutes}:{optionId}`
// Survives component remounts; cleared on page reload (fine — disruptions
// are session-scoped).
// ---------------------------------------------------------------------------
const explanationCache = new Map<string, string>();

function cacheKey(
  disruption: Disruption,
  optionId: string
): string {
  return [
    disruption.bookingId,
    disruption.disruptionType,
    disruption.delayMinutes ?? 0,
    optionId,
  ].join(':');
}

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// Instructs the model to write a single dispatcher note grounded in real
// numbers — not a chatbot reply, not a robotic data readout.
// ---------------------------------------------------------------------------
const REASONING_SYSTEM_PROMPT = `You are a travel operations assistant writing brief dispatcher notes.
Your job: explain in 1–2 sentences, in plain confident traveler-facing English, WHY a specific recovery option is a good (or acceptable) choice given a flight disruption.

Rules:
- Ground every claim in the numbers provided. Do not invent costs, times, or booking names.
- Be specific: reference the actual cost delta, time delta, and itinerary impact score naturally — not robotically. Prefer "only adds ₹800" over "costDelta is 800".
- If itineraryImpactScore is high (70 or above), lead with trip preservation. If cost delta is zero or negative, lead with the financial win. If timeDelta is zero, call out that the time slot is preserved.
- Do NOT mention the composite score number itself — it is displayed separately.
- Do NOT use bullet points, markdown, bold text, or quotation marks.
- Output only the 1–2 sentence explanation. Nothing else. No preamble, no sign-off.`;

// ---------------------------------------------------------------------------
// FALLBACK — used if the Groq call fails for any reason
// Built purely from the computed numbers, never empty.
// ---------------------------------------------------------------------------
function buildFallback(option: ScoredRecoveryOption): string {
  const timePart =
    option.timeDelta === 0
      ? 'Preserves the original time slot.'
      : `Adds ${option.timeDelta} minute${option.timeDelta !== 1 ? 's' : ''} to the schedule.`;

  const costPart =
    option.costDelta > 0
      ? `Costs ₹${option.costDelta.toLocaleString('en-IN')} more than the original.`
      : option.costDelta < 0
      ? `Saves ₹${Math.abs(option.costDelta).toLocaleString('en-IN')} versus the original booking.`
      : 'No additional cost.';

  return `${timePart} ${costPart} ${option.itineraryImpactScore}% of the itinerary stays intact.`;
}

// ---------------------------------------------------------------------------
// GROQ CALL — plain text response (no response_format: json_object here)
// ---------------------------------------------------------------------------
async function callGroqForReasoning(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error('Groq API key not configured.');
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
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      temperature: 0.4,  // slightly higher than extraction — allows natural phrasing
      max_tokens: 120,   // 1-2 sentences never needs more
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq API ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Groq returned empty content.');

  return content;
}

// ---------------------------------------------------------------------------
// MAIN EXPORT: explainRecoveryOption
// Returns the AI-generated explanation string, or a deterministic fallback.
// Never throws — always resolves to a non-empty string.
// ---------------------------------------------------------------------------
export async function explainRecoveryOption(
  option: ScoredRecoveryOption,
  disruption: Disruption,
  itinerary: Itinerary
): Promise<string> {
  // Check cache first
  const key = cacheKey(disruption, option.id);
  const cached = explanationCache.get(key);
  if (cached) return cached;

  // Find the affected booking for richer context
  const affectedBooking = itinerary.bookings.find(
    (b) => b.id === option.affectedBookingId
  );

  // Build the user message with real computed data
  const disruptionDesc =
    disruption.disruptionType === 'delay'
      ? `${disruption.delayMinutes}-minute delay`
      : 'cancellation';

  const costDesc =
    option.costDelta > 0
      ? `+₹${option.costDelta.toLocaleString('en-IN')} (more expensive)`
      : option.costDelta < 0
      ? `-₹${Math.abs(option.costDelta).toLocaleString('en-IN')} (saves money)`
      : 'no extra cost';

  const timeDesc =
    option.timeDelta === 0
      ? 'same time slot preserved'
      : `+${option.timeDelta} minutes later than original`;

  const userMessage = [
    `DISRUPTION: ${disruptionDesc} on booking "${affectedBooking?.title ?? option.affectedBookingId}" (${affectedBooking?.provider ?? 'unknown provider'}).`,
    ``,
    `RECOVERY OPTION: "${option.description}"`,
    `Replacement segment: "${option.replacementBooking.title}" by ${option.replacementBooking.provider}`,
    ``,
    `COMPUTED METRICS:`,
    `- Cost delta: ${costDesc}`,
    `- Time delta: ${timeDesc}`,
    `- Itinerary impact score: ${option.itineraryImpactScore}/100 (how much of the original trip stays intact; higher is better)`,
    `- Score breakdown: Trip integrity ${option.scoreBreakdown.itineraryScore}/100, Cost efficiency ${option.scoreBreakdown.costScore}/100, Time minimality ${option.scoreBreakdown.timeScore}/100`,
    ``,
    `Write the dispatcher note now.`,
  ].join('\n');

  try {
    const explanation = await callGroqForReasoning(
      REASONING_SYSTEM_PROMPT,
      userMessage
    );
    // Store in cache before returning
    explanationCache.set(key, explanation);
    return explanation;
  } catch (err) {
    console.warn('[planB] explainRecoveryOption failed, using fallback:', err);
    const fallback = buildFallback(option);
    explanationCache.set(key, fallback);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// CACHE UTILITIES — exported so tests or debug tooling can inspect/clear
// ---------------------------------------------------------------------------
export function clearExplanationCache(): void {
  explanationCache.clear();
}

export function getExplanationCacheSize(): number {
  return explanationCache.size;
}

// ---------------------------------------------------------------------------
// NATURAL LANGUAGE DISRUPTION PARSER RE-EXPORT
// ---------------------------------------------------------------------------
export { parseDisruptionFromText } from './nlDisruptionEngine';
export type {
  ParseDisruptionResult,
  DisruptionSuccess,
  DisruptionClarification,
} from './nlDisruptionEngine';
