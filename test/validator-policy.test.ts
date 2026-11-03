import { createService } from '../src/engine/service';
import { runValidator, linksDigest } from '../src/validator';
import { ValidatorPolicy } from '../packages/contracts/src/index';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));
const admin = { requestId: 'r', accountId: 'admin', installationId: 'i' };
const dev = { requestId: 'r', accountId: 'dev', installationId: 'i' };

describe('validator outage policy', () => {
  it('defaults to ALLOW; only Jira administrators can switch it; the change is recorded', async () => {
    const jira = demoJira(); const store = memoryStore();
    const svc = createService({ jira, store, now: () => new Date('2026-11-03T00:00:00Z'), newId: () => 'x' });
    expect(ValidatorPolicy.parse(await svc.getValidatorPolicy(dev))).toMatchObject({ onOutage: 'ALLOW', canEdit: false });
    await expect(svc.setValidatorPolicy(dev, { onOutage: 'BLOCK' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    jira.globalPerms = { ADMINISTER: true };
    expect(await svc.setValidatorPolicy(admin, { onOutage: 'BLOCK' })).toMatchObject({ onOutage: 'BLOCK', updatedBy: 'admin', canEdit: true });
    expect((await svc.getValidatorPolicy(admin)).onOutage).toBe('BLOCK');
    await expect(svc.getValidatorPolicy({ ...dev, accountId: null })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  const gated = { kind: 'ok', issue: { labels: ['anticipate-change'], links: [] } };
  const okDecision = { schema: 3 as const, planId: 'p', scenarioId: 'B', status: 'COMPLETED', at: '', issueKey: 'X-1', verdict: 'PASS', blockers: 0, currentVerdict: 'PASS', currentBlockers: 0,
    allActionsVerified: true, linksDigest: linksDigest([]), validUntil: '2026-12-01T00:00:00Z' };
  const io = (o: Partial<Parameters<typeof runValidator>[1]>) => ({ readIssue: async () => gated, readDecision: async () => okDecision, readPolicy: async () => undefined,
    log: () => undefined, now: new Date('2026-11-10T00:00:00Z'), ...o });

  it('normal path is unaffected by the policy', async () => {
    expect((await runValidator('X-1', io({ readPolicy: async () => ({ onOutage: 'BLOCK' }) }))).result).toBe(true);
  });
  it('outage + ALLOW (default) passes and logs the degradation', async () => {
    const logs: unknown[] = [];
    const r = await runValidator('X-1', io({ readDecision: async () => { throw new Error('kvs down'); }, log: (f) => logs.push(f) }));
    expect(r.result).toBe(true);
    expect(logs).toEqual([expect.objectContaining({ outage: true, policy: 'ALLOW' })]);
  });
  it('outage + BLOCK refuses with a recovery path', async () => {
    const r = await runValidator('X-1', io({ readIssue: async () => { throw new Error('jira 503'); }, readPolicy: async () => ({ onOutage: 'BLOCK' }) }));
    expect(r.result).toBe(false);
    expect(r.errorMessage).toMatch(/outage policy to Allow/);
  });
  it('if even the policy cannot be read, it never locks the workflow', async () => {
    const r = await runValidator('X-1', io({ readDecision: async () => { throw new Error('down'); }, readPolicy: async () => { throw new Error('down'); } }));
    expect(r.result).toBe(true);
  });
});

describe('validator: unreadable issue (R18)', () => {
  const dec = { schema: 3 as const, planId: 'p', scenarioId: 'B', status: 'COMPLETED', at: '', issueKey: 'X-1', verdict: 'PASS', blockers: 0, currentVerdict: 'PASS', currentBlockers: 0,
    allActionsVerified: true, linksDigest: linksDigest([]), validUntil: '2026-12-01T00:00:00Z' };
  const run = (kind: string, policy?: string, logs: unknown[] = []) => runValidator('X-1', { readIssue: async () => ({ kind }), readDecision: async () => dec,
    readPolicy: async () => (policy ? { onOutage: policy } : undefined), log: (f) => logs.push(f), now: new Date('2026-11-10T00:00:00Z') });
  for (const kind of ['forbidden', 'not_found', 'no_issue_key']) {
    it(`${kind} + BLOCK refuses: an unreadable issue is not an issue without label`, async () => {
      const logs: unknown[] = [];
      const r = await run(kind, 'BLOCK', logs);
      expect(r.result).toBe(false);
      expect(r.errorMessage).toMatch(/cannot be verified/);
      expect(logs).toEqual([expect.objectContaining({ outage: true, policy: 'BLOCK', reason: `issue_${kind}` })]);
    });
    it(`${kind} + ALLOW (default) passes and logs the degradation`, async () => {
      const logs: unknown[] = [];
      expect((await run(kind, undefined, logs)).result).toBe(true);
      expect(logs).toEqual([expect.objectContaining({ outage: true, policy: 'ALLOW', reason: `issue_${kind}` })]);
    });
  }
  it('full storage outage (decision and policy unreadable) never locks: ALLOW', async () => {
    const r = await runValidator('X-1', { readIssue: async () => ({ kind: 'forbidden' }), readDecision: async () => { throw new Error('kvs'); },
      readPolicy: async () => { throw new Error('kvs'); }, log: () => undefined });
    expect(r.result).toBe(true);
  });
  it('readable issue without the label still passes without consulting the policy', async () => {
    let read = false;
    const r = await runValidator('X-1', { readIssue: async () => ({ kind: 'ok', issue: { labels: [], links: [] } }), readDecision: async () => undefined,
      readPolicy: async () => { read = true; return { onOutage: 'BLOCK' }; }, log: () => undefined });
    expect(r.result).toBe(true); expect(read).toBe(false);
  });
});
