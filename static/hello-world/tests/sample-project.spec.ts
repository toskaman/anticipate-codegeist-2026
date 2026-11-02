import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { capabilities, graph, response } from "./core-test-data";

async function sampleCore(
  page: Page,
  mode: "success" | "denied" | "partial" | "timeout" | "empty" = "success",
) {
  const calls: { operation: string; input: Record<string, unknown> }[] = [];
  let created = false;
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as (typeof calls)[number];
    calls.push(call);
    const sample = {
      projectKey: "ABC",
      issueType: "Task",
      canCreate: mode !== "denied",
      missingPermissions:
        mode === "denied" ? ["CREATE_ISSUES", "LINK_ISSUES"] : [],
      items: ["api", "checkout", "mobile", "webhooks", "v2", "test"].map(
        (role, index) => ({
          role,
          summary: `${role} sample ticket`,
          issueKey: created ? `ABC-${index === 4 ? 3 : index + 1}` : null,
          status: created
            ? mode === "partial" && role === "test"
              ? "FAILED"
              : "CREATED"
            : "TO_CREATE",
        }),
      ),
      links: [
        {
          from: "api",
          to: "checkout",
          relation: "blocks",
          status: created
            ? mode === "partial"
              ? "FAILED"
              : "CREATED"
            : "TO_CREATE",
        },
      ],
      rootIssueKey: created ? "ABC-1" : null,
      replacementIssueKey: created ? "ABC-3" : null,
      note: "Up to six labelled sample tickets; existing sample entries are reused.",
    };
    let data: unknown;
    switch (call.operation) {
      case "getCapabilities":
        data = {
          ...capabilities,
          operations: [
            ...capabilities.operations,
            "previewSampleProject",
            "createSampleProject",
          ],
        };
        break;
      case "listProjects":
        data = {
          items:
            mode === "empty"
              ? []
              : [
                  {
                    id: "100",
                    key: "ABC",
                    name: "Sample test project",
                    url: null,
                    issueCount: 0,
                    lastSnapshotAt: null,
                    dataAvailability: "NO_SNAPSHOT",
                  },
                ],
          page: { nextCursor: null, totalKnown: mode === "empty" ? 0 : 1 },
        };
        break;
      case "previewSampleProject":
        data = sample;
        break;
      case "createSampleProject":
        expect(call.input).toEqual({ projectKey: "ABC", confirm: true });
        created = true;
        data = {
          ...sample,
          items: sample.items.map((item) => ({
            ...item,
            issueKey:
              item.role === "api"
                ? "ABC-1"
                : item.role === "v2"
                  ? "ABC-3"
                  : "ABC-2",
            status:
              mode === "partial" && item.role === "test" ? "FAILED" : "CREATED",
          })),
          links: sample.links.map((link) => ({
            ...link,
            status: mode === "partial" ? "FAILED" : "CREATED",
          })),
          rootIssueKey: "ABC-1",
          replacementIssueKey: "ABC-3",
        };
        if (mode === "timeout")
          await new Promise((resolve) => setTimeout(resolve, 700));
        break;
      case "getGraphSnapshot":
      case "getEvidenceGraph":
        data = graph;
        break;
      default:
        throw new Error(`Unexpected resolver ${call.operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  await page.goto("/tests/core-harness.html");
  if (mode !== "empty")
    await page
      .getByRole("combobox", { name: "Jira project", exact: true })
      .selectOption("100");
  await page
    .getByRole("button", { name: "Prepare a demo project", exact: true })
    .click();
  return calls;
}

test("sample preparation requires preview and confirmation, then analyzes real Jira snapshot with replacement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await sampleCore(page);
  expect(
    calls.filter((call) => call.operation === "createSampleProject"),
  ).toHaveLength(0);
  await page
    .getByRole("button", { name: "Preview sample data", exact: true })
    .click();
  await expect(
    page.getByText("api sample ticket · api · TO_CREATE"),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Create missing sample data in Jira",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("real Jira write");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    calls.filter((call) => call.operation === "createSampleProject"),
  ).toHaveLength(0);
  await page
    .getByRole("button", {
      name: "Create missing sample data in Jira",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Create sample data", exact: true })
    .click();
  await expect(
    page.getByText("api sample ticket · ABC-1 · CREATED"),
  ).toBeVisible();
  expect(
    calls.filter((call) => call.operation === "createSampleProject"),
  ).toHaveLength(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "../../evidence/experience/v3-redesign/visual/31-sample-result-MOCK-390.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Analyze ABC-1", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence Graph", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", {
      name: "Replacement for option C",
      exact: true,
    }),
  ).toHaveValue("issue:ABC-3");
  expect(
    calls.find((call) => call.operation === "getGraphSnapshot")?.input,
  ).toMatchObject({ projectId: "100", rootIssueKey: "ABC-1", source: "JIRA" });
});
for (const mode of ["denied", "partial", "timeout", "empty"] as const)
  test(`sample preparation handles ${mode} without hidden writes or automatic retries`, async ({
    page,
  }) => {
    const calls = await sampleCore(page, mode);
    if (mode === "empty") {
      await expect(
        page.getByText("Choose an accessible Jira project above first.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Preview sample data", exact: true }),
      ).toBeDisabled();
      expect(
        calls.filter((call) => call.operation === "createSampleProject"),
      ).toHaveLength(0);
      return;
    }
    await page
      .getByRole("button", { name: "Preview sample data", exact: true })
      .click();
    const create = page.getByRole("button", {
      name: "Create missing sample data in Jira",
      exact: true,
    });
    if (mode === "denied") {
      await expect(page.getByRole("alert")).toContainText(
        "CREATE_ISSUES, LINK_ISSUES",
      );
      await expect(create).toBeDisabled();
    } else {
      await create.click();
      await page
        .getByRole("button", { name: "Create sample data", exact: true })
        .click();
      if (mode === "partial")
        await expect(page.getByRole("alert")).toContainText(
          "Some sample items or relations failed",
        );
      else await expect(page.getByRole("alert")).toContainText("TIMEOUT");
      await expect(create).toBeDisabled();
      expect(
        calls.filter((call) => call.operation === "createSampleProject"),
      ).toHaveLength(1);
      expect(
        calls.filter((call) =>
          ["approvePlan", "executeApprovedPlan"].includes(call.operation),
        ),
      ).toHaveLength(0);
    }
  });
