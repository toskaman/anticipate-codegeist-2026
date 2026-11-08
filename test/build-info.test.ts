import { createService } from '../src/engine/service';
import { CapabilityAvailability } from '../packages/contracts/src/index';
import { loadBuildInfo } from '../src/core/build-info';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));
const mk = () => { let n = 0; return createService({ jira: demoJira(), store: memoryStore(), now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `c${++n}` }); };

describe('build info (#217)', () => {
  it('loader returns stamped commit + build time from env', () => {
    expect(loadBuildInfo({ ANTICIPATE_BUILD_COMMIT: '5610ca7f2c4e8a1d5f6b7c8d9e0f1a2b3c4d5e6f', ANTICIPATE_BUILD_AT: '2026-11-08T13:20:51.000Z' }))
      .toEqual({ commit: '5610ca7f2c4e8a1d5f6b7c8d9e0f1a2b3c4d5e6f', builtAt: '2026-11-08T13:20:51.000Z' });
  });
  it('loader fails closed: missing or malformed values become nulls, never throws', () => {
    expect(loadBuildInfo({})).toEqual({ commit: null, builtAt: null });
    expect(loadBuildInfo({ ANTICIPATE_BUILD_COMMIT: 'not a sha!!', ANTICIPATE_BUILD_AT: 'yesterday' }))
      .toEqual({ commit: null, builtAt: null });
    expect(loadBuildInfo({ ANTICIPATE_BUILD_COMMIT: 'abc', ANTICIPATE_BUILD_AT: '2026-11-08T13:20:51.000Z' }))
      .toEqual({ commit: null, builtAt: '2026-11-08T13:20:51.000Z' });
  });
  it('getCapabilities carries the build field and validates against the contract', async () => {
    const caps = await mk().getCapabilities();
    expect(caps).toHaveProperty('build');
    expect(() => CapabilityAvailability.parse(caps)).not.toThrow();
  });
});
