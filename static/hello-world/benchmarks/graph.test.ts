import { it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { largeGraph } from "../src/graphFixtures";
import { graphPage, pathToRoot, indexGraph } from "../src/graphModel";
it("records LOCAL synthetic graph-model timings without claiming browser or Forge performance", () => {
  const datasets = [100, 500, 1000].map((size) => ({
    size,
    graph: largeGraph(size - 1),
  }));
  const results = datasets.map(({ size, graph }) => {
    const graphIndex = indexGraph(graph);
    for (let index = 0; index < 10; index++) {
      graphPage(graph, "", "ALL", "ALL", "ALL", 0, graphIndex);
      pathToRoot(graph, "service-0", graphIndex);
    }
    const samples = Array.from({ length: 100 }, () => {
      const start = performance.now();
      const window = graphPage(
        graph,
        "Fixture Service",
        "ALL",
        "ALL",
        "ALL",
        0,
        graphIndex,
      );
      const path = pathToRoot(graph, `service-${size - 2}`, graphIndex);
      const elapsed = performance.now() - start;
      expect(window.services.length).toBeLessThanOrEqual(20);
      expect(path.length).toBeGreaterThan(0);
      return elapsed;
    }).sort((a, b) => a - b);
    return {
      nodes: size,
      edges: graph.edges.length,
      iterations: 100,
      medianMs: samples[50],
      p95Ms: samples[94],
      maxMs: samples[99],
    };
  });
  const folder = resolve("../../evidence/experience/performance-visual-core");
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    resolve(folder, "model-performance-LOCAL.json"),
    JSON.stringify(
      {
        timestampUTC: new Date().toISOString(),
        mode: "LOCAL synthetic fixtures",
        scope:
          "filter/page selection plus iterative BFS; fixture creation/schema validation/index construction excluded; not browser/Forge/network performance",
        runtime: process.version,
        results,
      },
      null,
      2,
    ),
  );
});
