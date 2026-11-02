/**
 * Native Jira workflow validator ("Decision Firewall" enforcement point). Opt-in: an admin adds it to a transition
 * of a company-managed workflow. Only issues labelled `anticipate-change` are gated; all others always pass.
 * A gated issue may transition only if its latest ANTICIPATE prevention plan is COMPLETED (all approved actions
 * verified in Jira). No graph crawl happens during a transition: it reads one stored decision record + the labels.
 * Availability policy: if ANTICIPATE storage/Jira is unreachable the validator FAILS OPEN (allows) and logs, so our
 * outage can never lock a team's workflow; this is documented and visible in logs.
 * Removal: delete the validator from the transition in the workflow editor.
 */
export interface DecisionRecord { planId: string; scenarioId: string; status: string; at: string }

export function decideTransition(labels: string[] | null, decision: DecisionRecord | undefined, issueKey: string): { result: boolean; errorMessage?: string } {
  if (!labels || !labels.includes('anticipate-change')) return { result: true };
  if (decision?.status === 'COMPLETED') return { result: true };
  const why = !decision ? 'no ANTICIPATE decision has been recorded'
    : decision.status === 'EVIDENCE_CHANGED' ? `the dependency evidence changed after plan ${decision.planId} was approved`
    : `the latest prevention plan ${decision.planId} is ${decision.status}, not COMPLETED`;
  return { result: false, errorMessage: `ANTICIPATE Decision Firewall: ${issueKey} cannot move forward because ${why}. Open ANTICIPATE, review the consequences and complete a verified prevention plan.` };
}
