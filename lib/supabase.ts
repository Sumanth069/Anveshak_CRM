import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uwuqylmtrlrjwihxzjul.supabase.co';
const supabaseAnonKey = 'sb_publishable_5zB0J7-LgfJSmqkIK9OLdQ_Q57hLowY';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export function updateSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ANVESHAK_SUPABASE_URL', url);
    localStorage.setItem('ANVESHAK_SUPABASE_ANON_KEY', key);
  }
}

export function isSupabaseConnected(): boolean {
  return true;
}
