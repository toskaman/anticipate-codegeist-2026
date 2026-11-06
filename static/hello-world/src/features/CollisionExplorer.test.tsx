// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type {
  GraphSnapshot,
  PortfolioConflict,
  SimulatePortfolioResult,
} from "@anticipate/contracts";
import CollisionExplorer from "./CollisionExplorer";
afterEach(cleanup);

const graph = {
  nodes: ["TD-1", "TD-2", "TD-5"].map((n) => ({
    id: `issue:${n}`,
    kind: "ISSUE",
    label: n,
    status: "CONFIRMED",
    attributes: {},
    references: [],
  })),
  edges: [
    {
      id: "e0",
      from: "issue:TD-2",
      to: "issue:TD-1",
      kind: "DEPENDS_ON",
      status: "CONFIRMED",
      references: [],
    },
  ],
} as unknown as GraphSnapshot;

const sim = (
  verdict: "PASS" | "NEEDS_REVIEW",
  violations: { ruleId: string; explanation: string }[] = [],
) => ({
  scenarioId: "s",
  snapshotId: "snap",
  impacts: [],
  violations,
  uncertainties: [],
  summary: {
    impacted: 0,
    direct: 0,
    transitive: 0,
    blockers: 0,
    unknowns: 0,
  },
  verdict,
  resultHash: "h",
});
const result = {
  snapshotId: "snap",
  maxDepth: 6,
  changeIds: ["A", "B"],
  individual: [
    {
      changeId: "A",
      label: "Migrate to v2",
      targetNodeIds: ["issue:TD-1"],
      result: sim("PASS"),
    },
    {
      changeId: "B",
      label: "Breaking upgrade",
      targetNodeIds: ["issue:TD-5"],
      result: sim("NEEDS_REVIEW", [
        { ruleId: "P3", explanation: "Breaking change has consumers." },
      ]),
    },
  ],
  combined: {
    order: ["A", "B"],
    result: sim("NEEDS_REVIEW", [
      { ruleId: "P3", explanation: "Breaking change has consumers." },
    ]),
  },
  sharedImpacts: [],
  emergentImpacts: [],
  maskedImpacts: [],
  conflicts: [],
  ordering: {
    constraints: [],
    cycles: [],
    order: null,
    steps: [],
    proposed: null,
  },
  evidenceGaps: [],
  verdictExplanations: [],
  disclaimer: "",
  resultHash: "h",
} as unknown as SimulatePortfolioResult;

const conflict = {
  conflictId: "C1",
  kind: "EMERGENT_IMPACT",
  changeIds: ["A", "B"],
  nodeIds: ["issue:TD-2"],
  reason: "Migrated consumers land on a breaking target.",
  evidenceGapEdgeIds: [],
} as unknown as PortfolioConflict;

it("explains the collision: parties, verdicts, path, rules", () => {
  render(
    <CollisionExplorer
      result={result}
      graph={graph}
      conflict={conflict}
      composerAvailable
    />,
  );
  expect(
    screen.getByText(/Why these collide \(2 changes, 1 affected records\)/),
  ).toBeTruthy();
  expect(screen.getByText("Migrate to v2")).toBeTruthy();
  expect(screen.getAllByText("Breaking upgrade")).toHaveLength(2);
  expect(screen.getByText("Alone: Pass")).toBeTruthy();
  expect(screen.getByText("TD-1 → TD-2")).toBeTruthy();
  expect(screen.getAllByText(/Breaking change has consumers/)).toHaveLength(2);
  expect(screen.getByText(/Safe Change Composer below/)).toBeTruthy();
});

it("says plainly when no causal path exists", () => {
  render(
    <CollisionExplorer
      result={result}
      graph={graph}
      conflict={{ ...conflict, nodeIds: ["issue:TD-5"] }}
      composerAvailable={false}
    />,
  );
  expect(screen.getByText(/No dependent path found/)).toBeTruthy();
  expect(screen.queryByText(/Safe Change Composer below/)).toBeNull();
});
