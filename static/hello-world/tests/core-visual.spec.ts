// Visual QA for the redesigned hosted workspace. Provenance: MOCK_TRANSPORT — the real
// CoreWorkspace + ForgeClient validation, with test envelopes instead of Forge.
// Screenshots go to evidence/experience/v3-redesign/visual (see docs/design/UI_VISUAL_QA.md).
import { test, expect, type Page } from "@playwright/test";
import type { ExecutionRecord } from "@anticipate/contracts";
import {
  response,
  meta,
  capabilities,
  lockedSharedDecisionsFlag,
} from "./core-test-data";
import {
  showcaseProject,
  showcaseGraph,
  showcaseComparison,
  showcasePlan,
  showcaseRecords,
  showcasePassport,
} from "./core-showcase-data";

const OUT = "../../evidence/experience/v3-redesign/visual";

async function showcaseCore(
  page: Page,
  options: { noProjects?: boolean; writes?: string } = {},
) {
  const calls: string[] = [];
  let plan = structuredClone(showcasePlan);
  let records: ExecutionRecord[] = [];
  await page.route("**/__core_test", async (route) => {
    const { operation, input } = route.request().postDataJSON();
    calls.push(operation);
    let data: unknown;
    switch (operation) {
      case "getCapabilities":
        data = {
          ...capabilities,
          jiraWrite: options.writes ?? "AVAILABLE",
          rovoMcp: "AVAILABLE",
        };
        break;
      case "listProjects":
        data = {
          items: options.noProjects ? [] : [showcaseProject],
          page: { nextCursor: null, totalKnown: null },
        };
        break;
      case "getChangeCandidates":
        data = {
          items: [
            {
              id: "412",
              key: "PAY-412",
              summary: "Retire legacy Auth API v1",
              status: "To Do",
              issueType: "Task",
              url: null,
              updatedAt: meta.generatedAt,
              projectId: "300",
            },
            {
              id: "430",
              key: "PAY-430",
              summary: "Migrate mobile login to Auth v2",
              status: "In Progress",
              issueType: "Story",
              url: null,
              updatedAt: meta.generatedAt,
              projectId: "300",
            },
          ],
          page: { nextCursor: null, totalKnown: 2 },
        };
        break;
      case "getGraphSnapshot":
      case "getEvidenceGraph":
        data = showcaseGraph;
        break;
      case "compareScenarios":
        data = {
          ...showcaseComparison,
          results: showcaseComparison.results.filter((r) =>
            input.scenarios.some(
              (s: { scenarioId: string }) => s.scenarioId === r.scenarioId,
            ),
          ),
        };
        break;
      case "generatePreventionPlan":
        plan = {
          ...structuredClone(showcasePlan),
          scenarioId: input.scenarioId,
        };
        data = plan;
        break;
      case "approvePlan":
        plan = { ...plan, status: "APPROVED" };
        data = plan;
        break;
      case "executeApprovedPlan":
        records = showcaseRecords(plan, String(input.idempotencyKey));
        plan = { ...plan, status: "PARTIAL" };
        data = records;
        break;
      case "getExecutionStatus":
        data = records;
        break;
      case "getPreventionPassport":
        data = showcasePassport(plan, records);
        break;
      case "getFeatureFlag":
        data = lockedSharedDecisionsFlag;
        break;
      default:
        throw new Error(`Unexpected operation ${operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  return calls;
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name, exact: true }),
  ).toBeVisible();
}
async function noOverflow(page: Page, label: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    label,
  ).toBe(true);
}
async function analyze(page: Page) {
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("300");
  await page
    .getByRole("button", { name: "Load change candidates", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Change candidate", exact: true })
    .selectOption("PAY-412");
  await page
    .getByRole("button", { name: "Analyze dependencies", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dependency map" }),
  ).toBeVisible();
}
async function compare(page: Page) {
  await nav(page, "Scenario Lab");
  await page
    .getByRole("combobox", { name: "Replacement for option C" })
    .selectOption("svc:auth-v2");
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  await expect(
    page.getByRole("radiogroup", { name: "Decision options" }),
  ).toBeVisible();
}

const viewports = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", width: 390, height: 844 },
];

for (const vp of viewports)
  for (const theme of ["dark", "light"] as const)
    test(`visual journey ${vp.tag} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const calls = await showcaseCore(page);
      await page.goto(`/tests/core-harness.html?theme=${theme}`);
      await expect(
        page.getByRole("heading", { level: 1, name: "Mission Control" }),
      ).toBeVisible();
      await shot(page, `01-mission-control-first-run-${vp.tag}-${theme}`);
      await analyze(page);
      await shot(page, `02-evidence-graph-${vp.tag}-${theme}`);
      await compare(page);
      await shot(page, `03-scenario-lab-${vp.tag}-${theme}`);
      // Signature: causal path in the graph for the selected option.
      await nav(page, "Evidence Graph");
      await page.getByRole("button", { name: "Remove now" }).click();
      if (vp.tag === "mobile")
        await page
          .getByRole("searchbox", { name: "Search evidence" })
          .fill("Partner");
      await page
        .locator(".ax-evidence-item", { hasText: "Partner webhooks" })
        .click();
      await expect(
        page.getByRole("list", { name: "Impact path to Partner webhooks" }),
      ).toBeVisible();
      await shot(page, `04-evidence-graph-causal-path-${vp.tag}-${theme}`);
      // Policy-blocking state, then the selected (recommended) option.
      await nav(page, "Scenario Lab");
      await page.getByRole("radio", { name: /Remove now/ }).check();
      await nav(page, "Decision Firewall");
      await expect(
        page.getByRole("heading", { name: "Policy blocks this option" }),
      ).toBeVisible();
      await shot(page, `05-decision-firewall-blocked-${vp.tag}-${theme}`);
      await nav(page, "Scenario Lab");
      await page.getByRole("radio", { name: /Migrate first/ }).check();
      await nav(page, "Decision Firewall");
      await shot(page, `06-decision-firewall-pass-${vp.tag}-${theme}`);
      await page
        .getByRole("button", { name: "Generate prevention plan" })
        .click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Prevention Plan" }),
      ).toBeVisible();
      await shot(page, `07-prevention-plan-review-${vp.tag}-${theme}`);
      for (const a of showcasePlan.actions)
        await page
          .getByRole("checkbox", { name: `Approve ${a.actionId}` })
          .check();
      await page
        .getByRole("button", { name: "Approve selected actions" })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, `08-approval-confirmation-${vp.tag}-${theme}`, false);
      await page.getByRole("button", { name: "Record approval" }).click();
      await expect(
        page.getByText(
          "Backend approval recorded. No execution was requested.",
        ),
      ).toBeVisible();
      expect(calls.filter((c) => c === "executeApprovedPlan")).toHaveLength(0);
      await page
        .getByRole("button", { name: "Execute approved actions" })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, `09-execution-confirmation-${vp.tag}-${theme}`, false);
      await page.getByRole("button", { name: "Execute in Jira" }).click();
      await expect(
        page.getByRole("list", { name: "Execution records" }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Plan summary" }),
      ).toContainText("Partially completed");
      await shot(page, `10-prevention-plan-partial-${vp.tag}-${theme}`);
      await page
        .getByRole("button", { name: "Open Prevention Passport" })
        .click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Prevention Passport" }),
      ).toBeVisible();
      await shot(page, `11-prevention-passport-${vp.tag}-${theme}`);
      await nav(page, "Settings");
      await shot(page, `12-settings-${vp.tag}-${theme}`);
      for (const name of [
        "Mission Control",
        "Evidence Graph",
        "Scenario Lab",
        "Decision Firewall",
        "Prevention Plan",
        "Prevention Passport",
        "Settings",
      ]) {
        await nav(page, name);
        await noOverflow(page, `${name} ${vp.tag} ${theme}`);
      }
      expect(calls.filter((c) => c === "executeApprovedPlan")).toHaveLength(1);
    });

test("visual empty site and permission states", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await showcaseCore(page, { noProjects: true });
  await page.goto("/tests/core-harness.html?theme=dark");
  await expect(
    page.getByText("No projects available.", { exact: false }),
  ).toBeVisible();
  await shot(page, "13-mission-control-empty-site-desktop-dark");
  await page.unrouteAll();
  await page.route("**/__core_test", (route) =>
    route.fulfill({
      json: {
        ok: false,
        meta,
        error: {
          code: "PERMISSION_DENIED",
          message: "No Jira read access",
          requestId: meta.requestId,
          retryable: false,
        },
      },
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("PERMISSION_DENIED");
  await shot(
    page,
    "14-permission-denied-desktop-light".replace("light", "dark"),
  );
});

test("visual writes unavailable, reduced motion and forced colors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await showcaseCore(page, { writes: "PERMISSION_REQUIRED" });
  await page.goto("/tests/core-harness.html?theme=light");
  await analyze(page);
  await compare(page);
  await nav(page, "Decision Firewall");
  await expect(
    page.getByText("Approval and execution will be unavailable"),
  ).toBeVisible();
  await shot(
    page,
    "15-decision-firewall-writes-unavailable-reduced-motion-desktop-light",
  );
  await page.emulateMedia({ forcedColors: "active" });
  await nav(page, "Scenario Lab");
  await shot(page, "16-scenario-lab-forced-colors-desktop");
});

for (const width of [320, 768, 1024, 1920, 3440])
  test(`visual breakpoints ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width >= 1920 ? 1080 : 900 });
    await showcaseCore(page);
    await page.goto("/tests/core-harness.html?theme=dark");
    await analyze(page);
    await noOverflow(page, `graph ${width}`);
    await shot(page, `20-evidence-graph-${width}-dark`, false);
    await compare(page);
    await noOverflow(page, `scenarios ${width}`);
    await shot(page, `21-scenario-lab-${width}-dark`, false);
  });

test("graph keyboard alternative selects evidence without a mouse", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await showcaseCore(page);
  await page.goto("/tests/core-harness.html?theme=dark");
  await analyze(page);
  const item = page.locator(".ax-evidence-item", {
    hasText: "Batch export job",
  });
  await item.focus();
  await page.keyboard.press("Enter");
  await expect(item).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { level: 2, name: "Batch export job" }),
  ).toBeVisible();
  const node = page.locator('.react-flow__node[data-id="svc:checkout"]');
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 2, name: "Checkout service" }),
  ).toBeVisible();
});

test("dialog keeps focus inside and restores it on cancel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await showcaseCore(page);
  await page.goto("/tests/core-harness.html?theme=dark");
  await analyze(page);
  await compare(page);
  await nav(page, "Decision Firewall");
  await page.getByRole("button", { name: "Generate prevention plan" }).click();
  await page
    .getByRole("checkbox", {
      name: `Approve ${showcasePlan.actions[0].actionId}`,
    })
    .check();
  const trigger = page.getByRole("button", {
    name: "Approve selected actions",
  });
  await trigger.click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Record approval" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
