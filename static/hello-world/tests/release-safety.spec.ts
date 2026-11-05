import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { capabilities, response } from "./core-test-data";

// Authored MOCK_TRANSPORT only: every unexpected operation (especially any write) fails the test.
function releaseResult(fixVersion: string | null) {
  return {
    scope: {
      projectKey: "ABC",
      fixVersion,
      jql: 'project = ABC AND labels = "anticipate-change" ORDER BY key ASC',
      evaluatedAt: "2026-11-05T12:00:00.000Z",
    },
    verdict: "NEEDS_REVIEW",
    verdictReasons: [
      "1 interaction(s) between changes need a combined review.",
      "1 change(s) NEEDS_REVIEW.",
      "1 change(s) VERIFIED_FOR_RECORDED_SCOPE.",
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
          key: "ABC-1",
          summary: "Retire Auth API v1",
          status: "To Do",
          url: "https://example.atlassian.net/browse/ABC-1",
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
        linkedKeys: ["ABC-9"],
      },
      {
        issue: {
          key: "ABC-2",
          summary: "Upgrade Auth API v2",
          status: "To Do",
          url: "https://example.atlassian.net/browse/ABC-2",
        },
        state: "NEEDS_REVIEW",
        reasons: [
          "No ANTICIPATE decision of yours is recorded for this change.",
        ],
        decision: null,
        linkedKeys: ["ABC-9"],
      },
    ],
    interactions: [
      {
        kind: "SHARED_DEPENDENCY",
        changes: ["ABC-1", "ABC-2"],
        via: "ABC-9",
        note: "ABC-1 and ABC-2 both touch ABC-9: their combined effect is not covered by either decision alone (Portfolio simulation).",
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
}

async function open(page: Page, theme: string, supported = true) {
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
              ...(supported ? ["getReleaseSafety"] : []),
            ],
          }
        : call.operation === "listProjects"
          ? {
              items: [
                {
                  id: "100",
                  key: "ABC",
                  name: "Release test project",
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
            : call.operation === "getReleaseSafety"
              ? releaseResult(call.input.fixVersion)
              : null;
    if (data === null)
      throw new Error(`Unexpected release test operation: ${call.operation}`);
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${theme}`);
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  return calls;
}

for (const theme of ["dark", "light"]) {
  test(`release safety: verdict, interaction, Jira links, unknowns, read-only (${theme})`, async ({
    page,
  }) => {
    const calls = await open(page, theme);
    const panel = page.getByRole("region", { name: "Release Safety" });
    await panel.getByLabel(/Release \(fixVersion\)/).fill("Winter");
    await panel.getByRole("button", { name: "Check release" }).click();
    await expect(
      panel.getByRole("status").filter({ hasText: "ABC · Winter" }),
    ).toBeVisible();
    await expect(panel.getByText(/both touch ABC-9/)).toBeVisible();
    await expect(panel.getByRole("link", { name: /ABC-2/ })).toHaveAttribute(
      "href",
      "https://example.atlassian.net/browse/ABC-2",
    );
    await panel.getByRole("button", { name: /Needs review/ }).click();
    await expect(panel.getByRole("table").getByRole("row")).toHaveCount(2);
    await panel.getByText(/What this check cannot know/).click();
    await expect(
      panel.getByText(/private decisions are not visible/),
    ).toBeVisible();
    const a11y = await new AxeBuilder({ page })
      .include('section[aria-labelledby="release-safety-title"]')
      .analyze();
    expect(a11y.violations).toEqual([]);
    expect(
      calls.filter(
        (c) =>
          ![
            "getCapabilities",
            "listProjects",
            "getChangeCandidates",
            "getReleaseSafety",
          ].includes(c),
      ),
    ).toEqual([]);
  });
}

test("release safety stays hidden when the backend does not offer it", async ({
  page,
}) => {
  await open(page, "dark", false);
  await expect(
    page.getByRole("heading", { name: "Release Safety" }),
  ).toHaveCount(0);
});
