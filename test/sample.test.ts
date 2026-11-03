import { createService } from '../src/engine/service';
import { SampleProjectPlan } from '../packages/contracts/src/index';
import { FakeJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));
const ctx = { requestId: 'r', accountId: 'judge', installationId: 'i' };
const mk = (date = '2026-11-02T09:00:00Z') => { const jira = new FakeJira(); jira.add('JDG-1', 'existing customer issue'); return { jira, svc: createService({ jira, store: memoryStore(), now: () => new Date(date), newId: () => 'x' }) }; };

describe('judge sample project', () => {
  it('previews the six planned due dates without writes and sends them only on new issue creation', async () => {
    const s = mk();
    const create = vi.spyOn(s.jira, 'createIssue');
    const preview = SampleProjectPlan.parse(await s.svc.previewSampleProject(ctx, { projectKey: 'JDG' }));
    const dates = ['2026-11-09', '2026-11-16', '2026-11-16', '2026-11-23', '2026-11-09', '2026-11-23'];
    expect(preview.items).toEqual(dates.map((dueDate) => expect.objectContaining({ dueDate, status: 'TO_CREATE' })));
    expect(create).not.toHaveBeenCalled();
    const result = await s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true });
    expect(create.mock.calls.map(([input]) => input)).toEqual(dates.map((dueDate) => expect.objectContaining({ dueDate })));
    expect(result.items).toEqual(dates.map((dueDate) => expect.objectContaining({ dueDate, status: 'CREATED' })));
    expect(s.jira.issues.get('JDG-1')!.due).toBeUndefined();
  });
  it('a ten-day root slip moves downstream sample dates through the seeded Blocks links without writes', async () => {
    const s = mk();
    const result = await s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true });
    const byRole = Object.fromEntries(result.items.map((item) => [item.role, item.issueKey]));
    const writes = { ...s.jira.writes };
    const slip = await s.svc.simulateSlip(ctx, { issueKey: result.rootIssueKey!, days: 10 });
    const downstream = slip.moved.filter((item) => item.key !== result.rootIssueKey);
    expect(downstream.length).toBeGreaterThanOrEqual(2);
    expect(downstream).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: byRole.checkout, oldDue: '2026-11-16', newDue: '2026-11-26', path: [byRole.api, byRole.checkout] }),
      expect.objectContaining({ key: byRole.webhooks, oldDue: '2026-11-23', newDue: '2026-12-03', path: [byRole.api, byRole.checkout, byRole.webhooks] })
    ]));
    expect(slip.unknown).toEqual([]);
    expect(slip.releases).toEqual([]); // sample creates no fix versions
    expect(s.jira.writes).toEqual(writes);
  });
  it('reuses old sample dates or missing dates unchanged, even on a later creation day', async () => {
    const s = mk();
    const first = await s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true });
    s.jira.issues.get(first.rootIssueKey!)!.due = null; // sample created by an older app version
    const checkout = first.items.find((item) => item.role === 'checkout')!.issueKey!;
    s.jira.issues.get(checkout)!.due = '2026-12-31'; // user-edited existing sample
    const before = structuredClone([...s.jira.issues]);
    const writes = { ...s.jira.writes };
    s.jira.perms.SCHEDULE_ISSUES = false; // reuse needs no new dates or scheduling permission
    const later = createService({ jira: s.jira, store: memoryStore(), now: () => new Date('2027-01-01T23:00:00Z'), newId: () => 'later' });
    const result = await later.createSampleProject(ctx, { projectKey: 'JDG', confirm: true });
    expect(result.items.find((item) => item.role === 'api')).toMatchObject({ dueDate: null, status: 'EXISTS' });
    expect(result.items.find((item) => item.role === 'checkout')).toMatchObject({ dueDate: '2026-12-31', status: 'EXISTS' });
    expect([...s.jira.issues]).toEqual(before);
    expect(s.jira.writes).toEqual(writes);
  });
  it.each([
    ['2026-12-29T23:59:59Z', '2027-01-05', '2027-01-19'],
    ['2028-02-22T00:00:01Z', '2028-02-29', '2028-03-14']
  ])('uses the UTC creation day across calendar boundaries (%s)', async (day, rootDue, lastDue) => {
    const s = mk(day);
    const first = await s.svc.previewSampleProject(ctx, { projectKey: 'JDG' });
    expect(first.items[0]).toMatchObject({ dueDate: rootDue });
    expect(first.items[3]).toMatchObject({ dueDate: lastDue });
    expect(await s.svc.previewSampleProject(ctx, { projectKey: 'JDG' })).toEqual(first);
  });
  it('reports missing scheduling permission before creating any dated sample issues', async () => {
    const s = mk(); s.jira.perms.SCHEDULE_ISSUES = false;
    const preview = await s.svc.previewSampleProject(ctx, { projectKey: 'JDG' });
    expect(preview).toMatchObject({ canCreate: false, missingPermissions: ['SCHEDULE_ISSUES'] });
    await expect(s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(s.jira.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
  });
  it('preview is read-only and lists what would be created', async () => {
    const s = mk();
    const p = SampleProjectPlan.parse(await s.svc.previewSampleProject(ctx, { projectKey: 'JDG' }));
    expect(p.items.every((i) => i.status === 'TO_CREATE')).toBe(true);
    expect(p.links).toHaveLength(4);
    expect(s.jira.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
  });
  it('creation is verified, idempotent and never touches existing issues; then the full analysis works', async () => {
    const s = mk();
    const first = SampleProjectPlan.parse(await s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true }));
    expect(first.items.every((i) => i.status === 'CREATED')).toBe(true);
    expect(first.links.every((l) => l.status === 'CREATED')).toBe(true);
    const writes = { ...s.jira.writes };
    const second = await s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true });
    expect(second.items.every((i) => i.status === 'EXISTS')).toBe(true);
    expect(s.jira.writes).toEqual(writes); // idempotent
    expect(s.jira.issues.get('JDG-1')!.labels).toEqual([]); // untouched
    const snap = await s.svc.getGraphSnapshot(ctx, { projectId: 'JDG', rootIssueKey: first.rootIssueKey!, source: 'JIRA', maxDepth: 3 });
    const cmp = await s.svc.compareScenarios(ctx, { snapshotId: snap.snapshotId, change: { issueKey: first.rootIssueKey, targetNodeId: `issue:${first.rootIssueKey}`, description: 'x' },
      scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: `issue:${first.rootIssueKey}` }] }], maxDepth: 6 });
    expect(cmp.results[0]!.verdict).toBe('BLOCKED');
    expect(cmp.results[0]!.summary.impacted).toBe(3);
  });
  it('refuses without permission and writes nothing', async () => {
    const s = mk(); s.jira.perms.CREATE_ISSUES = false;
    await expect(s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(s.jira.writes.create).toBe(0);
  });
  it('concurrent creation requests never duplicate sample issues', async () => {
    const s = mk();
    const res = await Promise.allSettled([1, 2, 3].map(() => s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true })));
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(res.filter((r) => r.status === 'rejected').every((r) => (r as PromiseRejectedResult).reason.code === 'CONFLICT')).toBe(true);
    expect(s.jira.writes.create).toBe(6);
    // lease released: a retry afterwards is allowed and idempotent
    const again = await s.svc.createSampleProject(ctx, { projectKey: 'JDG', confirm: true });
    expect(again.items.every((i) => i.status === 'EXISTS')).toBe(true);
    expect(s.jira.writes.create).toBe(6);
  });
});
