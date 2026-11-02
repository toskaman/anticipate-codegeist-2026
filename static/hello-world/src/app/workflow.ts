// Pure workflow helpers shared by the hosted workspace. Behaviour is unchanged from the
// pre-redesign CoreWorkspace: same scenario definitions, recovery storage and export format.
import type { GraphSnapshot, SimulationRequest } from "@anticipate/contracts";
import { CoreClientError } from "../api/ForgeClient";

export const pages = [
  "Mission Control",
  "Evidence Graph",
  "Scenario Lab",
  "Decision Firewall",
  "Prevention Plan",
  "Prevention Passport",
  "Settings",
];

/**
 * Kind of change the user is assessing. Upgrade scenarios mirror CORE's
 * `upgradeScenarios` (src/engine/scenarios.ts) exactly; they are only offered
 * when the backend advertises UPGRADE_CAPABILITY in `capabilities.operations`.
 */
export type ChangeKind = "retire" | "upgrade";
export const UPGRADE_CAPABILITY = "scenario:UPGRADE_NODE";

export function simulationRequest(
  graph: GraphSnapshot,
  rootIssueKey: string,
  replacement: string,
  kind: ChangeKind = "retire",
): SimulationRequest {
  const target = `issue:${rootIssueKey}`;
  if (!graph.nodes.some((n) => n.id === target))
    throw new CoreClientError(
      "VALIDATION",
      "The root issue is not in this snapshot.",
    );
  if (
    replacement &&
    (replacement === target || !graph.nodes.some((n) => n.id === replacement))
  )
    throw new CoreClientError(
      "VALIDATION",
      "Choose a distinct replacement node from this snapshot.",
    );
  const migrate = (
    then: SimulationRequest["scenarios"][number]["operations"][number],
  ) => [
    {
      op: "MIGRATE_DEPENDENTS" as const,
      fromNodeId: target,
      toNodeId: replacement,
      edgeKinds: ["USES" as const, "DEPENDS_ON" as const],
    },
    then,
  ];
  const scenarios: SimulationRequest["scenarios"] =
    kind === "upgrade"
      ? [
          {
            scenarioId: "A-breaking-upgrade-now",
            label: "Ship the breaking upgrade now",
            operations: [
              { op: "UPGRADE_NODE", nodeId: target, breaking: true },
            ],
          },
          {
            scenarioId: "B-compatible-upgrade",
            label: "Ship behind a backward-compatible shim",
            operations: [
              { op: "UPGRADE_NODE", nodeId: target, breaking: false },
            ],
          },
          ...(replacement
            ? [
                {
                  scenarioId: "C-migrate-then-upgrade",
                  label:
                    "Move consumers to the new version first, then upgrade",
                  operations: migrate({
                    op: "UPGRADE_NODE",
                    nodeId: target,
                    breaking: true,
                  }),
                },
              ]
            : []),
        ]
      : [
          {
            scenarioId: "A-remove-now",
            label: "Remove now",
            operations: [{ op: "REMOVE_NODE", nodeId: target }],
          },
          {
            scenarioId: "B-retain-temporarily",
            label: "Retain temporarily",
            operations: [
              { op: "DEPRECATE_NODE", nodeId: target, retainUntil: null },
            ],
          },
          ...(replacement
            ? [
                {
                  scenarioId: "C-migrate-then-retire",
                  label: "Migrate then retire",
                  operations: migrate({ op: "REMOVE_NODE", nodeId: target }),
                },
              ]
            : []),
        ];
  return {
    snapshotId: graph.snapshotId,
    change: {
      issueKey: rootIssueKey,
      targetNodeId: target,
      description:
        kind === "upgrade"
          ? `Review dependency upgrade of ${rootIssueKey}`
          : `Review retirement of ${rootIssueKey}`,
    },
    maxDepth: Math.min(10, Math.max(1, graph.limits.maxDepth)),
    scenarios,
  };
}

const recoveryStorage = "anticipate-core-plan-id";
export function storedPlan() {
  try {
    return sessionStorage.getItem(recoveryStorage) ?? "";
  } catch {
    return "";
  }
}
export function hasExecutionAttempt(planId: string) {
  try {
    return !!sessionStorage.getItem(`anticipate-core-execution:${planId}`);
  } catch {
    return true;
  }
}
export function rememberExecution(planId: string, key: string) {
  // A failed durable marker prevents the write rather than losing reload recovery.
  sessionStorage.setItem(`anticipate-core-execution:${planId}`, key);
}
export function rememberPlan(planId: string) {
  try {
    sessionStorage.setItem(recoveryStorage, planId);
  } catch {
    /* Status can still be recovered using the visible plan ID. */
  }
}
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
