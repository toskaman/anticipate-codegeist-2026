import type { GraphSnapshot } from "@anticipate/contracts";

/**
 * Hop distance from the change target, ignoring edge direction.
 * Used only for placement and ordering. It is NOT an impact claim: impact paths
 * come exclusively from SimulationResult.impacts[].pathEdgeIds.
 */
export function hopDistances(graph: GraphSnapshot, rootId: string) {
  const adjacent = new Map<string, string[]>();
  for (const e of graph.edges) {
    (adjacent.get(e.from) ?? adjacent.set(e.from, []).get(e.from)!).push(e.to);
    (adjacent.get(e.to) ?? adjacent.set(e.to, []).get(e.to)!).push(e.from);
  }
  const distance = new Map<string, number>();
  if (!graph.nodes.some((n) => n.id === rootId)) return distance;
  distance.set(rootId, 0);
  const queue = [rootId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const d = distance.get(id)!;
    for (const next of adjacent.get(id) ?? [])
      if (!distance.has(next)) {
        distance.set(next, d + 1);
        queue.push(next);
      }
  }
  return distance;
}

const statusRank: Record<string, number> = {
  CONFIRMED: 0,
  INFERRED: 1,
  UNKNOWN: 2,
};

/** Stable order: change first, then by hop distance, evidence strength and label. */
export function orderNodes<
  T extends { id: string; label: string; status: string },
>(nodes: T[], distance: Map<string, number>) {
  const far = Number.MAX_SAFE_INTEGER;
  return [...nodes].sort(
    (a, b) =>
      (distance.get(a.id) ?? far) - (distance.get(b.id) ?? far) ||
      (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3) ||
      a.label.localeCompare(b.label),
  );
}

export const NODE_W = 212;
export const NODE_H = 84;
const COL_GAP = 64;
const ROW_GAP = 16;

export interface Column {
  key: string;
  label: string;
  x: number;
}

/**
 * Layered layout: one lane per hop distance (capped), plus a lane for records not
 * linked to the change inside this snapshot. Tall lanes wrap into sub-columns of
 * `maxRows` so large fan-outs stay readable instead of shrinking to fit.
 * O(n log n); no layout library.
 */
export function layeredLayout(
  nodeIds: { id: string }[],
  distance: Map<string, number>,
  maxColumns = 4,
  maxRows = 6,
) {
  const lane = (id: string) => {
    const d = distance.get(id);
    return d === undefined ? -1 : Math.min(d, maxColumns - 1);
  };
  const groups = new Map<number, string[]>();
  for (const n of nodeIds) {
    const l = lane(n.id);
    (groups.get(l) ?? groups.set(l, []).get(l)!).push(n.id);
  }
  const lanes = [...groups.keys()].sort((a, b) =>
    a === -1 ? 1 : b === -1 ? -1 : a - b,
  );
  const tallest = Math.min(
    maxRows,
    Math.max(1, ...[...groups.values()].map((g) => g.length)),
  );
  const positions = new Map<string, { x: number; y: number }>();
  const columns: Column[] = [];
  const beyond = [...distance.values()].some((d) => d > maxColumns - 1);
  let col = 0;
  for (const l of lanes) {
    const ids = groups.get(l)!;
    const x = col * (NODE_W + COL_GAP);
    columns.push({
      key: String(l),
      x,
      label:
        l === -1
          ? "Not linked in this snapshot"
          : l === 0
            ? "The change"
            : l === maxColumns - 1 && beyond
              ? `${l}+ hops away`
              : `${l} ${l === 1 ? "hop" : "hops"} away`,
    });
    for (let start = 0; start < ids.length; start += maxRows) {
      const chunk = ids.slice(start, start + maxRows);
      const cx = col * (NODE_W + COL_GAP);
      const offset = ((tallest - chunk.length) * (NODE_H + ROW_GAP)) / 2;
      chunk.forEach((id, row) =>
        positions.set(id, { x: cx, y: offset + row * (NODE_H + ROW_GAP) }),
      );
      col++;
    }
  }
  return {
    positions,
    columns,
    height: tallest * (NODE_H + ROW_GAP) - ROW_GAP,
    width: Math.max(1, col) * (NODE_W + COL_GAP) - COL_GAP,
  };
}
