/**
 * Native Jira workflow validator ("Decision Firewall" enforcement point). Opt-in: an admin adds it to a transition
 * of a company-managed workflow. Only issues labelled `anticipate-change` are gated; all others always pass.
 * A gated issue may transition only if its latest ANTICIPATE prevention plan is COMPLETED (all approved actions
 * verified in Jira). No graph crawl happens during a transition: it reads one stored decision record + the labels.
 * Availability policy: if ANTICIPATE storage/Jira is unreachable the validator FAILS OPEN (allows) and logs, so our
 * outage can never lock a team's workflow, unless an admin chose BLOCK and that choice is cached from a successful read; this is documented and visible in logs.
 * Removal: delete the validator from the transition in the workflow editor.
 * Attestations are scoped per owner+plan (decision:owner:issueKey:planId); legacy decision:issueKey
 * records are honored only when the caller expects no scope.
 */
import { stableHash } from '../packages/simulation-core/src/index';

/**
 * Decision attestation (schema 2). Written only when a plan reaches COMPLETED (every approved action verified in Jira).
 * It binds the authorization to: the exact issue, the plan + plan hash that was approved, the snapshot reviewed,
 * a digest of the issue's dependency links as re-read from Jira right after verified execution, and an expiry.
 * A COMPLETED plan is therefore NOT permanent authorization: new/removed links or expiry invalidate it.
 */
export interface DecisionRecord {
  planId: string; scenarioId: string; status: string; at: string;
  /** AccountId of the plan owner. Absent on records written before scoped attestations (legacy). */
  owner?: string | null;
  schema?: 2 | 3; issueKey?: string; verdict?: string; blockers?: number | null; allActionsVerified?: boolean;
  /** Verdict of the change itself (scenario without its migration assumptions) on live Jira evidence at completion. */
  currentVerdict?: string; currentBlockers?: number | null; planHash?: string; snapshotId?: string; linksDigest?: string | null; validUntil?: string | null;
}
export const ATTESTATION_VALID_DAYS = 14;

/** Last successfully read outage policy (warm-isolate memory). A BLOCK an admin chose keeps binding during a policy-read outage instead of silently degrading to ALLOW. */
let lastKnownPolicy: { onOutage: 'ALLOW' | 'BLOCK'; at: string } | null = null;
/** Test seam: Forge isolates are long-lived; tests reset the cache between cases. */
export function _resetPolicyCacheForTests(): void { lastKnownPolicy = null; }

/**
 * Scoped attestation keys (TOP7). Plans are private per owner, so attestations are too:
 * `decision:{owner}:{issueKey}:{planId}`. One plan can never overwrite another owner's attestation.
 * Legacy keys `decision:{issueKey}` (no owner/plan segments) are deprecated: the service still writes
 * them as a migration mirror for the current workflow wiring, but they stay last-writer-wins per issue
 * and their records are rejected as soon as a caller enforces an expected scope.
 */
export interface DecisionScope { owner?: string | null; planId?: string | null; }

export function decisionKey(owner: string, issueKey: string, planId: string): string {
  return `decision:${owner}:${issueKey}:${planId}`;
}

/** Parses scoped keys and legacy keys; returns null for anything else. */
export function parseDecisionKey(key: string): { owner: string; issueKey: string; planId: string } | { legacyIssueKey: string } | null {
  if (!key.startsWith('decision:')) return null;
  const parts = key.split(':');
  if (parts.length === 2 && parts[1]) return { legacyIssueKey: parts[1] };
  if (parts.length === 4 && parts[1] && parts[2] && parts[3]) return { owner: parts[1], issueKey: parts[2], planId: parts[3] };
  return null;
}

type Link = { typeName: string; direction: string; otherKey: string };
/** Order-independent digest of an issue's dependency links (type, direction, other issue). Ids are ignored. */
export function linksDigest(links: Link[]): string {
  return stableHash(links.map((l) => `${l.typeName}|${l.direction}|${l.otherKey}`).sort());
}

export function decideTransition(issue: { labels: string[]; links: Link[] } | null, decision: DecisionRecord | undefined, issueKey: string, now: Date = new Date(), expectedScope?: DecisionScope): { result: boolean; errorMessage?: string } {
  if (!issue || !issue.labels.includes('anticipate-change')) return { result: true };
  const block = (why: string) => ({ result: false, errorMessage: `ANTICIPATE Decision Firewall: ${issueKey} cannot move forward because ${why}. Open ANTICIPATE, review the consequences and complete a verified prevention plan.` });
  if (!decision) return block('no ANTICIPATE decision has been recorded');
  if (decision.issueKey && decision.issueKey !== issueKey) return block('the stored decision belongs to another issue');
  if (expectedScope?.owner != null) {
    if (decision.owner == null) return block(`plan ${decision.planId} was recorded before scoped attestations existed; re-run it to attest the current evidence`);
    if (decision.owner !== expectedScope.owner) return block('the stored decision belongs to another user');
  }
  if (expectedScope?.planId != null && decision.planId !== expectedScope.planId) return block(`the stored decision belongs to plan ${decision.planId}, not plan ${expectedScope.planId}`);
  if (decision.status === 'EVIDENCE_CHANGED') return block(`the dependency evidence changed after plan ${decision.planId} was approved`);
  if (decision.status === 'INVALIDATED') return block(`the evidence changed after plan ${decision.planId} was approved and the plan was invalidated`);
  if (decision.status !== 'COMPLETED') return block(`the latest prevention plan ${decision.planId} is ${decision.status}, not COMPLETED`);
  if (decision.schema !== 3 || !decision.linksDigest || !decision.validUntil || decision.allActionsVerified !== true) return block(`plan ${decision.planId} was completed before the current decision attestations existed; re-run it to attest the current evidence`);
  // Preventive tickets created for a BLOCKED option are work to do, not proof that the dependency was migrated.
  if (decision.verdict === 'BLOCKED' || (decision.blockers ?? 0) > 0) return block(`the option chosen in plan ${decision.planId} is BLOCKED by a safety rule; the preventive tickets record the work, they do not prove it is done. Re-analyse once the dependents have migrated`);
  if (decision.verdict !== 'PASS' && decision.verdict !== 'NEEDS_REVIEW') return block(`the verdict of plan ${decision.planId} is unknown`);
  // The chosen option may PASS only because it assumes consumers will migrate; the change itself must not be blocked by Jira evidence now.
  if (decision.currentVerdict === 'BLOCKED' || (decision.currentBlockers ?? 0) > 0) return block(`the option chosen in plan ${decision.planId} assumes work that Jira does not show as done yet (consumers still depend on it). Update the Jira links once consumers have migrated, then re-run the plan`);
  if (decision.currentVerdict !== 'PASS' && decision.currentVerdict !== 'NEEDS_REVIEW') return block(`the current evidence for plan ${decision.planId} could not be evaluated`);
  if (now.getTime() > new Date(decision.validUntil).getTime()) return block(`the decision attested by plan ${decision.planId} expired on ${decision.validUntil.slice(0, 10)}`);
  if (linksDigest(issue.links) !== decision.linksDigest) return block(`its dependency links changed after plan ${decision.planId} was verified`);
  return { result: true };
}

/**
 * Full validator run with an explicit outage policy. Any failure to read the issue or the decision is an outage, including a 403/404 issue read (R18).
 * Policy ALLOW (default): the transition passes and the degradation is logged. Policy BLOCK (opt-in by a Jira admin):
 * the transition is refused with a message that names the outage and the recovery path. If even the policy cannot be
 * read, ALLOW applies unless a BLOCK was cached from a previous successful read, so a full storage outage with no known policy can never lock every gated workflow.
 * When expectedScope is given, the decision must belong to that owner+plan (scoped attestations, TOP7).
 */
export async function runValidator(key: string, io: {
  readIssue(k: string): Promise<{ kind: string; issue?: { labels: string[]; links: Link[] } }>;
  readDecision(k: string): Promise<DecisionRecord | undefined>;
  readPolicy(): Promise<{ onOutage?: string } | undefined>;
  log(fields: Record<string, unknown>): void;
  now?: Date;
}, expectedScope?: DecisionScope): Promise<{ result: boolean; errorMessage?: string }> {
  const outage = async (reason: string, detail: string) => {
    let policy: 'ALLOW' | 'BLOCK' = 'ALLOW';
    let policySource: 'store' | 'cache' | 'default' = 'default';
    let cachedAt: string | null = null;
    try { policy = (await io.readPolicy())?.onOutage === 'BLOCK' ? 'BLOCK' : 'ALLOW'; policySource = 'store'; lastKnownPolicy = { onOutage: policy, at: new Date().toISOString() }; } catch { if (lastKnownPolicy?.onOutage === 'BLOCK') { policy = 'BLOCK'; policySource = 'cache'; cachedAt = lastKnownPolicy.at; } }
    io.log({ app: 'anticipate', op: 'validateTransition', outage: true, policy, policySource, ...(cachedAt ? { cachedAt } : {}), reason, detail: detail.slice(0, 200) });
    if (policy === 'BLOCK') return { result: false, errorMessage: policySource === 'cache' ? `ANTICIPATE Decision Firewall: ${key} cannot be verified right now (ANTICIPATE or Jira is unavailable) and your administrator's last known outage policy is Block${cachedAt ? ` (recorded ${cachedAt.slice(0, 10)})` : ''}. Try again in a few minutes, or ask a Jira administrator to switch the outage policy to Allow in ANTICIPATE Settings once the outage is over.` : `ANTICIPATE Decision Firewall: ${key} cannot be verified right now (ANTICIPATE or Jira is unavailable) and your administrator chose to block transitions during outages. Try again in a few minutes, or ask a Jira administrator to switch the outage policy to Allow in ANTICIPATE Settings.` };
    return { result: true };
  };
  try {
    const issue = await io.readIssue(key);
    // An issue the app cannot read (403/404 without exception) is unknown evidence, never "an issue without the label" (R18).
    if (issue.kind !== 'ok' || !issue.issue) return outage(`issue_${issue.kind}`, `issue read returned ${issue.kind}`);
    const decision = await io.readDecision(key);
    return decideTransition(issue.issue, decision, key, io.now ?? new Date(), expectedScope);
  } catch (e) {
    return outage('exception', e instanceof Error ? e.message : 'error');
  }
}
