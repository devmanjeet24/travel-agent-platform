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

  if (
    error.code === 'weak_password' ||
    message.includes('password should be at least') ||
    message.includes('weak password')
  ) {
    return 'Choose a stronger password (at least 8 characters).';
  }

  if (
    error.code === 'user_already_registered' ||
    message.includes('already registered') ||
    message.includes('already been registered')
  ) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (message.includes('invalid email') || error.code === 'email_address_invalid') {
    return 'Enter a valid email address.';
  }

  if (message.includes('signup is disabled')) {
    return 'New sign-ups are temporarily unavailable. Please try again later.';
  }

  return error.message;
}

export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Traveler';
  const meta = user.user_metadata?.full_name;
  if (typeof meta === 'string' && meta.trim()) return meta;
  return user.email?.split('@')[0] ?? 'Traveler';
}
