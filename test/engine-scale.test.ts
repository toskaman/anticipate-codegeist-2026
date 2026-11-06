import { describe, it, expect } from 'vitest';
import { composeSafeChanges } from '../packages/simulation-core/src/composer';
import { simulatePortfolio, type PortfolioChangeInput } from '../packages/simulation-core/src/portfolio';
import { DEFAULT_POLICIES } from '../src/engine/policies';
import type { GraphSnapshot } from '../packages/contracts/src/index';

// LOCAL computational-cost measurements for CAPACITY_ENVELOPE (Q15/Q17). These run the
// pure engine on generated graphs — no Jira, no Forge — so they bound compute cost only,
// not hosted latency. Bounds are generous on purpose: this pins the cost curve shape,
// not a performance race (CI machines vary).
function ladder(n: number): GraphSnapshot {
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: `issue:N-${i}`, kind: 'ISSUE', label: `N-${i}`, status: 'CONFIRMED', attributes: {}, references: []
  }));
  const edges = Array.from({ length: n - 1 }, (_, i) => ({
    id: `e${i}`, from: `issue:N-${i + 1}`, to: `issue:N-${i}`, kind: 'DEPENDS_ON', status: 'CONFIRMED', references: [], accessLimited: false
  }));
  return {
    snapshotId: `snap-ladder-${n}`, projectId: 'LD', createdAt: '2026-11-06T00:00:00.000Z', expiresAt: '2026-11-07T00:00:00.000Z',
    mode: 'LIVE', truncated: false, limits: { maxDepth: 10, maxNodes: 5000 }, nodes, edges
  } as unknown as GraphSnapshot;
}
const memMB = () => {
  const p = (globalThis as { process?: { memoryUsage(): { heapUsed: number } } }).process;
  return p ? Math.round(p.memoryUsage().heapUsed / 1048576) : -1;
};

describe('engine scale (LOCAL measurements)', () => {
  for (const n of [100, 500, 2000]) {
    it(`simulates a ${n}-node ladder within generous bounds`, () => {
      const snapshot = ladder(n);
      const top = `issue:N-${n - 1}`;
      const A: PortfolioChangeInput = { id: 'A-retire-root', label: 'Retire root', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:N-0' }] };
      const B: PortfolioChangeInput = { id: 'B-break-top', label: 'Breaking upgrade at top', operations: [{ op: 'UPGRADE_NODE', nodeId: top, breaking: true }] };
      const opts = { maxDepth: 6, rules: DEFAULT_POLICIES };
      const memBefore = memMB();
      const t0 = Date.now();
      const r = simulatePortfolio(snapshot, [A, B], opts);
      const simMs = Date.now() - t0;
      const t1 = Date.now();
      const c = composeSafeChanges(snapshot, [A, B], opts);
      const compMs = Date.now() - t1;
      console.log(`SCALE n=${n} simulatePortfolio=${simMs}ms composeSafeChanges=${compMs}ms heapDeltaMB=${memMB() - memBefore} verdict=${r.combined.result.verdict} candidates=${c.candidates.length}`);
      expect(r.changeIds).toEqual(['A-retire-root', 'B-break-top']);
      expect(c.candidates.length).toBeGreaterThanOrEqual(1);
      expect(simMs).toBeLessThan(20000);
      expect(compMs).toBeLessThan(20000);
    });
  }

  it('is deterministic at scale (same input, same hashes)', () => {
    const snapshot = ladder(500);
    const A: PortfolioChangeInput = { id: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:N-0' }] };
    const opts = { maxDepth: 6, rules: DEFAULT_POLICIES };
    const r1 = simulatePortfolio(snapshot, [A], opts);
    const r2 = simulatePortfolio(snapshot, [A], opts);
    expect(r2.resultHash).toBe(r1.resultHash);
  });
});
