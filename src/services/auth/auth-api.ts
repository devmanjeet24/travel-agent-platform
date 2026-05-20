import type { User } from '@supabase/supabase-js';

export type AuthResult = { error: string | null };

export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Traveler';
  const meta = user.user_metadata?.full_name;
  if (typeof meta === 'string' && meta.trim()) return meta;
  return user.email?.split('@')[0] ?? 'Traveler';
}
