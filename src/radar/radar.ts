/**
 * Decision Radar, first slice (docs/design-core/DECISION_RADAR.md).
 * Jira link/issue events -> "needs review" hints on prevention plans whose evidence includes the touched issues.
 * Honesty rules (normative, from the design):
 * - Monotonic: the radar can only RAISE attention. Only a successful user-run checkPlanFreshness clears it.
 * - No auto-execution, no auto-invalidation. checkPlanFreshness / guardFreshEvidence remain the only verdict.
 * - ACTIVE means "listening, no known fault", never "fresh". Silence is never reported as "all clear".
 * - Any dropped work (invalid event, fan-out cap, storage error, unindexed evidence) is surfaced as DEGRADED with a reason.
 * Index keys use Jira issue IDs (link events carry ids, not keys): radar:idx:<issueId>:<planId>.
 * The event handler runs as the app and makes no Jira call.
 */
import type { Store } from '../core/ports';

export interface QueryableStore extends Store {
  /** Keys starting with `prefix`, at most `limit` (<= 100), paginated by an opaque cursor (never persisted). */
  query?<T>(prefix: string, limit: number, cursor: string | null): Promise<{ items: { key: string; value: T }[]; nextCursor: string | null }>;
}
export type RadarFactType = 'LINK_CREATED' | 'LINK_DELETED' | 'ISSUE_DELETED';
export interface RadarFact { factId: string; type: RadarFactType; issueIds: string[]; linkId: string | null; linkType: string | null; occurredAt: string; observedAt: string }
export type MonitoringState = 'NOT_CONFIGURED' | 'ACTIVE' | 'DEGRADED';
export type RadarReason = 'NO_QUERY' | 'NOT_INDEXED' | 'PARTIAL_INDEX' | 'INDEX_WRITE_FAILED' | 'FANOUT_CAPPED' | 'INVALID_EVENT' | 'STORAGE_ERROR';
export interface PlanAttention {
  planId: string;
  monitoring: { state: MonitoringState; reasons: RadarReason[]; lastObservedAt: string | null };
  coverage: { indexed: number; unindexed: number } | null;
  needsReview: boolean;
  items: RadarFact[];
  truncated: boolean;
  clearedAt: string | null;
  /** Always present: the radar is a hint, never a freshness verdict. */
  note: string;
}
interface Health { lastObservedAt: string | null; lastError: RadarReason | null; lastErrorAt: string | null }
interface Coverage { indexed: number; unindexed: number; failed: boolean; at: string }

export const RADAR_EVENTS = ['avi:jira:created:issuelink', 'avi:jira:deleted:issuelink', 'avi:jira:deleted:issue'] as const;
export const RADAR_LIMITS = { fanout: 200, attentionPage: 50, indexNodes: 500 } as const;
const NUM = /^\d{1,20}$/;
const PLAN = /^[A-Za-z0-9_-]{1,100}$/;
const K = {
  idx: (issueId: string, planId: string) => `radar:idx:${issueId}:${planId}`,
  idxPrefix: (issueId: string) => `radar:idx:${issueId}:`,
  seen: (factId: string) => `radar:seen:${factId}`,
  att: (planId: string, factId: string) => `radar:att:${planId}:${factId}`,
  attPrefix: (planId: string) => `radar:att:${planId}:`,
  cov: (planId: string) => `radar:cov:${planId}`,
  clear: (planId: string) => `radar:clear:${planId}`,
  health: 'radar:health'
};
const NOTE = 'Radar hints come from Jira events, which can be delayed or missed. No alert is not a freshness check: run "Re-check evidence" before approving or executing.';

/** Normalises a Forge product event. Returns null for anything that is not a usable radar fact. */
export function normaliseEvent(ev: unknown, observedAt: string): RadarFact | null {
  if (!ev || typeof ev !== 'object') return null;
  const e = ev as Record<string, unknown>;
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);
  const str = (v: unknown) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v : null);
  // Timestamp: documented as epoch ms; tolerate ISO strings and its absence (then the observation time is used and labelled).
  const rawTs = typeof e.timestamp === 'number' && Number.isFinite(e.timestamp) ? e.timestamp : typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : NaN;
  const occurredAt = Number.isFinite(rawTs) ? new Date(rawTs).toISOString() : observedAt;
  const type = str(e.eventType);
  if (type === 'avi:jira:created:issuelink' || type === 'avi:jira:deleted:issuelink') {
    // Live payloads (dev, 4 Nov 2026) did not match the flat documented shape: accept the fields flat or under `issueLink`.
    const l = obj(e.issueLink) ?? e;
    const linkId = str(l.id); const a = str(l.sourceIssueId); const b = str(l.destinationIssueId);
    if (!linkId || !NUM.test(linkId) || !a || !NUM.test(a) || !b || !NUM.test(b)) return null;
    const t: RadarFactType = type === 'avi:jira:created:issuelink' ? 'LINK_CREATED' : 'LINK_DELETED';
    const lt = obj(l.issueLinkType); const ltName = lt ? str(lt.name) ?? str(lt.outwardName) : null;
    // A link id is created and deleted once: type + link id is a stable fact id even without a timestamp.
    return { factId: `${t}.${linkId}`, type: t, issueIds: [...new Set([a, b])], linkId, linkType: ltName ? ltName.slice(0, 60) : null, occurredAt, observedAt };
  }
  if (type === 'avi:jira:deleted:issue') {
    const issue = obj(e.issue);
    const id = issue ? str(issue.id) : null;
    if (!id || !NUM.test(id)) return null;
    return { factId: `ISSUE_DELETED.${id}`, type: 'ISSUE_DELETED', issueIds: [id], linkId: null, linkType: null, occurredAt, observedAt };
  }
  return null;
}

/** Shape of an event for diagnostics: key names and value types only, never values (no PII, no content). */
export function eventShape(ev: unknown, depth = 0): unknown {
  if (!ev || typeof ev !== 'object' || depth > 2) return typeof ev;
  return Object.fromEntries(Object.entries(ev as Record<string, unknown>).slice(0, 30).map(([k, v]) => [k.slice(0, 40), eventShape(v, depth + 1)]));
}

export function createRadar(p: { store: QueryableStore; now: () => Date }) {
  const iso = () => p.now().toISOString();
  async function health(): Promise<Health> { return (await p.store.get<Health>(K.health)) ?? { lastObservedAt: null, lastError: null, lastErrorAt: null }; }
  async function recordHealth(ok: boolean, reason: RadarReason | null) {
    const h = await health();
    const next: Health = { lastObservedAt: ok ? iso() : h.lastObservedAt, lastError: reason ?? h.lastError, lastErrorAt: reason ? iso() : h.lastErrorAt };
    try { await p.store.set(K.health, next); } catch { /* health is best effort; never mask the original outcome */ }
  }
  async function scan<T>(prefix: string, max: number) {
    const out: { key: string; value: T }[] = []; let cursor: string | null = null; let truncated = false;
    do {
      const page: { items: { key: string; value: T }[]; nextCursor: string | null } = await p.store.query!<T>(prefix, Math.min(100, max - out.length + 1), cursor);
      for (const it of page.items) { if (out.length >= max) { truncated = true; break; } out.push(it); }
      cursor = page.nextCursor;
    } while (cursor && !truncated && out.length < max);
    if (cursor && out.length >= max) truncated = true;
    return { items: out, truncated };
  }

  return {
    /** Indexes the Jira issue ids of a plan's evidence. Best effort: failures are recorded as DEGRADED coverage, never thrown. */
    async indexPlan(planId: string, nodes: { kind?: string; attributes?: Record<string, unknown> }[]) {
      if (!PLAN.test(planId)) return;
      const idOf = (n: { attributes?: Record<string, unknown> }) => { const v = n.attributes?.jiraId; return typeof v === 'string' && NUM.test(v) ? v : null; };
      const issueNodes = nodes.filter((n) => n.kind === 'ISSUE' || n.kind === 'TEST');
      const all = [...new Set(issueNodes.map(idOf).filter((v): v is string => v !== null))];
      const ids = all.slice(0, RADAR_LIMITS.indexNodes);
      // Unindexed = issue evidence we cannot watch: known only by key (unreadable / not crawled) or beyond the index cap.
      const unindexed = issueNodes.filter((n) => idOf(n) === null).length + (all.length - ids.length);
      let failed = false;
      for (const id of ids) { try { await p.store.setIfAbsent(K.idx(id, planId), { at: iso() }); } catch { failed = true; } }
      try { await p.store.set<Coverage>(K.cov(planId), { indexed: ids.length, unindexed, failed, at: iso() }); } catch { /* reported as NOT_INDEXED on read */ }
    },

    /** Forge trigger handler body. Idempotent per fact; bounded fan-out; never calls Jira; never throws for bad input. */
    async onEvent(ev: unknown): Promise<{ status: 'IGNORED' | 'DUPLICATE' | 'RECORDED'; plans: number; capped: boolean }> {
      const fact = normaliseEvent(ev, iso());
      if (!fact) { await recordHealth(false, 'INVALID_EVENT'); return { status: 'IGNORED', plans: 0, capped: false }; }
      if (!p.store.query) { await recordHealth(true, 'NO_QUERY'); return { status: 'IGNORED', plans: 0, capped: false }; }
      try {
        if (!(await p.store.setIfAbsent(K.seen(fact.factId), { at: fact.observedAt }))) { await recordHealth(true, null); return { status: 'DUPLICATE', plans: 0, capped: false }; }
        const plans = new Set<string>(); let capped = false;
        for (const id of fact.issueIds) {
          const r = await scan<unknown>(K.idxPrefix(id), RADAR_LIMITS.fanout - plans.size);
          for (const it of r.items) { const pid = it.key.slice(K.idxPrefix(id).length); if (PLAN.test(pid)) plans.add(pid); }
          if (r.truncated) capped = true;
          if (plans.size >= RADAR_LIMITS.fanout) { capped = true; break; }
        }
        for (const pid of plans) await p.store.setIfAbsent(K.att(pid, fact.factId), fact);
        await recordHealth(true, capped ? 'FANOUT_CAPPED' : null);
        return { status: 'RECORDED', plans: plans.size, capped };
      } catch (e) {
        // Let the dedupe key go so a platform retry can redo the work; surface the fault.
        try { await p.store.delete(K.seen(fact.factId)); } catch { /* ignore */ }
        await recordHealth(false, 'STORAGE_ERROR');
        throw e;
      }
    },

    /** Attention for one plan. Caller must have authorised access to the plan (owner check in the service). */
    async attention(planId: string): Promise<PlanAttention> {
      const h = await health();
      const cov = (await p.store.get<Coverage>(K.cov(planId))) ?? null;
      const clear = (await p.store.get<{ at: string }>(K.clear(planId)))?.at ?? null;
      const reasons: RadarReason[] = [];
      let state: MonitoringState = 'ACTIVE';
      if (!p.store.query) { state = 'NOT_CONFIGURED'; reasons.push('NO_QUERY'); }
      else if (!cov || cov.indexed === 0) { state = 'NOT_CONFIGURED'; reasons.push('NOT_INDEXED'); }
      else {
        if (cov.failed) reasons.push('INDEX_WRITE_FAILED');
        if (cov.unindexed > 0) reasons.push('PARTIAL_INDEX');
        // A dropped event can only have mattered to a plan that was already being watched: errors recorded before this
        // plan was indexed (or before its last successful clear) do not degrade it.
        // Conservative at the boundary: an error in the same instant as indexing still counts; one at the clear does not.
        const relevant = (at: string) => (clear && clear >= cov.at ? at > clear : at >= cov.at);
        if (h.lastError && h.lastErrorAt && relevant(h.lastErrorAt)) reasons.push(h.lastError);
        if (reasons.length) state = 'DEGRADED';
      }
      let items: RadarFact[] = []; let truncated = false;
      if (p.store.query) {
        const r = await scan<RadarFact>(K.attPrefix(planId), RADAR_LIMITS.attentionPage);
        items = r.items.map((i) => i.value).filter((f) => !clear || f.observedAt > clear).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
        truncated = r.truncated;
      }
      return { planId, monitoring: { state, reasons: [...new Set(reasons)], lastObservedAt: h.lastObservedAt }, coverage: cov ? { indexed: cov.indexed, unindexed: cov.unindexed } : null,
        needsReview: items.length > 0, items, truncated, clearedAt: clear, note: NOTE };
    },

    /** Called only after a successful, user-run freshness check found no drift. */
    async clear(planId: string) { await p.store.set(K.clear(planId), { at: iso() }); }
  };
}
export type Radar = ReturnType<typeof createRadar>;
