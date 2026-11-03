import { describe, expect, it, vi } from 'vitest';

// Forge boundary mock: in-memory store + Jira factory that counts creations and
// refuses live calls. The run() outcome is irrelevant here: only the throttle
// verdict (checked before run) and the run-skip on rejection matter.
const { fakeStore, createCalls } = vi.hoisted(() => {
  const m = new Map<string, unknown>();
  const calls = { createForgeJira: 0 };
  return {
    createCalls: calls,
    fakeStore: {
      get: async <T>(k: string): Promise<T | undefined> => m.get(k) as T | undefined,
      set: async <T>(k: string, v: T): Promise<void> => { m.set(k, v); },
      setIfAbsent: async <T>(k: string, v: T): Promise<boolean> => { if (m.has(k)) return false; m.set(k, v); return true; },
      delete: async (k: string): Promise<void> => { m.delete(k); },
    },
  };
});
vi.mock('../src/forge-adapters', () => ({
  forgeStore: fakeStore,
  createForgeJira: () => { createCalls.createForgeJira++; throw new Error('no live Jira in wiring test'); },
}));

type Envelope = { ok: boolean; error?: { code: string; details?: Record<string, unknown> } };

describe('throttle wiring in the Forge entry', () => {
  it('rejects the 61st identical request with RATE_LIMITED and skips run', async () => {
    const main = await import('../src/main');
    type DefinitionsHandler = (p: { call: { functionKey: string; payload?: unknown }; context: unknown }) => Promise<Envelope>;
    const invoke = main.handler as unknown as DefinitionsHandler;
    const req = { call: { functionKey: 'getCapabilities', payload: {} }, context: { accountId: 'acc-W', installContext: 'install-W' } };
    for (let i = 0; i < 60; i++) {
      const res = await invoke(req);
      expect(res.ok === true || res.error?.code !== 'RATE_LIMITED').toBe(true);
    }
    const limited = await invoke(req);
    expect(limited.ok).toBe(false);
    expect(limited.error?.code).toBe('RATE_LIMITED');
    expect(limited.error?.details?.retryAfterMs).toEqual(expect.any(Number));
    expect(createCalls.createForgeJira).toBe(60);
  });
});
