import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { SimulatePortfolioRequest } from "@anticipate/contracts";
import {
  capabilities,
  graph,
  comparison,
  response,
  meta,
} from "./core-test-data";
import { mockPortfolioResult } from "./portfolio-test-data";

// Authored MOCK_TRANSPORT only. Reject every unexpected operation, especially writes.
async function lab(
  page: Page,
  options: {
    theme?: string;
    capability?: string;
    operation?: boolean;
    handle?: (route: Route, input: SimulatePortfolioRequest) => Promise<void>;
  } = {},
) {
  const calls: { operation: string; input: SimulatePortfolioRequest }[] = [];
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON();
    calls.push(call);
    if (call.operation === "simulatePortfolio") {
      if (options.handle) return options.handle(route, call.input);
      return route.fulfill({ json: response(mockPortfolioResult(call.input)) });
    }
    const data =
      call.operation === "getCapabilities"
        ? {
            ...capabilities,
            portfolioSimulation:
              options.capability === "absent"
                ? undefined
                : (options.capability ?? "AVAILABLE"),
            operations: [
              ...capabilities.operations,
              ...(options.operation === false ? [] : ["simulatePortfolio"]),
            ],
          }
        : call.operation === "listProjects"
          ? {
              items: [
                {
                  id: "100",
                  key: "ABC",
                  name: "Portfolio test project",
                  url: null,
                  issueCount: 3,
                  lastSnapshotAt: null,
                  dataAvailability: "NO_SNAPSHOT",
                },
              ],
              page: { nextCursor: null, totalKnown: 1 },
            }
          : call.operation === "compareScenarios"
            ? comparison
            : ["getGraphSnapshot", "getEvidenceGraph"].includes(call.operation)
              ? graph
              : null;
    if (data === null)
      throw new Error(`Unexpected portfolio test operation: ${call.operation}`);
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${options.theme ?? "dark"}`);
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  await page.getByLabel("Jira issue key").fill("ABC-1");
  await page
    .getByRole("button", { name: "Analyze dependencies", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Scenario Lab", exact: true }),
  ).toBeVisible();
  return calls;
}
const panel = (page: Page) =>
  page.getByRole("region", { name: "Several changes at once", exact: true });
async function add(page: Page, index = 1, nodeIndex = 0) {
  const p = panel(page);
  await p.getByRole("button", { name: "Add change", exact: true }).click();
  const change = p.getByRole("group", { name: `Change ${index}`, exact: true });
  await expect(
    change.getByRole("textbox", { name: "Name", exact: true }),
  ).toBeFocused();
  await change
    .getByRole("combobox", { name: "Record", exact: true })
    .selectOption(graph.nodes[nodeIndex].id);
  return change;
}

for (const gate of [
  "absent",
  "NOT_CONFIGURED",
  "UNSUPPORTED",
  "operation-missing",
]) {
  test(`portfolio panel stays hidden for ${gate}`, async ({ page }) => {
    const calls = await lab(page, {
      capability: gate === "operation-missing" ? "AVAILABLE" : gate,
      operation: gate !== "operation-missing",
    });
    await expect(panel(page)).toHaveCount(0);
    expect(
      calls.filter((c) => c.operation === "simulatePortfolio"),
    ).toHaveLength(0);
  });
}
for (const theme of ["light", "dark"]) {
  test(`portfolio shows supplied consequences, provenance and assumptions (${theme})`, async ({
    page,
  }) => {
    const calls = await lab(page, { theme });
    const p = panel(page);
    await page
      .getByRole("combobox", { name: "Replacement for option C", exact: true })
      .selectOption(graph.nodes[2].id);
    await page
      .getByRole("button", { name: "Compare options", exact: true })
      .click();
    const decisions = page.getByRole("radiogroup", {
      name: "Decision options",
    });
    await decisions.getByRole("radio").nth(1).check();
    const selectedDecision = await page
      .locator(".ax-scenarios input:checked")
      .evaluate(
        (input) => (input as HTMLInputElement).closest("label")?.textContent,
      );
    await expect(p).toContainText("No changes added");
    await expect(
      p.getByRole("button", { name: "Simulate combined changes" }),
    ).toBeDisabled();
    const first = await add(page);
    await first.getByLabel("Name", { exact: true }).fill("Retire API");
    await first
      .getByRole("combobox", { name: "Action", exact: true })
      .selectOption("migrate");
    await expect(
      p.getByRole("button", { name: "Simulate combined changes" }),
    ).toBeDisabled();
    await expect(
      first
        .getByLabel("Replacement record")
        .locator(`option[value='${graph.nodes[0].id}']`),
    ).toHaveCount(0);
    await first
      .getByLabel("Replacement record")
      .selectOption(graph.nodes[2].id);
    const second = await add(page, 2, 2);
    await second.getByLabel("Name", { exact: true }).fill("Retire replacement");
    await p.getByRole("button", { name: "Simulate combined changes" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      p.getByRole("heading", { name: "Combined simulation", exact: true }),
    ).toBeVisible();
    await expect(p).toContainText("The selected replacement is also retired");
    await expect(p).toContainText("Unknown relationship was not migrated");
    await expect(p).toContainText("Unknown");
    await expect(p).toContainText("Inferred");
    await expect(p).toContainText("The second change removes the replacement");
    await expect(p).toContainText(
      "Suggested order: Retire API → Retire replacement",
    );
    await p.getByText("Snapshot and reproducibility", { exact: true }).click();
    await expect(p).toContainText("mock-portfolio-result-hash");
    const request = calls.filter((c) => c.operation === "simulatePortfolio");
    expect(request).toHaveLength(1);
    expect(request[0].input).toMatchObject({
      snapshotId: graph.snapshotId,
      projectId: graph.projectId,
      rootIssueKey: "ABC-1",
      proposedOrder: ["change-1", "change-2"],
      changes: [
        {
          label: "Retire API",
          operations: [
            {
              op: "MIGRATE_DEPENDENTS",
              fromNodeId: graph.nodes[0].id,
              toNodeId: graph.nodes[2].id,
            },
          ],
        },
        { label: "Retire replacement" },
      ],
    });
    expect(calls.some((c) => /approve|execute|create/i.test(c.operation))).toBe(
      false,
    );
    expect(
      await page
        .locator(".ax-scenarios input:checked")
        .evaluate(
          (input) => (input as HTMLInputElement).closest("label")?.textContent,
        ),
    ).toBe(selectedDecision);
    for (const width of [320, 390, 768, 1024, 1440, 1920, 3440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `overflow ${width}`,
      ).toBe(true);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include(".ax-portfolio")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 1000 });
    await p.screenshot({
      path: `test-results/portfolio-${theme}-390-MOCK_TRANSPORT.png`,
      style: "#root > p[role='status'] { position: static !important; }",
    });
    await second.getByLabel("Name", { exact: true }).fill("Changed draft");
    await expect(
      p.getByRole("heading", { name: "Combined simulation", exact: true }),
    ).toHaveCount(0);
    expect(
      calls.filter((c) => c.operation === "simulatePortfolio"),
    ).toHaveLength(1);
  });
}
test("ten-change bound, deletion and proposed ordering remain explicit", async ({
  page,
}) => {
  const calls = await lab(page);
  const p = panel(page);
  for (let i = 1; i <= 10; i++) await add(page, i);
  await expect(
    p.getByRole("button", { name: "Add change", exact: true }),
  ).toBeDisabled();
  await expect(p.getByRole("group", { name: /^Change \d+$/ })).toHaveCount(10);
  await p
    .getByRole("button", { name: "Move change 2 earlier", exact: true })
    .click();
  await p.getByRole("button", { name: "Simulate combined changes" }).click();
  await expect(
    p.getByRole("heading", { name: "Combined simulation", exact: true }),
  ).toBeVisible();
  const input = calls.find((c) => c.operation === "simulatePortfolio")!.input;
  expect(input.changes).toHaveLength(10);
  expect(input.proposedOrder?.slice(0, 2)).toEqual(["change-2", "change-1"]);
  await p.getByRole("button", { name: "Remove change 1", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add change", exact: true }),
  ).toBeEnabled();
  await expect(
    p.getByRole("button", { name: "Add change", exact: true }),
  ).toBeFocused();
  await expect(
    p.getByRole("heading", { name: "Combined simulation", exact: true }),
  ).toHaveCount(0);
});
for (const code of ["VALIDATION", "BUDGET_EXCEEDED"] as const) {
  test(`${code} clears the previous result and never retries automatically`, async ({
    page,
  }) => {
    let runs = 0;
    const calls = await lab(page, {
      handle: async (route, input) => {
        runs++;
        await route.fulfill({
          json:
            runs === 1
              ? response(mockPortfolioResult(input))
              : {
                  ok: false,
                  meta,
                  error: {
                    code,
                    message: "Backend portfolio refusal",
                    requestId: meta.requestId,
                    retryable: false,
                  },
                },
        });
      },
    });
    await add(page);
    const p = panel(page);
    await p.getByRole("button", { name: "Simulate combined changes" }).click();
    await expect(
      p.getByRole("heading", { name: "Combined simulation", exact: true }),
    ).toBeVisible();
    await p.getByRole("button", { name: "Simulate combined changes" }).click();
    await expect(p.getByRole("alert")).toContainText(
      `${code}: Backend portfolio refusal`,
    );
    await expect(
      p.getByRole("heading", { name: "Combined simulation", exact: true }),
    ).toHaveCount(0);
    expect(
      calls.filter((c) => c.operation === "simulatePortfolio"),
    ).toHaveLength(2);
  });
}
test("cycles and missing nested snapshot identity never become an approved order", async ({
  page,
}) => {
  let runs = 0;
  await lab(page, {
    handle: async (route, input) => {
      const value = mockPortfolioResult(input);
      runs++;
      if (runs === 1) {
        value.ordering.order = null;
        value.ordering.cycles = [[input.changes[0].id]];
      } else value.snapshot.snapshotId = "wrong-snapshot";
      await route.fulfill({ json: response(value) });
    },
  });
  await add(page);
  const p = panel(page);
  await p.getByRole("button", { name: "Simulate combined changes" }).click();
  await expect(p).toContainText("No compatible order reported");
  await p.getByRole("button", { name: "Simulate combined changes" }).click();
  await expect(p.getByRole("alert")).toContainText(
    "does not match the analysed snapshot",
  );
  await expect(
    p.getByRole("heading", { name: "Combined simulation", exact: true }),
  ).toHaveCount(0);
});
