import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  const collapsed = raw.replace(/\/+$/, '');
  const dashboardMatch = collapsed.match(/\/dashboard\/project\/([a-z0-9-]+)/i);
  if (dashboardMatch) return `https://${dashboardMatch[1]}.supabase.co`;
  return collapsed;
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim?.() || '';
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim?.() || '';
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = rawSupabaseAnonKey;

let client = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl));
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    console.warn('[supabase] Skipped: set VITE_SUPABASE_URL to https://<project-ref>.supabase.co or the dashboard URL from Supabase and VITE_SUPABASE_ANON_KEY to a valid anon key.');
    return null;
  }
  if (!client) {
    try {
      client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (error) {
      console.error('[supabase] Failed to create client', error);
      return null;
    }
  }
  return client;
}

export function getSupabaseTableName() {
  return (import.meta.env.VITE_SUPABASE_TABLE || 'app_state').trim() || 'app_state';
}

export async function probeSupabaseWrite() {
  const client = getSupabaseClient();
  if (!client) return { ok: false, reason: 'not_configured' };
  const table = getSupabaseTableName();
  try {
    const { error } = await client.from(table).upsert({ key: '__probe__', value: { ok: true }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return { ok: true, table };
  } catch (error) {
    return { ok: false, reason: error?.message || 'unknown', table };
  }
}
