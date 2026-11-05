// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ReleaseSafety from "./ReleaseSafety";
import { ForgeClient } from "../api/ForgeClient";
import { response } from "../../tests/core-test-data";
afterEach(cleanup);

const result = {
  scope: {
    projectKey: "REL",
    fixVersion: "Winter",
    jql: 'project = REL AND labels = "anticipate-change" AND fixVersion = "Winter" ORDER BY key ASC',
    evaluatedAt: "2026-11-05T12:00:00.000Z",
  },
  verdict: "NEEDS_REVIEW",
  verdictReasons: [
    "1 interaction(s) between changes need a combined review.",
    "1 change(s) NEEDS_REVIEW.",
  ],
  counts: {
    BLOCKED: 0,
    EVIDENCE_INCOMPLETE: 0,
    NEEDS_REVIEW: 1,
    EXECUTION_PARTIAL: 0,
    APPROVED_NOT_EXECUTED: 0,
    VERIFIED_FOR_RECORDED_SCOPE: 1,
  },
  items: [
    {
      issue: {
        key: "REL-1",
        summary: "Retire Auth API v1",
        status: "To Do",
        url: "https://example.atlassian.net/browse/REL-1",
      },
      state: "VERIFIED_FOR_RECORDED_SCOPE",
      reasons: [
        "Verified actions for plan plan-1 (scope recorded at 2026-11-04).",
      ],
      decision: {
        planId: "plan-1",
        status: "COMPLETED",
        verdict: "PASS",
        currentVerdict: "PASS",
        recordedAt: "2026-11-04T10:00:00.000Z",
        allActionsVerified: true,
      },
      linkedKeys: ["SVC-1"],
    },
    {
      issue: {
        key: "REL-2",
        summary: "Upgrade Auth API v2",
        status: "To Do",
        url: "https://example.atlassian.net/browse/REL-2",
      },
      state: "NEEDS_REVIEW",
      reasons: ["No ANTICIPATE decision of yours is recorded for this change."],
      decision: null,
      linkedKeys: ["SVC-1"],
    },
  ],
  interactions: [
    {
      kind: "SHARED_DEPENDENCY",
      changes: ["REL-1", "REL-2"],
      via: "SVC-1",
      note: "REL-1 and REL-2 both touch SVC-1: their combined effect is not covered by either decision alone (Portfolio simulation).",
    },
  ],
  coverage: {
    issuesRead: 2,
    truncated: false,
    interactionsTruncated: false,
    decisionsVisible: 1,
    unknowns: [
      "Other users' private decisions are not visible to you and are counted as missing.",
    ],
  },
  readOnly: true,
};

it("rejects a response for another release scope", async () => {
  const client = new ForgeClient(async () => response(result), 5000);
  render(<ReleaseSafety client={client} supported projectKey="REL" />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Check release" }));
  });
  expect(screen.getByRole("alert").textContent).toMatch(
    /Release scope mismatch/,
  );
});

it("checks a release, shows verdict, interaction, Jira links and unknowns; filters by state", async () => {
  const calls: unknown[] = [];
  const client = new ForgeClient(async (op, input) => {
    calls.push([op, input]);
    return response(result);
  }, 5000);
  render(<ReleaseSafety client={client} supported projectKey="REL" />);
  fireEvent.change(screen.getByLabelText(/Release \(fixVersion\)/), {
    target: { value: "Winter" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Check release" }));
  });
  expect(calls).toEqual([
    ["getReleaseSafety", { projectKey: "REL", fixVersion: "Winter" }],
  ]);
  expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0);
  expect(screen.getByText(/both touch SVC-1/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /REL-2/ }).getAttribute("href")).toBe(
    "https://example.atlassian.net/browse/REL-2",
  );
  expect(screen.getByText(/What this check cannot know/)).toBeTruthy();
  const blocked = screen.getByRole("button", { name: /Needs review/ });
  fireEvent.click(blocked);
  expect(blocked.getAttribute("aria-pressed")).toBe("true");
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows).toHaveLength(2); // header + REL-2
});

it("empty fixVersion means the whole project; failure is recoverable and never claims a Jira change", async () => {
  let fail = true;
  const calls: unknown[] = [];
  const client = new ForgeClient(async (op, input) => {
    calls.push(input);
    if (fail)
      return {
        ok: false as const,
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Jira search failed",
          retryable: true,
        },
        meta: response(null).meta,
      };
    return response({
      ...result,
      scope: { ...result.scope, fixVersion: null },
      items: [],
      counts: {
        ...result.counts,
        NEEDS_REVIEW: 0,
        VERIFIED_FOR_RECORDED_SCOPE: 0,
      },
      interactions: [],
      verdict: "EVIDENCE_INCOMPLETE",
    });
  }, 5000);
  render(<ReleaseSafety client={client} supported projectKey="REL" />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Check release" }));
  });
  expect(calls[0]).toEqual({ projectKey: "REL", fixVersion: null });
  expect(screen.getByRole("alert").textContent).toMatch(/Release check failed/);
  fail = false;
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getAllByText("Evidence incomplete").length).toBeGreaterThan(0);
  expect(screen.getByText("No change issues in this scope.")).toBeTruthy();
});

it("rejects quote-bearing release names client-side and hides when unsupported", () => {
  const client = new ForgeClient(async () => response(result), 5000);
  const v = render(
    <ReleaseSafety client={client} supported projectKey="REL" />,
  );
  fireEvent.change(screen.getByLabelText(/Release \(fixVersion\)/), {
    target: { value: 'a"b' },
  });
  expect(
    (screen.getByRole("button", { name: "Check release" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  v.unmount();
  const { container } = render(
    <ReleaseSafety client={client} supported={false} projectKey="REL" />,
  );
  expect(container.innerHTML).toBe("");
});
