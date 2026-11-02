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

export function simulationRequest(
  graph: GraphSnapshot,
  rootIssueKey: string,
  replacement: string,
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
  return {
    snapshotId: graph.snapshotId,
    change: {
      issueKey: rootIssueKey,
      targetNodeId: target,
      description: `Review retirement of ${rootIssueKey}`,
    },
    maxDepth: Math.min(10, Math.max(1, graph.limits.maxDepth)),
    scenarios: [
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
              operations: [
                {
                  op: "MIGRATE_DEPENDENTS" as const,
                  fromNodeId: target,
                  toNodeId: replacement,
                  edgeKinds: ["USES" as const, "DEPENDS_ON" as const],
                },
                { op: "REMOVE_NODE" as const, nodeId: target },
              ],
            },
          ]
        : []),
    ],
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
