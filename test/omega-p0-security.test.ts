/**
 * OMEGA P0/P1 backend hardening regression suite (tournament ranks #1-#12, executable items).
 *
 * Each test below FAILS on the pre-fix behavior and passes after the minimal fix:
 * - P0-2 release.ts compares verdict === 'BLOCK', but SimulationResult verdicts are BLOCKED/NEEDS_REVIEW/PASS.
 * - P1-7a actorOf prefers caller-controlled payload context over the handler argument.
 * - P1-7b link verification ignores link direction (opposite-direction link verifies without a write).
 * - P1-7c drift treats any marker-labelled issue as a plan artifact (owner can blind the gate).
 * - P1-6 validator fails open to ALLOW when the outage policy itself is unreadable, even with a known BLOCK.
 * - P0-4 Rovo/MCP actions bypass throttle + payload bounds wired for resolver ops.
 * - P3-1 unexpected failure during execution bricks the plan in EXECUTING.
 * - P3-2 throttle keys collide after character sanitization (/ vs _).
 * - P1-8a stored snapshot/provenance byte size is unmeasured (240 KiB KVS cap risk).
 * - P1-8b transient Jira 429/5xx fails idempotent reads with no retry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createService } from '../src/engine/service';
import { classify } from '../src/engine/release';
import { actorOf, createRovoActions } from '../src/rovo';
import { runValidator, type DecisionRecord } from '../src/validator';
import { createStoreThrottle, throttleKey } from '../src/core/throttle';
import { actionMarker } from '../src/engine/plans';
import { createForgeJira } from '../src/forge-adapters';
import type { JiraIssue } from '../src/core/ports';
import type { ProposedAction } from '../packages/contracts/src/index';
import { demoJira, memoryStore } from './fakes';

const mocks = vi.hoisted(() => ({ requestJira: vi.fn() }));
vi.mock('@forge/api', () => ({ default: { asUser: () => ({ requestJira: mocks.requestJira }), asApp: () => ({ requestJira: mocks.requestJira }) }, route: () => 'mocked-route' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const ctx = { requestId: 'r', accountId: 'acc-1', installationId: 'i' };
let n = 0;
function setup(start = '2026-11-02T09:00:00.000Z') {
  const jira = demoJira(); const store = memoryStore(); const now = new Date(start);
  const svc = createService({ jira, store, now: () => now, newId: () => `id${++n}` });
  return { jira, store, svc };
}
const scenarios = [
  { scenarioId: 'A', label: 'Remove now', operations: [{ op: 'REMOVE_NODE' as const, nodeId: 'issue:PAY-1' }] },
  { scenarioId: 'B', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE' as const, nodeId: 'issue:PAY-1', retainUntil: null }] }
];
async function toPlan(s: ReturnType<typeof setup>, scenarioId = 'A') {
  const snap = await s.svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
  const cmp = await s.svc.compareScenarios(ctx, { snapshotId: snap.snapshotId,
    change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'remove v1' }, scenarios, maxDepth: 6 });
  const plan = await s.svc.generatePreventionPlan(ctx, { snapshotId: snap.snapshotId, scenarioId });
  return { snap, cmp, plan };
}
/** Replace a fresh plan's actions with crafted ones, then approve (planHash is preserved, so approval stays valid). */
async function approvedCraftedPlan(s: ReturnType<typeof setup>, actions: ProposedAction[]) {
  const { plan } = await toPlan(s);
  const rec = (await s.store.get<Record<string, never>>(`plan:${plan.planId}`)) as unknown as {
    plan: { planId: string; planHash: string; actions: ProposedAction[] } };
  rec.plan.actions = actions;
  await s.store.set(`plan:${plan.planId}`, rec);
  await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: rec.plan.planHash,
    approvedActionIds: actions.map((a) => a.actionId), idempotencyKey: `approve-${++n}` });
  return rec.plan;
}

describe('OMEGA P0-2: BLOCKED verdict blocks the release', () => {
  const NOW = new Date('2026-11-05T12:00:00.000Z');
  const issue: JiraIssue = { id: '1', key: 'REL-1', summary: 's', status: 'To Do', issueType: 'Task', projectId: '1',
    projectKey: 'REL', updated: '2026-11-01T00:00:00.000Z', labels: [], components: [], links: [] };
  const dec = (over: Partial<DecisionRecord>): DecisionRecord => ({ schema: 3, planId: 'plan-1', scenarioId: 's',
    status: 'COMPLETED', at: '2026-11-04T10:00:00.000Z', owner: 'u1', verdict: 'PASS', allActionsVerified: true,
    currentVerdict: 'PASS', validUntil: '2026-11-18T10:00:00.000Z', ...over });
  it('BLOCKED verdict classifies the change BLOCKED', () => {
    expect(classify(issue, dec({ verdict: 'BLOCKED', currentVerdict: 'BLOCKED', currentBlockers: 2 }), NOW).state).toBe('BLOCKED');
  });
  it('NEEDS_REVIEW and PASS verdicts do not classify BLOCKED', () => {
    expect(classify(issue, dec({ verdict: 'NEEDS_REVIEW', currentVerdict: 'NEEDS_REVIEW' }), NOW).state).not.toBe('BLOCKED');
    expect(classify(issue, dec({ verdict: 'PASS', currentVerdict: 'PASS' }), NOW).state).not.toBe('BLOCKED');
  });
});

describe('OMEGA P1-7a: Rovo actor cannot be spoofed via payload context', () => {
  it('prefers the handler argument over caller-controlled payload context', () => {
    expect(actorOf({ context: { accountId: 'victim' } }, { accountId: 'attacker' })).toBe('attacker');
    expect(actorOf({ context: { principal: { accountId: 'victim' } } }, { principal: { accountId: 'attacker' } })).toBe('attacker');
  });
  it('still resolves each source alone', () => {
    expect(actorOf({ context: { accountId: 'a' } })).toBe('a');
    expect(actorOf({}, { accountId: 'b' })).toBe('b');
    expect(actorOf({})).toBeNull();
  });
});

describe('OMEGA P1-7b: link verification asserts direction', () => {
  it('opposite-direction link does not satisfy ADD_ISSUE_LINK verification', async () => {
    const s = setup();
    s.jira.link('Blocks', 'blocks', 'is blocked by', 'PAY-2', 'PAY-3'); // PAY-3 sees PAY-2 as INWARD
    const action: ProposedAction = { actionId: 'a-l', type: 'ADD_ISSUE_LINK', targetProjectKey: 'PAY', targetIssueKey: 'PAY-3',
      payload: { type: 'Blocks', inward: 'PAY-2', outward: 'PAY-3' }, reason: 't', evidenceEdgeIds: [],
      requiredPermission: 'LINK_ISSUES', verificationRule: 'v' };
    const plan = await approvedCraftedPlan(s, [action]);
    const before = s.jira.writes.link;
    const out = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: `exec-${++n}` });
    expect(s.jira.writes.link).toBe(before + 1);
    expect(out[0]?.status).toBe('VERIFIED');
  });
  it('inward link does not satisfy CREATE_ISSUE link verification', async () => {
    const s = setup();
    const action: ProposedAction = { actionId: 'a-c', type: 'CREATE_ISSUE', targetProjectKey: 'PAY', targetIssueKey: null,
      payload: { summary: 's', description: 'd', blocksIssueKey: 'PAY-2', linkType: 'Blocks' }, reason: 't', evidenceEdgeIds: [],
      requiredPermission: 'CREATE_ISSUES', verificationRule: 'v' };
    const plan = await approvedCraftedPlan(s, [action]);
    // Simulate a timed-out first attempt: CLAIMED record without resultRef + the artifact already in Jira.
    await s.store.set(`exec:${plan.planId}:a-c`, { executionId: 'e1', planId: plan.planId, actionId: 'a-c', attempt: 1,
      idempotencyKey: 'k', status: 'CLAIMED', resultRef: null, error: null, updatedAt: '2026-11-02T09:00:00.000Z' });
    const marker = actionMarker(plan.planId, 'a-c');
    s.jira.add('PAY-50', 'artifact', { labels: ['anticipate', marker] });
    s.jira.link('Blocks', 'blocks', 'is blocked by', 'PAY-2', 'PAY-50'); // PAY-50 sees PAY-2 as INWARD
    const before = s.jira.writes.link;
    const out = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: `exec-${++n}` });
    expect(s.jira.writes.link).toBe(before + 1);
    expect(out[0]?.status).toBe('VERIFIED');
  });
});

describe('OMEGA P1-7c: marker labels alone do not mark drift artifacts', () => {
  const craftCreate = async (s: ReturnType<typeof setup>) => {
    const { plan } = await toPlan(s);
    const rec = (await s.store.get<Record<string, never>>(`plan:${plan.planId}`)) as unknown as {
      plan: { planId: string; actions: ProposedAction[] } };
    rec.plan.actions = [{ actionId: 'a-c', type: 'CREATE_ISSUE', targetProjectKey: 'PAY', targetIssueKey: null,
      payload: { summary: 's', description: 'd', blocksIssueKey: 'PAY-2', linkType: 'Blocks' }, reason: 't', evidenceEdgeIds: [],
      requiredPermission: 'CREATE_ISSUES', verificationRule: 'v' }];
    await s.store.set(`plan:${plan.planId}`, rec);
    return rec.plan;
  };
  it('marker pasted on a pre-existing issue does not blind the drift gate', async () => {
    const s = setup();
    const plan = await craftCreate(s);
    s.jira.issues.get('PAY-4')!.labels.push(actionMarker(plan.planId, 'a-c')); // attacker pastes own marker
    s.jira.add('PAY-9', 'new blocker');
    s.jira.link('Blocks', 'blocks', 'is blocked by', 'PAY-4', 'PAY-9'); // PAY-4 gains a blocking link
    const drift = await s.svc.checkPlanFreshness(ctx, { planId: plan.planId });
    expect(drift.fresh).toBe(false);
  });
  it('marker + execution record still corroborates a real artifact after a timeout', async () => {
    const s = setup();
    const plan = await craftCreate(s);
    await s.store.set(`exec:${plan.planId}:a-c`, { executionId: 'e1', planId: plan.planId, actionId: 'a-c', attempt: 1,
      idempotencyKey: 'k', status: 'CLAIMED', resultRef: null, error: null, updatedAt: '2026-11-02T09:00:00.000Z' });
    const marker = actionMarker(plan.planId, 'a-c');
    s.jira.add('PAY-10', 'timeout artifact', { labels: ['anticipate', marker] });
    s.jira.link('Dependency', 'depends on', 'is depended on by', 'PAY-10', 'PAY-2');
    const drift = await s.svc.checkPlanFreshness(ctx, { planId: plan.planId });
    expect(drift.fresh).toBe(true);
  });
  it('pasted marker on a baseline issue does not skew completion attestation', async () => {
    async function runWithPaste(paste: boolean) {
      const s = setup();
      const { plan } = await toPlan(s);
      await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash,
        approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: `ap-${++n}` });
      if (paste) {
        const create = plan.actions.find((a) => a.type === 'CREATE_ISSUE');
        expect(create).toBeDefined();
        const marker = actionMarker(plan.planId, create!.actionId);
        s.jira.issues.get('PAY-2')!.labels.push(marker);
        s.jira.issues.get('PAY-3')!.labels.push(marker);
      }
      const out = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: `ex-${++n}` });
      const dec = await s.store.get<{ status: string; currentVerdict?: string; currentBlockers?: number }>(`decision:PAY-1`);
      return { dec, creates: s.jira.writes.create, refs: out.map((r) => (r.resultRef as { issueKey?: string } | null)?.issueKey ?? null) };
    }
    const control = await runWithPaste(false);
    expect(control.dec?.status).toBe('COMPLETED');
    expect(control.dec?.currentVerdict).toBe('BLOCKED');
    expect(control.dec?.currentBlockers).toBe(1);
    expect(control.creates).toBe(2);
    const attacked = await runWithPaste(true);
    expect(attacked.dec?.status).toBe('COMPLETED');
    expect(attacked.creates).toBe(2); // no hijack: pre-existing issues are never adopted as artifacts
    expect(attacked.dec?.currentVerdict).toBe(control.dec?.currentVerdict);
    expect(attacked.dec?.currentBlockers).toBe(control.dec?.currentBlockers);
  });
});

describe('OMEGA P1-6: cached BLOCK survives a policy-read outage', () => {
  const gated = { kind: 'ok', issue: { labels: ['anticipate-change'], links: [] } };
  const io = (readPolicy: () => Promise<{ onOutage?: string } | undefined>) => ({
    readIssue: async () => gated, readDecision: async () => { throw new Error('kvs down'); }, readPolicy,
    log: () => undefined, now: new Date('2026-11-10T00:00:00.000Z') });
  it('honors the last known BLOCK when the policy cannot be read', async () => {
    const first = await runValidator('X-1', io(async () => ({ onOutage: 'BLOCK' })));
    expect(first.result).toBe(false); // populates the last-known-policy cache
    const second = await runValidator('X-1', io(async () => { throw new Error('kvs down'); }));
    expect(second.result).toBe(false);
    expect(second.errorMessage).toMatch(/last known/i);
  });
});

describe('OMEGA P0-4: Rovo/MCP abuse envelope', () => {
  function rovoSetup(limit = 60) {
    const jira = demoJira(); const store = memoryStore(); let i = 0;
    const deps = () => ({ jira, store, now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `r${++i}` });
    const throttle = createStoreThrottle(store, { limit, windowMs: 60_000 });
    const a = createRovoActions(deps, { throttle });
    return { jira, store, a };
  }
  it('rate-limits a looping caller per account+action', async () => {
    const { a } = rovoSetup(2);
    const c = { accountId: 'acc-1' };
    expect(await a.getGraph({ issueKey: 'PAY-1' }, c)).toMatch(/Evidence graph/);
    expect(await a.getGraph({ issueKey: 'PAY-1' }, c)).toMatch(/Evidence graph/);
    expect(await a.getGraph({ issueKey: 'PAY-1' }, c)).toMatch(/RATE_LIMITED/);
  });
  it('rejects oversized payloads before any Jira call', async () => {
    const { jira, a } = rovoSetup();
    let reads = 0; const orig = jira.getIssue.bind(jira);
    jira.getIssue = (async (...args: Parameters<typeof orig>) => { reads++; return orig(...args); }) as typeof orig;
    const p = { issueKey: 'PAY-1' } as Record<string, unknown>;
    p.junk = 'x'.repeat(70000);
    const r = await a.getGraph(p as unknown as { issueKey: string }, { accountId: 'acc-1' });
    expect(r).toMatch(/too large/);
    expect(reads).toBe(0);
  });
});

describe('OMEGA P3-1: EXECUTING plans restore on unexpected failure', () => {
  it('unexpected failure restores the prior status instead of bricking the plan', async () => {
    const s = setup();
    const { plan } = await toPlan(s);
    await s.svc.approvePlan(ctx, { planId: plan.planId, planHash: plan.planHash,
      approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: 'k-approve' });
    const orig = s.jira.myPermissions.bind(s.jira);
    let calls = 0;
    s.jira.myPermissions = (async (...a: Parameters<typeof orig>) => {
      calls++; if (calls === 1) throw new Error('boom'); return orig(...a);
    }) as typeof orig;
    await expect(s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'k-exec-1' })).rejects.toThrow();
    const rec = await s.store.get<{ plan: { status: string } }>(`plan:${plan.planId}`);
    expect(rec?.plan.status).toBe('APPROVED');
    s.jira.myPermissions = orig;
    const out = await s.svc.executeApprovedPlan(ctx, { planId: plan.planId, idempotencyKey: 'k-exec-2' });
    expect(Array.isArray(out)).toBe(true);
  });
});

describe('OMEGA P3-2: throttle keys hash identities', () => {
  it('distinct identities never share a budget via key sanitization', () => {
    expect(throttleKey('i/1', 'a', 'op')).not.toBe(throttleKey('i_1', 'a', 'op'));
    expect(throttleKey('i1', 'a/b', 'op')).not.toBe(throttleKey('i1', 'a_b', 'op'));
    const k = throttleKey('ari:cloud:jira::site/c490925f-5338-4d25-b934-5ceb58162a0f', '630a8a3561f04d06813f80ff', 'getCapabilities');
    expect(k).toMatch(/^(?!\s+$)[a-zA-Z0-9:._\s#-]+$/);
    expect(k).not.toContain('/');
    expect(k.length).toBeLessThanOrEqual(500);
  });
});

describe('OMEGA P1-8a: stored payload byte sizes are measured', () => {
  it('records snapshot/provenance byte sizes against the KVS cap', async () => {
    const s = setup();
    const { snap, plan } = await toPlan(s);
    const snapRec = await s.store.get<{ bytes?: number }>(`snap:${snap.snapshotId}`);
    const provRec = await s.store.get<{ bytes?: number }>(`prov:${plan.planId}`);
    expect(snapRec?.bytes).toBeGreaterThan(0);
    expect(provRec?.bytes).toBeGreaterThan(0);
  });
});

describe('OMEGA P1-8b: transient-tolerant Jira reads', () => {
  beforeEach(() => { mocks.requestJira.mockReset(); });
  const res = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  it('retries an idempotent GET once after a 429', async () => {
    mocks.requestJira.mockResolvedValueOnce(res(429, '')).mockResolvedValueOnce(res(200, { values: [{ id: '10000', key: 'PAY', name: 'Payments' }], isLast: true }));
    const r = await createForgeJira(null).searchProjects(0, 50);
    expect(r.items[0]?.key).toBe('PAY');
    expect(mocks.requestJira).toHaveBeenCalledTimes(2);
  });
  it('retries an idempotent GET once after a 5xx', async () => {
    mocks.requestJira.mockResolvedValueOnce(res(500, 'boom')).mockResolvedValueOnce(res(200, { values: [], isLast: true }));
    const r = await createForgeJira(null).searchProjects(0, 50);
    expect(r.isLast).toBe(true);
    expect(mocks.requestJira).toHaveBeenCalledTimes(2);
  });
  it('never retries a mutation', async () => {
    mocks.requestJira.mockResolvedValueOnce(res(429, ''));
    await expect(createForgeJira(null).createIssue({ projectKey: 'PAY', summary: 's', description: 'd', issueType: 'Task', labels: [] }))
      .rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(mocks.requestJira).toHaveBeenCalledTimes(1);
  });
});
