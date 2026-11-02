/**
 * Context Intelligence Engine — additional evidence sources beyond Jira links.
 * Rules (never violated):
 *  - LIVE never simulates a source: if a source is unavailable, coverage says so and Jira-only evidence stands.
 *  - Objects are merged ONLY by stable identifiers (Jira issue key / ARI), never by name similarity.
 *  - Only allowlisted causal relation types become DEPENDS_ON; everything else is documentary (DOCUMENTED_IN / AFFECTS)
 *    and therefore never changes impact propagation.
 *  - A failing source can never turn a verdict into PASS: it can only add evidence, and its failure is reported.
 */
import type { EdgeKind, EvidenceStatus, GraphSnapshot, NodeKind } from '../../packages/contracts/src/index';

export interface ExternalObject { id: string; kind: NodeKind; label: string; url: string | null; jiraIssueKey?: string | null; }
export interface ExternalRelation { fromId: string; toId: string; relationType: string; observedAt: string; }
export interface SourceResult {
  state: 'FULL' | 'PARTIAL' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
  detail: string;
  objects: ExternalObject[];
  relations: ExternalRelation[];
}
export interface ContextSource { name: 'TEAMWORK_GRAPH'; fetch(issueKeys: string[]): Promise<SourceResult>; }

/** Relation types we accept as causal dependencies (must be verified against the TWG relationship catalogue). */
const CAUSAL: Record<string, EdgeKind> = { depends_on: 'DEPENDS_ON', uses: 'USES' };
const DOCUMENTARY: Record<string, EdgeKind> = { documented_in: 'DOCUMENTED_IN', links_to: 'AFFECTS', mentions: 'AFFECTS' };

const nodeIdFor = (o: ExternalObject) => (o.jiraIssueKey ? `issue:${o.jiraIssueKey}` : `twg:${o.id}`);

export function mergeSource(snapshot: GraphSnapshot, res: SourceResult, maxExtraNodes = 100): GraphSnapshot {
  const coverage = [...(snapshot.coverage ?? [{ source: 'JIRA' as const, state: 'FULL' as const, detail: 'Jira issue links and components' }]),
    { source: 'TEAMWORK_GRAPH' as const, state: res.state, detail: res.detail.slice(0, 300) }];
  if (res.state === 'UNAVAILABLE' || res.state === 'NOT_CONFIGURED') return { ...snapshot, coverage };
  const nodes = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const byExt = new Map(res.objects.map((o) => [o.id, o]));
  let added = 0;
  for (const o of res.objects) {
    const id = nodeIdFor(o);
    if (nodes.has(id)) continue; // same stable identifier → same object; never merge by name
    if (added >= maxExtraNodes) break;
    nodes.set(id, { id, kind: o.kind, label: o.label.slice(0, 500), status: 'CONFIRMED', attributes: { source: 'TEAMWORK_GRAPH' },
      references: [{ sourceSystem: 'TEAMWORK_GRAPH', sourceId: o.id, url: o.url, extractor: 'twg.object', observedAt: snapshot.createdAt }] });
    added++;
  }
  const edges = new Map(snapshot.edges.map((e) => [`${e.from}|${e.kind}|${e.to}`, e]));
  for (const r of res.relations) {
    const a = byExt.get(r.fromId); const b = byExt.get(r.toId);
    if (!a || !b) continue;
    const from = nodeIdFor(a); const to = nodeIdFor(b);
    if (!nodes.has(from) || !nodes.has(to)) continue;
    const t = r.relationType.toLowerCase();
    const kind = CAUSAL[t] ?? DOCUMENTARY[t];
    if (!kind) continue; // unknown relation types are ignored, not guessed
    const status: EvidenceStatus = CAUSAL[t] ? 'INFERRED' : 'INFERRED'; // external relations are never auto-CONFIRMED
    const k = `${from}|${kind}|${to}`;
    if (edges.has(k)) continue; // Jira already states it; keep the Jira (CONFIRMED) version
    edges.set(k, { id: `twg:${r.fromId}:${t}:${r.toId}`.slice(0, 200), from, to, kind, status, accessLimited: res.state === 'PARTIAL',
      references: [{ sourceSystem: 'TEAMWORK_GRAPH', sourceId: `${r.fromId}->${r.toId}`.slice(0, 200), url: null, extractor: `twg.${t}`, observedAt: r.observedAt }] });
  }
  return { ...snapshot, coverage, nodes: [...nodes.values()].sort((x, y) => x.id.localeCompare(y.id)), edges: [...edges.values()].sort((x, y) => x.id.localeCompare(y.id)) };
}

/** Default source when Teamwork Graph is not allowlisted / not configured: honest, no data. */
export const notConfiguredTwg: ContextSource = {
  name: 'TEAMWORK_GRAPH',
  async fetch() { return { state: 'NOT_CONFIGURED', detail: 'Teamwork Graph access pending Atlassian allowlisting of this app.', objects: [], relations: [] }; }
};
