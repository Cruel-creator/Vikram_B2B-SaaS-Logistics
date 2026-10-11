import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the secret (service_role) key.
 * Postgres column GRANTs mean this key can only UPDATE the 4 signal columns on `vcs`.
 */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function manualColumnsFingerprint(): Promise<string> {
  const { data, error } = await db().rpc("manual_columns_fingerprint");
  if (error) throw new Error(`fingerprint failed: ${error.message}`);
  return data as string;
}
