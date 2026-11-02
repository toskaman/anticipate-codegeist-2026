// Test-only envelopes. No Atlassian request is made and no Jira success is implied.
import {
  type GraphSnapshot,
  type ScenarioComparison,
  type PreventionPlan,
  type PreventionPassport,
  type ExecutionRecord,
} from "@anticipate/contracts";
export const meta = {
  contractVersion: "0.2.0",
  requestId: "test-request-1",
  mode: "LIVE" as const,
  generatedAt: "2026-11-02T00:00:00Z",
};
export const response = (data: unknown) => ({ ok: true as const, meta, data });
export const capabilities = {
  jiraRead: "AVAILABLE",
  jiraWrite: "AVAILABLE",
  confluenceRead: "NOT_CONFIGURED",
  workflowValidator: "NOT_CONFIGURED",
  rovoAgent: "NOT_CONFIGURED",
  rovoMcp: "NOT_CONFIGURED",
  teamworkGraph: "NOT_CONFIGURED",
  llm: "DISABLED_BY_BUDGET",
  operations: [
    "getCapabilities",
    "listProjects",
    "getChangeCandidates",
    "getGraphSnapshot",
    "getEvidenceGraph",
    "simulateChange",
    "compareScenarios",
    "generatePreventionPlan",
    "approvePlan",
    "executeApprovedPlan",
    "getExecutionStatus",
    "getPreventionPassport",
    "getPolicies",
  ],
};
export const graph: GraphSnapshot = {
  snapshotId: "test-snapshot",
  projectId: "100",
  createdAt: meta.generatedAt,
  expiresAt: "2099-11-03T00:00:00Z",
  mode: "LIVE",
  truncated: false,
  limits: { maxDepth: 3, maxNodes: 200 },
  nodes: [
    {
      id: "issue:ABC-1",
      kind: "ISSUE",
      label: "ABC-1 Retire API",
      status: "CONFIRMED",
      attributes: {},
      references: [
        {
          sourceSystem: "JIRA",
          sourceId: "ABC-1",
          url: "https://example.invalid/browse/ABC-1",
          extractor: "test.transport",
          observedAt: meta.generatedAt,
        },
      ],
    },
    {
      id: "issue:ABC-2",
      kind: "ISSUE",
      label: "ABC-2 Consumer",
      status: "UNKNOWN",
      attributes: {},
      references: [],
    },
    {
      id: "issue:ABC-3",
      kind: "ISSUE",
      label: "ABC-3 Replacement",
      status: "CONFIRMED",
      attributes: {},
      references: [],
    },
  ],
  edges: [
    {
      id: "e1",
      from: "issue:ABC-2",
      to: "issue:ABC-1",
      kind: "DEPENDS_ON",
      status: "UNKNOWN",
      references: [],
      accessLimited: true,
    },
  ],
};
export const comparison: ScenarioComparison = {
  snapshotId: graph.snapshotId,
  results: [
    "A-remove-now",
    "B-retain-temporarily",
    "C-migrate-then-retire",
  ].map((scenarioId) => ({
    scenarioId,
    snapshotId: graph.snapshotId,
    impacts: [
      {
        nodeId: "issue:ABC-2",
        depth: 1,
        direct: true,
        pathEdgeIds: ["e1"],
        weakestStatus: "UNKNOWN",
      },
    ],
    violations: [
      {
        ruleId: "P2",
        severity: "HIGH",
        nodeIds: ["issue:ABC-2"],
        explanation: "Owner evidence remains unknown.",
        pathEdgeIds: ["e1"],
      },
    ],
    uncertainties: [
      {
        nodeId: "issue:ABC-2",
        edgeId: "e1",
        reason: "ACCESS_LIMITED",
        explanation: "Consumer access is limited.",
      },
    ],
    summary: {
      impacted: 1,
      direct: 1,
      transitive: 0,
      blockers: 0,
      unknowns: 1,
    },
    verdict: "NEEDS_REVIEW",
    resultHash: `test-hash-${scenarioId}`,
  })),
  diff: [],
  recommendedScenarioId: "B-retain-temporarily",
  recommendationReason: "Lowest current test risk; review unknowns.",
};
export const plan: PreventionPlan = {
  planId: "test-plan",
  snapshotId: graph.snapshotId,
  scenarioId: "C-migrate-then-retire",
  createdAt: meta.generatedAt,
  status: "PENDING_APPROVAL",
  planHash: "test-plan-hash",
  actions: [
    {
      actionId: "record:ABC-1",
      type: "ADD_COMMENT",
      targetProjectKey: "ABC",
      targetIssueKey: "ABC-1",
      payload: { text: "TEST TRANSPORT ONLY � review unknown consumer" },
      reason: "Record this decision.",
      evidenceEdgeIds: ["e1"],
      requiredPermission: "ADD_COMMENTS",
      verificationRule: "Backend verifies comment marker.",
    },
  ],
};
export function passport(
  current = plan,
  executions: ExecutionRecord[] = [],
): PreventionPassport {
  return {
    passportId: "test-passport",
    mode: "LIVE",
    snapshotId: graph.snapshotId,
    change: {
      issueKey: "ABC-1",
      targetNodeId: "issue:ABC-1",
      description: "Review retirement of ABC-1",
    },
    comparison,
    plan: current,
    approvals:
      current.status === "PENDING_APPROVAL"
        ? []
        : [
            {
              accountId: "test-reviewer",
              at: meta.generatedAt,
              actionIds: current.actions.map((a) => a.actionId),
            },
          ],
    executions,
    openUnknowns: comparison.results[2].uncertainties,
    timeline: [
      { at: meta.generatedAt, event: "Test transport plan generated" },
    ],
    disclaimer: "TEST TRANSPORT ONLY. Not a hosted Forge or Jira verification.",
  };
}
