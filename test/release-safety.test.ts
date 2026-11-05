import { describe, it, expect, vi } from 'vitest';
import { createService } from '../src/engine/service';
import { aggregateRelease, classify } from '../src/engine/release';
import { OPERATIONS, RELEASE_SAFETY_LIMITS } from '../packages/contracts/src/index';
import { FakeJira, memoryStore } from './fakes';
import type { DecisionRecord } from '../src/validator';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
const ctx = { requestId: 'r', accountId: 'u1', installationId: 'i' };
const NOW = new Date('2026-11-05T12:00:00.000Z');
const CH = ['anticipate-change'];
const W = [{ name: 'Winter', releaseDate: '2026-12-08' }];

function dec(over: Partial<DecisionRecord>): DecisionRecord {
  return { schema: 3, planId: 'plan-1', scenarioId: 's', status: 'COMPLETED', at: '2026-11-04T10:00:00.000Z', owner: 'u1', verdict: 'PASS', allActionsVerified: true,
    currentVerdict: 'PASS', validUntil: '2026-11-18T10:00:00.000Z', ...over };
}

/** Release "Winter": REL-1 retires an API that REL-2 upgrades around; both touch SVC-1 (the DEMO 2 shape). */
function site() {
  const j = new FakeJira();
  j.add('REL-1', 'Retire Auth API v1', { labels: CH, versions: W });
  j.add('REL-2', 'Upgrade Auth API v2 (breaking)', { labels: CH, versions: W });
  j.add('REL-3', 'Unrelated copy fix', { labels: CH, versions: W });
  j.add('REL-4', 'Next release change', { labels: CH, versions: [{ name: 'Spring', releaseDate: null }] });
  j.add('SVC-1', 'Checkout service');
  j.link('Blocks', 'blocks', 'is blocked by', 'REL-1', 'SVC-1');
  j.link('Blocks', 'blocks', 'is blocked by', 'REL-2', 'SVC-1');
  return j;
}
function svc(j = site(), store = memoryStore()) {
  let n = 0;
  return { j, store, s: createService({ jira: j, store, now: () => NOW, newId: () => `id-${++n}` }) };
}
const parse = (r: unknown) => OPERATIONS.getReleaseSafety.output.parse(r);

describe('Release Safety Control Plane', () => {
  it('vertical slice: scoped to the release, interaction exposed, unknowns explicit, zero Jira writes', async () => {
    const { j, store, s } = svc();
    await store.set('decision:REL-1', dec({}));
    await store.set('decision:REL-3', dec({ planId: 'plan-3' }));
    const r = parse(await s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: 'Winter' }));
    expect(r.items.map((i) => i.issue.key)).toEqual(['REL-1', 'REL-2', 'REL-3']);
    expect(r.items.map((i) => i.state)).toEqual(['VERIFIED_FOR_RECORDED_SCOPE', 'NEEDS_REVIEW', 'VERIFIED_FOR_RECORDED_SCOPE']);
    expect(r.interactions).toEqual([expect.objectContaining({ kind: 'SHARED_DEPENDENCY', changes: ['REL-1', 'REL-2'], via: 'SVC-1' })]);
    expect(r.verdict).toBe('NEEDS_REVIEW');
    expect(r.items[0]!.issue.url).toBe('https://example.atlassian.net/browse/REL-1');
    expect(r.coverage.unknowns.join(' ')).toMatch(/private decisions are not visible/);
    expect(r.readOnly).toBe(true);
    expect(j.writes).toEqual({ create: 0, link: 0, comment: 0, label: 0 });
  });

  it('individually verified changes still need review when they interact', async () => {
    const { store, s } = svc();
    await store.set('decision:REL-1', dec({}));
    await store.set('decision:REL-2', dec({ planId: 'plan-2' }));
    await store.set('decision:REL-3', dec({ planId: 'plan-3' }));
    const r = parse(await s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: 'Winter' }));
    expect(r.counts.VERIFIED_FOR_RECORDED_SCOPE).toBe(3);
    expect(r.verdict).toBe('NEEDS_REVIEW');
    expect(r.verdictReasons[0]).toMatch(/interaction/);
  });

  it('VERIFIED_FOR_RECORDED_SCOPE only when every change is verified and nothing interacts, with a scope caveat', async () => {
    const { store, s } = svc();
    await store.set('decision:REL-3', dec({ planId: 'plan-3' }));
    const j = site(); j.issues.delete('REL-1'); j.issues.delete('REL-2');
    const r2 = parse(await createService({ jira: j, store, now: () => NOW, newId: () => 'x' }).getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: 'Winter' }));
    expect(r2.verdict).toBe('VERIFIED_FOR_RECORDED_SCOPE');
    expect(r2.verdictReasons.join(' ')).toMatch(/not a guarantee/);
    void s;
  });

  it('stale (EVIDENCE_CHANGED) or BLOCK decisions block the release', async () => {
    const { store, s } = svc();
    await store.set('decision:REL-1', dec({ status: 'EVIDENCE_CHANGED' }));
    let r = parse(await s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: 'Winter' }));
    expect(r.verdict).toBe('BLOCKED');
    expect(r.items[0]!.reasons[0]).toMatch(/cannot authorize execution/);
    await store.set('decision:REL-1', dec({ currentVerdict: 'BLOCK', currentBlockers: 2 }));
    r = parse(await s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: 'Winter' }));
    expect(r.items[0]!.state).toBe('BLOCKED');
  });

  it('partial execution, approved-not-executed, expired attestation and unknown verdict are distinct', () => {
    const i = site().issues.get('REL-3')!;
    expect(classify(i, dec({ status: 'PARTIAL', allActionsVerified: false }), NOW).state).toBe('EXECUTION_PARTIAL');
    expect(classify(i, dec({ status: 'COMPLETED', allActionsVerified: false }), NOW).state).toBe('EXECUTION_PARTIAL');
    expect(classify(i, dec({ status: 'APPROVED' }), NOW).state).toBe('APPROVED_NOT_EXECUTED');
    expect(classify(i, dec({ status: 'PENDING_APPROVAL' }), NOW).state).toBe('NEEDS_REVIEW');
    expect(classify(i, dec({ validUntil: '2026-11-01T00:00:00.000Z' }), NOW).state).toBe('NEEDS_REVIEW');
    expect(classify(i, dec({ verdict: 'UNKNOWN', currentVerdict: undefined, status: 'APPROVED' }), NOW).state).toBe('EVIDENCE_INCOMPLETE');
  });

  it("another user's decision is never shown or counted", async () => {
    const { store, s } = svc();
    await store.set('decision:REL-3', dec({ owner: 'someone-else' }));
    const r = parse(await s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: 'Winter' }));
    expect(r.items.find((x) => x.issue.key === 'REL-3')!.decision).toBeNull();
    expect(r.coverage.decisionsVisible).toBe(0);
  });

  it('empty release and unknown fixVersion are EVIDENCE_INCOMPLETE, never safe', async () => {
    const { s } = svc();
    const r = parse(await s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: 'Nope' }));
    expect(r.items).toEqual([]);
    expect(r.verdict).toBe('EVIDENCE_INCOMPLETE');
  });

  it('no fixVersion = whole project', async () => {
    const { s } = svc();
    const r = parse(await s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: null }));
    expect(r.items.map((i) => i.issue.key)).toContain('REL-4');
  });

  it('refuses unauthenticated callers, unbrowsable projects and injection-shaped input', async () => {
    const { j, s } = svc();
    await expect(s.getReleaseSafety({ ...ctx, accountId: null }, { projectKey: 'REL', fixVersion: null })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: 'x" OR project = SEC' })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(OPERATIONS.getReleaseSafety.input.safeParse({ projectKey: 'REL', fixVersion: 'a"b' }).success).toBe(false);
    j.perms.BROWSE_PROJECTS = false;
    await expect(s.getReleaseSafety(ctx, { projectKey: 'REL', fixVersion: null })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('paginates, stops at the bound and reports truncation as EVIDENCE_INCOMPLETE', async () => {
    const j = new FakeJira();
    for (let k = 1; k <= RELEASE_SAFETY_LIMITS.maxIssues + 7; k++) j.add(`BIG-${k}`, `c${k}`, { labels: CH });
    const { store } = svc();
    for (let k = 1; k <= RELEASE_SAFETY_LIMITS.maxIssues + 7; k++) await store.set(`decision:BIG-${k}`, dec({ planId: `p${k}` }));
    const r = parse(await createService({ jira: j, store, now: () => NOW, newId: () => 'x' }).getReleaseSafety(ctx, { projectKey: 'BIG', fixVersion: null }));
    expect(r.items).toHaveLength(RELEASE_SAFETY_LIMITS.maxIssues);
    expect(r.coverage.truncated).toBe(true);
    expect(r.verdict).toBe('EVIDENCE_INCOMPLETE');
  });

  it('is deterministic regardless of Jira result order', () => {
    const j = site();
    const issues = [...j.issues.values()].filter((i) => i.labels.length).map((i) => ({ ...i, links: [] as typeof i.links }));
    const base = { projectKey: 'REL', fixVersion: null, jql: 'q', evaluatedAt: NOW.toISOString(), truncated: false, siteUrl: null, decisions: {} };
    expect(aggregateRelease({ ...base, issues: [...issues].reverse() })).toEqual(aggregateRelease({ ...base, issues }));
  });

  it('bounds interactions on a dense shared dependency', () => {
    const issues = Array.from({ length: 30 }, (_, k) => ({ id: `${k}`, key: `D-${k}`, summary: 's', status: 'To Do', issueType: 'Task', projectId: '1', projectKey: 'D',
      updated: '2026-11-01T00:00:00.000Z', labels: CH, components: [], links: [{ id: `${k}`, typeName: 'Blocks', outward: 'blocks', inward: 'is blocked by', direction: 'outward' as const, otherKey: 'HUB-1' }] }));
    const r = aggregateRelease({ projectKey: 'D', fixVersion: null, jql: 'q', evaluatedAt: NOW.toISOString(), truncated: false, siteUrl: null, decisions: {}, issues });
    expect(r.interactions).toHaveLength(RELEASE_SAFETY_LIMITS.maxInteractions);
    expect(r.coverage.interactionsTruncated).toBe(true);
    expect(() => OPERATIONS.getReleaseSafety.output.parse(r)).not.toThrow();
  });
});
