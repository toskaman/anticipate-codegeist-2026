// @vitest-environment jsdom
// TITAN-5 P0: no data from a previous project may ever be presented as the
// current project's release state. Deferred promises control exactly when each
// backend response lands across project switches. MOCK_TRANSPORT only.
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
import ReleaseCommandCenter from "./ReleaseCommandCenter";
import { CoreClientError, ForgeClient } from "../api/ForgeClient";
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

const mkOverview = (
  projectKey: string,
  fixVersion: string | null,
  changes: number,
) => ({
  projectKey,
  evaluatedAt: "2026-11-05T12:00:00.000Z",
  jql: `project = ${projectKey}`,
  releases:
    fixVersion === null
      ? []
      : [
          {
            fixVersion,
            releaseDate: null,
            verdict: "NEEDS_REVIEW",
            counts,
            changes,
            interactions: 1,
            topReasons: [],
          },
        ],
  truncated: false,
  releasesTruncated: false,
  unknowns: [],
  readOnly: true,
});

const decision = (planId: string) => ({
  planId,
  status: "APPROVED",
  verdict: "NEEDS_REVIEW",
  currentVerdict: "NEEDS_REVIEW",
  recordedAt: "2026-11-05T12:00:00.000Z",
  allActionsVerified: false,
});

const mkSafety = (projectKey: string, fixVersion: string, key: string) => ({
  scope: {
    projectKey,
    fixVersion,
    jql: `project = ${projectKey}`,
    evaluatedAt: "2026-11-05T12:00:00.000Z",
  },
  verdict: "NEEDS_REVIEW",
  verdictReasons: [],
  counts,
  items: [
    {
      issue: {
        key: `${key}-1`,
        summary: "Retire Auth API v1",
        status: "To Do",
        url: `https://example.atlassian.net/browse/${key}-1`,
      },
      state: "NEEDS_REVIEW",
      reasons: ["Waiting for review."],
      decision: decision(`plan-${key}-1`),
      linkedKeys: [`${key}-2`],
    },
    {
      issue: {
        key: `${key}-2`,
        summary: "Upgrade billing",
        status: "Done",
        url: `https://example.atlassian.net/browse/${key}-2`,
      },
      state: "VERIFIED_FOR_RECORDED_SCOPE",
      reasons: [],
      decision: decision(`plan-${key}-2`),
      linkedKeys: [],
    },
  ],
  interactions: [
    {
      kind: "DIRECT_LINK",
      changes: [`${key}-1`, `${key}-2`],
      via: null,
      note: `${key}-1 links ${key}-2.`,
    },
  ],
  coverage: {
    issuesRead: 2,
    truncated: false,
    interactionsTruncated: false,
    decisionsVisible: 2,
    unknowns: [`1 unknown relation on ${key}-1.`],
  },
  readOnly: true,
});

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

const RELEASES: Record<string, { fixVersion: string; changes: number }> = {
  AAA: { fixVersion: "Winter", changes: 2 },
  BBB: { fixVersion: "Summer", changes: 1 },
  CCC: { fixVersion: "Autumn", changes: 3 },
};

function setup(opts?: {
  empty?: string[];
  denyList?: Record<string, CoreClientError>;
  deferSafety?: boolean;
}) {
  const listResolvers: Record<string, Array<() => void>> = {};
  const safetyResolvers: Record<string, Array<() => void>> = {};
  const listCalls: string[] = [];
  const safetyCalls: Array<{ projectKey: string; fixVersion: string }> = [];
  const client = new ForgeClient(async (operation, input) => {
    if (operation === "listReleaseSafety") {
      const projectKey = input.projectKey as string;
      listCalls.push(projectKey);
      const denied = opts?.denyList?.[projectKey];
      if (denied) throw denied;
      return new Promise((resolve) => {
        const queue = (listResolvers[projectKey] ??= []);
        queue.push(() =>
          resolve(
            response(
              opts?.empty?.includes(projectKey)
                ? mkOverview(projectKey, null, 0)
                : mkOverview(
                    projectKey,
                    RELEASES[projectKey]!.fixVersion,
                    RELEASES[projectKey]!.changes,
                  ),
            ),
          ),
        );
      });
    }
    if (operation === "getReleaseSafety") {
      const projectKey = input.projectKey as string;
      const fixVersion = input.fixVersion as string;
      safetyCalls.push({ projectKey, fixVersion });
      if (opts?.deferSafety) {
        return new Promise((resolve) => {
          const queue = (safetyResolvers[projectKey] ??= []);
          queue.push(() =>
            resolve(response(mkSafety(projectKey, fixVersion, projectKey))),
          );
        });
      }
      return response(mkSafety(projectKey, fixVersion, projectKey));
    }
    if (operation === "getPlanAttention")
      return response(
        attention(
          input.planId as string,
          (input.planId as string).endsWith("-1"),
        ),
      );
    throw new Error(`unexpected ${operation}`);
  });
  const resolveList = (projectKey: string) => {
    const queue = listResolvers[projectKey] ?? [];
    listResolvers[projectKey] = [];
    queue.forEach((r) => r());
  };
  const resolveSafety = (projectKey: string) => {
    const queue = safetyResolvers[projectKey] ?? [];
    safetyResolvers[projectKey] = [];
    queue.forEach((r) => r());
  };
  const renderCenter = (projectKey: string, caps?: object) =>
    render(
      <ReleaseCommandCenter
        client={client}
        projectKey={projectKey}
        supported
        safetySupported
        {...caps}
      />,
    );
  return {
    client,
    listCalls,
    safetyCalls,
    resolveList,
    resolveSafety,
    renderCenter,
  };
}

async function settle(ms = 10) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

it("switching projects never shows the previous overview, release or next action", async () => {
  const { resolveList, renderCenter, client } = setup();
  const view = renderCenter("AAA");
  await waitFor(() => expect(view.container.textContent).toContain("Reading"));
  resolveList("AAA");
  await screen.findByText("Winter · 2 change(s)");
  await screen.findByText("AAA-1");
  view.rerender(
    <ReleaseCommandCenter
      client={client}
      projectKey="BBB"
      supported
      safetySupported
    />,
  );
  expect(screen.queryByText(/Winter/)).toBeNull();
  expect(screen.queryByText("AAA-1")).toBeNull();
  expect(screen.queryByText(/Next: /)).toBeNull();
  resolveList("BBB");
  await screen.findByText("Summer · 1 change(s)");
  await screen.findByText("BBB-1");
  expect(screen.queryByText(/Winter/)).toBeNull();
  expect(screen.queryByText("AAA-1")).toBeNull();
});

it("never requests a release of project A scoped to project B", async () => {
  const { safetyCalls, resolveList, renderCenter, client } = setup();
  const view = renderCenter("AAA");
  resolveList("AAA");
  await screen.findByText("Winter · 2 change(s)");
  view.rerender(
    <ReleaseCommandCenter
      client={client}
      projectKey="BBB"
      supported
      safetySupported
    />,
  );
  resolveList("BBB");
  await screen.findByText("Summer · 1 change(s)");
  expect(safetyCalls).toContainEqual({
    projectKey: "BBB",
    fixVersion: "Summer",
  });
  expect(safetyCalls).not.toContainEqual({
    projectKey: "BBB",
    fixVersion: "Winter",
  });
});

it("a late overview from A is discarded after switching to B", async () => {
  const { safetyCalls, resolveList, renderCenter, client } = setup();
  const view = renderCenter("AAA");
  await waitFor(() => expect(view.container.textContent).toContain("Reading"));
  view.rerender(
    <ReleaseCommandCenter
      client={client}
      projectKey="BBB"
      supported
      safetySupported
    />,
  );
  resolveList("AAA");
  await settle();
  resolveList("BBB");
  await screen.findByText("Summer · 1 change(s)");
  expect(screen.queryByText(/Winter/)).toBeNull();
  expect(safetyCalls.filter((c) => c.projectKey === "AAA")).toHaveLength(0);
});

it("a project without releases shows an empty state, not the previous project", async () => {
  const { resolveList, renderCenter, client } = setup({ empty: ["BBB"] });
  const view = renderCenter("AAA");
  resolveList("AAA");
  await screen.findByText("Winter · 2 change(s)");
  view.rerender(
    <ReleaseCommandCenter
      client={client}
      projectKey="BBB"
      supported
      safetySupported
    />,
  );
  resolveList("BBB");
  await screen.findByText("No releases with changes in this project.");
  expect(screen.queryByText(/Winter/)).toBeNull();
  expect(screen.queryByText(/Next: /)).toBeNull();
});

it("a permission refusal shows an error with a retry that refetches the current project", async () => {
  const denied = new CoreClientError(
    "PERMISSION_DENIED",
    "You cannot browse project BBB.",
  );
  const { listCalls, renderCenter } = setup({
    denyList: { BBB: denied },
  });
  renderCenter("BBB");
  await screen.findByText("Release data unavailable");
  expect(screen.getByText(/You cannot browse project BBB/)).toBeTruthy();
  expect(listCalls).toEqual(["BBB"]);
  fireEvent.click(screen.getByText("Try again"));
  await waitFor(() => expect(listCalls).toEqual(["BBB", "BBB"]));
});

it("capability changes reload the current project", async () => {
  const { resolveList, client } = setup();
  const view = render(
    <ReleaseCommandCenter
      client={client}
      projectKey="BBB"
      supported={false}
      safetySupported={false}
    />,
  );
  expect(view.container.textContent).toBe("");
  view.rerender(
    <ReleaseCommandCenter
      client={client}
      projectKey="BBB"
      supported
      safetySupported
    />,
  );
  resolveList("BBB");
  await screen.findByText("Summer · 1 change(s)");
});

it("rapid switches show only the latest project", async () => {
  const { safetyCalls, resolveList, renderCenter, client } = setup();
  const view = renderCenter("AAA");
  view.rerender(
    <ReleaseCommandCenter
      client={client}
      projectKey="BBB"
      supported
      safetySupported
    />,
  );
  view.rerender(
    <ReleaseCommandCenter
      client={client}
      projectKey="CCC"
      supported
      safetySupported
    />,
  );
  resolveList("AAA");
  resolveList("BBB");
  resolveList("CCC");
  await screen.findByText("Autumn · 3 change(s)");
  expect(screen.queryByText(/Winter/)).toBeNull();
  expect(screen.queryByText(/Summer/)).toBeNull();
  expect(safetyCalls).toEqual([{ projectKey: "CCC", fixVersion: "Autumn" }]);
});

it("unmounting cancels in-flight work: late responses trigger no further requests", async () => {
  const { safetyCalls, resolveList, renderCenter } = setup();
  const view = renderCenter("AAA");
  await waitFor(() => expect(view.container.textContent).toContain("Reading"));
  view.unmount();
  await act(async () => {
    resolveList("AAA");
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(safetyCalls).toHaveLength(0);
});

it("a late safety response from a previous project is discarded", async () => {
  const { resolveList, resolveSafety, renderCenter, client } = setup({
    deferSafety: true,
  });
  const view = renderCenter("AAA");
  resolveList("AAA");
  await screen.findByText("Winter · 2 change(s)");
  view.rerender(
    <ReleaseCommandCenter
      client={client}
      projectKey="BBB"
      supported
      safetySupported
    />,
  );
  resolveList("BBB");
  await screen.findByText("Summer · 1 change(s)");
  await act(async () => {
    resolveSafety("AAA");
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(screen.queryByText("AAA-1")).toBeNull();
  expect(screen.queryByText("Winter · 2 change(s)")).toBeNull();
  resolveSafety("BBB");
  await screen.findByText("BBB-1");
  expect(screen.queryByText("AAA-1")).toBeNull();
});
