import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { capabilities, comparison, graph, response } from "./core-test-data";

// LOCAL / MOCK_TRANSPORT: authored inputs and no Atlassian connection.
async function workspace(page: Page, theme = "dark", missingPath = false) {
  const calls: string[] = [];
  const moreGraph = {
    ...graph,
    nodes: [
      ...graph.nodes,
      {
        ...graph.nodes[1],
        id: "issue:ABC-4",
        label: "ABC-4 Partner webhooks",
        status: "INFERRED",
      },
    ],
    edges: [
      ...graph.edges,
      {
        ...graph.edges[0],
        id: "e2",
        from: "issue:ABC-4",
        to: "issue:ABC-2",
        status: "INFERRED",
      },
    ],
  };
  const downstream = {
    ...comparison.results[0].impacts[0],
    nodeId: "issue:ABC-4",
    pathEdgeIds: missingPath ? ["e1", "e2", "not-loaded"] : ["e1", "e2"],
    depth: 2,
    direct: false,
    weakestStatus: "INFERRED",
  };
  const choices = {
    ...comparison,
    results: comparison.results.map((result, index) => {
      const impacts =
        index === 0
          ? [...result.impacts, downstream]
          : index === 2
            ? [{ ...downstream, weakestStatus: "CONFIRMED" }]
            : result.impacts;
      return {
        ...result,
        impacts,
        summary: {
          ...result.summary,
          impacted: impacts.length,
          direct: impacts.filter((impact) => impact.direct).length,
          transitive: impacts.filter((impact) => !impact.direct).length,
        },
      };
    }),
  };
  await page.route("**/__core_test", async (route) => {
    const { operation } = route.request().postDataJSON() as {
      operation: string;
    };
    calls.push(operation);
    const data =
      operation === "getCapabilities"
        ? {
            ...capabilities,
            operations: [
              ...capabilities.operations,
              "previewSampleProject",
              "createSampleProject",
            ],
          }
        : operation === "listProjects"
          ? {
              items: [
                {
                  id: "100",
                  key: "ABC",
                  name: "Clarity test project",
                  url: null,
                  issueCount: 4,
                  lastSnapshotAt: null,
                  dataAvailability: "NO_SNAPSHOT",
                },
              ],
              page: { nextCursor: null, totalKnown: 1 },
            }
          : operation === "compareScenarios"
            ? choices
            : ["getGraphSnapshot", "getEvidenceGraph"].includes(operation)
              ? moreGraph
              : null;
    if (data === null)
      throw new Error(
        `Unexpected operation ${operation}; this test must remain read-only.`,
      );
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${theme}`);
  await expect(
    page.getByRole("heading", { name: "Mission Control", exact: true }),
  ).toBeVisible();
  return calls;
}

// Setup for the split tail test (#225): the original single test (~20
// steps incl. an axe scan) exhausted the 30 s budget on the slowest
// engine, so the flow now runs as two tests with isolated budgets. Test 1
// keeps the original inline sequence; test 2 rebuilds it via this helper.
async function reachFocusedMap(page: Page, missing: boolean) {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await workspace(page, "dark", missing);
  await compare(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /^Evidence Graph/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Focus supplied impact path",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel("Search evidence").fill("Partner webhooks");
  await page
    .getByRole("group", { name: "Show simulated impact for" })
    .getByRole("button", { name: /^Remove now/ })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  const initialCalls = calls.length;
  await page
    .getByRole("button", { name: "Focus supplied impact path", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge.ax-edge--unknown")).toHaveCount(
    1,
  );
  await expect(page.locator(".react-flow__edge.ax-edge--inferred")).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("list", { name: "Impact path to ABC-4 Partner webhooks" }),
  ).toContainText("Unknown");
  if (missing) {
    await expect(
      page.getByText("Path context is incomplete", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/1 supplied relationships and 0 endpoints/),
    ).toBeVisible();
    await expect(
      page.getByRole("list", {
        name: "Impact path to ABC-4 Partner webhooks",
      }),
    ).toContainText("not-loaded");
  }
  expect(calls).toHaveLength(initialCalls);
  return { calls, initialCalls };
}

for (const missing of [false, true]) {
  test(`focused map includes supplied off-page context without guessing (${missing ? "missing relationship" : "complete path"})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const calls = await workspace(page, "dark", missing);
    await compare(page);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /^Evidence Graph/ })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Focus supplied impact path",
        exact: true,
      }),
    ).toBeDisabled();
    await page.getByLabel("Search evidence").fill("Partner webhooks");
    await page
      .getByRole("group", { name: "Show simulated impact for" })
      .getByRole("button", { name: /^Remove now/ })
      .click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    const initialCalls = calls.length;
    await page
      .getByRole("button", { name: "Focus supplied impact path", exact: true })
      .click();
    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    await expect(
      page.locator(".react-flow__edge.ax-edge--unknown"),
    ).toHaveCount(1);
    await expect(
      page.locator(".react-flow__edge.ax-edge--inferred"),
    ).toHaveCount(1);
    await expect(
      page.getByRole("list", { name: "Impact path to ABC-4 Partner webhooks" }),
    ).toContainText("Unknown");
    if (missing) {
      await expect(
        page.getByText("Path context is incomplete", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/1 supplied relationships and 0 endpoints/),
      ).toBeVisible();
      await expect(
        page.getByRole("list", {
          name: "Impact path to ABC-4 Partner webhooks",
        }),
      ).toContainText("not-loaded");
    }
    expect(calls).toHaveLength(initialCalls);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".ax-graph-panel")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.locator("body"); // terminates the orphaned chain; the real split follows
  });
  test(`focused map returns to overview and retains the change (${missing ? "missing relationship" : "complete path"})`, async ({
    page,
  }) => {
    const { calls, initialCalls } = await reachFocusedMap(page, missing);
    await page
      .getByRole("button", { name: "Return to map overview", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.getByLabel("Search evidence")).toHaveValue(
      "Partner webhooks",
    );
    await page
      .getByRole("button", { name: "Focus supplied impact path", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Show simulated impact for" })
      .getByRole("button", { name: /^Retain temporarily/ })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Focus supplied impact path",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    expect(calls).toHaveLength(initialCalls);
  });
}

async function compare(page: Page) {
  // The project list populates asynchronously after load: wait for the
  // target option explicitly instead of racing selectOption (#225).
  await expect(
    page
      .getByRole("combobox", { name: "Jira project", exact: true })
      .locator('option[value="100"]'),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Jira project", exact: true })
    .selectOption("100");
  await page.getByLabel("Jira issue key").fill("ABC-1");
  await page
    .getByRole("button", { name: "Analyze dependencies", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Replacement for option C", exact: true })
    .locator('option[value="issue:ABC-3"]');
  // The option above only terminates the chain; the real wait follows: the
  // replacement list populates asynchronously, so wait for the target
  // option explicitly instead of racing selectOption (#225).
  await expect(
    page
      .getByRole("combobox", { name: "Replacement for option C", exact: true })
      .locator('option[value="issue:ABC-3"]'),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Replacement for option C", exact: true })
    .selectOption("issue:ABC-3");
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "What differs between two options?",
      exact: true,
    }),
  ).toBeVisible();
}

for (const theme of ["dark", "light"]) {
  test(`named consequences remain read-only and usable across viewports (${theme})`, async ({
    page,
  }) => {
    const calls = await workspace(page, theme);
    await expect(
      page.getByText("Know what depends on your next change."),
    ).toBeVisible();
    await expect(
      page.getByText(/See direct and indirect dependencies/),
    ).toBeVisible();
    await expect(page.locator(".ax-hero__boundaries")).toContainText(
      "confirmed sample creation",
    );
    await compare(page);
    const inspector = page.locator(".ax-option-diff");
    await expect(
      inspector.getByRole("region", { name: "Only listed in Remove now" }),
    ).toContainText("Partner webhooks");
    await expect(
      inspector.getByRole("region", { name: "Listed in both options" }),
    ).toContainText("ABC-2 Consumer");
    const selected = page
      .getByRole("radiogroup", { name: "Decision options" })
      .getByRole("radio", { checked: true });
    const originalLabel = await selected.getAttribute("name");
    const originalChecked = await page
      .locator(".ax-scenarios input:checked")
      .evaluate(
        (element) =>
          (element as HTMLInputElement).closest("label")?.textContent,
      );
    const initialCalls = calls.length;
    await inspector.getByLabel("Second option to inspect");
    // The chain above only terminates; the real wait follows: the option
    // list populates asynchronously, so wait for the target option
    // explicitly instead of racing selectOption (#225).
    await expect(
      inspector
        .getByLabel("Second option to inspect")
        .locator('option[value="C-migrate-then-retire"]'),
    ).toHaveCount(1);
    await inspector
      .getByLabel("Second option to inspect")
      .selectOption("C-migrate-then-retire");
    await expect(inspector).toContainText("Simulation assumption");
    await expect(
      inspector.getByRole("region", { name: "Listed in both options" }),
    ).toContainText("Inferred");
    expect(await selected.getAttribute("name")).toBe(originalLabel);
    expect(
      await page
        .locator(".ax-scenarios input:checked")
        .evaluate(
          (element) =>
            (element as HTMLInputElement).closest("label")?.textContent,
        ),
    ).toBe(originalChecked);
    expect(calls).toHaveLength(initialCalls);
    await inspector.getByLabel("First option to inspect").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(
      inspector.getByLabel("Second option to inspect"),
    ).toBeFocused();
    for (const width of [320, 390, 768, 1024, 1440, 1920, 3440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(inspector).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `overflow ${width}`,
      ).toBe(true);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include(".ax-option-diff")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await inspector.screenshot({
        path: `test-results/decision-difference-${theme}-${width}-MOCK_TRANSPORT.png`,
        // Keep the test-only disclaimer from obscuring a tall element capture.
        // The file name and evidence record retain the MOCK_TRANSPORT label.
        style: "#root > p[role='status'] { position: static !important; }",
      });
    }
  });
}

for (const source of ["os", "preference"]) {
  test(`guided demo keeps focus and uses instant scrolling for reduced motion (${source})`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: source === "os" ? "reduce" : "no-preference",
    });
    await page.addInitScript((reducePreference) => {
      if (reducePreference)
        localStorage.setItem(
          "anticipate-display-preferences",
          JSON.stringify({ motion: "reduce" }),
        );
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (options) {
        if (this.id === "demo-setup")
          (window as unknown as { demoScroll?: unknown }).demoScroll = options;
        original.call(this, options);
      };
    }, source === "preference");
    const calls = await workspace(page);
    await page
      .getByRole("button", { name: "Start the guided demo", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Jira project", exact: true }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => (window as unknown as { demoScroll?: unknown }).demoScroll,
      ),
    ).toMatchObject({ behavior: "instant" });
    expect(
      calls.some((operation) =>
        ["createSampleProject", "approvePlan", "executeApprovedPlan"].includes(
          operation,
        ),
      ),
    ).toBe(false);
  });
}
