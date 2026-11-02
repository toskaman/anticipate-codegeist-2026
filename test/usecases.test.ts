import { simulate } from '../packages/simulation-core/src/index';
import type { GraphSnapshot } from '../packages/contracts/src/index';
import { DEFAULT_POLICIES } from '../src/engine/policies';
import { decideTransition } from '../src/validator';
import { createService } from '../src/engine/service';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const snap = (cat: string | null): GraphSnapshot => ({
  snapshotId: 's', projectId: 'p', createdAt: '2026-11-02T00:00:00.000Z', expiresAt: '2026-11-03T00:00:00.000Z', mode: 'LIVE', truncated: false, limits: { maxDepth: 3, maxNodes: 200 },
  nodes: [
    { id: 'component:10', kind: 'COMPONENT', label: 'legacy-billing', status: 'CONFIRMED', attributes: {}, references: [] },
    { id: 'issue:B-1', kind: 'ISSUE', label: 'open work', status: 'CONFIRMED', attributes: { statusCategory: cat }, references: [] },
    { id: 'issue:B-2', kind: 'ISSUE', label: 'done work', status: 'CONFIRMED', attributes: { statusCategory: 'done' }, references: [] }
  ],
  edges: [
    { id: 'a1', from: 'issue:B-1', to: 'component:10', kind: 'AFFECTS', status: 'CONFIRMED', references: [], accessLimited: false },
    { id: 'a2', from: 'issue:B-2', to: 'component:10', kind: 'AFFECTS', status: 'CONFIRMED', references: [], accessLimited: false }
  ]
});
const decommission = { scenarioId: 'D', label: 'Decommission', operations: [{ op: 'REMOVE_NODE' as const, nodeId: 'component:10' }] };

describe('use case 2: service / component decommission', () => {
  it('open work items referencing the component block decommission (P4); done work does not', () => {
    const r = simulate(snap('indeterminate'), decommission, DEFAULT_POLICIES);
    expect(r.verdict).toBe('BLOCKED');
    expect(r.violations.find((v) => v.ruleId === 'P4')!.nodeIds).toEqual(['issue:B-1']);
  });
  it('all referencing work done → no P4; unknown status category is not treated as done or open', () => {
    expect(simulate(snap('done'), decommission, DEFAULT_POLICIES).violations.some((v) => v.ruleId === 'P4')).toBe(false);
    expect(simulate(snap(null), decommission, DEFAULT_POLICIES).violations.some((v) => v.ruleId === 'P4')).toBe(false);
  });
  it('deprecating (not removing) never triggers P4', () => {
    const r = simulate(snap('new'), { scenarioId: 'R', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE', nodeId: 'component:10', retainUntil: null }] }, DEFAULT_POLICIES);
    expect(r.violations.some((v) => v.ruleId === 'P4')).toBe(false);
  });
});

describe('Jira workflow validator (Decision Firewall)', () => {
  it('ungated issues always pass; gated issues need a COMPLETED plan', () => {
    expect(decideTransition(['other'], undefined, 'X-1').result).toBe(true);
    expect(decideTransition(['anticipate-change'], undefined, 'X-1')).toMatchObject({ result: false });
    expect(decideTransition(['anticipate-change'], { planId: 'p', scenarioId: 'A', status: 'PARTIAL', at: '' }, 'X-1').errorMessage).toMatch(/PARTIAL/);
    expect(decideTransition(['anticipate-change'], { planId: 'p', scenarioId: 'A', status: 'EVIDENCE_CHANGED', at: '' }, 'X-1').errorMessage).toMatch(/evidence changed/);
    expect(decideTransition(['anticipate-change'], { planId: 'p', scenarioId: 'A', status: 'COMPLETED', at: '' }, 'X-1').result).toBe(true);
    expect(decideTransition(null, undefined, 'X-1').result).toBe(true); // unreadable issue → not gated
  });
  it('a verified execution records the decision the validator reads', async () => {
    const jira = demoJira(); const store = memoryStore(); let n = 0;
    const svc = createService({ jira, store, now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `v${++n}` });
    const ctx = { requestId: 'r', accountId: 'u', installationId: 'i' };
    const s = await svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    await svc.compareScenarios(ctx, { snapshotId: s.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' }, scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 });
    const plan = await svc.generatePreventionPlan(ctx, { snapshotId: s.snapshotId, scenarioId: 'A' });
    await svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 'approve-val-000001' });
    await svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-val-00000001' });
    const decision = await store.get<{ status: string }>('decision:PAY-1');
    expect(decision?.status).toBe('COMPLETED');
    expect(decideTransition(['anticipate-change'], decision as never, 'PAY-1').result).toBe(true);
  });
});
