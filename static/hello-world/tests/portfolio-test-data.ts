// Authored LOCAL / MOCK_TRANSPORT outcomes. Not calculated from or applied to Jira.
import type {
  SimulatePortfolioRequest,
  SimulatePortfolioResult,
} from "@anticipate/contracts";
import { comparison, graph } from "./core-test-data";

export function mockPortfolioResult(
  input: SimulatePortfolioRequest,
): SimulatePortfolioResult {
  const first = input.changes[0].id;
  const second = input.changes[1]?.id ?? first;
  const combined = {
    ...comparison.results[0],
    verdict: "BLOCKED" as const,
    scenarioId: "portfolio-combined",
    impacts: [
      {
        ...comparison.results[0].impacts[0],
        nodeId: graph.nodes[1].id,
        weakestStatus: "UNKNOWN" as const,
      },
      {
        ...comparison.results[0].impacts[0],
        nodeId: graph.nodes[2].id,
        weakestStatus: "INFERRED" as const,
      },
    ],
  };
  return {
    snapshotId: graph.snapshotId,
    maxDepth: 6,
    changeIds: input.changes.map((c) => c.id),
    individual: input.changes.map((c) => ({
      changeId: c.id,
      label: c.label,
      targetNodeIds: [graph.nodes[0].id],
      result:
        c.id === first
          ? {
              ...combined,
              verdict: "PASS",
              violations: [],
              summary: { ...combined.summary, blockers: 0 },
            }
          : combined,
    })),
    combined: { order: input.changes.map((c) => c.id), result: combined },
    sharedImpacts: [graph.nodes[1].id, graph.nodes[2].id].map((nodeId) => ({
      nodeId,
      changeIds: [first, second],
    })),
    emergentImpacts: [],
    maskedImpacts: [],
    conflicts: [
      {
        conflictId: "mock-conflict",
        kind: "MIGRATE_ONTO_RETIRED",
        changeIds: [first, second],
        nodeIds: [graph.nodes[1].id],
        reason: `The selected replacement is also retired in this portfolio: ${first} migrates consumers onto a record that ${second} retires.`,
        evidenceGapEdgeIds: ["unreadable-edge"],
      },
    ],
    ordering: {
      constraints: [
        {
          before: first,
          after: second,
          kind: "MIGRATE_BEFORE_RETIRE",
          nodeIds: [],
          reason: "Move consumers before retiring their old target.",
        },
      ],
      cycles: [],
      order: [first, second],
      steps: [],
      proposed: {
        order: input.changes.map((c) => c.id),
        violatedConstraints: [],
        sameAsRecommended: true,
        steps: [],
      },
    },
    evidenceGaps: [
      {
        changeId: first,
        gaps: [
          {
            edgeId: "unreadable-edge",
            from: graph.nodes[1].id,
            to: graph.nodes[0].id,
            kind: "UNKNOWN_NOT_MIGRATED",
            nodeIds: [graph.nodes[1].id],
          },
        ],
      },
    ],
    verdictExplanations: [
      {
        changeId: first,
        standaloneVerdict: "PASS",
        portfolioVerdict: "BLOCKED",
        changedByOthers: true,
        gainedNodeIds: [graph.nodes[1].id],
        maskedNodeIds: [],
        marginalNodeIds: [],
        causes: [
          {
            changeId: second,
            gainedNodeIds: [graph.nodes[1].id],
            maskedNodeIds: [],
            verdictEffect: true,
          },
        ],
        jointlyCausedNodeIds: [],
        explanation:
          "The second change removes the replacement required by the first.",
      },
    ],
    disclaimer: "Authored regression outcome; not a prediction.",
    resultHash: "mock-portfolio-result-hash",
    snapshot: {
      snapshotId: graph.snapshotId,
      projectId: graph.projectId,
      rootIssueKey: "ABC-1",
      mode: "LIVE",
      createdAt: graph.createdAt,
      expiresAt: graph.expiresAt,
      truncated: false,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      reused: true,
    },
  };
}
