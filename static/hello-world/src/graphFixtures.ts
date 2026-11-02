import { services } from "./domain";
import { graphSchema } from "./api/provisional-contracts";
export function authoredGraph() {
  return graphSchema.parse({
    mode: "fixture",
    snapshotId: "demo-auth-v1-2026-11-02",
    root: { id: "auth", label: "Legacy authentication API v1" },
    services: structuredClone(services),
    edges: services.map((service) => ({
      id: service.id,
      source: service.id,
      target: service.id === "pipeline" ? "gateway" : "auth",
      relation:
        service.id === "pipeline"
          ? "TESTS"
          : service.id === "gateway"
            ? "ROUTES"
            : "CALLS",
      evidence: service.evidence,
      sourceReference: service.source,
      sourceUrl: null,
      observedAt:
        service.evidence === "UNKNOWN"
          ? null
          : service.id === "pipeline"
            ? "2026-10-01T00:00:00Z"
            : "2026-11-02T00:00:00Z",
      freshness:
        service.evidence === "UNKNOWN"
          ? "UNKNOWN"
          : service.id === "pipeline"
            ? "STALE"
            : "FRESH",
      impact: service.id === "pipeline" ? "TRANSITIVE" : "DIRECT",
      provenance:
        service.id === "pipeline"
          ? ["pipeline", "gateway", "auth"]
          : [service.id, "auth"],
    })),
  });
}
export function largeGraph(size = 120) {
  const graph = authoredGraph();
  graph.services = Array.from({ length: size }, (_, i) => ({
    ...services[i % services.length],
    id: `service-${i}`,
    label: `Fixture Service ${String(i).padStart(3, "0")}`,
  }));
  graph.edges = graph.services.map((service, i) => ({
    ...graph.edges[i % 5],
    id: `edge-${i}`,
    source: service.id,
    target: "auth",
    impact: "DIRECT",
    provenance: [service.id, "auth"],
  }));
  if (size > 1)
    graph.edges.push(
      {
        ...graph.edges[0],
        id: "cycle-a",
        target: "service-1",
        relation: "DEPENDS_ON",
        provenance: ["service-0", "service-1", "auth"],
      },
      {
        ...graph.edges[1],
        id: "cycle-b",
        target: "service-0",
        relation: "DEPENDS_ON",
        provenance: ["service-1", "service-0", "auth"],
      },
    );
  return graphSchema.parse(graph);
}
