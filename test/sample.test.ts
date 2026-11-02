import { createService } from '../src/engine/service';
import { SampleProjectPlan } from '../packages/contracts/src/index';
import { FakeJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));
const ctx = { requestId: 'r', accountId: 'judge', installationId: 'i' };
const mk = () => { const jira = new FakeJira(); jira.add('JDG-1', 'existing customer issue'); return { jira, svc: createService({ jira, store: memoryStore(), now: () => new Date('2026-11-02T09:00:00Z'), newId: () => 'x' }) }; };

describe('judge sample project', () => {
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
});
