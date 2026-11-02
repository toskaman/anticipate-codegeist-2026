/** Ports keep business logic testable without Forge. Implementations: src/forge-adapters.ts (live), test/fakes.ts. */
export interface JiraIssue {
  id: string; key: string; summary: string; status: string; issueType: string; projectId: string; projectKey: string;
  updated: string; labels: string[]; components: { id: string; name: string }[];
  links: { id: string; typeName: string; outward: string; inward: string; direction: 'outward' | 'inward'; otherKey: string }[];
}
export type IssueFetch = { kind: 'ok'; issue: JiraIssue } | { kind: 'forbidden' } | { kind: 'not_found' };

export interface JiraPort {
  siteUrl(): string | null;
  searchProjects(startAt: number, max: number): Promise<{ items: { id: string; key: string; name: string; issueCount: number | null }[]; isLast: boolean }>;
  searchIssues(jql: string, nextPageToken: string | null, max: number): Promise<{ items: JiraIssue[]; nextPageToken: string | null }>;
  getIssue(key: string): Promise<IssueFetch>;
  myPermissions(projectKey: string, permissions: string[]): Promise<Record<string, boolean>>;
  createIssue(input: { projectKey: string; summary: string; description: string; issueType: string; labels: string[] }): Promise<{ key: string }>;
  createLink(input: { typeName: string; inwardKey: string; outwardKey: string }): Promise<void>;
  addComment(issueKey: string, text: string): Promise<void>;
  getCommentsText(issueKey: string): Promise<string[]>;
  addLabel(issueKey: string, label: string): Promise<void>;
  issueTypes(projectKey: string): Promise<string[]>;
}

export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  /** Atomic create; returns false if the key already exists. */
  setIfAbsent<T>(key: string, value: T): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export interface Deps { jira: JiraPort; store: Store; now: () => Date; newId: () => string; }

export interface Ctx { requestId: string; accountId: string | null; installationId: string; }
