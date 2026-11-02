import { test, expect } from "@playwright/test";
test("large graph pagination is bounded and finds off-page dependencies", async ({
  page,
}) => {
  await page.goto("/#Component%20Showcase");
  await page.getByLabel("Graph resource preview").selectOption("large");
  await expect(
    page.getByText("Showing 20 of 120 matching dependencies. Page 1 of 6."),
  ).toBeVisible();
  expect(await page.locator(".react-flow__node").count()).toBeLessThanOrEqual(
    41,
  );
  expect(await page.locator(".react-flow__edge").count()).toBeLessThanOrEqual(
    80,
  );
  await page.getByRole("button", { name: "Next dependencies" }).click();
  await expect(
    page.getByText("Showing 20 of 120 matching dependencies. Page 2 of 6."),
  ).toBeVisible();
  await page.getByLabel("Search dependencies").fill("Fixture Service 119");
  await expect(
    page.getByRole("button", { name: "Fixture Service 119" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../evidence/experience/v2-graph/large-filtered-MOCK-1280.png",
    fullPage: true,
  });
});
test("freshness and impact filters preserve epistemic status and path provenance", async ({
  page,
}) => {
  await page.goto("/#Evidence%20Graph");
  await page.getByLabel("Evidence freshness").selectOption("STALE");
  await page.getByLabel("Impact scope").selectOption("TRANSITIVE");
  await expect(
    page.getByRole("button", { name: "Release Pipeline INFERRED" }),
  ).toBeVisible();
  await expect(
    page.getByText("TESTS · TRANSITIVE · STALE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("pipeline → gateway → auth", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Checkout Service CONFIRMED" }),
  ).toHaveCount(0);
  await page.locator('.react-flow__node[data-id="gateway"]').click();
  await expect(
    page.getByRole("heading", { name: "Authentication Gateway", exact: true }),
  ).toBeVisible();
});
