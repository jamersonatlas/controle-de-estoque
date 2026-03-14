import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://dwvpxpggirkxveemxrsm.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'placeholder-key-please-set-in-settings';

if (!supabaseAnonKey || supabaseAnonKey === 'placeholder-key-please-set-in-settings') {
  console.error('Supabase Anon Key is missing. Please set VITE_SUPABASE_ANON_KEY in the Settings menu.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
