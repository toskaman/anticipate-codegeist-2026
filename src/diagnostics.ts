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

/**
 * Development-only demo seeding web trigger (owner-authorized). Creates the judge demo dataset described in
 * docs/demo/JIRA_DEMO_SETUP.md in an existing project (?project=KEY). Idempotent: reuses issues carrying the
 * `anticipate-demo-seed` label + a per-role label. Remove from the manifest before the jury release.
 */
export async function seedDemo(req?: { queryParameters?: Record<string, string[]> }): Promise<{ statusCode: number; headers: Record<string, string[]>; body: string }> {
  useAppActorForDiagnostics();
  const jira = createForgeJira(null);
  const project = req?.queryParameters?.project?.[0];
  const json = (statusCode: number, o: unknown) => ({ statusCode, headers: { 'Content-Type': ['application/json'] }, body: JSON.stringify(o, null, 2) });
  if (!project || !/^[A-Z][A-Z0-9_]+$/.test(project)) return json(400, { error: 'project=KEY required' });
  const roles: { role: string; summary: string; change?: boolean }[] = [
    { role: 'api', summary: 'Legacy Auth API v1', change: true },
    { role: 'checkout', summary: 'Checkout service' },
    { role: 'mobile', summary: 'Mobile backend' },
    { role: 'webhooks', summary: 'Partner webhooks' },
    { role: 'v2', summary: 'Auth API v2' },
    { role: 'test', summary: 'Checkout auth contract test' }
  ];
  try {
    const types = await jira.issueTypes(project);
    const type = types.find((t) => t === 'Task') ?? types.find((t) => !/epic|sub/i.test(t)) ?? types[0];
    if (!type) return json(400, { error: 'no issue type' });
    const keys: Record<string, string> = {};
    for (const r of roles) {
      const label = `anticipate-demo-${r.role}`;
      const found = await jira.searchIssues(`project = ${project} AND labels = "${label}"`, null, 1);
      keys[r.role] = found.items[0]?.key ?? (await jira.createIssue({ projectKey: project, summary: `[ANTICIPATE demo] ${r.summary}`,
        description: 'Demo data for ANTICIPATE (Codegeist 2026). Safe to delete.', issueType: type,
        labels: ['anticipate-demo-seed', label, ...(r.change ? ['anticipate-change'] : [])] })).key;
    }
    const want: [string, string][] = [['api', 'checkout'], ['api', 'mobile'], ['checkout', 'webhooks']];
    const fixed: string[] = [];
    for (const [blocker, blocked] of want) {
      const cur = await jira.getIssue(keys[blocker]!);
      const links = cur.kind === 'ok' ? cur.issue.links.filter((l) => l.otherKey === keys[blocked] && l.typeName === 'Blocks') : [];
      for (const l of links.filter((l) => l.direction !== 'outward')) { await jira.deleteLink?.(l.id); fixed.push(l.id); } // wrong direction from earlier seed
      if (!links.some((l) => l.direction === 'outward')) await jira.createLink({ typeName: 'Blocks', outwardKey: keys[blocker]!, inwardKey: keys[blocked]! });
    }
    for (const [a, b] of [['checkout', 'test'], ['api', 'v2']] as const) {
      const t = await jira.getIssue(keys[a]!);
      if (!(t.kind === 'ok' && t.issue.links.some((l) => l.otherKey === keys[b]))) await jira.createLink({ typeName: 'Relates', outwardKey: keys[a]!, inwardKey: keys[b]! });
    }
    const verify = await jira.getIssue(keys.api!);
    const check = verify.kind === 'ok' ? verify.issue.links.map((l) => `${l.typeName}/${l.direction}/${l.otherKey}`) : [];
    return json(200, { project, issueType: type, keys, removedWrongLinks: fixed, apiLinks: check });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message.slice(0, 300) : String(e) });
  }
}
