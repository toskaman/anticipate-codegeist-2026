import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { capabilities, response } from "./core-test-data";

// Authored MOCK_TRANSPORT only: every unexpected operation (especially any write) fails the test.
const counts = {
  BLOCKED: 0,
  EVIDENCE_INCOMPLETE: 0,
  NEEDS_REVIEW: 1,
  EXECUTION_PARTIAL: 0,
  APPROVED_NOT_EXECUTED: 0,
  VERIFIED_FOR_RECORDED_SCOPE: 1,
};
const overview = {
  projectKey: "ABC",
  evaluatedAt: "2026-11-05T12:00:00.000Z",
  jql: "project = ABC",
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
const safety = {
  scope: {
    projectKey: "ABC",
    fixVersion: "Winter",
    jql: "project = ABC",
    evaluatedAt: "2026-11-05T12:00:00.000Z",
  },
  verdict: "NEEDS_REVIEW",
  verdictReasons: [],
  counts,
  items: [
    {
      issue: {
        key: "ABC-1",
        summary: "Retire Auth API v1",
        status: "To Do",
        url: "https://example.atlassian.net/browse/ABC-1",
      },
      state: "NEEDS_REVIEW",
      reasons: ["Waiting for review."],
      decision: {
        planId: "plan-1",
        status: "APPROVED",
        verdict: "NEEDS_REVIEW",
        currentVerdict: "NEEDS_REVIEW",
        recordedAt: "2026-11-05T12:00:00.000Z",
        allActionsVerified: false,
      },
      linkedKeys: ["ABC-2"],
    },
    {
      issue: {
        key: "ABC-2",
        summary: "Upgrade billing",
        status: "Done",
        url: "https://example.atlassian.net/browse/ABC-2",
      },
      state: "VERIFIED_FOR_RECORDED_SCOPE",
      reasons: [],
      decision: null,
      linkedKeys: [],
    },
  ],
  interactions: [
    {
      kind: "SHARED_DEPENDENCY",
      changes: ["ABC-1", "ABC-2"],
      via: "ABC-9",
      note: "ABC-1 and ABC-2 both touch ABC-9.",
    },
  ],
  coverage: {
    issuesRead: 2,
    truncated: false,
    interactionsTruncated: false,
    decisionsVisible: 1,
    unknowns: ["1 unknown relation on ABC-1."],
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

async function open(page: Page, theme: string) {
  const calls: string[] = [];
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON();
    calls.push(call.operation);
    const data =
      call.operation === "getCapabilities"
        ? {
            ...capabilities,
            operations: [
              ...capabilities.operations,
              "listReleaseSafety",
              "getReleaseSafety",
              "getPlanAttention",
            ],
          }
        : call.operation === "listProjects"
          ? {
              items: [
                {
                  id: "100",
                  key: "ABC",
                  name: "Command center project",
                  url: null,
                  issueCount: 3,
                  lastSnapshotAt: null,
                  dataAvailability: "NO_SNAPSHOT",
                },
              ],
              page: { nextCursor: null, totalKnown: 1 },
            }
          : call.operation === "getChangeCandidates"
            ? { items: [], page: { nextCursor: null, totalKnown: 0 } }
            : call.operation === "listReleaseSafety"
              ? overview
              : call.operation === "getReleaseSafety"
                ? safety
                : call.operation === "getPlanAttention"
                  ? attention(call.input.planId, call.input.planId === "plan-1")
                  : null;
    if (data === null)
      throw new Error(`Unexpected command center operation: ${call.operation}`);
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${theme}`);
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  return calls;
}

for (const theme of ["dark", "light"]) {
  test(`command center digests the release with stale-first action (${theme})`, async ({
    page,
  }) => {
    const calls = await open(page, theme);
    const panel = page.getByRole("region", { name: "Release Command Center" });
    await expect(
      panel.getByText("Next: Re-check 1 stale plan(s)"),
    ).toBeVisible();
    await expect(panel.getByText("Needs re-check")).toBeVisible();
    await expect(panel.getByText("Re-check plan freshness")).toBeVisible();
    await expect(panel.getByText("1 unknown relation on ABC-1.")).toBeVisible();
    await expect(panel.getByRole("link", { name: /ABC-1/ })).toHaveAttribute(
      "href",
      "https://example.atlassian.net/browse/ABC-1",
    );
    await expect(
      panel.getByRole("button", { name: "Analyze ABC-1" }),
    ).toBeVisible();
    const a11y = await new AxeBuilder({ page })
      .include('section[aria-labelledby="release-command-center-title"]')
      .analyze();
    expect(a11y.violations).toEqual([]);
    expect(
      calls.filter(
        (c) =>
          ![
            "getCapabilities",
            "listProjects",
            "getChangeCandidates",
            "listReleaseSafety",
            "getReleaseSafety",
            "getPlanAttention",
          ].includes(c),
      ),
    ).toEqual([]);
  });
}
