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

import { actorOf } from '../src/rovo';
it('resolves the invoking user from payload or handler context', () => {
  expect(actorOf({ context: { accountId: 'a' } })).toBe('a');
  expect(actorOf({}, { principal: { accountId: 'b' } })).toBe('b');
  expect(actorOf({})).toBeNull();
});

describe('simulateSlip days validation', () => {
  const setup = () => {
    const jira = demoJira(); const store = memoryStore(); let i = 0;
    return createRovoActions(() => ({ jira, store, now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `r${++i}` }));
  };
  // No auth context on purpose: days validation must run in the Rovo layer
  // before any service/auth check, so invalid days always surface VALIDATION.
  it.each([NaN, 0, 366, -5, 'not-a-number', 3.5])('rejects invalid days %p with VALIDATION', async (days) => {
    const a = setup();
    const r = await a.simulateSlip({ issueKey: 'PAY-1', days: days as number });
    expect(r).toMatch(/VALIDATION/);
    expect(r).toMatch(/days must be an integer between 1 and 365/);
  });
  it.each([1, 365, '1', '365'])('accepts valid days %p', async (days) => {
    const a = setup();
    const r = await a.simulateSlip({ issueKey: 'PAY-1', days: days as number, context: { accountId: 'u' } });
    expect(r).toMatch(/What-if/);
    expect(r).not.toMatch(/VALIDATION/);
  });
});
it('get-graph lists every relation it counts, including inferred and unknown ones', async () => {
  const jira = demoJira(); const store = memoryStore(); let i = 0;
  const a = createRovoActions(() => ({ jira, store, now: () => new Date('2026-11-02T09:00:00Z'), newId: () => `r${++i}` }));
  const g = await a.getGraph({ issueKey: 'PAY-1', context: { accountId: 'u' } });
  const header = g.split('\n')[1]!;
  const total = Number(/(\d+) relations/.exec(header)![1]);
  const listed = g.split('\n').filter((l) => l.startsWith('- ')).length;
  expect(listed).toBe(Math.min(total, 20));
  for (const status of ['CONFIRMED', 'INFERRED', 'UNKNOWN']) {
    const counted = Number(new RegExp(`(\\d+) ${status.toLowerCase()}`).exec(header)![1]);
    expect(g.split('\n').filter((l) => l.startsWith('- ') && l.endsWith(`[${status}]`)).length).toBe(counted);
  }
});

it('error replies end with exactly one period', async () => {
  const jira = demoJira(); const store = memoryStore();
  const a = createRovoActions(() => ({ jira, store, now: () => new Date('2026-11-02T09:00:00Z'), newId: () => 'x' }));
  const r = await a.getPassport({ planId: 'plan-does-not-exist', context: { accountId: 'u' } });
  expect(r).toMatch(/^ANTICIPATE could not complete this request: NOT_FOUND — .*[^.]\.$/);
});
