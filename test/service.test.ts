import { createService } from '../src/engine/service';
import { decideTransition, linksDigest, type DecisionRecord } from '../src/validator';
import { classifyLink } from '../src/jira/extractor';
import { makeHandler } from '../src/core/handler';
import { mapIssue, adf } from '../src/forge-adapters';
import { GraphSnapshot, PreventionPassport, ProposedAction } from '../packages/contracts/src/index';
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

describe('W3: service actor audit + ADD_ISSUE_LINK execution (TOP4/TOP11)', () => {
  it('setValidatorPolicy audit log includes the acting accountId', async () => {
    const s = setup();
    s.jira.globalPerms = { ADMINISTER: true };
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await s.svc.setValidatorPolicy(ctx, { onOutage: 'BLOCK' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(spy.mock.calls[0]![0] as string)).toMatchObject({ app: 'anticipate', op: 'setValidatorPolicy', onOutage: 'BLOCK', accountId: 'acc-1' });
    } finally { spy.mockRestore(); }
  });

  function injectLinkAction(s: ReturnType<typeof setup>, planId: string, payload: Record<string, unknown>) {
    const rec = s.store.data.get(`plan:${planId}`) as { plan: { actions: ProposedAction[] } };
    rec.plan.actions.push({
      actionId: 'link:PAY-2-blocks-PAY-4', type: 'ADD_ISSUE_LINK', targetProjectKey: 'PAY', targetIssueKey: 'PAY-4',
      payload, reason: 'Make PAY-2 a blocker of PAY-4.', evidenceEdgeIds: [],
      requiredPermission: 'LINK_ISSUES', verificationRule: 'PAY-2 carries a Blocks link to PAY-4.'
    });
  }

  it('executes ADD_ISSUE_LINK via createLink and verifies the link', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    injectLinkAction(s, plan.planId, { type: 'Blocks', outward: 'PAY-2', inward: 'PAY-4' });
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: ['link:PAY-2-blocks-PAY-4'], idempotencyKey: 'approve-key-000011' });
    const before = s.jira.writes.link;
    const out = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000011' });
    expect(out.find((r) => r.actionId === 'link:PAY-2-blocks-PAY-4')).toMatchObject({ status: 'VERIFIED' });
    expect(s.jira.writes.link).toBe(before + 1);
    const v = await s.jira.getIssue('PAY-2');
    expect(v.kind === 'ok' && v.issue.links.some((l) => l.otherKey === 'PAY-4' && l.typeName === 'Blocks')).toBe(true);
  });

  it('ADD_ISSUE_LINK is idempotent when the link already exists', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    await s.jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-2', inwardKey: 'PAY-4' });
    injectLinkAction(s, plan.planId, { type: 'Blocks', outward: 'PAY-2', inward: 'PAY-4' });
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: ['link:PAY-2-blocks-PAY-4'], idempotencyKey: 'approve-key-000012' });
    const before = s.jira.writes.link;
    const out = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000012' });
    expect(out.find((r) => r.actionId === 'link:PAY-2-blocks-PAY-4')).toMatchObject({ status: 'VERIFIED' });
    expect(s.jira.writes.link).toBe(before);
  });

  it('ADD_ISSUE_LINK with a malformed payload fails VALIDATION, never UNSUPPORTED', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    injectLinkAction(s, plan.planId, { type: 'Blocks' });
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: ['link:PAY-2-blocks-PAY-4'], idempotencyKey: 'approve-key-000013' });
    const out = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-key-00000013' });
    expect(out.find((r) => r.actionId === 'link:PAY-2-blocks-PAY-4')).toMatchObject({ status: 'FAILED', error: { code: 'VALIDATION' } });
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

describe('S1a: scoped decision attestations (TOP7)', () => {
  const alice = { requestId: 'r', accountId: 'alice', installationId: 'i' };
  const bob = { requestId: 'r', accountId: 'bob', installationId: 'i' };

  it('exposes the scoped attestation key format decision:owner:issueKey:planId', async () => {
    const v = (await import('../src/validator')) as unknown as {
      decisionKey(o: string, i: string, p: string): string;
      parseDecisionKey(k: string): unknown;
    };
    expect(typeof v.decisionKey).toBe('function');
    expect(v.decisionKey('alice', 'PAY-1', 'plan-9')).toBe('decision:alice:PAY-1:plan-9');
    expect(v.parseDecisionKey('decision:alice:PAY-1:plan-9')).toEqual({ owner: 'alice', issueKey: 'PAY-1', planId: 'plan-9' });
    expect(v.parseDecisionKey('decision:PAY-1')).toEqual({ legacyIssueKey: 'PAY-1' });
  });

  it('attestations are scoped per owner+plan: no cross-owner last-writer-wins', async () => {
    const s = setup();
    // Alice completes a full cycle first.
    const snapA = await s.svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    await s.svc.compareScenarios(alice, { snapshotId: snapA.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' }, scenarios, maxDepth: 6 });
    const planA = await s.svc.generatePreventionPlan(alice, { snapshotId: snapA.snapshotId, scenarioId: 'A' });
    await s.svc.approvePlan(alice, { planId: planA.planId, planHash: planA.planHash, approvedActionIds: planA.actions.map((a) => a.actionId), idempotencyKey: 's1a-approve-alice001' });
    await s.svc.executeApprovedPlan(alice, { planId: planA.planId, idempotencyKey: 's1a-exec-alice000001' });
    // Bob prepares his own plan, then the evidence changes before he executes.
    const snapB = await s.svc.getGraphSnapshot(bob, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    await s.svc.compareScenarios(bob, { snapshotId: snapB.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' }, scenarios, maxDepth: 6 });
    const planB = await s.svc.generatePreventionPlan(bob, { snapshotId: snapB.snapshotId, scenarioId: 'B' });
    await s.svc.approvePlan(bob, { planId: planB.planId, planHash: planB.planHash, approvedActionIds: planB.actions.map((a) => a.actionId), idempotencyKey: 's1a-approve-bob00001' });
    await s.jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-1', inwardKey: 'PAY-4' });
    await expect(s.svc.executeApprovedPlan(bob, { planId: planB.planId, idempotencyKey: 's1a-exec-bob00000001' })).rejects.toMatchObject({ code: 'EVIDENCE_CHANGED' });
    // Alice's attestation survives under its scoped key; Bob's is recorded separately.
    const aRec = await s.store.get<DecisionRecord>(`decision:alice:PAY-1:${planA.planId}`);
    const bRec = await s.store.get<DecisionRecord>(`decision:bob:PAY-1:${planB.planId}`);
    expect(aRec).toMatchObject({ status: 'COMPLETED', owner: 'alice', planId: planA.planId, issueKey: 'PAY-1' });
    expect(bRec).toMatchObject({ status: 'EVIDENCE_CHANGED', owner: 'bob', planId: planB.planId });
    // The deprecated legacy mirror still reflects the latest write (last-writer-wins until wiring migrates).
    expect(await s.store.get<DecisionRecord>('decision:PAY-1')).toMatchObject({ status: 'EVIDENCE_CHANGED', planId: planB.planId });
  });

  it('validator enforces the attestation scope when the caller expects one', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    const gated = { labels: ['anticipate-change'], links: [] as { typeName: string; direction: string; otherKey: string }[] };
    const base = {
      schema: 3 as const, planId: 'plan-a', scenarioId: 'A', status: 'COMPLETED', at: '2026-11-02T09:00:00Z', issueKey: 'X-1',
      verdict: 'NEEDS_REVIEW', blockers: 0, currentVerdict: 'NEEDS_REVIEW', currentBlockers: 0, allActionsVerified: true,
      linksDigest: linksDigest([]), validUntil: '2026-11-20T00:00:00Z'
    };
    const scoped = { ...base, owner: 'alice' };
    expect(decideTransition(gated, scoped, 'X-1', now, { owner: 'alice', planId: 'plan-a' }).result).toBe(true);
    expect(decideTransition(gated, scoped, 'X-1', now, { owner: 'mallory', planId: 'plan-a' }))
      .toMatchObject({ result: false, errorMessage: expect.stringMatching(/another user/) });
    expect(decideTransition(gated, scoped, 'X-1', now, { owner: 'alice', planId: 'plan-other' }))
      .toMatchObject({ result: false, errorMessage: expect.stringMatching(/belongs to plan/) });
    // Legacy record (no owner): honored without scope (migration), rejected once a scope is expected.
    expect(decideTransition(gated, base, 'X-1', now).result).toBe(true);
    expect(decideTransition(gated, base, 'X-1', now, { owner: 'alice' }))
      .toMatchObject({ result: false, errorMessage: expect.stringMatching(/before scoped attestations/) });
  });

  it('keeps writing the deprecated legacy decision:issueKey mirror during migration', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 's1a-approve-mirror001' });
    await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 's1a-exec-mirror000001' });
    expect(await s.store.get<DecisionRecord>('decision:PAY-1')).toMatchObject({ status: 'COMPLETED', planId: plan.planId, owner: 'acc-1' });
  });
});

describe('S1b: active invalidation of stale approvals (TOP9)', () => {
  it('checkPlanFreshness marks an APPROVED plan INVALIDATED when evidence changed', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 's1b-approve-stale0001' });
    await s.jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-1', inwardKey: 'PAY-4' });
    const drift = await s.svc.checkPlanFreshness(ctx, { planId: plan.planId });
    expect(drift.fresh).toBe(false);
    const rec = await s.store.get<{ plan: { status: string }; timeline: { at: string; event: string }[] }>(`plan:${plan.planId}`);
    expect(rec?.plan.status).toBe('INVALIDATED');
    expect(rec?.timeline.map((t) => t.event).join('\n')).toMatch(/invalidated/i);
  });

  it('INVALIDATED plans refuse execution with zero writes', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 's1b-approve-exec00001' });
    await s.jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-1', inwardKey: 'PAY-4' });
    await s.svc.checkPlanFreshness(ctx, { planId: plan.planId });
    const before = { ...s.jira.writes };
    await expect(s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 's1b-exec-invalid00001' }))
      .rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/invalidated/i) });
    expect(s.jira.writes).toEqual(before);
  });

  it('checkPlanFreshness stays read-only when fresh or when the plan is not APPROVED', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    // PENDING_APPROVAL + changed evidence: untouched (the approval-time guard still owns this case).
    await s.jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-1', inwardKey: 'PAY-4' });
    expect((await s.svc.checkPlanFreshness(ctx, { planId: plan.planId })).fresh).toBe(false);
    const pending = await s.store.get<{ plan: { status: string }; timeline: unknown[] }>(`plan:${plan.planId}`);
    expect(pending?.plan.status).toBe('PENDING_APPROVAL');
    expect(pending?.timeline).toHaveLength(2);
    // Fresh APPROVED plan: untouched.
    const f = setup();
    const { plan: fresh } = await toPlan(f);
    await f.svc.approvePlan(ctx, { planId: fresh.planId, planHash: fresh.planHash, approvedActionIds: fresh.actions.map((a) => a.actionId), idempotencyKey: 's1b-approve-fresh0001' });
    const beforeLen = (await f.store.get<{ timeline: unknown[] }>(`plan:${fresh.planId}`))?.timeline.length;
    expect((await f.svc.checkPlanFreshness(ctx, { planId: fresh.planId })).fresh).toBe(true);
    const after = await f.store.get<{ plan: { status: string }; timeline: unknown[] }>(`plan:${fresh.planId}`);
    expect(after?.plan.status).toBe('APPROVED');
    expect(after?.timeline.length).toBe(beforeLen);
  });
});
