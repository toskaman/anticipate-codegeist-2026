/**
 * Enterprise Decision Workspace — behind capability flag sharedDecisions (off by default).
 * Resolver operations live in src/workspace/ops.ts; they refuse every call (no workspace storage touched) until a Jira
 * site admin enables the flag. Keep it off until the hosted two-account test has passed (docs/design-core/ENTERPRISE_WORKSPACE.md).
 * Turns a private plan into a project-level shared decision with review, separation of duties and an append-only audit.
 * Rules (enforced server side, re-checked live on every call; nothing trusts the client):
 * - Sharing is explicit: only the plan owner shares, and only for a project they can browse. Private plans are unchanged.
 * - Viewing needs BROWSE_PROJECTS on the decision's project right now (removed access = immediate denial).
 * - Approving needs the approver permission right now, must differ from the proposer (separation of duties),
 *   is bound to the exact plan hash, expires, and is idempotent per approver. If the plan's current hash differs from the
 *   shared one (or the plan was invalidated / is gone) approval is refused with EVIDENCE_CHANGED.
 * - Rejecting needs the approver permission, is refused to the proposer and to an approver who already approved, needs an
 *   explicit reason and is terminal (REJECTED). Revoking is open to the proposer or a project administrator, needs an explicit
 *   reason and is terminal (REVOKED).
 * - Execution readiness re-validates every approval: an approver who lost the permission revokes the decision.
 * - Every state change appends an audit entry under a new sequence key (setIfAbsent): history cannot be overwritten.
 * Concurrency (Forge KVS has no transactions): nothing that must not be lost is written with get-modify-set.
 * - The decision record is written once (setIfAbsent) and only holds immutable fields.
 * - Approvals claim numbered slots ws:slot:<id>:<n> (n = 1..requiredApprovals) with setIfAbsent; slots fill as a prefix.
 *   A per-approver marker (setIfAbsent) prevents one approver from claiming two slots. The approval list and the APPROVED
 *   state are derived from the slots on every read; whoever claims the last slot logs READY (exactly once).
 * - REJECTED / REVOKED / EXPIRED are recorded with setIfAbsent on ws:term:<id> (first writer wins; it alone logs the event,
 *   a losing reject/revoke gets CONFLICT) and the terminal marker overrides any slot state, so a lost or late write cannot
 *   resurrect a decision. Expiry is also derived on read from the clock.
 * - The audit log is read by probing sequence keys forward until a bounded run of empty keys, never via a stored counter.
 */
import type { Ctx, Store } from '../core/ports';
import { fail } from '../core/errors';

export const APPROVER_PERMISSION = 'ADMINISTER_PROJECTS';
export const APPROVAL_VALID_DAYS = 7;
const KEY = /^[A-Z][A-Z0-9_]{0,19}$/;

/** Current state of a plan as stored by the engine; evidenceChanged = the plan was marked EVIDENCE_CHANGED / INVALIDATED. */
export interface PlanRef { planId: string; owner: string; planHash: string; issueKey: string; projectKey: string; evidenceChanged?: boolean }
export interface WorkspacePorts {
  store: Store; now: () => Date; newId: () => string;
  /** Live Jira permission of any account on a project (asApp permission check). */
  userHasPermission(accountId: string, projectKey: string, permission: string): Promise<boolean>;
  getPlan(planId: string): Promise<PlanRef | undefined>;
}
export type TerminalState = 'REJECTED' | 'REVOKED' | 'EXPIRED';
export type DecisionState = 'IN_REVIEW' | 'APPROVED' | TerminalState;
export interface Approval { by: string; at: string; planHash: string }
/** Immutable record stored once under ws:dec:<id>. */
export interface DecisionRecord {
  id: string; projectKey: string; issueKey: string; planId: string; planHash: string; proposer: string;
  createdAt: string; expiresAt: string; requiredApprovals: number;
}
export interface Terminal { state: TerminalState; at: string; by: string; reason: string }
/** Derived view of a decision (record + slots + terminal marker + clock). */
export interface SharedDecision extends DecisionRecord { approvals: Approval[]; state: DecisionState; closed: Terminal | null }
export type AuditEvent = 'SHARED' | 'APPROVED' | 'READY' | TerminalState;
export interface AuditEntry { seq: number; at: string; by: string; event: AuditEvent; detail?: string }
/** Closed reason codes (mirrors SharedDecisionReasonCode in packages/contracts). null = allowed. */
export type ReasonCode = 'NOT_IN_ROLE' | 'PROPOSER' | 'EXPIRED' | 'EVIDENCE_CHANGED' | 'REVOKED' | 'REJECTED' | 'ALREADY_APPROVED' | 'MISSING_PERMISSION' | 'AWAITING_APPROVAL';
export interface Capability { allowed: boolean; reason: ReasonCode | null }
/** What an actor sees: the derived decision plus its own live capabilities. */
export interface DecisionView extends SharedDecision {
  version: string; evidenceChanged: boolean; waitingFor: string | null;
  capabilities: { canApprove: Capability; canReject: Capability; canRevoke: Capability; canExecute: Capability };
}

export const MAX_APPROVALS = 3;
export const AUDIT_PAGE_MAX = 100;
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
  const checkReason = (reason: unknown) => {
    const t = typeof reason === 'string' ? reason.trim() : '';
    if (t.length < 3 || t.length > 500) fail('VALIDATION', 'An explicit reason (3 to 500 characters) is required.');
    return t;
  };
  const loadRecord = async (id: string) => (await p.store.get<DecisionRecord>(decKey(checkId(id)))) ?? fail('NOT_FOUND', 'Shared decision not found.');
  const expired = (r: DecisionRecord) => p.now().getTime() > new Date(r.expiresAt).getTime();
  const isApprover = (acc: string, r: DecisionRecord) => p.userHasPermission(acc, r.projectKey, APPROVER_PERMISSION);
  /** Fail closed: a missing, invalidated or re-hashed plan means the evidence the decision was shared on is gone. */
  const evidenceChanged = async (r: DecisionRecord) => {
    const plan = await p.getPlan(r.planId);
    return !plan || plan.planHash !== r.planHash || plan.evidenceChanged === true;
  };

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
    const term = (await p.store.get<Terminal>(termKey(r.id))) ?? null;
    const state: DecisionState = term ? term.state : expired(r) ? 'EXPIRED' : approvals.length >= r.requiredApprovals ? 'APPROVED' : 'IN_REVIEW';
    return { ...r, approvals, state, closed: term };
  }

  async function append(id: string, by: string, event: AuditEvent, detail?: string) {
    for (let seq = 1; seq <= MAX_LOG; seq++) {
      if (await p.store.setIfAbsent<AuditEntry>(logKey(id, seq), { seq, at: p.now().toISOString(), by, event, ...(detail !== undefined ? { detail } : {}) })) return seq;
    }
    return fail('CONFLICT', 'Audit log is full.');
  }
  /** Records a terminal state; only the first writer wins and logs it. Returns whether this call won. */
  async function terminate(id: string, state: TerminalState, by: string, reason: string) {
    const won = await p.store.setIfAbsent<Terminal>(termKey(id), { state, at: p.now().toISOString(), by, reason });
    if (won) await append(id, by, state, reason);
    return won;
  }
  async function guardedView(ctx: Ctx, id: string) {
    const acc = who(ctx); const r = await loadRecord(id);
    if (!(await p.userHasPermission(acc, r.projectKey, 'BROWSE_PROJECTS'))) fail('PERMISSION_DENIED', 'You no longer have access to this project.');
    return { acc, r };
  }
  /** An open decision past its window is closed as EXPIRED (first writer wins) and the caller gets CONFLICT. */
  async function refuseIfExpired(d: SharedDecision, acc: string, why: string) {
    if (d.state !== 'EXPIRED') return;
    await terminate(d.id, 'EXPIRED', acc, why);
    fail('CONFLICT', 'This review has expired; share the plan again.');
  }

  async function present(acc: string, d: SharedDecision): Promise<DecisionView> {
    const changed = await evidenceChanged(d);
    const admin = await isApprover(acc, d);
    const proposer = acc === d.proposer;
    const mine = d.approvals.some((a) => a.by === acc);
    const closed: ReasonCode | null = d.state === 'IN_REVIEW' || d.state === 'APPROVED' ? null : d.state;
    const cap = (...reasons: (ReasonCode | null)[]): Capability => { const reason = reasons.find((x) => x !== null) ?? null; return { allowed: reason === null, reason }; };
    const reviewer = (): (ReasonCode | null)[] => [closed, proposer ? 'PROPOSER' : null, admin ? null : 'MISSING_PERMISSION',
      mine || d.state === 'APPROVED' ? 'ALREADY_APPROVED' : null, changed ? 'EVIDENCE_CHANGED' : null];
    const stale = 'The plan changed since it was shared; the proposer must share the current version.';
    const waitingFor = closed ? null : changed ? stale
      : d.state === 'IN_REVIEW' ? `${d.requiredApprovals - d.approvals.length} more approval(s) from a project administrator other than the proposer`
        : 'Execution by the proposer';
    return { ...d, version: d.planHash, evidenceChanged: changed, waitingFor, capabilities: {
      canApprove: cap(...reviewer()),
      canReject: cap(...reviewer()),
      canRevoke: cap(closed, proposer || admin ? null : 'MISSING_PERMISSION'),
      canExecute: cap(closed, proposer ? null : 'NOT_IN_ROLE', d.state === 'APPROVED' ? null : 'AWAITING_APPROVAL', changed ? 'EVIDENCE_CHANGED' : null)
    } };
  }

  return {
    async share(ctx: Ctx, input: { planId: string; requiredApprovals?: number }) {
      const acc = who(ctx);
      const plan = await p.getPlan(input.planId);
      if (!plan || plan.owner !== acc) fail('PERMISSION_DENIED', 'Only the owner of a plan can share it.');
      if (!KEY.test(plan!.projectKey)) fail('VALIDATION', 'Invalid project.');
      if (plan!.evidenceChanged) fail('EVIDENCE_CHANGED', 'This plan was invalidated by an evidence change; regenerate it before sharing.');
      if (!(await p.userHasPermission(acc, plan!.projectKey, 'BROWSE_PROJECTS'))) fail('PERMISSION_DENIED', 'You cannot share into a project you cannot browse.');
      const req = Math.min(Math.max(Math.trunc(Number(input.requiredApprovals ?? 1)) || 1, 1), MAX_APPROVALS);
      const now = p.now();
      const r: DecisionRecord = { id: checkId(`dec-${p.newId()}`), projectKey: plan!.projectKey, issueKey: plan!.issueKey, planId: plan!.planId, planHash: plan!.planHash,
        proposer: acc, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + APPROVAL_VALID_DAYS * 86400000).toISOString(), requiredApprovals: req };
      if (!(await p.store.setIfAbsent(decKey(r.id), r))) fail('CONFLICT', 'Decision id collision.');
      await append(r.id, acc, 'SHARED', `plan ${r.planId} hash ${r.planHash}, ${req} approval(s) required`);
      return present(acc, await derive(r));
    },

    async view(ctx: Ctx, id: string) {
      const { acc, r } = await guardedView(ctx, id);
      return present(acc, await derive(r));
    },

    async approve(ctx: Ctx, input: { id: string; planHash: string }) {
      const { acc, r } = await guardedView(ctx, input.id);
      const d = await derive(r);
      await refuseIfExpired(d, acc, 'review window elapsed');
      if (d.state !== 'IN_REVIEW' && !d.approvals.some((a) => a.by === acc)) fail('CONFLICT', `Decision is ${d.state}.`);
      if (acc === r.proposer) fail('PERMISSION_DENIED', 'Separation of duties: the proposer cannot approve their own decision.');
      if (!(await isApprover(acc, r))) fail('PERMISSION_DENIED', 'Approving needs the project administrator permission.');
      if (input.planHash !== r.planHash) fail('CONFLICT', 'The plan changed since it was shared; review the current version.');
      if (await evidenceChanged(r)) fail('EVIDENCE_CHANGED', 'The plan behind this decision changed or was invalidated since it was shared; it can no longer be approved.');
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

    /** Terminal REJECTED by a permitted approver (not the proposer, not someone who already approved), with an explicit reason. */
    async reject(ctx: Ctx, input: { id: string; reason: string }) {
      const reason = checkReason(input.reason);
      const { acc, r } = await guardedView(ctx, input.id);
      if (acc === r.proposer) fail('PERMISSION_DENIED', 'The proposer cannot reject their own decision; revoke it instead.');
      if (!(await isApprover(acc, r))) fail('PERMISSION_DENIED', 'Rejecting needs the project administrator permission.');
      const d = await derive(r);
      await refuseIfExpired(d, acc, 'review window elapsed');
      if (d.state !== 'IN_REVIEW') fail('CONFLICT', `Decision is ${d.state}.`);
      if (d.approvals.some((a) => a.by === acc)) fail('CONFLICT', 'You already approved this decision; revoke it instead of rejecting.');
      if (!(await terminate(r.id, 'REJECTED', acc, reason))) fail('CONFLICT', `Decision was already closed (${(await derive(r)).state}).`);
      return present(acc, await derive(r));
    },

    /** Terminal REVOKED by the proposer or a project administrator, with an explicit reason. Open (IN_REVIEW / APPROVED) decisions only. */
    async revoke(ctx: Ctx, input: { id: string; reason: string }) {
      const reason = checkReason(input.reason);
      const { acc, r } = await guardedView(ctx, input.id);
      if (acc !== r.proposer && !(await isApprover(acc, r))) fail('PERMISSION_DENIED', 'Only the proposer or a project administrator can revoke a decision.');
      const d = await derive(r);
      await refuseIfExpired(d, acc, 'review window elapsed');
      if (d.state !== 'IN_REVIEW' && d.state !== 'APPROVED') fail('CONFLICT', `Decision is ${d.state}.`);
      if (!(await terminate(r.id, 'REVOKED', acc, reason))) fail('CONFLICT', `Decision was already closed (${(await derive(r)).state}).`);
      return present(acc, await derive(r));
    },

    /** Called right before execution: re-validates every approval live. Returns ok=false and revokes on any loss. */
    async readyToExecute(ctx: Ctx, id: string, currentPlanHash: string) {
      const { acc, r } = await guardedView(ctx, id);
      const d = await derive(r);
      if (d.state === 'EXPIRED') { await terminate(r.id, 'EXPIRED', acc, 'approval window elapsed before execution'); return { ok: false, reason: 'Decision is EXPIRED.' }; }
      if (d.state !== 'APPROVED') return { ok: false, reason: `Decision is ${d.state}.` };
      if (currentPlanHash !== r.planHash || (await evidenceChanged(r))) return { ok: false, reason: 'The plan changed after approval.' };
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

    /** Full audit (bounded by MAX_LOG). Prefer auditPage for resolvers. */
    async audit(ctx: Ctx, id: string) {
      const { r } = await guardedView(ctx, id);
      const out: AuditEntry[] = [];
      for (let s = 1, empty = 0; s <= MAX_LOG && empty < LOG_GAP; s++) {
        const e = await p.store.get<AuditEntry>(logKey(r.id, s));
        if (e) { out.push(e); empty = 0; } else empty++;
      }
      return out;
    },

    /** Bounded page of the audit log after `cursor` (= seq of the last entry already received). nextCursor null = end. */
    async auditPage(ctx: Ctx, id: string, cursor: number | null, limit: number) {
      const { r } = await guardedView(ctx, id);
      const max = Math.min(Math.max(Math.trunc(Number(limit)) || 1, 1), AUDIT_PAGE_MAX);
      const from = Math.min(Math.max(Math.trunc(Number(cursor ?? 0)) || 0, 0), MAX_LOG) + 1;
      const items: AuditEntry[] = []; let more = false;
      for (let s = from, empty = 0; s <= MAX_LOG && empty < LOG_GAP; s++) {
        const e = await p.store.get<AuditEntry>(logKey(r.id, s));
        if (!e) { empty++; continue; }
        empty = 0;
        if (items.length === max) { more = true; break; }
        items.push(e);
      }
      return { items, nextCursor: more ? items[items.length - 1]!.seq : null };
    }
  };
}
