/**
 * Judge sample project: a small, explicitly approved dataset that makes ANTICIPATE demonstrable on a blank site.
 * Runs asUser. Preview is read-only; creation requires `confirm: true`, is idempotent (role labels), never touches
 * issues it did not create, and verifies every write by re-reading Jira. No delete function is provided on purpose.
 */
import type { SampleProjectPlan } from '../../packages/contracts/src/index';
import { AppError } from '../core/errors';
import type { JiraPort } from '../core/ports';

const ROLES = [
  { role: 'api', summary: 'Legacy Auth API v1 (sample)', change: true },
  { role: 'checkout', summary: 'Checkout service (sample consumer)' },
  { role: 'mobile', summary: 'Mobile backend (sample consumer)' },
  { role: 'webhooks', summary: 'Partner webhooks (sample, transitive)' },
  { role: 'v2', summary: 'Auth API v2 (sample replacement)' },
  { role: 'test', summary: 'Checkout auth contract test (sample)' }
] as const;
const LINKS: [string, string][] = [['api', 'checkout'], ['api', 'mobile'], ['checkout', 'webhooks'], ['api', 'v2']];
const label = (role: string) => `anticipate-sample-${role}`;
const NEEDED = ['BROWSE_PROJECTS', 'CREATE_ISSUES', 'LINK_ISSUES'];

async function inspect(jira: JiraPort, projectKey: string): Promise<SampleProjectPlan & { keys: Record<string, string | null> }> {
  const perms = await jira.myPermissions(projectKey, NEEDED);
  const missing = NEEDED.filter((p) => !perms[p]);
  const types = await jira.issueTypes(projectKey);
  const issueType = types.find((t) => t === 'Task') ?? types.find((t) => !/epic|sub/i.test(t)) ?? null;
  const keys: Record<string, string | null> = {};
  for (const r of ROLES) keys[r.role] = (await jira.searchIssues(`project = ${projectKey} AND labels = "${label(r.role)}"`, null, 1)).items[0]?.key ?? null;
  const links = [];
  for (const [a, b] of LINKS) {
    let exists = false;
    if (keys[a] && keys[b]) { const cur = await jira.getIssue(keys[a]!); exists = cur.kind === 'ok' && cur.issue.links.some((l) => l.otherKey === keys[b] && (b === 'v2' ? true : l.typeName === 'Blocks' && l.direction === 'outward')); }
    links.push({ from: keys[a] ?? a, relation: 'blocks' as const, to: keys[b] ?? b, status: exists ? 'EXISTS' as const : 'TO_CREATE' as const });
  }
  return {
    projectKey, issueType, canCreate: !missing.length && !!issueType, missingPermissions: missing, keys,
    items: ROLES.map((r) => ({ role: r.role, summary: r.summary, issueKey: keys[r.role] ?? null, status: keys[r.role] ? 'EXISTS' as const : 'TO_CREATE' as const })),
    links, rootIssueKey: keys.api ?? null, replacementIssueKey: keys.v2 ?? null,
    note: 'Creates up to 6 labelled issues and 4 "Blocks" links in this project only. Existing issues are never modified. Labels: anticipate-sample-*.'
  };
}

export async function previewSample(jira: JiraPort, projectKey: string): Promise<SampleProjectPlan> {
  const { keys: _k, ...plan } = await inspect(jira, projectKey);
  return plan;
}

export async function createSample(jira: JiraPort, projectKey: string): Promise<SampleProjectPlan> {
  const before = await inspect(jira, projectKey);
  if (!before.canCreate) throw new AppError('PERMISSION_DENIED', `Cannot create the sample project: missing ${before.missingPermissions.join(', ') || 'a usable issue type'}.`);
  const keys = { ...before.keys };
  const status: Record<string, 'EXISTS' | 'CREATED' | 'FAILED'> = {};
  for (const r of ROLES) {
    if (keys[r.role]) { status[r.role] = 'EXISTS'; continue; }
    try {
      keys[r.role] = (await jira.createIssue({ projectKey, summary: `[ANTICIPATE sample] ${r.summary}`, issueType: before.issueType!,
        description: 'Sample data created on request by ANTICIPATE for a demonstration. Safe to delete.',
        labels: ['anticipate-sample', label(r.role), ...('change' in r && r.change ? ['anticipate-change'] : [])] })).key;
      status[r.role] = 'CREATED';
    } catch { status[r.role] = 'FAILED'; }
  }
  const linkStatus: ('EXISTS' | 'CREATED' | 'FAILED')[] = [];
  for (const [i, [a, b]] of LINKS.entries()) {
    if (before.links[i]!.status === 'EXISTS') { linkStatus.push('EXISTS'); continue; }
    if (!keys[a] || !keys[b]) { linkStatus.push('FAILED'); continue; }
    try { await jira.createLink({ typeName: a === 'api' && b === 'v2' ? 'Relates' : 'Blocks', outwardKey: keys[a]!, inwardKey: keys[b]! }); linkStatus.push('CREATED'); }
    catch { linkStatus.push('FAILED'); }
  }
  // Verify by re-reading Jira; report what is actually there.
  const { keys: _after, ...after } = await inspect(jira, projectKey);
  return {
    ...after,
    items: after.items.map((it) => ({ ...it, status: !it.issueKey ? 'FAILED' as const : status[it.role] === 'CREATED' ? 'CREATED' as const : 'EXISTS' as const })),
    links: after.links.map((l, i) => ({ ...l, status: l.status !== 'EXISTS' ? 'FAILED' as const : linkStatus[i] === 'CREATED' ? 'CREATED' as const : 'EXISTS' as const }))
  };
}
