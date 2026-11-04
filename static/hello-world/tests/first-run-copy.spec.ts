import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  capabilities,
  graph,
  comparison,
  plan,
  response,
  meta,
} from "./core-test-data";
import { radarAttention } from "./radar-test-data";

// LOCAL / MOCK_TRANSPORT: scripted first-run observations, not human usability or hosted proof.
async function firstRun(page: Page, theme: string) {
  let projectsVisible = false;
  let slips = 0;
  let radarReads = 0;
  const calls: string[] = [];
  await page.route("**/__core_test", async (route) => {
    const { operation } = route.request().postDataJSON();
    calls.push(operation);
    if (
      operation === "simulatePortfolio" ||
      (operation === "simulateSlip" && slips++ === 0) ||
      (operation === "getPlanAttention" && radarReads++ === 1)
    ) {
      return route.fulfill({
        json: {
          ok: false,
          meta,
          error: {
            code:
              operation === "simulatePortfolio"
                ? "BUDGET_EXCEEDED"
                : "UPSTREAM_UNAVAILABLE",
            message: "Authored first-run service refusal",
            requestId: meta.requestId,
            retryable: true,
          },
        },
      });
    }
    const data =
      operation === "getCapabilities"
        ? {
            ...capabilities,
            portfolioSimulation: "AVAILABLE",
            operations: [
              ...capabilities.operations,
              "simulateSlip",
              "simulatePortfolio",
              "getPlanAttention",
              "checkPlanFreshness",
            ],
          }
        : operation === "listProjects"
          ? {
              items: projectsVisible
                ? [
                    {
                      id: "100",
                      key: "ABC",
                      name: "First-run test project",
                      url: null,
                      issueCount: 3,
                      lastSnapshotAt: null,
                      dataAvailability: "NO_SNAPSHOT",
                    },
                  ]
                : [],
              page: { nextCursor: null, totalKnown: projectsVisible ? 1 : 0 },
            }
          : ["getGraphSnapshot", "getEvidenceGraph"].includes(operation)
            ? graph
            : operation === "compareScenarios"
              ? comparison
              : operation === "generatePreventionPlan"
                ? plan
                : operation === "simulateSlip"
                  ? {
                      issueKey: "ABC-1",
                      days: 10,
                      assumptions: ["Only recorded dates are used."],
                      moved: [],
                      absorbed: [],
                      unknown: [],
                      releases: [],
                      unreadable: [],
                      truncated: false,
                    }
                  : operation === "getPlanAttention"
                    ? {
                        ...radarAttention,
                        needsReview: false,
                        items: [],
                        monitoring: {
                          state: "NOT_CONFIGURED",
                          reasons: ["NOT_INDEXED"],
                          lastObservedAt: null,
                        },
                        coverage: null,
                      }
                    : null;
    if (!data)
      throw new Error(
        `Unexpected first-run operation ${operation}; no mutation allowed`,
      );
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${theme}`);
  return {
    calls,
    grantProject: () => {
      projectsVisible = true;
    },
  };
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

for (const theme of ["light", "dark"])
  for (const width of [390, 1440]) {
    test(`first-run purposes and actionable empty/error states (${theme}, ${width})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      const { calls, grantProject } = await firstRun(page, theme);
      await expect(
        page.getByText("Know what depends on your next change."),
      ).toBeVisible();
      await expect(
        page.getByText(
          "No projects available. Check your Jira project access, then reload this page.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Start the guided demo",
          exact: true,
        }),
      ).toBeVisible();
      await accessible(page);
      grantProject();
      await page.reload();
      await page
        .getByRole("combobox", { name: "Jira project", exact: true })
        .selectOption("100");
      await page.getByLabel("Jira issue key").fill("ABC-1");
      await page
        .getByRole("button", { name: "Analyze dependencies", exact: true })
        .click();
      await expect(
        page.getByText(
          "Trace the dependencies the app could read and inspect the evidence behind them.",
        ),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Compare options", exact: true })
        .click();
      await expect(
        page.getByText(
          "Compare possible consequences before choosing an option to review.",
        ),
      ).toBeVisible();
      const portfolio = page.getByRole("region", {
        name: "Several changes at once",
        exact: true,
      });
      await expect(portfolio).toContainText("Optional:");
      await expect(portfolio).toContainText("without changing Jira");
      await expect(portfolio).toContainText("Select Add change");
      await portfolio
        .getByRole("button", { name: "Add change", exact: true })
        .click();
      await portfolio
        .getByRole("combobox", { name: "Record", exact: true })
        .selectOption("issue:ABC-1");
      await portfolio
        .getByRole("button", { name: "Simulate combined changes", exact: true })
        .click();
      await expect(portfolio.getByRole("alert")).toContainText(
        "BUDGET_EXCEEDED",
      );
      await expect(portfolio.getByRole("alert")).toContainText(
        "Review the changes and try again",
      );
      const slip = page.getByRole("region", {
        name: "What if it slips?",
        exact: true,
      });
      await expect(slip).toContainText("Optional:");
      await expect(slip).toContainText("without changing Jira");
      await expect(slip).toContainText(
        "Choose a delay, then select Simulate slip",
      );
      await slip
        .getByRole("button", { name: "Simulate slip", exact: true })
        .click();
      await expect(slip.getByRole("alert")).toContainText(
        "Review the delay and select Try again",
      );
      expect(
        (await slip.getByRole("alert").innerText()).match(
          /UPSTREAM_UNAVAILABLE/g,
        ),
      ).toHaveLength(1);
      await accessible(page);
      await slip
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await expect(
        slip.getByText("Nothing to move", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/first-run-${theme}-${width}-MOCK_TRANSPORT.png`,
        fullPage: true,
      });
      await page
        .getByRole("combobox", {
          name: "Replacement for option C",
          exact: true,
        })
        .selectOption("issue:ABC-3");
      await page
        .getByRole("button", { name: "Compare options", exact: true })
        .click();
      await page.getByRole("radio", { name: /Migrate first/ }).check();
      await page
        .getByRole("button", { name: "Check safeguards", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Generate prevention plan", exact: true })
        .click();
      const radar = page.getByRole("region", {
        name: "Decision Radar attention",
        exact: true,
      });
      await expect(radar).toContainText(
        "radar reads and evidence re-checks never change Jira",
      );
      await expect(radar).toContainText("radar is not a freshness check");
      await expect(radar).toContainText("Radar not available for this plan");
      await expect(radar).toContainText(radarAttention.note);
      await radar
        .getByRole("button", { name: "Refresh radar", exact: true })
        .click();
      await expect(radar.getByRole("alert")).toContainText(
        "Select Retry radar read to try again",
      );
      await accessible(page);
      await radar
        .getByRole("button", { name: "Retry radar read", exact: true })
        .click();
      await expect(radar).toContainText("Radar not available for this plan");
      await expect(radar.locator(".ax-badge--success")).toHaveCount(0);
      expect(
        calls.some((operation) =>
          /approve|execute|createSample/i.test(operation),
        ),
      ).toBe(false);
      expect(
        calls.filter((operation) => operation === "simulateSlip"),
      ).toHaveLength(2);
      expect(
        calls.filter((operation) => operation === "simulatePortfolio"),
      ).toHaveLength(1);
      expect(
        calls.filter((operation) => operation === "getPlanAttention"),
      ).toHaveLength(3);
    });
  }
