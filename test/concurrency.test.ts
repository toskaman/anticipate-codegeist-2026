import { createService } from '../src/engine/service';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const ctx = { requestId: 'r', accountId: 'acc-1', installationId: 'i' };
let n = 0;
async function ready() {
  const jira = demoJira(); const store = memoryStore();
  // Yield on every store/jira call so concurrent executions genuinely interleave.
  const tick = () => new Promise((r) => setTimeout(r, 0));
  for (const k of ['get', 'set', 'setIfAbsent', 'delete'] as const) { const f = store[k].bind(store); (store as any)[k] = async (...a: any[]) => { await tick(); return (f as any)(...a); }; }
  for (const k of ['getIssue', 'searchIssues', 'createIssue', 'createLink', 'addComment', 'addLabel'] as const) { const f = (jira as any)[k].bind(jira); (jira as any)[k] = async (...a: any[]) => { await tick(); return f(...a); }; }
  const svc = createService({ jira, store, now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `c${++n}` });
  const snap = await svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  await svc.compareScenarios(ctx, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
    scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 });
  const plan = await svc.generatePreventionPlan(ctx, { snapshotId: snap.snapshotId, scenarioId: 'A' });
  await svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: `appr-${n}-xxxxxxxxxx` });
  return { jira, store, svc, plan };
}

describe('adversarial concurrency', () => {
  it('10 simultaneous executions of one plan: exactly one runs, no duplicate Jira issues', async () => {
    const s = await ready();
    const res = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => s.svc.executeApprovedPlan(ctx, { planId: s.plan.planId, idempotencyKey: `exec-par-${i}-xxxxxxxx` })));
    expect(res.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(res.filter((r) => r.status === 'rejected').every((r) => (r as PromiseRejectedResult).reason.code === 'CONFLICT')).toBe(true);
    expect(s.jira.writes.create).toBe(2);
  });
  it('expired-lease takeover race: two contenders, only one takes over, no duplicates', async () => {
    const s = await ready();
    await s.store.set(`lock:${s.plan.planId}`, { until: 0, key: 'crashed-run', token: 'dead-lease' }); // crashed executor
    const res = await Promise.allSettled([0, 1, 2, 3].map((i) => s.svc.executeApprovedPlan(ctx, { planId: s.plan.planId, idempotencyKey: `exec-take-${i}-xxxxxxx` })));
    expect(res.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(s.jira.writes.create).toBe(2);
  });
  it('a different user can never read or execute the plan', async () => {
    const s = await ready();
    const other = { ...ctx, accountId: 'intruder' };
    await expect(s.svc.executeApprovedPlan(other, { planId: s.plan.planId, idempotencyKey: 'exec-intruder-xxxxx' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(s.svc.checkPlanFreshness(other, { planId: s.plan.planId })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(s.jira.writes.create).toBe(0);
  });
});
