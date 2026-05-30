import { createClient } from '@/lib/supabase';

/**
 * Returns fresh GHL credentials for a session user.
 * JWT is stale after admin sets keys — always fetch from DB.
 */
export async function getGHLCredentials(session) {
  const email = session?.user?.email;
  if (!email) return { locationId: null, apiKey: null };

  const supabase = createClient();
  const { data } = await supabase
    .from('users')
    .select('ghl_location_id, ghl_api_key')
    .eq('email', email)
    .single();

  return {
    locationId: data?.ghl_location_id || null,
    apiKey: data?.ghl_api_key
      || (session.user?.role === 'super_admin' ? process.env.GHL_API_KEY : null)
      || null,
  };
}
