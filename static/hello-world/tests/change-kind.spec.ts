import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  capabilities,
  comparison,
  graph,
  meta,
  response,
} from "./core-test-data";

// MOCK_TRANSPORT only: checks which scenarios the UI requests; no Jira call.
async function scenarioLab(page: Page, upgrade: boolean) {
  const compareCalls: { scenarioId: string; operations: unknown[] }[][] = [];
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as {
      operation: string;
      input: Record<string, unknown>;
    };
    let data: unknown;
    switch (call.operation) {
      case "getCapabilities":
        data = {
          ...capabilities,
          operations: upgrade
            ? [...capabilities.operations, "scenario:UPGRADE_NODE"]
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
      case "compareScenarios": {
        const requested = call.input.scenarios as {
          scenarioId: string;
          operations: unknown[];
        }[];
        compareCalls.push(requested);
        data = {
          ...comparison,
          recommendedScenarioId: null,
          recommendationReason: "Test comparison.",
          results: requested.map((s, i) => ({
            ...comparison.results[Math.min(i, 2)],
            scenarioId: s.scenarioId,
            resultHash: `test-hash-${s.scenarioId}`,
          })),
        };
        break;
      }
      default:
        throw new Error(`Unexpected resolver ${call.operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  await page.goto("/tests/core-harness.html");
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
  return compareCalls;
}

test("dependency upgrade is offered only when the backend advertises it", async ({
  page,
}) => {
  const calls = await scenarioLab(page, false);
  const kind = page.getByRole("group", {
    name: "What kind of change are you planning?",
  });
  await expect(
    kind.getByRole("radio", { name: /Retire or decommission/ }),
  ).toBeChecked();
  await expect(
    kind.getByRole("radio", { name: /Upgrade a dependency/ }),
  ).toBeDisabled();
  await expect(kind).toContainText("Not offered by this backend yet");
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  await expect(page.getByRole("radio", { name: /Remove now/ })).toBeVisible();
  expect(calls[0].map((s) => s.scenarioId)).toEqual([
    "A-remove-now",
    "B-retain-temporarily",
  ]);
  // Uncertainties name the record instead of only counting them.
  await expect(
    page.getByRole("radiogroup", { name: "Decision options" }),
  ).toContainText("ABC-2 Consumer");
});

test("upgrade journey requests CORE's upgrade scenarios and labels them plainly", async ({
  page,
}) => {
  const calls = await scenarioLab(page, true);
  await page.getByRole("radio", { name: /Upgrade a dependency/ }).check();
  await expect(
    page.getByRole("combobox", {
      name: "New version for option C",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "New version for option C", exact: true })
    .selectOption("issue:ABC-3");
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: /Breaking upgrade now/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Compatible upgrade/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Move consumers first/ }),
  ).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0].map((s) => s.scenarioId)).toEqual([
    "A-breaking-upgrade-now",
    "B-compatible-upgrade",
    "C-migrate-then-upgrade",
  ]);
  expect(calls[0][0].operations).toEqual([
    { op: "UPGRADE_NODE", nodeId: "issue:ABC-1", breaking: true },
  ]);
  // Switching kind discards the previous comparison instead of relabelling it.
  await page.getByRole("radio", { name: /Retire or decommission/ }).check();
  await expect(
    page.getByRole("radio", { name: /Breaking upgrade now/ }),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
  expect(meta.mode).toBe("LIVE");
});
