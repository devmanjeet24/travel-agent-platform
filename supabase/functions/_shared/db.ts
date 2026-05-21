/** Best-effort DB writes — chat still works if migration not applied yet. */
export async function safeDb<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[db] ${label}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('does not exist') ||
    msg.includes('PGRST205') ||
    msg.includes('42P01')
  );
}
