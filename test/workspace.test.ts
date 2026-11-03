import { createWorkspace, type PlanRef } from '../src/workspace/workspace';
import { memoryStore } from './fakes';

const ctx = (a: string | null) => ({ requestId: 'r', accountId: a, installationId: 'i' });
function setup() {
  const store = memoryStore(); let t = new Date('2026-11-03T10:00:00Z'); let n = 0;
  const perms: Record<string, Set<string>> = { alice: new Set(['BROWSE_PROJECTS']), bob: new Set(['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS']),
    carol: new Set(['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS']), mallory: new Set(), eve: new Set(['BROWSE_PROJECTS']) };
  const plans: Record<string, PlanRef> = { p1: { planId: 'p1', owner: 'alice', planHash: 'h1', issueKey: 'JDG-1', projectKey: 'JDG' } };
  const ws = createWorkspace({ store, now: () => t, newId: () => String(++n),
    userHasPermission: async (a, _p, perm) => perms[a]?.has(perm) ?? false, getPlan: async (id) => plans[id] });
  return { ws, store, perms, plans, advance: (days: number) => { t = new Date(t.getTime() + days * 86400000); } };
}

describe('enterprise workspace prototype', () => {
  it('only the plan owner can share; anonymous refused', async () => {
    const { ws } = setup();
    await expect(ws.share(ctx('bob'), { planId: 'p1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(ws.share(ctx(null), { planId: 'p1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect((await ws.share(ctx('alice'), { planId: 'p1' })).state).toBe('IN_REVIEW');
  });
  it('separation of duties: the proposer cannot approve, and sees why', async () => {
    const { ws, perms } = setup(); perms.alice!.add('ADMINISTER_PROJECTS');
    const d = await ws.share(ctx('alice'), { planId: 'p1' });
    expect((await ws.view(ctx('alice'), d.id)).cannotApproveReason).toBe('SEPARATION_OF_DUTIES');
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
    expect((await ws.view(ctx('eve'), d.id)).canApprove).toBe(false);
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
});
