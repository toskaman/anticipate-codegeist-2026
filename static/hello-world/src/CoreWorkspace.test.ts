import { expect, it } from "vitest";
import { simulationRequest } from "./CoreWorkspace";
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
