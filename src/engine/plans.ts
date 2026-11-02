/** Read-only plan generation from a simulation result. Produces reviewable actions; nothing is executed here. */
import type { GraphSnapshot, PreventionPlan, ProposedAction, SimulationResult } from '../../packages/contracts/src/index';
import { stableHash } from '../../packages/simulation-core/src/index';

const keyOf = (nodeId: string) => (nodeId.startsWith('issue:') ? nodeId.slice(6) : null);
export const actionMarker = (planId: string, actionId: string) => `anticipate-${stableHash({ planId, actionId }).slice(0, 12)}`;

export function buildPlan(args: { planId: string; snapshot: GraphSnapshot; result: SimulationResult; rootIssueKey: string; projectKey: string; createdAt: string }): PreventionPlan {
  const { snapshot, result, rootIssueKey, projectKey } = args;
  const label = (id: string) => snapshot.nodes.find((n) => n.id === id)?.label ?? id;
  const actions: ProposedAction[] = [];
  const p1 = result.violations.find((v) => v.ruleId === 'P1');
  for (const nodeId of p1?.nodeIds ?? []) {
    const impact = result.impacts.find((i) => i.nodeId === nodeId);
    actions.push({
      actionId: `migrate:${nodeId}`, type: 'CREATE_ISSUE', targetProjectKey: projectKey, targetIssueKey: null,
      payload: { summary: `Migrate "${label(nodeId)}" before ${rootIssueKey} ships`.slice(0, 250), linkType: 'Blocks', blocksIssueKey: rootIssueKey,
        description: `Created by ANTICIPATE after an approved prevention plan. ${label(nodeId)} depends on the change in ${rootIssueKey} (evidence edges: ${impact?.pathEdgeIds.join(', ') ?? 'n/a'}).` },
      reason: p1!.explanation, evidenceEdgeIds: impact?.pathEdgeIds ?? [], requiredPermission: 'CREATE_ISSUES,LINK_ISSUES',
      verificationRule: `Issue exists in ${projectKey} carrying the action marker label and a "Blocks" link to ${rootIssueKey}.`
    });
  }
  const p3 = result.violations.find((v) => v.ruleId === 'P3');
  for (const nodeId of p3?.nodeIds ?? []) {
    const k = keyOf(nodeId);
    // Unreadable/unknown items cannot be labelled by this user; they are listed in the decision record instead.
    if (!k || snapshot.nodes.find((n) => n.id === nodeId)?.status !== 'CONFIRMED') continue;
    actions.push({
      actionId: `needs-test:${k}`, type: 'ADD_LABEL', targetProjectKey: projectKey, targetIssueKey: k, payload: { label: 'anticipate-needs-test' },
      reason: p3!.explanation, evidenceEdgeIds: result.impacts.find((i) => i.nodeId === nodeId)?.pathEdgeIds ?? [], requiredPermission: 'EDIT_ISSUES',
      verificationRule: `${k} carries label anticipate-needs-test.`
    });
  }
  const unknowns = result.uncertainties.filter((u) => u.reason === 'UNKNOWN_EDGE' || u.reason === 'ACCESS_LIMITED' || u.reason === 'TRUNCATED');
  const lines = [
    `ANTICIPATE decision record for scenario ${result.scenarioId} (snapshot ${snapshot.snapshotId}).`,
    `Verdict: ${result.verdict}. Impacted: ${result.summary.impacted} (${result.summary.direct} direct). Blocking rules: ${result.summary.blockers}.`,
    ...result.violations.map((v) => `- [${v.severity}] ${v.ruleId}: ${v.explanation}`),
    ...(unknowns.length ? ['Unverified dependencies — please confirm owners:', ...unknowns.map((u) => `- ${u.explanation}${u.nodeId ? ` (${label(u.nodeId)})` : ''}`)] : [])
  ];
  actions.push({
    actionId: `record:${rootIssueKey}`, type: 'ADD_COMMENT', targetProjectKey: projectKey, targetIssueKey: rootIssueKey, payload: { text: lines.join('\n').slice(0, 30000) },
    reason: 'Keep an auditable decision record on the proposed change.', evidenceEdgeIds: [], requiredPermission: 'ADD_COMMENTS',
    verificationRule: `A comment containing the action marker exists on ${rootIssueKey}.`
  });
  const body = { planId: args.planId, snapshotId: snapshot.snapshotId, scenarioId: result.scenarioId, actions: actions.slice(0, 50) };
  return { ...body, createdAt: args.createdAt, status: 'PENDING_APPROVAL', planHash: stableHash(body) };
}
