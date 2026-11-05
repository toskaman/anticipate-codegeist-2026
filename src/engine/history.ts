/**
 * Decision Time Machine (read-only, pure). Turns the records ANTICIPATE already retains for a plan into an explainable
 * history: the baseline causal evidence (minimized provenance, 90 days), every recorded evidence re-check (bounded
 * checkpoints, each a diff against the baseline), the plan timeline, approvals and Decision Radar observations.
 *
 * Integrity rules: nothing is read from today's Jira here; missing or dropped history is reported as missing; a state
 * between two recorded checks is never interpolated.
 */
import type { DecisionCheckpoint, DecisionHistory, PreventionPlan } from '../../packages/contracts/src/index';
import { DECISION_HISTORY_LIMITS } from '../../packages/contracts/src/index';

type Edge = DecisionCheckpoint['added'][number];
export interface HistoryInput {
  plan: PreventionPlan; rootIssueKey: string;
  timeline: { at: string; event: string }[];
  approvals: { accountId: string | null; at: string; actionIds: string[]; planHash: string }[];
  baseline: { snapshotId: string; capturedAt: string; edges: { from: string; to: string; kind: string; status: string }[]; edgeCount: number } | null;
  evidenceState: 'LIVE' | 'EXPIRED_SNAPSHOT' | 'ARCHIVED';
  history: { dropped: number; items: DecisionCheckpoint[] } | null;
  radarItems: { type: string; occurredAt: string; observedAt: string; linkType: string | null; issueIds: string[] }[] | null;
}

import { compareCheckpoints, edgesAt } from '../../packages/contracts/src/index';
export { compareCheckpoints, edgesAt };
const edgeId = (e: Edge) => `${e.from}|${e.kind}|${e.to}`;
const byEdge = (a: Edge, b: Edge) => edgeId(a).localeCompare(edgeId(b));

export function buildHistory(i: HistoryInput): DecisionHistory {
  const L = DECISION_HISTORY_LIMITS;
  const baseEdges = (i.baseline?.edges ?? []).slice(0, L.maxBaselineEdges)
    .map((e) => ({ from: e.from, to: e.to, kind: e.kind, status: e.status }) as Edge).sort(byEdge);
  const base: DecisionCheckpoint = { id: 'cp-0', at: i.baseline?.capturedAt ?? i.plan.createdAt, kind: 'BASELINE', stage: 'snapshot', fresh: true,
    added: [], removed: [], becameUnknown: [], truncated: !i.baseline || (i.baseline.edges.length > L.maxBaselineEdges),
    reason: i.baseline ? `Evidence captured for the decision (snapshot ${i.baseline.snapshotId}).` : 'Baseline evidence is no longer retained.' };
  const checks = [...(i.history?.items ?? [])].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id, 'en', { numeric: true }));
  const checkpoints = [base, ...checks];

  const lastApproval = [...i.approvals].sort((a, b) => a.at.localeCompare(b.at)).at(-1) ?? null;
  const staleAfterApproval = lastApproval ? checks.find((c) => !c.fresh && c.at >= lastApproval.at) ?? null : null;
  const firstStale = checks.find((c) => !c.fresh) ?? null;
  const invalidating = ['EVIDENCE_CHANGED', 'INVALIDATED'].includes(i.plan.status) ? (staleAfterApproval ?? [...checks].reverse().find((c) => !c.fresh) ?? null) : staleAfterApproval;
  const can = i.plan.status === 'APPROVED' && !staleAfterApproval;
  const statusReason = can ? 'Approved and no recorded check found changed evidence since. Evidence is still re-checked live before any Jira write.'
    : invalidating ? `Cannot authorize execution: evidence changed (${invalidating.reason.slice(0, 200)}).`
      : i.plan.status === 'COMPLETED' ? 'Executed; actions were verified in Jira at the time.'
        : i.plan.status === 'PENDING_APPROVAL' || i.plan.status === 'DRAFT' ? 'Awaiting approval: nothing can be executed yet.'
          : `Status ${i.plan.status.toLowerCase().replace(/_/g, ' ')}: not an executable approval.`;

  const radarText: Record<string, string> = { LINK_CREATED: 'Jira link created', LINK_DELETED: 'Jira link deleted', ISSUE_DELETED: 'Jira issue deleted' };
  const events = [
    ...i.timeline.map((t) => ({ at: t.at, event: t.event.slice(0, 200), source: 'PLAN_TIMELINE' as const })),
    ...i.approvals.map((a) => ({ at: a.at, event: `${a.actionIds.length} action(s) approved for plan hash ${a.planHash.slice(0, 12)}`, source: 'APPROVAL' as const })),
    ...(i.radarItems ?? []).map((r) => ({ at: r.observedAt, event: `${radarText[r.type] ?? r.type}${r.linkType ? ` (${r.linkType})` : ''} on issue id(s) ${r.issueIds.join(', ')}`.slice(0, 200), source: 'RADAR' as const }))
  ].sort((a, b) => a.at.localeCompare(b.at) || a.source.localeCompare(b.source) || a.event.localeCompare(b.event)).slice(-L.maxEvents);

  const limits: string[] = ['Baseline holds causal relations only (depends on, uses, blocks, affects, verified by), as retained for the Passport.',
    'A checkpoint exists only when ANTICIPATE re-checked evidence (approval, execution or "Re-check evidence"); changes between checks are not interpolated.'];
  if (!i.baseline) limits.push('Baseline evidence is no longer retained: comparisons show deltas only.');
  if ((i.history?.dropped ?? 0) > 0) limits.push(`${i.history!.dropped} older checkpoint(s) were dropped (only the newest ${L.maxCheckpoints} are kept).`);
  if (i.radarItems === null) limits.push('Decision Radar observations are unavailable for this plan.');
  if (firstStale && !i.baseline) limits.push('Without the baseline, the before/after dependency path cannot be shown in full.');

  return {
    planId: i.plan.planId, rootIssueKey: i.rootIssueKey, scenarioId: i.plan.scenarioId, status: i.plan.status,
    canAuthorizeExecution: can, statusReason: statusReason.slice(0, 400),
    baseline: { snapshotId: i.baseline?.snapshotId ?? i.plan.snapshotId, capturedAt: base.at, evidenceState: i.evidenceState, edges: baseEdges,
      edgesTruncated: base.truncated, scope: 'CAUSAL_EDGES' },
    checkpoints, droppedCheckpoints: i.history?.dropped ?? 0, events,
    invalidation: invalidating ? { checkpointId: invalidating.id, at: invalidating.at, reason: invalidating.reason } : null,
    limits: limits.slice(0, 6), readOnly: true
  };
}
