/** Live Forge implementations of the ports. All Jira calls run asUser() so Jira enforces the caller's permissions. */
import api, { route } from '@forge/api';
import { kvs, WhereConditions } from '@forge/kvs';
import { AppError } from './core/errors';
import type { IssueFetch, JiraIssue, JiraPort, Store } from './core/ports';

const FIELDS = 'summary,status,issuetype,issuelinks,components,project,labels,updated,duedate,fixVersions';


async function call(actor: 'user' | 'app', path: ReturnType<typeof route>, init?: { method?: string; body?: unknown }): Promise<Response> {
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
  if (res.status === 400) { let detail = ''; try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ } throw new AppError('UPSTREAM_UNAVAILABLE', `Jira ${what} rejected (HTTP 400): ${detail}`, false); }
  if (!res.ok) throw new AppError('UPSTREAM_UNAVAILABLE', `Jira ${what} failed (HTTP ${res.status}).`, res.status >= 500);
  const text = res.status === 204 ? '' : await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

interface RawIssue { id: string; key: string; fields: {
  summary?: string; status?: { name?: string; statusCategory?: { key?: string } }; issuetype?: { name?: string }; project?: { id?: string; key?: string }; updated?: string; labels?: string[];
  components?: { id: string; name: string }[]; duedate?: string | null; fixVersions?: { name: string; releaseDate?: string }[];
  issuelinks?: { id: string; type: { name: string; inward: string; outward: string }; inwardIssue?: { key: string }; outwardIssue?: { key: string } }[];
} }

export function mapIssue(r: RawIssue): JiraIssue {
  const f = r.fields ?? {};
  return {
    id: r.id, key: r.key, summary: f.summary ?? '', status: f.status?.name ?? 'Unknown', statusCategory: f.status?.statusCategory?.key ?? null, issueType: f.issuetype?.name ?? 'Unknown',
    projectId: f.project?.id ?? '', projectKey: f.project?.key ?? r.key.split('-')[0]!, updated: f.updated ?? new Date(0).toISOString(),
    labels: f.labels ?? [], components: (f.components ?? []).map((c) => ({ id: c.id, name: c.name })),
    due: f.duedate ?? null, versions: (f.fixVersions ?? []).map((v) => ({ name: v.name, releaseDate: v.releaseDate ?? null })),
    links: (f.issuelinks ?? []).flatMap((l): JiraIssue['links'] => {
      const base = { id: l.id, typeName: l.type.name, outward: l.type.outward, inward: l.type.inward };
      // On issue A, `outwardIssue: B` reads as "A <outward phrase> B" (e.g. A blocks B).
      if (l.outwardIssue) return [{ ...base, direction: 'outward' as const, otherKey: l.outwardIssue.key }];
      if (l.inwardIssue) return [{ ...base, direction: 'inward' as const, otherKey: l.inwardIssue.key }];
      return [];
    })
  };
}

/** actor 'app' is used ONLY for the workflow validator's single label/decision lookup (no end-user context there). */
export function createForgeJira(siteUrl: string | null, actor: 'user' | 'app' = 'user'): JiraPort {
  const call2 = (p: ReturnType<typeof route>, i?: { method?: string; body?: unknown }) => call(actor, p, i);
  return {
    siteUrl: () => siteUrl,
    async searchProjects(startAt, max) {
      const r = await json<{ values: { id: string; key: string; name: string; insight?: { totalIssueCount?: number } }[]; isLast: boolean }>(
        await call2(route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${max}&expand=insight`), 'project search');
      return { items: r.values.map((p) => ({ id: p.id, key: p.key, name: p.name, issueCount: p.insight?.totalIssueCount ?? null })), isLast: r.isLast };
    },
    async searchIssues(jql, nextPageToken, max) {
      const r = await json<{ issues: RawIssue[]; nextPageToken?: string }>(
        await call2(route`/rest/api/3/search/jql`, { method: 'POST', body: { jql, maxResults: max, fields: FIELDS.split(','), ...(nextPageToken ? { nextPageToken } : {}) } }), 'issue search');
      return { items: r.issues.map(mapIssue), nextPageToken: r.nextPageToken ?? null };
    },
    async getIssue(key): Promise<IssueFetch> {
      const res = await call2(route`/rest/api/3/issue/${key}?fields=${FIELDS}`);
      if (res.status === 403) return { kind: 'forbidden' };
      if (res.status === 404) return { kind: 'not_found' };
      return { kind: 'ok', issue: mapIssue(await json<RawIssue>(res, `issue ${key}`)) };
    },
    async myPermissions(projectKey, permissions) {
      const r = await json<{ permissions: Record<string, { havePermission: boolean }> }>(
        await call2(route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=${permissions.join(',')}`), 'permission check');
      return Object.fromEntries(permissions.map((p) => [p, !!r.permissions[p]?.havePermission]));
    },
    async globalPermissions(permissions) {
      const r = await json<{ permissions: Record<string, { havePermission: boolean }> }>(
        await call2(route`/rest/api/3/mypermissions?permissions=${permissions.join(',')}`), 'global permission check');
      return Object.fromEntries(permissions.map((p) => [p, !!r.permissions[p]?.havePermission]));
    },
    async createIssue(i) {
      return json<{ key: string }>(await call2(route`/rest/api/3/issue`, { method: 'POST', body: { fields: {
        project: { key: i.projectKey }, summary: i.summary, issuetype: { name: i.issueType }, labels: i.labels, description: adf(i.description),
        ...(i.dueDate !== undefined ? { duedate: i.dueDate } : {}) } } }), 'create issue');
    },
    async createLink(i) {
      await json(await call2(route`/rest/api/3/issueLink`, { method: 'POST', body: { type: { name: i.typeName },
        // Verified on a real site (2026-11-02): POST /issueLink reads as "<inwardIssue> <outward phrase> <outwardIssue>",
        // e.g. inwardIssue A + outwardIssue B with type Blocks ⇒ "A blocks B". Our port's `outwardKey` is the subject.
        inwardIssue: { key: i.outwardKey }, outwardIssue: { key: i.inwardKey } } }), 'create link');
    },
    async deleteLink(linkId) {
      await json(await call2(route`/rest/api/3/issueLink/${linkId}`, { method: 'DELETE' }), 'delete link');
    },
    async addComment(key, text) { await json(await call2(route`/rest/api/3/issue/${key}/comment`, { method: 'POST', body: { body: adf(text) } }), 'add comment'); },
    async getCommentsText(key) {
      const r = await json<{ comments: { body: unknown }[] }>(await call2(route`/rest/api/3/issue/${key}/comment?maxResults=100&orderBy=-created`), 'read comments');
      return r.comments.map((c) => JSON.stringify(c.body));
    },
    async addLabel(key, label) { await json(await call2(route`/rest/api/3/issue/${key}`, { method: 'PUT', body: { update: { labels: [{ add: label }] } } }), 'add label'); },
    async issueTypes(projectKey) {
      // Only types the caller can actually create here (createmeta). Service-desk projects often expose none
      // through the platform API, and listing project types would then promise writes that Jira rejects.
      const r = await json<{ issueTypes?: { name: string; subtask?: boolean }[]; values?: { name: string; subtask?: boolean }[] }>(
        await call2(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes?maxResults=50`), 'create metadata');
      return (r.issueTypes ?? r.values ?? []).filter((t) => !t.subtask).map((t) => t.name);
    }
  };
}

/** Plain text → Atlassian Document Format (each line a paragraph). Text is never interpreted as markup. */
export function adf(text: string) {
  return { type: 'doc', version: 1, content: text.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) };
}

/**
 * Retention policy (Forge KVS TTL): storage never grows without bound.
 * Snapshots are short-lived evidence; plans/executions/comparisons form the audit trail behind Prevention Passports.
 */
export function retentionFor(key: string): { value: number; unit: 'DAYS' } {
  if (key.startsWith('snap:')) return { value: 2, unit: 'DAYS' };
  if (key.startsWith('lock:') || key.startsWith('lock-takeover:')) return { value: 1, unit: 'DAYS' };
  if (key.startsWith('idem:')) return { value: 7, unit: 'DAYS' };
  if (key.startsWith('radar:seen:')) return { value: 7, unit: 'DAYS' }; // dedupe window for retried Jira events
  return { value: 90, unit: 'DAYS' }; // plan:, exec:, cmp: (audit)
}

export const forgeStore: Store = {
  get: (k) => kvs.get(k),
  // Admin configuration never expires; everything else follows the documented retention.
  set: (k, v) => (k.startsWith('config:') ? kvs.set(k, v) : kvs.set(k, v, { ttl: retentionFor(k) })),
  async setIfAbsent(k, v) {
    try { await kvs.set(k, v, { keyPolicy: 'FAIL_IF_EXISTS', ttl: retentionFor(k) }); return true; }
    catch (e) { if ((await kvs.get(k)) !== undefined) return false; throw e; }
  },
  delete: (k) => kvs.delete(k)
};

/** forgeStore + prefix query (KVS: beginsWith on key only, limit <= 100, cursors are not persisted). Used by the Decision Radar. */
export const forgeQueryStore = {
  ...forgeStore,
  async query<T>(prefix: string, limit: number, cursor: string | null) {
    let q = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(Math.min(Math.max(1, Math.trunc(limit)), 100));
    if (cursor) q = q.cursor(cursor);
    const r = await q.getMany<T>();
    return { items: r.results.map((x) => ({ key: x.key, value: x.value as T })), nextCursor: r.nextCursor ?? null };
  }
};
