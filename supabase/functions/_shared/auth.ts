import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { jsonResponse } from './cors.ts';

export async function requireUser(
  req: Request,
): Promise<{ user: User; supabase: ReturnType<typeof createClient> } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(
      { error: 'Missing Authorization header. Sign in and try again.' },
      401,
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonResponse(
      { error: 'Invalid or expired session. Please sign in again.' },
      401,
    );
  }

  return { user, supabase };
}
