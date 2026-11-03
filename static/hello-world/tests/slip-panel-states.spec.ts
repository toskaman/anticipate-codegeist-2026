import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { SlipSimulation } from "@anticipate/contracts";
import {
  capabilities,
  comparison,
  graph,
  meta,
  response,
} from "./core-test-data";

// ORP-7 (#67). MOCK_TRANSPORT only: the "What if it slips?" panel on
// non-ideal data (empty, invalid input, errors, unreadable issues, loading).
const empty: SlipSimulation = {
  issueKey: "ABC-1",
  days: 10,
  assumptions: ["Only due dates and fix versions present in Jira are used."],
  moved: [],
  absorbed: [],
  unknown: [],
  releases: [],
  unreadable: [],
  truncated: false,
};

type SlipHandler = (route: Route, input: unknown) => Promise<void>;

async function lab(
  page: Page,
  onSlip: SlipHandler,
  theme: "light" | "dark" = "dark",
) {
  const calls: unknown[] = [];
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
          operations: [...capabilities.operations, "simulateSlip"],
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
        calls.push(call.input);
        return onSlip(route, call.input);
      default:
        throw new Error(`Unexpected resolver ${call.operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${theme}`);
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
  return calls;
}

const ok =
  (data: SlipSimulation): SlipHandler =>
  (route) =>
    route.fulfill({ json: response(data) });
const panel = (page: Page) =>
  page.getByRole("region", { name: "What if it slips?" });
const simulate = (page: Page) =>
  panel(page).getByRole("button", { name: "Simulate slip" }).click();
const axe = async (page: Page) =>
  (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`,
  );

test("1. no due dates or fix versions: a clear 'nothing to move' message, not an empty list", async ({
  page,
}) => {
  await lab(page, ok(empty));
  await simulate(page);
  const p = panel(page);
  await expect(p.getByText("Nothing to move")).toBeVisible();
  await expect(p).toContainText("have no due dates or fix versions in Jira");
  await expect(p.locator(".ax-slip__list li")).toHaveCount(0);
  await expect(p).not.toContainText("Releases that would be late");
  await expect(p).not.toContainText("Due dates that would move");
});

test("2. 0 or more than 365 days: validation message and no request", async ({
  page,
}) => {
  const calls = await lab(page, ok(empty));
  const p = panel(page);
  const days = p.getByLabel("Delay in days");
  const button = p.getByRole("button", { name: "Simulate slip" });
  for (const bad of ["0", "366", "-1", "2.5", "abc"]) {
    await days.fill(bad);
    await expect(days).toHaveAttribute("aria-invalid", "true");
    await expect(button).toBeDisabled();
    await expect(p).toContainText(
      "Enter a whole number of days from 1 to 365.",
    );
    // Enter in the field must not submit an invalid value either.
    await days.press("Enter");
  }
  expect(calls).toEqual([]);
  await days.fill("365");
  await expect(button).toBeEnabled();
});

test("3. backend error: explicit error, retry, and no stale result", async ({
  page,
}) => {
  let fail = false;
  const calls = await lab(page, (route) =>
    fail
      ? route.fulfill({
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
        })
      : route.fulfill({
          json: response({
            ...empty,
            moved: [
              {
                key: "ABC-2",
                oldDue: "2026-11-20",
                newDue: "2026-11-30",
                slipDays: 10,
                path: ["ABC-1", "ABC-2"],
              },
            ],
          }),
        }),
  );
  const p = panel(page);
  await simulate(page);
  await expect(p).toContainText("Due dates that would move");
  // A later failure removes the earlier result instead of leaving it on screen.
  fail = true;
  await simulate(page);
  const alert = p.getByRole("alert");
  await expect(alert).toContainText(
    "PERMISSION_DENIED: You cannot browse ABC-1.",
  );
  await expect(alert).toContainText(
    "No result is shown, and nothing was changed in Jira.",
  );
  await expect(p).not.toContainText("Due dates that would move");
  await expect(p).not.toContainText("Simulation result");
  // Retry sends the same request again and recovers.
  fail = false;
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(p).toContainText("Due dates that would move");
  await expect(p.getByRole("alert")).toHaveCount(0);
  expect(calls).toHaveLength(3);
});

test("4. unreadable downstream issue is listed as cannot be assessed, never as unaffected", async ({
  page,
}) => {
  await lab(
    page,
    ok({
      ...empty,
      unknown: [
        {
          key: "ABC-3",
          reason: "No due date in Jira",
          path: ["ABC-1", "ABC-3"],
        },
      ],
      unreadable: ["ABC-9"],
    }),
  );
  await simulate(page);
  const p = panel(page);
  const block = p.locator(".ax-notice").filter({
    hasText: "Cannot be assessed (not assumed safe)",
  });
  await expect(block).toContainText("ABC-9: you cannot read this issue");
  await expect(block).toContainText("ABC-3: No due date in Jira");
  await expect(p).toContainText("2 items cannot be assessed");
  await expect(p).not.toContainText("Still on time thanks to slack");
});

test("5. loading is announced to screen readers and the result region is busy", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await lab(page, async (route) => {
    await gate;
    await route.fulfill({ json: response(empty) });
  });
  const p = panel(page);
  await simulate(page);
  await expect(p.getByRole("status")).toHaveText(
    "Simulating a 10-day slip of ABC-1…",
  );
  await expect(p.getByRole("button", { name: "Simulating…" })).toBeDisabled();
  release();
  await expect(p.getByRole("status")).toHaveText("Simulation complete.");
  await expect(
    p.getByRole("region", {
      name: "Simulation result (nothing changed in Jira)",
    }),
  ).toHaveAttribute("aria-busy", "false");
});

test("6. the result is labelled as a simulation that changed nothing in Jira", async ({
  page,
}) => {
  await lab(page, ok(empty));
  const p = panel(page);
  await expect(p).toContainText("Simulation · nothing changed in Jira");
  await simulate(page);
  await expect(
    p.getByRole("heading", {
      name: "Simulation result (nothing changed in Jira)",
    }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"] as const)
  test(`7. no axe violations on the empty, error and unknown states (${theme})`, async ({
    page,
  }) => {
    let mode: "empty" | "error" = "empty";
    await lab(
      page,
      (route) =>
        mode === "error"
          ? route.fulfill({
              json: {
                ok: false,
                meta,
                error: {
                  code: "UPSTREAM_UNAVAILABLE",
                  message: "Jira did not answer.",
                  requestId: meta.requestId,
                  retryable: true,
                },
              },
            })
          : route.fulfill({
              json: response({ ...empty, unreadable: ["ABC-9"] }),
            }),
      theme,
    );
    await simulate(page);
    await expect(panel(page).getByText("Nothing to move")).toBeVisible();
    expect(await axe(page)).toEqual([]);
    mode = "error";
    await simulate(page);
    await expect(panel(page).getByRole("alert")).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
