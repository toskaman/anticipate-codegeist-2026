import { describe, expect, it, vi } from 'vitest';

// Forge boundary mock: in-memory store + Jira factory that counts creations and
// refuses live calls. The run() outcome is irrelevant here: only the throttle
// verdict (checked before run) and the run-skip on rejection matter.
const { fakeStore, createCalls } = vi.hoisted(() => {
  const m = new Map<string, unknown>();
  const calls = { createForgeJira: 0 };
  // Real Forge KVS key contract: an invalid key throws, as in production (2.31.0 outage).
  const chk = (k: string) => { if (k.length > 500 || !/^(?!\s+$)[a-zA-Z0-9:._\s\-#]+$/.test(k)) throw new Error('INVALID_KEY'); };
  return {
    createCalls: calls,
    fakeStore: {
      get: async <T>(k: string): Promise<T | undefined> => { chk(k); return m.get(k) as T | undefined; },
      set: async <T>(k: string, v: T): Promise<void> => { chk(k); m.set(k, v); },
      setIfAbsent: async <T>(k: string, v: T): Promise<boolean> => { chk(k); if (m.has(k)) return false; m.set(k, v); return true; },
      delete: async (k: string): Promise<void> => { m.delete(k); },
    },
  };
});
vi.mock('../src/forge-adapters', () => ({
  forgeStore: fakeStore,
  forgeQueryStore: fakeStore,
  createForgeJira: () => { createCalls.createForgeJira++; throw new Error('no live Jira in wiring test'); },
}));

type Envelope = { ok: boolean; error?: { code: string; details?: Record<string, unknown> } };

describe('throttle wiring in the Forge entry', () => {
  it('rejects the 61st identical request with RATE_LIMITED and skips run', async () => {
    const main = await import('../src/main');
    type DefinitionsHandler = (p: { call: { functionKey: string; payload?: unknown }; context: unknown }, runtime?: unknown) => Promise<Envelope>;
    const invoke = main.handler as unknown as DefinitionsHandler;
    const req = { call: { functionKey: 'getCapabilities', payload: {} }, context: {} };
    // @forge/resolver takes identity from the runtime payload (2nd argument), not from `context`:
    // pass a real-format ARI so the throttle key meets the Forge KVS key contract end to end.
    const runtime = { installContext: 'ari:cloud:jira::site/c490925f-5338-4d25-b934-5ceb58162a0f', principal: { accountId: '5b10a2844c20165700ede21g' } };
    for (let i = 0; i < 60; i++) {
      const res = await invoke(req, runtime);
      expect(res.ok === true || res.error?.code !== 'RATE_LIMITED').toBe(true);
    }
    const limited = await invoke(req, runtime);
    expect(limited.ok).toBe(false);
    expect(limited.error?.code).toBe('RATE_LIMITED');
    expect(limited.error?.details?.retryAfterMs).toEqual(expect.any(Number));
    expect(createCalls.createForgeJira).toBe(60);
  });
});
