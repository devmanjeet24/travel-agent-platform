import { getAuthRedirectUrl } from '@/lib/auth-redirect';
import { getSupabaseOrNull } from '@/lib/supabase';

import { formatAuthError, type AuthResult } from './auth-api';

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = getSupabaseOrNull();
  if (!supabase) {
    return { error: 'Supabase is not configured. Check your .env file.' };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error ? formatAuthError(error) : null };
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      ...(fullName ? { data: { full_name: fullName } } : undefined),
    },
  });
  if (error) {
    return { error: formatAuthError(error) };
  }
  if (data.user && !data.session) {
    return { error: null, needsEmailConfirmation: true };
  }
  return { error: null };
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
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });
  return { error: error?.message ?? null };
}

export type SignInVariables = { email: string; password: string };

export function signInWithEmailMutationFn(
  variables: SignInVariables,
): Promise<AuthResult> {
  return signInWithEmail(variables.email, variables.password);
}

export type SignUpVariables = {
  email: string;
  password: string;
  fullName?: string;
};

export function signUpWithEmailMutationFn(
  variables: SignUpVariables,
): Promise<AuthResult> {
  return signUpWithEmail(
    variables.email,
    variables.password,
    variables.fullName,
  );
}

export const signOutMutationFn = signOut;

export type ResetPasswordVariables = { email: string };

export function resetPasswordMutationFn(
  variables: ResetPasswordVariables,
): Promise<AuthResult> {
  return resetPassword(variables.email);
}
