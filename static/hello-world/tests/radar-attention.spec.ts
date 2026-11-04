import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { PlanAttention } from "@anticipate/contracts";
import {
  capabilities,
  graph,
  comparison,
  plan,
  passport,
  response,
  meta,
} from "./core-test-data";
import { radarAttention } from "./radar-test-data";

// LOCAL / MOCK_TRANSPORT: reject unexpected calls, including every mutation.
async function workspace(
  page: Page,
  opts: {
    supported?: boolean;
    theme?: string;
    attention?: PlanAttention;
    fresh?: boolean;
    failRead?: boolean;
    failCheck?: boolean;
  } = {},
) {
  const calls: string[] = [];
  let reads = 0;
  let checked = false;
  await page.route("**/__core_test", async (route) => {
    const { operation, input } = route.request().postDataJSON();
    calls.push(operation);
    if (operation === "getPlanAttention") {
      expect(input.planId).toBe(plan.planId);
      reads++;
      if (opts.failRead && reads === 1)
        return route.fulfill({
          json: {
            ok: false,
            meta,
            error: {
              code: "RATE_LIMITED",
              message: "Radar unavailable for this read",
              requestId: meta.requestId,
              retryable: true,
            },
          },
        });
      return route.fulfill({
        json: response(
          checked && opts.fresh !== false
            ? {
                ...(opts.attention ?? radarAttention),
                needsReview: false,
                items: [],
                clearedAt: meta.generatedAt,
              }
            : (opts.attention ?? radarAttention),
        ),
      });
    }
    if (operation === "checkPlanFreshness") {
      expect(input.planId).toBe(plan.planId);
      if (opts.failCheck)
        return route.fulfill({
          json: {
            ok: false,
            meta,
            error: {
              code: "UPSTREAM_UNAVAILABLE",
              message: "Freshness could not be checked",
              requestId: meta.requestId,
              retryable: true,
            },
          },
        });
      checked = true;
      return route.fulfill({
        json: response({
          planId: plan.planId,
          snapshotId: graph.snapshotId,
          checkedAt: meta.generatedAt,
          fresh: opts.fresh !== false,
          addedEdges: [],
          removedEdges: [],
          becameUnknown: opts.fresh === false ? ["issue:ABC-2"] : [],
          ignoredPlanArtifacts: [],
          reason:
            opts.fresh === false
              ? "A consumer is no longer readable."
              : "No structural difference in the observed scope.",
        }),
      });
    }
    const data =
      operation === "getCapabilities"
        ? {
            ...capabilities,
            operations: [
              ...capabilities.operations,
              "checkPlanFreshness",
              ...(opts.supported === false ? [] : ["getPlanAttention"]),
            ],
          }
        : operation === "listProjects"
          ? {
              items: [
                {
                  id: "100",
                  key: "ABC",
                  name: "Radar test project",
                  url: null,
                  issueCount: 3,
                  lastSnapshotAt: null,
                  dataAvailability: "NO_SNAPSHOT",
                },
              ],
              page: { nextCursor: null, totalKnown: 1 },
            }
          : ["getGraphSnapshot", "getEvidenceGraph"].includes(operation)
            ? graph
            : operation === "compareScenarios"
              ? comparison
              : operation === "generatePreventionPlan"
                ? plan
                : operation === "getPreventionPassport"
                  ? passport(plan, [])
                  : null;
    if (data === null)
      throw new Error(`Unexpected radar test operation ${operation}`);
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${opts.theme ?? "dark"}`);
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
  await page
    .getByRole("combobox", { name: "Replacement for option C", exact: true })
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
  await expect(
    page.getByRole("heading", { name: "Prevention Plan", exact: true }),
  ).toBeVisible();
  return calls;
}
const radar = (page: Page) =>
  page.getByRole("region", { name: "Decision Radar attention", exact: true });
for (const theme of ["dark", "light"]) {
  test(`hints, keyboard re-check, coverage and Passport separation (${theme})`, async ({
    page,
  }) => {
    const calls = await workspace(page, { theme });
    const p = radar(page);
    await expect(p.getByText("Needs review", { exact: true })).toBeVisible();
    await expect(p).toContainText("Listening");
    await expect(p).toContainText("Link created");
    await expect(p).toContainText("Issue deleted");
    await expect(p).toContainText("Blocks");
    await expect(p).toContainText(radarAttention.note);
    await page.setViewportSize({ width: 390, height: 1000 });
    await p.screenshot({
      path: `test-results/radar-${theme}-390-MOCK_TRANSPORT.png`,
      style: "#root > p[role='status'] { position: static !important; }",
    });
    await p
      .getByRole("button", { name: "Re-check evidence", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(p.getByText("Needs review", { exact: true })).toHaveCount(0);
    await expect(p).toContainText("No radar alerts since");
    await expect(
      p.getByRole("button", { name: "Refresh radar", exact: true }),
    ).toBeFocused();
    const observed = calls.filter((op) =>
      ["getPlanAttention", "checkPlanFreshness"].includes(op),
    );
    expect(observed).toEqual([
      "getPlanAttention",
      "checkPlanFreshness",
      "getPlanAttention",
    ]);
    expect(calls.some((op) => /approve|execute/i.test(op))).toBe(false);
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
          .include(".ax-radar")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 1000 });
    await p.screenshot({
      path: `test-results/radar-${theme}-rechecked-390-MOCK_TRANSPORT.png`,
      style: "#root > p[role='status'] { position: static !important; }",
    });
    await page
      .getByRole("button", { name: "Open Prevention Passport", exact: true })
      .click();
    await expect(radar(page)).toContainText(
      "separate from this recorded Passport",
    );
    await page.emulateMedia({ media: "print" });
    await expect(radar(page)).toBeHidden();
    await expect(page.locator(".ax-report")).toBeVisible();
  });
}
test("changed evidence from radar re-check preserves workflow approval/execution guards", async ({
  page,
}) => {
  const calls = await workspace(page, { fresh: false });
  const p = radar(page);
  await page
    .getByRole("checkbox", { name: "Approve record:ABC-1", exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: "Approve selected actions", exact: true }),
  ).toBeEnabled();
  await p
    .getByRole("button", { name: "Re-check evidence", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Evidence changed — this plan cannot execute",
    }),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Re-check evidence", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Approve selected actions", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Execute approved actions", exact: true }),
  ).toBeDisabled();
  expect(calls.filter((op) => op === "getPlanAttention")).toHaveLength(2);
  expect(calls.some((op) => /approve|execute/i.test(op))).toBe(false);
});
test("degraded monitoring lists reasons and truncated hints without a green state", async ({
  page,
}) => {
  await workspace(page, {
    attention: {
      ...radarAttention,
      monitoring: {
        state: "DEGRADED",
        reasons: [
          "PARTIAL_INDEX",
          "INDEX_WRITE_FAILED",
          "FANOUT_CAPPED",
          "INVALID_EVENT",
          "STORAGE_ERROR",
        ],
        lastObservedAt: null,
      },
      coverage: { indexed: 2, unindexed: 1 },
      items: [{ ...radarAttention.items[0], type: "LINK_DELETED" }],
      truncated: true,
    },
  });
  const p = radar(page);
  await expect(p).toContainText("Monitoring degraded");
  await expect(p).toContainText("outside radar coverage");
  await expect(p).toContainText("More events exist");
  await expect(p).toContainText("No radar observation time supplied");
  await expect(p.locator(".ax-badge--success")).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include(".ax-radar").analyze()).violations,
  ).toEqual([]);
});
test("not configured and empty is explicit, note preserved verbatim", async ({
  page,
}) => {
  await workspace(page, {
    attention: {
      ...radarAttention,
      monitoring: {
        state: "NOT_CONFIGURED",
        reasons: ["NO_QUERY", "NOT_INDEXED"],
        lastObservedAt: null,
      },
      coverage: null,
      needsReview: false,
      items: [],
    },
  });
  const p = radar(page);
  await expect(p).toContainText("Radar not available for this plan");
  await expect(p).toContainText("no indexed issue coverage");
  await expect(p).toContainText(radarAttention.note);
  await expect(
    p.getByRole("button", { name: "Re-check evidence", exact: true }),
  ).toHaveCount(0);
  await expect(p.locator(".ax-badge--success")).toHaveCount(0);
});
test("unsupported radar is absent and makes no attention request", async ({
  page,
}) => {
  const calls = await workspace(page, { supported: false });
  await expect(radar(page)).toHaveCount(0);
  expect(calls).not.toContain("getPlanAttention");
});
test("read error stays unavailable until explicit retry", async ({ page }) => {
  const calls = await workspace(page, { failRead: true });
  const p = radar(page);
  await expect(p.getByRole("alert")).toContainText("RATE_LIMITED");
  await expect(p.getByText("Listening", { exact: true })).toHaveCount(0);
  expect(calls.filter((op) => op === "getPlanAttention")).toHaveLength(1);
  await p
    .getByRole("button", { name: "Retry radar read", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(p).toContainText("Listening");
  await expect(
    p.getByRole("button", { name: "Refresh radar", exact: true }),
  ).toBeFocused();
  expect(calls.filter((op) => op === "getPlanAttention")).toHaveLength(2);
});
test("a failed freshness check never clears attention or invents a successful verdict", async ({
  page,
}) => {
  const calls = await workspace(page, { failCheck: true });
  const p = radar(page);
  await p
    .getByRole("button", { name: "Re-check evidence", exact: true })
    .click();
  await expect(
    page.getByText(/Freshness could not be checked/).first(),
  ).toBeVisible();
  await expect(p.getByText("Needs review", { exact: true })).toBeVisible();
  expect(calls.filter((op) => op === "getPlanAttention")).toHaveLength(2);
  expect(calls.some((op) => /approve|execute/i.test(op))).toBe(false);
});
