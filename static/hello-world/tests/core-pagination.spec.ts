import { test, expect, type Page } from "@playwright/test";
import { capabilities, graph, meta, response } from "./core-test-data";
const project = (id: string, key: string) => ({
  id,
  key,
  name: `Project ${key}`,
  url: null,
  issueCount: null,
  lastSnapshotAt: null,
  dataAvailability: "NO_SNAPSHOT",
});
const change = (id: string, key: string) => ({
  id,
  key,
  summary: `Change ${key}`,
  status: "Open",
  issueType: "Task",
  url: null,
  updatedAt: meta.generatedAt,
  projectId: "100",
});
async function pagedCore(
  page: Page,
  options: {
    error?: "RATE_LIMITED" | "PERMISSION_DENIED";
    stuck?: boolean;
    empty?: boolean;
    unavailable?: boolean;
  } = {},
) {
  const calls: { operation: string; input: Record<string, unknown> }[] = [];
  let changeReads = 0;
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as (typeof calls)[number];
    calls.push(call);
    let data: unknown;
    switch (call.operation) {
      case "getCapabilities":
        data = options.unavailable
          ? { ...capabilities, jiraRead: "PERMISSION_REQUIRED", operations: [] }
          : capabilities;
        break;
      case "listProjects":
        data = {
          items: options.empty
            ? []
            : call.input.cursor
              ? [project("100", "ABC"), project("200", "OTHER")]
              : [project("100", "ABC")],
          page: {
            nextCursor: options.empty
              ? null
              : !call.input.cursor || options.stuck
                ? "projects-page-2"
                : null,
            totalKnown: null,
          },
        };
        break;
      case "getChangeCandidates":
        changeReads++;
        if (options.error && changeReads === 1) {
          await route.fulfill({
            json: {
              ok: false,
              meta,
              error: {
                code: options.error,
                message: "Jira read declined",
                requestId: meta.requestId,
                retryable: options.error === "RATE_LIMITED",
              },
            },
          });
          return;
        }
        data = {
          items:
            call.input.projectId === "200"
              ? []
              : call.input.cursor
                ? [change("1", "ABC-1"), change("4", "ABC-4")]
                : [change("1", "ABC-1")],
          page: {
            nextCursor:
              call.input.projectId === "200" || call.input.cursor
                ? null
                : "changes-page-2",
            totalKnown: null,
          },
        };
        break;
      case "getGraphSnapshot":
      case "getEvidenceGraph":
        data = graph;
        break;
      default:
        throw new Error(`Unexpected operation ${call.operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  return calls;
}
test("CORE cursor pagination deduplicates pages and project changes invalidate prior evidence", async ({
  page,
}) => {
  const calls = await pagedCore(page);
  await page.goto("/tests/core-harness.html");
  const projects = page.getByRole("combobox", {
    name: "Jira project",
    exact: true,
  });
  await page
    .getByRole("button", { name: "Load more projects", exact: true })
    .click();
  await expect(projects.locator("option")).toHaveCount(3);
  expect(
    calls
      .filter((c) => c.operation === "listProjects")
      .map((c) => c.input.cursor),
  ).toEqual([null, "projects-page-2"]);
  await projects.selectOption("100");
  await page
    .getByRole("button", { name: "Load change candidates", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load more changes", exact: true })
    .click();
  const candidates = page.getByRole("combobox", {
    name: "Change candidate",
    exact: true,
  });
  await expect(candidates.locator("option")).toHaveCount(3);
  expect(
    calls
      .filter((c) => c.operation === "getChangeCandidates")
      .map((c) => c.input),
  ).toEqual([
    { projectId: "100", cursor: null },
    { projectId: "100", cursor: "changes-page-2" },
  ]);
  await candidates.selectOption("ABC-1");
  await page
    .getByRole("button", { name: "Analyze dependencies", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dependency map", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mission Control", exact: true })
    .click();
  await projects.selectOption("200");
  await expect(
    page.getByRole("textbox", { name: "Jira issue key", exact: true }),
  ).toHaveValue("");
  await expect(candidates).toHaveCount(0);
  await page
    .getByRole("button", { name: "Load change candidates", exact: true })
    .click();
  await expect(
    page.getByText(
      "No issues labelled anticipate-change. Enter an accessible issue key below.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze dependencies", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Evidence Graph", exact: true })
    .click();
  await expect(
    page.getByText(
      "Choose a Jira change in Mission Control and read its snapshot first.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dependency map", exact: true }),
  ).toHaveCount(0);
});
for (const code of ["RATE_LIMITED", "PERMISSION_DENIED"] as const)
  test(`CORE read ${code} keeps correlation and never retries automatically`, async ({
    page,
  }) => {
    const calls = await pagedCore(page, { error: code });
    await page.goto("/tests/core-harness.html");
    await page
      .getByRole("combobox", { name: "Jira project", exact: true })
      .selectOption("100");
    await page
      .getByRole("button", { name: "Load change candidates", exact: true })
      .click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(code);
    await expect(alert).toContainText(meta.requestId);
    await expect(
      alert.getByRole("heading", { name: "Request failed", exact: true }),
    ).toBeVisible();
    if (code === "RATE_LIMITED")
      await expect(alert).toContainText("No automatic retry was made.");
    else
      await expect(alert).toContainText("Check your Jira project permissions");
    await page.waitForTimeout(500);
    expect(
      calls.filter((c) => c.operation === "getChangeCandidates"),
    ).toHaveLength(1);
    expect(
      calls.some((c) =>
        ["approvePlan", "executeApprovedPlan"].includes(c.operation),
      ),
    ).toBe(false);
    await page.screenshot({
      path: `../../evidence/experience/v3-redesign/transport/read-${code}-MOCK-1440.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Dismiss error", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Load change candidates", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Change candidate", exact: true }),
    ).toBeVisible();
    expect(
      calls.filter((c) => c.operation === "getChangeCandidates"),
    ).toHaveLength(2);
  });
test("CORE refuses a non-advancing project cursor without an automatic loop", async ({
  page,
}) => {
  const calls = await pagedCore(page, { stuck: true });
  await page.goto("/tests/core-harness.html");
  await page
    .getByRole("button", { name: "Load more projects", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Project cursor did not advance",
  );
  await expect(page.getByRole("alert")).toContainText(
    "service response could not be verified",
  );
  await expect(
    page
      .getByRole("combobox", { name: "Jira project", exact: true })
      .locator("option"),
  ).toHaveCount(2);
  await page.waitForTimeout(500);
  expect(calls.filter((c) => c.operation === "listProjects")).toHaveLength(2);
});
for (const unavailable of [false, true])
  test(`CORE empty or unavailable project listing has no invented project, unavailable=${unavailable}`, async ({
    page,
  }) => {
    const calls = await pagedCore(page, { empty: true, unavailable });
    await page.goto("/tests/core-harness.html");
    if (unavailable) {
      await expect(page.getByRole("alert")).toContainText(
        "PERMISSION_REQUIRED",
      );
      expect(calls.map((c) => c.operation)).toEqual(["getCapabilities"]);
    } else
      await expect(
        page.getByText(
          "No projects available. Check Jira project access; no demonstration project is inserted.",
        ),
      ).toBeVisible();
    await expect(
      page
        .getByRole("combobox", { name: "Jira project", exact: true })
        .locator("option"),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Analyze dependencies", exact: true }),
    ).toBeDisabled();
  });

test("CORE manual root issue must belong to the selected project", async ({
  page,
}) => {
  const calls = await pagedCore(page);
  await page.goto("/tests/core-harness.html");
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  await page
    .getByRole("textbox", { name: "Jira issue key", exact: true })
    .fill("OTHER-9");
  await page
    .getByRole("button", { name: "Analyze dependencies", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Choose an issue from the selected Jira project",
  );
  expect(calls.some((c) => c.operation === "getGraphSnapshot")).toBe(false);
});
