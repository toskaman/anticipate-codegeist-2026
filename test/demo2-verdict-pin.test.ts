import { describe, it, expect } from 'vitest';
import { composeSafeChanges } from '../packages/simulation-core/src/composer';
import { simulatePortfolio } from '../packages/simulation-core/src/portfolio';
import { DEFAULT_POLICIES } from '../src/engine/policies';
import type { GraphSnapshot } from '../packages/contracts/src/index';

// Q1 verdict pin: DEMO 2 outputs are pinned so any engine change that alters a verdict,
// ranking, or hash fails loudly here first. Updating these pins requires a conscious
// engine change + fixture review (static/hello-world/tests/composer-demo2.json).
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
const opts = { maxDepth: 6, rules: DEFAULT_POLICIES };

describe('DEMO 2 verdict pin (Q1)', () => {
  it('pins the portfolio verdict, conflicts and hash', () => {
    const r = simulatePortfolio(snapshot, [A, B], opts);
    expect(r.combined.result.verdict).toBe('NEEDS_REVIEW');
    expect(r.conflicts.map((c) => `${c.kind}:${[...c.changeIds].sort().join('+')}`).sort()).toEqual([
      'EMERGENT_IMPACT:A-migrate-to-v2+B-break-v2',
      'MIGRATE_ONTO_RETIRED:A-migrate-to-v2+B-break-v2'
    ]);
    expect(r.resultHash).toBe('890093e4b116f2f3');
  });

  it('pins the composer ranking, candidate metrics and hashes', () => {
    const r = composeSafeChanges(snapshot, [A, B], opts);
    const tuples = r.candidates.map((c) => [c.kind, c.rank, c.verdict, c.blockers, c.unknowns, c.impacted, c.conflicts]);
    expect(tuples).toEqual([
      ['COMPATIBLE_UPGRADE', 1, 'NEEDS_REVIEW', 0, 0, 0, 0],
      ['AS_PROPOSED', 2, 'NEEDS_REVIEW', 0, 0, 4, 2],
      ['SPLIT_PHASES', 3, 'NEEDS_REVIEW', 0, 0, 4, 2]
    ]);
    const hashes = Object.fromEntries(r.candidates.map((c) => [c.candidateId, c.resultHash]));
    // cand-1 matches the recorded UI fixture (static/hello-world/tests/composer-demo2.json);
    // cand-0/cand-2 match the portfolio hash: splitting in time does not change the end state.
    expect(hashes).toEqual({ 'cand-0': '890093e4b116f2f3', 'cand-1': '06f85debf3225dcb', 'cand-2': '890093e4b116f2f3' });
  });
});
