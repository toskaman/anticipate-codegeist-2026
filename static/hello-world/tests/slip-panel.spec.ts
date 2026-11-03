import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { SlipSimulation } from "@anticipate/contracts";
import {
  capabilities,
  comparison,
  graph,
  meta,
  response,
} from "./core-test-data";

// ORP-5 (#58). MOCK_TRANSPORT only: the "What if it slips?" panel in the
// Scenario Lab, driven by CORE's simulateSlip operation (PR #59 contract).
const slip: SlipSimulation = {
  issueKey: "ABC-1",
  days: 14,
  assumptions: [
    "Issues blocked by a slipped issue move by the same delay unless their due date has slack.",
    "Release dates are not changed; a release is late when one of its issues is due after it.",
  ],
  moved: [
    {
      key: "ABC-4",
      oldDue: "2026-12-01",
      newDue: "2026-12-05",
      slipDays: 4,
      path: ["ABC-1", "ABC-2", "ABC-4"],
    },
    {
      key: "ABC-2",
      oldDue: "2026-11-20",
      newDue: "2026-12-04",
      slipDays: 14,
      path: ["ABC-1", "ABC-2"],
    },
  ],
  absorbed: [{ key: "ABC-5", due: "2027-02-01", path: ["ABC-1", "ABC-5"] }],
  unknown: [
    { key: "ABC-3", reason: "No due date in Jira", path: ["ABC-1", "ABC-3"] },
  ],
  releases: [
    {
      name: "Mobile 3.1",
      releaseDate: "2026-12-10",
      lateByDays: 0,
      issues: ["ABC-4"],
    },
    {
      name: "Payments 2.0",
      releaseDate: "2026-11-28",
      lateByDays: 6,
      issues: ["ABC-2"],
    },
  ],
  unreadable: [],
  truncated: false,
};

async function lab(page: Page, opts: { advertised: boolean; fail?: boolean }) {
  const slipCalls: unknown[] = [];
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as {
      operation: string;
      input: unknown;
    };
    let data: unknown;
    switch (call.operation) {
      case "getCapabilities":
        data = {
          ...capabilities,
          operations: opts.advertised
            ? [...capabilities.operations, "simulateSlip"]
            : capabilities.operations,
        };
        break;
      case "listProjects":
        data = {
          items: [
            {
              id: "100",
              key: "ABC",
              name: "Transport test project",
              url: null,
              issueCount: 3,
              lastSnapshotAt: null,
              dataAvailability: "NO_SNAPSHOT",
            },
          ],
          page: { nextCursor: null, totalKnown: 1 },
        };
        break;
      case "getGraphSnapshot":
      case "getEvidenceGraph":
        data = graph;
        break;
      case "compareScenarios":
        data = comparison;
        break;
      case "simulateSlip":
        slipCalls.push(call.input);
        if (opts.fail)
          return route.fulfill({
            json: {
              ok: false,
              meta,
              error: {
                code: "PERMISSION_DENIED",
                message: "You cannot browse ABC-1.",
                requestId: meta.requestId,
                retryable: false,
              },
            },
          });
        data = slip;
        break;
      default:
        throw new Error(`Unexpected resolver ${call.operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  await page.goto("/tests/core-harness.html?theme=dark");
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  await page.getByLabel("Jira issue key").fill("ABC-1");
  await page
    .getByRole("button", { name: "Analyze dependencies", exact: true })
    .click();
  await page.getByRole("button", { name: "Compare options" }).click();
  await expect(
    page.getByRole("heading", { name: "Scenario Lab", exact: true }),
  ).toBeVisible();
  return slipCalls;
}

const panel = (page: Page) =>
  page.getByRole("region", { name: "What if it slips?" });

test("slip panel is hidden when the backend does not advertise simulateSlip", async ({
  page,
}) => {
  const calls = await lab(page, { advertised: false });
  await expect(panel(page)).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("slip panel shows late releases first, paths, unknowns and assumptions", async ({
  page,
}) => {
  const calls = await lab(page, { advertised: true });
  const p = panel(page);
  await expect(p).toContainText("Simulation · nothing changed in Jira");
  // Nothing is requested until the user asks.
  expect(calls).toEqual([]);
  const days = p.getByLabel("Delay in days");
  await days.fill("0");
  await expect(p.getByRole("button", { name: "Simulate slip" })).toBeDisabled();
  await expect(p).toContainText("Enter a whole number of days from 1 to 365.");
  await days.fill("14");
  await p.getByRole("button", { name: "Simulate slip" }).click();
  expect(calls).toEqual([{ issueKey: "ABC-1", days: 14 }]);
  await expect(p).toContainText(
    "If ABC-1 slips 14 days: 1 release would be late, 2 due dates would move, 1 item cannot be assessed.",
  );
  const late = p.getByRole("region", { name: "Releases that would be late" });
  await expect(late).toContainText("Late by 6 days");
  await expect(late).toContainText("Payments 2.0");
  await expect(late).not.toContainText("Mobile 3.1");
  const moved = p.getByRole("region", { name: "Due dates that would move" });
  await expect(moved.locator("li").first()).toContainText("ABC-2");
  await expect(moved).toContainText("Path: ABC-1 → ABC-2 → ABC-4");
  await expect(p).toContainText("Cannot be assessed (not assumed safe)");
  await expect(p).toContainText("ABC-3: No due date in Jira");
  await expect(p).toContainText("Releases still on time: Mobile 3.1.");
  await expect(p).toContainText("Release dates are not changed");
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`,
  );
  expect(violations).toEqual([]);
});

test("a refused slip simulation shows the reason and no result", async ({
  page,
}) => {
  await lab(page, { advertised: true, fail: true });
  await panel(page).getByRole("button", { name: "Simulate slip" }).click();
  await expect(panel(page).getByRole("alert")).toContainText(
    "PERMISSION_DENIED",
  );
  await expect(panel(page)).not.toContainText("would be late");
});
