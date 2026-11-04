import { AppError } from '../src/core/errors';
import type { IssueFetch, JiraIssue, JiraPort, Store } from '../src/core/ports';

/** Forge KVS key pattern (docs: keys must match this and be at most 500 characters). */
export const FORGE_KVS_KEY = /^(?!\s+$)[a-zA-Z0-9:._\s\-#]+$/;

export function memoryStore() {
  const data = new Map<string, unknown>();
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  // Enforce the real Forge KVS key contract so storage-key bugs fail in unit tests, not in production
  // (production 2.31.0 outage: an ARI with "/" in a throttle key). Pattern and limit from the Forge KVS docs.
  const check = (k: string) => {
    if (typeof k !== 'string' || k.length === 0 || k.length > 500 || !FORGE_KVS_KEY.test(k)) {
      throw new Error(`INVALID_KEY: Forge KVS rejects key ${JSON.stringify(String(k).slice(0, 80))}`);
    }
  };
  return {
    data,
    async get(k) { check(k); return clone(data.get(k)) as never; },
    async set(k, v) { check(k); data.set(k, clone(v)); },
    async setIfAbsent(k, v) { check(k); if (data.has(k)) return false; data.set(k, clone(v)); return true; },
    async delete(k) { check(k); data.delete(k); },
    /** Prefix query like KVS beginsWith (limit <= 100, opaque cursor). */
    async query<T>(prefix: string, limit: number, cursor: string | null) {
      const keys = [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0; const lim = Math.min(Math.max(1, limit), 100);
      const page = keys.slice(start, start + lim);
      return { items: page.map((key) => ({ key, value: clone(data.get(key)) as T })), nextCursor: start + lim < keys.length ? String(start + lim) : null };
    }
  } as Store & { data: Map<string, unknown>; query<T>(prefix: string, limit: number, cursor: string | null): Promise<{ items: { key: string; value: T }[]; nextCursor: string | null }> };
}

type Link = { id: string; type: string; outward: string; inward: string; from: string; to: string };

/** Minimal JQL subset the app emits. Anything else is rejected like Jira would (HTTP 400 → UPSTREAM_UNAVAILABLE). */
function parseJql(jql: string): { project: string | null; labels: string[] | null } {
  const reject = (why: string): never => { throw new AppError('UPSTREAM_UNAVAILABLE', `Jira issue search rejected (HTTP 400): invalid JQL (${why}).`, false); };
  if (typeof jql !== 'string' || !jql.trim()) reject('empty query');
  const where = jql.replace(/(^|\s+)ORDER\s+BY\s+[A-Za-z_][\w\s,]*(\s+(ASC|DESC))?\s*$/i, '').trim();
  if (!where) return { project: null, labels: null };
  let project: string | null = null;
  let labels: string[] | null = null;
  for (const clause of where.split(/\s+AND\s+/i)) {
    const c = clause.trim();
    let m: RegExpExecArray | null;
    if ((m = /^\s*project\s*=\s*"?([A-Za-z0-9_]+)"?\s*$/i.exec(c))) project = m[1]!;
    else if ((m = /^\s*labels\s*=\s*"([^"]+)"\s*$/i.exec(c))) labels = [m[1]!];
    else if (/^\s*labels\s+in\s*\(\s*"[^"]+"(\s*,\s*"[^"]+")*\s*\)\s*$/i.test(c)) labels = [...c.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
    else if (/^\s*issueLinkType\s+is\s+(not\s+)?empty\s*$/i.test(c)) { /* accepted; link presence is not modelled as a filter */ }
    else reject(`unsupported clause ${JSON.stringify(c.slice(0, 80))}`);
  }
  return { project, labels };
}

function parsePageToken(token: string | null | undefined): number {
  if (token === null || token === undefined) return 0;
  const m = /^page:(\d+)$/.exec(token);
  if (!m) throw new AppError('UPSTREAM_UNAVAILABLE', 'Jira issue search rejected (HTTP 400): unknown nextPageToken.', false);
  return Number.parseInt(m[1]!, 10);
}

export class FakeJira implements JiraPort {
  issues = new Map<string, JiraIssue>();
  forbidden = new Set<string>();
  /** Projects whose createmeta exposes no usable types (live: service-desk projects via the platform API). */
  noTypes = new Set<string>();
  links: Link[] = [];
  comments = new Map<string, string[]>();
  perms: Record<string, boolean> = { CREATE_ISSUES: true, LINK_ISSUES: true, ADD_COMMENTS: true, EDIT_ISSUES: true, BROWSE_PROJECTS: true, SCHEDULE_ISSUES: true };
  writes = { create: 0, link: 0, comment: 0, label: 0 };
  failNextComment = false;
  private seq = 100;
  siteUrl() { return 'https://example.atlassian.net'; }
  add(key: string, summary: string, extra: Partial<JiraIssue> = {}) {
    this.issues.set(key, { id: String(this.seq++), key, summary, status: 'To Do', issueType: 'Task', projectId: '10000', projectKey: key.split('-')[0]!, updated: '2026-11-01T10:00:00.000+0100', labels: [], components: [], links: [], ...extra });
  }
  link(type: string, outward: string, inward: string, from: string, to: string) { this.links.push({ id: String(this.seq++), type, outward, inward, from, to }); }
  private view(i: JiraIssue): JiraIssue {
    const links = this.links.flatMap((l): JiraIssue['links'] => l.from === i.key ? [{ id: l.id, typeName: l.type, outward: l.outward, inward: l.inward, direction: 'outward' as const, otherKey: l.to }]
      : l.to === i.key ? [{ id: l.id, typeName: l.type, outward: l.outward, inward: l.inward, direction: 'inward' as const, otherKey: l.from }] : []);
    return { ...i, labels: [...i.labels], links };
  }
  async searchProjects() { return { items: [{ id: '10000', key: 'PAY', name: 'Payments', issueCount: this.issues.size }], isLast: true }; }
  async searchIssues(jql: string, nextPageToken: string | null = null, max = 50) {
    const where = parseJql(jql);
    if (!Number.isInteger(max) || max <= 0) throw new AppError('UPSTREAM_UNAVAILABLE', `Jira issue search rejected (HTTP 400): maxResults must be a positive integer, got ${max}.`, false);
    const offset = parsePageToken(nextPageToken);
    const items = [...this.issues.values()]
      .filter((i) => (!where.project || i.projectKey.toUpperCase() === where.project.toUpperCase() || i.projectId === where.project)
        && (!where.labels || i.labels.some((l) => where.labels!.includes(l))))
      .map((i) => this.view(i));
    if (offset > items.length) throw new AppError('UPSTREAM_UNAVAILABLE', 'Jira issue search rejected (HTTP 400): unknown nextPageToken.', false);
    const page = items.slice(offset, offset + max);
    return { items: page, nextPageToken: offset + max < items.length ? `page:${offset + max}` : null };
  }
  async getIssue(key: string): Promise<IssueFetch> {
    if (this.forbidden.has(key)) return { kind: 'forbidden' };
    const i = this.issues.get(key);
    return i ? { kind: 'ok', issue: this.view(i) } : { kind: 'not_found' };
  }
  async myPermissions(_p: string, ps: string[]) { return Object.fromEntries(ps.map((p) => [p, !!this.perms[p]])); }
  globalPerms: Record<string, boolean> = {};
  async globalPermissions(ps: string[]) { return Object.fromEntries(ps.map((p) => [p, !!this.globalPerms[p]])); }
  async createIssue(i: { projectKey: string; summary: string; labels: string[]; dueDate?: string }) {
    this.writes.create++; const key = `${i.projectKey}-${this.seq++}`; this.add(key, i.summary, { labels: i.labels, ...(i.dueDate !== undefined ? { due: i.dueDate } : {}) }); return { key };
  }
  async createLink(i: { typeName: string; inwardKey: string; outwardKey: string }) { this.writes.link++; const rel = i.typeName === 'Relates'; this.link(i.typeName, rel ? 'relates to' : 'blocks', rel ? 'relates to' : 'is blocked by', i.outwardKey, i.inwardKey); }
  async addComment(k: string, t: string) {
    this.writes.comment++;
    if (this.failNextComment) { this.failNextComment = false; throw new Error('HTTP 503'); }
    this.comments.set(k, [...(this.comments.get(k) ?? []), t]);
  }
  async getCommentsText(k: string) { return this.comments.get(k) ?? []; }
  async addLabel(k: string, l: string) { this.writes.label++; this.issues.get(k)!.labels.push(l); }
  async issueTypes(projectKey?: string) { return projectKey && this.noTypes.has(projectKey) ? [] : ['Epic', 'Task', 'Bug']; }
}

/** Jira-shaped demo: PAY-1 is the legacy API; consumers depend on it through real link types. */
export function demoJira() {
  const j = new FakeJira();
  j.add('PAY-1', 'Legacy Auth API v1', { labels: ['anticipate-change'] });
  j.add('PAY-2', 'Checkout service');
  j.add('PAY-3', 'Mobile backend');
  j.add('PAY-4', 'Partner webhooks');
  j.add('PAY-5', 'Checkout auth contract test', { issueType: 'Test' });
  j.add('SEC-9', 'Batch export (restricted)');
  j.forbidden.add('SEC-9');
  j.link('Blocks', 'blocks', 'is blocked by', 'PAY-1', 'PAY-2');      // PAY-2 depends on PAY-1
  j.link('Dependency', 'depends on', 'is depended on by', 'PAY-3', 'PAY-1');
  j.link('Dependency', 'depends on', 'is depended on by', 'PAY-4', 'PAY-2');
  j.link('Test', 'tests', 'is tested by', 'PAY-5', 'PAY-2');         // PAY-2 VERIFIED_BY PAY-5
  j.link('Dependency', 'depends on', 'is depended on by', 'SEC-9', 'PAY-1');
  return j;
}
