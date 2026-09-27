// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: fileImportEngine.ts
// PURPOSE: File-to-Itinerary pipeline for the drag-and-drop upload flow.
//   1. processFiles()   — converts images→base64, PDFs→canvas images (max 5 pages)
//   2. extractItineraryFromImages() — calls Groq vision API, reuses existing validator
//
// Vision model: qwen/qwen3.8-27b
//   Switched 2026-09-19 — meta-llama/llama-4-scout-17b-16e-instruct was removed
//   from Groq. qwen/qwen3.8-27b is the user-confirmed available replacement.
//   Supports multiple image_url content blocks and base64 data URIs.
//
// DO NOT MODIFY: src/lib/impactEngine.ts or src/lib/recoveryEngine.ts
// =============================================================================

import type { Itinerary } from './types';
import { validateItinerary } from './importEngine';
import { createTripId } from './tripStorage';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'qwen/qwen3.8-27b';
const PDF_PAGE_CAP = 5;

// PDF.js canvas render scale — 1.5× gives ~1200px width for a standard A4 page,
// sufficient for legible OCR without exceeding Groq image size limits.
const PDF_RENDER_SCALE = 1.5;

// Accepted file extensions
export const ACCEPTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf']);

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export interface FileError {
  filename: string;
  message: string;
}

export type ProgressCallback = (filename: string, done: number, total: number) => void;

// ---------------------------------------------------------------------------
// VISION EXTRACTION SYSTEM PROMPT
// Same schema and dependency rules as the text-paste flow in importEngine.ts.
// Adapted to describe multi-image/multi-document input.
// ---------------------------------------------------------------------------
const VISION_SYSTEM_PROMPT = `You are a travel itinerary data-extraction engine.

The user will provide one or more images of booking confirmation documents — they may be flight e-tickets, hotel reservation confirmations, train tickets, activity bookings, or any combination. Your job is to extract EVERY distinct booking segment across ALL provided images and return a valid JSON object matching the TypeScript schema below — NOTHING ELSE. No explanation, no markdown fences, no preamble.

TYPESCRIPT SCHEMA (produce JSON that satisfies this exactly):

interface CancellationPolicy {
  policy: "free" | "partial-refund" | "non-refundable";
  cutoffHours?: number;       // hours before startTime the policy applies
  refundPercent?: number;     // 0-100, only when policy is "partial-refund"
}

interface Booking {
  id: string;           // slug format: "bkg-{type}-{n}", e.g. "bkg-flight-1"
  type: "flight" | "train" | "hotel" | "transfer" | "activity" | "event";
  title: string;        // e.g. "IndiGo 6E-301 DEL-GOI"
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
  travelerName: string;  // extract from documents; default to "Traveler"
  destination: string;   // primary destination, e.g. "Goa, India"
  startDate: string;     // "YYYY-MM-DD"
  endDate: string;       // "YYYY-MM-DD"
  bookings: Booking[];   // sorted chronologically by startTime
}

RULES:
1. Extract EVERY segment across ALL images: flights, trains, hotels, airport transfers, activities, events.
2. ID slugs: "bkg-flight-1", "bkg-hotel-1", "bkg-transfer-1", "bkg-activity-1", etc.
   - If there are multiple hotels, use "bkg-hotel-1", "bkg-hotel-2", etc.
   - If there are multiple flights, use "bkg-flight-1", "bkg-flight-2", etc.
3. ONE SEGMENT PER BOOKING BLOCK: Each distinct booking document or section MUST produce exactly ONE entry. NEVER merge two bookings even if same property/provider.
4. DEPENDENCY CHAIN — follow the physical traveller sequence:
   a. First transport leg (flight/train): dependsOn = [], bufferMinutes = 0.
   b. Airport/station TRANSFER: dependsOn = [that flight/train ID], bufferMinutes = 45 (domestic) or 60 (international).
   c. HOTEL with a transfer: dependsOn = [the transfer ID], bufferMinutes = 30 (check-in formalities).
      HOTEL without a transfer: dependsOn = [the inbound flight/train ID], bufferMinutes = 45 or 60.
   d. ACTIVITIES during a hotel stay (startTime is between hotel check-in and checkout):
      - dependsOn = [the HOTEL id] (NOT the flight or train).
      - The impact engine uses check-in (startTime) as the reference for hotel deps,
        so buffer is measured from check-in to activity start — which is correct.
      - bufferMinutes = minimum required gap FROM check-in:
        60 min if the activity is the same calendar day as check-in.
        1440 min (24h) if the activity is any day after the check-in day (overnight rest needed).
        DO NOT set bufferMinutes to the actual available time. It is the minimum required gap.
   e. RETURN transport (flight/train/bus): dependsOn = [the hotel id], bufferMinutes = 60.
   f. Hotel extension (second stay at same property): dependsOn = [the day-trip activity that bridges
      the two stay periods, or the previous hotel id if nothing bridges them], bufferMinutes = 30.
5. BUFFER SEMANTICS — CRITICAL: bufferMinutes is the MINIMUM REQUIRED gap, NOT the actual gap.
   Never set bufferMinutes by calculating (childStartTime - parentEndTime). Use these standards:
   - Domestic flight landing -> next segment: 45 min required
   - International flight landing -> next segment: 60 min required
   - Train arrival -> next segment: 20 min required
   - Transfer drop-off -> hotel check-in: 30 min required
   - Hotel check-in -> same-day activity (later same day): 60 min required
   - Hotel check-in -> next-day activity: 1440 min required (must arrive and sleep)
   - Hotel check-out -> departure transport: 60 min required
   - No dependsOn: bufferMinutes = 0
6. CANCELLATION POLICY — infer conservatively:
   - "free cancellation" stated: { policy: "free", cutoffHours: 24 }
   - Penalty / partial refund mentioned: { policy: "partial-refund", cutoffHours: 24, refundPercent: 50 }
   - Unclear or not stated: { policy: "non-refundable" }
7. COST — convert to INR if needed (use: USD x84, EUR x92, GBP x107). Use 0 if unknown.
8. TIMEZONE — use destination local offset. Default to +05:30 (IST) if uncertain.
9. Sort bookings array by startTime ascending.
10. Output ONLY the JSON object. No markdown fences, no explanation, no extra text.`;

// ---------------------------------------------------------------------------
// HELPER: file extension
// ---------------------------------------------------------------------------
function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// HELPER: image file -> base64 data URL
// ---------------------------------------------------------------------------
function imageFileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// HELPER: PDF file -> array of base64 data URL images (one per page)
// Throws a clear error if the PDF exceeds PDF_PAGE_CAP pages.
// ---------------------------------------------------------------------------
async function pdfFileToImages(file: File): Promise<string[]> {
  // Dynamic import so pdfjs-dist does not bloat the initial bundle.
  const pdfjsLib = await import('pdfjs-dist');

  // Point to the CDN worker so Vite does not need to bundle the ~900 KB worker.
  const pdfjsVersion = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  if (pdf.numPages > PDF_PAGE_CAP) {
    throw new Error(
      `${file.name} has ${pdf.numPages} pages — the 5-page maximum was exceeded. ` +
      `Please split the PDF or export only the relevant pages.`
    );
  }

  const images: string[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.85));
  }

  return images;
}

// ---------------------------------------------------------------------------
// MAIN EXPORT: processFiles
// Converts all uploaded files to base64 images, reporting per-file progress.
// Returns images (flat array) and any per-file errors.
// ---------------------------------------------------------------------------
export async function processFiles(
  files: File[],
  onProgress: ProgressCallback
): Promise<{ images: string[]; errors: FileError[] }> {
  const images: string[] = [];
  const errors: FileError[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress(file.name, i, files.length);

    const ext = getExtension(file.name);
    try {
      if (ext === '.pdf') {
        const pageImages = await pdfFileToImages(file);
        images.push(...pageImages);
      } else {
        // .png, .jpg, .jpeg
        const dataUrl = await imageFileToDataURL(file);
        images.push(dataUrl);
      }
    } catch (err) {
      errors.push({
        filename: file.name,
        message: err instanceof Error ? err.message : `Failed to process ${file.name}.`,
      });
    }

    onProgress(file.name, i + 1, files.length);
  }

  return { images, errors };
}

// ---------------------------------------------------------------------------
// MAIN EXPORT: extractItineraryFromImages
// Sends all images to Groq vision, validates response with the shared validator.
// ---------------------------------------------------------------------------
export async function extractItineraryFromImages(images: string[]): Promise<Itinerary> {
  if (images.length === 0) {
    throw new Error('No valid images to process. Please check your files and try again.');
  }

  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      'Groq API key not configured. Add VITE_GROQ_API_KEY to your .env.local file.'
    );
  }

  // Build the content array: one text block + one image_url block per image
  type TextBlock = { type: 'text'; text: string };
  type ImageBlock = { type: 'image_url'; image_url: { url: string } };
  const userContent: Array<TextBlock | ImageBlock> = [
    {
      type: 'text',
      text:
        'These images are booking confirmation documents for a trip. ' +
        'Extract all segments into a single Itinerary JSON object as instructed.',
    },
    ...images.map(
      (url): ImageBlock => ({ type: 'image_url', image_url: { url } })
    ),
  ];

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Groq vision API returned ${response.status}: ${body || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq vision returned an empty response.');
  }

  // Strip accidental markdown fences
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      'The AI returned output that could not be parsed as JSON. Please try again.'
    );
  }

  // Reuse the SAME validator from importEngine.ts — no second validator
  if (!validateItinerary(parsed)) {
    throw new Error(
      'The AI response did not match the expected itinerary format. Please try again.'
    );
  }

  // Clean readable unique ID so multiple imports do not clash
  (parsed as Itinerary).id = createTripId((parsed as Itinerary).destination);

  return parsed as Itinerary;
}
