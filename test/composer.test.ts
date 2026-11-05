import { describe, it, expect } from 'vitest';
import { composeSafeChanges, COMPOSER_LIMITS } from '../packages/simulation-core/src/composer';
import { DEFAULT_POLICIES } from '../src/engine/policies';
import type { GraphSnapshot } from '../packages/contracts/src/index';

// DEMO 2 shape (same as test/demo2-portfolio-collision.test.ts).
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

describe('Safe Change Composer on the DEMO 2 collision', () => {
  const r = composeSafeChanges(snapshot, [A, B], opts);
  const by = (k: string) => r.candidates.find((c) => c.kind === k)!;

  it('baseline reproduces the collision; the compatibility phase removes it, with its assumption stated', () => {
    expect(by('AS_PROPOSED')).toMatchObject({ candidateId: 'cand-0', conflicts: 2, impacted: 4 });
    const compat = by('COMPATIBLE_UPGRADE');
    expect(compat).toMatchObject({ rank: 1, conflicts: 0, impacted: 0, blockers: 0 });
    expect(compat.transformations).toEqual([{ changeId: 'B-break-v2', before: B.operations[0], after: { op: 'UPGRADE_NODE', nodeId: 'issue:TD-5', breaking: false } }]);
    expect(compat.assumptions.join(' ')).toMatch(/assumption, not proof/);
    expect(compat.resolvedConflicts).toEqual(['EMERGENT_IMPACT:A-migrate-to-v2+B-break-v2', 'MIGRATE_ONTO_RETIRED:A-migrate-to-v2+B-break-v2']);
  });

  it('splitting into phases is scored on the end state and never claims to resolve the conflict', () => {
    const split = by('SPLIT_PHASES');
    expect(split.phases).toEqual([['A-migrate-to-v2'], ['B-break-v2']]);
    expect(split.conflicts).toBe(2);
    expect(split.resolvedConflicts).toEqual([]);
    expect(split.rank).toBeGreaterThan(by('COMPATIBLE_UPGRADE').rank);
  });

  it('never invents a migration and never mutates inputs', () => {
    const snapA = JSON.stringify([A, B]);
    composeSafeChanges(snapshot, [A, B], opts);
    expect(JSON.stringify([A, B])).toBe(snapA);
    for (const c of r.candidates) for (const t of c.transformations) expect(t.after.op).not.toBe('MIGRATE_DEPENDENTS');
  });

  it('is deterministic and independent of change input order', () => {
    const r2 = composeSafeChanges(snapshot, [B, A], opts);
    expect(r2.candidates.map((c) => [c.kind, c.rank, c.resultHash])).toEqual(r.candidates.map((c) => [c.kind, c.rank, c.resultHash]));
  });
});

describe('Safe Change Composer on a blocked retirement', () => {
  const C = { id: 'C-retire-v1', label: 'Retire TD-1', operations: [{ op: 'REMOVE_NODE' as const, nodeId: 'issue:TD-1' }] };
  const r = composeSafeChanges(snapshot, [C], opts);
  it('retaining the old API removes the blocker and says it is temporary', () => {
    const base = r.candidates.find((c) => c.kind === 'AS_PROPOSED')!;
    const retain = r.candidates.find((c) => c.kind === 'RETAIN_OLD')!;
    expect(base.verdict).toBe('BLOCKED');
    expect(base.blockers).toBeGreaterThan(0);
    expect(retain.blockers).toBe(0);
    expect(retain.rank).toBeLessThan(base.rank);
    expect(retain.assumptions[0]).toMatch(/later, separately approved removal/);
    expect(r.candidates.some((c) => c.kind === 'SPLIT_PHASES')).toBe(false); // a single change has nothing to split
  });
});

describe('bounds', () => {
  it('caps candidates and reports truncation', () => {
    const many = ['TD-2', 'TD-3', 'TD-4', 'TD-6', 'TD-7', 'TD-8'].map((n, i) => ({ id: `R${i}`, label: n, operations: [{ op: i % 2 ? 'REMOVE_NODE' as const : 'UPGRADE_NODE' as const, nodeId: `issue:${n}`, ...(i % 2 ? {} : { breaking: true }) }] })) as never[];
    const r = composeSafeChanges(snapshot, many, opts);
    expect(r.candidates.length).toBeLessThanOrEqual(COMPOSER_LIMITS.maxCandidates);
    expect(r.truncated).toBe(true);
    expect(r.limits.join(' ')).toMatch(/Only the first/);
  });
});

import { vi } from 'vitest';
import { createService } from '../src/engine/service';
import { OPERATIONS } from '../packages/contracts/src/index';
import { demoJira, memoryStore } from './fakes';
vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));

describe('composeSafeChanges resolver', () => {
  const ctx = { requestId: 'r', accountId: 'u1', installationId: 'i' };
  const req = (changes: unknown) => OPERATIONS.composeSafeChanges.input.parse({ projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', snapshotMaxDepth: 3, changes, maxDepth: 6 });
  it('runs on a real (fake) Jira snapshot, read-only, schema-valid, zero Jira writes', async () => {
    const jira = demoJira(); let n = 0;
    const s = createService({ jira, store: memoryStore(), now: () => new Date('2026-11-05T12:00:00.000Z'), newId: () => `id${++n}` });
    const out = OPERATIONS.composeSafeChanges.output.parse(await s.composeSafeChanges(ctx, req([{ id: 'retire', label: 'Retire PAY-1', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }])));
    expect(out.readOnly).toBe(true);
    expect(out.candidates[0]!.kind).toBe('RETAIN_OLD');
    expect(jira.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
  });
  it('rejects nodes outside the caller snapshot exactly like simulatePortfolio', async () => {
    const jira = demoJira(); let n = 0;
    const s = createService({ jira, store: memoryStore(), now: () => new Date('2026-11-05T12:00:00.000Z'), newId: () => `id${++n}` });
    await expect(s.composeSafeChanges(ctx, req([{ id: 'x', label: 'x', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:SEC-9' }] }]))).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(s.composeSafeChanges({ ...ctx, accountId: null }, req([{ id: 'x', label: 'x', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }]))).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});
