import { createService } from '../src/engine/service';
import { classifyLink } from '../src/jira/extractor';
import { makeHandler } from '../src/core/handler';
import { mapIssue, adf } from '../src/forge-adapters';
import { GraphSnapshot, PreventionPassport } from '../packages/contracts/src/index';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const ctx = { requestId: 'r', accountId: 'acc-1', installationId: 'i' };
let n = 0;
function setup(start = '2026-11-02T09:00:00.000Z') {
  const jira = demoJira(); const store = memoryStore(); let now = new Date(start);
  const svc = createService({ jira, store, now: () => now, newId: () => `id${++n}` });
  return { jira, store, svc, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}
const scenarios = [
  { scenarioId: 'A', label: 'Remove now', operations: [{ op: 'REMOVE_NODE' as const, nodeId: 'issue:PAY-1' }] },
  { scenarioId: 'B', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE' as const, nodeId: 'issue:PAY-1', retainUntil: null }] }
];
async function toPlan(s: ReturnType<typeof setup>, scenarioId = 'A') {
  const snap = await s.svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  const req = { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'remove v1' }, scenarios, maxDepth: 6 };
  const cmp = await s.svc.compareScenarios(ctx, req);
  const plan = await s.svc.generatePreventionPlan(ctx, { snapshotId: snap.snapshotId, scenarioId });
  return { snap, cmp, plan };
}

describe('Jira link semantics', () => {
  it('maps blocks / depends / tests directions', () => {
    const base = { id: '1', otherKey: 'X-2' };
    expect(classifyLink({ ...base, typeName: 'Blocks', outward: 'blocks', inward: 'is blocked by', direction: 'outward' })).toMatchObject({ kind: 'DEPENDS_ON', from: 'other' });
    expect(classifyLink({ ...base, typeName: 'Blocks', outward: 'blocks', inward: 'is blocked by', direction: 'inward' })).toMatchObject({ kind: 'DEPENDS_ON', from: 'self' });
    expect(classifyLink({ ...base, typeName: 'Dependency', outward: 'depends on', inward: 'is depended on by', direction: 'outward' })).toMatchObject({ kind: 'DEPENDS_ON', from: 'self' });
    expect(classifyLink({ ...base, typeName: 'Dependency', outward: 'depends on', inward: 'is depended on by', direction: 'inward' })).toMatchObject({ kind: 'DEPENDS_ON', from: 'other' });
    expect(classifyLink({ ...base, typeName: 'Test', outward: 'tests', inward: 'is tested by', direction: 'inward' })).toMatchObject({ kind: 'VERIFIED_BY', from: 'self' });
    expect(classifyLink({ ...base, typeName: 'Relates', outward: 'relates to', inward: 'relates to', direction: 'outward' })).toMatchObject({ kind: 'AFFECTS', status: 'INFERRED' });
  });
  it('maps raw Jira issue JSON', () => {
    const i = mapIssue({ id: '1', key: 'A-1', fields: { summary: 's', issuelinks: [{ id: '9', type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: { key: 'A-2' } }] } });
    expect(i.links[0]).toMatchObject({ direction: 'outward', otherKey: 'A-2' });
    expect(adf('a\nb').content).toHaveLength(2);
  });
});

describe('end-to-end use cases (fake Jira)', () => {
  it('builds a valid snapshot; unreadable issue stays UNKNOWN', async () => {
    const s = setup();
    const snap = GraphSnapshot.parse(await s.svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 }));
    expect(snap.nodes.find((x) => x.id === 'issue:SEC-9')?.status).toBe('UNKNOWN');
    const secEdge = snap.edges.find((e) => e.from === 'issue:SEC-9');
    expect(secEdge).toMatchObject({ status: 'UNKNOWN', accessLimited: true });
    expect(snap.edges.find((e) => e.from === 'issue:PAY-2' && e.to === 'issue:PAY-1')?.kind).toBe('DEPENDS_ON');
    expect(snap.nodes.find((x) => x.id === 'issue:PAY-5')?.kind).toBe('TEST');
  });
  it('compares scenarios against the real-shaped graph', async () => {
    const s = setup();
    const { cmp } = await toPlan(s);
    const a = cmp.results.find((r) => r.scenarioId === 'A')!;
    expect(a.verdict).toBe('BLOCKED');
    expect(a.impacts.map((i) => i.nodeId).sort()).toEqual(['issue:PAY-2', 'issue:PAY-3', 'issue:PAY-4', 'issue:SEC-9']);
    expect(a.violations.find((v) => v.ruleId === 'P3')!.nodeIds).not.toContain('issue:PAY-2'); // PAY-2 has a verifying test
  });
  it('plan is read-only until approved and executed; writes are verified and idempotent', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    expect(s.jira.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
    await expect(s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'k'.repeat(16) })).rejects.toMatchObject({ code: 'CONFLICT' });
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 'approve-key-000001' });
    const r1 = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000001' });
    expect(r1.every((r) => r.status === 'VERIFIED')).toBe(true);
    const writes = { ...s.jira.writes };
    expect(writes.create).toBe(2); // PAY-2, PAY-3 direct confirmed dependents
    const r2 = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000002' }).catch((e) => e);
    expect(r2).toMatchObject({ code: 'CONFLICT' }); // COMPLETED plans are not re-run
    expect(s.jira.writes).toEqual(writes);
    const passport = PreventionPassport.parse(await s.svc.getPreventionPassport(ctx, { planId: plan.planId }));
    expect(passport.plan?.status).toBe('COMPLETED');
    expect(passport.openUnknowns.some((u) => u.nodeId === 'issue:SEC-9')).toBe(true);
  });
  it('partial failure, then retry reconciles without duplicates', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 'approve-key-000002' });
    s.jira.failNextComment = true;
    const r1 = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000003' });
    expect(r1.filter((r) => r.status === 'FAILED').map((r) => r.actionId)).toEqual(['record:PAY-1']);
    expect((await s.svc.getPreventionPassport(ctx, { planId: plan.planId })).plan?.status).toBe('PARTIAL');
    const creates = s.jira.writes.create;
    const r2 = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000004' });
    expect(r2.every((r) => r.status === 'VERIFIED')).toBe(true);
    expect(s.jira.writes.create).toBe(creates);
    expect(r2.find((r) => r.actionId === 'record:PAY-1')!.attempt).toBe(2);
  });
  it('lost-response reconciliation: issue created but record not saved → no duplicate', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: [plan.actions[0]!.actionId], idempotencyKey: 'approve-key-000003' });
    await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000005' });
    for (const k of [...s.store.data.keys()]) if (k.startsWith('exec:')) s.store.data.delete(k); // simulate lost bookkeeping
    const rec = s.store.data.get(`plan:${plan.planId}`) as { plan: { status: string } };
    rec.plan.status = 'FAILED';
    const before = s.jira.writes.create;
    const r = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000006' });
    expect(r[0]!.status).toBe('VERIFIED');
    expect(s.jira.writes.create).toBe(before);
  });
  it('missing permission yields FAILED actions, never fake success', async () => {
    const s = setup();
    s.jira.perms.EDIT_ISSUES = false;
    const { plan } = await toPlan(s);
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 'approve-key-000004' });
    const r = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000007' });
    const labels = r.filter((x) => x.actionId.startsWith('needs-test'));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((x) => x.status === 'FAILED' && x.error?.code === 'PERMISSION_DENIED')).toBe(true);
    expect(s.jira.writes.label).toBe(0);
  });
  it('rejects stale approvals, expired snapshots, other users and concurrent execution', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    await expect(s.svc.approvePlan(ctx, { planId: plan.planId, planHash: 'bad', approvedActionIds: [plan.actions[0]!.actionId], idempotencyKey: 'approve-key-000005' })).rejects.toMatchObject({ code: 'STALE_APPROVAL' });
    await expect(s.svc.getPreventionPassport({ ...ctx, accountId: 'other' }, { planId: plan.planId })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: [plan.actions[0]!.actionId], idempotencyKey: 'approve-key-000006' });
    await s.store.setIfAbsent(`lock:${plan.planId}`, { until: Date.parse('2026-11-02T10:00:00Z'), key: 'x' });
    await expect(s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000008' })).rejects.toMatchObject({ code: 'CONFLICT' });
    s.advance(25 * 3600_000);
    await expect(s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000009' })).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
    expect(s.jira.writes.create).toBe(0);
  });
  it('demo fixture can be simulated and planned but never executed', async () => {
    const s = setup();
    const snap = await s.svc.getGraphSnapshot(ctx, { projectId: 'x', rootIssueKey: 'x', source: 'DEMO_FIXTURE', maxDepth: 3 });
    expect(snap.mode).toBe('DEMO_FIXTURE');
    const { FIXTURE_SCENARIOS } = await import('../packages/contracts/src/fixtures');
    await s.svc.compareScenarios(ctx, { snapshotId: snap.snapshotId, change: { issueKey: null, targetNodeId: 'svc-auth-v1', description: '' }, scenarios: FIXTURE_SCENARIOS, maxDepth: 6 });
    const plan = await s.svc.generatePreventionPlan(ctx, { snapshotId: snap.snapshotId, scenarioId: 'A-remove-now' });
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: [plan.actions[0]!.actionId], idempotencyKey: 'approve-key-000007' });
    await expect(s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000010' })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect((await s.svc.getPreventionPassport(ctx, { planId: plan.planId })).disclaimer).toMatch(/DEMO FIXTURE/);
  });
});

describe('resolver envelope', () => {
  it('rejects oversized payloads before schema validation (DoS bound)', async () => {
    let ran = false;
    const h = makeHandler('approvePlan', () => 'LIVE', () => 'req-2', () => new Date('2026-11-02T09:00:00Z'), async () => { ran = true; return {}; });
    const huge = await h({ payload: { planId: 'p', planHash: 'h', approvedActionIds: Array.from({ length: 200_000 }, (_, i) => `a${i}`), idempotencyKey: 'k'.repeat(16) } });
    expect(huge).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect((huge as { error: { message: string } }).error.message).toMatch(/too large/);
    expect(ran).toBe(false);
  });
  it('validates input and wraps errors without leaking internals', async () => {
    const h = makeHandler('getGraphSnapshot', () => 'LIVE', () => 'req-1', () => new Date('2026-11-02T09:00:00Z'), async () => { throw new Error('secret stack'); });
    const bad = await h({ payload: { projectId: '' } });
    expect(bad).toMatchObject({ ok: false, error: { code: 'VALIDATION', requestId: 'req-1' } });
    const boom = await h({ payload: { projectId: 'PAY', rootIssueKey: 'PAY-1' } });
    expect(boom).toMatchObject({ ok: false, error: { code: 'INTERNAL', message: 'Unexpected server error.' } });
    const okH = makeHandler('getPolicies', () => 'LIVE', () => 'req-2', () => new Date('2026-11-02T09:00:00Z'), async () => []);
    const demo = makeHandler('getGraphSnapshot', () => 'LIVE', () => 'r3', () => new Date('2026-11-02T09:00:00Z'), async () => (await import('../packages/contracts/src/fixtures')).FIXTURE_SNAPSHOT);
    expect(await demo({ payload: { projectId: 'x', rootIssueKey: 'x', source: 'DEMO_FIXTURE' } })).toMatchObject({ ok: true, meta: { mode: 'DEMO_FIXTURE' } });
    expect(await okH({})).toMatchObject({ ok: true, meta: { contractVersion: '0.2.0', mode: 'LIVE' }, data: [] });
  });
});
