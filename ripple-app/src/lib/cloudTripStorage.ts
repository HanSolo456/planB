// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: cloudTripStorage.ts
// PURPOSE: Supabase-backed persistence for user-imported itineraries with
//   automatic fallback to localStorage for guests.
//   Uses generated column `itinerary_id` with composite unique constraint
//   (user_id, itinerary_id) for rock-solid idempotent upserts.
// =============================================================================

import type { Itinerary } from './types';
import { supabase } from './supabase';
import * as localTripStorage from './tripStorage';

/**
 * Helper to retrieve the active authenticated Supabase user.
 */
async function getCurrentUser() {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.warn('[cloudTripStorage] Failed to retrieve user session:', err);
    return null;
  }
}

/**
 * Save (or update) a trip.
 * - If logged in: upserts into Supabase `public.trips` matching on (user_id, itinerary_id).
 *   Prevents duplicate rows on re-saving or recovery application.
 * - If guest: saves to browser localStorage.
 */
export async function saveTrip(itinerary: Itinerary): Promise<void> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    localTripStorage.saveTrip(itinerary);
    return;
  }

  const { error } = await supabase
    .from('trips')
    .upsert(
      {
        user_id: user.id,
        itinerary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,itinerary_id' }
    );

  if (error) {
    console.error('[cloudTripStorage] saveTrip failed:', error);
    throw error;
  }
}

/**
 * Returns all saved trips for the active user.
 * - If logged in: fetches from Supabase `public.trips` sorted by updated_at descending.
 * - If guest: returns trips from localStorage.
 */
export async function getAllTrips(): Promise<Itinerary[]> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    return localTripStorage.getAllTrips();
  }

  const { data, error } = await supabase
    .from('trips')
    .select('itinerary, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[cloudTripStorage] getAllTrips query error, falling back to local:', error);
    return localTripStorage.getAllTrips();
  }

  return (data || []).map((row) => row.itinerary as Itinerary);
}

/**
 * Retrieve a single trip by its itinerary ID.
 */
export async function getTrip(id: string): Promise<Itinerary | null> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    return localTripStorage.getTrip(id);
  }

  const { data, error } = await supabase
    .from('trips')
    .select('itinerary')
    .eq('itinerary_id', id)
    .maybeSingle();

  if (error || !data) {
    return localTripStorage.getTrip(id);
  }

  return data.itinerary as Itinerary;
}

/**
 * Delete a trip by its itinerary ID.
 * - If logged in: deletes from Supabase `public.trips`.
 * - If guest: deletes from localStorage.
 */
export async function deleteTrip(id: string): Promise<void> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    localTripStorage.deleteTrip(id);
    return;
  }

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('itinerary_id', id);

  if (error) {
    console.error('[cloudTripStorage] deleteTrip failed:', error);
    throw error;
  }
}

/**
 * Update the updated_at timestamp for a trip without modifying the itinerary.
 */
export async function touchTrip(id: string): Promise<void> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    localTripStorage.touchTrip(id);
    return;
  }

  const { error } = await supabase
    .from('trips')
    .update({ updated_at: new Date().toISOString() })
    .eq('itinerary_id', id);

  if (error) {
    console.warn('[cloudTripStorage] touchTrip failed:', error);
  }
}

/**
 * Delete ALL trips for the currently authenticated user.
 * Called as the first step of account deletion, before removing the auth user.
 * - If logged in: deletes all rows from `public.trips` where user_id matches.
 * - If guest: clears all trips from localStorage.
 */
export async function deleteAllTrips(): Promise<void> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    localTripStorage.clearAllTrips?.();
    return;
  }

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('[cloudTripStorage] deleteAllTrips failed:', error);
    throw error;
  }
}

/**
 * Returns the last modified / opened ISO string for a trip.
 */
export async function getLastOpened(id: string): Promise<string | null> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    return localTripStorage.getLastOpened(id);
  }

  const { data, error } = await supabase
    .from('trips')
    .select('updated_at')
    .eq('itinerary_id', id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.updated_at;
}

// =============================================================================
// SHARE LINK SUPPORT
//
// Shares are stored in a separate `public.shared_trips` table that has an
// open SELECT policy (no auth needed to read) but a restricted INSERT/DELETE
// policy (owner must match auth.uid()).
//
// SQL to run once in the Supabase dashboard:
//
//   CREATE TABLE IF NOT EXISTS public.shared_trips (
//     id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     share_token text UNIQUE NOT NULL,
//     trip_id     text NOT NULL,
//     owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
//     itinerary   jsonb NOT NULL,
//     created_at  timestamptz DEFAULT now()
//   );
//   ALTER TABLE public.shared_trips ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Public can read shared trips"
//     ON public.shared_trips FOR SELECT USING (true);
//   CREATE POLICY "Owner can manage their shares"
//     ON public.shared_trips FOR ALL USING (auth.uid() = owner_id);
// =============================================================================

/**
 * Generate a short random token (12 hex chars, ~48 bits of entropy).
 */
function generateShareToken(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function compressItinerary(itinerary: Itinerary): Promise<string> {
  const json = JSON.stringify(itinerary);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buffer = await new Response(stream).arrayBuffer();
      return `z_${uint8ArrayToBase64Url(new Uint8Array(buffer))}`;
    } catch (err) {
      console.warn('[cloudTripStorage] CompressionStream failed, fallback to base64:', err);
    }
  }
  // Standard base64 fallback
  return `local_${btoa(encodeURIComponent(json))}`;
}

async function decompressItinerary(token: string): Promise<Itinerary | null> {
  try {
    if (token.startsWith('z_')) {
      const b64url = token.slice(2);
      const bytes = base64UrlToUint8Array(b64url);
      const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const text = await new Response(stream).text();
      return JSON.parse(text) as Itinerary;
    }
    if (token.startsWith('local_')) {
      const encoded = token.slice('local_'.length);
      return JSON.parse(decodeURIComponent(atob(encoded))) as Itinerary;
    }
  } catch (err) {
    console.error('[cloudTripStorage] Failed to decode local share token:', err);
  }
  return null;
}

/**
 * A short share code is derived from the first 6 hex chars of the share token
 * (cloud mode) or a deterministic 6-char hash of the itinerary id (local mode).
 * Always lowercase hex so it's easy to type: e.g. "a3f1b9"
 */
export function extractShareCode(token: string): string {
  // For cloud tokens (plain hex, 12 chars): take first 6
  if (/^[0-9a-f]{12}$/.test(token)) return token.slice(0, 6);
  // For compressed/local tokens: hash the token to a 6-char hex code
  let hash = 0;
  for (let i = 0; i < Math.min(token.length, 64); i++) {
    hash = (Math.imul(31, hash) + token.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(6, '0').slice(0, 6);
}

/**
 * Store share code → full token mapping in localStorage so code entry works on the same device.
 */
function cacheShareCode(code: string, token: string, allowEdit: boolean): void {
  try {
    localStorage.setItem(`planb_code_${code}`, JSON.stringify({ token, allowEdit }));
  } catch { /* ignore */ }
}

/** Retrieve a cached share code mapping. */
export function lookupShareCode(code: string): { token: string; allowEdit: boolean } | null {
  try {
    const raw = localStorage.getItem(`planb_code_${code.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as { token: string; allowEdit: boolean };
  } catch {
    return null;
  }
}

/**
 * Create a share link for a trip — stores a snapshot of the itinerary in
 * `public.shared_trips` if configured, or returns a compact compressed URL
 * that fits in QR codes and works completely client-side.
 *
 * @param itinerary  The trip to share.
 * @param allowEdit  If true, recipients can import the trip and edit it.
 *                   If false (default), they can only view it read-only.
 */
export async function createShareLink(
  itinerary: Itinerary,
  allowEdit = false,
): Promise<{ token: string; url: string; mode: 'cloud' | 'local'; shareCode: string; allowEdit: boolean }> {
  const base = window.location.origin;

  // Cache in localStorage for immediate same-device lookups
  try {
    localStorage.setItem(`planb_share_${itinerary.id}`, JSON.stringify({ itinerary, allowEdit }));
  } catch {
    // ignore quota errors
  }

  // Attempt Supabase cloud storage if client and user are available
  if (supabase) {
    try {
      const user = await getCurrentUser();
      const shareToken = generateShareToken();

      const { error } = await supabase.from('shared_trips').insert({
        share_token: shareToken,
        trip_id: itinerary.id,
        owner_id: user?.id ?? null,
        itinerary,
        allow_edit: allowEdit,
      });

      if (!error) {
        const shareCode = extractShareCode(shareToken);
        cacheShareCode(shareCode, shareToken, allowEdit);
        return { token: shareToken, url: `${base}/share/${shareToken}`, mode: 'cloud', shareCode, allowEdit };
      }
      console.warn('[cloudTripStorage] Supabase insert into shared_trips skipped/failed, using compact client share link:', error?.message);
    } catch (err) {
      console.warn('[cloudTripStorage] Supabase share link attempt caught error, falling back:', err);
    }
  }

  // Compact fallback: compress itinerary into URL so it fits QR codes without servers
  const token = await compressItinerary(itinerary);
  const shareCode = extractShareCode(token);
  cacheShareCode(shareCode, token, allowEdit);
  return { token, url: `${base}/share/${token}`, mode: 'local', shareCode, allowEdit };
}

export interface SharedTripResult {
  itinerary: Itinerary;
  allowEdit: boolean;
}

/**
 * Retrieve a shared itinerary by share token. No auth required.
 * Supports:
 * 1. Compact compressed tokens (prefixed "z_")
 * 2. Uncompressed local tokens (prefixed "local_")
 * 3. Local storage lookup (cached by itinerary id or token)
 * 4. Supabase cloud database
 *
 * Returns null if not found, otherwise { itinerary, allowEdit }.
 */
export async function getSharedTrip(shareToken: string): Promise<SharedTripResult | null> {
  // 1. Check local compressed or base64 token
  if (shareToken.startsWith('z_') || shareToken.startsWith('local_')) {
    const trip = await decompressItinerary(shareToken);
    if (trip) {
      // Look up allowEdit from localStorage cache
      const shareCode = extractShareCode(shareToken);
      const coded = lookupShareCode(shareCode);
      const allowEdit = coded?.allowEdit ?? false;
      return { itinerary: trip, allowEdit };
    }
  }

  // 2. Check localStorage cache (keyed by itinerary id or token)
  try {
    const cached = localStorage.getItem(`planb_share_${shareToken}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Support old format (plain Itinerary) and new format ({ itinerary, allowEdit })
      if (parsed && typeof parsed === 'object' && 'bookings' in parsed) {
        return { itinerary: parsed as Itinerary, allowEdit: false };
      }
      if (parsed?.itinerary) {
        return { itinerary: parsed.itinerary as Itinerary, allowEdit: parsed.allowEdit ?? false };
      }
    }
  } catch {
    // ignore
  }

  // 3. Supabase cloud database lookup
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('shared_trips')
        .select('itinerary, allow_edit')
        .eq('share_token', shareToken)
        .maybeSingle();

      if (!error && data?.itinerary) {
        return { itinerary: data.itinerary as Itinerary, allowEdit: data.allow_edit ?? false };
      }
    } catch (err) {
      console.warn('[cloudTripStorage] getSharedTrip cloud lookup error:', err);
    }
  }

  return null;
}

/**
 * Resolve a 6-character hex share code to a full SharedTripResult.
 * First tries localhost cache, then Supabase (prefix match on share_token).
 */
export async function getSharedTripByCode(code: string): Promise<SharedTripResult | null> {
  const normalised = code.toLowerCase().trim();

  // 1. Try localStorage code cache (written by createShareLink)
  const cached = lookupShareCode(normalised);
  if (cached) {
    return getSharedTrip(cached.token);
  }

  // 2. Try Supabase prefix match
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('shared_trips')
        .select('share_token, itinerary, allow_edit')
        .ilike('share_token', `${normalised}%`)
        .limit(1)
        .maybeSingle();

      if (!error && data?.itinerary) {
        return { itinerary: data.itinerary as Itinerary, allowEdit: data.allow_edit ?? false };
      }
    } catch (err) {
      console.warn('[cloudTripStorage] getSharedTripByCode cloud lookup error:', err);
    }
  }

  return null;
}

/**
 * Delete a share link by token. Only works for the trip owner.
 */
export async function deleteShareLink(shareToken: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('shared_trips')
    .delete()
    .eq('share_token', shareToken);
  if (error) {
    console.error('[cloudTripStorage] deleteShareLink failed:', error);
    throw error;
  }
}
