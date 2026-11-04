/**
 * Execution gate for shared decisions (prerequisite for enabling the sharedDecisions flag; docs/design-core/ENTERPRISE_WORKSPACE.md).
 * A plan shared as a decision executes only when the workspace says readyToExecute (approved, same plan hash, every approver still
 * holds the approver permission, not expired/rejected/revoked), and only by its proposer. Plans never shared keep today's behaviour.
 */
import { createService } from '../src/engine/service';
import type { Ctx } from '../src/core/ports';
import { createWorkspace, sharedPlanKey, storePlanReader } from '../src/workspace/workspace';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const as = (accountId: string | null): Ctx => ({ requestId: 'r', accountId, installationId: 'i' });
const alice = as('alice'); const bob = as('bob');
let n = 0;

async function setup(opts: { share?: boolean; approve?: boolean; yieldCalls?: boolean } = {}) {
  const jira = demoJira(); const store = memoryStore(); const now = new Date('2026-11-02T09:00:00Z');
  jira.grant('alice', 'PAY', 'BROWSE_PROJECTS');
  jira.grant('bob', 'PAY', 'BROWSE_PROJECTS', 'ADMINISTER_PROJECTS');
  if (opts.yieldCalls) {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    type Fn = (...a: unknown[]) => Promise<unknown>;
    const wrap = (obj: object, keys: readonly string[]) => {
      const o = obj as Record<string, Fn>;
      for (const k of keys) { const f = o[k]!.bind(obj); o[k] = async (...a: unknown[]) => { await tick(); return f(...a); }; }
    };
    wrap(store, ['get', 'set', 'setIfAbsent', 'delete']);
    wrap(jira, ['getIssue', 'searchIssues', 'createIssue', 'createLink', 'addComment', 'addLabel', 'userHasPermission']);
  }
  const svc = createService({ jira, store, now: () => now, newId: () => `se${++n}` });
  const ws = createWorkspace({ store, now: () => now, newId: () => `se${++n}`, userHasPermission: (a, p, perm) => jira.userHasPermission(a, p, perm),
    getPlan: storePlanReader(store) });
  const snap = await svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  await svc.compareScenarios(alice, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
    scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 });
  const plan = await svc.generatePreventionPlan(alice, { snapshotId: snap.snapshotId, scenarioId: 'A' });
  await svc.approvePlan(alice, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: `appr-${n}-xxxxxxxxxx` });
  let decisionId: string | null = null;
  if (opts.share) {
    decisionId = (await ws.share(alice, { planId: plan.planId })).id;
    if (opts.approve) await ws.approve(bob, { id: decisionId, planHash: plan.planHash });
  }
  const totalWrites = () => jira.writes.create + jira.writes.link + jira.writes.comment + jira.writes.label;
  const exec = (ctx: Ctx = alice, key = `exec-${++n}-xxxxxxxxxxxx`) => svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: key });
  return { jira, store, svc, ws, plan, decisionId, totalWrites, exec };
}

describe('shared decision execution gate', () => {
  it('sharing records a write-once back-reference plan -> decision; a plan cannot be shared twice', async () => {
    const s = await setup({ share: true });
    expect(s.store.data.get(sharedPlanKey(s.plan.planId))).toBe(s.decisionId);
    await expect(s.ws.share(alice, { planId: s.plan.planId })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(s.store.data.get(sharedPlanKey(s.plan.planId))).toBe(s.decisionId);
  });

  it('shared but still IN_REVIEW: refused, zero Jira writes, plan status unchanged', async () => {
    const s = await setup({ share: true });
    await expect(s.exec()).rejects.toMatchObject({ code: 'CONFLICT', details: { decisionId: s.decisionId, reason: expect.stringMatching(/IN_REVIEW/) } });
    expect(s.totalWrites()).toBe(0);
    expect((await s.svc.getExecutionStatus(alice, { planId: s.plan.planId }))).toEqual([]);
    expect((await s.store.get<{ plan: { status: string } }>(`plan:${s.plan.planId}`))!.plan.status).toBe('APPROVED');
    expect(s.store.data.has(`lock:${s.plan.planId}`)).toBe(false); // lease released
  });

  it('shared and approved: the proposer executes', async () => {
    const s = await setup({ share: true, approve: true });
    const r = await s.exec();
    expect(r.every((x) => x.status === 'VERIFIED')).toBe(true);
    expect(s.jira.writes.create).toBe(2);
    expect((await s.store.get<{ plan: { status: string } }>(`plan:${s.plan.planId}`))!.plan.status).toBe('COMPLETED');
  });

  it('approver lost the permission between approval and execution: refused, decision REVOKED, zero writes', async () => {
    const s = await setup({ share: true, approve: true });
    s.jira.revoke('bob', 'PAY', 'ADMINISTER_PROJECTS');
    await expect(s.exec()).rejects.toMatchObject({ code: 'PERMISSION_DENIED', details: { decisionId: s.decisionId, reasonCode: 'MISSING_PERMISSION' } });
    expect(s.totalWrites()).toBe(0);
    expect((await s.ws.view(alice, s.decisionId!)).state).toBe('REVOKED');
    // Restoring the permission does not resurrect the decision.
    s.jira.grant('bob', 'PAY', 'ADMINISTER_PROJECTS');
    await expect(s.exec()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(s.totalWrites()).toBe(0);
  });

  it('plan hash changed after the decision was approved: refused, zero writes', async () => {
    const s = await setup({ share: true, approve: true });
    const key = `plan:${s.plan.planId}`;
    const rec = (await s.store.get<{ plan: { planHash: string }; approvals: { planHash: string }[] }>(key))!;
    rec.plan.planHash = 'rehashed'; rec.approvals[rec.approvals.length - 1]!.planHash = 'rehashed'; // the engine approval alone would pass
    await s.store.set(key, rec);
    await expect(s.exec()).rejects.toMatchObject({ code: 'CONFLICT', details: { reasonCode: 'EVIDENCE_CHANGED' } });
    expect(s.totalWrites()).toBe(0);
  });

  it('rejected or revoked decisions block execution for good', async () => {
    const s = await setup({ share: true });
    await s.ws.reject(bob, { id: s.decisionId!, reason: 'not this quarter' });
    await expect(s.exec()).rejects.toMatchObject({ code: 'CONFLICT', details: { reasonCode: 'REJECTED' } });
    const t = await setup({ share: true, approve: true });
    await t.ws.revoke(alice, { id: t.decisionId!, reason: 'changed my mind' });
    await expect(t.exec()).rejects.toMatchObject({ code: 'CONFLICT', details: { reasonCode: 'REVOKED' } });
    expect(s.totalWrites() + t.totalWrites()).toBe(0);
  });

  it('only the proposer executes: an approver (or anyone else) is refused', async () => {
    const s = await setup({ share: true, approve: true });
    await expect(s.exec(bob)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(s.exec(as(null))).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(s.totalWrites()).toBe(0);
  });

  it('a back-reference without a readable decision fails closed', async () => {
    const s = await setup();
    await s.store.set(sharedPlanKey(s.plan.planId), 'dec-missing');
    await expect(s.exec()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await s.store.set(sharedPlanKey(s.plan.planId), { not: 'an id' });
    await expect(s.exec()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(s.totalWrites()).toBe(0);
  });

  it('a shared plan cannot execute when the live permission check of other accounts is not wired (fail closed)', async () => {
    const s = await setup({ share: true, approve: true });
    (s.jira as { userHasPermission?: unknown }).userHasPermission = undefined;
    await expect(s.exec()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(s.totalWrites()).toBe(0);
  });

  it('an unshared plan keeps today\'s behaviour (no workspace check, no account permission lookups)', async () => {
    const s = await setup();
    (s.jira as { userHasPermission?: unknown }).userHasPermission = undefined;
    const r = await s.exec();
    expect(r.every((x) => x.status === 'VERIFIED')).toBe(true);
    expect(s.jira.writes.create).toBe(2);
  });

  it('the executor still needs the live Jira write permission on a shared, approved plan', async () => {
    const s = await setup({ share: true, approve: true });
    s.jira.perms.CREATE_ISSUES = false;
    const r = await s.exec();
    expect(r.filter((x) => x.status === 'FAILED').every((x) => x.error?.code === 'PERMISSION_DENIED')).toBe(true);
    expect(s.jira.writes.create).toBe(0);
  });

  it('concurrent double execution of a shared, approved plan: one execution, no duplicate writes', async () => {
    const s = await setup({ share: true, approve: true, yieldCalls: true });
    const res = await Promise.allSettled([s.exec(alice, 'exec-dbl-1-xxxxxxxxx'), s.exec(alice, 'exec-dbl-2-xxxxxxxxx')]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((res.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.code).toBe('CONFLICT');
    expect(s.jira.writes.create).toBe(2);
    // A replay after completion writes nothing more.
    await expect(s.exec()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(s.jira.writes.create).toBe(2);
  });

  it('re-reads the plan under the lease: an executor holding a stale APPROVED read cannot re-run a COMPLETED plan (red-team W3-1)', async () => {
    const s = await setup();
    const planKey = [...s.store.data.keys()].find((k) => k.startsWith('plan:') && k.includes(s.plan.planId))!;
    const staleCopy = JSON.parse(JSON.stringify(s.store.data.get(planKey)));
    await s.exec();
    const writesAfterFirst = s.totalWrites();
    // Simulate the race: the next first read of the plan returns the record as it was before the other executor finished.
    const realGet = s.store.get.bind(s.store); let served = false;
    (s.store as { get: typeof s.store.get }).get = (async (k: string) => {
      if (k === planKey && !served) { served = true; return JSON.parse(JSON.stringify(staleCopy)); }
      return realGet(k);
    }) as typeof s.store.get;
    await expect(s.exec()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(s.totalWrites()).toBe(writesAfterFirst);
    expect((s.store.data.get(planKey) as { plan: { status: string } }).plan.status).toBe('COMPLETED');
  });
});

