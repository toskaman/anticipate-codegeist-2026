/**
 * Development-only, READ-ONLY diagnostics web trigger. Verifies the real Jira response shapes the adapters rely on.
 * Never writes. Returns counts/shapes only (no issue text). Remove from the manifest before the jury release.
 */
import { createForgeJira, useAppActorForDiagnostics } from './forge-adapters';
import { extractGraph } from './jira/extractor';

export async function diagnostics(req?: { queryParameters?: Record<string, string[]> }): Promise<{ statusCode: number; headers: Record<string, string[]>; body: string }> {
  useAppActorForDiagnostics();
  const jira = createForgeJira(null);
  const out: Record<string, unknown> = { at: new Date().toISOString() };
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = { ok: true, value: await fn() }; } catch (e) { out[name] = { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e) }; }
  };
  const qp = (k: string) => req?.queryParameters?.[k]?.[0];
  const project = qp('project'); const key = qp('key');
  let firstKey: string | null = key && /^[A-Z][A-Z0-9_]+-[0-9]+$/.test(key) ? key : null;
  let projectKey: string | null = project && /^[A-Z][A-Z0-9_]+$/.test(project) ? project : null;
  await step('projects', async () => { const r = await jira.searchProjects(0, 50); projectKey = projectKey ?? r.items[0]?.key ?? null; return { count: r.items.length, keys: r.items.map((p) => p.key), isLast: r.isLast, issueCounts: r.items.map((p) => p.issueCount) }; });
  await step('searchJql', async () => { const r = await jira.searchIssues(projectKey ? `project = ${projectKey} AND issueLinkType is not EMPTY ORDER BY updated DESC` : 'ORDER BY updated DESC', null, 10); firstKey = firstKey ?? r.items[0]?.key ?? null;
    return { count: r.items.length, keys: r.items.map((i) => i.key), linkCounts: r.items.map((i) => i.links.length), hasNext: !!r.nextPageToken, sampleUpdated: r.items[0]?.updated }; });
  await step('changeCandidates', async () => (await jira.searchIssues('labels = "anticipate-change" ORDER BY updated DESC', null, 10)).items.map((i) => i.key));
  await step('issue', async () => { if (!firstKey) return null; const r = await jira.getIssue(firstKey); return r.kind === 'ok' ? { key: r.issue.key, links: r.issue.links.map((l) => `${l.typeName}/${l.direction}`), components: r.issue.components.length } : r.kind; });
  await step('permissions', async () => (projectKey ? jira.myPermissions(projectKey, ['BROWSE_PROJECTS', 'CREATE_ISSUES', 'LINK_ISSUES', 'ADD_COMMENTS', 'EDIT_ISSUES']) : null));
  await step('issueTypes', async () => (projectKey ? jira.issueTypes(projectKey) : null));
  await step('graph', async () => { if (!firstKey) return null; const g = await extractGraph(jira, firstKey, { maxDepth: 2, maxNodes: 60, snapshotId: 'diag', projectId: projectKey ?? 'x', now: new Date(), ttlHours: 1 });
    return { nodes: g.nodes.length, edges: g.edges.map((e) => `${e.kind}:${e.status}`), truncated: g.truncated }; });
  return { statusCode: 200, headers: { 'Content-Type': ['application/json'] }, body: JSON.stringify(out, null, 2) };
}
