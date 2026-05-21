import type { AuthError, User } from '@supabase/supabase-js';

export type AuthResult = {
  error: string | null;
  /** True when signup succeeded but Supabase requires email confirmation. */
  needsEmailConfirmation?: boolean;
};

export function formatAuthError(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (
    message.includes('email not confirmed') ||
    error.code === 'email_not_confirmed'
  ) {
    return 'Confirm your email before signing in. Check your inbox for the link from Supabase.';
  }

  if (error.code === 'invalid_credentials') {
    return 'Invalid email or password. If you just signed up, confirm your email first.';
  }

  return error.message;
}

export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Traveler';
  const meta = user.user_metadata?.full_name;
  if (typeof meta === 'string' && meta.trim()) return meta;
  return user.email?.split('@')[0] ?? 'Traveler';
}
