// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import DecisionTimeMachine from "./DecisionTimeMachine";
import { ForgeClient } from "../api/ForgeClient";
import { response } from "../../tests/core-test-data";
afterEach(cleanup);

const checkpoint = {
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
};
const history = (over: Record<string, unknown>) => ({
  planId: "plan-1",
  rootIssueKey: "PAY-1",
  scenarioId: "B",
  status: "APPROVED",
  canAuthorizeExecution: true,
  statusReason: "Approved.",
  baseline: {
    snapshotId: "snap-1",
    capturedAt: "2026-11-02T09:00:00.000Z",
    evidenceState: "LIVE",
    edges: [],
    edgesTruncated: false,
    scope: "CAUSAL_EDGES",
  },
  checkpoints: [checkpoint],
  droppedCheckpoints: 0,
  events: [],
  invalidation: null,
  limits: [],
  readOnly: true,
  ...over,
});

it("names dropped checkpoints and a non-live baseline", async () => {
  const client = new ForgeClient(
    async () =>
      response(
        history({
          droppedCheckpoints: 3,
          baseline: {
            snapshotId: "snap-1",
            capturedAt: "2026-11-02T09:00:00.000Z",
            evidenceState: "EXPIRED_SNAPSHOT",
            edges: [],
            edgesTruncated: false,
            scope: "CAUSAL_EDGES",
          },
        }),
      ),
    5000,
  );
  render(<DecisionTimeMachine client={client} planId="plan-1" />);
  await screen.findByText(/3 older checkpoint\(s\) dropped/);
  expect(
    screen.getByText(/Baseline evidence is expired snapshot/),
  ).toBeTruthy();
});

it("stays silent when nothing was dropped and the baseline is live", async () => {
  const client = new ForgeClient(async () => response(history({})), 5000);
  render(<DecisionTimeMachine client={client} planId="plan-1" />);
  await screen.findByText("Recorded history · read-only");
  expect(screen.queryByText(/Retention:/)).toBeNull();
});
