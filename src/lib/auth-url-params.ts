/** Parse query or hash segment; JWT values may contain `=`. */
export function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  let segment = '';

  if (hashIndex !== -1) {
    segment = url.slice(hashIndex + 1);
  } else if (queryIndex !== -1) {
    segment = url.slice(queryIndex + 1);
  }

  if (!segment) return params;

  for (const part of segment.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    if (key) params[key] = value;
  }

  return params;
}
