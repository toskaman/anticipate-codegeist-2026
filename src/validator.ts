/**
 * Native Jira workflow validator ("Decision Firewall" enforcement point). Opt-in: an admin adds it to a transition
 * of a company-managed workflow. Only issues labelled `anticipate-change` are gated; all others always pass.
 * A gated issue may transition only if its latest ANTICIPATE prevention plan is COMPLETED (all approved actions
 * verified in Jira). No graph crawl happens during a transition: it reads one stored decision record + the labels.
 * Availability policy: if ANTICIPATE storage/Jira is unreachable the validator FAILS OPEN (allows) and logs, so our
 * outage can never lock a team's workflow; this is documented and visible in logs.
 * Removal: delete the validator from the transition in the workflow editor.
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
  schema?: 2 | 3; issueKey?: string; verdict?: string; blockers?: number | null; allActionsVerified?: boolean; planHash?: string; snapshotId?: string; linksDigest?: string | null; validUntil?: string | null;
}
export const ATTESTATION_VALID_DAYS = 14;

type Link = { typeName: string; direction: string; otherKey: string };
/** Order-independent digest of an issue's dependency links (type, direction, other issue). Ids are ignored. */
export function linksDigest(links: Link[]): string {
  return stableHash(links.map((l) => `${l.typeName}|${l.direction}|${l.otherKey}`).sort());
}

export function decideTransition(issue: { labels: string[]; links: Link[] } | null, decision: DecisionRecord | undefined, issueKey: string, now: Date = new Date()): { result: boolean; errorMessage?: string } {
  if (!issue || !issue.labels.includes('anticipate-change')) return { result: true };
  const block = (why: string) => ({ result: false, errorMessage: `ANTICIPATE Decision Firewall: ${issueKey} cannot move forward because ${why}. Open ANTICIPATE, review the consequences and complete a verified prevention plan.` });
  if (!decision) return block('no ANTICIPATE decision has been recorded');
  if (decision.issueKey && decision.issueKey !== issueKey) return block('the stored decision belongs to another issue');
  if (decision.status === 'EVIDENCE_CHANGED') return block(`the dependency evidence changed after plan ${decision.planId} was approved`);
  if (decision.status !== 'COMPLETED') return block(`the latest prevention plan ${decision.planId} is ${decision.status}, not COMPLETED`);
  if (decision.schema !== 3 || !decision.linksDigest || !decision.validUntil || decision.allActionsVerified !== true) return block(`plan ${decision.planId} was completed before the current decision attestations existed; re-run it to attest the current evidence`);
  // Preventive tickets created for a BLOCKED option are work to do, not proof that the dependency was migrated.
  if (decision.verdict === 'BLOCKED' || (decision.blockers ?? 0) > 0) return block(`the option chosen in plan ${decision.planId} is BLOCKED by a safety rule; the preventive tickets record the work, they do not prove it is done. Re-analyse once the dependents have migrated`);
  if (decision.verdict !== 'PASS' && decision.verdict !== 'NEEDS_REVIEW') return block(`the verdict of plan ${decision.planId} is unknown`);
  if (now.getTime() > new Date(decision.validUntil).getTime()) return block(`the decision attested by plan ${decision.planId} expired on ${decision.validUntil.slice(0, 10)}`);
  if (linksDigest(issue.links) !== decision.linksDigest) return block(`its dependency links changed after plan ${decision.planId} was verified`);
  return { result: true };
}
