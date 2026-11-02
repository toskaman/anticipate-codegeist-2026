import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import type { ExecutionRecord } from "@anticipate/contracts";
import {
  response,
  meta,
  capabilities,
  graph,
  comparison,
  plan,
  passport,
} from "./core-test-data";

async function mockedCore(
  page: Page,
  lostExecution = false,
  outcome: "VERIFIED" | "FAILED" = "VERIFIED",
  safety?: {
    refusalAt?: "approvePlan" | "executeApprovedPlan";
    changedCheck?: boolean;
  },
) {
  const calls: { operation: string; input: Record<string, unknown> }[] = [];
  let current = structuredClone(plan);
  let records: ExecutionRecord[] = [];
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as (typeof calls)[number];
    calls.push(call);
    if (safety?.refusalAt === call.operation) {
      current = { ...current, status: "EVIDENCE_CHANGED" };
      await route.fulfill({
        json: {
          ok: false,
          meta,
          error: {
            code: "EVIDENCE_CHANGED",
            message:
              "Evidence changed: one new dependency and lost readability.",
            requestId: meta.requestId,
            retryable: false,
            details: {
              addedEdges: [
                {
                  from: "issue:ABC-2",
                  to: "issue:ABC-1",
                  kind: "DEPENDS_ON",
                  status: "CONFIRMED",
                },
              ],
              removedEdges: [
                {
                  from: "issue:ABC-1",
                  to: "issue:ABC-3",
                  kind: "USES",
                  status: "INFERRED",
                },
              ],
              becameUnknown: ["issue:ABC-3"],
            },
          },
        },
      });
      return;
    }
    let data: unknown;
    switch (call.operation) {
      case "getCapabilities":
        data = safety
          ? {
              ...capabilities,
              operations: [...capabilities.operations, "checkPlanFreshness"],
            }
          : capabilities;
        break;
      case "checkPlanFreshness":
        data = {
          planId: plan.planId,
          snapshotId: plan.snapshotId,
          checkedAt: meta.generatedAt,
          fresh: !safety?.changedCheck,
          addedEdges: [],
          removedEdges: [],
          becameUnknown: safety?.changedCheck ? ["issue:ABC-3"] : [],
          ignoredPlanArtifacts: [],
          reason: safety?.changedCheck
            ? "Evidence is no longer readable."
            : "No causal evidence changes found.",
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
      case "getChangeCandidates":
        data = {
          items: [
            {
              id: "1",
              key: "ABC-1",
              summary: "Retire API",
              status: "Open",
              issueType: "Task",
              url: null,
              updatedAt: meta.generatedAt,
              projectId: "100",
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
        data = {
          ...comparison,
          results: comparison.results.filter((r) =>
            (call.input.scenarios as { scenarioId: string }[]).some(
              (s) => s.scenarioId === r.scenarioId,
            ),
          ),
        };
        break;
      case "generatePreventionPlan":
        current = {
          ...structuredClone(plan),
          scenarioId: String(call.input.scenarioId),
        };
        data = current;
        break;
      case "approvePlan":
        current = { ...current, status: "APPROVED" };
        data = current;
        break;
      case "executeApprovedPlan":
        records = [
          {
            executionId: "test-execution",
            planId: current.planId,
            actionId: current.actions[0].actionId,
            status: outcome,
            attempt: 1,
            idempotencyKey: String(call.input.idempotencyKey),
            resultRef: {
              issueKey: "ABC-1",
              url: "https://example.invalid/browse/ABC-1",
            },
            error:
              outcome === "FAILED"
                ? {
                    code: "PERMISSION_DENIED",
                    message: "ADD_COMMENTS denied",
                    requestId: meta.requestId,
                    retryable: false,
                  }
                : null,
            updatedAt: meta.generatedAt,
          },
        ];
        current = {
          ...current,
          status: outcome === "FAILED" ? "FAILED" : "COMPLETED",
        };
        data = records;
        if (lostExecution)
          await new Promise((resolve) => setTimeout(resolve, 600));
        break;
      case "getExecutionStatus":
        data = records;
        break;
      case "getPreventionPassport":
        data = passport(current, records);
        break;
      default:
        throw new Error(`Unexpected test resolver ${call.operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  return calls;
}
/** Plan status is shown as a human label; exact hash and status stay in technical details. */
async function expectPlan(page: Page, status: string, label: string) {
  await expect(
    page.getByRole("region", { name: "Plan summary" }),
  ).toContainText(label);
  const details = page.getByText("Plan technical details", { exact: true });
  await details.click();
  await expect(page.getByText("test-plan-hash", { exact: true })).toBeVisible();
  await expect(page.getByText(status, { exact: true })).toBeVisible();
  await details.click();
}
async function reachPlan(page: Page, theme: "light" | "dark" = "light") {
  await page.goto(`/tests/core-harness.html?theme=${theme}`);
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  await page
    .getByRole("button", { name: "Load change candidates", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Change candidate", exact: true })
    .selectOption("ABC-1");
  await page
    .getByRole("button", { name: "Analyze dependencies", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence Graph", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Compare options" }).click();
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
  await page.getByRole("button", { name: "Check safeguards" }).click();
  await expect(page.getByText("Consumer access is limited.")).toBeVisible();
  await page.getByRole("button", { name: "Generate prevention plan" }).click();
  await expectPlan(page, "PENDING_APPROVAL", "Awaiting approval");
}
for (const refusalAt of ["approvePlan", "executeApprovedPlan"] as const) {
  test(`CORE evidence change refusal at ${refusalAt} remains blocked after dismiss, refresh and reload`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: refusalAt === "approvePlan" ? 320 : 1440,
      height: 900,
    });
    const calls = await mockedCore(page, false, "VERIFIED", { refusalAt });
    await reachPlan(page);
    await page
      .getByRole("checkbox", { name: "Approve record:ABC-1", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Approve selected actions", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Record approval", exact: true })
      .click();
    if (refusalAt === "executeApprovedPlan") {
      await expect(
        page.getByText(
          "Backend approval recorded. No execution was requested.",
        ),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "Execute approved actions",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Execute in Jira", exact: true })
        .click();
    }
    await expect(
      page.getByRole("heading", {
        name: "Evidence changed — this plan cannot execute",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("issue:ABC-2 DEPENDS_ON issue:ABC-1 [CONFIRMED]").first(),
    ).toBeVisible();
    await expect(
      page.getByText("issue:ABC-1 USES issue:ABC-3 [INFERRED]").first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(
          "Evidence changed: one new dependency and lost readability.",
          { exact: false },
        )
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Dismiss error", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Check execution status",
        exact: true,
      })
      .click();
    await expectPlan(page, "EVIDENCE_CHANGED", "Evidence changed · re-review");
    await expect(
      page.getByRole("button", {
        name: "Approve selected actions",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Execute approved actions",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByText("A mutation was requested.", { exact: false }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({
      path: `../../evidence/experience/v3-redesign/visual/30-${refusalAt}-MOCK.png`,
      fullPage: true,
    });
    await page.reload();
    await page
      .getByRole("button", { name: "Mission Control", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Recover plan and execution status",
        exact: true,
      })
      .click();
    await expectPlan(page, "EVIDENCE_CHANGED", "Evidence changed · re-review");
    await expect(
      page.getByRole("button", {
        name: "Approve selected actions",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Execute approved actions",
        exact: true,
      }),
    ).toBeDisabled();
    expect(calls.filter((c) => c.operation === refusalAt)).toHaveLength(1);
    await page
      .getByRole("button", {
        name: "Open Prevention Passport",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Evidence changed · re-review", { exact: true }).first(),
    ).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export Passport JSON", exact: true })
      .click();
    const downloadPath = await (await downloaded).path();
    expect(JSON.parse(await readFile(downloadPath!, "utf-8")).plan.status).toBe(
      "EVIDENCE_CHANGED",
    );
    await page
      .getByRole("button", { name: "Prevention Plan", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Rebuild snapshot", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Analyze a change", exact: true }),
    ).toBeVisible();
  });
}
test("CORE read-only freshness check explains changed evidence without approval or execution", async ({
  page,
}) => {
  const calls = await mockedCore(page, false, "VERIFIED", {
    changedCheck: true,
  });
  await reachPlan(page);
  await page
    .getByRole("button", { name: "Check evidence freshness", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Evidence changed — this plan cannot execute",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Evidence is no longer readable.", { exact: true }),
  ).toBeVisible();
  expect(
    calls.filter((c) =>
      ["approvePlan", "executeApprovedPlan"].includes(c.operation),
    ),
  ).toHaveLength(0);
});
for (const lost of [false, true])
  test(`CORE transport journey and lost-response recovery=${lost}`, async ({
    page,
  }) => {
    const calls = await mockedCore(page, lost);
    await reachPlan(page);
    expect(
      calls.filter((c) =>
        ["approvePlan", "executeApprovedPlan"].includes(c.operation),
      ),
    ).toHaveLength(0);
    await expect(
      page.getByRole("button", {
        name: "Execute approved actions",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", { name: "Approve record:ABC-1", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Approve selected actions", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Record approval", exact: true })
      .click();
    await expect(
      page.getByText("Backend approval recorded. No execution was requested."),
    ).toBeVisible();
    expect(
      calls.filter((c) => c.operation === "executeApprovedPlan"),
    ).toHaveLength(0);
    const approval = calls.find((c) => c.operation === "approvePlan")!.input;
    expect(approval).toMatchObject({
      planId: "test-plan",
      planHash: "test-plan-hash",
      approvedActionIds: ["record:ABC-1"],
    });
    expect(String(approval.idempotencyKey).length).toBeGreaterThanOrEqual(16);
    await page
      .getByRole("button", {
        name: "Execute approved actions",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Execute in Jira", exact: true })
      .click();
    if (lost) {
      await expect(page.getByRole("alert")).toContainText("TIMEOUT");
      await expect(page.getByRole("alert")).toContainText(
        "No automatic resubmission was made.",
      );
      await page
        .getByRole("button", { name: "Dismiss error", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Execute approved actions",
          exact: true,
        }),
      ).toBeDisabled();
      await page
        .getByRole("button", {
          name: "Check execution status",
          exact: true,
        })
        .click();
      expect(
        calls.find((c) => c.operation === "getExecutionStatus")?.input,
      ).toEqual({ planId: "test-plan" });
    }
    await expect(
      page.getByText("record:ABC-1: VERIFIED · attempt 1", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Execute approved actions",
        exact: true,
      }),
    ).toBeDisabled();
    expect(
      calls.filter((c) => c.operation === "executeApprovedPlan"),
    ).toHaveLength(1);
    await page
      .getByRole("button", { name: "Open Prevention Passport" })
      .click();
    await expect(
      page.getByText(
        "Mode LIVE · snapshot test-snapshot · plan test-plan · scenario C-migrate-then-retire",
      ),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Passport JSON" }).click();
    const exported = await download;
    expect(exported.suggestedFilename()).toBe("ANTICIPATE-test-passport.json");
    const exportedData = JSON.parse(
      await readFile((await exported.path())!, "utf8"),
    );
    expect(exportedData.mode).toBe("LIVE");
    expect(exportedData.plan).toMatchObject({
      planId: "test-plan",
      snapshotId: "test-snapshot",
      scenarioId: "C-migrate-then-retire",
      planHash: "test-plan-hash",
      status: "COMPLETED",
    });
    expect(exportedData.executions[0].status).toBe("VERIFIED");
    expect(exportedData.approvals[0].actionIds).toEqual(["record:ABC-1"]);
    await page.screenshot({
      path: `../../evidence/experience/v3-redesign/transport/passport-transport-${lost ? "recovered" : "normal"}-1440.png`,
      fullPage: true,
    });
    await page.reload();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Mission Control", exact: true })
      .click();
    await expect(page.getByLabel("Recovery plan ID")).toHaveValue("test-plan");
    await page
      .getByRole("button", { name: "Recover plan and execution status" })
      .click();
    await expectPlan(page, "COMPLETED", "Completed");
    expect(
      calls.filter((c) => c.operation === "executeApprovedPlan"),
    ).toHaveLength(1);
  });

test("CORE permission failure is explicit and never becomes fixture data", async ({
  page,
}) => {
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
  await page.goto("/tests/core-harness.html");
  await expect(page.getByRole("alert")).toContainText("PERMISSION_DENIED");
  await expect(page.getByRole("alert")).toContainText(meta.requestId);
  await expect(page.getByText("AUTH-142", { exact: true })).toHaveCount(0);
});

for (const width of [1440, 1024, 390])
  for (const theme of ["light", "dark"] as const)
    test(`CORE connected screens accessibility ${theme} ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await mockedCore(page);
      await reachPlan(page, theme);
      await page
        .getByRole("button", { name: "Open Prevention Passport" })
        .click();
      for (const name of [
        "Mission Control",
        "Evidence Graph",
        "Scenario Lab",
        "Decision Firewall",
        "Prevention Plan",
        "Prevention Passport",
        "Settings",
      ]) {
        await page
          .getByRole("navigation")
          .getByRole("button", { name, exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name, exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          name,
        ).toBe(true);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              checks: n.any.map((check) => check.data),
            })),
          })),
          name,
        ).toEqual([]);
        await page.locator("#main").focus();
        await page.screenshot({
          path: `../../evidence/experience/v3-redesign/transport/${name.toLowerCase().replace(/ /g, "-")}-transport-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    });

async function approveCurrent(page: Page) {
  await page
    .getByRole("checkbox", { name: "Approve record:ABC-1", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Approve selected actions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record approval", exact: true })
    .click();
  await expect(
    page.getByText("Backend approval recorded. No execution was requested."),
  ).toBeVisible();
}
test("CORE stale approval never unlocks execution", async ({ page }) => {
  await mockedCore(page);
  await reachPlan(page);
  await page.route("**/__core_test", async (route) => {
    if (route.request().postDataJSON().operation !== "approvePlan")
      return route.fallback();
    await route.fulfill({
      json: {
        ok: false,
        meta,
        error: {
          code: "STALE_APPROVAL",
          message: "Review the changed plan",
          requestId: meta.requestId,
          retryable: false,
        },
      },
    });
  });
  await page
    .getByRole("checkbox", { name: "Approve record:ABC-1", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Approve selected actions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record approval", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("STALE_APPROVAL");
  await expect(
    page.getByRole("button", {
      name: "Execute approved actions",
      exact: true,
    }),
  ).toBeDisabled();
});
test("CORE changing scenario invalidates the prior reviewed plan", async ({
  page,
}) => {
  await mockedCore(page);
  await reachPlan(page);
  await approveCurrent(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Scenario Lab", exact: true })
    .click();
  await page.getByRole("radio", { name: /Remove now/ }).check();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Prevention Plan", exact: true })
    .click();
  await expect(
    page.getByText(
      "Generate a plan from the selected scenario in Decision Firewall.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Execute approved actions",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("CORE failed execution remains failed and is not retried", async ({
  page,
}) => {
  const calls = await mockedCore(page, false, "FAILED");
  await reachPlan(page);
  await approveCurrent(page);
  await page
    .getByRole("button", {
      name: "Execute approved actions",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Execute in Jira", exact: true })
    .click();
  await expect(
    page.getByText("record:ABC-1: FAILED · attempt 1", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("record:ABC-1: VERIFIED", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Execute approved actions",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    calls.filter((c) => c.operation === "executeApprovedPlan"),
  ).toHaveLength(1);
});
test("CORE uncertain execution survives reload even with no status records", async ({
  page,
}) => {
  await mockedCore(page);
  await reachPlan(page);
  await approveCurrent(page);
  let writes = 0;
  await page.route("**/__core_test", async (route) => {
    if (route.request().postDataJSON().operation !== "executeApprovedPlan")
      return route.fallback();
    writes++;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ json: response([]) });
  });
  await page
    .getByRole("button", {
      name: "Execute approved actions",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Execute in Jira", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("TIMEOUT");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mission Control", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recover plan and execution status" })
    .click();
  await expectPlan(page, "APPROVED", "Approved · not executed");
  await expect(
    page.getByRole("button", {
      name: "Execute approved actions",
      exact: true,
    }),
  ).toBeDisabled();
  expect(writes).toBe(1);
});
test("CORE expired snapshot still permits audit and status recovery", async ({
  page,
}) => {
  await mockedCore(page);
  await reachPlan(page);
  await page.reload();
  await page.route("**/__core_test", async (route) => {
    if (route.request().postDataJSON().operation !== "getEvidenceGraph")
      return route.fallback();
    await route.fulfill({
      json: {
        ok: false,
        meta,
        error: {
          code: "SNAPSHOT_EXPIRED",
          message: "Snapshot expired",
          requestId: meta.requestId,
          retryable: false,
        },
      },
    });
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mission Control", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recover plan and execution status" })
    .click();
  await expect(
    page.getByText(
      "Plan audit and status recovered. Snapshot expired; new approvals and execution are disabled.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Approve record:ABC-1", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Open Prevention Passport" }).click();
  await expect(
    page.getByText(
      "Mode LIVE · snapshot test-snapshot · plan test-plan · scenario C-migrate-then-retire",
    ),
  ).toBeVisible();
});
