import { describe, it, expect } from 'vitest';
import { simulatePortfolio } from '../packages/simulation-core/src/portfolio';
import { DEFAULT_POLICIES } from '../src/engine/policies';
import type { GraphSnapshot } from '../packages/contracts/src/index';

/**
 * DEMO 2 — Portfolio collision, on the shape of the real TD demo project (one-atlas-euza, 4 Nov 2026):
 * TD-2, TD-3 and TD-6 depend on TD-1 (Legacy Auth API v1); TD-4 depends on TD-2; TD-1 depends on TD-7 and TD-8;
 * TD-5 (Auth API v2) is related to TD-1 (INFERRED).
 *   A: migrate the consumers of TD-1 onto TD-5.   B: breaking upgrade of TD-5.
 * Each change alone impacts nobody. Together, the migrated consumers land on a target that is about to break.
 * This is a structural property of the engine, not a staged result: the test fails if the engine stops seeing it.
 */
const N = ['TD-1', 'TD-2', 'TD-3', 'TD-4', 'TD-5', 'TD-6', 'TD-7', 'TD-8'];
const E: [string, string, 'DEPENDS_ON' | 'USES', 'CONFIRMED' | 'INFERRED'][] = [
  ['TD-2', 'TD-1', 'DEPENDS_ON', 'CONFIRMED'], ['TD-3', 'TD-1', 'DEPENDS_ON', 'CONFIRMED'], ['TD-6', 'TD-1', 'DEPENDS_ON', 'CONFIRMED'],
  ['TD-4', 'TD-2', 'DEPENDS_ON', 'CONFIRMED'], ['TD-1', 'TD-7', 'DEPENDS_ON', 'CONFIRMED'], ['TD-1', 'TD-8', 'DEPENDS_ON', 'CONFIRMED'],
  ['TD-5', 'TD-1', 'USES', 'INFERRED']
];
const snapshot = {
  snapshotId: 'snap-td-demo2', projectId: 'TD', createdAt: '2026-11-04T18:00:00.000Z', expiresAt: '2026-11-05T18:00:00.000Z',
  mode: 'LIVE', truncated: false, limits: { maxDepth: 10, maxNodes: 5000 },
  nodes: N.map((n) => ({ id: `issue:${n}`, kind: 'ISSUE', label: n, status: 'CONFIRMED', attributes: {}, references: [] })),
  edges: E.map(([f, t, kind, status], i) => ({ id: `e${i}`, from: `issue:${f}`, to: `issue:${t}`, kind, status, references: [], accessLimited: false }))
} as unknown as GraphSnapshot;

const A = { id: 'A-migrate-to-v2', label: 'Move consumers of TD-1 to TD-5', operations: [{ op: 'MIGRATE_DEPENDENTS' as const, fromNodeId: 'issue:TD-1', toNodeId: 'issue:TD-5', edgeKinds: ['DEPENDS_ON' as const] }] };
const B = { id: 'B-break-v2', label: 'Breaking upgrade of TD-5', operations: [{ op: 'UPGRADE_NODE' as const, nodeId: 'issue:TD-5', breaking: true }] };
const consumers = ['issue:TD-2', 'issue:TD-3', 'issue:TD-4', 'issue:TD-6'];

describe('DEMO 2: portfolio collision on the TD project shape', () => {
  const r = simulatePortfolio(snapshot, [A, B], { rules: DEFAULT_POLICIES });

  it('each change alone impacts nobody', () => {
    expect(r.individual.map((i) => i.changeId)).toEqual(['A-migrate-to-v2', 'B-break-v2']);
    for (const i of r.individual) expect(i.result.impacts).toEqual([]);
    expect(r.combined.result.impacts.map((i) => i.nodeId).sort()).toEqual(consumers);
  });
  it('together, the four consumers become impacted only by the combination (EMERGENT_IMPACT)', () => {
    const em = r.conflicts.find((c) => c.kind === 'EMERGENT_IMPACT');
    expect(em?.nodeIds).toEqual(consumers);
    expect(em?.changeIds).toEqual(['A-migrate-to-v2', 'B-break-v2']);
  });
  it('flags the migration onto a target that the other change breaks (MIGRATE_ONTO_RETIRED)', () => {
    const c = r.conflicts.find((x) => x.kind === 'MIGRATE_ONTO_RETIRED');
    expect(c?.changeIds).toEqual(['A-migrate-to-v2', 'B-break-v2']);
    expect(c?.nodeIds).toEqual(['issue:TD-1', 'issue:TD-5']);
  });
  it('is deterministic and independent of input order', () => {
    const r2 = simulatePortfolio(snapshot, [B, A], { rules: DEFAULT_POLICIES });
    expect(r2.resultHash).toBe(r.resultHash);
  });
});
