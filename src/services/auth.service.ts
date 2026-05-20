import type { Session, User } from '@supabase/supabase-js';

import { getSupabase, getSupabaseOrNull } from '@/lib/supabase';

export type AuthResult = { error: string | null };

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = getSupabaseOrNull();
  if (!supabase) {
    return { error: 'Supabase is not configured. Check your .env file.' };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<AuthResult> {
  const supabase = getSupabaseOrNull();
  if (!supabase) {
    return { error: 'Supabase is not configured. Check your .env file.' };
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

export async function resetPassword(email: string): Promise<AuthResult> {
  const supabase = getSupabaseOrNull();
  if (!supabase) {
    return { error: 'Supabase is not configured. Check your .env file.' };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error: error?.message ?? null };
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Traveler';
  const meta = user.user_metadata?.full_name;
  if (typeof meta === 'string' && meta.trim()) return meta;
  return user.email?.split('@')[0] ?? 'Traveler';
}
