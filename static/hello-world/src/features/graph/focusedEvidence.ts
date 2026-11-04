import type { GraphSnapshot } from "@anticipate/contracts";

export const MAX_FOCUS_RECORDS = 40;
export const MAX_FOCUS_RELATIONSHIPS = 120;

/** Use only a supplied simulation path. Never search for or fabricate causal edges. */
export function focusedEvidence(
  graph: GraphSnapshot,
  edgeIds: string[],
  rootId: string,
  selectedId: string,
) {
  const byNode = new Map(graph.nodes.map((node) => [node.id, node]));
  const byEdge = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const wanted = new Set([rootId, selectedId]);
  const missingEdges: string[] = [];
  const supplied = [...new Set(edgeIds)].flatMap((id) => {
    const edge = byEdge.get(id);
    if (!edge) {
      missingEdges.push(id);
      return [];
    }
    wanted.add(edge.from);
    wanted.add(edge.to);
    return [edge];
  });
  const missingNodes = [...wanted].filter((id) => !byNode.has(id));
  const loaded = [...wanted].flatMap((id) =>
    byNode.has(id) ? [byNode.get(id)!] : [],
  );
  const nodes = loaded.slice(0, MAX_FOCUS_RECORDS);
  const displayed = new Set(nodes.map((node) => node.id));
  const edges = supplied
    .filter((edge) => displayed.has(edge.from) && displayed.has(edge.to))
    .slice(0, MAX_FOCUS_RELATIONSHIPS);
  return {
    nodes,
    edges,
    missingEdges,
    missingNodes,
    omittedNodes: loaded.length - nodes.length,
    omittedEdges: supplied.length - edges.length,
  };
}
