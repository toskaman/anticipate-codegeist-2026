/** Live Forge implementations of the ports. All Jira calls run asUser() so Jira enforces the caller's permissions. */
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { AppError } from './core/errors';
import type { IssueFetch, JiraIssue, JiraPort, Store } from './core/ports';

const FIELDS = 'summary,status,issuetype,issuelinks,components,project,labels,updated';

let actor: 'user' | 'app' = 'user';
/** Diagnostics only: read-only checks run as the app (no end-user in a web trigger). */
export function useAppActorForDiagnostics() { actor = 'app'; }

async function call(path: ReturnType<typeof route>, init?: { method?: string; body?: unknown }): Promise<Response> {
  const res = await (actor === 'app' ? api.asApp() : api.asUser()).requestJira(path, {
    method: init?.method ?? 'GET',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined
  });
  if (res.status === 429) throw new AppError('RATE_LIMITED', 'Jira rate limit reached; try again shortly.', true);
  if (res.status === 401) throw new AppError('PERMISSION_DENIED', 'Jira access not authorized for this user (consent may be required).');
  return res as unknown as Response;
}
async function json<T>(res: Response, what: string): Promise<T> {
  if (res.status === 403) throw new AppError('PERMISSION_DENIED', `Jira denied: ${what}.`);
  if (res.status === 404) throw new AppError('NOT_FOUND', `Jira: ${what} not found.`);
  if (!res.ok) throw new AppError('UPSTREAM_UNAVAILABLE', `Jira ${what} failed (HTTP ${res.status}).`, res.status >= 500);
  const text = res.status === 204 ? '' : await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

interface RawIssue { id: string; key: string; fields: {
  summary?: string; status?: { name?: string }; issuetype?: { name?: string }; project?: { id?: string; key?: string }; updated?: string; labels?: string[];
  components?: { id: string; name: string }[];
  issuelinks?: { id: string; type: { name: string; inward: string; outward: string }; inwardIssue?: { key: string }; outwardIssue?: { key: string } }[];
} }

export function mapIssue(r: RawIssue): JiraIssue {
  const f = r.fields ?? {};
  return {
    id: r.id, key: r.key, summary: f.summary ?? '', status: f.status?.name ?? 'Unknown', issueType: f.issuetype?.name ?? 'Unknown',
    projectId: f.project?.id ?? '', projectKey: f.project?.key ?? r.key.split('-')[0]!, updated: f.updated ?? new Date(0).toISOString(),
    labels: f.labels ?? [], components: (f.components ?? []).map((c) => ({ id: c.id, name: c.name })),
    links: (f.issuelinks ?? []).flatMap((l): JiraIssue['links'] => {
      const base = { id: l.id, typeName: l.type.name, outward: l.type.outward, inward: l.type.inward };
      // On issue A, `outwardIssue: B` reads as "A <outward phrase> B" (e.g. A blocks B).
      if (l.outwardIssue) return [{ ...base, direction: 'outward' as const, otherKey: l.outwardIssue.key }];
      if (l.inwardIssue) return [{ ...base, direction: 'inward' as const, otherKey: l.inwardIssue.key }];
      return [];
    })
  };
}

export function createForgeJira(siteUrl: string | null): JiraPort {
  return {
    siteUrl: () => siteUrl,
    async searchProjects(startAt, max) {
      const r = await json<{ values: { id: string; key: string; name: string; insight?: { totalIssueCount?: number } }[]; isLast: boolean }>(
        await call(route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${max}&expand=insight`), 'project search');
      return { items: r.values.map((p) => ({ id: p.id, key: p.key, name: p.name, issueCount: p.insight?.totalIssueCount ?? null })), isLast: r.isLast };
    },
    async searchIssues(jql, nextPageToken, max) {
      const r = await json<{ issues: RawIssue[]; nextPageToken?: string }>(
        await call(route`/rest/api/3/search/jql`, { method: 'POST', body: { jql, maxResults: max, fields: FIELDS.split(','), ...(nextPageToken ? { nextPageToken } : {}) } }), 'issue search');
      return { items: r.issues.map(mapIssue), nextPageToken: r.nextPageToken ?? null };
    },
    async getIssue(key): Promise<IssueFetch> {
      const res = await call(route`/rest/api/3/issue/${key}?fields=${FIELDS}`);
      if (res.status === 403) return { kind: 'forbidden' };
      if (res.status === 404) return { kind: 'not_found' };
      return { kind: 'ok', issue: mapIssue(await json<RawIssue>(res, `issue ${key}`)) };
    },
    async myPermissions(projectKey, permissions) {
      const r = await json<{ permissions: Record<string, { havePermission: boolean }> }>(
        await call(route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=${permissions.join(',')}`), 'permission check');
      return Object.fromEntries(permissions.map((p) => [p, !!r.permissions[p]?.havePermission]));
    },
    async createIssue(i) {
      return json<{ key: string }>(await call(route`/rest/api/3/issue`, { method: 'POST', body: { fields: {
        project: { key: i.projectKey }, summary: i.summary, issuetype: { name: i.issueType }, labels: i.labels, description: adf(i.description) } } }), 'create issue');
    },
    async createLink(i) {
      await json(await call(route`/rest/api/3/issueLink`, { method: 'POST', body: { type: { name: i.typeName },
        // Verified on a real site (2026-11-02): POST /issueLink reads as "<inwardIssue> <outward phrase> <outwardIssue>",
        // e.g. inwardIssue A + outwardIssue B with type Blocks ⇒ "A blocks B". Our port's `outwardKey` is the subject.
        inwardIssue: { key: i.outwardKey }, outwardIssue: { key: i.inwardKey } } }), 'create link');
    },
    async deleteLink(linkId) {
      await json(await call(route`/rest/api/3/issueLink/${linkId}`, { method: 'DELETE' }), 'delete link');
    },
    async addComment(key, text) { await json(await call(route`/rest/api/3/issue/${key}/comment`, { method: 'POST', body: { body: adf(text) } }), 'add comment'); },
    async getCommentsText(key) {
      const r = await json<{ comments: { body: unknown }[] }>(await call(route`/rest/api/3/issue/${key}/comment?maxResults=100&orderBy=-created`), 'read comments');
      return r.comments.map((c) => JSON.stringify(c.body));
    },
    async addLabel(key, label) { await json(await call(route`/rest/api/3/issue/${key}`, { method: 'PUT', body: { update: { labels: [{ add: label }] } } }), 'add label'); },
    async issueTypes(projectKey) {
      const r = await json<{ issueTypes?: { name: string; subtask?: boolean }[] }>(await call(route`/rest/api/3/project/${projectKey}`), 'project');
      return (r.issueTypes ?? []).filter((t) => !t.subtask).map((t) => t.name);
    }
  };
}

/** Plain text → Atlassian Document Format (each line a paragraph). Text is never interpreted as markup. */
export function adf(text: string) {
  return { type: 'doc', version: 1, content: text.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) };
}

export const forgeStore: Store = {
  get: (k) => kvs.get(k),
  set: (k, v) => kvs.set(k, v),
  async setIfAbsent(k, v) {
    try { await kvs.set(k, v, { keyPolicy: 'FAIL_IF_EXISTS' }); return true; }
    catch (e) { if ((await kvs.get(k)) !== undefined) return false; throw e; }
  },
  delete: (k) => kvs.delete(k)
};
