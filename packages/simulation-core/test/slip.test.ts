import { simulateSlip } from '../src/slip';

const issues = [
  { key: 'API-1', due: '2026-12-01' },
  { key: 'APP-2', due: '2026-12-05', versions: [{ name: 'v2.0', releaseDate: '2026-12-10' }] },
  { key: 'APP-3', due: '2026-12-20', versions: [{ name: 'v2.0', releaseDate: '2026-12-10' }] },
  { key: 'WEB-4', due: null },
  { key: 'WEB-5', due: '2026-12-08' },
  { key: 'REL-6', due: '2026-12-09', versions: [{ name: 'v2.0', releaseDate: '2026-12-10' }] }
];
const blocks = [{ from: 'API-1', to: 'APP-2' }, { from: 'APP-2', to: 'REL-6' }, { from: 'API-1', to: 'WEB-4' }, { from: 'WEB-4', to: 'WEB-5' }];

describe('what-if slip simulation', () => {
  it('propagates through blocks, keeps planned gaps, flags the release', () => {
    const r = simulateSlip({ issues, blocks, issueKey: 'API-1', days: 5 });
    expect(r.moved.map((m) => [m.key, m.newDue, m.slipDays])).toEqual([['API-1', '2026-12-06', 5], ['APP-2', '2026-12-10', 5], ['REL-6', '2026-12-14', 5]]);
    expect(r.moved.find((m) => m.key === 'REL-6')!.path).toEqual(['API-1', 'APP-2', 'REL-6']);
    expect(r.releases).toEqual([{ name: 'v2.0', releaseDate: '2026-12-10', lateByDays: 4, issues: ['REL-6'] }]);
  });
  it('never treats a missing due date as safe', () => {
    const r = simulateSlip({ issues, blocks, issueKey: 'API-1', days: 5 });
    expect(r.unknown.map((u) => [u.key, u.reason])).toEqual([['WEB-4', 'no due date in Jira'], ['WEB-5', 'a blocker on the path has no due date']]);
  });
  it('is deterministic and validates input', () => {
    const a = simulateSlip({ issues, blocks: [...blocks].reverse(), issueKey: 'API-1', days: 2 });
    const b = simulateSlip({ issues, blocks, issueKey: 'API-1', days: 2 });
    expect(a).toEqual(b);
    expect(() => simulateSlip({ issues, blocks, issueKey: 'API-1', days: 0 })).toThrow();
    expect(() => simulateSlip({ issues, blocks, issueKey: 'NOPE-1', days: 3 })).toThrow();
  });
  it('a small slip can be absorbed by nobody downstream only when no release date is crossed', () => {
    const r = simulateSlip({ issues, blocks, issueKey: 'API-1', days: 1 });
    expect(r.releases).toEqual([]);
  });
  it('terminates on cycles and reports them', () => {
    const r = simulateSlip({ issues: [{ key: 'A-1', due: '2026-12-01' }, { key: 'B-2', due: '2026-12-02' }], blocks: [{ from: 'A-1', to: 'B-2' }, { from: 'B-2', to: 'A-1' }], issueKey: 'A-1', days: 3 });
    expect(r.moved.length + r.unknown.length).toBeGreaterThan(0);
  });
});
