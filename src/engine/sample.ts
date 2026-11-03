/**
 * Judge sample project: a small, explicitly approved dataset that makes ANTICIPATE demonstrable on a blank site.
 * Runs asUser. Preview is read-only; creation requires `confirm: true`, is idempotent (role labels), never touches
 * issues it did not create, and verifies every write by re-reading Jira. No delete function is provided on purpose.
 */
import type { SampleProjectPlan } from '../../packages/contracts/src/index';
import { AppError } from '../core/errors';
import type { JiraPort } from '../core/ports';
import { CRAWL_FETCH_CONCURRENCY, createIssueCache, fetchIssues, mapWithConcurrency } from '../jira/extractor';

const ROLES = [
  { role: 'api', summary: 'Legacy Auth API v1 (sample)', change: true, dueInDays: 7 },
  { role: 'checkout', summary: 'Checkout service (sample consumer)', dueInDays: 14 },
  { role: 'mobile', summary: 'Mobile backend (sample consumer)', dueInDays: 14 },
  { role: 'webhooks', summary: 'Partner webhooks (sample, transitive)', dueInDays: 21 },
  { role: 'v2', summary: 'Auth API v2 (sample replacement)', dueInDays: 7 },
  { role: 'test', summary: 'Checkout auth contract test (sample)', dueInDays: 21 }
] as const;
const LINKS: [string, string][] = [['api', 'checkout'], ['api', 'mobile'], ['checkout', 'webhooks'], ['api', 'v2']];
const label = (role: string) => `anticipate-sample-${role}`;
const NEEDED = ['BROWSE_PROJECTS', 'CREATE_ISSUES', 'LINK_ISSUES'];
const dueDateFor = (days: number, now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)).toISOString().slice(0, 10);

async function inspect(jira: JiraPort, projectKey: string, now: Date): Promise<SampleProjectPlan & { keys: Record<string, string | null> }> {
  const perms = await jira.myPermissions(projectKey, [...NEEDED, 'SCHEDULE_ISSUES']);
  const missing = NEEDED.filter((p) => !perms[p]);
  const types = await jira.issueTypes(projectKey);
  const issueType = types.find((t) => t === 'Task') ?? types.find((t) => !/epic|sub/i.test(t)) ?? null;
  const keys: Record<string, string | null> = {};
  const found = await mapWithConcurrency(ROLES, CRAWL_FETCH_CONCURRENCY,
    (r) => jira.searchIssues(`project = ${projectKey} AND labels = "${label(r.role)}"`, null, 1));
  ROLES.forEach((r, i) => { keys[r.role] = found[i]?.items[0]?.key ?? null; });
  // Jira requires Schedule Issues to set duedate; reusing all six existing issues needs no new dates.
  if (ROLES.some((r) => !keys[r.role]) && !perms.SCHEDULE_ISSUES) missing.push('SCHEDULE_ISSUES');
  // One fetch per distinct link source; repeated roles (api x3) hit the run cache.
  const cache = createIssueCache();
  await fetchIssues(jira, [...new Set(LINKS.filter(([a, b]) => keys[a] && keys[b]).map(([a]) => keys[a] as string))], cache);
  const links = [];
  for (const [a, b] of LINKS) {
    let exists = false;
    if (keys[a] && keys[b]) { const cur = cache.get(keys[a] as string)!; exists = cur.kind === 'ok' && cur.issue.links.some((l) => l.otherKey === keys[b] && (b === 'v2' ? true : l.typeName === 'Blocks' && l.direction === 'outward')); }
    links.push({ from: keys[a] ?? a, relation: 'blocks' as const, to: keys[b] ?? b, status: exists ? 'EXISTS' as const : 'TO_CREATE' as const });
  }
  return {
    projectKey, issueType, canCreate: !missing.length && !!issueType, missingPermissions: missing, keys,
    items: ROLES.map((r, i) => ({ role: r.role, summary: r.summary, issueKey: keys[r.role] ?? null, status: keys[r.role] ? 'EXISTS' as const : 'TO_CREATE' as const,
      dueDate: keys[r.role] ? found[i]?.items[0]?.due ?? null : dueDateFor(r.dueInDays, now) })),
    links, rootIssueKey: keys.api ?? null, replacementIssueKey: keys.v2 ?? null,
    note: 'Creates up to 6 labelled issues with due dates 7, 14 or 21 days after the UTC creation day, and 4 links in this project only. New issues need Schedule Issues permission and the Due date field on the Jira create screen. Existing issues and their due dates are never modified. Labels: anticipate-sample-*.'
  };
}

export async function previewSample(jira: JiraPort, projectKey: string, now: Date): Promise<SampleProjectPlan> {
  const { keys: _k, ...plan } = await inspect(jira, projectKey, now);
  return plan;
}

export async function createSample(jira: JiraPort, projectKey: string, now: Date): Promise<SampleProjectPlan> {
  const before = await inspect(jira, projectKey, now);
  if (!before.canCreate) throw new AppError('PERMISSION_DENIED', `Cannot create the sample project: missing ${before.missingPermissions.join(', ') || 'a usable issue type'}.`);
  const keys = { ...before.keys };
  const status: Record<string, 'EXISTS' | 'CREATED' | 'FAILED'> = {};
  for (const r of ROLES) {
    if (keys[r.role]) { status[r.role] = 'EXISTS'; continue; }
    try {
      keys[r.role] = (await jira.createIssue({ projectKey, summary: `[ANTICIPATE sample] ${r.summary}`, issueType: before.issueType!,
        description: 'Sample data created on request by ANTICIPATE for a demonstration. Safe to delete.',
        labels: ['anticipate-sample', label(r.role), ...('change' in r && r.change ? ['anticipate-change'] : [])], dueDate: dueDateFor(r.dueInDays, now) })).key;
      status[r.role] = 'CREATED';
    } catch (e) { status[r.role] = 'FAILED'; console.warn(JSON.stringify({ app: 'anticipate', op: 'sampleCreateIssue', role: r.role, error: String((e as Error)?.message ?? e).slice(0, 500) })); }
  }
  const linkStatus: ('EXISTS' | 'CREATED' | 'FAILED')[] = [];
  for (const [i, [a, b]] of LINKS.entries()) {
    if (before.links[i]!.status === 'EXISTS') { linkStatus.push('EXISTS'); continue; }
    if (!keys[a] || !keys[b]) { linkStatus.push('FAILED'); continue; }
    try { await jira.createLink({ typeName: a === 'api' && b === 'v2' ? 'Relates' : 'Blocks', outwardKey: keys[a]!, inwardKey: keys[b]! }); linkStatus.push('CREATED'); }
    catch (e) { linkStatus.push('FAILED'); console.warn(JSON.stringify({ app: 'anticipate', op: 'sampleCreateLink', error: String((e as Error)?.message ?? e).slice(0, 500) })); }
  }
  // Verify by re-reading Jira; report what is actually there.
  const { keys: _after, ...after } = await inspect(jira, projectKey, now);
  return {
    ...after,
    items: after.items.map((it) => ({ ...it, status: !it.issueKey ? 'FAILED' as const : status[it.role] === 'CREATED' ? 'CREATED' as const : 'EXISTS' as const })),
    links: after.links.map((l, i) => ({ ...l, status: l.status !== 'EXISTS' ? 'FAILED' as const : linkStatus[i] === 'CREATED' ? 'CREATED' as const : 'EXISTS' as const }))
  };
}
