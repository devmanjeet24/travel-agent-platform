/** Module flag read by query persister (updated when profile loads / settings change). */
let offlineSyncEnabled = true;

export function setOfflineSyncEnabled(enabled: boolean): void {
  offlineSyncEnabled = enabled;
}

export function isOfflineSyncEnabled(): boolean {
  return offlineSyncEnabled;
}
