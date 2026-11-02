import { createService } from '../src/engine/service';
import { diffEvidence } from '../src/engine/drift';
import { EvidenceDrift } from '../packages/contracts/src/index';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const ctx = { requestId: 'r', accountId: 'acc-1', installationId: 'i' };
let n = 0;
async function approvedPlan() {
  const jira = demoJira(); const store = memoryStore();
  const svc = createService({ jira, store, now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `d${++n}` });
  const snap = await svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  await svc.compareScenarios(ctx, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
    scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 });
  const plan = await svc.generatePreventionPlan(ctx, { snapshotId: snap.snapshotId, scenarioId: 'A' });
  return { jira, store, svc, plan, snap };
}
const approve = (s: Awaited<ReturnType<typeof approvedPlan>>, key: string) =>
  s.svc.approvePlan(ctx, { planId: s.plan.planId, planHash: s.plan.planHash, approvedActionIds: s.plan.actions.map((a) => a.actionId), idempotencyKey: key });

describe('Continuous Decision Safety', () => {
  it('unchanged evidence is fresh', async () => {
    const s = await approvedPlan();
    const d = EvidenceDrift.parse(await s.svc.checkPlanFreshness(ctx, { planId: s.plan.planId }));
    expect(d.fresh).toBe(true);
  });
  it('a dependency added after approval blocks execution with zero writes and an explained diff', async () => {
    const s = await approvedPlan();
    await approve(s, 'approve-drift-00001');
    s.jira.add('PAY-9', 'Reporting service (new consumer)');
    s.jira.link('Blocks', 'blocks', 'is blocked by', 'PAY-1', 'PAY-9');
    await expect(s.svc.executeApprovedPlan(ctx, { planId: s.plan.planId, idempotencyKey: 'exec-drift-000001' })).rejects.toMatchObject({ code: 'EVIDENCE_CHANGED' });
    expect(s.jira.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
    const d = await s.svc.checkPlanFreshness(ctx, { planId: s.plan.planId });
    expect(d.addedEdges).toEqual([{ from: 'issue:PAY-9', to: 'issue:PAY-1', kind: 'DEPENDS_ON', status: 'CONFIRMED' }]);
    const pass = await s.svc.getPreventionPassport(ctx, { planId: s.plan.planId });
    expect(pass.plan?.status).toBe('EVIDENCE_CHANGED');
    expect(pass.timeline.some((t) => t.event.startsWith('Evidence changed before execution'))).toBe(true);
    await expect(approve(s, 'approve-drift-00002')).rejects.toMatchObject({ code: 'CONFLICT' }); // must regenerate, cannot re-approve
  });
  it('a dependency added before approval blocks the approval itself', async () => {
    const s = await approvedPlan();
    s.jira.link('Dependency', 'depends on', 'is depended on by', 'PAY-5', 'PAY-1');
    await expect(approve(s, 'approve-drift-00003')).rejects.toMatchObject({ code: 'EVIDENCE_CHANGED' });
  });
  it('an item becoming unreadable is reported as becameUnknown', async () => {
    const s = await approvedPlan();
    s.jira.forbidden.add('PAY-3');
    const d = await s.svc.checkPlanFreshness(ctx, { planId: s.plan.planId });
    expect(d.fresh).toBe(false);
    expect(d.becameUnknown).toContain('issue:PAY-3');
  });
  it('labels, comments and the plan own created issues never trigger drift (retry after partial stays possible)', async () => {
    const s = await approvedPlan();
    await approve(s, 'approve-drift-00004');
    s.jira.failNextComment = true;
    const r1 = await s.svc.executeApprovedPlan(ctx, { planId: s.plan.planId, idempotencyKey: 'exec-drift-000002' });
    expect(r1.some((r) => r.status === 'FAILED')).toBe(true);
    for (const k of [...s.store.data.keys()]) if (k.startsWith('exec:')) s.store.data.delete(k); // lost bookkeeping
    const rec = s.store.data.get(`plan:${s.plan.planId}`) as { plan: { status: string } };
    rec.plan.status = 'PARTIAL';
    const d = await s.svc.checkPlanFreshness(ctx, { planId: s.plan.planId });
    expect(d.fresh).toBe(true);
    expect(d.ignoredPlanArtifacts.length).toBe(2);
    const r2 = await s.svc.executeApprovedPlan(ctx, { planId: s.plan.planId, idempotencyKey: 'exec-drift-000003' });
    expect(r2.every((r) => r.status === 'VERIFIED')).toBe(true);
  });
  it('pure diff ignores non-causal edges', () => {
    const base = { snapshotId: 's', projectId: 'p', createdAt: '2026-11-02T00:00:00.000Z', expiresAt: '2026-11-03T00:00:00.000Z', mode: 'LIVE' as const, truncated: false, limits: { maxDepth: 3, maxNodes: 200 }, nodes: [] };
    const e = (kind: 'AFFECTS' | 'DEPENDS_ON') => ({ id: kind, from: 'a', to: 'b', kind, status: 'INFERRED' as const, references: [], accessLimited: false });
    expect(diffEvidence({ planId: 'p', before: { ...base, edges: [] }, after: { ...base, edges: [e('AFFECTS')] }, planArtifactIssueKeys: [], checkedAt: base.createdAt }).fresh).toBe(true);
    expect(diffEvidence({ planId: 'p', before: { ...base, edges: [] }, after: { ...base, edges: [e('DEPENDS_ON')] }, planArtifactIssueKeys: [], checkedAt: base.createdAt }).fresh).toBe(false);
  });
});
