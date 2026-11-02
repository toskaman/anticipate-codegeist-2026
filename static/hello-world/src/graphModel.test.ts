import { describe, it, expect } from "vitest";
import { authoredGraph, largeGraph } from "./graphFixtures";
import { graphPage, pathToRoot, GRAPH_PAGE_SIZE } from "./graphModel";
import { graphSchema } from "./api/provisional-contracts";
describe("bounded evidence graph", () => {
  it("finds the supplied transitive pipeline path", () => {
    expect(
      pathToRoot(authoredGraph(), "pipeline").map((edge) => edge.id),
    ).toEqual(["pipeline", "gateway"]);
  });
  it("terminates a cycle with no path instead of fabricating a root link", () => {
    const graph = largeGraph();
    graph.edges = graph.edges.filter(
      (edge) => edge.id === "cycle-a" || edge.id === "cycle-b",
    );
    expect(pathToRoot(graph, "service-0")).toEqual([]);
  });
  it("keeps 120-node pagination bounded and complete", () => {
    const graph = largeGraph();
    const seen = new Set<string>();
    for (let page = 0; page < 6; page++) {
      const window = graphPage(graph, "", "ALL", "ALL", "ALL", page);
      expect(window.services.length).toBeLessThanOrEqual(GRAPH_PAGE_SIZE);
      for (const service of window.services) seen.add(service.id);
    }
    expect(seen.size).toBe(120);
  });
  it("filters stale transitive evidence without upgrading inferred status", () => {
    const window = graphPage(
      authoredGraph(),
      "",
      "ALL",
      "STALE",
      "TRANSITIVE",
      0,
    );
    expect(window.services.map((service) => service.id)).toEqual(["pipeline"]);
    expect(window.services[0].evidence).toBe("INFERRED");
  });
  it("rejects dangling or duplicate relationships and unsafe source URLs", () => {
    const graph = authoredGraph();
    graph.edges[0].target = "missing";
    expect(graphSchema.safeParse(graph).success).toBe(false);
    const unsafe = authoredGraph();
    unsafe.edges[0].sourceUrl = "javascript:alert(1)";
    expect(graphSchema.safeParse(unsafe).success).toBe(false);
  });
  it("bounds a 1000-node filtered window and searches beyond the first page", () => {
    const graph = largeGraph(1000);
    expect(graphPage(graph, "", "ALL", "ALL", "ALL", 49).services).toHaveLength(
      20,
    );
    expect(
      graphPage(graph, "Fixture Service 999", "ALL", "ALL", "ALL", 0)
        .services[0].id,
    ).toBe("service-999");
  });
});

it("rejects a provenance chain not supported by its edges", () => {
  const graph = authoredGraph();
  graph.edges[0].provenance = ["checkout", "pipeline", "auth"];
  expect(graphSchema.safeParse(graph).success).toBe(false);
});
