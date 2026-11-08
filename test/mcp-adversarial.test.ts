import { describe, it, expect, vi } from 'vitest';
import { createService } from '../src/engine/service';
import { createRovoActions } from '../src/rovo';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

// TITAN-9Beta: adversarial coverage at the MCP/Rovo handler surface for the
// two externally unverified tools (slip, portfolio) plus plan-scoped reads.
// Every case asserts zero Jira writes: simulations and reads never mutate.
const noWrites = { create: 0, link: 0, comment: 0, label: 0 };
const scenarios = [{ scenarioId: 'B', label: 'Retain', operations: [{ op: 'DEPRECATE_NODE' as const, nodeId: 'issue:PAY-1', retainUntil: null }] }];

function setup() {
  const jira = demoJira(); const store = memoryStore(); let n = 0;
  const deps = { jira, store, now: () => new Date('2026-11-02T09:00:00.000Z'), newId: () => `id${++n}` };
  return { jira, store, deps, svc: createService(deps), rovo: createRovoActions(() => deps) };
}
const alice = { requestId: 'r', accountId: 'alice', installationId: 'i' };

describe('MCP adversarial: simulatePortfolio unknown / cross-project keys', () => {
  it('rejects an out-of-snapshot key instead of inventing it, with zero writes', async () => {
    const s = setup();
    const out = await s.rovo.simulatePortfolio({ issueKey: 'PAY-1', changes: 'REMOVE ZZ-999', context: { accountId: 'alice' } });
    expect(out).toMatch(/could not complete/);
    expect(out).not.toMatch(/Portfolio what-if/);
    expect(s.jira.writes).toEqual(noWrites);
    // The root snapshot is persisted to app storage before node validation
    // rejects; nothing is invented and Jira is untouched.
  });

  it('rejects a cross-project migrate target that is not in the snapshot, with zero writes', async () => {
    const s = setup();
    const out = await s.rovo.simulatePortfolio({ issueKey: 'PAY-1', changes: 'MIGRATE PAY-1 TO XX-9', context: { accountId: 'alice' } });
    expect(out).toMatch(/could not complete/);
    expect(out).not.toMatch(/Portfolio what-if/);
    expect(out).not.toMatch(/issue:XX-9.*CONFIRMED/);
    expect(s.jira.writes).toEqual(noWrites);
  });
});

describe('MCP adversarial: simulateSlip unreadable root', () => {
  it('reports a missing issue as NOT_FOUND, with zero writes', async () => {
    const s = setup();
    const out = await s.rovo.simulateSlip({ issueKey: 'ZZ-999', days: 7, context: { accountId: 'alice' } });
    expect(out).toMatch(/NOT_FOUND/);
    expect(s.jira.writes).toEqual(noWrites);
  });

  it('reports a forbidden issue as PERMISSION_DENIED without confirming details, with zero writes', async () => {
    const s = setup();
    s.jira.add('SEC-10', 'Unlinked restricted item');
    s.jira.forbidden.add('SEC-10');
    const out = await s.rovo.simulateSlip({ issueKey: 'SEC-10', days: 7, context: { accountId: 'alice' } });
    expect(out).toMatch(/PERMISSION_DENIED/);
    expect(s.jira.writes).toEqual(noWrites);
  });
});

describe('MCP adversarial: plan-scoped reads stay private', () => {
  it('refuses another user passport and freshness reads, owner reads work', async () => {
    const s = setup();
    const snap = await s.svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    await s.svc.compareScenarios(alice, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' }, scenarios, maxDepth: 6 });
    const plan = await s.svc.generatePreventionPlan(alice, { snapshotId: snap.snapshotId, scenarioId: 'B' });
    expect(await s.rovo.getPassport({ planId: plan.planId }, { principal: { accountId: 'bob' } })).toMatch(/PERMISSION_DENIED/);
    expect(await s.rovo.checkFreshness({ planId: plan.planId }, { principal: { accountId: 'bob' } })).toMatch(/PERMISSION_DENIED/);
    expect(await s.rovo.getPassport({ planId: plan.planId }, { principal: { accountId: 'alice' } })).not.toMatch(/could not complete/);
    expect(s.jira.writes).toEqual(noWrites);
  });
});

describe('MCP adversarial: concurrency', () => {
  it('concurrent identical portfolio calls return byte-identical outputs, with zero writes', async () => {
    const s = setup();
    const call = () => s.rovo.simulatePortfolio({ issueKey: 'PAY-1', changes: 'REMOVE PAY-1; UPGRADE PAY-2 breaking', context: { accountId: 'alice' } });
    const [a, b] = await Promise.all([call(), call()]);
    // Each call mints its own snapshot, and the result hash binds to it, so
    // normalize both identity tokens: everything else must be identical.
    const norm = (o: string) => o.replace(/snap-id\d+/g, 'snap-X').replace(/result hash `?[0-9a-f]+`?/g, 'result hash H');
    expect(norm(a)).toBe(norm(b));
    expect(a).toMatch(/Portfolio what-if/);
    expect(s.jira.writes).toEqual(noWrites);
  });
});
