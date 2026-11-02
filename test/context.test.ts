import { mergeSource, type SourceResult } from '../src/context/sources';
import { GraphSnapshot } from '../packages/contracts/src/index';
import { simulate } from '../packages/simulation-core/src/index';
import { FIXTURE_POLICIES } from '../packages/contracts/src/fixtures';

const base: GraphSnapshot = {
  snapshotId: 's', projectId: 'p', createdAt: '2026-11-02T00:00:00.000Z', expiresAt: '2026-11-03T00:00:00.000Z', mode: 'LIVE', truncated: false, limits: { maxDepth: 3, maxNodes: 200 },
  nodes: [
    { id: 'issue:A-1', kind: 'ISSUE', label: 'Auth API v1', status: 'CONFIRMED', attributes: {}, references: [] },
    { id: 'issue:A-2', kind: 'ISSUE', label: 'Checkout', status: 'CONFIRMED', attributes: {}, references: [] }
  ],
  edges: [{ id: 'l1', from: 'issue:A-2', to: 'issue:A-1', kind: 'DEPENDS_ON', status: 'CONFIRMED', references: [], accessLimited: false }]
};
const res = (over: Partial<SourceResult>): SourceResult => ({ state: 'FULL', detail: 'ok', objects: [], relations: [], ...over });
const sim = (g: GraphSnapshot) => simulate(g, { scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:A-1' }] }, FIXTURE_POLICIES);

describe('Context Intelligence Engine (Teamwork Graph merge)', () => {
  it('unavailable / not configured source: Jira-only evidence and verdict unchanged, coverage honest', () => {
    for (const state of ['UNAVAILABLE', 'NOT_CONFIGURED'] as const) {
      const g = GraphSnapshot.parse(mergeSource(base, res({ state, detail: 'x' })));
      expect(g.edges).toEqual(base.edges);
      expect(g.coverage?.find((c) => c.source === 'TEAMWORK_GRAPH')?.state).toBe(state);
      expect(sim(g).verdict).toBe(sim(base).verdict);
    }
  });
  it('a causal external relation adds an INFERRED consumer and changes the analysis (Jira-only vs Jira+TWG)', () => {
    const g = GraphSnapshot.parse(mergeSource(base, res({
      objects: [{ id: 'ari:repo:billing', kind: 'SERVICE', label: 'billing-service repo', url: null }, { id: 'ari:jira:A-1', kind: 'ISSUE', label: 'x', url: null, jiraIssueKey: 'A-1' }],
      relations: [{ fromId: 'ari:repo:billing', toId: 'ari:jira:A-1', relationType: 'depends_on', observedAt: '2026-11-02T00:00:00.000Z' }]
    })));
    const before = sim(base); const after = sim(g);
    expect(after.summary.impacted).toBe(before.summary.impacted + 1);
    expect(after.impacts.find((i) => i.nodeId === 'twg:ari:repo:billing')?.weakestStatus).toBe('INFERRED');
  });
  it('documentary relations never propagate impact; unknown relation types are ignored', () => {
    const g = mergeSource(base, res({
      objects: [{ id: 'ari:page:1', kind: 'DOCUMENT', label: 'Auth deprecation page', url: null }, { id: 'ari:jira:A-1', kind: 'ISSUE', label: 'x', url: null, jiraIssueKey: 'A-1' }],
      relations: [{ fromId: 'ari:jira:A-1', toId: 'ari:page:1', relationType: 'documented_in', observedAt: '2026-11-02T00:00:00.000Z' },
        { fromId: 'ari:page:1', toId: 'ari:jira:A-1', relationType: 'weird_new_type', observedAt: '2026-11-02T00:00:00.000Z' }]
    }));
    expect(g.edges.filter((e) => e.references[0]?.sourceSystem === 'TEAMWORK_GRAPH').map((e) => e.kind)).toEqual(['DOCUMENTED_IN']);
    expect(sim(g).summary.impacted).toBe(sim(base).summary.impacted);
  });
  it('dedupes by stable id only (never by name) and keeps the Jira CONFIRMED edge on overlap', () => {
    const g = mergeSource(base, res({
      objects: [{ id: 'ari:jira:A-2', kind: 'ISSUE', label: 'Checkout', url: null, jiraIssueKey: 'A-2' }, { id: 'ari:jira:A-1', kind: 'ISSUE', label: 'x', url: null, jiraIssueKey: 'A-1' },
        { id: 'ari:other', kind: 'SERVICE', label: 'Checkout', url: null }],
      relations: [{ fromId: 'ari:jira:A-2', toId: 'ari:jira:A-1', relationType: 'depends_on', observedAt: '2026-11-02T00:00:00.000Z' }]
    }));
    expect(g.nodes.map((n) => n.id)).toEqual(['issue:A-1', 'issue:A-2', 'twg:ari:other']); // same label, different id → separate
    expect(g.edges.filter((e) => e.from === 'issue:A-2' && e.to === 'issue:A-1')).toHaveLength(1);
    expect(g.edges.find((e) => e.from === 'issue:A-2')!.status).toBe('CONFIRMED');
  });
  it('partial results are flagged access-limited and node growth is bounded', () => {
    const objects = Array.from({ length: 500 }, (_, i) => ({ id: `o${i}`, kind: 'SERVICE' as const, label: `o${i}`, url: null }));
    const g = mergeSource(base, res({ state: 'PARTIAL', objects }), 100);
    expect(g.nodes.length).toBe(102);
    expect(g.coverage?.at(-1)?.state).toBe('PARTIAL');
  });
});
