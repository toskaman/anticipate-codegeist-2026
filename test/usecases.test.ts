import { simulate } from '../packages/simulation-core/src/index';
import type { GraphSnapshot } from '../packages/contracts/src/index';
import { DEFAULT_POLICIES } from '../src/engine/policies';
import { decideTransition, linksDigest, type DecisionRecord } from '../src/validator';
import { createService } from '../src/engine/service';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const snap = (cat: string | null): GraphSnapshot => ({
  snapshotId: 's', projectId: 'p', createdAt: '2026-11-02T00:00:00.000Z', expiresAt: '2026-11-03T00:00:00.000Z', mode: 'LIVE', truncated: false, limits: { maxDepth: 3, maxNodes: 200 },
  nodes: [
    { id: 'component:10', kind: 'COMPONENT', label: 'legacy-billing', status: 'CONFIRMED', attributes: {}, references: [] },
    { id: 'issue:B-1', kind: 'ISSUE', label: 'open work', status: 'CONFIRMED', attributes: { statusCategory: cat }, references: [] },
    { id: 'issue:B-2', kind: 'ISSUE', label: 'done work', status: 'CONFIRMED', attributes: { statusCategory: 'done' }, references: [] }
  ],
  edges: [
    { id: 'a1', from: 'issue:B-1', to: 'component:10', kind: 'AFFECTS', status: 'CONFIRMED', references: [], accessLimited: false },
    { id: 'a2', from: 'issue:B-2', to: 'component:10', kind: 'AFFECTS', status: 'CONFIRMED', references: [], accessLimited: false }
  ]
});
const decommission = { scenarioId: 'D', label: 'Decommission', operations: [{ op: 'REMOVE_NODE' as const, nodeId: 'component:10' }] };

describe('use case 2: service / component decommission', () => {
  it('open work items referencing the component block decommission (P4); done work does not', () => {
    const r = simulate(snap('indeterminate'), decommission, DEFAULT_POLICIES);
    expect(r.verdict).toBe('BLOCKED');
    expect(r.violations.find((v) => v.ruleId === 'P4')!.nodeIds).toEqual(['issue:B-1']);
  });
  it('all referencing work done → no P4; unknown status category is not treated as done or open', () => {
    expect(simulate(snap('done'), decommission, DEFAULT_POLICIES).violations.some((v) => v.ruleId === 'P4')).toBe(false);
    expect(simulate(snap(null), decommission, DEFAULT_POLICIES).violations.some((v) => v.ruleId === 'P4')).toBe(false);
  });
  it('deprecating (not removing) never triggers P4', () => {
    const r = simulate(snap('new'), { scenarioId: 'R', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE', nodeId: 'component:10', retainUntil: null }] }, DEFAULT_POLICIES);
    expect(r.violations.some((v) => v.ruleId === 'P4')).toBe(false);
  });
});

describe('Jira workflow validator (Decision Firewall, attestation schema 2)', () => {
  const gated = (links: { typeName: string; direction: string; otherKey: string }[] = []) => ({ labels: ['anticipate-change'], links });
  const now = new Date('2026-11-10T00:00:00Z');
  const att = (o: Record<string, unknown> = {}) => ({ schema: 3 as const, verdict: 'NEEDS_REVIEW', blockers: 0, currentVerdict: 'NEEDS_REVIEW', currentBlockers: 0, allActionsVerified: true, planId: 'p', scenarioId: 'A', status: 'COMPLETED', at: '', issueKey: 'X-1',
    linksDigest: linksDigest([]), validUntil: '2026-11-20T00:00:00Z', ...o });
  it('ungated or unreadable issues always pass; gated issues need a valid attestation', () => {
    expect(decideTransition({ labels: ['other'], links: [] }, undefined, 'X-1', now).result).toBe(true);
    expect(decideTransition(null, undefined, 'X-1', now).result).toBe(true);
    expect(decideTransition(gated(), undefined, 'X-1', now)).toMatchObject({ result: false });
    expect(decideTransition(gated(), att({ status: 'PARTIAL' }), 'X-1', now).errorMessage).toMatch(/PARTIAL/);
    expect(decideTransition(gated(), att({ status: 'EVIDENCE_CHANGED' }), 'X-1', now).errorMessage).toMatch(/evidence changed/);
    expect(decideTransition(gated(), att(), 'X-1', now).result).toBe(true);
  });
  it('a COMPLETED plan is not permanent authorization', () => {
    // legacy records (no attestation, or schema 2 without option verdict)
    expect(decideTransition(gated(), att({ schema: 2 }), 'X-1', now).errorMessage).toMatch(/before the current decision attestations/);
    expect(decideTransition(gated(), { planId: 'p', scenarioId: 'A', status: 'COMPLETED', at: '' }, 'X-1', now).errorMessage).toMatch(/before the current decision attestations/);
    // expired
    expect(decideTransition(gated(), att(), 'X-1', new Date('2026-11-21T00:00:00Z')).errorMessage).toMatch(/expired/);
    // wrong issue
    expect(decideTransition(gated(), att({ issueKey: 'X-2' }), 'X-1', now).errorMessage).toMatch(/another issue/);
    // dependency links changed after verification
    expect(decideTransition(gated([{ typeName: 'Blocks', direction: 'outward', otherKey: 'X-9' }]), att(), 'X-1', now).errorMessage).toMatch(/links changed/);
    // link order is irrelevant
    const two = [{ typeName: 'Blocks', direction: 'outward', otherKey: 'A-1' }, { typeName: 'Relates', direction: 'inward', otherKey: 'B-1' }];
    expect(decideTransition(gated([...two].reverse()), att({ linksDigest: linksDigest(two) }), 'X-1', now).result).toBe(true);
  });
  it('verified execution writes an attestation bound to the issue, plan and post-execution links', async () => {
    const jira = demoJira(); const store = memoryStore(); let n = 0; const t = new Date('2026-11-02T09:00:00Z');
    const svc = createService({ jira, store, now: () => t, newId: () => `v${++n}` });
    const ctx = { requestId: 'r', accountId: 'u', installationId: 'i' };
    const s = await svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    await svc.compareScenarios(ctx, { snapshotId: s.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' }, scenarios: [{ scenarioId: 'B', label: 'B', operations: [{ op: 'DEPRECATE_NODE', nodeId: 'issue:PAY-1', retainUntil: null }] }], maxDepth: 6 });
    const plan = await svc.generatePreventionPlan(ctx, { snapshotId: s.snapshotId, scenarioId: 'B' });
    await svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 'approve-val-000001' });
    await svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'exec-val-00000001' });
    const decision = await store.get<DecisionRecord>('decision:PAY-1');
    expect(decision).toMatchObject({ schema: 3, verdict: 'NEEDS_REVIEW', allActionsVerified: true, status: 'COMPLETED', issueKey: 'PAY-1', planId: plan.planId, planHash: plan.planHash });
    const live = await jira.getIssue('PAY-1');
    const issue = live.kind === 'ok' ? live.issue : null;
    expect(decideTransition(issue, decision!, 'PAY-1', t).result).toBe(true);
    // a new dependency appears afterwards -> the old decision no longer authorizes the transition
    await jira.createLink({ typeName: 'Blocks', outwardKey: 'PAY-1', inwardKey: 'PAY-4' });
    const after = await jira.getIssue('PAY-1');
    expect(decideTransition(after.kind === 'ok' ? after.issue : null, decision!, 'PAY-1', t).errorMessage).toMatch(/links changed/);
  });
});
