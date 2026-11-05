import { describe, it, expect, vi } from 'vitest';
import { createService } from '../src/engine/service';
import { buildHistory, compareCheckpoints, edgesAt } from '../src/engine/history';
import { DECISION_HISTORY_LIMITS, OPERATIONS, type DecisionCheckpoint } from '../packages/contracts/src/index';
import { createRadar } from '../src/radar/radar';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
const alice = { requestId: 'r', accountId: 'alice', installationId: 'i' };
const bob = { requestId: 'r', accountId: 'bob', installationId: 'i' };
const scenarios = [{ scenarioId: 'B', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE' as const, nodeId: 'issue:PAY-1', retainUntil: null }] }];

function setup() {
  const jira = demoJira(); const store = memoryStore(); let now = new Date('2026-11-02T09:00:00.000Z'); let n = 0;
  const radar = createRadar({ store: store as never, now: () => now });
  const svc = createService({ jira, store, now: () => now, newId: () => `id${++n}`, radar });
  return { jira, store, svc, radar, tick: (ms = 60_000) => { now = new Date(now.getTime() + ms); } };
}
async function approved(s: ReturnType<typeof setup>) {
  const snap = await s.svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  await s.svc.compareScenarios(alice, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' }, scenarios, maxDepth: 6 });
  const plan = await s.svc.generatePreventionPlan(alice, { snapshotId: snap.snapshotId, scenarioId: 'B' });
  s.tick();
  await s.svc.approvePlan(alice, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 'hist-approve-000001' });
  return plan;
}
const parse = (x: unknown) => OPERATIONS.getDecisionHistory.output.parse(x);

describe('Decision Time Machine', () => {
  it('DEMO 3 shape: approved -> Jira link added -> re-check -> invalidated, with the exact added relation and zero Jira writes', async () => {
    const s = await (async () => setup())();
    const plan = await approved(s);
    let h = parse(await s.svc.getDecisionHistory(alice, { planId: plan.planId }));
    expect(h.checkpoints.map((c) => c.kind)).toEqual(['BASELINE', 'CHECK']); // approval itself re-checked evidence
    expect(h.canAuthorizeExecution).toBe(true);
    s.tick();
    await s.jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-1', inwardKey: 'PAY-4' });
    const writes = { ...s.jira.writes };
    const drift = await s.svc.checkPlanFreshness(alice, { planId: plan.planId });
    expect(drift.fresh).toBe(false);
    h = parse(await s.svc.getDecisionHistory(alice, { planId: plan.planId }));
    expect(h.status).toBe('INVALIDATED');
    expect(h.canAuthorizeExecution).toBe(false);
    const last = h.checkpoints.at(-1)!;
    expect(last).toMatchObject({ kind: 'CHECK', stage: 'freshness', fresh: false });
    expect(last.added).toEqual([expect.objectContaining({ from: 'issue:PAY-4', to: 'issue:PAY-1', kind: 'DEPENDS_ON' })]);
    expect(h.invalidation?.checkpointId).toBe(last.id);
    expect(h.statusReason).toMatch(/Cannot authorize execution/);
    const cmp = compareCheckpoints(h.baseline.edges, h.checkpoints[0]!, last);
    expect(cmp.added.map((e) => `${e.from}>${e.to}`)).toEqual(['issue:PAY-4>issue:PAY-1']);
    expect(cmp.removed).toEqual([]);
    expect(h.events.map((e) => e.source)).toContain('APPROVAL');
    expect(s.jira.writes).toEqual(writes); // history reads are side-effect free on Jira
  });

  it('history is private and never replaced by present-day Jira state', async () => {
    const s = setup();
    const plan = await approved(s);
    await expect(s.svc.getDecisionHistory(bob, { planId: plan.planId })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    const before = parse(await s.svc.getDecisionHistory(alice, { planId: plan.planId }));
    await s.jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-1', inwardKey: 'PAY-4' }); // no re-check
    const after = parse(await s.svc.getDecisionHistory(alice, { planId: plan.planId }));
    expect(after).toEqual(before);
  });

  it('a removed dependency shows as removed, unknowns are carried, deterministic order', () => {
    const base = [{ from: 'issue:A', to: 'issue:B', kind: 'DEPENDS_ON' as const, status: 'CONFIRMED' as const }, { from: 'issue:C', to: 'issue:B', kind: 'USES' as const, status: 'INFERRED' as const }];
    const cp = (id: string, o: Partial<DecisionCheckpoint>): DecisionCheckpoint => ({ id, at: '2026-11-03T00:00:00.000Z', kind: 'CHECK', stage: 'freshness', fresh: false, added: [], removed: [], becameUnknown: [], truncated: false, reason: 'r', ...o });
    const a = cp('cp-1', { fresh: true });
    const b = cp('cp-2', { removed: [base[0]!], becameUnknown: ['issue:C'], added: [{ ...base[1]!, status: 'CONFIRMED' }] });
    const c = compareCheckpoints(base, a, b);
    expect(c.removed.map((e) => e.from)).toEqual(['issue:A']);
    expect(c.changedStatus).toEqual([{ edge: expect.objectContaining({ from: 'issue:C' }), before: 'INFERRED', after: 'CONFIRMED' }]);
    expect(c.unknownNew).toEqual(['issue:C']);
    expect(edgesAt(base, a)).toEqual(edgesAt([...base].reverse(), a));
  });

  it('expired baseline is reported as missing, never invented', () => {
    const h = buildHistory({ plan: { planId: 'p', snapshotId: 's', scenarioId: 'B', createdAt: '2026-11-01T00:00:00.000Z', status: 'EVIDENCE_CHANGED' } as never,
      rootIssueKey: 'PAY-1', timeline: [], approvals: [], baseline: null, evidenceState: 'ARCHIVED', history: null, radarItems: null });
    expect(h.baseline.edges).toEqual([]);
    expect(h.baseline.edgesTruncated).toBe(true);
    expect(h.limits.join(' ')).toMatch(/no longer retained/);
    expect(h.canAuthorizeExecution).toBe(false);
    expect(() => OPERATIONS.getDecisionHistory.output.parse(h)).not.toThrow();
  });

  it('checkpoints are bounded: oldest dropped and counted', async () => {
    const s = setup();
    const plan = await approved(s);
    for (let k = 0; k < DECISION_HISTORY_LIMITS.maxCheckpoints + 5; k++) { s.tick(); await s.svc.checkPlanFreshness(alice, { planId: plan.planId }); }
    const h = parse(await s.svc.getDecisionHistory(alice, { planId: plan.planId }));
    expect(h.checkpoints).toHaveLength(DECISION_HISTORY_LIMITS.maxCheckpoints + 1);
    expect(h.droppedCheckpoints).toBe(6);
    expect(h.limits.join(' ')).toMatch(/6 older checkpoint/);
  });

  it('a storage failure while recording history never weakens the safety check', async () => {
    const s = setup();
    const plan = await approved(s);
    const orig = s.store.set.bind(s.store);
    s.store.set = (async (k: string, v: unknown) => { if (k.startsWith('hist:')) throw new Error('KVS down'); return orig(k, v); }) as typeof s.store.set;
    await s.jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-1', inwardKey: 'PAY-4' });
    await expect(s.svc.executeApprovedPlan(alice, { planId: plan.planId, idempotencyKey: 'hist-exec-0000000001' })).rejects.toMatchObject({ code: 'EVIDENCE_CHANGED' });
  });
});
