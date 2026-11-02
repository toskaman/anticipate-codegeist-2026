import { teamworkGraphSource, parseRows, cypherFor } from '../src/context/twg';
import { mergeSource } from '../src/context/sources';
import { simulate } from '../packages/simulation-core/src/index';
import { FIXTURE_POLICIES } from '../packages/contracts/src/fixtures';
import type { GraphSnapshot } from '../packages/contracts/src/index';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
const ari = (k: string) => `ari:cloud:jira:site:issue/${k}`;
const body = (ids: string[]) => ({ data: { cypherQuery: { edges: ids.map((id) => ({ node: { columns: [{ value: { id, data: { __typename: 'CompassComponent' } } }] } })) } } });
const port = (impl: (vars: { cypherQuery: string }) => { ok: boolean; status: number; body?: unknown } | Error) => ({
  ariFor: (k: string) => ari(k), now: () => '2026-11-03T00:00:00.000Z',
  async requestGraph(_q: string, vars: unknown) { const r = impl(vars as { cypherQuery: string }); if (r instanceof Error) throw r; return { ok: r.ok, status: r.status, json: async () => r.body }; }
});
const snap: GraphSnapshot = {
  snapshotId: 'snap-t', projectId: 'A', mode: 'LIVE', createdAt: '2026-11-03T00:00:00.000Z', expiresAt: '2026-11-04T00:00:00.000Z', truncated: false,
  limits: { maxDepth: 3, maxNodes: 200 },
  nodes: [{ id: 'issue:A-1', kind: 'ISSUE', label: 'A-1', status: 'CONFIRMED', attributes: {}, references: [] }, { id: 'issue:A-2', kind: 'ISSUE', label: 'A-2', status: 'CONFIRMED', attributes: {}, references: [] }],
  edges: [{ id: 'e1', from: 'issue:A-2', to: 'issue:A-1', kind: 'DEPENDS_ON', status: 'CONFIRMED', references: [], accessLimited: false }]
} as GraphSnapshot;

describe('Teamwork Graph prototype adapter (disabled by default)', () => {
  it('only queries allowlisted relations with a parameterised issue ARI (no injection)', () => {
    expect(cypherFor('jira_work_item_impacts_compass_component')).toContain('$id');
    expect(() => cypherFor('x]->() DETACH DELETE n //')).toThrow();
  });
  it('parses components as documentary relations and ignores rows without stable ids', () => {
    const p = parseRows('A-1', ari('A-1'), 'jira_work_item_impacts_compass_component', { data: { cypherQuery: { edges: [{ node: { columns: [{ value: { id: 'ari:cmp/1', data: { __typename: 'CompassComponent' } } }] } }, { node: { columns: [{ value: {} }] } }] } } }, 't');
    expect(p.relations).toEqual([{ fromId: ari('A-1'), toId: 'ari:cmp/1', relationType: 'links_to', observedAt: 't' }]);
  });
  it('merged evidence never changes the Jira-based verdict and never becomes CONFIRMED', async () => {
    const src = teamworkGraphSource(port((v) => ({ ok: true, status: 200, body: v.cypherQuery.includes('compass') ? body(['ari:cmp/1']) : body([]) })));
    const res = await src.fetch(['A-1', 'A-2']);
    expect(res.state).toBe('FULL');
    const merged = mergeSource(snap, res);
    expect(merged.edges.filter((e) => e.references.some((r) => r.sourceSystem === 'TEAMWORK_GRAPH')).every((e) => e.status === 'INFERRED')).toBe(true);
    const op = { scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE' as const, nodeId: 'issue:A-1' }] };
    expect(simulate(merged, op, FIXTURE_POLICIES).verdict).toBe(simulate(snap, op, FIXTURE_POLICIES).verdict);
  });
  it('an outage is reported as UNAVAILABLE, a partial failure as PARTIAL', async () => {
    expect((await teamworkGraphSource(port(() => new Error('down'))).fetch(['A-1'])).state).toBe('UNAVAILABLE');
    let i = 0;
    expect((await teamworkGraphSource(port(() => (i++ === 0 ? { ok: false, status: 429 } : { ok: true, status: 200, body: body([]) }))).fetch(['A-1'])).state).toBe('PARTIAL');
  });
});
