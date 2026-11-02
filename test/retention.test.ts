import { createService } from '../src/engine/service';
import { PreventionPassport } from '../packages/contracts/src/index';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const alice = { requestId: 'r', accountId: 'alice', installationId: 'i' };
const bob = { requestId: 'r', accountId: 'bob', installationId: 'i' };
const DAY = 86_400_000;

/** Emulates Forge KVS TTL: keys are dropped once their retention elapses (snap 2 d, plans/prov 90 d). */
function setup() {
  const jira = demoJira(); const store = memoryStore(); let now = new Date('2026-11-02T09:00:00.000Z'); let n = 0;
  const written = new Map<string, number>();
  const set = store.set.bind(store);
  const sia = store.setIfAbsent.bind(store);
  store.set = async (k, v) => { written.set(k, now.getTime()); return set(k, v); };
  store.setIfAbsent = async (k, v) => { const ok = await sia(k, v); if (ok) written.set(k, now.getTime()); return ok; };
  const ttlDays = (k: string) => (k.startsWith('snap:') ? 2 : k.startsWith('lock:') ? 1 : k.startsWith('idem:') ? 7 : 90);
  const expire = () => { for (const [k, at] of written) if (now.getTime() - at > ttlDays(k) * DAY) { store.data.delete(k); written.delete(k); } };
  const svc = createService({ jira, store, now: () => now, newId: () => `rt${++n}` });
  return { jira, store, svc, advance: (ms: number) => { now = new Date(now.getTime() + ms); expire(); } };
}

async function completedPlan(s: ReturnType<typeof setup>) {
  const snap = await s.svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  await s.svc.compareScenarios(alice, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'remove v1' },
    scenarios: [{ scenarioId: 'A', label: 'Remove', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 });
  const plan = await s.svc.generatePreventionPlan(alice, { snapshotId: snap.snapshotId, scenarioId: 'A' });
  await s.svc.approvePlan(alice, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 'approve-ret-000001' });
  await s.svc.executeApprovedPlan(alice, { planId: plan.planId, idempotencyKey: 'exec-ret-00000001' });
  return plan;
}

describe('Prevention Passport retention', () => {
  it('stays readable after the 2-day snapshot expires, clearly marked as a historical record', async () => {
    const s = setup();
    const plan = await completedPlan(s);
    const fresh = PreventionPassport.parse(await s.svc.getPreventionPassport(alice, { planId: plan.planId }));
    expect(fresh.evidence?.state).toBe('LIVE');
    s.advance(3 * DAY);
    expect([...s.store.data.keys()].some((k) => k.startsWith('snap:'))).toBe(false); // snapshot really gone
    const old = PreventionPassport.parse(await s.svc.getPreventionPassport(alice, { planId: plan.planId }));
    expect(old.plan?.status).toBe('COMPLETED');
    expect(old.evidence).toMatchObject({ state: 'ARCHIVED', capturedAt: fresh.evidence!.capturedAt, snapshotDigest: fresh.evidence!.snapshotDigest });
    expect(old.evidence!.causalEdgeCount).toBeGreaterThan(0);
    expect(old.disclaimer).toMatch(/HISTORICAL RECORD/);
    expect(old.executions.length).toBe(fresh.executions.length);
  });
  it('archived evidence is never usable as live evidence for new work', async () => {
    const s = setup();
    const plan = await completedPlan(s);
    s.advance(3 * DAY);
    await expect(s.svc.compareScenarios(alice, { snapshotId: plan.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
      scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(s.svc.checkPlanFreshness(alice, { planId: plan.planId })).rejects.toBeTruthy();
  });
  it('historical reads still enforce ownership', async () => {
    const s = setup();
    const plan = await completedPlan(s);
    s.advance(3 * DAY);
    await expect(s.svc.getPreventionPassport(bob, { planId: plan.planId })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('after the 90-day retention the record is gone (bounded storage, matches the privacy policy)', async () => {
    const s = setup();
    const plan = await completedPlan(s);
    s.advance(91 * DAY);
    await expect(s.svc.getPreventionPassport(alice, { planId: plan.planId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(s.store.data.size).toBe(0);
  });
  it('plans created before provenance existed degrade to an explicit NOT_FOUND once their snapshot expires', async () => {
    const s = setup();
    const plan = await completedPlan(s);
    s.store.data.delete(`prov:${plan.planId}`); // legacy plan
    s.advance(3 * DAY);
    await expect(s.svc.getPreventionPassport(alice, { planId: plan.planId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('provenance holds no issue text', async () => {
    const s = setup();
    const plan = await completedPlan(s);
    const prov = JSON.stringify(s.store.data.get(`prov:${plan.planId}`));
    expect(prov).not.toMatch(/summary/i);
    expect(prov.length).toBeLessThan(20_000);
  });
});
