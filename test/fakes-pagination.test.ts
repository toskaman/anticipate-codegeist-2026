import { describe, it, expect } from 'vitest';
import { FakeJira, demoJira } from './fakes';

/** W4-fakejira: FakeJira search fidelity — project= filter, nextPageToken pagination, empty issueTypes. */
describe('FakeJira search fidelity', () => {
  it('filters on project = KEY, alone and combined with labels', async () => {
    const j = demoJira();
    const pay = await j.searchIssues('project = PAY', null, 50);
    expect(pay.items.map((i) => i.key).sort()).toEqual(['PAY-1', 'PAY-2', 'PAY-3', 'PAY-4', 'PAY-5']);
    expect(pay.nextPageToken).toBeNull();
    const sec = await j.searchIssues('project = SEC', null, 50);
    expect(sec.items.map((i) => i.key)).toEqual(['SEC-9']);
    const one = await j.searchIssues('project = PAY AND labels = "anticipate-change"', null, 50);
    expect(one.items.map((i) => i.key)).toEqual(['PAY-1']);
    expect((await j.searchIssues('project = PAY AND labels = "does-not-exist"', null, 50)).items).toEqual([]);
  });

  it('paginates over multiple pages with nextPageToken', async () => {
    const j = new FakeJira();
    for (let n = 1; n <= 5; n++) j.add(`PAY-${n}`, `issue ${n}`);
    const seen: string[] = [];
    let token: string | null = null;
    let pages = 0;
    do {
      const r = await j.searchIssues('ORDER BY updated DESC', token, 2);
      expect(r.items.length).toBeLessThanOrEqual(2);
      seen.push(...r.items.map((i) => i.key));
      token = r.nextPageToken;
      pages++;
    } while (token !== null);
    expect(pages).toBe(3); // 2 + 2 + 1
    expect(seen).toEqual(['PAY-1', 'PAY-2', 'PAY-3', 'PAY-4', 'PAY-5']);
    const all = await j.searchIssues('ORDER BY updated DESC', null, 50);
    expect(all.items).toHaveLength(5);
    expect(all.nextPageToken).toBeNull();
  });

  it('rejects invalid JQL and invalid page tokens like the live adapter maps HTTP 400', async () => {
    const j = demoJira();
    await expect(j.searchIssues('this is not jql', null, 10)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    await expect(j.searchIssues('project =', null, 10)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    await expect(j.searchIssues('ORDER BY updated DESC', 'bogus-token', 2)).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    // supported clauses are not falsely rejected
    await expect(j.searchIssues('project = PAY AND issueLinkType is not EMPTY ORDER BY updated DESC', null, 10)).resolves.toBeDefined();
    await expect(j.searchIssues('labels in ("a", "b")', null, 10)).resolves.toBeDefined();
  });

  it('returns no issue types for projects without creatable types', async () => {
    const j = demoJira();
    j.noTypes.add('SD');
    await expect(j.issueTypes('SD')).resolves.toEqual([]);
    await expect(j.issueTypes('PAY')).resolves.toEqual(['Epic', 'Task', 'Bug']);
  });
});
