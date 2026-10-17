import { createClient } from '@supabase/supabase-js';

const legacySupabaseUrl =
  import.meta.env.VITE_LEGACY_SUPABASE_URL?.trim();

const legacySupabaseAnonKey =
  import.meta.env.VITE_LEGACY_SUPABASE_ANON_KEY?.trim();

if (!legacySupabaseUrl || !legacySupabaseAnonKey) {
  throw new Error(
    'Legacy Supabase environment variables are not configured.'
  );
}

/**
 * Temporary legacy business-data bridge.
 *
 * Authentication is handled separately by MAVORA Supabase.
 * Do not use this client for MAVORA authentication.
 */
export const legacySupabase = createClient(
  legacySupabaseUrl,
  legacySupabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
