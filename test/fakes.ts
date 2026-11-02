import type { IssueFetch, JiraIssue, JiraPort, Store } from '../src/core/ports';

export function memoryStore(): Store & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  return {
    data,
    async get(k) { return clone(data.get(k)) as never; },
    async set(k, v) { data.set(k, clone(v)); },
    async setIfAbsent(k, v) { if (data.has(k)) return false; data.set(k, clone(v)); return true; },
    async delete(k) { data.delete(k); }
  };
}

type Link = { id: string; type: string; outward: string; inward: string; from: string; to: string };
export class FakeJira implements JiraPort {
  issues = new Map<string, JiraIssue>();
  forbidden = new Set<string>();
  links: Link[] = [];
  comments = new Map<string, string[]>();
  perms: Record<string, boolean> = { CREATE_ISSUES: true, LINK_ISSUES: true, ADD_COMMENTS: true, EDIT_ISSUES: true, BROWSE_PROJECTS: true };
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
  async searchIssues(jql: string) {
    const m = /labels = "([^"]+)"/.exec(jql);
    const inList = /labels in \(([^)]*)\)/.exec(jql);
    const wanted = inList ? [...inList[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!) : null;
    const items = [...this.issues.values()].filter((i) => (wanted ? i.labels.some((l) => wanted.includes(l)) : !m || i.labels.includes(m[1]!))).map((i) => this.view(i));
    return { items, nextPageToken: null };
  }
  async getIssue(key: string): Promise<IssueFetch> {
    if (this.forbidden.has(key)) return { kind: 'forbidden' };
    const i = this.issues.get(key);
    return i ? { kind: 'ok', issue: this.view(i) } : { kind: 'not_found' };
  }
  async myPermissions(_p: string, ps: string[]) { return Object.fromEntries(ps.map((p) => [p, !!this.perms[p]])); }
  async createIssue(i: { projectKey: string; summary: string; labels: string[] }) {
    this.writes.create++; const key = `${i.projectKey}-${this.seq++}`; this.add(key, i.summary, { labels: i.labels }); return { key };
  }
  async createLink(i: { typeName: string; inwardKey: string; outwardKey: string }) { this.writes.link++; this.link(i.typeName, 'blocks', 'is blocked by', i.outwardKey, i.inwardKey); }
  async addComment(k: string, t: string) {
    this.writes.comment++;
    if (this.failNextComment) { this.failNextComment = false; throw new Error('HTTP 503'); }
    this.comments.set(k, [...(this.comments.get(k) ?? []), t]);
  }
  async getCommentsText(k: string) { return this.comments.get(k) ?? []; }
  async addLabel(k: string, l: string) { this.writes.label++; this.issues.get(k)!.labels.push(l); }
  async issueTypes() { return ['Epic', 'Task', 'Bug']; }
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
