import { describe, expect, it } from "vitest";
import { graph } from "../../../tests/core-test-data";
import { focusedEvidence, MAX_FOCUS_RECORDS } from "./focusedEvidence";

describe("supplied causal-path window", () => {
  it("keeps actual evidence and reports missing path data instead of making a root link", () => {
    const result = focusedEvidence(
      graph,
      ["e1", "missing", "e1"],
      "issue:ABC-1",
      "issue:ABC-2",
    );
    expect(result.nodes.map((node) => node.id)).toEqual([
      "issue:ABC-1",
      "issue:ABC-2",
    ]);
    expect(result.edges).toEqual([graph.edges[0]]);
    expect(result.edges[0].status).toBe("UNKNOWN");
    expect(result.edges[0].accessLimited).toBe(true);
    expect(result.missingEdges).toEqual(["missing"]);
    const disconnected = focusedEvidence(
      graph,
      [],
      "issue:ABC-1",
      "issue:ABC-3",
    );
    expect(disconnected.edges).toEqual([]);
  });
  it("includes loaded endpoints outside the overview page and terminates on supplied cycles", () => {
    const edge = {
      ...graph.edges[0],
      id: "cycle",
      from: "issue:ABC-1",
      to: "issue:ABC-2",
      status: "INFERRED" as const,
    };
    const result = focusedEvidence(
      { ...graph, edges: [...graph.edges, edge] },
      ["e1", "cycle"],
      "issue:ABC-1",
      "issue:ABC-2",
    );
    expect(result.nodes).toHaveLength(2);
    expect(result.edges.map((item) => item.id)).toEqual(["e1", "cycle"]);
    expect(result.edges[1].status).toBe("INFERRED");
  });
  it("bounds long paths while retaining root/selection and disclosing omitted or dangling context", () => {
    const nodes = Array.from({ length: 60 }, (_, index) => ({
      ...graph.nodes[0],
      id: `node:${index}`,
    }));
    const edges = nodes.map((node, index) => ({
      ...graph.edges[0],
      id: `edge:${index}`,
      from: node.id,
      to: index ? nodes[index - 1].id : "missing-node",
    }));
    const result = focusedEvidence(
      { ...graph, nodes, edges },
      edges.map((edge) => edge.id),
      "node:0",
      "node:59",
    );
    expect(result.nodes).toHaveLength(MAX_FOCUS_RECORDS);
    expect(result.nodes.slice(0, 2).map((node) => node.id)).toEqual([
      "node:0",
      "node:59",
    ]);
    expect(result.omittedNodes).toBe(20);
    expect(result.omittedEdges).toBeGreaterThan(0);
    expect(result.missingNodes).toEqual(["missing-node"]);
    const displayed = new Set(result.nodes.map((node) => node.id));
    expect(
      result.edges.every(
        (edge) => displayed.has(edge.from) && displayed.has(edge.to),
      ),
    ).toBe(true);
  });
});
