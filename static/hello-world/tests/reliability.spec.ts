import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
test("records browser interaction latency and repeated-route observations", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const active = new Set<EventListenerOrEventListenerObject>();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === "hashchange") active.add(listener);
      add(type, listener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      if (type === "hashchange") active.delete(listener);
      remove(type, listener, options);
    }) as typeof window.removeEventListener;
    Object.defineProperty(window, "__anticipateHashListenerCount", {
      value: () => active.size,
    });
  });
  await page.goto("/#Component%20Showcase");
  await page.getByLabel("Graph resource preview").selectOption("large");
  await expect(
    page.getByText("Showing 20 of 120 matching dependencies. Page 1 of 6."),
  ).toBeVisible();
  const samples: number[] = [];
  for (const id of [119, 75, 30, 105, 5]) {
    const start = performance.now();
    await page
      .getByLabel("Search dependencies")
      .fill(`Fixture Service ${String(id).padStart(3, "0")}`);
    await expect(
      page.getByRole("button", {
        name: `Fixture Service ${String(id).padStart(3, "0")}`,
      }),
    ).toBeVisible();
    samples.push(performance.now() - start);
  }
  const nav = (name: string) =>
    page.getByRole("navigation").getByRole("button", { name, exact: true });
  await nav("Evidence Graph").click();
  await expect(page.getByLabel("Search dependencies")).toBeVisible();
  await nav("Mission Control").click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const before = {
    dom: await cdp.send("Memory.getDOMCounters"),
    heap: await cdp.send("Runtime.getHeapUsage"),
  };
  const checkpoints: {
    cycle: number;
    dom: Awaited<ReturnType<typeof cdp.send>>;
    heap: Awaited<ReturnType<typeof cdp.send>>;
  }[] = [];
  const listenerCounts: number[] = [];
  for (let cycle = 0; cycle < 30; cycle++) {
    await nav("Evidence Graph").click();
    await expect(page.getByLabel("Search dependencies")).toBeVisible();
    await nav("Mission Control").click();
    await expect(
      page.getByRole("heading", { name: "Mission Control", exact: true }),
    ).toBeVisible();
    if ([4, 14, 29].includes(cycle)) {
      await cdp.send("HeapProfiler.collectGarbage");
      checkpoints.push({
        cycle: cycle + 1,
        dom: await cdp.send("Memory.getDOMCounters"),
        heap: await cdp.send("Runtime.getHeapUsage"),
      });
    }
    listenerCounts.push(
      await page.evaluate(() => {
        const value = Object.getOwnPropertyDescriptor(
          window,
          "__anticipateHashListenerCount",
        )?.value as () => number;
        return value();
      }),
    );
  }
  await cdp.send("HeapProfiler.collectGarbage");
  const after = {
    dom: await cdp.send("Memory.getDOMCounters"),
    heap: await cdp.send("Runtime.getHeapUsage"),
  };
  expect(new Set(listenerCounts)).toEqual(new Set([1]));
  expect(after.dom.nodes).toBe(before.dom.nodes);
  expect(after.dom.jsEventListeners).toBe(before.dom.jsEventListeners);
  expect(errors).toEqual([]);
  const ordered = [...samples].sort((a, b) => a - b);
  const folder = resolve("../../evidence/experience/v2-reliability");
  await mkdir(folder, { recursive: true });
  await writeFile(
    resolve(folder, "browser-observations-LOCAL.json"),
    JSON.stringify(
      {
        timestampUTC: new Date().toISOString(),
        mode: "LOCAL development fixture",
        scope:
          "5 Playwright fill-to-visible samples at 120 synthetic dependencies; includes automation overhead; 30 warmed graph/dashboard round trips; not a long soak or Forge proof",
        browser: page.context().browser()?.version(),
        searchSamplesMs: samples,
        medianMs: ordered[2],
        maxMs: ordered[4],
        hashListenerCounts: listenerCounts,
        before,
        checkpoints,
        after,
        errors,
      },
      null,
      2,
    ),
  );
  await cdp.detach();
});
