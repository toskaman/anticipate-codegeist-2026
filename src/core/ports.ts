/** Ports keep business logic testable without Forge. Implementations: src/forge-adapters.ts (live), test/fakes.ts. */
export interface JiraIssue {
  id: string; key: string; summary: string; status: string; statusCategory?: string | null; issueType: string; projectId: string; projectKey: string;
  updated: string; labels: string[]; components: { id: string; name: string }[];
  /** Jira due date (YYYY-MM-DD) and fix versions; optional so older fakes stay valid. */
  due?: string | null; versions?: { name: string; releaseDate: string | null }[];
  links: { id: string; typeName: string; outward: string; inward: string; direction: 'outward' | 'inward'; otherKey: string }[];
}
export type IssueFetch = { kind: 'ok'; issue: JiraIssue } | { kind: 'forbidden' } | { kind: 'not_found' };

export interface JiraPort {
  siteUrl(): string | null;
  searchProjects(startAt: number, max: number): Promise<{ items: { id: string; key: string; name: string; issueCount: number | null }[]; isLast: boolean }>;
  searchIssues(jql: string, nextPageToken: string | null, max: number): Promise<{ items: JiraIssue[]; nextPageToken: string | null }>;
  getIssue(key: string): Promise<IssueFetch>;
  myPermissions(projectKey: string, permissions: string[]): Promise<Record<string, boolean>>;
  /** Global (site) permissions of the caller, e.g. ADMINISTER. */
  globalPermissions(permissions: string[]): Promise<Record<string, boolean>>;
  createIssue(input: { projectKey: string; summary: string; description: string; issueType: string; labels: string[]; dueDate?: string }): Promise<{ key: string }>;
  /** Creates "<outwardKey> <outward phrase> <inwardKey>", e.g. outwardKey blocks inwardKey. */
  createLink(input: { typeName: string; inwardKey: string; outwardKey: string }): Promise<void>;
  deleteLink?(linkId: string): Promise<void>;
  addComment(issueKey: string, text: string): Promise<void>;
  getCommentsText(issueKey: string): Promise<string[]>;
  addLabel(issueKey: string, label: string): Promise<void>;
  issueTypes(projectKey: string): Promise<string[]>;
  /**
   * Live project permission of ANY account (checked as the app; fails closed on any non-200). Used only by the shared decision
   * execution gate to re-validate approvers; optional so ports without it refuse to execute shared plans (never assume a grant).
   */
  userHasPermission?(accountId: string, projectKey: string, permission: string): Promise<boolean>;
}

export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  /** Atomic create; returns false if the key already exists. */
  setIfAbsent<T>(key: string, value: T): Promise<boolean>;
  delete(key: string): Promise<void>;
  /**
   * Optional prefix query (Forge KVS `beginsWith` on the key, the only supported condition). One page per call:
   * at most `limit` (1..100) entries plus an opaque cursor that must not be persisted (KVS docs). Callers bound the pages.
   */
  listByPrefix?<T>(prefix: string, cursor?: string | null, limit?: number): Promise<{ items: { key: string; value: T }[]; nextCursor: string | null }>;
}

export interface Deps { jira: JiraPort; store: Store; now: () => Date; newId: () => string; context?: import('../context/sources').ContextSource; }

export interface Ctx { requestId: string; accountId: string | null; installationId: string; }
