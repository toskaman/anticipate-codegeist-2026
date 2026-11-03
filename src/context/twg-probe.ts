/**
 * EXPERIMENT (branch exp/teamwork-graph, development only). Read-only Teamwork Graph probe exposed as an MCP/Rovo action.
 * Runs asUser: Teamwork Graph only returns objects the invoking user can see. Queries are fixed strings (no user text in
 * Cypher); the issue key is validated and only passed as a parameter. Nothing here feeds the simulation or writes Jira.
 */
import api, { route } from '@forge/api';
import { GRAPHQL, TWG_RELATIONS } from './twg';

const PROBES: Record<string, string> = {
  node: 'MATCH (item:JiraWorkItem {ari: $id}) RETURN item LIMIT 1',
  ...Object.fromEntries(Object.keys(TWG_RELATIONS).map((r) => [r, `MATCH (item:JiraWorkItem {ari: $id})-[:${r}]->(other) RETURN other LIMIT 20`]))
};

export async function twgProbe(payload: { issueKey?: string }) {
  const key = String(payload?.issueKey ?? '').toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/.test(key)) return 'Invalid issue key.';
  const lines: string[] = [`Teamwork Graph probe for ${key} (experimental, read-only, as the invoking user).`];
  const t = await api.asUser().requestJira(route`/_edge/tenant_info`);
  const cloudId = t.ok ? ((await t.json()) as { cloudId?: string }).cloudId : undefined;
  const i = await api.asUser().requestJira(route`/rest/api/3/issue/${key}?fields=summary`);
  if (!cloudId || !i.ok) return `${lines[0]}\nCannot resolve the issue (tenant ${t.status}, issue ${i.status}). Teamwork Graph state: UNAVAILABLE.`;
  const issueId = ((await i.json()) as { id: string }).id;
  const ari = `ari:cloud:jira:${cloudId}:issue/${issueId}`;
  lines.push(`ARI: ${ari}`);
  for (const [name, cypher] of Object.entries(PROBES)) {
    try {
      const r = await api.asUser().requestTeamworkGraph(GRAPHQL, { cypherQuery: cypher, params: { id: ari } });
      const body = await r.text();
      let rows = '?';
      try { const j = JSON.parse(body) as { data?: { cypherQuery?: { edges?: unknown[] } }; errors?: { message?: string }[] };
        rows = j.errors?.length ? `errors: ${j.errors.map((e) => e.message).join(' | ').slice(0, 300)}` : `rows: ${j.data?.cypherQuery?.edges?.length ?? 0}`; } catch { rows = body.slice(0, 200); }
      lines.push(`- ${name}: HTTP ${r.status}, ${rows}`);
      if (r.ok && /rows: [1-9]/.test(rows)) lines.push(`  sample: ${body.slice(0, 600)}`);
    } catch (e) {
      lines.push(`- ${name}: exception ${e instanceof Error ? e.message.slice(0, 200) : 'error'}`);
    }
  }
  return lines.join('\n');
}
