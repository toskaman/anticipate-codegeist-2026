import {
  PORTFOLIO_LIMITS,
  type GraphSnapshot,
  type PortfolioChange,
} from "@anticipate/contracts";

export const portfolioActions = {
  remove: "Remove",
  retain: "Retain temporarily",
  breaking: "Upgrade · breaking",
  compatible: "Upgrade · declared compatible",
  migrate: "Migrate dependents",
} as const;
export type PortfolioDraft = {
  id: string;
  label: string;
  nodeId: string;
  action: keyof typeof portfolioActions;
  toNodeId: string;
};

/** Selectors may submit only loaded endpoints. Backend still enforces readability. */
export function portfolioChanges(
  rows: PortfolioDraft[],
  graph: GraphSnapshot,
): PortfolioChange[] | null {
  const nodes = new Set(graph.nodes.map((n) => n.id));
  if (
    !rows.length ||
    rows.length > PORTFOLIO_LIMITS.maxChanges ||
    new Set(rows.map((r) => r.id)).size !== rows.length
  )
    return null;
  const changes: PortfolioChange[] = [];
  for (const row of rows) {
    if (!row.label.trim() || row.label.length > 200 || !nodes.has(row.nodeId))
      return null;
    if (
      row.action === "migrate" &&
      (!nodes.has(row.toNodeId) || row.nodeId === row.toNodeId)
    )
      return null;
    const operation =
      row.action === "remove"
        ? { op: "REMOVE_NODE" as const, nodeId: row.nodeId }
        : row.action === "retain"
          ? {
              op: "DEPRECATE_NODE" as const,
              nodeId: row.nodeId,
              retainUntil: null,
            }
          : row.action === "migrate"
            ? {
                op: "MIGRATE_DEPENDENTS" as const,
                fromNodeId: row.nodeId,
                toNodeId: row.toNodeId,
                edgeKinds: ["USES" as const, "DEPENDS_ON" as const],
              }
            : {
                op: "UPGRADE_NODE" as const,
                nodeId: row.nodeId,
                breaking: row.action === "breaking",
              };
    changes.push({
      id: row.id,
      label: row.label.trim(),
      operations: [operation],
    });
  }
  return changes;
}
