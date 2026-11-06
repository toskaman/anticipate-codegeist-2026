import { ComposeSafeChangesResult, OPERATIONS } from '../src/index';

// P0-C1: a malformed Composer candidate must die at the contract boundary —
// it can never become a verdict, a plan, or a Jira write.
const change = { id: 'B-break-v2', label: 'Breaking upgrade', operations: [{ op: 'UPGRADE_NODE', nodeId: 'issue:TD-5', breaking: true }] };
const candidate = {
  candidateId: 'cand-1', kind: 'COMPATIBLE_UPGRADE', name: 'Compatibility phase for TD-5', why: 'Ship behind a compat layer first.',
  transformations: [{ changeId: 'B-break-v2', before: change.operations[0], after: { op: 'UPGRADE_NODE', nodeId: 'issue:TD-5', breaking: false } }],
  assumptions: ['A compatibility layer keeps the old contract.'], phases: [['A-migrate-to-v2'], ['B-break-v2']],
  order: ['A-migrate-to-v2', 'B-break-v2'], cycles: [],
  verdict: 'PASS', blockers: 0, unknowns: 0, impacted: 0, conflicts: 0, conflictKinds: [],
  requiredReviews: [], resolvedConflicts: ['EMERGENT_IMPACT:A-migrate-to-v2+B-break-v2'], remainingConflicts: [],
  rank: 1, dominatedBy: null, resultHash: 'h0'
};
const result = { snapshotId: 'snap-1', baselineCandidateId: 'cand-0', candidates: [candidate], truncated: false, limits: ['Proposals only.'], readOnly: true };

describe('composer contracts (P0-C1)', () => {
  it('accepts a well-formed composer result', () => {
    expect(ComposeSafeChangesResult.parse(result).candidates).toHaveLength(1);
  });
  it('rejects malformed transformations', () => {
    const badOp = { ...candidate, transformations: [{ changeId: 'B-break-v2', before: change.operations[0], after: { op: 'UPGRADE_NODE' } }] };
    expect(ComposeSafeChangesResult.safeParse({ ...result, candidates: [badOp] }).success).toBe(false);
    const unknownOp = { ...candidate, transformations: [{ changeId: 'B-break-v2', before: change.operations[0], after: { op: 'DELETE_EVERYTHING', nodeId: 'x' } }] };
    expect(ComposeSafeChangesResult.safeParse({ ...result, candidates: [unknownOp] }).success).toBe(false);
    const tooMany = { ...candidate, transformations: Array(41).fill(candidate.transformations[0]) };
    expect(ComposeSafeChangesResult.safeParse({ ...result, candidates: [tooMany] }).success).toBe(false);
  });
  it('rejects results that are not proposals (readOnly) or have no candidates', () => {
    expect(ComposeSafeChangesResult.safeParse({ ...result, readOnly: false }).success).toBe(false);
    expect(ComposeSafeChangesResult.safeParse({ ...result, candidates: [] }).success).toBe(false);
  });
  it('composeSafeChanges input requires at least one change', () => {
    const input = OPERATIONS.composeSafeChanges.input;
    const base = { projectId: 'TD', rootIssueKey: 'TD-1', source: 'JIRA', snapshotMaxDepth: 3, snapshotId: 'snap-1', changes: [change], maxDepth: 6 };
    expect(input.safeParse(base).success).toBe(true);
    expect(input.safeParse({ ...base, changes: [] }).success).toBe(false);
  });
});
