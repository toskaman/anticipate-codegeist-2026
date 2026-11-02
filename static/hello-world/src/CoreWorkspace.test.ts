import { expect, it } from "vitest";
import { simulationRequest } from "./app/workflow";
import { graph } from "../tests/core-test-data";
it("compares A/B without inventing a replacement and creates C only for a selected snapshot node", () => {
  const two = simulationRequest(graph, "ABC-1", "");
  expect(two.snapshotId).toBe(graph.snapshotId);
  expect(two.change.targetNodeId).toBe("issue:ABC-1");
  expect(two.scenarios.map((s) => s.scenarioId)).toEqual([
    "A-remove-now",
    "B-retain-temporarily",
  ]);
  const three = simulationRequest(graph, "ABC-1", "issue:ABC-3");
  expect(three.scenarios[2].operations).toEqual([
    {
      op: "MIGRATE_DEPENDENTS",
      fromNodeId: "issue:ABC-1",
      toNodeId: "issue:ABC-3",
      edgeKinds: ["USES", "DEPENDS_ON"],
    },
    { op: "REMOVE_NODE", nodeId: "issue:ABC-1" },
  ]);
  expect(() => simulationRequest(graph, "MISSING-9", "")).toThrow("root issue");
  expect(() => simulationRequest(graph, "ABC-1", "invented-node")).toThrow(
    "distinct replacement",
  );
  expect(() => simulationRequest(graph, "ABC-1", "issue:ABC-1")).toThrow(
    "distinct replacement",
  );
});

it("sends exactly CORE's dependency-upgrade scenarios when the user chooses an upgrade", async () => {
  // Read-only parity check against the CORE scenario builder.
  const { upgradeScenarios, standardScenarios } =
    await import("../../../src/engine/scenarios");
  const upgrade = simulationRequest(graph, "ABC-1", "issue:ABC-3", "upgrade");
  expect(upgrade.scenarios).toEqual(
    upgradeScenarios("issue:ABC-1", "issue:ABC-3"),
  );
  expect(upgrade.change.description).toBe("Review dependency upgrade of ABC-1");
  expect(
    simulationRequest(graph, "ABC-1", "", "upgrade").scenarios.map(
      (s) => s.scenarioId,
    ),
  ).toEqual(["A-breaking-upgrade-now", "B-compatible-upgrade"]);
  // Retirement remains the default and keeps CORE's operations.
  expect(
    simulationRequest(graph, "ABC-1", "issue:ABC-3").scenarios.map(
      (s) => s.operations,
    ),
  ).toEqual(
    standardScenarios("issue:ABC-1", "issue:ABC-3").map((s) => s.operations),
  );
});
