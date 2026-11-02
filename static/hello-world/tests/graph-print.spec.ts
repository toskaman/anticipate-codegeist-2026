import { test, expect } from "@playwright/test";
test("graph supports nodes, edges, zoom, pan and fit view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#Evidence%20Graph");
  await expect(
    page.locator('.react-flow__node[data-id="mobile"]'),
  ).toBeVisible();
  await page.locator('.react-flow__node[data-id="mobile"]').click();
  await expect(
    page.getByRole("heading", { name: "Mobile Application", exact: true }),
  ).toBeVisible();
  const edge = page.locator(
    '.react-flow__edge[data-id="support"] path.react-flow__edge-path',
  );
  const point = await edge.evaluate((element) => {
    const path = element as SVGPathElement;
    const pt = path.getPointAtLength(path.getTotalLength() * 0.65);
    const pos = new DOMPoint(pt.x, pt.y).matrixTransform(path.getScreenCTM()!);
    return { x: pos.x, y: pos.y };
  });
  await page.mouse.click(point.x, point.y);
  await expect(
    page.getByRole("heading", {
      name: "Customer Support Integration",
      exact: true,
    }),
  ).toBeVisible();
  const view = page.locator(".react-flow__viewport");
  const initial = await view.getAttribute("style");
  await page.getByRole("button", { name: "Zoom In", exact: true }).click();
  await expect.poll(() => view.getAttribute("style")).not.toBe(initial);
  await page.waitForTimeout(300);
  const zoomed = await view.getAttribute("style");
  const pane = await page.locator(".react-flow__pane").boundingBox();
  if (!pane) throw new Error("Graph pane missing");
  await page.mouse.move(pane.x + 20, pane.y + 20);
  await page.mouse.down();
  await page.mouse.move(pane.x + 95, pane.y + 55, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => view.getAttribute("style")).not.toBe(zoomed);
  const panned = await view.getAttribute("style");
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await expect.poll(() => view.getAttribute("style")).not.toBe(panned);
  await expect(
    page.locator('.react-flow__node[data-id="checkout"]'),
  ).toBeVisible();
});
for (const theme of ["dark", "light"])
  test(`passport print palette ${theme}`, async ({ page }) => {
    await page.goto("/#Prevention%20Passport");
    await expect(
      page.getByRole("heading", { name: "AUTH-142", exact: true }),
    ).toBeVisible();
    if (theme === "light")
      await page.getByRole("button", { name: "Switch theme" }).click();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Export demo JSON" }),
    ).toBeHidden();
    expect(
      await page
        .locator(".app")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe("rgb(255, 255, 255)");
    await page.screenshot({
      path: `../../evidence/passport-print-${theme}.png`,
      fullPage: true,
    });
  });
