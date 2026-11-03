import { GraphSnapshot, ScenarioDefinition, PolicyRule, OPERATIONS, envelope, CONTRACT_VERSION, PreventionPlan, PortfolioChange, PortfolioInput, PortfolioConflict, PORTFOLIO_LIMITS } from '../src/index';
import { FIXTURE_SNAPSHOT, FIXTURE_SCENARIOS, FIXTURE_POLICIES } from '../src/fixtures';

describe('contracts', () => {
  it('fixtures validate', () => {
    expect(GraphSnapshot.parse(FIXTURE_SNAPSHOT).nodes).toHaveLength(10);
    FIXTURE_SCENARIOS.forEach((s) => ScenarioDefinition.parse(s));
    FIXTURE_POLICIES.forEach((p) => PolicyRule.parse(p));
  });
  it('rejects edges with invalid status and oversized scenario lists', () => {
    expect(() => GraphSnapshot.parse({ ...FIXTURE_SNAPSHOT, edges: [{ ...FIXTURE_SNAPSHOT.edges[0], status: 'PROBABLY' }] })).toThrow();
    expect(OPERATIONS.simulateChange.input.safeParse({ snapshotId: 's', change: { issueKey: null, targetNodeId: 'x', description: '' }, scenarios: Array(6).fill(FIXTURE_SCENARIOS[0]) }).success).toBe(false);
  });
  it('envelope distinguishes success and failure', () => {
    const E = envelope(OPERATIONS.getCapabilities.output);
    const meta = { contractVersion: CONTRACT_VERSION, requestId: 'r1', mode: 'LIVE', generatedAt: '2026-11-02T09:00:00.000Z' };
    expect(E.safeParse({ ok: false, meta, error: { code: 'PERMISSION_DENIED', message: 'x', requestId: 'r1', retryable: false } }).success).toBe(true);
    expect(E.safeParse({ ok: true, meta, data: {} }).success).toBe(false);
  });
  it('accepts the INVALIDATED plan status (active invalidation)', () => {
    expect(PreventionPlan.shape.status.parse('INVALIDATED')).toBe('INVALIDATED');
  });
  it('portfolio input contract: bounds, unique ids, defaults', () => {
    const c = { id: 'c1', label: 'Remove v1', operations: [{ op: 'REMOVE_NODE', nodeId: 'svc-auth-v1' }] };
    expect(PortfolioInput.parse({ snapshotId: 's', changes: [c] })).toMatchObject({ maxDepth: 6, proposedOrder: null });
    expect(PortfolioInput.safeParse({ snapshotId: 's', changes: [c, c] }).success).toBe(false);
    expect(PortfolioInput.safeParse({ snapshotId: 's', changes: Array.from({ length: PORTFOLIO_LIMITS.maxChanges + 1 }, (_, i) => ({ ...c, id: `c${i}` })) }).success).toBe(false);
    expect(PortfolioChange.safeParse({ ...c, operations: Array(PORTFOLIO_LIMITS.maxOperationsPerChange + 1).fill(c.operations[0]) }).success).toBe(false);
    expect(PortfolioChange.safeParse({ ...c, operations: [] }).success).toBe(false);
    expect(PortfolioConflict.safeParse({ conflictId: 'C1', kind: 'PROBABLE_FAILURE', changeIds: ['a'], nodeIds: [], reason: '', evidenceGapEdgeIds: [] }).success).toBe(false);
  });
});
