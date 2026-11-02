import { type z } from "zod";
import { type graphSchema } from "./api/provisional-contracts";
export type EvidenceGraph = z.infer<typeof graphSchema>;
export const GRAPH_PAGE_SIZE = 20;
export function indexGraph(graph: EvidenceGraph) {
  const outgoing = new Map<string, EvidenceGraph["edges"]>();
  const incoming = new Map<string, EvidenceGraph["edges"][number]>();
  const byEdgeId = new Map<string, EvidenceGraph["edges"][number]>();
  const labels = new Map(
    graph.services.map((service) => [service.id, service.label.toLowerCase()]),
  );
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
    if (!incoming.has(edge.target)) incoming.set(edge.target, edge);
    byEdgeId.set(edge.id, edge);
  }
  return { outgoing, incoming, byEdgeId, labels };
}
export type GraphIndex = ReturnType<typeof indexGraph>;
// Iterative traversal uses the snapshot index and terminates on cycles.
export function pathToRoot(
  graph: EvidenceGraph,
  start: string,
  graphIndex: GraphIndex = indexGraph(graph),
) {
  const queue = [start];
  const visited = new Set(queue);
  const previous = new Map<string, EvidenceGraph["edges"][number]>();
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current === graph.root.id) {
      const edges: EvidenceGraph["edges"] = [];
      let node = current;
      while (node !== start) {
        const edge = previous.get(node);
        if (!edge) break;
        edges.unshift(edge);
        node = edge.source;
      }
      return edges;
    }
    for (const edge of graphIndex.outgoing.get(current) ?? []) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        previous.set(edge.target, edge);
        queue.push(edge.target);
      }
    }
  }
  return [];
}
export function graphPage(
  graph: EvidenceGraph,
  query: string,
  classification: string,
  freshness: string,
  impact: string,
  page: number,
  graphIndex: GraphIndex = indexGraph(graph),
) {
  const normalized = query.toLowerCase();
  const filtered = graph.services.filter(
    (service) =>
      (graphIndex.labels.get(service.id) ?? "").includes(normalized) &&
      (classification === "ALL" || service.evidence === classification) &&
      (freshness === "ALL" ||
        (graphIndex.outgoing.get(service.id) ?? []).some(
          (edge) => edge.freshness === freshness,
        )) &&
      (impact === "ALL" ||
        (graphIndex.outgoing.get(service.id) ?? []).some(
          (edge) => edge.impact === impact,
        )),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / GRAPH_PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  return {
    total: filtered.length,
    totalPages,
    currentPage,
    services: filtered.slice(
      currentPage * GRAPH_PAGE_SIZE,
      (currentPage + 1) * GRAPH_PAGE_SIZE,
    ),
  };
}
