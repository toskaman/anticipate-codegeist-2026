import { describe, it, expect } from 'vitest';
import { composeSafeChanges } from '../packages/simulation-core/src/composer';
import { simulatePortfolio, type PortfolioChangeInput } from '../packages/simulation-core/src/portfolio';
import { DEFAULT_POLICIES } from '../src/engine/policies';
import type { GraphSnapshot } from '../packages/contracts/src/index';

// P0-C2: no client verdict is ever trusted. Selecting a candidate only prefills the editor;
// the server re-simulates the transformed changes. This pins the invariant that a fresh
// server simulation of a candidate's transformed changes reproduces the candidate's
// recorded verdict and result hash — if the binding ever breaks, this fails.
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

const A: PortfolioChangeInput = { id: 'A-migrate-to-v2', label: 'Move consumers of TD-1 to TD-5', operations: [{ op: 'MIGRATE_DEPENDENTS', fromNodeId: 'issue:TD-1', toNodeId: 'issue:TD-5', edgeKinds: ['DEPENDS_ON'] }] };
const B: PortfolioChangeInput = { id: 'B-break-v2', label: 'Breaking upgrade of TD-5', operations: [{ op: 'UPGRADE_NODE', nodeId: 'issue:TD-5', breaking: true }] };
const opts = { maxDepth: 6, rules: DEFAULT_POLICIES };

const opKey = (o: unknown) => JSON.stringify(o);
function applyTransforms(changes: PortfolioChangeInput[], transformations: { changeId: string; before: unknown; after: PortfolioChangeInput['operations'][number] }[]): PortfolioChangeInput[] {
  return changes.map((c) => ({
    ...c,
    operations: c.operations.map((o) => transformations.find((t) => t.changeId === c.id && opKey(t.before) === opKey(o))?.after ?? o)
  }));
}

describe('composer → server continuity (P0-C2)', () => {
  const composed = composeSafeChanges(snapshot, [A, B], opts);

  it('every candidate reproduces its verdict and hash under a fresh server simulation', () => {
    expect(composed.candidates.length).toBeGreaterThanOrEqual(1);
    for (const c of composed.candidates) {
      const rebuilt = applyTransforms([A, B], c.transformations as { changeId: string; before: unknown; after: PortfolioChangeInput['operations'][number] }[]);
      const fresh = simulatePortfolio(snapshot, rebuilt, opts);
      expect(fresh.combined.result.verdict).toBe(c.verdict);
      expect(fresh.resultHash).toBe(c.resultHash);
    }
  });

  it('the untransformed baseline equals a direct portfolio simulation', () => {
    const base = composed.candidates.find((c) => c.kind === 'AS_PROPOSED')!;
    expect(base.transformations).toEqual([]);
    const direct = simulatePortfolio(snapshot, [A, B], opts);
    expect(direct.combined.result.verdict).toBe(base.verdict);
    expect(direct.resultHash).toBe(base.resultHash);
  });
});
