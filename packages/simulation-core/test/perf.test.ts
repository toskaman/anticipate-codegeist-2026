import { compareScenarios } from '../src/index';
import type { GraphSnapshot } from '../../contracts/src/index';
import { FIXTURE_POLICIES } from '../../contracts/src/fixtures';

it('100-node reference graph: 3-scenario comparison under 2s (measured, this environment only)', () => {
  const nodes = Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, kind: 'SERVICE' as const, label: `n${i}`, status: 'CONFIRMED' as const, attributes: {}, references: [] }));
  const edges = nodes.slice(1).flatMap((n, i) => [
    { id: `a${i}`, from: n.id, to: `n${Math.floor(i / 3)}`, kind: 'USES' as const, status: (i % 7 ? 'CONFIRMED' : 'INFERRED') as 'CONFIRMED', references: [], accessLimited: false },
    { id: `b${i}`, from: n.id, to: `n${(i * 7) % 100}`, kind: 'DEPENDS_ON' as const, status: 'CONFIRMED' as const, references: [], accessLimited: false }
  ]);
  const snap: GraphSnapshot = { snapshotId: 'perf', projectId: 'p', createdAt: '2026-11-02T00:00:00.000Z', expiresAt: '2026-11-03T00:00:00.000Z', mode: 'DEMO_FIXTURE', nodes, edges, truncated: false, limits: { maxDepth: 10, maxNodes: 500 } };
  const sc = [
    { scenarioId: 'a', label: 'a', operations: [{ op: 'REMOVE_NODE' as const, nodeId: 'n0' }] },
    { scenarioId: 'b', label: 'b', operations: [{ op: 'DEPRECATE_NODE' as const, nodeId: 'n0', retainUntil: null }] },
    { scenarioId: 'c', label: 'c', operations: [{ op: 'MIGRATE_DEPENDENTS' as const, fromNodeId: 'n0', toNodeId: 'n99', edgeKinds: ['USES' as const] }, { op: 'REMOVE_NODE' as const, nodeId: 'n0' }] }
  ];
  const t0 = performance.now();
  const c = compareScenarios(snap, sc, FIXTURE_POLICIES, 10);
  const ms = performance.now() - t0;
  console.log(`perf: 100 nodes / ${edges.length} edges / 3 scenarios = ${ms.toFixed(1)} ms; impacted A=${c.results[0]!.summary.impacted}`);
  expect(ms).toBeLessThan(2000);
});
