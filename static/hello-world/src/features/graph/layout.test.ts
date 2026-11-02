import { describe, expect, it } from "vitest";
import type { GraphSnapshot } from "@anticipate/contracts";
import {
  hopDistances,
  layeredLayout,
  orderNodes,
  NODE_W,
  NODE_H,
} from "./layout";

const node = (id: string, status = "CONFIRMED") => ({
  id,
  kind: "SERVICE" as const,
  label: id,
  status: status as "CONFIRMED",
  attributes: {},
  references: [],
});
const edge = (id: string, from: string, to: string) => ({
  id,
  from,
  to,
  kind: "USES" as const,
  status: "CONFIRMED" as const,
  references: [],
  accessLimited: false,
});
const graph = (n: number): GraphSnapshot => ({
  snapshotId: "s",
  projectId: "p",
  createdAt: "2026-11-02T00:00:00Z",
  expiresAt: "2026-11-03T00:00:00Z",
  mode: "LIVE",
  truncated: false,
  limits: { maxDepth: 3, maxNodes: 200 },
  nodes: [node("root"), ...Array.from({ length: n }, (_, i) => node(`n${i}`))],
  edges: Array.from({ length: n }, (_, i) => edge(`e${i}`, `n${i}`, "root")),
});

describe("graph layout", () => {
  it("measures hop distance in both edge directions without inventing edges", () => {
    const g = graph(2);
    g.nodes.push(node("island"));
    g.edges.push(edge("x", "root", "n9-missing"));
    const d = hopDistances(g, "root");
    expect(d.get("root")).toBe(0);
    expect(d.get("n0")).toBe(1);
    expect(d.has("island")).toBe(false);
  });
  it("orders the change first, then by distance and evidence strength", () => {
    const g = graph(2);
    g.nodes[2].status = "UNKNOWN" as "CONFIRMED";
    const ordered = orderNodes(g.nodes, hopDistances(g, "root"));
    expect(ordered.map((n) => n.id)).toEqual(["root", "n0", "n1"]);
  });
  it("wraps large fan-outs into sub-columns without overlapping nodes", () => {
    const g = graph(34);
    const { positions, width } = layeredLayout(
      g.nodes,
      hopDistances(g, "root"),
    );
    const rects = [...positions.values()];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap =
          Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;
        expect(overlap).toBe(false);
      }
    expect(Math.max(...rects.map((r) => r.y))).toBeLessThan(6 * (NODE_H + 16));
    expect(width).toBeGreaterThan(NODE_W * 6);
  });
});
