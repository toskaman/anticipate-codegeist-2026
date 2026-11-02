// MOCK_TRANSPORT showcase data for visual QA only. Fictional records on example.invalid;
// never sent to Atlassian, never bundled in production, never described as tenant data.
import type {
  GraphSnapshot,
  ScenarioComparison,
  PreventionPlan,
  PreventionPassport,
  ExecutionRecord,
  EvidenceReference,
} from "@anticipate/contracts";
import { meta } from "./core-test-data";

const T = "2026-11-02T09:00:00.000Z";
const jira = (
  key: string,
  extractor = "jira.issuelink",
): EvidenceReference => ({
  sourceSystem: "JIRA",
  sourceId: key,
  url: `https://example.invalid/browse/${key}`,
  extractor,
  observedAt: T,
});
const node = (
  id: string,
  kind: GraphSnapshot["nodes"][number]["kind"],
  label: string,
  status: "CONFIRMED" | "INFERRED" | "UNKNOWN",
  refs: EvidenceReference[] = [],
) => ({ id, kind, label, status, attributes: {}, references: refs });
const edge = (
  id: string,
  from: string,
  kind: GraphSnapshot["edges"][number]["kind"],
  to: string,
  status: "CONFIRMED" | "INFERRED" | "UNKNOWN",
  refs: EvidenceReference[] = [],
  accessLimited = false,
) => ({ id, from, to, kind, status, references: refs, accessLimited });

export const showcaseProject = {
  id: "300",
  key: "PAY",
  name: "Payments platform (test transport)",
  url: null,
  issueCount: 11,
  lastSnapshotAt: null,
  dataAvailability: "READY" as const,
};

export const showcaseGraph: GraphSnapshot = {
  snapshotId: "snap-showcase-1",
  projectId: "300",
  createdAt: T,
  expiresAt: "2099-11-03T09:00:00.000Z",
  mode: "LIVE",
  truncated: false,
  limits: { maxDepth: 3, maxNodes: 200 },
  nodes: [
    node(
      "issue:PAY-412",
      "ISSUE",
      "PAY-412 Retire legacy Auth API v1",
      "CONFIRMED",
      [jira("PAY-412", "jira.issue")],
    ),
    node("svc:auth-v1", "SERVICE", "Legacy Auth API v1", "CONFIRMED", [
      jira("PAY-401", "jira.component"),
    ]),
    node("svc:auth-v2", "SERVICE", "Auth API v2", "CONFIRMED", [
      jira("PAY-402", "jira.component"),
    ]),
    node("svc:checkout", "SERVICE", "Checkout service", "CONFIRMED", [
      jira("PAY-210", "jira.component"),
    ]),
    node("svc:mobile", "SERVICE", "Mobile app backend", "CONFIRMED", [
      jira("PAY-220", "jira.component"),
    ]),
    node("svc:reporting", "SERVICE", "Reporting service", "INFERRED", [
      jira("PAY-305", "jira.text-mention"),
    ]),
    node("svc:batch", "SERVICE", "Batch export job", "UNKNOWN"),
    node("svc:webhooks", "SERVICE", "Partner webhooks", "CONFIRMED", [
      jira("PAY-240", "jira.component"),
    ]),
    node(
      "test:checkout-auth",
      "TEST",
      "Checkout auth contract test",
      "CONFIRMED",
      [jira("PAY-211", "jira.issue")],
    ),
    node("doc:auth-v1", "DOCUMENT", "Auth v1 deprecation notice", "CONFIRMED", [
      jira("PAY-413", "jira.remotelink"),
    ]),
    node(
      "issue:PAY-430",
      "ISSUE",
      "PAY-430 Migrate mobile login to Auth v2",
      "CONFIRMED",
      [jira("PAY-430", "jira.issue")],
    ),
  ],
  edges: [
    edge("e1", "issue:PAY-412", "AFFECTS", "svc:auth-v1", "CONFIRMED", [
      jira("PAY-412", "jira.component"),
    ]),
    edge("e2", "svc:checkout", "USES", "svc:auth-v1", "CONFIRMED", [
      jira("PAY-210"),
    ]),
    edge("e3", "svc:mobile", "USES", "svc:auth-v1", "CONFIRMED", [
      jira("PAY-220"),
    ]),
    edge("e4", "svc:reporting", "USES", "svc:auth-v1", "INFERRED", [
      jira("PAY-305", "jira.text-mention"),
    ]),
    edge("e5", "svc:batch", "USES", "svc:auth-v1", "UNKNOWN", [], true),
    edge("e6", "svc:webhooks", "DEPENDS_ON", "svc:checkout", "CONFIRMED", [
      jira("PAY-240"),
    ]),
    edge(
      "e7",
      "svc:checkout",
      "VERIFIED_BY",
      "test:checkout-auth",
      "CONFIRMED",
      [jira("PAY-211")],
    ),
    edge("e8", "svc:auth-v1", "DOCUMENTED_IN", "doc:auth-v1", "CONFIRMED", [
      jira("PAY-413", "jira.remotelink"),
    ]),
    edge("e9", "issue:PAY-430", "AFFECTS", "svc:mobile", "CONFIRMED", [
      jira("PAY-430", "jira.component"),
    ]),
    edge("e10", "issue:PAY-430", "DEPENDS_ON", "svc:auth-v2", "CONFIRMED", [
      jira("PAY-430"),
    ]),
  ],
};

const unknownBatch = {
  nodeId: "svc:batch",
  edgeId: "e5",
  reason: "UNKNOWN_EDGE" as const,
  explanation:
    "Whether Batch export job calls Legacy Auth API v1 could not be read.",
};
const inferredReporting = {
  nodeId: "svc:reporting",
  edgeId: "e4",
  reason: "INFERRED_ONLY" as const,
  explanation: "Reporting service usage is inferred from a text mention only.",
};

export const showcaseComparison: ScenarioComparison = {
  snapshotId: showcaseGraph.snapshotId,
  results: [
    {
      scenarioId: "A-remove-now",
      snapshotId: showcaseGraph.snapshotId,
      impacts: [
        {
          nodeId: "svc:checkout",
          depth: 2,
          direct: true,
          pathEdgeIds: ["e1", "e2"],
          weakestStatus: "CONFIRMED",
        },
        {
          nodeId: "svc:mobile",
          depth: 2,
          direct: true,
          pathEdgeIds: ["e1", "e3"],
          weakestStatus: "CONFIRMED",
        },
        {
          nodeId: "svc:reporting",
          depth: 2,
          direct: true,
          pathEdgeIds: ["e1", "e4"],
          weakestStatus: "INFERRED",
        },
        {
          nodeId: "svc:batch",
          depth: 2,
          direct: true,
          pathEdgeIds: ["e1", "e5"],
          weakestStatus: "UNKNOWN",
        },
        {
          nodeId: "svc:webhooks",
          depth: 3,
          direct: false,
          pathEdgeIds: ["e1", "e2", "e6"],
          weakestStatus: "CONFIRMED",
        },
      ],
      violations: [
        {
          ruleId: "P1",
          severity: "BLOCKER",
          nodeIds: ["svc:checkout", "svc:mobile"],
          explanation:
            "Checkout service and Mobile app backend still use Legacy Auth API v1.",
          pathEdgeIds: ["e1", "e2"],
        },
        {
          ruleId: "P2",
          severity: "HIGH",
          nodeIds: ["svc:batch"],
          explanation:
            "Removal requires every dependency to be confirmed; Batch export job is unknown.",
          pathEdgeIds: ["e1", "e5"],
        },
      ],
      uncertainties: [unknownBatch, inferredReporting],
      summary: {
        impacted: 5,
        direct: 4,
        transitive: 1,
        blockers: 1,
        unknowns: 2,
      },
      verdict: "BLOCKED",
      resultHash: "sha256:9f1c0a7e4b52d6c3a8e1f07b2d94c6a1",
    },
    {
      scenarioId: "B-retain-temporarily",
      snapshotId: showcaseGraph.snapshotId,
      impacts: [],
      violations: [],
      uncertainties: [unknownBatch],
      summary: {
        impacted: 0,
        direct: 0,
        transitive: 0,
        blockers: 0,
        unknowns: 1,
      },
      verdict: "NEEDS_REVIEW",
      resultHash: "sha256:2b7e91d04c6a3f58e0d1b9a7c4e26f13",
    },
    {
      scenarioId: "C-migrate-then-retire",
      snapshotId: showcaseGraph.snapshotId,
      impacts: [
        {
          nodeId: "svc:reporting",
          depth: 2,
          direct: true,
          pathEdgeIds: ["e1", "e4"],
          weakestStatus: "INFERRED",
        },
      ],
      violations: [],
      uncertainties: [inferredReporting],
      summary: {
        impacted: 1,
        direct: 1,
        transitive: 0,
        blockers: 0,
        unknowns: 1,
      },
      verdict: "PASS",
      resultHash: "sha256:c40d8a1e7f3b62950a1e4d7c8b3f9e02",
    },
  ],
  diff: [
    {
      scenarioId: "A-remove-now",
      onlyImpacted: ["svc:checkout", "svc:mobile", "svc:batch", "svc:webhooks"],
      onlyViolatedRules: ["P1", "P2"],
    },
    {
      scenarioId: "B-retain-temporarily",
      onlyImpacted: [],
      onlyViolatedRules: [],
    },
    {
      scenarioId: "C-migrate-then-retire",
      onlyImpacted: [],
      onlyViolatedRules: [],
    },
  ],
  recommendedScenarioId: "C-migrate-then-retire",
  recommendationReason:
    "Only option without policy violations. One inferred dependency still needs confirmation.",
};

export const showcasePlan: PreventionPlan = {
  planId: "plan-showcase-1",
  snapshotId: showcaseGraph.snapshotId,
  scenarioId: "C-migrate-then-retire",
  createdAt: T,
  status: "PENDING_APPROVAL",
  planHash: "sha256:71e0b4c9a2d35f8e",
  actions: [
    {
      actionId: "comment:PAY-412",
      type: "ADD_COMMENT",
      targetProjectKey: "PAY",
      targetIssueKey: "PAY-412",
      payload: {
        body: "ANTICIPATE decision: migrate consumers to Auth API v2 first, then retire v1.",
      },
      reason: "Record the decision and its evidence on the change itself.",
      evidenceEdgeIds: ["e1"],
      requiredPermission: "ADD_COMMENTS",
      verificationRule: "Read the comment back and match its decision marker.",
    },
    {
      actionId: "link:PAY-430-blocks-PAY-412",
      type: "ADD_ISSUE_LINK",
      targetProjectKey: "PAY",
      targetIssueKey: "PAY-412",
      payload: { type: "Blocks", inward: "PAY-412", outward: "PAY-430" },
      reason: "Make the mobile migration a blocker of the retirement.",
      evidenceEdgeIds: ["e9", "e3"],
      requiredPermission: "LINK_ISSUES",
      verificationRule:
        "Read PAY-412 links and confirm the Blocks link exists.",
    },
    {
      actionId: "create:PAY-reporting-check",
      type: "CREATE_ISSUE",
      targetProjectKey: "PAY",
      targetIssueKey: null,
      payload: {
        summary: "Confirm whether Reporting service uses Auth API v1",
        issueType: "Task",
      },
      reason:
        "The Reporting service dependency is only inferred. Ask its owner to confirm.",
      evidenceEdgeIds: ["e4"],
      requiredPermission: "CREATE_ISSUES",
      verificationRule: "Read the created issue and match its summary.",
    },
    {
      actionId: "label:PAY-412",
      type: "ADD_LABEL",
      targetProjectKey: "PAY",
      targetIssueKey: "PAY-412",
      payload: { label: "anticipate-reviewed" },
      reason: "Mark the change as reviewed by ANTICIPATE.",
      evidenceEdgeIds: [],
      requiredPermission: "EDIT_ISSUES",
      verificationRule: "Read PAY-412 labels and confirm the label exists.",
    },
  ],
};

export function showcaseRecords(
  plan: PreventionPlan,
  key: string,
): ExecutionRecord[] {
  return plan.actions.map((a, i) => ({
    executionId: `exec-${i + 1}`,
    planId: plan.planId,
    actionId: a.actionId,
    status: a.type === "CREATE_ISSUE" ? "FAILED" : "VERIFIED",
    attempt: 1,
    idempotencyKey: key,
    resultRef:
      a.type === "CREATE_ISSUE"
        ? null
        : {
            issueKey: a.targetIssueKey,
            url: `https://example.invalid/browse/${a.targetIssueKey}`,
          },
    error:
      a.type === "CREATE_ISSUE"
        ? {
            code: "PERMISSION_DENIED",
            message: "CREATE_ISSUES denied for this user",
            requestId: meta.requestId,
            retryable: false,
          }
        : null,
    updatedAt: "2026-11-02T09:06:00.000Z",
  }));
}

export function showcasePassport(
  plan: PreventionPlan,
  executions: ExecutionRecord[],
): PreventionPassport {
  const approved = plan.status !== "PENDING_APPROVAL";
  return {
    passportId: "passport-showcase-1",
    mode: "LIVE",
    snapshotId: showcaseGraph.snapshotId,
    change: {
      issueKey: "PAY-412",
      targetNodeId: "issue:PAY-412",
      description: "Review retirement of PAY-412",
    },
    comparison: showcaseComparison,
    plan,
    approvals: approved
      ? [
          {
            accountId: "557058:test-reviewer",
            at: "2026-11-02T09:04:00.000Z",
            actionIds: plan.actions.map((a) => a.actionId),
          },
        ]
      : [],
    executions,
    openUnknowns: [inferredReporting],
    timeline: [
      {
        at: "2026-11-02T09:00:00.000Z",
        event: "Evidence snapshot captured (11 records, 10 relationships)",
      },
      { at: "2026-11-02T09:01:00.000Z", event: "Three scenarios compared" },
      {
        at: "2026-11-02T09:02:00.000Z",
        event: "Prevention plan generated for C-migrate-then-retire",
      },
      ...(approved
        ? [
            {
              at: "2026-11-02T09:04:00.000Z",
              event: "Approval recorded for 4 actions",
            },
          ]
        : []),
      ...(executions.length
        ? [
            { at: "2026-11-02T09:05:00.000Z", event: "Execution requested" },
            {
              at: "2026-11-02T09:06:00.000Z",
              event: "3 actions verified, 1 failed",
            },
          ]
        : []),
    ],
    disclaimer:
      "MOCK TRANSPORT TEST DATA. Audit-style record of a decision; not a legal or cryptographic certificate.",
  };
}
