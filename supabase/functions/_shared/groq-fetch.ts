/** Groq HTTP fetch with 429 retries (Retry-After header + exponential backoff). */

const MAX_429_ATTEMPTS = 6;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterSecondsFromHeader(header: string | null): number | null {
  if (!header?.trim()) return null;
  const trimmed = header.trim();
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && asNumber >= 0) return asNumber;
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) {
    const seconds = (asDate - Date.now()) / 1000;
    return seconds > 0 ? seconds : 0;
  }
  return null;
}

function retryAfterSecondsFromMessage(message: string): number | null {
  const match = message.match(/try again in ([\d.]+)\s*s/i);
  if (!match) return null;
  const seconds = parseFloat(match[1]);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

async function retryDelaySeconds(res: Response): Promise<number | null> {
  const fromHeader = retryAfterSecondsFromHeader(res.headers.get('retry-after'));
  if (fromHeader != null) return fromHeader;

  const data = await res.clone().json().catch(() => ({}));
  const message =
    typeof (data as { error?: { message?: string } })?.error?.message === 'string'
      ? (data as { error: { message: string } }).error.message
      : '';
  return retryAfterSecondsFromMessage(message);
}

function exponentialBackoffMs(attempt: number): number {
  const ms = BACKOFF_BASE_MS * 2 ** attempt;
  return Math.min(ms, BACKOFF_MAX_MS);
}

type GroqRequestInit = RequestInit | (() => RequestInit);

function resolveInit(init: GroqRequestInit): RequestInit {
  return typeof init === 'function' ? init() : init;
}

/**
 * Fetches from Groq; on HTTP 429, waits per Retry-After (or exponential backoff) and retries.
 * Pass `init` as a function when the body is not reusable (e.g. FormData).
 */
export async function fetchGroqWith429Retry(
  url: string | URL,
  init: GroqRequestInit,
  doFetch: (url: string | URL, init: RequestInit) => Promise<Response> = fetch,
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < MAX_429_ATTEMPTS; attempt += 1) {
    const res = await doFetch(url, resolveInit(init));
    if (res.status !== 429) return res;

    lastResponse = res;
    const fromApi = await retryDelaySeconds(res);
    const delayMs =
      fromApi != null
        ? Math.max(fromApi * 1000, exponentialBackoffMs(attempt))
        : exponentialBackoffMs(attempt);

    if (attempt === MAX_429_ATTEMPTS - 1) break;
    await sleep(delayMs);
  }

  return lastResponse ?? await doFetch(url, resolveInit(init));
}
