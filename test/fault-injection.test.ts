/**
 * Failure injection: Forge KVS unavailable (get / set / setIfAbsent throw) and Jira answering 429, 5xx, 403 or slowly.
 * The production store is composed exactly as in src/forge-adapters.ts: withStorageErrors(raw KVS).
 * Expectations: a clean resolver envelope (never a crash), INTERNAL only for truly unexpected failures, retryable set for
 * transient ones, partial execution recorded and resumable without duplicate Jira writes, permission loss never reads as PASS,
 * and the workflow validator following its documented outage policy.
 */
import { createService } from '../src/engine/service';
import { makeHandler } from '../src/core/handler';
import { createStoreThrottle } from '../src/core/throttle';
import { withStorageErrors } from '../src/core/storage';
import type { Ctx, Store } from '../src/core/ports';
import type { OperationName } from '../packages/contracts/src/index';
import { decideTransition, runValidator, type DecisionRecord } from '../src/validator';
import { VALIDATOR_POLICY_KEY } from '../src/engine/service';
import { demoJira, memoryStore, type FakeJira } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

type Op = 'get' | 'set' | 'setIfAbsent' | 'delete';
type Rule = boolean | ((key: string) => boolean);
/** Shape of @forge/kvs ForgeKvsAPIError (responseDetails.status) for a server-side KVS failure. */
const kvsError = (status: number) => Object.assign(new Error(`KVS request failed (${status})`), { name: 'ForgeKvsAPIError', code: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST', responseDetails: { status, statusText: 'x' } });

/** Store wrapper that can fail any operation (all keys, or keys matching a predicate) with a KVS-shaped error. */
function faultyStore(inner: Store, err: () => Error = () => kvsError(503)) {
  const down: Partial<Record<Op, Rule>> = {};
  const failing = (op: Op, k: string) => { const r = down[op]; return r === true || (typeof r === 'function' && r(k)); };
  const raw: Store = {
    async get(k) { if (failing('get', k)) throw err(); return inner.get(k); },
    async set(k, v) { if (failing('set', k)) throw err(); return inner.set(k, v); },
    async setIfAbsent(k, v) { if (failing('setIfAbsent', k)) throw err(); return inner.setIfAbsent(k, v); },
    async delete(k) { if (failing('delete', k)) throw err(); return inner.delete(k); }
  };
  return { raw, store: withStorageErrors(raw), down, outage: (r: Rule = true) => { down.get = r; down.set = r; down.setIfAbsent = r; down.delete = r; }, heal: () => { for (const o of Object.keys(down)) delete down[o as Op]; } };
}

const alice: Ctx = { requestId: 'r', accountId: 'alice', installationId: 'inst' };
let n = 0;
type Envelope = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; retryable: boolean; details?: Record<string, unknown> } };

function setup(opts: { err?: () => Error; composed?: boolean } = {}) {
  const jira = demoJira(); const mem = memoryStore(); const f = faultyStore(mem, opts.err);
  const store = opts.composed === false ? f.raw : f.store;
  const now = new Date('2026-11-02T09:00:00Z');
  const svc = createService({ jira, store, now: () => now, newId: () => `fi${++n}` });
  const throttle = createStoreThrottle(store, { limit: 60, windowMs: 60_000, now: () => now.getTime() });
  /** Calls an op through the real resolver handler with the store-backed (fail-open) throttle. */
  async function call(op: OperationName, payload: unknown, account: string | null = 'alice'): Promise<Envelope> {
    const h = makeHandler(op, () => 'LIVE', () => `req-${++n}`, () => now, (ctx, input) => (svc as unknown as Record<string, (c: unknown, i: unknown) => Promise<unknown>>)[op]!(ctx, input), { throttle });
    return (await h({ payload, context: { accountId: account ?? undefined, installContext: 'inst' } })) as Envelope;
  }
  async function approvedPlan(scenario: 'A' | 'B' = 'A') {
    const snap = await svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    await svc.compareScenarios(alice, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
      scenarios: [{ scenarioId: 'A', label: 'Remove now', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] },
        { scenarioId: 'B', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE', nodeId: 'issue:PAY-1', retainUntil: null }] }], maxDepth: 6 });
    const plan = await svc.generatePreventionPlan(alice, { snapshotId: snap.snapshotId, scenarioId: scenario });
    await svc.approvePlan(alice, { planId: plan.planId, planHash: plan.planHash, approvedActionIds: plan.actions.map((a) => a.actionId), idempotencyKey: `appr-${++n}-xxxxxxxxxx` });
    return plan;
  }
  const exec = (planId: string) => svc.executeApprovedPlan(alice, { planId, idempotencyKey: `exec-${++n}-xxxxxxxxxxxx` });
  const status = async (planId: string) => (await mem.get<{ plan: { status: string } }>(`plan:${planId}`))!.plan.status;
  return { jira, mem, f, svc, call, approvedPlan, exec, status, now };
}
const snapPayload = { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 };
const errOf = (e: Envelope) => { if (e.ok) throw new Error('expected an error envelope'); return e.error; };

describe('KVS outage: clean envelopes, throttle fails open', () => {
  it('getCapabilities and getPolicies still answer while every KVS call throws (throttle fails open)', async () => {
    const s = setup(); s.f.outage();
    for (const op of ['getCapabilities', 'getPolicies'] as const) expect((await s.call(op, {})).ok).toBe(true);
  });

  it('read-only Jira ops run while KVS is down (the throttle never blocks on its own storage)', async () => {
    const s = setup(); s.f.outage();
    expect((await s.call('getChangeCandidates', { projectId: 'PAY', cursor: null })).ok).toBe(true);
    expect((await s.call('listProjects', { cursor: null })).ok).toBe(true);
  });

  it('analysis under KVS outage: retryable UPSTREAM_UNAVAILABLE, not INTERNAL, no crash', async () => {
    const s = setup(); s.f.outage();
    const e = errOf(await s.call('getGraphSnapshot', snapPayload));
    expect(e).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
    expect(e.message).toMatch(/storage/i);
    expect(e.message).not.toMatch(/KVS request failed/); // no raw infrastructure detail leaks to the client
    const snap = await s.svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 }).catch(() => null);
    expect(snap).toBeNull();
    s.f.heal();
    const ok = await s.call('getGraphSnapshot', snapPayload);
    expect(ok.ok).toBe(true);
    const snapshotId = (ok as { data: { snapshotId: string } }).data.snapshotId;
    s.f.down.get = true;
    expect(errOf(await s.call('compareScenarios', { snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
      scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 }))).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
    expect(errOf(await s.call('getValidatorPolicy', {}))).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
  });

  it('a KVS network failure (no HTTP status) is transient too; a KVS 429 is RATE_LIMITED retryable', async () => {
    const s = setup({ err: () => new Error('fetch failed: ECONNRESET') }); s.f.outage();
    expect(errOf(await s.call('getGraphSnapshot', snapPayload))).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
    const t = setup({ err: () => kvsError(429) }); t.f.outage();
    expect(errOf(await t.call('getGraphSnapshot', snapPayload))).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
  });

  it('a KVS 4xx (a bug on our side, e.g. an invalid key) stays INTERNAL and non-retryable', async () => {
    const s = setup({ err: () => kvsError(400) }); s.f.outage();
    expect(errOf(await s.call('getGraphSnapshot', snapPayload))).toMatchObject({ code: 'INTERNAL', retryable: false, message: 'Unexpected server error.' });
  });

  it('even an unwrapped store failure yields a clean INTERNAL envelope, never a thrown resolver', async () => {
    const s = setup({ composed: false }); s.f.outage();
    expect(errOf(await s.call('getGraphSnapshot', snapPayload))).toMatchObject({ code: 'INTERNAL', retryable: false });
  });
});

describe('Jira failures during execution', () => {
  it('5xx mid-plan: partial outcome recorded; retry completes with no duplicate writes', async () => {
    const s = setup(); const plan = await s.approvedPlan();
    const creates = plan.actions.filter((a) => a.type === 'CREATE_ISSUE').length;
    expect(creates).toBe(2);
    s.jira.inject('createIssue', '5xx', { skip: 1 });
    const r1 = await s.exec(plan.planId);
    expect(r1.filter((r) => r.status === 'VERIFIED').length).toBeGreaterThan(0);
    const failed = r1.filter((r) => r.status === 'FAILED');
    expect(failed).toHaveLength(1);
    expect(failed[0]!.error).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
    expect(await s.status(plan.planId)).toBe('PARTIAL');
    expect((await s.svc.getExecutionStatus(alice, { planId: plan.planId })).map((r) => r.status).sort()).toEqual(r1.map((r) => r.status).sort());
    const r2 = await s.exec(plan.planId);
    expect(r2.every((r) => r.status === 'VERIFIED')).toBe(true);
    expect(s.jira.writes.create).toBe(creates);
    expect(await s.status(plan.planId)).toBe('COMPLETED');
  });

  it('5xx after the write landed (link step): retry reconciles by marker, the issue is not created twice', async () => {
    const s = setup(); const plan = await s.approvedPlan();
    s.jira.inject('createLink', '5xx');
    const r1 = await s.exec(plan.planId);
    expect(r1.some((r) => r.status === 'FAILED')).toBe(true);
    const createdBefore = s.jira.writes.create;
    await s.exec(plan.planId);
    expect(s.jira.writes.create).toBe(createdBefore);
    expect(s.jira.writes.create).toBe(2);
    expect(await s.status(plan.planId)).toBe('COMPLETED');
  });

  it('429 on a write: the action fails as retryable RATE_LIMITED, and a retry finishes it', async () => {
    const s = setup(); const plan = await s.approvedPlan();
    s.jira.inject('createIssue', '429');
    const r1 = await s.exec(plan.planId);
    expect(r1.find((r) => r.status === 'FAILED')!.error).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    await s.exec(plan.planId);
    expect(s.jira.writes.create).toBe(2);
  });

  it('429 on analysis surfaces as a retryable envelope', async () => {
    const s = setup(); s.jira.inject('searchIssues', '429', { times: 100 }); s.jira.inject('getIssue', '429', { times: 100 });
    expect(errOf(await s.call('getGraphSnapshot', snapPayload))).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
  });

  it('a failure before any write (permission check 5xx) is retryable and does not leave the plan stuck in EXECUTING', async () => {
    const s = setup(); const plan = await s.approvedPlan();
    s.jira.inject('myPermissions', '5xx');
    await expect(s.exec(plan.planId)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
    expect(await s.status(plan.planId)).not.toBe('EXECUTING');
    expect(s.jira.writes.create).toBe(0);
    const r = await s.exec(plan.planId);
    expect(r.every((x) => x.status === 'VERIFIED')).toBe(true);
    expect(s.jira.writes.create).toBe(2);
  });

  it('a crashed executor (status EXECUTING, lease expired) can be resumed; a live lease still refuses', async () => {
    const s = setup(); const plan = await s.approvedPlan();
    const rec = (await s.mem.get<{ plan: { status: string } }>(`plan:${plan.planId}`))!;
    rec.plan.status = 'EXECUTING'; await s.mem.set(`plan:${plan.planId}`, rec);
    await s.mem.set(`lock:${plan.planId}`, { until: s.now.getTime() + 60_000, key: 'live', token: 'live' });
    await expect(s.exec(plan.planId)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(s.jira.writes.create).toBe(0);
    await s.mem.set(`lock:${plan.planId}`, { until: 0, key: 'dead', token: 'dead' });
    expect((await s.exec(plan.planId)).every((x) => x.status === 'VERIFIED')).toBe(true);
    expect(s.jira.writes.create).toBe(2);
  });

  it('KVS outage mid-execution: retryable error, plan resumable, no duplicate Jira writes', async () => {
    const s = setup(); const plan = await s.approvedPlan();
    let sets = 0;
    s.f.down.set = (k) => k.startsWith('exec:') && ++sets > 3; // bookkeeping dies after the first action started
    await expect(s.exec(plan.planId)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
    const after = s.jira.writes.create;
    s.f.heal();
    const r = await s.exec(plan.planId);
    expect(r.every((x) => x.status === 'VERIFIED')).toBe(true);
    expect(s.jira.writes.create).toBe(2);
    expect(after).toBeLessThanOrEqual(2);
  });

  it('delayed Jira responses: concurrent executions still produce one run and no duplicates', async () => {
    const s = setup(); const plan = await s.approvedPlan();
    s.jira.inject('getIssue', 'delay', { times: 50, delayMs: 5 }); s.jira.inject('createIssue', 'delay', { times: 5, delayMs: 15 });
    const res = await Promise.allSettled([s.exec(plan.planId), s.exec(plan.planId), s.exec(plan.planId)]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(res.filter((r) => r.status === 'rejected').every((r) => (r as PromiseRejectedResult).reason.code === 'CONFLICT')).toBe(true);
    expect(s.jira.writes.create).toBe(2);
  });
});

describe('permission denied never reads as PASS', () => {
  async function gate(s: ReturnType<typeof setup>, now: Date) {
    const d = await s.mem.get<DecisionRecord>('decision:PAY-1');
    const i = await s.jira.getIssue('PAY-1');
    return decideTransition(i.kind === 'ok' ? { ...i.issue, labels: ['anticipate-change'] } : null, d, 'PAY-1', now);
  }
  it('Jira 403 on a write: action FAILED with PERMISSION_DENIED, plan not COMPLETED, the workflow gate stays closed', async () => {
    const s = setup(); const plan = await s.approvedPlan('B');
    const target = plan.actions[0]!;
    const method = ({ CREATE_ISSUE: 'createIssue', ADD_COMMENT: 'addComment', ADD_LABEL: 'addLabel', ADD_ISSUE_LINK: 'createLink' } as const)[target.type as 'CREATE_ISSUE'];
    s.jira.inject(method, '403', { times: 10 });
    const r = await s.exec(plan.planId);
    const failed = r.filter((x) => x.status === 'FAILED');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((x) => x.error?.code === 'PERMISSION_DENIED' && x.error.retryable === false)).toBe(true);
    expect(await s.status(plan.planId)).not.toBe('COMPLETED');
    expect((await gate(s, s.now)).result).toBe(false);
  });

  it('missing live permission (mypermissions false): nothing written, no PASS', async () => {
    const s = setup(); const plan = await s.approvedPlan();
    for (const p of Object.keys(s.jira.perms)) s.jira.perms[p] = false;
    const r = await s.exec(plan.planId);
    expect(r.every((x) => x.status === 'FAILED' && x.error?.code === 'PERMISSION_DENIED')).toBe(true);
    expect(s.jira.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
    expect(await s.status(plan.planId)).toBe('FAILED');
    expect((await gate(s, s.now)).result).toBe(false);
  });

  it('403 on the root issue during analysis is PERMISSION_DENIED, not a verdict', async () => {
    const s = setup(); s.jira.inject('getIssue', '403');
    expect(errOf(await s.call('getGraphSnapshot', snapPayload))).toMatchObject({ code: 'PERMISSION_DENIED', retryable: false });
  });
});

describe('workflow validator under KVS / Jira outage follows the outage policy', () => {
  const validate = (s: ReturnType<typeof setup>, store: Store, jira: FakeJira, logs: unknown[]) => runValidator('PAY-1', {
    readIssue: (k) => jira.getIssue(k),
    readDecision: (k) => store.get<DecisionRecord>(`decision:${k}`),
    readPolicy: () => store.get<{ onOutage?: string }>(VALIDATOR_POLICY_KEY),
    log: (f) => logs.push(f), now: s.now
  });
  const gated = (s: ReturnType<typeof setup>) => { s.jira.issues.get('PAY-1')!.labels = ['anticipate-change']; };

  it('KVS down + default policy: ALLOW, logged as an outage', async () => {
    const s = setup(); gated(s); s.f.outage(); const logs: unknown[] = [];
    expect((await validate(s, s.f.store, s.jira, logs)).result).toBe(true);
    expect(logs).toEqual([expect.objectContaining({ outage: true, policy: 'ALLOW' })]);
  });
  it('decision unreadable + policy BLOCK readable: blocked with the recovery path', async () => {
    const s = setup(); gated(s); await s.mem.set(VALIDATOR_POLICY_KEY, { onOutage: 'BLOCK' });
    s.f.down.get = (k) => k.startsWith('decision:'); const logs: unknown[] = [];
    const r = await validate(s, s.f.store, s.jira, logs);
    expect(r.result).toBe(false);
    expect(r.errorMessage).toMatch(/outage/);
  });
  it('policy BLOCK but the whole KVS is down: ALLOW (a storage outage never locks every workflow)', async () => {
    const s = setup(); gated(s); await s.mem.set(VALIDATOR_POLICY_KEY, { onOutage: 'BLOCK' }); s.f.outage();
    expect((await validate(s, s.f.store, s.jira, [])).result).toBe(true);
  });
  it('Jira 5xx / 429 / 403 on the issue read is an outage (policy decides), never a silent pass of a gated issue', async () => {
    for (const kind of ['5xx', '429', '403'] as const) {
      const s = setup(); gated(s); await s.mem.set(VALIDATOR_POLICY_KEY, { onOutage: 'BLOCK' });
      s.jira.inject('getIssue', kind); const logs: unknown[] = [];
      expect((await validate(s, s.f.store, s.jira, logs)).result).toBe(false);
      expect(logs).toEqual([expect.objectContaining({ outage: true, policy: 'BLOCK' })]);
    }
  });
  it('KVS healthy, no decision recorded: blocked (not an outage)', async () => {
    const s = setup(); gated(s); const logs: unknown[] = [];
    expect((await validate(s, s.f.store, s.jira, logs)).result).toBe(false);
    expect(logs).toEqual([]);
  });
});

describe('storage error mapping: programming errors are not advertised as transient (red-team W3-4)', () => {
  it('TypeError without HTTP status stays a non-retryable internal error; network-like errors stay retryable', async () => {
    const { mapStorageError } = await import('../src/core/storage');
    const bug = new TypeError('Converting circular structure to JSON');
    expect(mapStorageError(bug, 'set')).toBe(bug);
    expect(mapStorageError(new Error('socket hang up'), 'get')).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
    expect(mapStorageError(Object.assign(new Error('x'), { responseDetails: { status: 503 } }), 'get')).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
    expect(mapStorageError(Object.assign(new Error('x'), { responseDetails: { status: 400 } }), 'get')).not.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });
});
