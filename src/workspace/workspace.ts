/**
 * Enterprise Decision Workspace (PROTOTYPE, not wired to resolvers or UI).
 * Turns a private plan into a project-level shared decision with review, separation of duties and an append-only audit.
 * Rules (enforced server side, re-checked live on every call; nothing trusts the client):
 * - Sharing is explicit: only the plan owner shares, and only for a project they can browse. Private plans are unchanged.
 * - Viewing needs BROWSE_PROJECTS on the decision's project right now (removed access = immediate denial).
 * - Approving needs the approver permission right now, must differ from the proposer (separation of duties),
 *   is bound to the exact plan hash, expires, and is idempotent per approver.
 * - Execution readiness re-validates every approval: an approver who lost the permission revokes the decision.
 * - Every state change appends an audit entry under a new sequence key (setIfAbsent): history cannot be overwritten.
 */
import type { Ctx, Store } from '../core/ports';
import { fail } from '../core/errors';

export const APPROVER_PERMISSION = 'ADMINISTER_PROJECTS';
export const APPROVAL_VALID_DAYS = 7;
const KEY = /^[A-Z][A-Z0-9_]{0,19}$/;

export interface PlanRef { planId: string; owner: string; planHash: string; issueKey: string; projectKey: string }
export interface WorkspacePorts {
  store: Store; now: () => Date; newId: () => string;
  /** Live Jira permission of any account on a project (asApp permission check). */
  userHasPermission(accountId: string, projectKey: string, permission: string): Promise<boolean>;
  getPlan(planId: string): Promise<PlanRef | undefined>;
}
export type DecisionState = 'IN_REVIEW' | 'APPROVED' | 'REVOKED' | 'EXPIRED';
export interface SharedDecision {
  id: string; projectKey: string; issueKey: string; planId: string; planHash: string; proposer: string;
  createdAt: string; expiresAt: string; requiredApprovals: number; approvals: { by: string; at: string; planHash: string }[]; state: DecisionState; seq: number;
}
export interface AuditEntry { seq: number; at: string; by: string; event: string; detail?: string }

const decKey = (id: string) => `ws:dec:${id}`;
const logKey = (id: string, seq: number) => `ws:log:${id}:${String(seq).padStart(6, '0')}`;

export function createWorkspace(p: WorkspacePorts) {
  const who = (ctx: Ctx) => ctx.accountId ?? fail('PERMISSION_DENIED', 'An authenticated Jira account is required.');
  const load = async (id: string) => (await p.store.get<SharedDecision>(decKey(id))) ?? fail('NOT_FOUND', 'Shared decision not found.');
  const canView = async (acc: string, d: SharedDecision) => p.userHasPermission(acc, d.projectKey, 'BROWSE_PROJECTS');
  async function append(d: SharedDecision, by: string, event: string, detail?: string) {
    for (let i = 0; i < 5; i++) {
      const seq = d.seq + 1 + i;
      if (await p.store.setIfAbsent<AuditEntry>(logKey(d.id, seq), { seq, at: p.now().toISOString(), by, event, detail })) { d.seq = seq; return; }
    }
    fail('CONFLICT', 'Audit sequence contention; retry.');
  }
  async function guardedView(ctx: Ctx, id: string) {
    const acc = who(ctx); const d = await load(id);
    if (!(await canView(acc, d))) fail('PERMISSION_DENIED', 'You no longer have access to this project.');
    return { acc, d };
  }

  return {
    async share(ctx: Ctx, input: { planId: string; requiredApprovals?: number }) {
      const acc = who(ctx);
      const plan = await p.getPlan(input.planId);
      if (!plan || plan.owner !== acc) fail('PERMISSION_DENIED', 'Only the owner of a plan can share it.');
      if (!KEY.test(plan!.projectKey)) fail('VALIDATION', 'Invalid project.');
      if (!(await p.userHasPermission(acc, plan!.projectKey, 'BROWSE_PROJECTS'))) fail('PERMISSION_DENIED', 'You cannot share into a project you cannot browse.');
      const req = Math.min(Math.max(input.requiredApprovals ?? 1, 1), 3);
      const now = p.now();
      const d: SharedDecision = { id: `dec-${p.newId()}`, projectKey: plan!.projectKey, issueKey: plan!.issueKey, planId: plan!.planId, planHash: plan!.planHash,
        proposer: acc, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + APPROVAL_VALID_DAYS * 86400000).toISOString(),
        requiredApprovals: req, approvals: [], state: 'IN_REVIEW', seq: 0 };
      if (!(await p.store.setIfAbsent(decKey(d.id), d))) fail('CONFLICT', 'Decision id collision.');
      await append(d, acc, 'SHARED', `plan ${d.planId} hash ${d.planHash}, ${req} approval(s) required`);
      await p.store.set(decKey(d.id), d);
      return d;
    },

    async view(ctx: Ctx, id: string) {
      const { acc, d } = await guardedView(ctx, id);
      const eligible = acc !== d.proposer && (await p.userHasPermission(acc, d.projectKey, APPROVER_PERMISSION));
      const waitingOn = d.state === 'IN_REVIEW' ? `${d.requiredApprovals - d.approvals.length} approval(s) from a project administrator other than the proposer` : null;
      return { ...d, canApprove: eligible && d.state === 'IN_REVIEW' && !d.approvals.some((a) => a.by === acc),
        cannotApproveReason: acc === d.proposer ? 'SEPARATION_OF_DUTIES' : eligible ? null : 'MISSING_PERMISSION', waitingOn };
    },

    async approve(ctx: Ctx, input: { id: string; planHash: string }) {
      const { acc, d } = await guardedView(ctx, input.id);
      if (p.now().getTime() > new Date(d.expiresAt).getTime()) { d.state = 'EXPIRED'; await append(d, acc, 'EXPIRED'); await p.store.set(decKey(d.id), d); fail('CONFLICT', 'This review has expired; share the plan again.'); }
      if (d.state !== 'IN_REVIEW') fail('CONFLICT', `Decision is ${d.state}.`);
      if (acc === d.proposer) fail('PERMISSION_DENIED', 'Separation of duties: the proposer cannot approve their own decision.');
      if (!(await p.userHasPermission(acc, d.projectKey, APPROVER_PERMISSION))) fail('PERMISSION_DENIED', 'Approving needs the project administrator permission.');
      if (input.planHash !== d.planHash) fail('CONFLICT', 'The plan changed since it was shared; review the current version.');
      // One approval per approver, atomically (concurrent double clicks or two tabs cannot count twice).
      if (!(await p.store.setIfAbsent(`ws:appr:${d.id}:${acc}`, { at: p.now().toISOString() }))) return await this.view(ctx, d.id);
      const fresh = await load(d.id);
      fresh.approvals.push({ by: acc, at: p.now().toISOString(), planHash: d.planHash });
      await append(fresh, acc, 'APPROVED', `plan hash ${d.planHash}`);
      if (fresh.approvals.length >= fresh.requiredApprovals) { fresh.state = 'APPROVED'; await append(fresh, acc, 'READY'); }
      await p.store.set(decKey(fresh.id), fresh);
      return fresh;
    },

    /** Called right before execution: re-validates every approval live. Returns ok=false and revokes on any loss. */
    async readyToExecute(ctx: Ctx, id: string, currentPlanHash: string) {
      const { acc, d } = await guardedView(ctx, id);
      if (d.state !== 'APPROVED') return { ok: false, reason: `Decision is ${d.state}.` };
      if (currentPlanHash !== d.planHash) return { ok: false, reason: 'The plan changed after approval.' };
      for (const a of d.approvals) {
        if (!(await p.userHasPermission(a.by, d.projectKey, APPROVER_PERMISSION))) {
          d.state = 'REVOKED'; await append(d, acc, 'REVOKED', `approver ${a.by} lost ${APPROVER_PERMISSION}`); await p.store.set(decKey(d.id), d);
          return { ok: false, reason: 'An approver no longer holds the required permission; the approval was revoked.' };
        }
      }
      return { ok: true, reason: null };
    },

    async audit(ctx: Ctx, id: string) {
      const { d } = await guardedView(ctx, id);
      const out: AuditEntry[] = [];
      for (let s = 1; s <= d.seq; s++) { const e = await p.store.get<AuditEntry>(logKey(d.id, s)); if (e) out.push(e); }
      return out;
    }
  };
}
