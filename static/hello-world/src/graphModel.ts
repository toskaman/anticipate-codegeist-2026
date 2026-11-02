import { type z } from "zod";
import { type graphSchema } from "./api/provisional-contracts";
export type EvidenceGraph = z.infer<typeof graphSchema>;
export const GRAPH_PAGE_SIZE = 20;
// Iterative breadth-first search terminates on cycles. Only supplied edges are traversed.
export function pathToRoot(graph: EvidenceGraph, start: string) {
  const adjacency = new Map<string, EvidenceGraph["edges"]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge);
    adjacency.set(edge.source, list);
  }
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
    for (const edge of adjacency.get(current) ?? []) {
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
) {
  const outgoing = new Map<string, EvidenceGraph["edges"]>();
  for (const edge of graph.edges) {
    const edges = outgoing.get(edge.source) ?? [];
    edges.push(edge);
    outgoing.set(edge.source, edges);
  }
  const filtered = graph.services.filter(
    (service) =>
      service.label.toLowerCase().includes(query.toLowerCase()) &&
      (classification === "ALL" || service.evidence === classification) &&
      (freshness === "ALL" ||
        (outgoing.get(service.id) ?? []).some(
          (edge) => edge.freshness === freshness,
        )) &&
      (impact === "ALL" ||
        (outgoing.get(service.id) ?? []).some(
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
