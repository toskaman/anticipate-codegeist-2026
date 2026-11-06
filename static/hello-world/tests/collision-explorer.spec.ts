import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { capabilities, graph, comparison, response } from "./core-test-data";
import { mockPortfolioResult } from "./portfolio-test-data";

// Authored MOCK_TRANSPORT only. The explorer computes on supplied mock output;
// no backend explanation call exists or is expected.
async function lab(page: Page, theme: string) {
  const calls: string[] = [];
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON();
    calls.push(call.operation);
    if (call.operation === "simulatePortfolio") {
      return route.fulfill({
        json: response(mockPortfolioResult(call.input)),
      });
    }
    const data =
      call.operation === "getCapabilities"
        ? {
            ...capabilities,
            portfolioSimulation: "AVAILABLE",
            operations: [...capabilities.operations, "simulatePortfolio"],
          }
        : call.operation === "listProjects"
          ? {
              items: [
                {
                  id: "100",
                  key: "ABC",
                  name: "Explorer test project",
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
      throw new Error(`Unexpected explorer test operation: ${call.operation}`);
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
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  return calls;
}
const panel = (page: Page) =>
  page.getByRole("region", { name: "Several changes at once", exact: true });

for (const theme of ["light", "dark"]) {
  test(`collision explorer explains the mock conflict (${theme})`, async ({
    page,
  }) => {
    const calls = await lab(page, theme);
    const p = panel(page);
    await p.getByRole("button", { name: "Add change", exact: true }).click();
    const first = p.getByRole("group", { name: "Change 1", exact: true });
    await first
      .getByRole("combobox", { name: "Record", exact: true })
      .selectOption(graph.nodes[0].id);
    await first.getByLabel("Name", { exact: true }).fill("Retire API");
    await first
      .getByRole("combobox", { name: "Action", exact: true })
      .selectOption("migrate");
    await first
      .getByLabel("Replacement record")
      .selectOption(graph.nodes[2].id);
    await p.getByRole("button", { name: "Add change", exact: true }).click();
    const second = p.getByRole("group", { name: "Change 2", exact: true });
    await second
      .getByRole("combobox", { name: "Record", exact: true })
      .selectOption(graph.nodes[2].id);
    await second.getByLabel("Name", { exact: true }).fill("Retire replacement");
    await p.getByRole("button", { name: "Simulate combined changes" }).click();
    await expect(
      p.getByRole("heading", { name: "Collision explanations", exact: true }),
    ).toBeVisible();
    await p
      .getByText(/Why these collide \(2 changes, 1 affected records\)/)
      .click();
    await expect(p.getByText("Alone: Pass")).toBeVisible();
    await expect(p.getByText("Alone: Blocked")).toBeVisible();
    await expect(
      p.getByText("ABC-1 Retire API → ABC-2 Consumer"),
    ).toBeVisible();
    await expect(
      p.locator(".ax-collision").getByText("unreadable-edge"),
    ).toBeVisible();
    const a11y = await new AxeBuilder({ page })
      .include(".ax-collision")
      .analyze();
    expect(a11y.violations).toEqual([]);
    expect(
      calls.filter(
        (c) =>
          ![
            "getCapabilities",
            "listProjects",
            "getGraphSnapshot",
            "getEvidenceGraph",
            "compareScenarios",
            "simulatePortfolio",
          ].includes(c),
      ),
    ).toEqual([]);
  });
}
