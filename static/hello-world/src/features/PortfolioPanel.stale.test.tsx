// @vitest-environment jsdom
// TITAN-5 P0: a portfolio response that arrives after the draft changed must
// be discarded, never displayed as the current draft's result. Covers the
// double-submit path (two flights, premature idle) and any programmatic draft
// change during a flight. MOCK_TRANSPORT only.
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { SimulatePortfolioRequest } from "@anticipate/contracts";
import type { Workflow } from "../app/useCoreWorkflow";
import { ForgeClient } from "../api/ForgeClient";
import PortfolioPanel from "./PortfolioPanel";
import { graph, response } from "../../tests/core-test-data";
import { mockPortfolioResult } from "../../tests/portfolio-test-data";

window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  cb(0);
  return 0;
}) as typeof window.requestAnimationFrame;

afterEach(cleanup);

function setup() {
  const calls: unknown[] = [];
  const resolvers: Array<() => void> = [];
  const client = new ForgeClient(async (operation, input) => {
    if (operation === "simulatePortfolio") {
      calls.push(input);
      return new Promise((resolve) => {
        resolvers.push(() =>
          resolve(
            response(
              mockPortfolioResult(input as unknown as SimulatePortfolioRequest),
            ),
          ),
        );
      });
    }
    throw new Error(`unexpected ${operation}`);
  });
  const w = {
    capabilities: {
      portfolioSimulation: "AVAILABLE",
      operations: ["simulatePortfolio"],
    },
    snapshot: graph,
    rootIssueKey: "ABC-1",
    client,
    busy: "",
  } as unknown as Pick<
    Workflow,
    "capabilities" | "snapshot" | "rootIssueKey" | "client" | "busy"
  >;
  return { calls, resolvers, w };
}

function addValidChange() {
  fireEvent.click(screen.getByText("Add change"));
  fireEvent.change(screen.getByLabelText("Record"), {
    target: { value: "issue:ABC-1" },
  });
}

it("control: a simulation result is shown after the backend responds", async () => {
  const { calls, resolvers, w } = setup();
  const { container } = render(<PortfolioPanel w={w} />);
  addValidChange();
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(calls).toHaveLength(1));
  resolvers[0]!();
  await screen.findByText("Combined simulation");
  expect(screen.getByText("Portfolio simulation complete.")).toBeTruthy();
});

it("a double submit starts a single network flight", async () => {
  const { calls, resolvers, w } = setup();
  const { container } = render(<PortfolioPanel w={w} />);
  addValidChange();
  const form = container.querySelector("form")!;
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  await act(async () => {
    await Promise.resolve();
  });
  expect(calls).toHaveLength(1);
  resolvers[0]!();
  await screen.findByText("Combined simulation");
});

it("a response that arrives after the draft changed is discarded", async () => {
  const { calls, resolvers, w } = setup();
  const { container } = render(<PortfolioPanel w={w} />);
  addValidChange();
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(calls).toHaveLength(1));
  // The draft changes while the request is in flight.
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Edited change" },
  });
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
    "Edited change",
  );
  await act(async () => {
    resolvers[0]!();
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(screen.queryByText("Combined simulation")).toBeNull();
  expect(screen.queryByText("Portfolio simulation complete.")).toBeNull();
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
    "Edited change",
  );
});

const upg = (nodeId: string, breaking: boolean) => ({
  op: "UPGRADE_NODE",
  nodeId,
  breaking,
});

const baselineCandidate = {
  candidateId: "cand-0",
  kind: "AS_PROPOSED",
  name: "Current plan as proposed",
  why: "Baseline: the draft unchanged.",
  transformations: [],
  assumptions: [],
  phases: [],
  order: null,
  cycles: [],
  verdict: "BLOCKED",
  blockers: 1,
  unknowns: 0,
  impacted: 2,
  conflicts: 1,
  conflictKinds: [],
  requiredReviews: [],
  resolvedConflicts: [],
  remainingConflicts: [],
  rank: 3,
  dominatedBy: "cand-1",
  resultHash: "h0",
};

const compatibleCandidate = {
  candidateId: "cand-1",
  kind: "COMPATIBLE_UPGRADE",
  name: "Upgrade billing compatibly",
  why: "A shim avoids the breaking change.",
  transformations: [
    {
      changeId: "change-1",
      before: upg("issue:ABC-1", true),
      after: upg("issue:ABC-1", false),
    },
  ],
  assumptions: ["The vendor shim is stable."],
  phases: [["change-1"]],
  order: ["change-1"],
  cycles: [],
  verdict: "PASS",
  blockers: 0,
  unknowns: 0,
  impacted: 1,
  conflicts: 0,
  conflictKinds: [],
  requiredReviews: [],
  resolvedConflicts: [],
  remainingConflicts: [],
  rank: 1,
  dominatedBy: null,
  resultHash: "h1",
};

const partialCandidate = {
  candidateId: "cand-2",
  kind: "RETAIN_OLD",
  name: "Partially applicable plan",
  why: "One change prefills, one does not.",
  transformations: [
    {
      changeId: "change-1",
      before: upg("issue:ABC-1", true),
      after: upg("issue:ABC-1", false),
    },
    {
      changeId: "change-9",
      before: { op: "REMOVE_NODE", nodeId: "issue:ABC-2" },
      after: { op: "REMOVE_NODE", nodeId: "issue:ABC-2" },
    },
  ],
  assumptions: [],
  phases: [["change-1"]],
  order: null,
  cycles: [],
  verdict: "NEEDS_REVIEW",
  blockers: 0,
  unknowns: 1,
  impacted: 1,
  conflicts: 0,
  conflictKinds: [],
  requiredReviews: [],
  resolvedConflicts: [],
  remainingConflicts: [],
  rank: 2,
  dominatedBy: null,
  resultHash: "h2",
};

const splitCandidate = {
  candidateId: "cand-3",
  kind: "SPLIT_PHASES",
  name: "Split into phases",
  why: "Phase the work; nothing to prefill.",
  transformations: [],
  assumptions: [],
  phases: [["change-1"], ["change-1"]],
  order: null,
  cycles: [],
  verdict: "NEEDS_REVIEW",
  blockers: 0,
  unknowns: 1,
  impacted: 1,
  conflicts: 0,
  conflictKinds: [],
  requiredReviews: [],
  resolvedConflicts: [],
  remainingConflicts: [],
  rank: 4,
  dominatedBy: null,
  resultHash: "h3",
};

const skippedCandidate = {
  candidateId: "cand-4",
  kind: "RETAIN_OLD",
  name: "Nothing applicable",
  why: "Neither change can prefill.",
  transformations: [
    {
      changeId: "change-1",
      before: { op: "REMOVE_NODE", nodeId: "issue:ABC-1" },
      after: { op: "REMOVE_NODE", nodeId: "issue:ABC-1" },
    },
    {
      changeId: "change-9",
      before: upg("issue:ABC-2", true),
      after: upg("issue:ABC-2", false),
    },
  ],
  assumptions: [],
  phases: [["change-1"]],
  order: null,
  cycles: [],
  verdict: "NEEDS_REVIEW",
  blockers: 0,
  unknowns: 1,
  impacted: 1,
  conflicts: 0,
  conflictKinds: [],
  requiredReviews: [],
  resolvedConflicts: [],
  remainingConflicts: [],
  rank: 5,
  dominatedBy: null,
  resultHash: "h4",
};

const composerPayload = {
  snapshotId: graph.snapshotId,
  baselineCandidateId: "cand-0",
  candidates: [
    compatibleCandidate,
    partialCandidate,
    baselineCandidate,
    splitCandidate,
    skippedCandidate,
  ],
  truncated: false,
  limits: ["Composer coverage is bounded."],
  readOnly: true,
};

function setupComposer() {
  const base = setup();
  const composeCalls: unknown[] = [];
  const composeResolvers: Array<() => void> = [];
  const client = new ForgeClient(async (operation, input) => {
    if (operation === "simulatePortfolio") {
      base.calls.push(input);
      return new Promise((resolve) => {
        base.resolvers.push(() =>
          resolve(
            response(
              mockPortfolioResult(input as unknown as SimulatePortfolioRequest),
            ),
          ),
        );
      });
    }
    if (operation === "composeSafeChanges") {
      composeCalls.push(input);
      return new Promise((resolve) => {
        composeResolvers.push(() => resolve(response(composerPayload)));
      });
    }
    throw new Error(`unexpected ${operation}`);
  });
  const w = {
    ...base.w,
    capabilities: {
      portfolioSimulation: "AVAILABLE",
      operations: ["simulatePortfolio", "composeSafeChanges"],
    },
    client,
  } as unknown as Pick<
    Workflow,
    "capabilities" | "snapshot" | "rootIssueKey" | "client" | "busy"
  >;
  return { ...base, composeCalls, composeResolvers, w };
}

async function simulateAndCompose() {
  const s = setupComposer();
  const { container } = render(<PortfolioPanel w={s.w} />);
  addValidChange();
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(s.calls).toHaveLength(1));
  s.resolvers[0]!();
  await screen.findByText("Combined simulation");
  fireEvent.click(screen.getByText("Compose safer alternatives"));
  await waitFor(() => expect(s.composeCalls).toHaveLength(1));
  s.composeResolvers[0]!();
  await screen.findByText("Upgrade billing compatibly");
  return s;
}

it("selecting a candidate keeps its review state, invalidates the old result and offers re-simulation", async () => {
  const s = await simulateAndCompose();
  const selects = screen.getAllByText("Select for review");
  fireEvent.click(selects[0]);
  // The prefill applied (compatible upgrade), but the previous PASS must go.
  expect((screen.getByLabelText("Action") as HTMLSelectElement).value).toBe(
    "compatible",
  );
  expect(screen.queryByText("Combined simulation")).toBeNull();
  // The candidate review state survives: name, assumptions, invalidation, re-run.
  expect(
    screen.getByText(/Candidate under review: Upgrade billing compatibly/),
  ).toBeTruthy();
  expect(screen.getByText(/Assumes: The vendor shim is stable/)).toBeTruthy();
  expect(screen.getByText(/Previous result invalidated/)).toBeTruthy();
  fireEvent.click(screen.getByText("Re-simulate with candidate"));
  await waitFor(() => expect(s.calls).toHaveLength(2));
  s.resolvers[1]!();
  await screen.findByText("Combined simulation");
  expect(screen.getByText(/Proposal predicted/)).toBeTruthy();
  expect(
    screen.getByText(/Candidate under review: Upgrade billing compatibly/),
  ).toBeTruthy();
});

it("selecting a candidate without transformations preserves the current result", async () => {
  await simulateAndCompose();
  const selects = screen.getAllByText("Select for review");
  fireEvent.click(selects[2]);
  expect(screen.getByText("Combined simulation")).toBeTruthy();
  expect(screen.getByText("Safe Change Composer")).toBeTruthy();
  expect((screen.getByLabelText("Action") as HTMLSelectElement).value).toBe(
    "remove",
  );
});

it("a partially applicable candidate reports what could not be prefilled", async () => {
  await simulateAndCompose();
  const selects = screen.getAllByText("Select for review");
  fireEvent.click(selects[1]);
  expect((screen.getByLabelText("Action") as HTMLSelectElement).value).toBe(
    "compatible",
  );
  expect(
    screen.getByText(/1 transformation\(s\) could not be prefilled/),
  ).toBeTruthy();
  expect(screen.queryByText("Combined simulation")).toBeNull();
});

it("selecting a split-phases candidate preserves the current result", async () => {
  await simulateAndCompose();
  const selects = screen.getAllByText("Select for review");
  fireEvent.click(selects[3]);
  expect(screen.getByText("Combined simulation")).toBeTruthy();
  expect(screen.getByText("Safe Change Composer")).toBeTruthy();
});

it("a candidate with no applicable transformation reports zero prefilled", async () => {
  await simulateAndCompose();
  const selects = screen.getAllByText("Select for review");
  fireEvent.click(selects[4]);
  expect(screen.getByText(/0 of 2 prefilled/)).toBeTruthy();
  expect(
    screen.getByText(/2 transformation\(s\) could not be prefilled/),
  ).toBeTruthy();
  expect((screen.getByLabelText("Action") as HTMLSelectElement).value).toBe(
    "remove",
  );
  expect(screen.queryByText("Combined simulation")).toBeNull();
});
