// =============================================================================
// planB — Travel Disruption Recovery Platform
// FILE: supabase/functions/delete-account/index.ts
// PURPOSE: Supabase Edge Function — deletes a user's auth account + trips.
//
// WHY THIS EXISTS:
//   auth.admin.deleteUser() requires the SERVICE ROLE KEY, which must NEVER
//   be shipped to the browser. This function runs server-side in Deno,
//   reads the service role key from Supabase secrets, and calls the admin API.
//
// DEPLOY STEPS:
//   1. Install the Supabase CLI:
//        npm install -g supabase
//   2. Link your project (if not already):
//        supabase link --project-ref <your-project-ref>
//   3. Set the service role key as a secret:
//        supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
//      (Find it in: Supabase Dashboard → Project Settings → API → service_role key)
//   4. Deploy this function:
//        supabase functions deploy delete-account
//   5. Verify it's live:
//        supabase functions list
//
// HOW IT WORKS:
//   - The client sends a POST request with the user's JWT in the Authorization header.
//   - This function verifies the JWT (Supabase does this automatically via the anon key).
//   - It extracts the user ID from the verified token.
//   - It deletes all rows from public.trips where user_id = userId (belt-and-suspenders;
//     the client also does this before calling the function).
//   - It calls auth.admin.deleteUser(userId) using the service role key.
//   - Returns { success: true } on success, or { error: "..." } on failure.
//
// SECURITY:
//   - JWT is verified automatically by Supabase Edge Runtime.
//   - The service role key is stored as a Supabase secret, never in source code.
//   - The function only deletes the user whose JWT was provided — no privilege escalation.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Extract and verify the user's JWT ──────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.slice(7);

    // Create a client using the anon key to verify the JWT and get the user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!serviceRoleKey) {
      console.error('[delete-account] SUPABASE_SERVICE_ROLE_KEY secret is not set.');
      return new Response(
        JSON.stringify({
          error:
            'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
            'Run: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify JWT by fetching the user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session. Please sign in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[delete-account] Processing account deletion for user: ${userId}`);

    // ── 2. Delete all trips from public.trips ─────────────────────────────
    // Use the service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: tripsError } = await adminClient
      .from('trips')
      .delete()
      .eq('user_id', userId);

    if (tripsError) {
      console.error('[delete-account] Failed to delete trips:', tripsError);
      // Non-fatal: proceed with auth deletion even if trips cleanup fails
      // (trips table has cascade or can be cleaned up manually)
    } else {
      console.log(`[delete-account] Deleted trips for user: ${userId}`);
    }

    // ── 3. Delete the auth user ───────────────────────────────────────────
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[delete-account] auth.admin.deleteUser failed:', deleteError);
      return new Response(
        JSON.stringify({ error: `Failed to delete auth account: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[delete-account] Successfully deleted user: ${userId}`);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[delete-account] Unexpected error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
