import { describe, expect, it } from "vitest";
import { graph } from "../../tests/core-test-data";
import {
  collisionCounterpart,
  portfolioChanges,
  type PortfolioDraft,
} from "./portfolio";

const row: PortfolioDraft = {
  id: "c1",
  label: "Retire API",
  nodeId: graph.nodes[0].id,
  action: "remove",
  toNodeId: "",
};
describe("portfolio input boundaries", () => {
  it("uses only loaded endpoints, including a distinct migration target", () => {
    expect(
      portfolioChanges([{ ...row, nodeId: "invented" }], graph),
    ).toBeNull();
    expect(
      portfolioChanges(
        [{ ...row, action: "migrate", toNodeId: row.nodeId }],
        graph,
      ),
    ).toBeNull();
    expect(
      portfolioChanges(
        [{ ...row, action: "migrate", toNodeId: "unloaded" }],
        graph,
      ),
    ).toBeNull();
    expect(
      portfolioChanges(
        [{ ...row, action: "migrate", toNodeId: graph.nodes[1].id }],
        graph,
      )?.[0].operations,
    ).toEqual([
      {
        op: "MIGRATE_DEPENDENTS",
        fromNodeId: row.nodeId,
        toNodeId: graph.nodes[1].id,
        edgeKinds: ["USES", "DEPENDS_ON"],
      },
    ]);
  });
  it("accepts ten named changes, rejects an eleventh, empty input and duplicate identities", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...row, id: `c${i}` }));
    expect(portfolioChanges(ten, graph)).toHaveLength(10);
    expect(
      portfolioChanges([...ten, { ...row, id: "eleven" }], graph),
    ).toBeNull();
    expect(portfolioChanges([], graph)).toBeNull();
    expect(portfolioChanges([row, row], graph)).toBeNull();
  });
  it("keeps compatibility and retention assumptions explicit without mutating drafts", () => {
    const rows = (["remove", "retain", "breaking", "compatible"] as const).map(
      (action) => ({ ...row, id: action, action }),
    );
    const before = JSON.stringify(rows);
    expect(portfolioChanges(rows, graph)?.map((c) => c.operations[0])).toEqual([
      { op: "REMOVE_NODE", nodeId: row.nodeId },
      { op: "DEPRECATE_NODE", nodeId: row.nodeId, retainUntil: null },
      { op: "UPGRADE_NODE", nodeId: row.nodeId, breaking: true },
      { op: "UPGRADE_NODE", nodeId: row.nodeId, breaking: false },
    ]);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("requires a bounded human-readable name", () => {
    expect(portfolioChanges([{ ...row, label: "   " }], graph)).toBeNull();
    expect(
      portfolioChanges([{ ...row, label: "a".repeat(201) }], graph),
    ).toBeNull();
    expect(
      portfolioChanges([{ ...row, label: "  Retire API  " }], graph)?.[0].label,
    ).toBe("Retire API");
  });
});

describe("collisionCounterpart", () => {
  const migrated = {
    ...row,
    action: "migrate" as const,
    toNodeId: graph.nodes[1].id,
  };
  it("offers nothing without exactly one draft change", () => {
    expect(collisionCounterpart([], graph)).toBeNull();
    expect(collisionCounterpart([migrated, migrated], graph)).toBeNull();
  });
  it("offers nothing unless the single change is a complete migration", () => {
    expect(collisionCounterpart([row], graph)).toBeNull();
    expect(
      collisionCounterpart([{ ...migrated, toNodeId: "" }], graph),
    ).toBeNull();
    expect(
      collisionCounterpart([{ ...migrated, toNodeId: "unloaded" }], graph),
    ).toBeNull();
    expect(
      collisionCounterpart([{ ...migrated, label: "   " }], graph),
    ).toBeNull();
  });
  it("proposes a breaking upgrade of the migration target", () => {
    expect(collisionCounterpart([migrated], graph)).toEqual({
      label: `Breaking upgrade of ${graph.nodes[1].label}`,
      nodeId: graph.nodes[1].id,
      action: "breaking",
      toNodeId: "",
    });
  });
  it("keeps the completed draft valid", () => {
    const spec = collisionCounterpart([migrated], graph);
    expect(spec).not.toBeNull();
    const rows = [
      { ...migrated, id: "change-1" },
      { ...spec!, id: "change-2" },
    ];
    expect(portfolioChanges(rows, graph)).toHaveLength(2);
  });
});

import { applyCandidate } from "./portfolio";
describe("applyCandidate", () => {
  it("turns a breaking upgrade into a compatible one and a removal into retain, leaving other rows alone", () => {
    const rows: PortfolioDraft[] = [
      { ...row, id: "a", action: "remove" },
      { ...row, id: "b", action: "breaking" },
      { ...row, id: "c", action: "migrate", toNodeId: "x" },
    ];
    const out = applyCandidate(rows, [
      {
        changeId: "a",
        after: { op: "DEPRECATE_NODE", nodeId: row.nodeId, retainUntil: null },
      },
      {
        changeId: "b",
        after: { op: "UPGRADE_NODE", nodeId: row.nodeId, breaking: false },
      },
      {
        changeId: "c",
        after: { op: "UPGRADE_NODE", nodeId: "other", breaking: false },
      },
    ]);
    expect(out.map((r) => r.action)).toEqual([
      "retain",
      "compatible",
      "migrate",
    ]);
  });
});
