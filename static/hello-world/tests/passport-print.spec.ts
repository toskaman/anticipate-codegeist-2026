import { test, expect } from "@playwright/test";
import type { ExecutionRecord, PreventionPlan } from "@anticipate/contracts";
import {
  capabilities,
  graph,
  meta,
  passport,
  plan,
  response,
} from "./core-test-data";

// MOCK_TRANSPORT: the connected (hosted) Passport screen with a long report,
// recovered by plan ID. Checks the printed layout, not a hosted Forge result.
const ACTIONS = 40;
const longPlan: PreventionPlan = {
  ...plan,
  status: "COMPLETED",
  actions: Array.from({ length: ACTIONS }, (_, i) => ({
    ...plan.actions[0],
    actionId: `record:ABC-${i + 1}`,
    targetIssueKey: `ABC-${i + 1}`,
    reason: `Record the decision on consumer ${i + 1}. ${"Owner confirmation requested before the retirement window closes. ".repeat(2)}`,
  })),
};
const executions: ExecutionRecord[] = longPlan.actions.map((a, i) => ({
  executionId: `exec-${i + 1}`,
  planId: longPlan.planId,
  actionId: a.actionId,
  status: "VERIFIED",
  attempt: 1,
  idempotencyKey: `idem-${i + 1}`,
  resultRef: { issueKey: a.targetIssueKey, url: null },
  error: null,
  updatedAt: meta.generatedAt,
}));
const report = {
  ...passport(longPlan, executions),
  timeline: Array.from({ length: 30 }, (_, i) => ({
    at: new Date(Date.parse(meta.generatedAt) + i * 60000).toISOString(),
    event: `Test transport event ${i + 1}: action verified by reading Jira back`,
  })),
};

for (const theme of ["light", "dark"] as const)
  test(`connected Passport prints a long report readably (${theme})`, async ({
    page,
  }) => {
    await page.route("**/__core_test", async (route) => {
      const call = route.request().postDataJSON() as { operation: string };
      const data =
        call.operation === "getCapabilities"
          ? capabilities
          : call.operation === "listProjects"
            ? { items: [], page: { nextCursor: null, totalKnown: 0 } }
            : call.operation === "getPreventionPassport"
              ? report
              : call.operation === "getExecutionStatus"
                ? executions
                : call.operation === "getEvidenceGraph"
                  ? graph
                  : null;
      if (data === null) throw new Error(`Unexpected ${call.operation}`);
      await route.fulfill({ json: response(data) });
    });
    await page.goto(`/tests/core-harness.html?theme=${theme}`);
    await page.getByLabel("Recovery plan ID").fill(longPlan.planId);
    await page
      .getByRole("button", { name: "Recover plan and execution status" })
      .click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /^Prevention Passport/ })
      .click();
    const article = page.locator("article.ax-report");
    await expect(article).toBeVisible();
    await page.emulateMedia({ media: "print" });

    // Chrome of the app is hidden; the report fills the page.
    for (const sel of [".ax-sidebar", ".ax-topbar", ".ax-footer", ".ax-btn"])
      await expect(page.locator(sel).first()).toBeHidden();
    // Print forces the light paper palette whatever the screen theme.
    expect(
      await page.evaluate(
        () => getComputedStyle(document.querySelector(".ax-app")!).color,
      ),
    ).toBe("rgb(0, 0, 0)");
    // Every executed action is printed (no clipping inside scroll regions).
    const text = await article.innerText();
    for (let i = 1; i <= ACTIONS; i++) expect(text).toContain(`ABC-${i}`);
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".ax-report *")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .filter((el) => getComputedStyle(el).overflowX !== "visible")
        .map((el) => el.className),
    );
    expect(overflow, "clipped horizontal content in print").toEqual([]);
    // Rows never split across pages and table headers repeat.
    expect(
      await page.evaluate(() => {
        const row = document.querySelector(".ax-report tbody tr");
        const head = document.querySelector(".ax-report thead");
        return [
          row && getComputedStyle(row).breakInside,
          head && getComputedStyle(head).display,
        ];
      }),
    ).toEqual(["avoid", "table-header-group"]);

    // The harness provenance banner is sticky on screen; keep it, but at the
    // top of the printed document so it cannot cover report content.
    await page.addStyleTag({
      content: "#root > p[role=status] { position: static !important; }",
    });
    // Real paginated output (Chromium print engine).
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
      path:
        theme === "light"
          ? "../../evidence/experience/v4-ux/passport-long-print-MOCK_TRANSPORT.pdf"
          : undefined,
    });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [])
      .length;
    // A 40-action, 30-event report spans several pages but stays compact.
    expect(pages).toBeGreaterThan(1);
    expect(pages).toBeLessThanOrEqual(14);
    test.info().annotations.push({
      type: "pdf-pages",
      description: `${theme}: ${pages} A4 pages`,
    });
  });

test("historical Passport shows its retention state and recorded counts", async ({
  page,
}) => {
  const historical = {
    ...report,
    disclaimer: "HISTORICAL RECORD. TEST TRANSPORT ONLY.",
    evidence: {
      state: "ARCHIVED" as const,
      capturedAt: meta.generatedAt,
      expiresAt: "2026-11-03T00:00:00Z",
      nodeCount: 11,
      edgeCount: 10,
      causalEdgeCount: 7,
      snapshotDigest: "sha256-test-digest",
    },
  };
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as { operation: string };
    if (call.operation === "getEvidenceGraph") {
      await route.fulfill({
        json: {
          ok: false,
          meta,
          error: {
            code: "SNAPSHOT_EXPIRED",
            message: "Snapshot expired.",
            requestId: meta.requestId,
            retryable: false,
          },
        },
      });
      return;
    }
    const data =
      call.operation === "getCapabilities"
        ? capabilities
        : call.operation === "listProjects"
          ? { items: [], page: { nextCursor: null, totalKnown: 0 } }
          : call.operation === "getPreventionPassport"
            ? historical
            : executions;
    await route.fulfill({ json: response(data) });
  });
  await page.goto("/tests/core-harness.html");
  await page.getByLabel("Recovery plan ID").fill(longPlan.planId);
  await page
    .getByRole("button", { name: "Recover plan and execution status" })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /^Prevention Passport/ })
    .click();
  const article = page.locator("article.ax-report");
  await expect(article).toContainText("Historical record");
  await expect(page.getByTestId("passport-retention")).toContainText(
    "Evidence as reviewed on",
  );
  await expect(page.getByTestId("passport-retention")).toContainText(
    "does not reflect Jira today",
  );
  await expect(article).toContainText(
    "11 records, 10 relationships (7 causal)",
  );
  await expect(page.getByTestId("passport-refs")).toContainText(
    "evidence digest sha256-test-digest",
  );
  await article.screenshot({
    path: "../../evidence/experience/v4-ux/passport-historical-light-1280-MOCK_TRANSPORT.png",
  });
});

test("Print button opens the browser print flow; display preferences do not leak into print", async ({
  page,
}) => {
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as { operation: string };
    const data =
      call.operation === "getCapabilities"
        ? capabilities
        : call.operation === "listProjects"
          ? { items: [], page: { nextCursor: null, totalKnown: 0 } }
          : call.operation === "getPreventionPassport"
            ? report
            : call.operation === "getExecutionStatus"
              ? executions
              : graph;
    await route.fulfill({ json: response(data) });
  });
  // Stored display preferences: dark, larger text, high contrast.
  await page.addInitScript(() => {
    localStorage.setItem(
      "anticipate-display-preferences",
      JSON.stringify({ theme: "dark", textSize: "larger", contrast: "high" }),
    );
    (window as unknown as { printCalls: number }).printCalls = 0;
    window.print = () => {
      (window as unknown as { printCalls: number }).printCalls++;
    };
  });
  await page.goto("/tests/core-harness.html");
  await expect(page.locator(".ax-app")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Recovery plan ID").fill(longPlan.planId);
  await page
    .getByRole("button", { name: "Recover plan and execution status" })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /^Prevention Passport/ })
    .click();
  await page
    .getByRole("button", { name: "Print or save as PDF", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { printCalls: number }).printCalls,
    ),
  ).toBe(1);
  await page.emulateMedia({ media: "print" });
  // No dark surface anywhere in the printed report.
  const dark = await page.evaluate(() => {
    const lum = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return 1;
      const [r, g, b, a = 1] = m[1].split(",").map(Number);
      return a === 0 ? 1 : (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    return (
      [
        document.querySelector(".ax-app")!,
        ...document.querySelectorAll(".ax-report, .ax-report *"),
      ]
        // Ignore small decorative markers (timeline dots); check surfaces.
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width * r.height > 400;
        })
        .filter((el) => lum(getComputedStyle(el).backgroundColor) < 0.6)
        .map((el) => `${el.tagName}.${el.className}`)
        .slice(0, 5)
    );
  });
  expect(dark, "dark backgrounds in print").toEqual([]);
  // Paper palette wins over the dark/high-contrast screen preferences.
  expect(
    await page.evaluate(() => {
      const app = getComputedStyle(document.querySelector(".ax-app")!);
      const body = getComputedStyle(
        document.querySelector(".ax-report tbody td")!,
      );
      return [app.backgroundColor, app.color, body.color];
    }),
  ).toEqual(["rgb(255, 255, 255)", "rgb(0, 0, 0)", "rgb(0, 0, 0)"]);
  await page.addStyleTag({
    content: "#root > p[role=status] { position: static !important; }",
  });
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    path: "../../evidence/experience/v4-ux/passport-print-dark-larger-high-contrast-MOCK_TRANSPORT.pdf",
  });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [])
    .length;
  expect(pages).toBeGreaterThan(1);
  expect(pages).toBeLessThanOrEqual(16);
});
