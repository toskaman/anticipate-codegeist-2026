// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DecisionFirewall, { buildNodeIndex } from "./DecisionFirewall";
import type { Workflow } from "../app/useCoreWorkflow";
import type { GraphSnapshot, SimulationResult } from "@anticipate/contracts";

afterEach(cleanup);

const snapshot = {
  snapshotId: "snap-1",
  projectId: "proj-1",
  createdAt: "2026-11-03T10:00:00.000Z",
  expiresAt: "2026-11-04T10:00:00.000Z",
  mode: "LIVE",
  nodes: [
    {
      id: "issue:A-1",
      kind: "ISSUE",
      label: "Auth service",
      status: "CONFIRMED",
      attributes: {},
      references: [],
    },
    {
      id: "issue:A-2",
      kind: "ISSUE",
      label: "Billing worker",
      status: "INFERRED",
      attributes: {},
      references: [],
    },
    {
      id: "issue:A-3",
      kind: "ISSUE",
      label: "Legacy cache",
      status: "UNKNOWN",
      attributes: {},
      references: [],
    },
  ],
  edges: [],
  truncated: false,
  limits: { maxDepth: 3, maxNodes: 5000 },
} as GraphSnapshot;

const result = {
  scenarioId: "retire-cache",
  snapshotId: "snap-1",
  impacts: [],
  violations: [
    {
      ruleId: "NO_REMOVAL_WITH_ACTIVE_DEPENDENTS",
      severity: "BLOCKER",
      nodeIds: ["issue:A-1", "missing-node"],
      explanation: "Active dependents block the removal.",
      pathEdgeIds: [],
    },
  ],
  uncertainties: [
    {
      nodeId: "issue:A-2",
      edgeId: null,
      reason: "INFERRED_ONLY",
      explanation: "Only indirect evidence links this dependency.",
    },
  ],
  summary: {
    impacted: 1,
    direct: 1,
    transitive: 0,
    blockers: 1,
    unknowns: 1,
  },
  verdict: "BLOCKED",
  resultHash: "hash-1",
} as SimulationResult;

function workflow(overrides: Record<string, unknown> = {}): Workflow {
  return {
    currentResult: result,
    snapshot,
    busy: "",
    expired: false,
    allowed: () => true,
    capabilities: { jiraWrite: "AVAILABLE" },
    plan: null,
    evidenceFailure: null,
    actions: { go: vi.fn(), generatePlan: vi.fn() },
    ...overrides,
  } as unknown as Workflow;
}

describe("buildNodeIndex", () => {
  it("indexes every node by id", () => {
    const index = buildNodeIndex(snapshot.nodes);
    expect(index.size).toBe(3);
    expect(index.get("issue:A-1")?.label).toBe("Auth service");
    expect(index.get("issue:A-3")?.status).toBe("UNKNOWN");
    expect(index.get("missing-node")).toBeUndefined();
  });

  it("tolerates a missing snapshot", () => {
    expect(buildNodeIndex(null).size).toBe(0);
    expect(buildNodeIndex(undefined).size).toBe(0);
  });
});

describe("DecisionFirewall node resolution", () => {
  it("resolves violation node labels and falls back to the raw id", () => {
    render(<DecisionFirewall w={workflow()} />);
    expect(screen.getByText("Auth service")).toBeTruthy();
    expect(screen.getByText("missing-node")).toBeTruthy();
  });

  it("resolves uncertainty node labels", () => {
    render(<DecisionFirewall w={workflow()} />);
    expect(screen.getByText("Billing worker")).toBeTruthy();
  });

  it("renders the empty state without a selected option", () => {
    render(<DecisionFirewall w={workflow({ currentResult: null })} />);
    expect(screen.getByText("No option selected")).toBeTruthy();
  });
});
