import type { Session } from '@supabase/supabase-js';

import { getSupabaseOrNull } from '@/lib/supabase';

export async function fetchAuthSession(): Promise<Session | null> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export const getCurrentSession = fetchAuthSession;
