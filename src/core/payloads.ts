/** Stored-payload measurement against the Forge KVS per-value cap (240 KiB = 245760 bytes). */

/** Warn threshold with headroom: payloads above this log so growth toward the cap is visible in Forge logs. */
export const KVS_VALUE_WARN_BYTES = 150 * 1024;

/** JSON byte size of a value about to be stored (0 when unserializable — the store write then fails loudly). */
export function payloadBytes(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

/** Single structured warn when a stored payload approaches the KVS per-value cap; silent otherwise. */
export function warnIfNearCap(kind: 'snapshot' | 'provenance', id: string, bytes: number): void {
  if (bytes > KVS_VALUE_WARN_BYTES) {
    console.warn(JSON.stringify({ app: 'anticipate', op: 'payloadNearCap', kind, id, bytes, capBytes: 240 * 1024 }));
  }
}
