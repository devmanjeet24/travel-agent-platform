/** Groq HTTP fetch with a single 429 retry after the server-specified delay. */

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

  const data = await res.json().catch(() => ({}));
  const message =
    typeof (data as { error?: { message?: string } })?.error?.message === 'string'
      ? (data as { error: { message: string } }).error.message
      : '';
  return retryAfterSecondsFromMessage(message);
}

type GroqRequestInit = RequestInit | (() => RequestInit);

function resolveInit(init: GroqRequestInit): RequestInit {
  return typeof init === 'function' ? init() : init;
}

/**
 * Performs `doFetch` once; on HTTP 429, waits per Retry-After / Groq error text and retries once.
 * Pass `init` as a function when the body is not reusable (e.g. FormData).
 */
export async function fetchGroqWith429Retry(
  url: string | URL,
  init: GroqRequestInit,
  doFetch: (url: string | URL, init: RequestInit) => Promise<Response> = fetch,
): Promise<Response> {
  const res = await doFetch(url, resolveInit(init));
  if (res.status !== 429) return res;

  const delaySeconds = await retryDelaySeconds(res);
  if (delaySeconds == null) return res;

  await sleep(delaySeconds * 1000);
  return doFetch(url, resolveInit(init));
}
