import { describe, it, expect, vi } from 'vitest';
import { createService } from '../src/engine/service';
import { createRadarOps, handleRadarEvent, normalizeEvent, radarKeys, RADAR_LIMITS, withRadar, isValidKvsKey, indexPlanForRadar } from '../src/radar/radar';
import { CapabilityAvailability, DecisionAttention, OPERATIONS } from '../packages/contracts/src/index';
import { demoJira, memoryStore, FORGE_KVS_KEY } from './fakes';
import type { Store } from '../src/core/ports';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

const alice = { requestId: 'r', accountId: 'alice', installationId: 'i' };
const bob = { requestId: 'r', accountId: 'bob', installationId: 'i' };
const T0 = new Date('2026-11-04T09:00:00.000Z');

function setup() {
  const jira = demoJira();
  const store = memoryStore();
  let now = T0; let n = 0;
  const clock = () => now;
  const svc = createService({ jira, store, now: clock, newId: () => `r${++n}` });
  const radar = createRadarOps(store, clock);
  const id = (key: string) => jira.issues.get(key)!.id;
  return { jira, store, svc, radar, id, clock, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}
type S = ReturnType<typeof setup>;

async function planFor(s: S, who = alice, root = 'PAY-1') {
  const snap = await s.svc.getGraphSnapshot(who, { projectId: 'PAY', rootIssueKey: root, source: 'JIRA', maxDepth: 3 });
  await s.svc.compareScenarios(who, { snapshotId: snap.snapshotId, change: { issueKey: root, targetNodeId: `issue:${root}`, description: 'remove' },
    scenarios: [{ scenarioId: 'A', label: 'Remove', operations: [{ op: 'REMOVE_NODE', nodeId: `issue:${root}` }] }], maxDepth: 6 });
  return s.svc.generatePreventionPlan(who, { snapshotId: snap.snapshotId, scenarioId: 'A' });
}

const linkEvt = (type: 'created' | 'deleted', linkId: string, src: string, dst: string, extra: Record<string, unknown> = {}) => ({
  eventType: `avi:jira:${type}:issuelink`, selfGenerated: false, id: linkId, sourceIssueId: src, destinationIssueId: dst,
  sourceProjectId: '10000', destinationProjectId: '10000', issueLinkType: { id: '1', name: 'Blocks' }, timestamp: T0.getTime(), ...extra });
const issueDeleted = (issueId: string) => ({ eventType: 'avi:jira:deleted:issue', selfGenerated: false, issue: { id: issueId, key: 'PAY-2' }, timestamp: T0.getTime() });

const att = (s: S, planId: string) => s.radar.getDecisionAttention(alice, { planId });

describe('Decision Radar: plan indexing', () => {
  it('stores evidence issue ids on the plan and writes valid radar:idx keys per evidence issue', async () => {
    const s = setup();
    const plan = await planFor(s);
    const rec = s.store.data.get(`plan:${plan.planId}`) as { radar: { evidenceIssueIds: Record<string, string>; indexedCount: number; unindexedCount: number; faults: string[] } };
    expect(rec.radar.evidenceIssueIds['PAY-1']).toBe(s.id('PAY-1'));
    expect(rec.radar.evidenceIssueIds['PAY-2']).toBe(s.id('PAY-2'));
    expect(rec.radar.evidenceIssueIds['SEC-9']).toBeUndefined(); // forbidden -> no id
    expect(rec.radar.unindexedCount).toBeGreaterThan(0);
    expect(rec.radar.faults).toContain('PARTIAL_INDEX');
    const idx = [...s.store.data.keys()].filter((k) => k.startsWith('radar:'));
    expect(idx).toContain(radarKeys.idx(s.id('PAY-1'), plan.planId));
    expect(idx).toContain(radarKeys.own('alice', plan.planId));
    for (const k of idx) { expect(FORGE_KVS_KEY.test(k)).toBe(true); expect(k.length).toBeLessThanOrEqual(500); }
  });

  it('plan not monitored: a demo/legacy plan reports NOT_CONFIGURED; a partially indexed plan DEGRADED, never ACTIVE', async () => {
    const s = setup();
    // legacy plan record without radar info
    await s.store.set('plan:plan-legacy', { plan: {}, owner: 'alice' });
    const legacy = await att(s, 'plan-legacy');
    expect(legacy).toMatchObject({ monitoring: 'NOT_CONFIGURED', faults: ['LEGACY_PLAN_NOT_INDEXED'], items: [] });
    const plan = await planFor(s);
    const r = DecisionAttention.parse(await att(s, plan.planId));
    expect(r.monitoring).toBe('DEGRADED'); // SEC-9 is unreadable -> not fully monitored
    expect(r.faults).toContain('PARTIAL_INDEX');
    expect(r.lastObservedAt).toBeNull(); // no event observed yet: honest, not "all clear"
  });

  it('a fully indexed plan is ACTIVE and index write failures do not fail plan creation', async () => {
    const s = setup();
    s.jira.forbidden.clear();
    const plan = await planFor(s);
    expect((await att(s, plan.planId)).monitoring).toBe('ACTIVE');
    const broken: Store = { ...s.store, set: async () => { throw new Error('KVS down'); } };
    const info = await indexPlanForRadar(broken, { planId: 'plan-x', owner: 'alice', snapshot: (await s.svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 })), at: T0.toISOString() });
    expect(info.faults).toContain('INDEX_WRITE_FAILED');
    expect(info.indexedCount).toBe(0);
  });
});

describe('Decision Radar: trigger handler', () => {
  it('flags the plan on a link created at an evidence issue, never identifying the external endpoint', async () => {
    const s = setup();
    const plan = await planFor(s);
    const before = JSON.stringify(s.store.data.get(`plan:${plan.planId}`));
    const out = await handleRadarEvent(s.store, linkEvt('created', '900', s.id('PAY-2'), '99999'), s.clock);
    expect(out).toMatchObject({ result: 'PROCESSED', flaggedPlans: [plan.planId] });
    const r = DecisionAttention.parse(await att(s, plan.planId));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ planId: plan.planId, reasons: ['LINK_CREATED'], evidenceIssueKeys: ['PAY-2'], externalEndpoint: true, observedAt: T0.toISOString() });
    expect(r.lastObservedAt).toBe(T0.toISOString());
    expect(JSON.stringify(s.store.data.get(radarKeys.att(plan.planId)))).not.toContain('99999');
    // monotonic + never executes: plan record untouched
    expect(JSON.stringify(s.store.data.get(`plan:${plan.planId}`))).toBe(before);
  });

  it('duplicate deliveries record one signal; a re-created link (new link id) is a new signal', async () => {
    const s = setup();
    const plan = await planFor(s);
    const e = linkEvt('created', '900', s.id('PAY-1'), s.id('PAY-4'));
    expect((await handleRadarEvent(s.store, e, s.clock)).result).toBe('PROCESSED');
    expect((await handleRadarEvent(s.store, e, s.clock)).result).toBe('DUPLICATE');
    expect((await handleRadarEvent(s.store, { ...e, retryContext: { retryCount: 1 } }, s.clock)).result).toBe('DUPLICATE');
    expect((await att(s, plan.planId)).items[0]!.signalCount).toBe(1);
    expect(s.store.data.has(radarKeys.evt('900', 'avi:jira:created:issuelink'))).toBe(true);
    await handleRadarEvent(s.store, linkEvt('created', '901', s.id('PAY-1'), s.id('PAY-4')), s.clock);
    expect((await att(s, plan.planId)).items[0]!.signalCount).toBe(2);
  });

  it('redelivery after a crash between attention write and dedupe mark does not double-append', async () => {
    const s = setup();
    const plan = await planFor(s);
    const e = linkEvt('created', '900', s.id('PAY-1'), '5');
    await handleRadarEvent(s.store, e, s.clock);
    s.store.data.delete(radarKeys.evt('900', 'avi:jira:created:issuelink')); // simulate lost dedupe mark
    expect((await handleRadarEvent(s.store, e, s.clock)).result).toBe('PROCESSED');
    expect((await att(s, plan.planId)).items[0]!.signalCount).toBe(1);
  });

  it('reordered events (delete before create) both flag; nothing cancels anything', async () => {
    const s = setup();
    const plan = await planFor(s);
    await handleRadarEvent(s.store, linkEvt('deleted', '900', s.id('PAY-1'), s.id('PAY-2')), s.clock);
    s.advance(1000);
    await handleRadarEvent(s.store, linkEvt('created', '900', s.id('PAY-1'), s.id('PAY-2')), s.clock);
    const item = (await att(s, plan.planId)).items[0]!;
    expect(item.reasons).toEqual(['LINK_DELETED', 'LINK_CREATED']);
    expect(item.signalCount).toBe(2);
    expect(item.externalEndpoint).toBe(false);
    expect(item.evidenceIssueKeys).toEqual(['PAY-1', 'PAY-2']);
  });

  it('issue deleted (no cascading link events) flags plans that indexed that issue', async () => {
    const s = setup();
    const plan = await planFor(s);
    await handleRadarEvent(s.store, issueDeleted(s.id('PAY-2')), s.clock);
    expect((await att(s, plan.planId)).items[0]).toMatchObject({ reasons: ['ISSUE_DELETED'], evidenceIssueKeys: ['PAY-2'] });
  });

  it('unknown events are ignored silently; malformed known events are a no-op that degrades monitoring', async () => {
    const s = setup();
    const plan = await planFor(s);
    s.jira.forbidden.clear();
    const keysBefore = [...s.store.data.keys()].sort();
    for (const e of [null, 42, 'x', [], { eventType: 'avi:jira:updated:issue', issue: { id: '1' } }, {}]) {
      const r = await handleRadarEvent(s.store, e, s.clock);
      expect(['IGNORED', 'MALFORMED']).toContain(r.result);
    }
    expect(normalizeEvent({ eventType: 'avi:jira:updated:issue' }, T0).kind).toBe('ignored');
    const bad = [
      { eventType: 'avi:jira:created:issuelink', id: '1', sourceIssueId: '2' },
      { eventType: 'avi:jira:created:issuelink', id: '1', sourceIssueId: '2/../x', destinationIssueId: '3' },
      { eventType: 'avi:jira:deleted:issuelink', id: { evil: true }, sourceIssueId: '2', destinationIssueId: '3' },
      { eventType: 'avi:jira:deleted:issue', issue: { key: 'PAY-1' } },
      { eventType: 'avi:jira:deleted:issue', issue: { id: 'radar:idx' } }
    ];
    for (const e of bad) expect((await handleRadarEvent(s.store, e, s.clock)).result).toBe('MALFORMED');
    // only radar:status changed; no attention, no index, no dedupe marks
    const added = [...s.store.data.keys()].filter((k) => !keysBefore.includes(k));
    expect(added).toEqual(['radar:status']);
    const r = await att(s, plan.planId);
    expect(r.items).toEqual([]);
    expect(r.monitoring).toBe('DEGRADED');
    expect(r.faults).toContain('MALFORMED_EVENT');
    // the fault ages out after the window; it is not erased by a later quiet success inside it
    await handleRadarEvent(s.store, linkEvt('created', '7', '1', '2'), s.clock);
    expect((await att(s, plan.planId)).faults).toContain('MALFORMED_EVENT');
    s.advance(RADAR_LIMITS.faultWindowMs + 1);
    expect((await att(s, plan.planId)).faults).not.toContain('MALFORMED_EVENT');
  });

  it('numeric ids in payloads are accepted; a link between two non-indexed issues writes no attention', async () => {
    const s = setup();
    await planFor(s);
    const r = await handleRadarEvent(s.store, { ...linkEvt('created', '1', '0', '0'), id: 77, sourceIssueId: 88888, destinationIssueId: 99999 }, s.clock);
    expect(r).toMatchObject({ result: 'PROCESSED', flaggedPlans: [] });
    expect([...s.store.data.keys()].some((k) => k.startsWith('radar:att:'))).toBe(false);
  });

  it('records lastObservedAt monotonically in radar:status', async () => {
    const s = setup();
    await planFor(s);
    await handleRadarEvent(s.store, linkEvt('created', '1', '1', '2'), s.clock);
    expect(s.store.data.get('radar:status')).toEqual({ lastObservedAt: T0.toISOString() });
    s.advance(60_000);
    await handleRadarEvent(s.store, linkEvt('created', '1', '1', '2'), s.clock); // duplicate still counts as observed
    expect((s.store.data.get('radar:status') as { lastObservedAt: string }).lastObservedAt).toBe(new Date(T0.getTime() + 60_000).toISOString());
  });

  it('bounded fan-out: at most maxPlansPerEvent plans flagged, FANOUT_CAPPED recorded, bounded index pages', async () => {
    const s = setup();
    const n = RADAR_LIMITS.maxPlansPerEvent + 10;
    for (let i = 0; i < n; i++) await s.store.set(radarKeys.idx('4242', `plan-${String(i).padStart(3, '0')}`), { planId: `plan-${String(i).padStart(3, '0')}`, owner: 'alice', issueKey: 'PAY-1' });
    let pages = 0;
    const list = s.store.listByPrefix!.bind(s.store);
    s.store.listByPrefix = async (p, c, l) => { pages++; return list(p, c, l); };
    const r = await handleRadarEvent(s.store, issueDeleted('4242'), s.clock);
    expect(r.flaggedPlans).toHaveLength(RADAR_LIMITS.maxPlansPerEvent);
    expect(r.faults).toContain('FANOUT_CAPPED');
    expect(pages).toBeLessThanOrEqual(RADAR_LIMITS.maxPages);
    expect((s.store.data.get('radar:status') as { lastError: { code: string } }).lastError.code).toBe('FANOUT_CAPPED');
    // even more index keys than maxPages x pageSize: listing stops at the page bound
    for (let i = n; i < RADAR_LIMITS.maxPages * RADAR_LIMITS.pageSize + 5; i++) await s.store.set(radarKeys.idx('4343', `plan-${i}`), { planId: `plan-${i}`, owner: 'alice', issueKey: 'X-1' });
    pages = 0;
    const r2 = await handleRadarEvent(s.store, issueDeleted('4343'), s.clock);
    expect(pages).toBe(RADAR_LIMITS.maxPages);
    expect(r2.faults).toContain('FANOUT_CAPPED');
  });

  it('attention keeps the first N signals and marks truncation (never overwritten with less)', async () => {
    const s = setup();
    const plan = await planFor(s);
    for (let i = 0; i < RADAR_LIMITS.maxSignalsPerPlan + 5; i++) await handleRadarEvent(s.store, linkEvt('created', String(1000 + i), s.id('PAY-1'), '5'), s.clock);
    const rec = s.store.data.get(radarKeys.att(plan.planId)) as { signals: { eventKey: string }[]; truncated: boolean; signalCount: number };
    expect(rec.signals).toHaveLength(RADAR_LIMITS.maxSignalsPerPlan);
    expect(rec.signals[0]!.eventKey).toBe(radarKeys.evt('1000', 'avi:jira:created:issuelink'));
    expect(rec.truncated).toBe(true);
    expect(rec.signalCount).toBe(RADAR_LIMITS.maxSignalsPerPlan + 5);
  });

  it('prefix collision: issue 1001 index is not hit by an event on issue 10010', async () => {
    const s = setup();
    await s.store.set(radarKeys.idx('1001', 'plan-a'), { planId: 'plan-a', owner: 'alice', issueKey: 'A-1' });
    const r = await handleRadarEvent(s.store, issueDeleted('10010'), s.clock);
    expect(r.flaggedPlans).toEqual([]);
  });

  it('makes no Jira calls and no Jira writes (handler has no Jira port; service-level counters unchanged)', async () => {
    const s = setup();
    await planFor(s);
    const writes = { ...s.jira.writes };
    const spy = vi.spyOn(s.jira, 'getIssue');
    const search = vi.spyOn(s.jira, 'searchIssues');
    await handleRadarEvent(s.store, linkEvt('created', '900', s.id('PAY-1'), s.id('PAY-2')), s.clock);
    await handleRadarEvent(s.store, issueDeleted(s.id('PAY-3')), s.clock);
    expect(spy).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(s.jira.writes).toEqual(writes);
  });

  it('a store without prefix query degrades instead of throwing', async () => {
    const s = setup();
    const { listByPrefix: _omit, ...rest } = s.store;
    const r = await handleRadarEvent(rest as Store, issueDeleted('1'), s.clock);
    expect(r).toMatchObject({ result: 'ERROR', faults: ['PREFIX_QUERY_UNAVAILABLE'] });
  });
});

describe('Decision Radar: getDecisionAttention (owner-only, read-only)', () => {
  it('cross-owner isolation: bob gets the same NOT_FOUND for alice\'s plan as for a missing one, and never sees it in his list', async () => {
    const s = setup();
    const plan = await planFor(s);
    await handleRadarEvent(s.store, linkEvt('created', '900', s.id('PAY-1'), '5'), s.clock);
    const other = await s.radar.getDecisionAttention(bob, { planId: plan.planId }).catch((e) => e);
    const missing = await s.radar.getDecisionAttention(bob, { planId: 'plan-nope' }).catch((e) => e);
    expect(other).toMatchObject({ code: 'NOT_FOUND' });
    expect(other.message).toBe(missing.message);
    const list = await s.radar.getDecisionAttention(bob, {});
    expect(list.items).toEqual([]);
    expect(list.monitoring).toBe('NOT_CONFIGURED');
    await expect(s.radar.getDecisionAttention({ ...alice, accountId: null }, {})).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('owner prefix collision ("bob" vs "bob:x") and forged owner index entries are filtered by the plan record', async () => {
    const s = setup();
    const plan = await planFor(s);
    await handleRadarEvent(s.store, linkEvt('created', '900', s.id('PAY-1'), '5'), s.clock);
    await s.store.set(radarKeys.own('bob', `x:${plan.planId}`), { planId: plan.planId }); // collision-shaped key
    await s.store.set(radarKeys.own('bob', plan.planId), { planId: plan.planId }); // forged hint
    expect((await s.radar.getDecisionAttention(bob, {})).items).toEqual([]);
  });

  it('lists the caller\'s own flagged plans and never writes', async () => {
    const s = setup();
    const p1 = await planFor(s);
    const p2 = await planFor(s);
    await planFor(s, bob);
    await handleRadarEvent(s.store, issueDeleted(s.id('PAY-4')), s.clock);
    const snapshot = JSON.stringify([...s.store.data.entries()]);
    const r = DecisionAttention.parse(await s.radar.getDecisionAttention(alice, {}));
    expect(r.items.map((i) => i.planId).sort()).toEqual([p1.planId, p2.planId].sort());
    expect(r.truncated).toBe(false);
    expect(JSON.stringify([...s.store.data.entries()])).toBe(snapshot);
  });

  it('is wired as an additive contract op and capability (CapabilityState string)', async () => {
    const s = setup();
    expect(OPERATIONS.getDecisionAttention).toBeDefined();
    const svc = withRadar(s.svc, s.store, s.clock);
    const caps = CapabilityAvailability.parse(await svc.getCapabilities());
    expect(caps.decisionRadar).toBe('AVAILABLE');
    expect(caps.operations).toContain('getDecisionAttention');
    // engine methods relying on `this` still work through the composition
    const snap = await svc.getGraphSnapshot(alice, { projectId: 'PAY', rootIssueKey: 'PAY-1', source: 'JIRA', maxDepth: 3 });
    expect(snap.snapshotId).toBeTruthy();
  });

  it('every radar key shape is a valid Forge KVS key', () => {
    for (const k of [radarKeys.idx('123456789012', 'plan-' + 'a'.repeat(36)), radarKeys.att('plan-x'), radarKeys.evt('1', 'avi:jira:deleted:issuelink'),
      radarKeys.status, radarKeys.own('557058:f58131cb-b67d-43c7-b30d-6b58d40bd077', 'plan-x'), radarKeys.idxPrefix('1')]) expect(isValidKvsKey(k) && FORGE_KVS_KEY.test(k)).toBe(true);
  });
});
