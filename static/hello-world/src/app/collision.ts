import type {
  EvidenceStatus,
  GraphSnapshot,
  PortfolioConflict,
  SimulatePortfolioResult,
  SimulationResult,
} from "@anticipate/contracts";

/** Bounded causal-path search: never walks the whole graph, never invents relations. */
export const COLLISION_LIMITS = {
  maxPaths: 5,
  maxDepth: 6,
  maxVisited: 200,
} as const;

export interface CausalPath {
  nodes: string[];
  weakestStatus: EvidenceStatus;
}

const weaker = (a: EvidenceStatus, b: EvidenceStatus): EvidenceStatus =>
  a === "UNKNOWN" || b === "UNKNOWN"
    ? "UNKNOWN"
    : a === "INFERRED" || b === "INFERRED"
      ? "INFERRED"
      : "CONFIRMED";

/**
 * Causal paths from a change's target nodes to affected nodes, through dependents
 * (an edge `from DEPENDS_ON to` means a change to `to` may impact `from`, so the
 * causal direction from a target is `to` → `from`). Pure, bounded, deterministic:
 * neighbours and starts are visited in sorted order. Unreachable pairs yield no
 * path — never a guess.
 */
export function causalPaths(
  graph: GraphSnapshot,
  fromIds: string[],
  toIds: string[],
  limits: typeof COLLISION_LIMITS = COLLISION_LIMITS,
): { paths: CausalPath[]; truncated: boolean } {
  const targets = new Set(toIds);
  const statusOf = new Map(graph.nodes.map((n) => [n.id, n.status]));
  const dependents = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.kind !== "DEPENDS_ON" && e.kind !== "USES" && e.kind !== "BLOCKS")
      continue;
    const list = dependents.get(e.to) ?? [];
    list.push(e.from);
    dependents.set(e.to, list);
  }
  for (const list of dependents.values()) list.sort();
  const paths: CausalPath[] = [];
  let visited = 0;
  let truncated = false;
  const queue: string[][] = [...fromIds].sort().map((id) => [id]);
  const seen = new Set<string>();
  while (queue.length && paths.length < limits.maxPaths) {
    const path = queue.shift()!;
    const head = path[path.length - 1]!;
    if (visited++ >= limits.maxVisited) {
      truncated = true;
      break;
    }
    if (targets.has(head) && path.length > 1) {
      const weakest = path.reduce<EvidenceStatus>(
        (w, id) => weaker(w, statusOf.get(id) ?? "UNKNOWN"),
        "CONFIRMED",
      );
      paths.push({ nodes: [...path], weakestStatus: weakest });
      continue;
    }
    if (path.length - 1 >= limits.maxDepth) {
      truncated = true;
      continue;
    }
    for (const next of dependents.get(head) ?? []) {
      if (path.includes(next)) continue;
      const key = `${next}|${path.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([...path, next]);
    }
  }
  if (queue.length && paths.length >= limits.maxPaths) truncated = true;
  return { paths, truncated };
}

/** Each involved change's own verdict, for the "harmless alone" side of the story. */
export function conflictParties(
  result: SimulatePortfolioResult,
  conflict: PortfolioConflict,
): { changeId: string; label: string; verdict: SimulationResult["verdict"] }[] {
  return conflict.changeIds.map((id) => {
    const ind = result.individual.find((c) => c.changeId === id);
    return {
      changeId: id,
      label: ind?.label ?? id,
      verdict: ind?.result.verdict ?? result.combined.result.verdict,
    };
  });
}

export interface TriggeredRule {
  ruleId: string;
  explanation: string;
  scope: string;
}

/** Rules fired in the combined run and in each involved change's own run, deduplicated. */
export function triggeredRules(
  result: SimulatePortfolioResult,
  conflict: PortfolioConflict,
): TriggeredRule[] {
  const out = new Map<string, TriggeredRule>();
  const add = (
    scope: string,
    list: { ruleId: string; explanation: string }[],
  ) => {
    for (const v of list) {
      const key = `${scope}|${v.ruleId}|${v.explanation}`;
      if (!out.has(key))
        out.set(key, {
          ruleId: v.ruleId,
          explanation: v.explanation,
          scope,
        });
    }
  };
  add("combined", result.combined.result.violations);
  for (const id of conflict.changeIds) {
    const ind = result.individual.find((c) => c.changeId === id);
    if (ind) add(ind.label, ind.result.violations);
  }
  return [...out.values()].sort((a, b) =>
    `${a.scope}${a.ruleId}`.localeCompare(`${b.scope}${b.ruleId}`),
  );
}
