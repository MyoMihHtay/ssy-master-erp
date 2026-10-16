import { createClient } from '@supabase/supabase-js';

const mavoraSupabaseUrl =
  import.meta.env.VITE_MAVORA_SUPABASE_URL?.trim();

const mavoraSupabasePublishableKey =
  import.meta.env.VITE_MAVORA_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!mavoraSupabaseUrl || !mavoraSupabasePublishableKey) {
  throw new Error(
    'MAVORA Supabase environment variables are not configured.'
  );
}

export const mavoraSupabase = createClient(
  mavoraSupabaseUrl,
  mavoraSupabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
