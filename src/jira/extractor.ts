/**
 * Builds an evidence GraphSnapshot from real Jira data (issue links + components), as the requesting user.
 * Bounded BFS (depth, node count), cycle-safe. Unreadable issues stay UNKNOWN — never assumed safe.
 *
 * Link semantics (edge `from -> to`, "from depends on to" for propagating kinds):
 *  - "A blocks B"            -> B DEPENDS_ON A   (CONFIRMED, extractor jira.issuelink:blocks)
 *  - "A depends on B"        -> A DEPENDS_ON B   (CONFIRMED, link types whose name/outward mentions "depend")
 *  - "A uses/consumes B"     -> A USES B         (CONFIRMED, link types mentioning "use"/"consum")
 *  - "A is tested by B"      -> A VERIFIED_BY B  (CONFIRMED, link types mentioning "test")
 *  - "relates to" / other    -> A AFFECTS B      (INFERRED, non-propagating context only)
 *  - issue has component C   -> issue AFFECTS C  (CONFIRMED, extractor jira.component)
 */
import type { EdgeKind, EvidenceEdge, EvidenceNode, EvidenceStatus, GraphSnapshot } from '../../packages/contracts/src/index';
import type { JiraIssue, JiraPort } from '../core/ports';

export interface ExtractOptions { maxDepth: number; maxNodes: number; snapshotId: string; projectId: string; now: Date; ttlHours: number; }

type Classified = { kind: EdgeKind; status: EvidenceStatus; from: 'self' | 'other'; tag: string };

/** Classify a link as seen from `self`. Returns which side is the dependent ("from"). */
export function classifyLink(l: JiraIssue['links'][number]): Classified {
  const phrase = (l.direction === 'outward' ? l.outward : l.inward).toLowerCase();
  const type = l.typeName.toLowerCase();
  const out = l.direction === 'outward';
  if (type === 'blocks' || /\bblock/.test(phrase)) {
    // outward "blocks": self blocks other → other depends on self. inward "is blocked by": self depends on other.
    const selfBlocks = /is blocked by/.test(phrase) ? false : out;
    return { kind: 'DEPENDS_ON', status: 'CONFIRMED', from: selfBlocks ? 'other' : 'self', tag: 'jira.issuelink:blocks' };
  }
  const passive = /^(is |are )/.test(phrase) || / by$/.test(phrase);
  if (/depend/.test(type) || /depend/.test(phrase)) return { kind: 'DEPENDS_ON', status: 'CONFIRMED', from: passive ? 'other' : 'self', tag: 'jira.issuelink:depends' };
  if (/test|verif/.test(type) || /test|verif/.test(phrase)) return { kind: 'VERIFIED_BY', status: 'CONFIRMED', from: /(tested|verified) by/.test(phrase) ? 'self' : 'other', tag: 'jira.issuelink:tests' };
  if (/(\buse|consum)/.test(type) || /(\buse|consum)/.test(phrase)) return { kind: 'USES', status: 'CONFIRMED', from: passive ? 'other' : 'self', tag: 'jira.issuelink:uses' };
  return { kind: 'AFFECTS', status: 'INFERRED', from: 'self', tag: `jira.issuelink:${type}` };
}

export const issueNodeId = (key: string) => `issue:${key}`;
export const componentNodeId = (id: string) => `component:${id}`;

export async function extractGraph(jira: JiraPort, rootKey: string, o: ExtractOptions): Promise<GraphSnapshot> {
  const site = jira.siteUrl();
  const issueUrl = (k: string) => (site ? `${site.replace(/\/$/, '')}/browse/${encodeURIComponent(k)}` : null);
  const at = o.now.toISOString();
  const nodes = new Map<string, EvidenceNode>();
  const edges = new Map<string, EvidenceEdge>();
  const ref = (sourceId: string, extractor: string, url: string | null) => ({ sourceSystem: 'JIRA' as const, sourceId, url, extractor, observedAt: at });
  let truncated = false;

  const visited = new Set<string>();
  let frontier = [rootKey];
  for (let depth = 0; frontier.length && depth <= o.maxDepth; depth++) {
    const next: string[] = [];
    for (const key of frontier.sort()) {
      if (visited.has(key)) continue;
      if (nodes.size >= o.maxNodes) { truncated = true; break; }
      visited.add(key);
      const res = await jira.getIssue(key);
      const nid = issueNodeId(key);
      if (res.kind !== 'ok') {
        nodes.set(nid, { id: nid, kind: 'ISSUE', label: key, status: 'UNKNOWN', attributes: { access: res.kind }, references: [] });
        // Mark every edge touching this node as access-limited / UNKNOWN.
        for (const [id, e] of edges) if (e.from === nid || e.to === nid) edges.set(id, { ...e, status: 'UNKNOWN', accessLimited: true });
        continue;
      }
      const is = res.issue;
      const testLike = /test/i.test(is.issueType);
      nodes.set(nid, {
        id: nid, kind: testLike ? 'TEST' : 'ISSUE', label: `${is.key} ${is.summary}`.slice(0, 500), status: 'CONFIRMED',
        attributes: { status: is.status, statusCategory: is.statusCategory ?? null, issueType: is.issueType, projectKey: is.projectKey, updated: is.updated },
        references: [ref(is.key, 'jira.issue', issueUrl(is.key))]
      });
      for (const c of is.components) {
        const cid = componentNodeId(c.id);
        if (!nodes.has(cid)) nodes.set(cid, { id: cid, kind: 'COMPONENT', label: c.name, status: 'CONFIRMED', attributes: {}, references: [ref(`component:${c.id}`, 'jira.component', null)] });
        const eid = `aff:${is.key}:${c.id}`;
        edges.set(eid, { id: eid, from: nid, to: cid, kind: 'AFFECTS', status: 'CONFIRMED', references: [ref(is.key, 'jira.component', issueUrl(is.key))], accessLimited: false });
      }
      for (const l of is.links) {
        const c = classifyLink(l);
        const other = issueNodeId(l.otherKey);
        const [from, to] = c.from === 'self' ? [nid, other] : [other, nid];
        const eid = `link:${l.id}`;
        if (!edges.has(eid)) edges.set(eid, { id: eid, from, to, kind: c.kind, status: c.status, references: [ref(`issuelink:${l.id}`, c.tag, issueUrl(is.key))], accessLimited: false });
        if (!visited.has(l.otherKey)) {
          if (depth < o.maxDepth) next.push(l.otherKey);
          else { truncated = true; if (!nodes.has(other)) nodes.set(other, { id: other, kind: 'ISSUE', label: l.otherKey, status: 'UNKNOWN', attributes: { access: 'not_crawled' }, references: [] }); }
        }
      }
    }
    frontier = [...new Set(next)];
  }
  return {
    snapshotId: o.snapshotId, projectId: o.projectId, createdAt: at, expiresAt: new Date(o.now.getTime() + o.ttlHours * 3600_000).toISOString(),
    mode: 'LIVE', truncated, limits: { maxDepth: o.maxDepth, maxNodes: o.maxNodes },
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id))
  };
}
