/**
 * Decision Radar first slice: event normalisation, dedupe, fan-out, honesty states, monotonic attention,
 * owner-only reads through the service, and clearing only by a fresh user-run recompute.
 */
import { createRadar, normaliseEvent, RADAR_LIMITS } from '../src/radar/radar';
import { createService } from '../src/engine/service';
import type { Store } from '../src/core/ports';
import { demoJira, memoryStore } from './fakes';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

const T0 = Date.parse('2026-11-04T10:00:00Z');
const link = (type: 'created' | 'deleted', id: number, a: number, b: number, ts = T0) =>
  ({ eventType: `avi:jira:${type}:issuelink`, selfGenerated: false, id, sourceIssueId: a, destinationIssueId: b, issueLinkType: { name: 'Blocks' }, timestamp: ts });
const issueDeleted = (id: number, ts = T0) => ({ eventType: 'avi:jira:deleted:issue', issue: { id: String(id), key: 'PAY-9' }, timestamp: ts });

function rig() {
  const store = memoryStore(); let t = new Date('2026-11-04T10:05:00Z');
  const radar = createRadar({ store, now: () => t });
  return { store, radar, tick: (ms: number) => { t = new Date(t.getTime() + ms); } };
}
const nodes = (ids: (string | null)[]) => ids.map((id) => ({ kind: 'ISSUE', attributes: id ? { jiraId: id } : { access: 'not_crawled' } }));

describe('radar: event normalisation', () => {
  it('accepts link created/deleted and issue deleted; rejects malformed, foreign and id-less events', () => {
    const at = '2026-11-04T10:05:00.000Z';
    expect(normaliseEvent(link('created', 7, 100, 200), at)).toMatchObject({ type: 'LINK_CREATED', issueIds: ['100', '200'], linkId: '7', linkType: 'Blocks' });
    expect(normaliseEvent(link('deleted', 7, 100, 200), at)?.type).toBe('LINK_DELETED');
    expect(normaliseEvent(issueDeleted(100), at)).toMatchObject({ type: 'ISSUE_DELETED', issueIds: ['100'] });
    for (const bad of [null, 'x', {}, { ...link('created', 7, 1, 2), timestamp: undefined }, { ...link('created', 7, 1, 2), sourceIssueId: 'PAY-1' },
      { ...link('created', 7, 1, 2), id: '../x' }, { eventType: 'avi:jira:updated:issue', issue: { id: '1' }, timestamp: T0 }, { ...issueDeleted(1), issue: {} }]) {
      expect(normaliseEvent(bad, at)).toBeNull();
    }
  });
  it('fact ids are valid Forge KVS keys', () => {
    const f = normaliseEvent(link('created', 123, 4, 5), 'x')!;
    expect(`radar:seen:${f.factId}`).toMatch(/^[a-zA-Z0-9:._\s\-#]+$/);
  });
});

describe('radar: event handling', () => {
  it('flags only plans whose evidence contains a touched issue id', async () => {
    const s = rig();
    await s.radar.indexPlan('plan-a', nodes(['100', '101']));
    await s.radar.indexPlan('plan-b', nodes(['300']));
    expect(await s.radar.onEvent(link('created', 1, 101, 999))).toMatchObject({ status: 'RECORDED', plans: 1 });
    expect((await s.radar.attention('plan-a')).needsReview).toBe(true);
    expect((await s.radar.attention('plan-b')).needsReview).toBe(false);
  });
  it('duplicate delivery is recorded once', async () => {
    const s = rig(); await s.radar.indexPlan('plan-a', nodes(['100']));
    expect((await s.radar.onEvent(link('created', 1, 100, 2))).status).toBe('RECORDED');
    expect((await s.radar.onEvent(link('created', 1, 100, 2))).status).toBe('DUPLICATE');
    expect((await s.radar.attention('plan-a')).items).toHaveLength(1);
  });
  it('out-of-order: a later "deleted" never cancels an earlier "created" (monotonic)', async () => {
    const s = rig(); await s.radar.indexPlan('plan-a', nodes(['100']));
    await s.radar.onEvent(link('deleted', 1, 100, 2, T0 + 5000));
    await s.radar.onEvent(link('created', 1, 100, 2, T0));
    const a = await s.radar.attention('plan-a');
    expect(a.items.map((i) => i.type)).toEqual(['LINK_CREATED', 'LINK_DELETED']); // ordered by occurrence
    expect(a.needsReview).toBe(true);
  });
  it('issue deletion flags plans (no cascading link events in Jira)', async () => {
    const s = rig(); await s.radar.indexPlan('plan-a', nodes(['100']));
    await s.radar.onEvent(issueDeleted(100));
    expect((await s.radar.attention('plan-a')).items[0]?.type).toBe('ISSUE_DELETED');
  });
  it('invalid payload: ignored, monitoring DEGRADED with INVALID_EVENT, nothing written for plans', async () => {
    const s = rig(); await s.radar.indexPlan('plan-a', nodes(['100']));
    expect((await s.radar.onEvent({ eventType: 'avi:jira:created:issuelink' })).status).toBe('IGNORED');
    const a = await s.radar.attention('plan-a');
    expect(a.monitoring).toMatchObject({ state: 'DEGRADED' }); expect(a.monitoring.reasons).toContain('INVALID_EVENT');
    expect(a.needsReview).toBe(false);
  });
  it('fan-out is capped and reported (FANOUT_CAPPED), never unbounded', async () => {
    const s = rig();
    for (let i = 0; i < RADAR_LIMITS.fanout + 15; i++) await s.store.setIfAbsent(`radar:idx:100:plan-${i}`, { at: 'x' });
    const r = await s.radar.onEvent(link('created', 1, 100, 2));
    expect(r.plans).toBe(RADAR_LIMITS.fanout); expect(r.capped).toBe(true);
  });
  it('event burst: 300 distinct events on one issue, bounded attention page with truncated=true', async () => {
    const s = rig(); await s.radar.indexPlan('plan-a', nodes(['100']));
    for (let i = 1; i <= 300; i++) await s.radar.onEvent(link('created', i, 100, 2, T0 + i));
    const a = await s.radar.attention('plan-a');
    expect(a.items.length).toBeLessThanOrEqual(RADAR_LIMITS.attentionPage); expect(a.truncated).toBe(true); expect(a.needsReview).toBe(true);
  });
  it('storage failure mid-event: error surfaces, dedupe key released so a platform retry redoes the work', async () => {
    const s = rig(); await s.radar.indexPlan('plan-a', nodes(['100']));
    const inner = s.store; let fail = true;
    const flaky = { ...inner, setIfAbsent: async (k: string, v: unknown) => { if (fail && k.startsWith('radar:att:')) { fail = false; throw new Error('KVS down'); } return inner.setIfAbsent(k, v); } } as unknown as Store;
    const radar2 = createRadar({ store: Object.assign(flaky, { query: inner.query.bind(inner) }), now: () => new Date('2026-11-04T10:06:00Z') });
    await expect(radar2.onEvent(link('created', 1, 100, 2))).rejects.toThrow('KVS down');
    expect((await radar2.attention('plan-a')).monitoring.reasons).toContain('STORAGE_ERROR');
    expect((await radar2.onEvent(link('created', 1, 100, 2))).status).toBe('RECORDED'); // retry not swallowed as duplicate
    expect((await radar2.attention('plan-a')).needsReview).toBe(true);
  });
});

describe('radar: honest monitoring states', () => {
  it('NOT_CONFIGURED for an unindexed (legacy) plan and when the store cannot query', async () => {
    const s = rig();
    expect((await s.radar.attention('plan-x')).monitoring).toMatchObject({ state: 'NOT_CONFIGURED', reasons: ['NOT_INDEXED'] });
    const noQuery = createRadar({ store: { get: s.store.get, set: s.store.set, setIfAbsent: s.store.setIfAbsent, delete: s.store.delete }, now: () => new Date() });
    expect((await noQuery.attention('plan-x')).monitoring.state).toBe('NOT_CONFIGURED');
    expect((await noQuery.onEvent(link('created', 1, 1, 2))).status).toBe('IGNORED');
  });
  it('DEGRADED (PARTIAL_INDEX) when part of the evidence is known only by key', async () => {
    const s = rig(); await s.radar.indexPlan('plan-a', nodes(['100', null, null]));
    const a = await s.radar.attention('plan-a');
    expect(a.monitoring).toMatchObject({ state: 'DEGRADED' }); expect(a.monitoring.reasons).toContain('PARTIAL_INDEX');
    expect(a.coverage).toEqual({ indexed: 1, unindexed: 2 });
  });
  it('ACTIVE with no items is never presented as fresh: the note always says it is not a freshness check', async () => {
    const s = rig(); await s.radar.indexPlan('plan-a', nodes(['100']));
    const a = await s.radar.attention('plan-a');
    expect(a.monitoring.state).toBe('ACTIVE'); expect(a.needsReview).toBe(false);
    expect(a.note).toMatch(/not a freshness check/);
  });
});

describe('radar through the service: owner-only, cleared only by a fresh recompute', () => {
  async function svcRig() {
    const jira = demoJira(); const store = memoryStore(); let n = 0; let t = new Date('2026-11-04T09:00:00Z');
    const radar = createRadar({ store, now: () => t });
    const svc = createService({ jira, store, now: () => t, newId: () => `r${++n}`, radar });
    const me = { requestId: 'r', accountId: 'acc-1', installationId: 'i' };
    const snap = await svc.getGraphSnapshot(me, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    await svc.compareScenarios(me, { snapshotId: snap.snapshotId, change: { issueKey: 'PAY-1', targetNodeId: 'issue:PAY-1', description: 'x' },
      scenarios: [{ scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: 'issue:PAY-1' }] }], maxDepth: 6 });
    const plan = await svc.generatePreventionPlan(me, { snapshotId: snap.snapshotId, scenarioId: 'A' });
    const ids = snap.nodes.map((x) => x.attributes?.jiraId).filter((v): v is string => typeof v === 'string');
    return { svc, radar, store, plan, me, ids, tick: (ms: number) => { t = new Date(t.getTime() + ms); } };
  }
  it('generatePreventionPlan indexes evidence by Jira issue id', async () => {
    const s = await svcRig();
    expect(s.ids.length).toBeGreaterThan(0);
    const a = await s.svc.getPlanAttention(s.me, { planId: s.plan.planId });
    expect(a.coverage?.indexed).toBe(s.ids.length);
  });
  it('another user cannot read attention for my plan', async () => {
    const s = await svcRig();
    await expect(s.svc.getPlanAttention({ ...s.me, accountId: 'intruder' }, { planId: s.plan.planId })).rejects.toBeTruthy();
  });
  it('a radar hit is cleared only after checkPlanFreshness finds no drift; later events raise it again', async () => {
    const s = await svcRig();
    s.tick(1000); await s.radar.onEvent(link('created', 77, Number(s.ids[0]), 999999, Date.parse('2026-11-04T09:00:01Z')));
    expect((await s.svc.getPlanAttention(s.me, { planId: s.plan.planId })).needsReview).toBe(true);
    s.tick(1000); const drift = await s.svc.checkPlanFreshness(s.me, { planId: s.plan.planId });
    const after = await s.svc.getPlanAttention(s.me, { planId: s.plan.planId });
    if (drift.fresh) { expect(after.needsReview).toBe(false); expect(after.clearedAt).not.toBeNull(); }
    else expect(after.needsReview).toBe(true);
    s.tick(1000); await s.radar.onEvent(link('deleted', 78, Number(s.ids[0]), 999998, Date.parse('2026-11-04T09:00:05Z')));
    expect((await s.svc.getPlanAttention(s.me, { planId: s.plan.planId })).needsReview).toBe(true);
  });
  it('the radar never changes plan status (no auto-invalidation)', async () => {
    const s = await svcRig();
    await s.radar.onEvent(issueDeleted(Number(s.ids[0])));
    const rec = await s.store.get<{ plan: { status: string } }>(`plan:${s.plan.planId}`);
    expect(rec!.plan.status).toBe('PENDING_APPROVAL');
  });
});
