import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
for (const size of [100, 500, 1000])
  test(`measured graph workload ${size}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const dependencies = size - 1;
    const initialStart = performance.now();
    await page.goto("/#Component%20Showcase");
    await expect(page.getByLabel("Search dependencies")).toBeVisible();
    const initialFixtureLoadMs = performance.now() - initialStart;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage");
    const before = {
      heap: await cdp.send("Runtime.getHeapUsage"),
      dom: await cdp.send("Memory.getDOMCounters"),
    };
    const renderSamples: number[] = [];
    for (let iteration = 0; iteration < 5; iteration++) {
      await page.getByLabel("Graph resource preview").selectOption("ready");
      await expect(
        page.getByText("Showing 5 of 5 matching dependencies. Page 1 of 1."),
      ).toBeVisible();
      const start = performance.now();
      await page
        .getByLabel("Graph resource preview")
        .selectOption(`large-${size}`);
      await expect(
        page.getByText(
          `Showing 20 of ${dependencies} matching dependencies. Page 1 of ${Math.ceil(dependencies / 20)}.`,
        ),
      ).toBeVisible();
      await expect(page.locator(".react-flow__node")).toHaveCount(21);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      renderSamples.push(performance.now() - start);
    }
    const renderHeap = await cdp.send("Runtime.getHeapUsage");
    const renderDom = await cdp.send("Memory.getDOMCounters");
    const interactions: { operation: string; ms: number }[] = [];
    for (const index of [
      dependencies - 1,
      Math.floor(dependencies / 2),
      Math.floor(dependencies / 4),
      dependencies - 2,
      0,
    ]) {
      const name = `Fixture Service ${String(index).padStart(3, "0")}`;
      const start = performance.now();
      await page.getByLabel("Search dependencies").fill(name);
      await expect(page.getByRole("button", { name })).toBeVisible();
      interactions.push({
        operation: `search ${index}`,
        ms: performance.now() - start,
      });
      const select = performance.now();
      await page.getByRole("button", { name }).click();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      interactions.push({
        operation: `select ${index}`,
        ms: performance.now() - select,
      });
    }
    await page.getByLabel("Search dependencies").fill("");
    await expect(
      page.getByText(
        `Showing 20 of ${dependencies} matching dependencies. Page 1 of ${Math.ceil(dependencies / 20)}.`,
      ),
    ).toBeVisible();
    const paging = performance.now();
    await page.getByRole("button", { name: "Next dependencies" }).click();
    await expect(
      page.getByText(
        `Showing 20 of ${dependencies} matching dependencies. Page 2 of ${Math.ceil(dependencies / 20)}.`,
      ),
    ).toBeVisible();
    interactions.push({
      operation: "next page",
      ms: performance.now() - paging,
    });
    expect(await page.locator(".react-flow__node").count()).toBeLessThanOrEqual(
      41,
    );
    expect(await page.locator(".react-flow__edge").count()).toBeLessThanOrEqual(
      80,
    );
    expect(errors).toEqual([]);
    await cdp.send("HeapProfiler.collectGarbage");
    const after = {
      heap: await cdp.send("Runtime.getHeapUsage"),
      dom: await cdp.send("Memory.getDOMCounters"),
    };
    const folder = resolve("../../evidence/experience/performance-visual-core");
    await mkdir(folder, { recursive: true });
    await page
      .locator(".graph")
      .screenshot({ path: resolve(folder, `graph-${size}-LOCAL-1440.png`) });
    await writeFile(
      resolve(folder, `graph-${size}-LOCAL.json`),
      JSON.stringify(
        {
          timestampUTC: new Date().toISOString(),
          mode: "LOCAL development synthetic fixture",
          browser: page.context().browser()?.version(),
          nodes: size,
          dependencyNodes: dependencies,
          edges: dependencies + 2,
          viewport: { width: 1440, height: 1000 },
          scope:
            "Warm dataset switch to 21 visible DOM nodes plus two animation frames; 5 samples; interactions include Playwright overhead. Heap samples are observations, not peak allocation or leak certification.",
          initialFixtureLoadMs,
          renderSamplesMs: renderSamples,
          interactions,
          before,
          renderHeap,
          renderDom,
          after,
          errors,
        },
        null,
        2,
      ),
    );
    await cdp.detach();
  });
