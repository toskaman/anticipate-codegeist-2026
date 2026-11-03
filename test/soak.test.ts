import { createService } from '../src/engine/service';
import { decideTransition, type DecisionRecord } from '../src/validator';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

/** Repeated full decision cycles on one store: no duplicate writes, bounded storage growth, stable gate semantics. */
describe('soak: 50 decision cycles', () => {
  it('stays idempotent and bounded', async () => {
    const jira = demoJira(); const store = memoryStore(); let n = 0; let t = Date.parse('2026-11-03T00:00:00Z');
    const svc = createService({ jira, store, now: () => new Date(t), newId: () => `s${++n}` });
    const ctx = { requestId: 'r', accountId: 'u', installationId: 'i' };
    const sizes: number[] = [];
    for (let i = 0; i < 50; i++) {
      t += 60_000;
      const snap = await svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
      await svc.compareScenarios(ctx, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
        scenarios: [{ scenarioId: 'B', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE', nodeId: 'issue:PAY-1', retainUntil: null }] }], maxDepth: 6 });
      const p = await svc.generatePreventionPlan(ctx, { snapshotId: snap.snapshotId, scenarioId: 'B' });
      await svc.approvePlan(ctx, { planId: p.planId, planHash: p.planHash, approvedActionIds: p.actions.map((a) => a.actionId), idempotencyKey: `soak-approve-${String(i).padStart(4, "0")}` });
      const r = await svc.executeApprovedPlan(ctx, { planId: p.planId, idempotencyKey: `soak-exec-key-${String(i).padStart(4, "0")}` });
      expect(r.every((x) => x.status === 'VERIFIED')).toBe(true);
      sizes.push(store.data.size);
    }
    // per-cycle growth is constant (no leak from locks or claims): last increments equal the first ones
    const deltas = sizes.slice(1).map((s, i) => s - sizes[i]!);
    expect(new Set(deltas.slice(5)).size).toBe(1);
    expect([...store.data.keys()].some((k) => k.startsWith('lock:'))).toBe(false);
    // the gate reflects the latest attestation only
    const d = await store.get<DecisionRecord>('decision:PAY-1');
    const live = await jira.getIssue('PAY-1');
    expect(decideTransition(live.kind === 'ok' ? { ...live.issue, labels: ['anticipate-change'] } : null, d, 'PAY-1', new Date(t)).result).toBe(true);
  });
});
