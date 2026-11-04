import type { z } from 'zod';
import { OPERATIONS, type OperationName, type SharedDecision } from '../packages/contracts/src/index';
import { makeHandler } from '../src/core/handler';
import type { Store } from '../src/core/ports';
import { createWorkspaceOps, SHARED_DECISIONS_FLAG_KEY, WORKSPACE_OPERATION_NAMES } from '../src/workspace/ops';
import type { PlanRef } from '../src/workspace/workspace';
import { memoryStore } from './fakes';
import { registerWorkspaceResolvers, storePlanReader } from '../src/workspace/forge';

vi.mock('@forge/api', () => ({ default: { asApp: () => ({ requestJira: async () => { throw new Error('no Jira in unit tests'); } }) }, route: () => '' }));

/** Records every key touched and can pair concurrent reads of matching keys (both racers see the same state before writing). */
function instrumented(inner: Store & { data: Map<string, unknown> }) {
  const reads: string[] = []; const writes: string[] = [];
  let match: ((k: string) => boolean) | null = null; let waiting: (() => void) | null = null;
  const store: Store & { data: Map<string, unknown> } = {
    data: inner.data,
    async get<T>(k: string) {
      reads.push(k); const v = await inner.get<T>(k);
      if (!match || !match(k)) return v;
      if (waiting) { const w = waiting; waiting = null; w(); return v; }
      await new Promise<void>((res) => { const t = setTimeout(() => { if (waiting === res) waiting = null; res(); }, 30); waiting = () => { clearTimeout(t); res(); }; });
      return v;
    },
    async set(k, v) { writes.push(k); return inner.set(k, v); },
    async setIfAbsent(k, v) { writes.push(k); return inner.setIfAbsent(k, v); },
    async delete(k) { writes.push(k); return inner.delete(k); }
  };
  return { store, reads, writes, race: (m: ((k: string) => boolean) | null) => { match = m; } };
}

function setup() {
  const io = instrumented(memoryStore());
  let t = new Date('2026-11-03T10:00:00Z'); let n = 0; let rid = 0;
  // alice proposes; bob and carol are project admins (approvers); eve is a reviewer (browse only); mallory has nothing; olga is admin of OPS only.
  const grants = new Set(['alice@JDG:BROWSE_PROJECTS', 'bob@JDG:BROWSE_PROJECTS', 'bob@JDG:ADMINISTER_PROJECTS', 'carol@JDG:BROWSE_PROJECTS',
    'carol@JDG:ADMINISTER_PROJECTS', 'eve@JDG:BROWSE_PROJECTS', 'olga@OPS:BROWSE_PROJECTS', 'olga@OPS:ADMINISTER_PROJECTS']);
  const siteAdmins = new Set(['root']);
  const plans: Record<string, PlanRef> = { p1: { planId: 'p1', owner: 'alice', planHash: 'h1', issueKey: 'JDG-1', projectKey: 'JDG' } };
  const jiraCalls = { perm: 0, global: 0, plan: 0 };
  const opsFor = (account: string | null) => createWorkspaceOps({
    store: io.store, now: () => t, newId: () => String(++n), released: true,
    userHasPermission: async (a, proj, perm) => { jiraCalls.perm++; return grants.has(`${a}@${proj}:${perm}`); },
    getPlan: async (id) => { jiraCalls.plan++; return plans[id] ? { ...plans[id]! } : undefined; },
    globalPermissions: async (ps) => { jiraCalls.global++; return Object.fromEntries(ps.map((p) => [p, p === 'ADMINISTER' && !!account && siteAdmins.has(account)])); }
  });
  /** Calls an op through the real resolver handler: schema validation in, contract validation out, error envelope. */
  async function call(op: OperationName, account: string | null, payload: unknown) {
    const h = makeHandler(op, () => 'LIVE', () => `req-${++rid}`, () => t, (ctx, input) => {
      const ops = opsFor(account) as unknown as Record<string, (c: unknown, i: unknown) => Promise<unknown>>;
      return ops[op]!(ctx, input);
    });
    return (await h({ payload, context: { accountId: account ?? undefined, installContext: 'inst' } })) as
      { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };
  }
  const ok = async <N extends OperationName>(op: N, account: string | null, payload: unknown) => {
    const r = await call(op, account, payload);
    if (!r.ok) throw new Error(`${op} failed: ${r.error.code} ${r.error.message}`);
    return r.data as z.output<(typeof OPERATIONS)[N]['output']>;
  };
  const err = async (op: OperationName, account: string | null, payload: unknown) => {
    const r = await call(op, account, payload);
    if (r.ok) throw new Error(`${op} unexpectedly succeeded`);
    return r.error;
  };
  return { io, grants, plans, jiraCalls, call, ok, err, opsFor,
    enable: () => io.store.set(SHARED_DECISIONS_FLAG_KEY, { enabled: true, updatedBy: 'root', updatedAt: t.toISOString() }),
    advance: (days: number) => { t = new Date(t.getTime() + days * 86400000); } };
}
async function enabled() { const s = setup(); await s.enable(); s.io.reads.length = 0; s.io.writes.length = 0; return s; }

const SAMPLE: Record<(typeof WORKSPACE_OPERATION_NAMES)[number], unknown> = {
  shareDecision: { planId: 'p1' }, getSharedDecision: { id: 'dec-1' }, approveSharedDecision: { id: 'dec-1', planHash: 'h1' },
  rejectSharedDecision: { id: 'dec-1', reason: 'too risky' }, revokeSharedDecision: { id: 'dec-1', reason: 'obsolete' },
  listDecisionAudit: { id: 'dec-1', cursor: null, limit: 10 }, getFeatureFlag: { flag: 'sharedDecisions' }, setFeatureFlag: { flag: 'sharedDecisions', enabled: true }
};
const GATED = WORKSPACE_OPERATION_NAMES.filter((o) => o !== 'getFeatureFlag' && o !== 'setFeatureFlag');

describe('shared decision ops: capability flag sharedDecisions', () => {
  it('every op is declared in the contracts', () => {
    for (const op of WORKSPACE_OPERATION_NAMES) expect(OPERATIONS[op], op).toBeDefined();
  });

  it('flag off (default): every workspace op is refused with FEATURE_DISABLED, no workspace storage and no Jira call', async () => {
    const s = setup();
    for (const op of GATED) {
      for (const who of ['alice', 'bob', 'root', null]) {
        const e = await s.err(op, who, SAMPLE[op]);
        expect(e.code, op).toBe('UNSUPPORTED');
        expect(e.details).toMatchObject({ feature: 'sharedDecisions', reason: 'FEATURE_DISABLED' });
      }
    }
    expect(s.io.writes).toEqual([]);
    expect(new Set(s.io.reads)).toEqual(new Set([SHARED_DECISIONS_FLAG_KEY])); // the flag itself is the only key ever read
    expect(s.jiraCalls).toEqual({ perm: 0, global: 0, plan: 0 });
    expect([...s.io.store.data.keys()]).toEqual([]);
  });

  it('a malformed or explicitly disabled flag keeps the feature off', async () => {
    const s = setup();
    for (const v of [{ enabled: 'true' }, { enabled: 1 }, { enabled: false }, 'on', null]) {
      s.io.store.data.set(SHARED_DECISIONS_FLAG_KEY, v);
      expect((await s.err('getSharedDecision', 'eve', { id: 'dec-1' })).code).toBe('UNSUPPORTED');
    }
  });

  it('only a site admin can flip the flag; anyone signed in can read it', async () => {
    const s = setup();
    expect((await s.err('setFeatureFlag', 'bob', { flag: 'sharedDecisions', enabled: true })).code).toBe('PERMISSION_DENIED');
    expect((await s.err('setFeatureFlag', null, { flag: 'sharedDecisions', enabled: true })).code).toBe('PERMISSION_DENIED');
    expect((await s.err('setFeatureFlag', 'root', { flag: 'other', enabled: true })).code).toBe('VALIDATION');
    expect(s.io.writes).toEqual([]);
    expect(await s.ok('getFeatureFlag', 'bob', { flag: 'sharedDecisions' })).toMatchObject({ enabled: false, canEdit: false, updatedBy: null });
    expect(await s.ok('setFeatureFlag', 'root', { flag: 'sharedDecisions', enabled: true })).toMatchObject({ enabled: true, updatedBy: 'root', canEdit: true });
    expect(await s.ok('getFeatureFlag', 'bob', { flag: 'sharedDecisions' })).toMatchObject({ enabled: true, canEdit: false });
    expect((await s.ok('shareDecision', 'alice', { planId: 'p1' })).state).toBe('IN_REVIEW');
    await s.ok('setFeatureFlag', 'root', { flag: 'sharedDecisions', enabled: false });
    expect((await s.err('getSharedDecision', 'alice', { id: 'dec-1' })).code).toBe('UNSUPPORTED');
  });
});

describe('shared decision ops: flag on', () => {
  it('full lifecycle: share, review, two approvals, ready, audit', async () => {
    const s = await enabled();
    const d = await s.ok('shareDecision', 'alice', { planId: 'p1', requiredApprovals: 2 });
    expect(d).toMatchObject({ id: 'dec-1', state: 'IN_REVIEW', version: 'h1', planHash: 'h1', requiredApprovals: 2, approvals: [], evidenceChanged: false, closed: null,
      expiresAt: '2026-11-10T10:00:00.000Z' });
    expect(d.waitingFor).toMatch(/2 more approval/);
    expect(d.capabilities).toEqual({ canApprove: { allowed: false, reason: 'PROPOSER' }, canReject: { allowed: false, reason: 'PROPOSER' },
      canRevoke: { allowed: true, reason: null }, canExecute: { allowed: false, reason: 'AWAITING_APPROVAL' } });
    const asBob = await s.ok('getSharedDecision', 'bob', { id: d.id });
    expect(asBob.capabilities).toMatchObject({ canApprove: { allowed: true, reason: null }, canReject: { allowed: true, reason: null }, canExecute: { allowed: false, reason: 'NOT_IN_ROLE' } });
    const b = await s.ok('approveSharedDecision', 'bob', { id: d.id, planHash: 'h1' });
    expect(b.approvals).toEqual([{ by: 'bob', at: '2026-11-03T10:00:00.000Z', planHash: 'h1' }]);
    expect(b.capabilities.canApprove).toEqual({ allowed: false, reason: 'ALREADY_APPROVED' });
    expect(b.capabilities.canReject).toEqual({ allowed: false, reason: 'ALREADY_APPROVED' });
    const c = await s.ok('approveSharedDecision', 'carol', { id: d.id, planHash: 'h1' });
    expect(c.state).toBe('APPROVED');
    const a = await s.ok('getSharedDecision', 'alice', { id: d.id });
    expect(a.capabilities.canExecute).toEqual({ allowed: true, reason: null });
    expect(a.waitingFor).toBe('Execution by the proposer');
    const log = await s.ok('listDecisionAudit', 'eve', { id: d.id });
    expect(log.items.map((e) => e.event)).toEqual(['SHARED', 'APPROVED', 'APPROVED', 'READY']);
    expect(log.items.map((e) => e.id)).toEqual(['dec-1:1', 'dec-1:2', 'dec-1:3', 'dec-1:4']);
    expect(log.items.every((e) => !Number.isNaN(Date.parse(e.at)))).toBe(true);
    expect(log.nextCursor).toBeNull();
  });

  it('reviewer is read-only', async () => {
    const s = await enabled(); const d = await s.ok('shareDecision', 'alice', { planId: 'p1' });
    const v = await s.ok('getSharedDecision', 'eve', { id: d.id });
    expect(v.capabilities).toEqual({ canApprove: { allowed: false, reason: 'MISSING_PERMISSION' }, canReject: { allowed: false, reason: 'MISSING_PERMISSION' },
      canRevoke: { allowed: false, reason: 'MISSING_PERMISSION' }, canExecute: { allowed: false, reason: 'NOT_IN_ROLE' } });
    expect((await s.err('approveSharedDecision', 'eve', { id: d.id, planHash: 'h1' })).code).toBe('PERMISSION_DENIED');
    expect((await s.err('rejectSharedDecision', 'eve', { id: d.id, reason: 'nope nope' })).code).toBe('PERMISSION_DENIED');
    expect((await s.err('revokeSharedDecision', 'eve', { id: d.id, reason: 'nope nope' })).code).toBe('PERMISSION_DENIED');
    expect((await s.err('shareDecision', 'eve', { planId: 'p1' })).code).toBe('PERMISSION_DENIED');
    expect((await s.ok('listDecisionAudit', 'eve', { id: d.id })).items).toHaveLength(1);
    expect((await s.ok('getSharedDecision', 'eve', { id: d.id })).state).toBe('IN_REVIEW');
  });

  it('cross-account denial: no project access, or rights on another project only, grants nothing', async () => {
    const s = await enabled(); const d = await s.ok('shareDecision', 'alice', { planId: 'p1' });
    for (const who of ['mallory', 'olga']) {
      expect((await s.err('getSharedDecision', who, { id: d.id })).code).toBe('PERMISSION_DENIED');
      expect((await s.err('listDecisionAudit', who, { id: d.id })).code).toBe('PERMISSION_DENIED');
      expect((await s.err('approveSharedDecision', who, { id: d.id, planHash: 'h1' })).code).toBe('PERMISSION_DENIED');
      expect((await s.err('rejectSharedDecision', who, { id: d.id, reason: 'not mine' })).code).toBe('PERMISSION_DENIED');
      expect((await s.err('revokeSharedDecision', who, { id: d.id, reason: 'not mine' })).code).toBe('PERMISSION_DENIED');
    }
    expect((await s.err('getSharedDecision', null, { id: d.id })).code).toBe('PERMISSION_DENIED');
    // Access removed after sharing: denied immediately.
    s.grants.delete('eve@JDG:BROWSE_PROJECTS');
    expect((await s.err('getSharedDecision', 'eve', { id: d.id })).code).toBe('PERMISSION_DENIED');
    expect((await s.ok('listDecisionAudit', 'alice', { id: d.id })).items.map((e) => e.event)).toEqual(['SHARED']);
  });

  it('self-approval and self-rejection are refused, even for an administrator proposer', async () => {
    const s = await enabled(); s.grants.add('alice@JDG:ADMINISTER_PROJECTS');
    const d = await s.ok('shareDecision', 'alice', { planId: 'p1' });
    expect((await s.err('approveSharedDecision', 'alice', { id: d.id, planHash: 'h1' })).code).toBe('PERMISSION_DENIED');
    expect((await s.err('rejectSharedDecision', 'alice', { id: d.id, reason: 'changed my mind' })).code).toBe('PERMISSION_DENIED');
    const v = await s.ok('getSharedDecision', 'alice', { id: d.id });
    expect(v.approvals).toEqual([]); expect(v.state).toBe('IN_REVIEW');
    expect(v.capabilities.canApprove.reason).toBe('PROPOSER');
  });

  it('reject: explicit reason, permitted approver only, terminal and audited', async () => {
    const s = await enabled(); const d = await s.ok('shareDecision', 'alice', { planId: 'p1' });
    expect((await s.err('rejectSharedDecision', 'bob', { id: d.id, reason: '  ' })).code).toBe('VALIDATION');
    expect((await s.err('rejectSharedDecision', 'bob', { id: d.id })).code).toBe('VALIDATION');
    const r = await s.ok('rejectSharedDecision', 'bob', { id: d.id, reason: 'Blast radius too large' });
    expect(r.state).toBe('REJECTED');
    expect(r.closed).toEqual({ state: 'REJECTED', at: '2026-11-03T10:00:00.000Z', by: 'bob', reason: 'Blast radius too large' });
    expect(r.waitingFor).toBeNull();
    expect(Object.values(r.capabilities)).toEqual(Array(4).fill({ allowed: false, reason: 'REJECTED' }));
    expect((await s.err('approveSharedDecision', 'carol', { id: d.id, planHash: 'h1' })).code).toBe('CONFLICT');
    expect((await s.err('revokeSharedDecision', 'alice', { id: d.id, reason: 'too late now' })).code).toBe('CONFLICT');
    expect((await s.ok('listDecisionAudit', 'eve', { id: d.id })).items.map((e) => [e.event, e.detail])).toEqual([
      ['SHARED', expect.any(String)], ['REJECTED', 'Blast radius too large']]);
  });

  it('revoke: proposer or project admin, explicit reason; unauthorized refused without trace', async () => {
    const s = await enabled(); const d = await s.ok('shareDecision', 'alice', { planId: 'p1' });
    const before = s.io.writes.length;
    expect((await s.err('revokeSharedDecision', 'eve', { id: d.id, reason: 'I want to stop this' })).code).toBe('PERMISSION_DENIED');
    expect((await s.err('rejectSharedDecision', 'eve', { id: d.id, reason: 'I want to stop this' })).code).toBe('PERMISSION_DENIED');
    expect(s.io.writes.length).toBe(before);
    await s.ok('approveSharedDecision', 'bob', { id: d.id, planHash: 'h1' });
    // Approver who already approved cannot reject, but a project admin may revoke an APPROVED decision.
    expect((await s.err('rejectSharedDecision', 'bob', { id: d.id, reason: 'second thoughts' })).code).toBe('CONFLICT');
    const r = await s.ok('revokeSharedDecision', 'carol', { id: d.id, reason: 'Release frozen' });
    expect(r.state).toBe('REVOKED'); expect(r.closed).toMatchObject({ by: 'carol', reason: 'Release frozen' });
    expect(r.capabilities.canExecute).toEqual({ allowed: false, reason: 'REVOKED' });
    // Proposer can revoke their own open decision too.
    s.plans.p2 = { planId: 'p2', owner: 'alice', planHash: 'h9', issueKey: 'JDG-2', projectKey: 'JDG' };
    const d2 = await s.ok('shareDecision', 'alice', { planId: 'p2' });
    expect((await s.ok('revokeSharedDecision', 'alice', { id: d2.id, reason: 'Superseded by p3' })).state).toBe('REVOKED');
  });

  it('reject / revoke race: first writer wins, exactly one terminal audit event', async () => {
    for (let round = 0; round < 3; round++) {
      const s = await enabled(); const d = await s.ok('shareDecision', 'alice', { planId: 'p1', requiredApprovals: 2 });
      s.io.race((k) => k.startsWith('ws:term:'));
      const res = await Promise.all([
        s.call('rejectSharedDecision', 'bob', { id: d.id, reason: 'reject it' }),
        s.call('revokeSharedDecision', 'alice', { id: d.id, reason: 'revoke it' }),
        s.call('rejectSharedDecision', 'carol', { id: d.id, reason: 'reject it too' })
      ]);
      s.io.race(null);
      const winners = res.filter((r) => r.ok); const losers = res.filter((r) => !r.ok);
      expect(winners).toHaveLength(1);
      expect(losers.map((l) => (l.ok ? null : l.error.code))).toEqual(['CONFLICT', 'CONFLICT']);
      const v = await s.ok('getSharedDecision', 'eve', { id: d.id });
      expect(['REJECTED', 'REVOKED']).toContain(v.state);
      expect(v.state).toBe((winners[0] as { data: SharedDecision }).data.state);
      const terminal = (await s.ok('listDecisionAudit', 'eve', { id: d.id })).items.filter((e) => e.event === 'REJECTED' || e.event === 'REVOKED');
      expect(terminal).toHaveLength(1);
      expect(terminal[0]!.event).toBe(v.state);
    }
  });

  it('approval after an evidence change is refused with EVIDENCE_CHANGED', async () => {
    const s = await enabled(); const d = await s.ok('shareDecision', 'alice', { planId: 'p1', requiredApprovals: 2 });
    await s.ok('approveSharedDecision', 'bob', { id: d.id, planHash: 'h1' });
    s.plans.p1!.planHash = 'h2'; // plan regenerated / evidence moved
    const v = await s.ok('getSharedDecision', 'carol', { id: d.id });
    expect(v.evidenceChanged).toBe(true);
    expect(v.capabilities.canApprove).toEqual({ allowed: false, reason: 'EVIDENCE_CHANGED' });
    expect(v.waitingFor).toMatch(/plan changed/);
    expect((await s.err('approveSharedDecision', 'carol', { id: d.id, planHash: 'h1' })).code).toBe('EVIDENCE_CHANGED');
    // Same when the engine marked the plan invalidated without a new hash, or the plan is gone (fail closed).
    s.plans.p1!.planHash = 'h1'; s.plans.p1!.evidenceChanged = true;
    expect((await s.err('approveSharedDecision', 'carol', { id: d.id, planHash: 'h1' })).code).toBe('EVIDENCE_CHANGED');
    delete s.plans.p1;
    expect((await s.err('approveSharedDecision', 'carol', { id: d.id, planHash: 'h1' })).code).toBe('EVIDENCE_CHANGED');
    expect((await s.ok('getSharedDecision', 'carol', { id: d.id })).approvals.map((a) => a.by)).toEqual(['bob']);
    // Revoking a stale decision stays possible.
    expect((await s.ok('revokeSharedDecision', 'alice', { id: d.id, reason: 'Evidence moved' })).state).toBe('REVOKED');
  });

  it('expired: approvals, rejection and revocation refused; EXPIRED recorded once', async () => {
    const s = await enabled(); const d = await s.ok('shareDecision', 'alice', { planId: 'p1' });
    s.advance(8);
    const v = await s.ok('getSharedDecision', 'bob', { id: d.id });
    expect(v.state).toBe('EXPIRED');
    expect(Object.values(v.capabilities)).toEqual(Array(4).fill({ allowed: false, reason: 'EXPIRED' }));
    expect((await s.err('approveSharedDecision', 'bob', { id: d.id, planHash: 'h1' })).code).toBe('CONFLICT');
    expect((await s.err('rejectSharedDecision', 'carol', { id: d.id, reason: 'late reject' })).code).toBe('CONFLICT');
    expect((await s.err('revokeSharedDecision', 'alice', { id: d.id, reason: 'late revoke' })).code).toBe('CONFLICT');
    const ev = (await s.ok('listDecisionAudit', 'eve', { id: d.id })).items.map((e) => e.event);
    expect(ev).toEqual(['SHARED', 'EXPIRED']);
    expect((await s.ok('getSharedDecision', 'alice', { id: d.id })).closed).toMatchObject({ state: 'EXPIRED' });
  });

  it('audit pagination with cursor = last seq, bounded limit', async () => {
    const s = await enabled();
    const d = await s.ok('shareDecision', 'alice', { planId: 'p1', requiredApprovals: 2 });
    await s.ok('approveSharedDecision', 'bob', { id: d.id, planHash: 'h1' });
    await s.ok('approveSharedDecision', 'carol', { id: d.id, planHash: 'h1' });
    await s.ok('revokeSharedDecision', 'alice', { id: d.id, reason: 'Done reviewing' });
    // log: SHARED, APPROVED, APPROVED, READY, REVOKED
    const p1 = await s.ok('listDecisionAudit', 'eve', { id: d.id, limit: 2 });
    expect(p1.items.map((e) => e.seq)).toEqual([1, 2]); expect(p1.nextCursor).toBe(2);
    const p2 = await s.ok('listDecisionAudit', 'eve', { id: d.id, limit: 2, cursor: p1.nextCursor });
    expect(p2.items.map((e) => e.seq)).toEqual([3, 4]); expect(p2.nextCursor).toBe(4);
    const p3 = await s.ok('listDecisionAudit', 'eve', { id: d.id, limit: 2, cursor: p2.nextCursor });
    expect(p3.items.map((e) => [e.seq, e.event, e.id])).toEqual([[5, 'REVOKED', `${d.id}:5`]]); expect(p3.nextCursor).toBeNull();
    const exact = await s.ok('listDecisionAudit', 'eve', { id: d.id, limit: 5 });
    expect(exact.items).toHaveLength(5); expect(exact.nextCursor).toBeNull();
    expect((await s.ok('listDecisionAudit', 'eve', { id: d.id, cursor: 99 })).items).toEqual([]);
    expect((await s.err('listDecisionAudit', 'eve', { id: d.id, limit: 101 })).code).toBe('VALIDATION');
    expect((await s.err('listDecisionAudit', 'eve', { id: d.id, cursor: -1 })).code).toBe('VALIDATION');
  });

  it('malformed decision ids are rejected before any workspace storage access', async () => {
    const s = await enabled();
    expect((await s.err('getSharedDecision', 'eve', { id: 'dec-1:x/../y' })).code).toBe('VALIDATION');
    expect(s.io.reads.filter((k) => k.startsWith('ws:'))).toEqual([]);
  });
});

describe('shared decision ops: Forge wiring', () => {
  it('reads the engine plan record and fails closed on invalidated or malformed plans', async () => {
    const store = memoryStore(); const read = storePlanReader(store);
    await store.set('plan:plan-1', { plan: { planId: 'plan-1', planHash: 'h', status: 'APPROVED' }, owner: 'alice', rootIssueKey: 'JDG-1', projectKey: 'JDG' });
    await store.set('plan:plan-2', { plan: { planId: 'plan-2', planHash: 'h', status: 'INVALIDATED' }, owner: 'alice', rootIssueKey: 'JDG-1', projectKey: 'JDG' });
    await store.set('plan:plan-3', { plan: { planId: 'plan-3' }, owner: null, rootIssueKey: 'JDG-1', projectKey: 'JDG' });
    expect(await read('plan-1')).toEqual({ planId: 'plan-1', owner: 'alice', planHash: 'h', issueKey: 'JDG-1', projectKey: 'JDG', evidenceChanged: false });
    expect((await read('plan-2'))?.evidenceChanged).toBe(true);
    expect(await read('plan-3')).toBeUndefined();
    expect(await read('../x')).toBeUndefined();
  });
  it('registers exactly the workspace ops, refused while the flag is off', async () => {
    const defs = new Map<string, (r: unknown) => Promise<unknown>>(); const store = memoryStore();
    registerWorkspaceResolvers({ define: (n: string, fn: never) => defs.set(n, fn) }, { store, now: () => new Date('2026-11-03T10:00:00Z'), newId: () => 'x',
      globalPermissionsFor: () => async (ps) => Object.fromEntries(ps.map((p) => [p, false])) });
    expect([...defs.keys()]).toEqual([...WORKSPACE_OPERATION_NAMES]);
    const r = await defs.get('getSharedDecision')!({ payload: { id: 'dec-1' }, context: { accountId: 'alice' } });
    expect(r).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED', details: { reason: 'NOT_RELEASED' } } });
  });
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  it('acceptance unlock: only the exact env value "true" unlocks (development acceptance), anything else stays locked', async () => {
    for (const [val, unlocked] of [['true', true], ['TRUE', false], ['1', false], [undefined, false]] as const) {
      if (val === undefined) delete env.ANTICIPATE_SHARED_DECISIONS_ACCEPTANCE; else env.ANTICIPATE_SHARED_DECISIONS_ACCEPTANCE = val;
      const defs = new Map<string, (r: unknown) => Promise<unknown>>(); const store = memoryStore();
      registerWorkspaceResolvers({ define: (n: string, fn: never) => defs.set(n, fn) }, { store, now: () => new Date('2026-11-03T10:00:00Z'), newId: () => 'x',
        globalPermissionsFor: () => async (ps) => Object.fromEntries(ps.map((p) => [p, true])) });
      const r = await defs.get('setFeatureFlag')!({ payload: { flag: 'sharedDecisions', enabled: true }, context: { accountId: 'root' } }) as { ok: boolean };
      expect(r.ok).toBe(unlocked);
    }
    delete env.ANTICIPATE_SHARED_DECISIONS_ACCEPTANCE;
  });
  it('release lock: a flag enabled by an earlier version is ignored, and enabling is refused, even for a site admin', async () => {
    const defs = new Map<string, (r: unknown) => Promise<unknown>>(); const store = memoryStore();
    await store.set(SHARED_DECISIONS_FLAG_KEY, { enabled: true, updatedBy: 'root', updatedAt: '2026-11-01T00:00:00Z' });
    registerWorkspaceResolvers({ define: (n: string, fn: never) => defs.set(n, fn) }, { store, now: () => new Date('2026-11-03T10:00:00Z'), newId: () => 'x',
      globalPermissionsFor: () => async (ps) => Object.fromEntries(ps.map((p) => [p, true])) });
    expect(await defs.get('shareDecision')!({ payload: { planId: 'p1' }, context: { accountId: 'root' } }))
      .toMatchObject({ ok: false, error: { code: 'UNSUPPORTED', details: { reason: 'NOT_RELEASED' } } });
    expect(await defs.get('setFeatureFlag')!({ payload: { flag: 'sharedDecisions', enabled: true }, context: { accountId: 'root' } }))
      .toMatchObject({ ok: false, error: { code: 'UNSUPPORTED', details: { reason: 'NOT_RELEASED' } } });
    expect(await defs.get('getFeatureFlag')!({ payload: { flag: 'sharedDecisions' }, context: { accountId: 'root' } }))
      .toMatchObject({ ok: true, data: { enabled: false } });
    expect([...store.data.keys()].filter((k) => k.startsWith('ws:'))).toEqual([]);
  });
});
