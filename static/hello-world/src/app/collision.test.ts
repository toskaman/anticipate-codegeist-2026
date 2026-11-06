import { describe, expect, it } from "vitest";
import type { GraphSnapshot } from "@anticipate/contracts";
import { causalPaths, COLLISION_LIMITS } from "./collision";

const edge = (from: string, to: string, status = "CONFIRMED") => ({
  id: `${from}>${to}`,
  from,
  to,
  kind: "DEPENDS_ON" as const,
  status: status as "CONFIRMED",
  references: [],
});
const node = (id: string, status = "CONFIRMED") => ({
  id,
  kind: "ISSUE" as const,
  label: id,
  status: status as "CONFIRMED",
  attributes: {},
  references: [],
});
// TD-4 → TD-2 → TD-1 (dependents point at their dependencies); TD-3 → TD-1;
// TD-5 standalone; TD-6 linked by a non-causal DOCUMENTED_IN edge (ignored).
const graph = {
  nodes: ["TD-1", "TD-2", "TD-3", "TD-4", "TD-5", "TD-6"].map((n) =>
    node(`issue:${n}`),
  ),
  edges: [
    edge("issue:TD-2", "issue:TD-1"),
    edge("issue:TD-3", "issue:TD-1"),
    edge("issue:TD-4", "issue:TD-2"),
    { ...edge("issue:TD-6", "issue:TD-1"), kind: "DOCUMENTED_IN" as const },
  ],
} as unknown as GraphSnapshot;

describe("causalPaths", () => {
  it("finds the dependent chain from a change target to an affected node", () => {
    const { paths, truncated } = causalPaths(
      graph,
      ["issue:TD-1"],
      ["issue:TD-4", "issue:TD-3"],
    );
    expect(truncated).toBe(false);
    expect(paths.map((p) => p.nodes)).toContainEqual([
      "issue:TD-1",
      "issue:TD-2",
      "issue:TD-4",
    ]);
    expect(paths.map((p) => p.nodes)).toContainEqual([
      "issue:TD-1",
      "issue:TD-3",
    ]);
    expect(paths.every((p) => p.weakestStatus === "CONFIRMED")).toBe(true);
  });

  it("reports the weakest evidence status along the path", () => {
    const g = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "issue:TD-2" ? { ...n, status: "INFERRED" as const } : n,
      ),
    } as unknown as GraphSnapshot;
    const inferred = causalPaths(g, ["issue:TD-1"], ["issue:TD-4"]);
    expect(inferred.paths).toHaveLength(1);
    expect(inferred.paths[0]!.weakestStatus).toBe("INFERRED");
  });

  it("yields no path for unreachable or non-causal relations — never a guess", () => {
    expect(causalPaths(graph, ["issue:TD-5"], ["issue:TD-4"]).paths).toEqual(
      [],
    );
    expect(causalPaths(graph, ["issue:TD-1"], ["issue:TD-6"]).paths).toEqual(
      [],
    );
    expect(causalPaths(graph, ["issue:TD-1"], ["issue:TD-1"]).paths).toEqual(
      [],
    );
  });

  it("is bounded on wide fanout", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `issue:F-${i}`);
    const wide = {
      nodes: [node("issue:ROOT"), ...ids.map((id) => node(id))],
      edges: ids.map((id) => edge(id, "issue:ROOT")),
    } as unknown as GraphSnapshot;
    const { paths, truncated } = causalPaths(wide, ["issue:ROOT"], ids);
    expect(paths.length).toBeLessThanOrEqual(COLLISION_LIMITS.maxPaths);
    expect(truncated).toBe(true);
  });

  it("is deterministic regardless of input order", () => {
    const a = causalPaths(graph, ["issue:TD-1"], ["issue:TD-3", "issue:TD-4"]);
    const b = causalPaths(graph, ["issue:TD-1"], ["issue:TD-4", "issue:TD-3"]);
    expect(a).toEqual(b);
  });
});
