import { createService } from '../src/engine/service';
import { upgradeScenarios } from '../src/engine/scenarios';
import { CapabilityAvailability, PreventionPlan, GraphSnapshot } from '../packages/contracts/src/index';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));
const ctx = { requestId: 'r', accountId: 'u', installationId: 'i' };
const mk = () => { let n = 0; return createService({ jira: demoJira(), store: memoryStore(), now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `c${++n}` }); };

describe('capabilities and coverage (EXPERIENCE requests R1, R2, R4)', () => {
  it('R1: advertises scenario:UPGRADE_NODE and the upgrade journey works end to end', async () => {
    const svc = mk();
    const caps = CapabilityAvailability.parse(await svc.getCapabilities());
    expect(caps.operations).toContain('scenario:UPGRADE_NODE');
    const snap = await svc.getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    const cmp = await svc.compareScenarios(ctx, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'upgrade' },
      scenarios: upgradeScenarios('issue:PAY-1', 'issue:PAY-5'), maxDepth: 6 });
    expect(cmp.results.map((r) => r.scenarioId)).toEqual(expect.arrayContaining(['A-breaking-upgrade-now', 'B-compatible-upgrade']));
    const plan = PreventionPlan.parse(await svc.generatePreventionPlan(ctx, { snapshotId: snap.snapshotId, scenarioId: 'A-breaking-upgrade-now' }));
    expect(plan.scenarioId).toBe('A-breaking-upgrade-now');
  });
  it('R2: reports shipped Rovo/validator modules honestly', async () => {
    const caps = await mk().getCapabilities();
    expect(caps).toMatchObject({ rovoAgent: 'AVAILABLE', rovoMcp: 'PERMISSION_REQUIRED', workflowValidator: 'AVAILABLE', teamworkGraph: 'NOT_CONFIGURED' });
  });
  it('R4: every live snapshot carries Jira and Teamwork Graph coverage', async () => {
    const snap = GraphSnapshot.parse(await mk().getGraphSnapshot(ctx, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 }));
    const jira = snap.coverage!.find((c) => c.source === 'JIRA')!;
    expect(['FULL', 'PARTIAL']).toContain(jira.state);
    expect(jira.detail).toMatch(/items/);
    expect(snap.coverage!.find((c) => c.source === 'TEAMWORK_GRAPH')!.state).toBe('NOT_CONFIGURED');
  });
});
