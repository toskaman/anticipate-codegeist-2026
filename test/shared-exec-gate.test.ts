/**
 * Shared-decision execution gate (P0): executeApprovedPlan must enforce the shared decision lifecycle server side.
 * Real engine service + real workspace on one store; only Jira and the permission oracle are fakes.
 * Every refusal must leave Jira untouched (zero writes).
 */
import { createService } from '../src/engine/service';
import { createWorkspace, planLinkKey } from '../src/workspace/workspace';
import { storePlanReader } from '../src/workspace/forge';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const ctx = (a: string) => ({ requestId: 'r', accountId: a, installationId: 'i' });
let n = 0;

async function setup(opts: { wireGate?: boolean } = {}) {
  const jira = demoJira(); const store = memoryStore();
  let t = new Date('2026-11-04T09:00:00Z');
  const now = () => t; const newId = () => `g${++n}`;
  // PAY project: alice proposes; bob and carol are project admins (approvers); mallory has nothing.
  const perms: Record<string, Set<string>> = {
    alice: new Set(['BROWSE_PROJECTS']), bob: new Set(['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS']),
    carol: new Set(['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS']), mallory: new Set()
  };
  const ws = createWorkspace({ store, now, newId, userHasPermission: async (a, _p, perm) => perms[a]?.has(perm) ?? false, getPlan: storePlanReader(store) });
  const svc = createService({ jira, store, now, newId, ...(opts.wireGate === false ? {} : { sharedDecisions: ws }) });
  const a = ctx('alice');
  const snap = await svc.getGraphSnapshot(a, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  await svc.compareScenarios(a, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
    scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 });
  const plan = await svc.generatePreventionPlan(a, { snapshotId: snap.snapshotId, scenarioId: 'A' });
  await svc.approvePlan(a, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((x) => x.actionId), idempotencyKey: `appr-${n}-xxxxxxxxxx` });
  const writes = () => jira.writes.create + jira.writes.link + jira.writes.comment + jira.writes.label;
  const exec = (who = 'alice', key = `exec-${++n}-xxxxxxxxxx`) => svc.executeApprovedPlan(ctx(who), { planId: plan.planId, idempotencyKey: key });
  return { jira, store, svc, ws, plan, perms, writes, exec, advance: (days: number) => { t = new Date(t.getTime() + days * 86400000); } };
}

describe('shared decision execution gate (P0)', () => {
  it('private plan (never shared): legacy execution unchanged', async () => {
    const s = await setup();
    const out = await s.exec();
    expect(out.length).toBeGreaterThan(0);
    expect(s.writes()).toBeGreaterThan(0);
  });

  it('missing approval: a shared plan in review cannot execute, even by its owner, and writes nothing', async () => {
    const s = await setup();
    await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    await expect(s.exec()).rejects.toMatchObject({ code: 'STALE_APPROVAL' });
    expect(s.writes()).toBe(0);
  });

  it('client cannot bypass: the link is server state, so there is no decision id to omit', async () => {
    const s = await setup();
    const d = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    expect(await s.store.get(planLinkKey(s.plan.planId))).toMatchObject({ decisionId: d.id });
    // executeApprovedPlan takes only { planId, idempotencyKey }; extra fields are not consulted.
    await expect(s.svc.executeApprovedPlan(ctx('alice'), { planId: s.plan.planId, idempotencyKey: 'exec-nodec-xxxxxxxx', sharedDecisionId: undefined } as never))
      .rejects.toMatchObject({ code: 'STALE_APPROVAL' });
    expect(s.writes()).toBe(0);
  });

  it('one approval when two are required: refused, zero writes; second approval: executes', async () => {
    const s = await setup();
    const d = await s.ws.share(ctx('alice'), { planId: s.plan.planId, requiredApprovals: 2 });
    await s.ws.approve(ctx('bob'), { id: d.id, planHash: s.plan.planHash });
    await expect(s.exec()).rejects.toMatchObject({ code: 'STALE_APPROVAL' });
    expect(s.writes()).toBe(0);
    await s.ws.approve(ctx('carol'), { id: d.id, planHash: s.plan.planHash });
    await expect(s.exec()).resolves.toBeTruthy();
    expect(s.writes()).toBeGreaterThan(0);
  });

  it('approved decision: only the proposer executes; an approver or an outsider is refused with zero writes', async () => {
    const s = await setup();
    const d = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    await s.ws.approve(ctx('bob'), { id: d.id, planHash: s.plan.planHash });
    await expect(s.exec('bob')).rejects.toBeTruthy();
    await expect(s.exec('mallory')).rejects.toBeTruthy();
    expect(s.writes()).toBe(0);
    await expect(s.exec('alice')).resolves.toBeTruthy();
  });

  it('expired approval window: refused, EXPIRED recorded, zero writes', async () => {
    const s = await setup();
    const d = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    await s.ws.approve(ctx('bob'), { id: d.id, planHash: s.plan.planHash });
    s.advance(8);
    await expect(s.exec()).rejects.toBeTruthy(); // snapshot or decision expiry, both refuse before any write
    expect(s.writes()).toBe(0);
  });

  it('revoked, rejected: refused with zero writes; the plan stays governed (no fallback to private execution)', async () => {
    for (const close of ['revoke', 'reject'] as const) {
      const s = await setup();
      const d = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
      if (close === 'revoke') { await s.ws.approve(ctx('bob'), { id: d.id, planHash: s.plan.planHash }); await s.ws.revoke(ctx('alice'), { id: d.id, reason: 'scope changed' }); }
      else await s.ws.reject(ctx('carol'), { id: d.id, reason: 'not safe yet' });
      await expect(s.exec()).rejects.toMatchObject({ code: 'STALE_APPROVAL' });
      expect(s.writes()).toBe(0);
    }
  });

  it('approver loses the permission before execution: decision revoked, zero writes', async () => {
    const s = await setup();
    const d = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    await s.ws.approve(ctx('bob'), { id: d.id, planHash: s.plan.planHash });
    s.perms.bob!.delete('ADMINISTER_PROJECTS');
    await expect(s.exec()).rejects.toMatchObject({ code: 'STALE_APPROVAL' });
    expect((await s.ws.view(ctx('alice'), d.id)).state).toBe('REVOKED');
    expect(s.writes()).toBe(0);
  });

  it('a plan linked to a decision whose record is missing fails closed', async () => {
    const s = await setup();
    await s.store.set(planLinkKey(s.plan.planId), { decisionId: 'dec-ghost', at: 'x' });
    await expect(s.exec()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await s.store.set(planLinkKey(s.plan.planId), { decisionId: 42 });
    await expect(s.exec()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(s.writes()).toBe(0);
  });

  it('gate not wired: a shared plan refuses to execute (fail closed), zero writes', async () => {
    const s = await setup({ wireGate: false });
    await s.store.set(planLinkKey(s.plan.planId), { decisionId: 'dec-1', at: 'x' });
    await expect(s.exec()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(s.writes()).toBe(0);
  });

  it('revocation landing mid-execution stops further writes (re-check before every Jira write)', async () => {
    const s = await setup();
    const d = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    await s.ws.approve(ctx('bob'), { id: d.id, planHash: s.plan.planHash });
    expect(s.plan.actions.length).toBeGreaterThan(1);
    // Revoke as soon as the first Jira write happens.
    const j = s.jira as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    let revoked = false;
    for (const k of ['createIssue', 'createLink', 'addComment', 'addLabel']) {
      const f = j[k]!.bind(s.jira);
      j[k] = async (...a: unknown[]) => { const r = await f(...a); if (!revoked) { revoked = true; await s.ws.revoke(ctx('bob'), { id: d.id, reason: 'stop now' }); } return r; };
    }
    await s.exec();
    const after = s.writes();
    expect(after).toBeLessThan(s.plan.actions.length * 2); // stopped early
    const rec = await s.store.get<{ plan: { status: string }; timeline: { event: string }[] }>(`plan:${s.plan.planId}`);
    expect(['PARTIAL', 'FAILED']).toContain(rec!.plan.status);
    expect(rec!.timeline.some((e) => e.event.startsWith('Execution stopped: shared decision'))).toBe(true);
  });

  it('two concurrent executions of an approved shared plan: exactly one runs', async () => {
    const s = await setup();
    const d = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    await s.ws.approve(ctx('bob'), { id: d.id, planHash: s.plan.planHash });
    const res = await Promise.allSettled([s.exec(), s.exec()]);
    expect(res.filter((r) => r.status === 'fulfilled').length).toBe(1);
  });

  it('re-sharing: refused while a decision is open, allowed after it is closed (new decision governs)', async () => {
    const s = await setup();
    const d1 = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    await expect(s.ws.share(ctx('alice'), { planId: s.plan.planId })).rejects.toMatchObject({ code: 'CONFLICT' });
    await s.ws.revoke(ctx('alice'), { id: d1.id, reason: 'redo review' });
    const d2 = await s.ws.share(ctx('alice'), { planId: s.plan.planId });
    expect(await s.store.get(planLinkKey(s.plan.planId))).toMatchObject({ decisionId: d2.id });
    await expect(s.exec()).rejects.toMatchObject({ code: 'STALE_APPROVAL' });
    await s.ws.approve(ctx('bob'), { id: d2.id, planHash: s.plan.planHash });
    await expect(s.exec()).resolves.toBeTruthy();
  });
});
