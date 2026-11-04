/**
 * Decision Radar, slice 1 (docs/design-core/DECISION_RADAR.md).
 *
 * Jira link/issue events -> "needs review" hints on prevention plans whose evidence touches the affected issues.
 * The radar only RAISES flags: it never clears one, never changes plan status, never calls or writes Jira and never
 * executes anything. `checkPlanFreshness` (as the user, full recompute) stays the only freshness verdict.
 *
 * Storage (Forge KVS, keys must match [a-zA-Z0-9:._\s\-#], <= 500 chars):
 *   radar:idx:<issueId>:<planId>   -> RadarIndexEntry   (one key per evidence issue and plan; prefix-queried per issue)
 *   radar:own:<accountId>:<planId> -> { planId }        (lets an owner list their own monitored plans)
 *   radar:att:<planId>             -> AttentionRecord   (bounded, append-only list of signals)
 *   radar:evt:<id>:<eventType>     -> { at }            (dedupe mark, 7-day TTL via retentionFor)
 *   radar:status                   -> RadarStatus       (installation-wide monitoring availability)
 */
import type { DecisionAttention, DecisionAttentionItem, GraphSnapshot } from '../../packages/contracts/src/index';
import { fail } from '../core/errors';
import type { Ctx, Store } from '../core/ports';

export type RadarReason = 'LINK_CREATED' | 'LINK_DELETED' | 'ISSUE_DELETED';
export type MonitoringState = 'NOT_CONFIGURED' | 'ACTIVE' | 'DEGRADED';
export type RadarFault = DecisionAttention['faults'][number];

export const RADAR_EVENTS = {
  'avi:jira:created:issuelink': 'LINK_CREATED',
  'avi:jira:deleted:issuelink': 'LINK_DELETED',
  'avi:jira:deleted:issue': 'ISSUE_DELETED'
} as const satisfies Record<string, RadarReason>;

export const RADAR_LIMITS = {
  /** Plans flagged per event (inline in the 25 s trigger budget); beyond this the status records FANOUT_CAPPED. */
  maxPlansPerEvent: 50,
  /** Prefix-query pages per lookup, each of `pageSize` keys (KVS max 100). */
  maxPages: 5,
  pageSize: 100,
  /** Signals kept per plan: the FIRST ones are kept, later ones only set `truncated` (never drop earlier information). */
  maxSignalsPerPlan: 20,
  /** Evidence issues indexed per plan (snapshots are capped at 200 nodes). */
  maxIndexedIssues: 200,
  /** Owner listing in getDecisionAttention. */
  maxListedPlans: 100,
  /** A recorded handler fault keeps monitoring DEGRADED for this long. */
  faultWindowMs: 24 * 3600_000
} as const;

const FORGE_KVS_KEY = /^(?!\s+$)[a-zA-Z0-9:._\s\-#]+$/;
export const isValidKvsKey = (k: string) => typeof k === 'string' && k.length > 0 && k.length <= 500 && FORGE_KVS_KEY.test(k);
const JIRA_ID = /^[0-9]{1,20}$/;
const PLAN_ID = /^[A-Za-z0-9._-]{1,200}$/;

export const radarKeys = {
  idxPrefix: (issueId: string) => `radar:idx:${issueId}:`, // trailing ":" keeps 1001 from matching 10010
  idx: (issueId: string, planId: string) => `radar:idx:${issueId}:${planId}`,
  ownPrefix: (owner: string) => `radar:own:${owner}:`,
  own: (owner: string, planId: string) => `radar:own:${owner}:${planId}`,
  att: (planId: string) => `radar:att:${planId}`,
  evt: (id: string, eventType: string) => `radar:evt:${id}:${eventType}`,
  status: 'radar:status'
};

// ---------------------------------------------------------------- plan indexing

/** Stored on the plan record (plans outlive snapshots: 90 d vs 2 d). */
export interface RadarPlanInfo {
  /** issueKey -> Jira issue id for every readable evidence issue that has one. */
  evidenceIssueIds: Record<string, string>;
  indexedCount: number;
  /** Evidence issues without a usable id (unreadable, not crawled, legacy): the plan is NOT fully monitored. */
  unindexedCount: number;
  faults: RadarFault[];
  indexedAt: string;
}
interface RadarIndexEntry { planId: string; owner: string; issueKey: string }

/** Pure: which evidence issues of a snapshot can be monitored by id. */
export function radarCoverage(snapshot: GraphSnapshot): { evidenceIssueIds: Record<string, string>; unindexedCount: number } {
  const evidenceIssueIds: Record<string, string> = {};
  let unindexedCount = 0;
  for (const n of snapshot.nodes) {
    if ((n.kind !== 'ISSUE' && n.kind !== 'TEST') || !n.id.startsWith('issue:')) continue;
    const id = n.attributes['jiraId'];
    const key = n.id.slice('issue:'.length);
    if (n.status !== 'UNKNOWN' && typeof id === 'string' && JIRA_ID.test(id) && Object.keys(evidenceIssueIds).length < RADAR_LIMITS.maxIndexedIssues) evidenceIssueIds[key] = id;
    else unindexedCount++;
  }
  return { evidenceIssueIds, unindexedCount };
}

/**
 * Writes the radar index for a freshly stored plan. Never throws: plan creation must not fail because monitoring
 * could not be set up; failures are recorded as faults so the plan reports DEGRADED instead of ACTIVE.
 */
export async function indexPlanForRadar(store: Store, input: { planId: string; owner: string | null; snapshot: GraphSnapshot; at: string }): Promise<RadarPlanInfo> {
  const { evidenceIssueIds, unindexedCount } = input.snapshot.mode === 'LIVE' ? radarCoverage(input.snapshot) : { evidenceIssueIds: {}, unindexedCount: 0 };
  const faults: RadarFault[] = [];
  if (unindexedCount > 0) faults.push('PARTIAL_INDEX');
  const info: RadarPlanInfo = { evidenceIssueIds, indexedCount: 0, unindexedCount, faults, indexedAt: input.at };
  const owner = input.owner;
  const entries = Object.entries(evidenceIssueIds);
  if (!owner || !entries.length) return info;
  try {
    let written = 0;
    // Bounded parallel batches (red-team W3-2): up to 200 sequential sets could eat the resolver's time budget.
    const valid = entries.map(([issueKey, issueId]) => ({ issueKey, k: radarKeys.idx(issueId, input.planId) })).filter((x) => isValidKvsKey(x.k));
    for (let i = 0; i < valid.length; i += 10) {
      const batch = valid.slice(i, i + 10);
      const res = await Promise.allSettled(batch.map((x) => store.set<RadarIndexEntry>(x.k, { planId: input.planId, owner, issueKey: x.issueKey })));
      written += res.filter((r) => r.status === 'fulfilled').length;
    }
    info.indexedCount = written;
    if (written < entries.length) faults.push('INDEX_WRITE_FAILED');
    const own = radarKeys.own(owner, input.planId);
    if (isValidKvsKey(own)) await store.set(own, { planId: input.planId });
    else faults.push('INDEX_WRITE_FAILED');
  } catch {
    if (!faults.includes('INDEX_WRITE_FAILED')) faults.push('INDEX_WRITE_FAILED');
  }
  return info;
}

// ---------------------------------------------------------------- event handling

export type RadarFact = { reason: RadarReason; eventType: keyof typeof RADAR_EVENTS; eventKey: string; issueIds: string[]; selfGenerated: boolean; occurredAt: string | null };
export type Normalized = { kind: 'fact'; fact: RadarFact } | { kind: 'ignored' } | { kind: 'malformed'; detail: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const jiraId = (v: unknown): string | null => {
  const s = typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? String(v) : typeof v === 'string' ? v.trim() : null;
  return s && JIRA_ID.test(s) ? s : null;
};

/** Events are data: validate the shape defensively and keep only ids. Never trusts or stores free text. */
export function normalizeEvent(event: unknown, now: Date): Normalized {
  if (!isObj(event)) return { kind: 'malformed', detail: 'event is not an object' };
  const eventType = event['eventType'];
  if (typeof eventType !== 'string' || !(eventType in RADAR_EVENTS)) return { kind: 'ignored' };
  const type = eventType as keyof typeof RADAR_EVENTS;
  const ts = typeof event['timestamp'] === 'number' && Number.isFinite(event['timestamp']) ? new Date(event['timestamp']) : null;
  const occurredAt = ts && !Number.isNaN(ts.getTime()) && Math.abs(ts.getTime() - now.getTime()) < 366 * 86_400_000 ? ts.toISOString() : null;
  const selfGenerated = event['selfGenerated'] === true;
  if (type === 'avi:jira:deleted:issue') {
    const id = isObj(event['issue']) ? jiraId(event['issue']['id']) : null;
    if (!id) return { kind: 'malformed', detail: 'deleted:issue without a numeric issue.id' };
    return { kind: 'fact', fact: { reason: RADAR_EVENTS[type], eventType: type, eventKey: radarKeys.evt(id, type), issueIds: [id], selfGenerated, occurredAt } };
  }
  // Documented fields are top level (id, sourceIssueId, destinationIssueId); accept a nested `issueLink` object defensively.
  const src = isObj(event['issueLink']) && event['sourceIssueId'] === undefined ? event['issueLink'] : event;
  const linkId = jiraId(src['id']);
  const ids = [jiraId(src['sourceIssueId']), jiraId(src['destinationIssueId'])];
  if (!linkId || !ids[0] || !ids[1]) return { kind: 'malformed', detail: `${type} without numeric id/sourceIssueId/destinationIssueId` };
  return { kind: 'fact', fact: { reason: RADAR_EVENTS[type], eventType: type, eventKey: radarKeys.evt(linkId, type), issueIds: [...new Set(ids as string[])], selfGenerated, occurredAt } };
}

export interface RadarSignal { reason: RadarReason; eventKey: string; observedAt: string; occurredAt: string | null;
  /** Only ids/keys that are part of THIS plan's evidence (from the index), never the other endpoint. */
  issueIds: string[]; issueKeys: string[]; externalEndpoint: boolean; selfGenerated: boolean }
export interface AttentionRecord { planId: string; owner: string; firstAt: string; lastAt: string; signalCount: number; truncated: boolean; signals: RadarSignal[] }
export interface RadarStatus { lastObservedAt: string | null; lastError?: { code: RadarFault; at: string } }

export interface RadarOutcome { result: 'IGNORED' | 'MALFORMED' | 'DUPLICATE' | 'PROCESSED' | 'ERROR'; flaggedPlans: string[]; faults: RadarFault[] }

/** Bounded prefix listing: at most maxPages pages; reports whether more remained. */
async function listBounded<T>(store: Store, prefix: string, maxPages: number): Promise<{ items: { key: string; value: T }[]; more: boolean }> {
  if (!store.listByPrefix) throw Object.assign(new Error('prefix query unavailable'), { radarFault: 'PREFIX_QUERY_UNAVAILABLE' as RadarFault });
  const items: { key: string; value: T }[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const r: { items: { key: string; value: T }[]; nextCursor: string | null } = await store.listByPrefix<T>(prefix, cursor, RADAR_LIMITS.pageSize);
    items.push(...r.items);
    cursor = r.nextCursor;
    if (!cursor) return { items, more: false };
  }
  return { items, more: true };
}

async function recordStatus(store: Store, at: string, fault: RadarFault | null) {
  const prev = (await store.get<RadarStatus>(radarKeys.status).catch(() => undefined)) ?? { lastObservedAt: null };
  const last = prev.lastObservedAt && prev.lastObservedAt > at ? prev.lastObservedAt : at;
  const next: RadarStatus = { lastObservedAt: last };
  if (fault) next.lastError = { code: fault, at };
  else if (prev.lastError) next.lastError = prev.lastError; // a fault is never erased by a later quiet success; it ages out (faultWindowMs)
  await store.set(radarKeys.status, next);
}

/** Append-safe: keeps the first N signals, never removes or overwrites earlier information, idempotent per eventKey. */
async function appendAttention(store: Store, planId: string, owner: string, signal: RadarSignal): Promise<void> {
  const key = radarKeys.att(planId);
  const cur = await store.get<AttentionRecord>(key);
  const valid = isObj(cur) && Array.isArray((cur as AttentionRecord).signals) && (cur as AttentionRecord).owner === owner;
  if (valid && cur!.signals.some((s) => s.eventKey === signal.eventKey)) return; // redelivery: already recorded
  const base: AttentionRecord = valid ? cur! : { planId, owner, firstAt: signal.observedAt, lastAt: signal.observedAt, signalCount: 0, truncated: false, signals: [] };
  const next: AttentionRecord = { ...base, lastAt: signal.observedAt > base.lastAt ? signal.observedAt : base.lastAt, signalCount: base.signalCount + 1 };
  if (base.signals.length < RADAR_LIMITS.maxSignalsPerPlan) next.signals = [...base.signals, signal];
  else next.truncated = true;
  await store.set(key, next);
}

/**
 * Trigger handler body. No Jira port is passed in on purpose: the radar cannot read or write Jira.
 * At-least-once: the dedupe mark is written AFTER the attention writes; appends are idempotent per eventKey,
 * so a crash in between only causes a harmless re-append on redelivery.
 */
export async function handleRadarEvent(store: Store, event: unknown, now: () => Date): Promise<RadarOutcome> {
  const at = now().toISOString();
  const n = normalizeEvent(event, now());
  if (n.kind === 'ignored') return { result: 'IGNORED', flaggedPlans: [], faults: [] };
  try {
    if (n.kind === 'malformed') {
      await recordStatus(store, at, 'MALFORMED_EVENT');
      return { result: 'MALFORMED', flaggedPlans: [], faults: ['MALFORMED_EVENT'] };
    }
    const f = n.fact;
    if (!isValidKvsKey(f.eventKey)) { await recordStatus(store, at, 'MALFORMED_EVENT'); return { result: 'MALFORMED', flaggedPlans: [], faults: ['MALFORMED_EVENT'] }; }
    if ((await store.get(f.eventKey)) !== undefined) { await recordStatus(store, at, null); return { result: 'DUPLICATE', flaggedPlans: [], faults: [] }; }

    const faults: RadarFault[] = [];
    const byPlan = new Map<string, { owner: string; ids: Set<string>; keys: Set<string> }>();
    for (const issueId of f.issueIds) {
      const { items, more } = await listBounded<RadarIndexEntry>(store, radarKeys.idxPrefix(issueId), RADAR_LIMITS.maxPages);
      if (more && !faults.includes('FANOUT_CAPPED')) faults.push('FANOUT_CAPPED');
      for (const it of items) {
        const v = it.value;
        if (!isObj(v) || typeof v.planId !== 'string' || !PLAN_ID.test(v.planId) || typeof v.owner !== 'string' || it.key !== radarKeys.idx(issueId, v.planId)) continue;
        const e = byPlan.get(v.planId) ?? { owner: v.owner, ids: new Set<string>(), keys: new Set<string>() };
        if (e.owner !== v.owner) continue;
        e.ids.add(issueId);
        if (typeof v.issueKey === 'string' && v.issueKey.length <= 50) e.keys.add(v.issueKey);
        byPlan.set(v.planId, e);
      }
    }
    const planIds = [...byPlan.keys()].sort();
    if (planIds.length > RADAR_LIMITS.maxPlansPerEvent && !faults.includes('FANOUT_CAPPED')) faults.push('FANOUT_CAPPED');
    const flagged = planIds.slice(0, RADAR_LIMITS.maxPlansPerEvent);
    for (const planId of flagged) {
      const e = byPlan.get(planId)!;
      await appendAttention(store, planId, e.owner, { reason: f.reason, eventKey: f.eventKey, observedAt: at, occurredAt: f.occurredAt,
        issueIds: [...e.ids].sort(), issueKeys: [...e.keys].sort(), externalEndpoint: f.issueIds.some((id) => !e.ids.has(id)), selfGenerated: f.selfGenerated });
    }
    await store.setIfAbsent(f.eventKey, { at });
    await recordStatus(store, at, faults[0] ?? null);
    return { result: 'PROCESSED', flaggedPlans: flagged, faults };
  } catch (e) {
    const fault: RadarFault = (e as { radarFault?: RadarFault })?.radarFault ?? 'HANDLER_ERROR';
    await recordStatus(store, at, fault).catch(() => undefined);
    console.warn(JSON.stringify({ app: 'anticipate', op: 'radarOnJiraEvent', fault, detail: e instanceof Error ? e.message.slice(0, 200) : undefined }));
    return { result: 'ERROR', flaggedPlans: [], faults: [fault] };
  }
}

// ---------------------------------------------------------------- read side

const DISCLAIMER = 'Radar alerts are hints; only a freshness check confirms evidence.' as const;
interface PlanLike { owner: string | null; radar?: RadarPlanInfo }

function planMonitoring(rec: PlanLike, installFault: RadarFault | null): { monitoring: MonitoringState; faults: RadarFault[] } {
  if (!rec.radar) return { monitoring: 'NOT_CONFIGURED', faults: ['LEGACY_PLAN_NOT_INDEXED'] };
  if (rec.radar.indexedCount === 0) return { monitoring: 'NOT_CONFIGURED', faults: [...rec.radar.faults] };
  const faults = [...new Set([...rec.radar.faults, ...(installFault ? [installFault] : [])])];
  return { monitoring: faults.length ? 'DEGRADED' : 'ACTIVE', faults };
}

function toItem(planId: string, att: AttentionRecord | undefined, m: { monitoring: MonitoringState; faults: RadarFault[] }): DecisionAttentionItem | null {
  if (!att || !Array.isArray(att.signals) || !att.signals.length) return null;
  const reasons: RadarReason[] = [];
  for (const s of att.signals) if (!reasons.includes(s.reason)) reasons.push(s.reason);
  return { planId, reasons, observedAt: att.firstAt, lastSignalAt: att.lastAt, signalCount: att.signalCount, truncated: att.truncated,
    evidenceIssueKeys: [...new Set(att.signals.flatMap((s) => s.issueKeys))].sort().slice(0, 50), externalEndpoint: att.signals.some((s) => s.externalEndpoint),
    monitoring: m.monitoring, faults: m.faults.slice(0, 10) };
}

/** Read-only. Owner-only (plans are private): another user's plan and a missing plan give the same NOT_FOUND. */
export function createRadarOps(store: Store, now: () => Date) {
  return {
    async getDecisionAttention(ctx: Ctx, input: { planId?: string }): Promise<DecisionAttention> {
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
      const me = ctx.accountId!;
      const status = await store.get<RadarStatus>(radarKeys.status);
      const lastObservedAt = status?.lastObservedAt ?? null;
      const recent = status?.lastError && now().getTime() - Date.parse(status.lastError.at) < RADAR_LIMITS.faultWindowMs ? status.lastError.code : null;
      const loadOwned = async (planId: string) => {
        if (!PLAN_ID.test(planId)) return null;
        const rec = await store.get<PlanLike>(`plan:${planId}`);
        return rec && rec.owner === me ? rec : null;
      };
      if (input.planId) {
        const rec = await loadOwned(input.planId);
        if (!rec) fail('NOT_FOUND', 'Plan not found.');
        const m = planMonitoring(rec!, recent);
        const item = toItem(input.planId, await store.get<AttentionRecord>(radarKeys.att(input.planId)), m);
        return { monitoring: m.monitoring, faults: m.faults.slice(0, 10), lastObservedAt, items: item ? [item] : [], truncated: false, disclaimer: DISCLAIMER };
      }
      const ownPrefix = radarKeys.ownPrefix(me);
      if (!isValidKvsKey(ownPrefix) || !store.listByPrefix) {
        return { monitoring: 'DEGRADED', faults: ['PREFIX_QUERY_UNAVAILABLE'], lastObservedAt, items: [], truncated: false, disclaimer: DISCLAIMER };
      }
      const pages = Math.ceil(RADAR_LIMITS.maxListedPlans / RADAR_LIMITS.pageSize);
      const own = await listBounded<{ planId?: unknown }>(store, ownPrefix, pages);
      // The listed key must be exactly <ownPrefix><planId>: guards against prefix collisions between account ids ("a" vs "a:b").
      const planIds = [...new Set(own.items.flatMap((i) => (isObj(i.value) && typeof i.value.planId === 'string' && i.key === `${ownPrefix}${i.value.planId}` ? [i.value.planId] : [])))];
      const truncated = own.more || planIds.length > RADAR_LIMITS.maxListedPlans;
      const items: DecisionAttentionItem[] = [];
      let anyIndexed = false;
      const faults = new Set<RadarFault>(recent ? [recent] : []);
      for (const planId of planIds.slice(0, RADAR_LIMITS.maxListedPlans)) {
        const rec = await loadOwned(planId); // the owner index is a hint; the plan record decides ownership
        if (!rec) continue;
        const m = planMonitoring(rec, recent);
        if (m.monitoring !== 'NOT_CONFIGURED') anyIndexed = true;
        m.faults.forEach((x) => faults.add(x));
        const item = toItem(planId, await store.get<AttentionRecord>(radarKeys.att(planId)), m);
        if (item) items.push(item);
      }
      items.sort((a, b) => (a.observedAt === b.observedAt ? a.planId.localeCompare(b.planId) : a.observedAt.localeCompare(b.observedAt)));
      const monitoring: MonitoringState = !anyIndexed ? 'NOT_CONFIGURED' : faults.size ? 'DEGRADED' : 'ACTIVE';
      return { monitoring, faults: [...faults].slice(0, 10), lastObservedAt, items, truncated, disclaimer: DISCLAIMER };
    }
  };
}

/** Composes the radar into the resolver service without touching the engine (capabilities + one read-only op). */
export function withRadar<S extends { getCapabilities(): Promise<import('../../packages/contracts/src/index').CapabilityAvailability> }>(svc: S, store: Store, now: () => Date) {
  const radar = createRadarOps(store, now);
  // Spread keeps the engine's methods callable as `this.x` (approvePlan -> this.markExpired, simulatePortfolio -> this.getGraphSnapshot).
  return {
    ...svc,
    getDecisionAttention: radar.getDecisionAttention,
    async getCapabilities() {
      const caps = await svc.getCapabilities();
      return { ...caps, decisionRadar: 'AVAILABLE' as const, operations: [...new Set([...caps.operations, 'getDecisionAttention'])] };
    }
  };
}
