/**
 * Teamwork Graph source (PROTOTYPE, disabled by default).
 *
 * Status (8 Nov 2026): the Teamwork Graph API is in Forge Preview, needs NO allowlisting (Atlassian support ECOHELP-180616), and needs per-object `read:graph:*` scopes declared in manifest.yml (the EAP product-wide `read:graph:jira` is retired).
 * (e.g. read:graph:issue:jira, plus one scope per object type on every traversal hop) and enabled by the site admin.
 * ANTICIPATE does NOT declare these scopes yet: adding scopes is a major version that every installation must consent
 * to, so it is a release decision for the owners. Until then `teamworkGraphSource` is never wired and the snapshot
 * reports Teamwork Graph as NOT_CONFIGURED.
 *
 * Migration required before any wiring: the platform no longer accepts raw Cypher text at request time. The three fixed shapes in TWG_RELATIONS must move to persisted Cypher queries (one queryKey per relation, registered once via TWG Labs or the registration endpoint) or to curated queries where they match; the runtime then calls `customQuery` with key + params. See docs/evidence/TEAMWORK_GRAPH_PREVIEW_PLAN.md. These traversals need read:graph:issue:jira + read:graph:component:compass + read:graph:issue-remote-link:jira + read:graph:build:external.
 *
 * Design rules (enforced by mergeSource): objects are merged only by stable identifiers (issue keys / ARIs), every
 * external relation is INFERRED (never auto-CONFIRMED), unknown relation types are ignored, and a failing source is
 * reported as UNAVAILABLE instead of being read as "no risk".
 */
import type { ContextSource, ExternalObject, ExternalRelation, SourceResult } from './sources';

/** Relationship types we query, mapped to the relation vocabulary mergeSource understands. */
export const TWG_RELATIONS: Record<string, string> = {
  jira_work_item_impacts_compass_component: 'links_to',   // documentary: the change touches a component
  jira_work_item_links_external_build: 'links_to',        // documentary: build evidence
  jira_work_item_links_jira_work_item_remote_link: 'mentions'
};

export const MAX_KEYS = 50;
export const MAX_ROWS = 200;

export function cypherFor(relation: string): string {
  if (!/^[a-z_]+$/.test(relation) || !(relation in TWG_RELATIONS)) throw new Error('unsupported relation');
  return `MATCH (item:JiraWorkItem {ari: $id})-[:${relation}]->(other) RETURN other LIMIT ${MAX_ROWS}`;
}

export const GRAPHQL = `query AnticipateTwg($cypherQuery: String!, $params: CypherRequestParams) {
  cypherQuery(query: $cypherQuery, params: $params) { edges { node { columns { value { ... on CypherQueryResultNode { id data { __typename } } } } } } }
}`;

type Row = { node?: { columns?: { value?: { id?: string; data?: { __typename?: string } } }[] } };

/** Pure parser: turns one cypherQuery response into objects + relations from the given issue. */
export function parseRows(issueKey: string, issueAri: string, relation: string, body: unknown, observedAt: string): { objects: ExternalObject[]; relations: ExternalRelation[] } {
  const edges = ((body as { data?: { cypherQuery?: { edges?: Row[] } } })?.data?.cypherQuery?.edges ?? []).slice(0, MAX_ROWS);
  const objects: ExternalObject[] = [{ id: issueAri, kind: 'ISSUE', label: issueKey, url: null, jiraIssueKey: issueKey }];
  const relations: ExternalRelation[] = [];
  for (const e of edges) {
    const v = e.node?.columns?.[0]?.value;
    if (!v?.id || typeof v.id !== 'string') continue; // no stable identifier => ignored, never guessed
    const kind = v.data?.__typename === 'CompassComponent' ? 'COMPONENT' : v.data?.__typename === 'Build' ? 'RELEASE' : 'DOCUMENT';
    objects.push({ id: v.id, kind: kind as ExternalObject['kind'], label: v.id.slice(-80), url: null, jiraIssueKey: null });
    relations.push({ fromId: issueAri, toId: v.id, relationType: TWG_RELATIONS[relation]!, observedAt });
  }
  return { objects, relations };
}

export interface GraphPort { requestGraph(query: string, variables: unknown): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>; ariFor(issueKey: string): string | null; now(): string }

export function teamworkGraphSource(g: GraphPort): ContextSource {
  return {
    name: 'TEAMWORK_GRAPH',
    async fetch(issueKeys: string[]): Promise<SourceResult> {
      const keys = issueKeys.slice(0, MAX_KEYS);
      const objects: ExternalObject[] = []; const relations: ExternalRelation[] = [];
      let failed = 0; let calls = 0;
      for (const key of keys) {
        const ari = g.ariFor(key);
        if (!ari) { failed++; continue; }
        for (const rel of Object.keys(TWG_RELATIONS)) {
          calls++;
          try {
            const res = await g.requestGraph(GRAPHQL, { cypherQuery: cypherFor(rel), params: { id: ari } });
            if (!res.ok) { failed++; continue; }
            const p = parseRows(key, ari, rel, await res.json(), g.now());
            objects.push(...p.objects); relations.push(...p.relations);
          } catch { failed++; }
        }
      }
      const state = failed === 0 ? (issueKeys.length > MAX_KEYS ? 'PARTIAL' : 'FULL') : failed >= calls ? 'UNAVAILABLE' : 'PARTIAL';
      return { state, detail: `Teamwork Graph: ${relations.length} relation(s) from ${keys.length} issue(s); ${failed} failed request(s).`, objects, relations };
    }
  };
}
