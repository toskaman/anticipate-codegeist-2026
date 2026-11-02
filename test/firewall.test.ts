import { createService } from '../src/engine/service';
import { decideTransition, type DecisionRecord } from '../src/validator';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const alice = { requestId: 'r', accountId: 'alice', installationId: 'i' };
const bob = { requestId: 'r', accountId: 'bob', installationId: 'i' };
const anon = { requestId: 'r', accountId: null, installationId: 'i' };
let n = 0;
function setup() {
  const jira = demoJira(); const store = memoryStore(); const now = new Date('2026-11-02T09:00:00Z');
  const svc = createService({ jira, store, now: () => now, newId: () => `fw${++n}` });
  return { jira, store, svc, now };
}
const remove = [{ scenarioId: 'A', label: 'Remove now', operations: [{ op: 'REMOVE_NODE' as const, nodeId: 'issue:PAY-1' }] },
  { scenarioId: 'B', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE' as const, nodeId: 'issue:PAY-1', retainUntil: null }] }];
async function plan(s: ReturnType<typeof setup>, scenarioId: string, who = alice) {
  const snap = await s.svc.getGraphSnapshot(who, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  const cmp = await s.svc.compareScenarios(who, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' }, scenarios: remove, maxDepth: 6 });
  const p = await s.svc.generatePreventionPlan(who, { snapshotId: snap.snapshotId, scenarioId });
  return { p, cmp };
}
const k = (s: string) => s.padEnd(16, '0');
async function gate(s: ReturnType<typeof setup>) {
  const d = await s.store.get<DecisionRecord>('decision:PAY-1');
  const i = await s.jira.getIssue('PAY-1');
  return decideTransition(i.kind === 'ok' ? { ...i.issue, labels: ['anticipate-change'] } : null, d, 'PAY-1', s.now);
}

describe('Decision Firewall: partial approval cannot authorize a transition (P0)', () => {
  it('approving and verifying only the decision comment does NOT complete the plan nor open the gate', async () => {
    const s = setup();
    const { p } = await plan(s, 'B');
    const comment = p.actions.find((a) => a.type === 'ADD_COMMENT')!;
    expect(p.actions.length).toBeGreaterThan(1);
    await s.svc.approvePlan(alice, { planId: p.planId, planHash: p.planHash, approvedActionIds: [comment.actionId], idempotencyKey: k('fw-approve-1') });
    const r = await s.svc.executeApprovedPlan(alice, { planId: p.planId, idempotencyKey: k('fw-exec-1') });
    expect(r.every((x) => x.status === 'VERIFIED')).toBe(true);
    const pass = await s.svc.getPreventionPassport(alice, { planId: p.planId });
    expect(pass.plan?.status).toBe('PARTIAL');
    expect((await gate(s)).result).toBe(false);
  });
  it('completing every action of a BLOCKED option still keeps the gate closed (tickets are not a resolved migration)', async () => {
    const s = setup();
    const { p, cmp } = await plan(s, 'A');
    expect(cmp.results.find((x) => x.scenarioId === 'A')!.verdict).toBe('BLOCKED');
    await s.svc.approvePlan(alice, { planId: p.planId, planHash: p.planHash, approvedActionIds: p.actions.map((a) => a.actionId), idempotencyKey: k('fw-approve-2') });
    await s.svc.executeApprovedPlan(alice, { planId: p.planId, idempotencyKey: k('fw-exec-2') });
    expect((await s.svc.getPreventionPassport(alice, { planId: p.planId })).plan?.status).toBe('COMPLETED');
    const g = await gate(s);
    expect(g.result).toBe(false);
    expect(g.errorMessage).toMatch(/BLOCKED/);
  });
  it('all actions of a non-blocked option approved and verified: gate opens', async () => {
    const s = setup();
    const { p } = await plan(s, 'B');
    await s.svc.approvePlan(alice, { planId: p.planId, planHash: p.planHash, approvedActionIds: p.actions.map((a) => a.actionId), idempotencyKey: k('fw-approve-3') });
    await s.svc.executeApprovedPlan(alice, { planId: p.planId, idempotencyKey: k('fw-exec-3') });
    expect((await gate(s)).result).toBe(true);
  });
  it('an empty approval is refused by the service itself', async () => {
    const s = setup();
    const { p } = await plan(s, 'B');
    await expect(s.svc.approvePlan(alice, { planId: p.planId, planHash: p.planHash, approvedActionIds: [], idempotencyKey: k('fw-approve-4') })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('a failed action after a verified one never yields an open gate', async () => {
    const s = setup();
    const { p } = await plan(s, 'B');
    await s.svc.approvePlan(alice, { planId: p.planId, planHash: p.planHash, approvedActionIds: p.actions.map((a) => a.actionId), idempotencyKey: k('fw-approve-5') });
    s.jira.failNextComment = true;
    await s.svc.executeApprovedPlan(alice, { planId: p.planId, idempotencyKey: k('fw-exec-5') });
    expect((await gate(s)).result).toBe(false);
  });
});

describe('Authorization isolation', () => {
  it('another user cannot read, approve or execute a private plan', async () => {
    const s = setup();
    const { p } = await plan(s, 'B');
    await expect(s.svc.getPreventionPassport(bob, { planId: p.planId })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(s.svc.approvePlan(bob, { planId: p.planId, planHash: p.planHash, approvedActionIds: [p.actions[0]!.actionId], idempotencyKey: k('fw-approve-6') })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(s.svc.executeApprovedPlan(bob, { planId: p.planId, idempotencyKey: k('fw-exec-6') })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(s.jira.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
  });
  it('a missing identity never matches an owner, even an anonymous one', async () => {
    const s = setup();
    await expect(s.svc.getGraphSnapshot(anon, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    const { p } = await plan(s, 'B');
    await expect(s.svc.getPreventionPassport(anon, { planId: p.planId })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(s.svc.executeApprovedPlan(anon, { planId: p.planId, idempotencyKey: k('fw-exec-7') })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('an approval idempotency key reused with a different payload is a conflict', async () => {
    const s = setup();
    const { p } = await plan(s, 'B');
    const [a1, a2] = p.actions;
    await s.svc.approvePlan(alice, { planId: p.planId, planHash: p.planHash, approvedActionIds: [a1!.actionId], idempotencyKey: k('fw-approve-8') });
    await expect(s.svc.approvePlan(alice, { planId: p.planId, planHash: p.planHash, approvedActionIds: [a2!.actionId], idempotencyKey: k('fw-approve-8') })).rejects.toMatchObject({ code: 'CONFLICT' });
    // exact replay is still idempotent
    await expect(s.svc.approvePlan(alice, { planId: p.planId, planHash: p.planHash, approvedActionIds: [a1!.actionId], idempotencyKey: k('fw-approve-8') })).resolves.toBeTruthy();
  });
});
