import { slipFromJira, formatSlip } from '../src/engine/slip-service';
import { FakeJira } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
const ctx = { requestId: 'r', accountId: 'u1', installationId: 'i' };
function site() {
  const j = new FakeJira();
  j.add('REL-1', 'Auth API change', { due: '2026-12-01' });
  j.add('REL-2', 'Checkout migration', { due: '2026-12-05', versions: [{ name: 'Winter', releaseDate: '2026-12-08' }] });
  j.add('REL-3', 'Mobile update', { due: null });
  j.add('REL-4', 'Partner webhooks', { due: '2026-12-07' });
  j.add('REL-5', 'Unrelated', { due: '2026-12-02' });
  j.link('Blocks', 'blocks', 'is blocked by', 'REL-1', 'REL-2');
  j.link('Blocks', 'blocks', 'is blocked by', 'REL-1', 'REL-3');
  j.link('Blocks', 'blocks', 'is blocked by', 'REL-2', 'REL-4');
  j.link('Blocks', 'blocks', 'is blocked by', 'REL-5', 'REL-1'); // REL-1 is blocked by REL-5: upstream, must not move
  return j;
}
describe('what-if slip on Jira data', () => {
  it('follows only downstream blocks links and flags the release', async () => {
    const r = await slipFromJira(site(), ctx, { issueKey: 'REL-1', days: 4 });
    expect(r.moved.map((m) => m.key)).toEqual(['REL-1', 'REL-2', 'REL-4']);
    expect(r.releases).toEqual([{ name: 'Winter', releaseDate: '2026-12-08', lateByDays: 1, issues: ['REL-2'] }]);
    expect(r.unknown.map((u) => u.key)).toEqual(['REL-3']);
    expect(formatSlip(r)).toContain('nothing was changed in Jira');
  });
  it('unreadable downstream issues are unknown, an unreadable root is refused', async () => {
    const j = site(); j.forbidden.add('REL-4');
    const r = await slipFromJira(j, ctx, { issueKey: 'REL-1', days: 4 });
    expect(r.unknown.find((u) => u.key === 'REL-4')?.reason).toBe('not readable with your Jira permissions');
    j.forbidden.add('REL-1');
    await expect(slipFromJira(j, ctx, { issueKey: 'REL-1', days: 4 })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('requires an account and valid input; makes no writes', async () => {
    const j = site();
    await expect(slipFromJira(j, { ...ctx, accountId: null }, { issueKey: 'REL-1', days: 4 })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(slipFromJira(j, ctx, { issueKey: 'bad', days: 4 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(slipFromJira(j, ctx, { issueKey: 'REL-1', days: 0 })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(j.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
  });
});
