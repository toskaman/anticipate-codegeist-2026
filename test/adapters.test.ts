import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: { path: string; init: { method?: string; body?: string } }[] = [];
let responder: (path: string, init: { method?: string; body?: string }) => { status: number; body?: unknown } = () => ({ status: 200, body: {} });
vi.mock('@forge/api', () => {
  const requestJira = async (path: string, init: { method?: string; body?: string }) => {
    calls.push({ path, init }); const r = responder(path, init);
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
  };
  return { default: { asUser: () => ({ requestJira }), asApp: () => ({ requestJira }) }, route: (s: TemplateStringsArray, ...v: unknown[]) => s.reduce((a, p, i) => a + p + (i < v.length ? encodeURIComponent(String(v[i])) : ''), '') };
});
const kv = new Map<string, unknown>();
vi.mock('@forge/kvs', () => ({ kvs: {
  get: async (k: string) => kv.get(k),
  set: async (k: string, v: unknown, o?: { keyPolicy?: string }) => { if (o?.keyPolicy === 'FAIL_IF_EXISTS' && kv.has(k)) throw new Error('KEY_EXISTS'); kv.set(k, v); },
  delete: async (k: string) => { kv.delete(k); }
} }));

import { createForgeJira, forgeStore, retentionFor } from '../src/forge-adapters';

describe('Forge Jira adapter (mocked transport)', () => {
  beforeEach(() => { calls.length = 0; kv.clear(); });
  it('paginates JQL search with nextPageToken and encodes keys in routes', async () => {
    responder = (_p, init) => { const b = JSON.parse(init.body ?? '{}'); return { status: 200, body: b.nextPageToken ? { issues: [] } : { issues: [{ id: '1', key: 'A-1', fields: {} }], nextPageToken: 'tok2' } }; };
    const j = createForgeJira('https://x.atlassian.net');
    const p1 = await j.searchIssues('project = A', null, 50);
    expect(p1).toMatchObject({ nextPageToken: 'tok2' });
    await j.searchIssues('project = A', 'tok2', 50);
    expect(JSON.parse(calls[1]!.init.body!).nextPageToken).toBe('tok2');
    responder = () => ({ status: 404 });
    expect(await j.getIssue('A-1/../x')).toEqual({ kind: 'not_found' });
    expect(calls.at(-1)!.path).toContain('A-1%2F..%2Fx');
  });
  it('maps 429 to retryable RATE_LIMITED, 403 to PERMISSION_DENIED, 5xx to retryable upstream errors', async () => {
    const j = createForgeJira(null);
    responder = () => ({ status: 429 });
    await expect(j.searchProjects(0, 50)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    responder = () => ({ status: 403 });
    await expect(j.searchProjects(0, 50)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(await j.getIssue('A-1')).toEqual({ kind: 'forbidden' });
    responder = () => ({ status: 503 });
    await expect(j.myPermissions('A', ['BROWSE_PROJECTS'])).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', retryable: true });
  });
  it('writes ADF text only (no markup interpretation)', async () => {
    responder = () => ({ status: 201, body: {} });
    await createForgeJira(null).addComment('A-1', '<script>x</script>\n**bold**');
    const body = JSON.parse(calls[0]!.init.body!);
    expect(body.body.content[0].content[0]).toEqual({ type: 'text', text: '<script>x</script>' });
  });
  it('sends sample due dates as Jira duedate and leaves other creations unchanged', async () => {
    responder = () => ({ status: 201, body: { key: 'JDG-1' } });
    const jira = createForgeJira(null);
    const input = { projectKey: 'JDG', summary: '[ANTICIPATE sample] root', description: 'sample', issueType: 'Task', labels: ['anticipate-sample'] };
    await jira.createIssue({ ...input, dueDate: '2026-11-09' });
    expect(JSON.parse(calls.at(-1)!.init.body!).fields.duedate).toBe('2026-11-09');
    await jira.createIssue(input);
    expect(JSON.parse(calls.at(-1)!.init.body!).fields).not.toHaveProperty('duedate');
  });
  it('accepts empty 201 bodies (issueLink create)', async () => {
    responder = () => ({ status: 201 });
    await expect(createForgeJira(null).createLink({ typeName: 'Blocks', inwardKey: 'A-1', outwardKey: 'A-2' })).resolves.toBeUndefined();
  });
  it('maps createLink subject to inwardIssue (verified Jira POST semantics)', async () => {
    responder = () => ({ status: 201 });
    await createForgeJira(null).createLink({ typeName: 'Blocks', outwardKey: 'NEW-1', inwardKey: 'ROOT-1' });
    const b = JSON.parse(calls.at(-1)!.init.body!);
    expect(b.inwardIssue.key).toBe('NEW-1'); expect(b.outwardIssue.key).toBe('ROOT-1');
  });
  it('applies a bounded retention to every stored key', () => {
    expect(retentionFor('snap:x')).toEqual({ value: 2, unit: 'DAYS' });
    expect(retentionFor('lock:p')).toEqual({ value: 1, unit: 'DAYS' });
    expect(retentionFor('plan:p')).toEqual({ value: 90, unit: 'DAYS' });
  });
  it('setIfAbsent is atomic via FAIL_IF_EXISTS', async () => {
    expect(await forgeStore.setIfAbsent('k', 1)).toBe(true);
    expect(await forgeStore.setIfAbsent('k', 2)).toBe(false);
    expect(await forgeStore.get('k')).toBe(1);
  });
});
