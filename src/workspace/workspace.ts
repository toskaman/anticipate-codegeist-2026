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
 * Concurrency (Forge KVS has no transactions): nothing that must not be lost is written with get-modify-set.
 * - The decision record is written once (setIfAbsent) and only holds immutable fields.
 * - Approvals claim numbered slots ws:slot:<id>:<n> (n = 1..requiredApprovals) with setIfAbsent; slots fill as a prefix.
 *   A per-approver marker (setIfAbsent) prevents one approver from claiming two slots. The approval list and the APPROVED
 *   state are derived from the slots on every read; whoever claims the last slot logs READY (exactly once).
 * - REVOKED / EXPIRED are recorded with setIfAbsent on ws:term:<id> (first writer wins; it alone logs the event) and
 *   are also derived on read (expiry from the clock), so a lost or late write cannot resurrect a decision.
 * - The audit log is read by probing sequence keys forward until a bounded run of empty keys, never via a stored counter.
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
export interface Approval { by: string; at: string; planHash: string }
/** Immutable record stored once under ws:dec:<id>. */
export interface DecisionRecord {
  id: string; projectKey: string; issueKey: string; planId: string; planHash: string; proposer: string;
  createdAt: string; expiresAt: string; requiredApprovals: number;
}
/** Derived view of a decision (record + slots + terminal marker + clock). */
export interface SharedDecision extends DecisionRecord { approvals: Approval[]; state: DecisionState }
export interface AuditEntry { seq: number; at: string; by: string; event: string; detail?: string }
interface Terminal { state: 'REVOKED' | 'EXPIRED'; at: string; by: string; reason: string }

export const MAX_APPROVALS = 3;
/** Upper bound on audit entries per decision and the run of empty keys tolerated when reading. */
const MAX_LOG = 10_000;
const LOG_GAP = 5;
const ID = /^dec-[A-Za-z0-9_-]{1,64}$/;
const ACCOUNT = /^[A-Za-z0-9:._-]{1,128}$/;

const decKey = (id: string) => `ws:dec:${id}`;
const slotKey = (id: string, n: number) => `ws:slot:${id}:${n}`;
const markKey = (id: string, acc: string) => `ws:appr:${id}:${acc}`;
const termKey = (id: string) => `ws:term:${id}`;
const logKey = (id: string, seq: number) => `ws:log:${id}:${String(seq).padStart(6, '0')}`;

export function createWorkspace(p: WorkspacePorts) {
  const who = (ctx: Ctx) => {
    const acc = ctx.accountId ?? fail('PERMISSION_DENIED', 'An authenticated Jira account is required.');
    if (!ACCOUNT.test(acc)) fail('PERMISSION_DENIED', 'Unsupported account id.');
    return acc;
  };
  const checkId = (id: string) => { if (typeof id !== 'string' || !ID.test(id)) fail('VALIDATION', 'Invalid decision id.'); return id; };
  const loadRecord = async (id: string) => (await p.store.get<DecisionRecord>(decKey(checkId(id)))) ?? fail('NOT_FOUND', 'Shared decision not found.');
  const expired = (r: DecisionRecord) => p.now().getTime() > new Date(r.expiresAt).getTime();

  async function readSlots(r: DecisionRecord): Promise<Approval[]> {
    const out: Approval[] = []; const seen = new Set<string>();
    for (let n = 1; n <= r.requiredApprovals; n++) {
      const a = await p.store.get<Approval>(slotKey(r.id, n));
      if (!a) break; // slots fill as a prefix: a failed claim on n means n is taken
      if (a.planHash === r.planHash && !seen.has(a.by)) { seen.add(a.by); out.push(a); }
    }
    return out;
  }
  /** Derives the authoritative state; never trusts a mutable stored state. */
  async function derive(r: DecisionRecord): Promise<SharedDecision> {
    const approvals = await readSlots(r);
    const term = await p.store.get<Terminal>(termKey(r.id));
    const state: DecisionState = term ? term.state : expired(r) ? 'EXPIRED' : approvals.length >= r.requiredApprovals ? 'APPROVED' : 'IN_REVIEW';
    return { ...r, approvals, state };
  }

  async function append(id: string, by: string, event: string, detail?: string) {
    for (let seq = 1; seq <= MAX_LOG; seq++) {
      if (await p.store.setIfAbsent<AuditEntry>(logKey(id, seq), { seq, at: p.now().toISOString(), by, event, detail })) return seq;
    }
    return fail('CONFLICT', 'Audit log is full.');
  }
  /** Records a terminal state; only the first writer wins and logs it. */
  async function terminate(id: string, state: Terminal['state'], by: string, reason: string) {
    if (await p.store.setIfAbsent<Terminal>(termKey(id), { state, at: p.now().toISOString(), by, reason })) await append(id, by, state, reason);
  }
  async function guardedView(ctx: Ctx, id: string) {
    const acc = who(ctx); const r = await loadRecord(id);
    if (!(await p.userHasPermission(acc, r.projectKey, 'BROWSE_PROJECTS'))) fail('PERMISSION_DENIED', 'You no longer have access to this project.');
    return { acc, r };
  }
  async function present(acc: string, d: SharedDecision) {
    const eligible = acc !== d.proposer && (await p.userHasPermission(acc, d.projectKey, APPROVER_PERMISSION));
    const waitingOn = d.state === 'IN_REVIEW' ? `${d.requiredApprovals - d.approvals.length} approval(s) from a project administrator other than the proposer` : null;
    return { ...d, canApprove: eligible && d.state === 'IN_REVIEW' && !d.approvals.some((a) => a.by === acc),
      cannotApproveReason: acc === d.proposer ? 'SEPARATION_OF_DUTIES' : eligible ? null : 'MISSING_PERMISSION', waitingOn };
  }

  return {
    async share(ctx: Ctx, input: { planId: string; requiredApprovals?: number }) {
      const acc = who(ctx);
      const plan = await p.getPlan(input.planId);
      if (!plan || plan.owner !== acc) fail('PERMISSION_DENIED', 'Only the owner of a plan can share it.');
      if (!KEY.test(plan!.projectKey)) fail('VALIDATION', 'Invalid project.');
      if (!(await p.userHasPermission(acc, plan!.projectKey, 'BROWSE_PROJECTS'))) fail('PERMISSION_DENIED', 'You cannot share into a project you cannot browse.');
      const req = Math.min(Math.max(Math.trunc(Number(input.requiredApprovals ?? 1)) || 1, 1), MAX_APPROVALS);
      const now = p.now();
      const r: DecisionRecord = { id: checkId(`dec-${p.newId()}`), projectKey: plan!.projectKey, issueKey: plan!.issueKey, planId: plan!.planId, planHash: plan!.planHash,
        proposer: acc, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + APPROVAL_VALID_DAYS * 86400000).toISOString(), requiredApprovals: req };
      if (!(await p.store.setIfAbsent(decKey(r.id), r))) fail('CONFLICT', 'Decision id collision.');
      await append(r.id, acc, 'SHARED', `plan ${r.planId} hash ${r.planHash}, ${req} approval(s) required`);
      return derive(r);
    },

    async view(ctx: Ctx, id: string) {
      const { acc, r } = await guardedView(ctx, id);
      return present(acc, await derive(r));
    },

    async approve(ctx: Ctx, input: { id: string; planHash: string }) {
      const { acc, r } = await guardedView(ctx, input.id);
      const d = await derive(r);
      if (d.state === 'EXPIRED') { await terminate(r.id, 'EXPIRED', acc, 'review window elapsed'); fail('CONFLICT', 'This review has expired; share the plan again.'); }
      if (d.state !== 'IN_REVIEW' && !d.approvals.some((a) => a.by === acc)) fail('CONFLICT', `Decision is ${d.state}.`);
      if (acc === r.proposer) fail('PERMISSION_DENIED', 'Separation of duties: the proposer cannot approve their own decision.');
      if (!(await p.userHasPermission(acc, r.projectKey, APPROVER_PERMISSION))) fail('PERMISSION_DENIED', 'Approving needs the project administrator permission.');
      if (input.planHash !== r.planHash) fail('CONFLICT', 'The plan changed since it was shared; review the current version.');
      // One slot per approver, atomically (concurrent double clicks or two tabs cannot count twice).
      if (!(await p.store.setIfAbsent(markKey(r.id, acc), { at: p.now().toISOString() }))) return present(acc, await derive(r));
      const approval: Approval = { by: acc, at: p.now().toISOString(), planHash: r.planHash };
      let claimed = 0;
      for (let n = 1; n <= r.requiredApprovals && !claimed; n++) if (await p.store.setIfAbsent(slotKey(r.id, n), approval)) claimed = n;
      if (!claimed) fail('CONFLICT', 'Decision already has all required approvals.');
      await append(r.id, acc, 'APPROVED', `plan hash ${r.planHash}`);
      if (claimed === r.requiredApprovals) await append(r.id, acc, 'READY');
      return present(acc, await derive(r));
    },

    /** Called right before execution: re-validates every approval live. Returns ok=false and revokes on any loss. */
    async readyToExecute(ctx: Ctx, id: string, currentPlanHash: string) {
      const { acc, r } = await guardedView(ctx, id);
      const d = await derive(r);
      if (d.state === 'EXPIRED') { await terminate(r.id, 'EXPIRED', acc, 'approval window elapsed before execution'); return { ok: false, reason: 'Decision is EXPIRED.' }; }
      if (d.state !== 'APPROVED') return { ok: false, reason: `Decision is ${d.state}.` };
      if (currentPlanHash !== r.planHash) return { ok: false, reason: 'The plan changed after approval.' };
      for (const a of d.approvals) {
        if (!(await p.userHasPermission(a.by, r.projectKey, APPROVER_PERMISSION))) {
          await terminate(r.id, 'REVOKED', acc, `approver ${a.by} lost ${APPROVER_PERMISSION}`);
          return { ok: false, reason: 'An approver no longer holds the required permission; the approval was revoked.' };
        }
      }
      // A concurrent revocation/expiry may have landed while we were checking: re-read the terminal marker last.
      if ((await derive(r)).state !== 'APPROVED') return { ok: false, reason: 'Decision changed during validation.' };
      return { ok: true, reason: null };
    },

    async audit(ctx: Ctx, id: string) {
      const { r } = await guardedView(ctx, id);
      const out: AuditEntry[] = [];
      for (let s = 1, empty = 0; s <= MAX_LOG && empty < LOG_GAP; s++) {
        const e = await p.store.get<AuditEntry>(logKey(r.id, s));
        if (e) { out.push(e); empty = 0; } else empty++;
      }
      return out;
    }
  };
}
