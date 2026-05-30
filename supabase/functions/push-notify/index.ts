import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  createServiceSupabase,
  sendExpoPushToUser,
  type ExpoPushMessage,
} from '../_shared/expo-push.ts';

const deno = globalThis as typeof globalThis & {
  Deno: {
    serve(handler: (req: Request) => Response | Promise<Response>): void;
  };
};

type PushBody = {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

deno.Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const admin = createServiceSupabase();
  if (!admin) {
    return jsonResponse({ error: 'Server push is not configured' }, 503);
  }

  let body: PushBody;
  try {
    body = (await req.json()) as PushBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const title = body.title?.trim();
  const pushBody = body.body?.trim();
  if (!title || !pushBody) {
    return jsonResponse({ error: 'title and body are required' }, 400);
  }

  const message: ExpoPushMessage = {
    title,
    body: pushBody,
    data: body.data,
  };

  const result = await sendExpoPushToUser(admin, auth.user.id, message);
  return jsonResponse({ ok: true, ...result });
});
