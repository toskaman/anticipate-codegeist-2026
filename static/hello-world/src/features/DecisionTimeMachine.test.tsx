// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import DecisionTimeMachine from "./DecisionTimeMachine";
import { ForgeClient } from "../api/ForgeClient";
import { response } from "../../tests/core-test-data";
afterEach(cleanup);

const base = {
  from: "issue:PAY-3",
  to: "issue:PAY-1",
  kind: "DEPENDS_ON",
  status: "CONFIRMED",
};
const added = {
  from: "issue:PAY-4",
  to: "issue:PAY-1",
  kind: "DEPENDS_ON",
  status: "CONFIRMED",
};
const history = {
  planId: "plan-1",
  rootIssueKey: "PAY-1",
  scenarioId: "B",
  status: "INVALIDATED",
  canAuthorizeExecution: false,
  statusReason:
    "Cannot authorize execution: evidence changed (1 relation added).",
  baseline: {
    snapshotId: "snap-1",
    capturedAt: "2026-11-02T09:00:00.000Z",
    evidenceState: "LIVE",
    edges: [base],
    edgesTruncated: false,
    scope: "CAUSAL_EDGES",
  },
  checkpoints: [
    {
      id: "cp-0",
      at: "2026-11-02T09:00:00.000Z",
      kind: "BASELINE",
      stage: "snapshot",
      fresh: true,
      added: [],
      removed: [],
      becameUnknown: [],
      truncated: false,
      reason: "Evidence captured.",
    },
    {
      id: "cp-1",
      at: "2026-11-02T09:01:00.000Z",
      kind: "CHECK",
      stage: "approval",
      fresh: true,
      added: [],
      removed: [],
      becameUnknown: [],
      truncated: false,
      reason: "unchanged",
    },
    {
      id: "cp-2",
      at: "2026-11-02T09:05:00.000Z",
      kind: "CHECK",
      stage: "freshness",
      fresh: false,
      added: [added],
      removed: [],
      becameUnknown: [],
      truncated: false,
      reason: "1 relation added",
    },
  ],
  droppedCheckpoints: 0,
  events: [
    {
      at: "2026-11-02T09:01:00.000Z",
      event: "2 action(s) approved for plan hash abc",
      source: "APPROVAL",
    },
  ],
  invalidation: {
    checkpointId: "cp-2",
    at: "2026-11-02T09:05:00.000Z",
    reason: "1 relation added",
  },
  limits: ["Baseline holds causal relations only."],
  readOnly: true,
};

it("explains the invalidation and diffs the baseline against the invalidating check", async () => {
  const client = new ForgeClient(async () => response(history), 5000);
  await act(async () => {
    render(<DecisionTimeMachine client={client} planId="plan-1" />);
  });
  expect(screen.getByText("Why this decision is blocked now")).toBeTruthy();
  expect(screen.getByText(/PAY-4 depends on PAY-1/)).toBeTruthy();
  expect(screen.getByText("Added")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Before"), {
    target: { value: "cp-1" },
  });
  fireEvent.change(screen.getByLabelText("After"), {
    target: { value: "cp-1" },
  });
  expect(
    screen.getByText("No recorded difference between these checkpoints."),
  ).toBeTruthy();
  expect(
    screen
      .getAllByRole("listitem")
      .some((li) => li.getAttribute("aria-current") === "step"),
  ).toBe(true);
});

it("a failed read is recoverable and claims nothing", async () => {
  let fail = true;
  const client = new ForgeClient(
    async () =>
      fail
        ? {
            ok: false as const,
            error: {
              code: "NOT_FOUND",
              message: "The evidence for this plan is no longer retained.",
              retryable: false,
              requestId: response(null).meta.requestId,
            },
            meta: response(null).meta,
          }
        : response(history),
    5000,
  );
  await act(async () => {
    render(<DecisionTimeMachine client={client} planId="plan-1" />);
  });
  expect(screen.getByRole("alert").textContent).toMatch(/no longer retained/);
  fail = false;
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  });
  expect(screen.queryByRole("alert")).toBeNull();
});
