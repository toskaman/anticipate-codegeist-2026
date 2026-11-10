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

export type SamplePrefillSpec = Omit<PortfolioDraft, "id">;
/**
 * Collision-pair completion: when the draft holds exactly one complete
 * migration, propose its breaking counterpart (a breaking upgrade of the
 * migration target) so the combined run is one click away. Nothing is
 * guessed: the target comes from the user's own draft.
 */
export function collisionCounterpart(
  rows: PortfolioDraft[],
  graph: GraphSnapshot,
): SamplePrefillSpec | null {
  if (rows.length !== 1) return null;
  const [row] = rows;
  if (row.action !== "migrate" || portfolioChanges([row], graph) === null)
    return null;
  const to = graph.nodes.find((n) => n.id === row.toNodeId);
  if (!to) return null;
  return {
    label: `Breaking upgrade of ${to.label}`,
    nodeId: to.id,
    action: "breaking",
    toNodeId: "",
  };
}

type Op = PortfolioChange["operations"][number];
export type CandidatePrefill = {
  rows: PortfolioDraft[];
  applied: string[];
  skipped: string[];
};
/**
 * Applies a Composer candidate's transformations to the editable rows (one
 * operation per row), reporting which changes prefilled and which need manual
 * review (unsupported operation, retargeted record or unknown change id).
 * Nothing else changes.
 */
export function applyCandidateReport(
  rows: PortfolioDraft[],
  transformations: { changeId: string; after: Op }[],
): CandidatePrefill {
  const applied: string[] = [];
  const skipped: string[] = [];
  const next: PortfolioDraft[] = rows.map((row) => {
    const t = transformations.find((x) => x.changeId === row.id);
    if (!t) return row;
    const a = t.after;
    if (a.op === "DEPRECATE_NODE" && a.nodeId === row.nodeId) {
      applied.push(row.id);
      return { ...row, action: "retain" };
    }
    if (a.op === "UPGRADE_NODE" && a.nodeId === row.nodeId) {
      applied.push(row.id);
      return { ...row, action: a.breaking ? "breaking" : "compatible" };
    }
    skipped.push(row.id);
    return row;
  });
  for (const t of transformations)
    if (!rows.some((row) => row.id === t.changeId)) skipped.push(t.changeId);
  return { rows: next, applied, skipped };
}
/** Applies a Composer candidate's transformations to the editable rows (one operation per row). Nothing else changes. */
export function applyCandidate(
  rows: PortfolioDraft[],
  transformations: { changeId: string; after: Op }[],
): PortfolioDraft[] {
  return applyCandidateReport(rows, transformations).rows;
}
