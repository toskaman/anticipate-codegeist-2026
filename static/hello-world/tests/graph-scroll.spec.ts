import { expect, test } from "@playwright/test";
import { capabilities, graph, response } from "./core-test-data";

// Authored MOCK_TRANSPORT only: read operations, no Jira writes.
test("the wheel scrolls the page over the evidence map instead of zooming it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON();
    const data =
      call.operation === "getCapabilities"
        ? capabilities
        : call.operation === "listProjects"
          ? {
              items: [
                {
                  id: "100",
                  key: "ABC",
                  name: "Scroll test project",
                  url: null,
                  issueCount: 3,
                  lastSnapshotAt: null,
                  dataAvailability: "NO_SNAPSHOT",
                },
              ],
              page: { nextCursor: null, totalKnown: 1 },
            }
          : ["getGraphSnapshot", "getEvidenceGraph"].includes(call.operation)
            ? graph
            : null;
    if (data === null)
      throw new Error(`Unexpected operation: ${call.operation}`);
    await route.fulfill({ json: response(data) });
  });
  await page.goto("/tests/core-harness.html?theme=dark");
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  await page.getByLabel("Jira issue key").fill("ABC-1");
  await page
    .getByRole("button", { name: "Analyze dependencies", exact: true })
    .click();
  const viewport = page.locator(".react-flow__viewport").first();
  await expect(viewport).toBeVisible();
  await viewport.scrollIntoViewIfNeeded();
  const before = await viewport.getAttribute("style");
  const box = await page.locator(".react-flow").first().boundingBox();
  expect(box).not.toBeNull();
  const scrollBefore = await page.evaluate(() => {
    let el: Element | null = document.querySelector(".react-flow");
    let total = document.scrollingElement!.scrollTop;
    while (el) {
      total += el.scrollTop;
      el = el.parentElement;
    }
    return total;
  });
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  expect(await viewport.getAttribute("style")).toBe(before);
  const scrollAfter = await page.evaluate(() => {
    let el: Element | null = document.querySelector(".react-flow");
    let total = document.scrollingElement!.scrollTop;
    while (el) {
      total += el.scrollTop;
      el = el.parentElement;
    }
    return total;
  });
  expect(scrollAfter).toBeGreaterThan(scrollBefore);
});
