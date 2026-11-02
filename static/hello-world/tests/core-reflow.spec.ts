import { test, expect, type Page } from "@playwright/test";
import {
  capabilities,
  graph,
  comparison,
  plan,
  response,
} from "./core-test-data";
const longGraph = structuredClone(graph);
longGraph.nodes = Array.from({ length: 35 }, (_, i) => ({
  ...graph.nodes[0],
  id: i === 0 ? "issue:ABC-1" : `node-${i}`,
  label: `${String(i).padStart(3, "0")} ${"L".repeat(496)}`,
  kind: i === 0 ? "ISSUE" : "SERVICE",
}));
longGraph.edges = longGraph.nodes.slice(1).map((n, i) => ({
  ...graph.edges[0],
  id: `long-edge-${i + 1}`,
  from: n.id,
  to: "issue:ABC-1",
}));
const longPlan = structuredClone(plan);
longPlan.actions = [
  {
    ...plan.actions[0],
    actionId: "A".repeat(200),
    reason: "R".repeat(1000),
    verificationRule: "V".repeat(500),
    payload: { text: "P".repeat(29900) + "END_OF_PAYLOAD" },
    evidenceEdgeIds: [longGraph.edges[0].id],
  },
];
async function setup(page: Page) {
  const calls: string[] = [];
  await page.route("**/__core_test", async (route) => {
    const { operation, input } = route.request().postDataJSON();
    calls.push(operation);
    let data: unknown;
    switch (operation) {
      case "getCapabilities":
        data = capabilities;
        break;
      case "listProjects":
        data = {
          items: [
            {
              id: "100",
              key: "ABC",
              name: "Long text rendering test",
              url: null,
              issueCount: null,
              lastSnapshotAt: null,
              dataAvailability: "NO_SNAPSHOT",
            },
          ],
          page: { nextCursor: null, totalKnown: null },
        };
        break;
      case "getGraphSnapshot":
      case "getEvidenceGraph":
        data = longGraph;
        break;
      case "compareScenarios":
        data = {
          ...comparison,
          results: comparison.results
            .filter((r) =>
              input.scenarios.some(
                (s: { scenarioId: string }) => s.scenarioId === r.scenarioId,
              ),
            )
            .map((r) => ({
              ...r,
              impacts: r.impacts.map((i) => ({
                ...i,
                nodeId: longGraph.nodes[1].id,
                pathEdgeIds: [longGraph.edges[0].id],
              })),
              violations: r.violations.map((v) => ({
                ...v,
                nodeIds: [longGraph.nodes[1].id],
                pathEdgeIds: [longGraph.edges[0].id],
              })),
              uncertainties: r.uncertainties.map((u) => ({
                ...u,
                nodeId: longGraph.nodes[1].id,
                edgeId: longGraph.edges[0].id,
              })),
            })),
        };
        break;
      case "generatePreventionPlan":
        data = { ...longPlan, scenarioId: input.scenarioId };
        break;
      default:
        throw new Error(`Unexpected operation ${operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  await page.goto("/tests/core-harness.html");
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  await page
    .getByRole("textbox", { name: "Root Jira issue key", exact: true })
    .fill("ABC-1");
  await page
    .getByRole("button", { name: "Read evidence snapshot", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Snapshot evidence", exact: true }),
  ).toBeVisible();
  return calls;
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const width of [320, 1280])
  test(`CORE contract-length labels and payload reflow ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const calls = await setup(page);
    if (width === 1280)
      await page.evaluate(() => {
        document.documentElement.style.zoom = "2";
      });
    await noOverflow(page);
    await expect(
      page.getByRole("heading", {
        name: longGraph.nodes[0].label,
        exact: true,
      }),
    ).toBeVisible();
    const overlap = await page
      .locator(".react-flow__node")
      .evaluateAll((nodes) => {
        const rects = nodes.map((n) => n.getBoundingClientRect());
        return rects.some((a, i) =>
          rects
            .slice(i + 1)
            .some(
              (b) =>
                Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2,
            ),
        );
      });
    expect(
      overlap,
      JSON.stringify(
        await page.locator(".react-flow__node").evaluateAll((nodes) =>
          nodes.map((n) => {
            const r = n.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          }),
        ),
      ),
    ).toBe(false);
    await page.screenshot({
      path: `../../evidence/experience/core-reflow/graph-labels-MOCK-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Compare change scenarios", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Run CORE comparison", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Review CORE policy checks", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Generate selected scenario plan",
        exact: true,
      })
      .click();
    await page
      .getByText("Review exact action payload", { exact: true })
      .click();
    const payload = page.getByRole("region", {
      name: `Payload for ${longPlan.actions[0].actionId}`,
      exact: true,
    });
    await expect(payload).toContainText("END_OF_PAYLOAD");
    expect(await payload.evaluate((el) => el.clientHeight)).toBeLessThanOrEqual(
      400,
    );
    await payload.focus();
    await page.keyboard.press("End");
    await expect
      .poll(() => payload.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await noOverflow(page);
    await page.screenshot({
      path: `../../evidence/experience/core-reflow/action-payload-MOCK-${width}.png`,
    });
    expect(
      calls.some((op) => ["approvePlan", "executeApprovedPlan"].includes(op)),
    ).toBe(false);
  });
test("CORE graph preserves the selected node across responsive page sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.locator(".core-evidence-item").nth(18).click();
  const heading = page.getByRole("heading", {
    name: longGraph.nodes[18].label,
    exact: true,
  });
  await expect(heading).toBeVisible();
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect(heading).toBeVisible();
  await expect(
    page.locator(".core-evidence-item[aria-pressed=true]"),
  ).toHaveText(`${longGraph.nodes[18].label} · CONFIRMED`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".react-flow__node")).toHaveCount(20);
  await expect(heading).toBeVisible();
});
