/**
 * Resolver operations of the Enterprise Decision Workspace, behind capability flag sharedDecisions (off by default).
 * - Flag off: every workspace op fails with UNSUPPORTED (details.reason = 'FEATURE_DISABLED') after reading only the flag key;
 *   no workspace key (ws:*) is read or written and no Jira call is made.
 * - The flag lives under config:feature:sharedDecisions (config: keys never expire in forgeStore) and is set only by a Jira
 *   site admin (global ADMINISTER, checked as the caller, same pattern as setValidatorPolicy in src/engine/service.ts).
 * - Keep it off until the hosted two-account test has passed (docs/design-core/ENTERPRISE_WORKSPACE.md).
 * Output shapes are the SHARED_DECISION_OPERATIONS contracts in packages/contracts/src/index.ts.
 */
import type { FeatureFlag, SharedDecision, SharedDecisionAuditEvent } from '../../packages/contracts/src/index';
import { fail } from '../core/errors';
import type { Ctx, JiraPort } from '../core/ports';
import { createWorkspace, type AuditEntry, type DecisionView, type WorkspacePorts } from './workspace';

export const SHARED_DECISIONS_FLAG = 'sharedDecisions';
export const SHARED_DECISIONS_FLAG_KEY = 'config:feature:sharedDecisions';
/**
 * Release lock. Stays false until the execution gate has passed the hosted two-account acceptance test
 * (docs/design-core/ENTERPRISE_WORKSPACE.md). While false, enabling the flag is refused and a flag enabled by an
 * earlier version is ignored, so a Jira administrator cannot switch on a partially verified feature.
 */
export const SHARED_DECISIONS_RELEASED = false;
/** Op names served by createWorkspaceOps (all present in OPERATIONS of packages/contracts). */
export const WORKSPACE_OPERATION_NAMES = ['shareDecision', 'getSharedDecision', 'approveSharedDecision', 'rejectSharedDecision', 'revokeSharedDecision',
  'listDecisionAudit', 'getFeatureFlag', 'setFeatureFlag'] as const;

interface FlagRecord { enabled: boolean; updatedBy: string | null; updatedAt: string | null }
export interface WorkspaceOpsPorts extends WorkspacePorts {
  /** Global permissions of the CALLER (asUser), e.g. ADMINISTER. */
  globalPermissions: JiraPort['globalPermissions'];
  /** Overrides SHARED_DECISIONS_RELEASED (tests only). */
  released?: boolean;
}

function toContract(v: DecisionView): SharedDecision {
  return {
    id: v.id, projectKey: v.projectKey, issueKey: v.issueKey, planId: v.planId, version: v.version, planHash: v.planHash, proposer: v.proposer,
    createdAt: v.createdAt, expiresAt: v.expiresAt, requiredApprovals: v.requiredApprovals, state: v.state,
    approvals: v.approvals.map((a) => ({ by: a.by, at: a.at, planHash: a.planHash })), evidenceChanged: v.evidenceChanged, waitingFor: v.waitingFor,
    closed: v.closed ? { state: v.closed.state, at: v.closed.at, by: v.closed.by, reason: v.closed.reason } : null,
    capabilities: v.capabilities
  };
}
const toEvent = (decisionId: string, e: AuditEntry): SharedDecisionAuditEvent =>
  ({ id: `${decisionId}:${e.seq}`, decisionId, seq: e.seq, at: e.at, by: e.by, event: e.event, detail: e.detail ?? null });

export function createWorkspaceOps(p: WorkspaceOpsPorts) {
  const ws = createWorkspace(p);
  const readFlag = async () => (await p.store.get<FlagRecord>(SHARED_DECISIONS_FLAG_KEY)) ?? null;
  /** Strictly `enabled === true`: a missing, malformed or partially written record keeps the feature off. */
  // Per-environment unlock for hosted acceptance only: a Forge environment variable set on DEVELOPMENT
  // (forge variables set -e development ANTICIPATE_SHARED_DECISIONS_ACCEPTANCE true). Never set in production.
  const envUnlock = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.ANTICIPATE_SHARED_DECISIONS_ACCEPTANCE === 'true';
  const released = p.released ?? (SHARED_DECISIONS_RELEASED || envUnlock);
  const gate = async () => {
    if (!released) fail('UNSUPPORTED', 'Shared decisions are not released yet.', { feature: SHARED_DECISIONS_FLAG, reason: 'NOT_RELEASED' });
    if ((await readFlag())?.enabled !== true) {
      fail('UNSUPPORTED', 'Shared decisions are not enabled on this site. A Jira administrator can enable them.', { feature: SHARED_DECISIONS_FLAG, reason: 'FEATURE_DISABLED' });
    }
  };
  const isSiteAdmin = async () => !!(await p.globalPermissions(['ADMINISTER']))['ADMINISTER'];
  const requireUser = (ctx: Ctx) => { if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.'); };
  const checkFlagName = (flag: string) => { if (flag !== SHARED_DECISIONS_FLAG) fail('VALIDATION', 'Unknown feature flag.'); };

  return {
    async shareDecision(ctx: Ctx, input: { planId: string; requiredApprovals?: number }) { await gate(); return toContract(await ws.share(ctx, input)); },
    async getSharedDecision(ctx: Ctx, input: { id: string }) { await gate(); return toContract(await ws.view(ctx, input.id)); },
    async approveSharedDecision(ctx: Ctx, input: { id: string; planHash: string }) { await gate(); return toContract(await ws.approve(ctx, input)); },
    async rejectSharedDecision(ctx: Ctx, input: { id: string; reason: string }) { await gate(); return toContract(await ws.reject(ctx, input)); },
    async revokeSharedDecision(ctx: Ctx, input: { id: string; reason: string }) { await gate(); return toContract(await ws.revoke(ctx, input)); },
    async listDecisionAudit(ctx: Ctx, input: { id: string; cursor?: number | null; limit?: number }) {
      await gate();
      const page = await ws.auditPage(ctx, input.id, input.cursor ?? null, input.limit ?? 50);
      return { items: page.items.map((e) => toEvent(input.id, e)), nextCursor: page.nextCursor };
    },

    async getFeatureFlag(ctx: Ctx, input: { flag: string }): Promise<FeatureFlag> {
      requireUser(ctx); checkFlagName(input.flag);
      const cur = await readFlag();
      return { flag: 'sharedDecisions', enabled: released && cur?.enabled === true, updatedBy: cur?.updatedBy ?? null, updatedAt: cur?.updatedAt ?? null, canEdit: await isSiteAdmin(), released };
    },
    async setFeatureFlag(ctx: Ctx, input: { flag: string; enabled: boolean }): Promise<FeatureFlag> {
      requireUser(ctx); checkFlagName(input.flag);
      if (typeof input.enabled !== 'boolean') fail('VALIDATION', 'enabled must be a boolean.');
      if (!(await isSiteAdmin())) fail('PERMISSION_DENIED', 'Only Jira administrators can change feature flags.');
      if (input.enabled && !released) fail('UNSUPPORTED', 'Shared decisions cannot be enabled yet: they are pending hosted acceptance.', { feature: SHARED_DECISIONS_FLAG, reason: 'NOT_RELEASED' });
      const rec: FlagRecord = { enabled: input.enabled, updatedBy: ctx.accountId, updatedAt: p.now().toISOString() };
      await p.store.set(SHARED_DECISIONS_FLAG_KEY, rec);
      console.warn(JSON.stringify({ app: 'anticipate', op: 'setFeatureFlag', flag: input.flag, enabled: input.enabled, accountId: ctx.accountId }));
      return { flag: 'sharedDecisions', ...rec, canEdit: true, released };
    }
  };
}
export type WorkspaceOps = ReturnType<typeof createWorkspaceOps>;
