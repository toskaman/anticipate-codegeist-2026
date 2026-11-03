import { createWorkspace, type PlanRef } from '../src/workspace/workspace';
import type { Store } from '../src/core/ports';
import { memoryStore } from './fakes';

/** Store wrapper that pairs up reads of matching keys: each read waits (bounded) for a second concurrent read before returning,
 *  so two racing callers both observe the same state before either writes. */
function interleaving(inner: Store, match: (k: string) => boolean) {
  let armed = false; let waiting: (() => void) | null = null;
  const store: Store = {
    async get<T>(k: string) {
      const v = await inner.get<T>(k);
      if (!armed || !match(k)) return v;
      if (waiting) { const w = waiting; waiting = null; w(); return v; }
      await new Promise<void>((res) => { const t = setTimeout(() => { if (waiting === res) waiting = null; res(); }, 30); waiting = () => { clearTimeout(t); res(); }; });
      return v;
    },
    set: (k, v) => inner.set(k, v), setIfAbsent: (k, v) => inner.setIfAbsent(k, v), delete: (k) => inner.delete(k)
  };
  return { store, arm: () => { armed = true; }, disarm: () => { armed = false; } };
}

const ctx = (a: string | null) => ({ requestId: 'r', accountId: a, installationId: 'i' });
function setup() {
  const mem = memoryStore(); const race = interleaving(mem, (k) => k.startsWith('ws:dec:')); const store = Object.assign(race.store, { data: mem.data }); let t = new Date('2026-11-03T10:00:00Z'); let n = 0;
  const perms: Record<string, Set<string>> = { alice: new Set(['BROWSE_PROJECTS']), bob: new Set(['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS']),
    carol: new Set(['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS']), mallory: new Set(), eve: new Set(['BROWSE_PROJECTS']) };
  const plans: Record<string, PlanRef> = { p1: { planId: 'p1', owner: 'alice', planHash: 'h1', issueKey: 'JDG-1', projectKey: 'JDG' } };
  const ws = createWorkspace({ store, now: () => t, newId: () => String(++n),
    userHasPermission: async (a, _p, perm) => perms[a]?.has(perm) ?? false, getPlan: async (id) => plans[id] });
  return { ws, store, race, perms, plans, advance: (days: number) => { t = new Date(t.getTime() + days * 86400000); } };
}

describe('enterprise workspace (behind flag sharedDecisions)', () => {
  it('only the plan owner can share; anonymous refused', async () => {
    const { ws } = setup();
    await expect(ws.share(ctx('bob'), { planId: 'p1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(ws.share(ctx(null), { planId: 'p1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect((await ws.share(ctx('alice'), { planId: 'p1' })).state).toBe('IN_REVIEW');
  });
  it('separation of duties: the proposer cannot approve, and sees why', async () => {
    const { ws, perms } = setup(); perms.alice!.add('ADMINISTER_PROJECTS');
    const d = await ws.share(ctx('alice'), { planId: 'p1' });
    expect((await ws.view(ctx('alice'), d.id)).capabilities.canApprove).toEqual({ allowed: false, reason: 'PROPOSER' });
    await expect(ws.approve(ctx('alice'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('approval needs the permission, the exact plan hash, and becomes APPROVED', async () => {
    const { ws } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
    await expect(ws.approve(ctx('eve'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(ws.approve(ctx('bob'), { id: d.id, planHash: 'other' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })).state).toBe('APPROVED');
  });
  it('non-members cannot view; access removal denies immediately', async () => {
    const { ws, perms } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
    await expect(ws.view(ctx('mallory'), d.id)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect((await ws.view(ctx('eve'), d.id)).capabilities.canApprove).toEqual({ allowed: false, reason: 'MISSING_PERMISSION' });
    perms.eve!.delete('BROWSE_PROJECTS');
    await expect(ws.view(ctx('eve'), d.id)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('approval is idempotent and concurrent approvals count once per approver', async () => {
    const { ws, plans } = setup(); plans.p1!.planId = 'p1';
    const d = await ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
    await Promise.all([ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' }), ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })]);
    const v = await ws.view(ctx('bob'), d.id);
    expect(v.approvals.filter((a) => a.by === 'bob')).toHaveLength(1);
    expect(v.state).toBe('IN_REVIEW');
    expect((await ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' })).state).toBe('APPROVED');
  });
  it('revocation: an approver who loses the role revokes the decision before execution', async () => {
    const { ws, perms } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
    await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
    expect((await ws.readyToExecute(ctx('alice'), d.id, 'h1')).ok).toBe(true);
    expect((await ws.readyToExecute(ctx('alice'), d.id, 'h2')).ok).toBe(false);
    perms.bob!.delete('ADMINISTER_PROJECTS');
    expect(await ws.readyToExecute(ctx('alice'), d.id, 'h1')).toMatchObject({ ok: false });
    expect((await ws.view(ctx('alice'), d.id)).state).toBe('REVOKED');
  });
  it('review expires', async () => {
    const { ws, advance } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
    advance(8);
    await expect(ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await ws.view(ctx('alice'), d.id)).state).toBe('EXPIRED');
  });
  it('audit is append-only and ordered', async () => {
    const { ws, store } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
    await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
    const log = await ws.audit(ctx('eve'), d.id);
    expect(log.map((e) => e.event)).toEqual(['SHARED', 'APPROVED', 'READY']);
    expect(await store.setIfAbsent(`ws:log:${d.id}:000001`, { forged: true })).toBe(false);
  });

  describe('concurrency (no lost updates on the KVS without transactions)', () => {
    it('two distinct approvers approving concurrently are both counted and the decision becomes APPROVED', async () => {
      const { ws, race } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
      race.arm();
      await Promise.all([ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' }), ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' })]);
      race.disarm();
      const v = await ws.view(ctx('eve'), d.id);
      expect(v.approvals.map((a) => a.by).sort()).toEqual(['bob', 'carol']);
      expect(v.state).toBe('APPROVED');
      const ev = (await ws.audit(ctx('eve'), d.id)).map((e) => e.event);
      expect(ev.filter((e) => e === 'APPROVED')).toHaveLength(2);
      expect(ev.filter((e) => e === 'READY')).toHaveLength(1);
      expect((await ws.readyToExecute(ctx('alice'), d.id, 'h1')).ok).toBe(true);
    });
    it('a duplicate concurrent approval by the same approver counts once and leaves room for another approver', async () => {
      const { ws, race } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
      race.arm();
      await Promise.all([ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' }), ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })]);
      race.disarm();
      const v = await ws.view(ctx('eve'), d.id);
      expect(v.approvals.map((a) => a.by)).toEqual(['bob']);
      expect(v.state).toBe('IN_REVIEW');
      expect((await ws.audit(ctx('eve'), d.id)).filter((e) => e.event === 'APPROVED')).toHaveLength(1);
      expect((await ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' })).state).toBe('APPROVED');
    });
    it('audit returns every appended entry even if the stored decision carries a stale sequence', async () => {
      const { ws, store } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
      const rec = store.data.get(`ws:dec:${d.id}`) as Record<string, unknown>;
      store.data.set(`ws:dec:${d.id}`, { ...rec, seq: 1 });
      expect((await ws.audit(ctx('eve'), d.id)).map((e) => e.event)).toEqual(['SHARED', 'APPROVED', 'READY']);
    });
    it('concurrent revocation checks record REVOKED exactly once', async () => {
      const { ws, race, perms } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
      perms.bob!.delete('ADMINISTER_PROJECTS');
      race.arm();
      const r = await Promise.all([ws.readyToExecute(ctx('alice'), d.id, 'h1'), ws.readyToExecute(ctx('eve'), d.id, 'h1')]);
      race.disarm();
      expect(r.every((x) => !x.ok)).toBe(true);
      expect((await ws.audit(ctx('eve'), d.id)).filter((e) => e.event === 'REVOKED')).toHaveLength(1);
    });
    it('concurrent approvals after expiry record EXPIRED exactly once and count nothing', async () => {
      const { ws, race, advance } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
      advance(8); race.arm();
      const r = await Promise.allSettled([ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' }), ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' })]);
      race.disarm();
      expect(r.every((x) => x.status === 'rejected')).toBe(true);
      const v = await ws.view(ctx('eve'), d.id);
      expect(v.state).toBe('EXPIRED'); expect(v.approvals).toHaveLength(0);
      expect((await ws.audit(ctx('eve'), d.id)).filter((e) => e.event === 'EXPIRED')).toHaveLength(1);
    });
  });

  describe('security', () => {
    it('cross-user read without permission is denied for view, audit and readiness', async () => {
      const { ws } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await expect(ws.view(ctx('mallory'), d.id)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      await expect(ws.audit(ctx('mallory'), d.id)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      await expect(ws.readyToExecute(ctx('mallory'), d.id, 'h1')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      await expect(ws.approve(ctx('mallory'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });
    it('unauthorized approval leaves no trace', async () => {
      const { ws } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await expect(ws.approve(ctx('eve'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      const v = await ws.view(ctx('eve'), d.id);
      expect(v.approvals).toHaveLength(0); expect(v.state).toBe('IN_REVIEW');
      expect((await ws.audit(ctx('eve'), d.id)).map((e) => e.event)).toEqual(['SHARED']);
    });
    it('self-approval is refused even for an administrator proposer', async () => {
      const { ws, perms } = setup(); perms.alice!.add('ADMINISTER_PROJECTS');
      const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await expect(ws.approve(ctx('alice'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      expect((await ws.view(ctx('alice'), d.id)).approvals).toHaveLength(0);
    });
    it('permission revoked between approval and execution blocks execution (multi-approver)', async () => {
      const { ws, perms } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
      await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' }); await ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' });
      perms.carol!.delete('ADMINISTER_PROJECTS');
      expect(await ws.readyToExecute(ctx('alice'), d.id, 'h1')).toMatchObject({ ok: false });
      expect((await ws.view(ctx('alice'), d.id)).state).toBe('REVOKED');
    });
    it('an approved decision past its expiry is no longer executable', async () => {
      const { ws, advance } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
      advance(8);
      expect(await ws.readyToExecute(ctx('alice'), d.id, 'h1')).toMatchObject({ ok: false });
      expect((await ws.view(ctx('alice'), d.id)).state).toBe('EXPIRED');
    });
    it('a changed plan hash cannot be approved or executed', async () => {
      const { ws } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await expect(ws.approve(ctx('bob'), { id: d.id, planHash: 'h2' })).rejects.toMatchObject({ code: 'CONFLICT' });
      await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
      expect(await ws.readyToExecute(ctx('alice'), d.id, 'h2')).toMatchObject({ ok: false });
    });
    it('a duplicate approval request is idempotent and audited once', async () => {
      const { ws } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1', requiredApprovals: 2 });
      await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
      const again = await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
      expect(again.approvals).toHaveLength(1); expect(again.state).toBe('IN_REVIEW');
      expect((await ws.audit(ctx('eve'), d.id)).filter((e) => e.event === 'APPROVED')).toHaveLength(1);
    });
    it('cross-project isolation: permissions on another project grant nothing', async () => {
      const store = memoryStore(); let n = 0;
      const grants = new Set(['alice@JDG:BROWSE_PROJECTS', 'bob@OPS:BROWSE_PROJECTS', 'bob@OPS:ADMINISTER_PROJECTS']);
      const ws = createWorkspace({ store, now: () => new Date('2026-11-03T10:00:00Z'), newId: () => String(++n),
        userHasPermission: async (a, proj, perm) => grants.has(`${a}@${proj}:${perm}`),
        getPlan: async (id) => (id === 'p1' ? { planId: 'p1', owner: 'alice', planHash: 'h1', issueKey: 'JDG-1', projectKey: 'JDG' } : undefined) });
      const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await expect(ws.view(ctx('bob'), d.id)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      await expect(ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      grants.add('bob@JDG:BROWSE_PROJECTS');
      await expect(ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });
    it('stale execution after revocation stays blocked even if the permission is restored', async () => {
      const { ws, perms } = setup(); const d = await ws.share(ctx('alice'), { planId: 'p1' });
      await ws.approve(ctx('bob'), { id: d.id, planHash: 'h1' });
      perms.bob!.delete('ADMINISTER_PROJECTS');
      expect((await ws.readyToExecute(ctx('alice'), d.id, 'h1')).ok).toBe(false);
      perms.bob!.add('ADMINISTER_PROJECTS');
      expect((await ws.readyToExecute(ctx('alice'), d.id, 'h1')).ok).toBe(false);
      await expect(ws.approve(ctx('carol'), { id: d.id, planHash: 'h1' })).rejects.toMatchObject({ code: 'CONFLICT' });
      expect((await ws.view(ctx('alice'), d.id)).state).toBe('REVOKED');
    });
    it('rejects malformed decision ids before touching storage', async () => {
      const { ws } = setup();
      await expect(ws.view(ctx('eve'), 'dec-1:x/../y')).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });
});
