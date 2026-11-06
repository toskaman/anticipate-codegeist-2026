// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ReleaseCommandCenter from "./ReleaseCommandCenter";
import { ForgeClient } from "../api/ForgeClient";
import { response } from "../../tests/core-test-data";
afterEach(cleanup);

const counts = {
  BLOCKED: 0,
  EVIDENCE_INCOMPLETE: 0,
  NEEDS_REVIEW: 1,
  EXECUTION_PARTIAL: 0,
  APPROVED_NOT_EXECUTED: 0,
  VERIFIED_FOR_RECORDED_SCOPE: 1,
};
const overview = {
  projectKey: "REL",
  evaluatedAt: "2026-11-05T12:00:00.000Z",
  jql: "project = REL",
  releases: [
    {
      fixVersion: "Winter",
      releaseDate: null,
      verdict: "NEEDS_REVIEW",
      counts,
      changes: 2,
      interactions: 1,
      topReasons: [],
    },
  ],
  truncated: false,
  releasesTruncated: false,
  unknowns: [],
  readOnly: true,
};
const decision = (planId: string) => ({
  planId,
  status: "APPROVED",
  verdict: "NEEDS_REVIEW",
  currentVerdict: "NEEDS_REVIEW",
  recordedAt: "2026-11-05T12:00:00.000Z",
  allActionsVerified: false,
});
const safety = {
  scope: {
    projectKey: "REL",
    fixVersion: "Winter",
    jql: "project = REL",
    evaluatedAt: "2026-11-05T12:00:00.000Z",
  },
  verdict: "NEEDS_REVIEW",
  verdictReasons: [],
  counts,
  items: [
    {
      issue: {
        key: "REL-1",
        summary: "Retire Auth API v1",
        status: "To Do",
        url: "https://example.atlassian.net/browse/REL-1",
      },
      state: "NEEDS_REVIEW",
      reasons: ["Waiting for review."],
      decision: decision("plan-1"),
      linkedKeys: ["REL-2"],
    },
    {
      issue: {
        key: "REL-2",
        summary: "Upgrade billing",
        status: "Done",
        url: "https://example.atlassian.net/browse/REL-2",
      },
      state: "VERIFIED_FOR_RECORDED_SCOPE",
      reasons: [],
      decision: decision("plan-2"),
      linkedKeys: [],
    },
  ],
  interactions: [
    {
      kind: "DIRECT_LINK",
      changes: ["REL-1", "REL-2"],
      via: null,
      note: "REL-1 links REL-2.",
    },
  ],
  coverage: {
    issuesRead: 2,
    truncated: false,
    interactionsTruncated: false,
    decisionsVisible: 2,
    unknowns: ["1 unknown relation on REL-1."],
  },
  readOnly: true,
};
const attention = (planId: string, needsReview: boolean) => ({
  planId,
  monitoring: { state: "ACTIVE", reasons: [], lastObservedAt: null },
  coverage: { indexed: 1, unindexed: 0 },
  needsReview,
  items: [],
  truncated: false,
  clearedAt: null,
  note: "",
});

function clientFor() {
  return new ForgeClient(async (op, input) => {
    if (op === "listReleaseSafety") return response(overview);
    if (op === "getReleaseSafety") return response(safety);
    if (op === "getPlanAttention")
      return response(
        attention(
          input.planId as string,
          (input.planId as string) === "plan-1",
        ),
      );
    throw new Error(`unexpected op ${op}`);
  }, 5000);
}

it("digests the release: stale-first action, per-item attention, review wiring", async () => {
  const onReview = vi.fn();
  render(
    <ReleaseCommandCenter
      client={clientFor()}
      projectKey="REL"
      supported
      safetySupported
      onReview={onReview}
    />,
  );
  await screen.findByText("Next: Re-check 1 stale plan(s)");
  expect(screen.getByText("Needs re-check")).toBeTruthy();
  expect(screen.getByText("Fresh")).toBeTruthy();
  expect(screen.getByText("Re-check plan freshness")).toBeTruthy();
  expect(screen.getByText("1 unknown relation on REL-1.")).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByText("Analyze REL-1"));
  });
  expect(onReview).toHaveBeenCalledWith("REL-1");
});

it("renders nothing without the overview capability", () => {
  const { container } = render(
    <ReleaseCommandCenter
      client={clientFor()}
      projectKey="REL"
      supported={false}
      safetySupported
    />,
  );
  expect(container.textContent).toBe("");
});
