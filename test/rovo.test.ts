import { createRovoActions } from '../src/rovo';
import { demoJira, memoryStore } from './fakes';
import { standardScenarios } from '../src/engine/scenarios';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

it('rovo actions are read-only and explain results', async () => {
  const jira = demoJira(); const store = memoryStore(); let i = 0;
  const a = createRovoActions(() => ({ jira, store, now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `r${++i}` }));
  const g = await a.getGraph({ issueKey: 'PAY-1', context: { accountId: 'u' } });
  expect(g).toMatch(/unknown/);
  const s = await a.simulateRetirement({ issueKey: 'PAY-1', context: { accountId: 'u' } });
  expect(s).toMatch(/A-remove-now: BLOCKED/);
  expect(s).toMatch(/No Jira changes were made/);
  expect(await a.getGraph({ issueKey: 'drop table' })).toMatch(/VALIDATION/);
  expect(jira.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
  expect(standardScenarios('x', 'y')).toHaveLength(3);
});
