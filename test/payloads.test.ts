/** Stored-payload measurement against the Forge KVS per-value cap (see OMEGA P1-8a). */
import { describe, it, expect, vi } from 'vitest';
import { payloadBytes, warnIfNearCap, KVS_VALUE_WARN_BYTES } from '../src/core/payloads';

describe('stored payload measurement', () => {
  it('measures JSON bytes', () => {
    expect(payloadBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
    expect(payloadBytes(null)).toBe(4);
  });
  it('warns only near the KVS per-value cap', () => {
    expect(KVS_VALUE_WARN_BYTES).toBeLessThan(240 * 1024);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      warnIfNearCap('snapshot', 'snap-1', 100);
      expect(spy).not.toHaveBeenCalled();
      warnIfNearCap('snapshot', 'snap-1', KVS_VALUE_WARN_BYTES + 1);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(spy.mock.calls[0]![0] as string)).toMatchObject({ app: 'anticipate', op: 'payloadNearCap', kind: 'snapshot', id: 'snap-1' });
    } finally { spy.mockRestore(); }
  });
});
