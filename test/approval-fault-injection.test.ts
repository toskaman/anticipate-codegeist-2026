/**
 * Storage fault injection on the approval path (Forge KVS has no transactions).
 * For every write step of approve(), a one-shot failure is injected; the same approver then retries.
 * Required: the retry completes, exactly one approval counts per approver, other approvers are never blocked,
 * READY and APPROVED are each logged once, and the decision state is consistent.
 */
import { createWorkspace, type PlanRef } from '../src/workspace/workspace';
import type { Store } from '../src/core/ports';
import { memoryStore } from './fakes';

const ctx = (a: string) => ({ requestId: 'r', accountId: a, installationId: 'i' });

function faulty(inner: Store) {
  let rule: { op: 'set' | 'setIfAbsent'; prefix: string; after: 'before' | 'after' } | null = null;
  const trip = (op: string, k: string) => !!rule && rule.op === op && k.startsWith(rule.prefix);
  const store: Store = {
    get: (k) => inner.get(k),
    delete: (k) => inner.delete(k),
    async set(k, v) { if (trip('set', k)) { const r = rule!; rule = null; if (r.after === 'after') await inner.set(k, v); throw new Error('KVS unavailable'); } return inner.set(k, v); },
    async setIfAbsent(k, v) {
      if (trip('setIfAbsent', k)) { const r = rule!; rule = null; if (r.after === 'after') await inner.setIfAbsent(k, v); throw new Error('KVS unavailable'); }
      return inner.setIfAbsent(k, v);
    }
  };
  return { store, inject: (op: 'set' | 'setIfAbsent', prefix: string, after: 'before' | 'after') => { rule = { op, prefix, after }; } };
}

function setup(required = 2) {
  const mem = memoryStore(); const f = faulty(mem); let n = 0;
  const perms: Record<string, Set<string>> = { alice: new Set(['BROWSE_PROJECTS']), bob: new Set(['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS']),
    carol: new Set(['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS']) };
  const plans: Record<string, PlanRef> = { p1: { planId: 'p1', owner: 'alice', planHash: 'h1', issueKey: 'JDG-1', projectKey: 'JDG' } };
  const ws = createWorkspace({ store: f.store, now: () => new Date('2026-11-04T10:00:00Z'), newId: () => String(++n),
    userHasPermission: async (a, _p, perm) => perms[a]?.has(perm) ?? false, getPlan: async (id) => plans[id] });
  return { ws, f, mem, required };
}
const events = async (ws: ReturnType<typeof createWorkspace>, id: string) => (await ws.audit(ctx('alice'), id)).map((e) => `${e.event}:${e.by}`);

// Each step of approve(): marker, slot claim, audit append, READY marker. Fail before or after the write lands.
const STEPS: [string, 'set' | 'setIfAbsent', string][] = [
  ['approval marker', 'setIfAbsent', 'ws:appr:'], ['slot claim', 'setIfAbsent', 'ws:slot:'],
  ['APPROVED audit marker', 'setIfAbsent', 'ws:auditappr:'], ['audit append', 'setIfAbsent', 'ws:log:'], ['READY marker', 'setIfAbsent', 'ws:ready:']
];

describe('approval path under storage faults', () => {
  for (const [label, op, prefix] of STEPS) {
    for (const when of ['before', 'after'] as const) {
      it(`${label} fails (${when} the write lands) on the completing approval: retry recovers, state and audit consistent`, async () => {
        const s = setup(2);
        const d = await s.ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
        await s.ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
        s.f.inject(op, prefix, when);
        await s.ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' }).catch(() => undefined); // first attempt may fail
        const v = await s.ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' }); // retry
        expect(v.state).toBe('APPROVED');
        expect(v.approvals.map((a) => a.by).sort()).toEqual(['bob', 'carol']);
        // A further retry is a no-op.
        expect((await s.ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' })).approvals).toHaveLength(2);
        const ev = await events(s.ws, d.id);
        expect(ev.filter((e) => e === 'APPROVED:carol')).toHaveLength(1);
        expect(ev.filter((e) => e.startsWith('READY'))).toHaveLength(1);
        expect((await s.ws.readyToExecute(ctx('alice'), d.id, 'h1')).ok).toBe(true);
      });
    }
  }

  it('a lost slot claim on the first approver never blocks the second approver', async () => {
    const s = setup(2);
    const d = await s.ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
    s.f.inject('setIfAbsent', 'ws:slot:', 'before');
    await expect(s.ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })).rejects.toThrow('KVS unavailable');
    // bob's marker exists without a slot; carol approves meanwhile, then bob retries.
    expect((await s.ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' })).state).toBe('IN_REVIEW');
    expect((await s.ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })).state).toBe('APPROVED');
  });

  it('concurrent retries by the same approver never count twice and never exhaust the slots', async () => {
    const s = setup(2);
    const d = await s.ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
    s.f.inject('setIfAbsent', 'ws:slot:', 'before');
    await s.ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' }).catch(() => undefined);
    const r = await Promise.all([1, 2, 3].map(() => s.ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })));
    expect(r.every((v) => v.approvals.filter((a) => a.by === 'bob').length === 1)).toBe(true);
    expect((await s.ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' })).state).toBe('APPROVED');
  });

  it('a failure never fabricates an approval: no slot = not counted, decision stays IN_REVIEW', async () => {
    const s = setup(1);
    const d = await s.ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 1 });
    s.f.inject('setIfAbsent', 'ws:slot:', 'before');
    await expect(s.ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })).rejects.toThrow();
    expect((await s.ws.view(ctx('alice'), d.id)).state).toBe('IN_REVIEW');
    expect((await s.ws.readyToExecute(ctx('alice'), d.id, 'h1')).ok).toBe(false);
  });
});
