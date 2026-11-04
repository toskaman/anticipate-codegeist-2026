import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  capabilities,
  response,
  meta,
  lockedSharedDecisionsFlag,
} from "./core-test-data";

// MOCK_TRANSPORT only: the shared-decisions acceptance panel (#131) in Settings.
// It must stay invisible unless the backend reports `released: true`.
async function settings(page: Page, flag: unknown | "error") {
  const ops: string[] = [];
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as { operation: string };
    ops.push(call.operation);
    switch (call.operation) {
      case "getCapabilities":
        return route.fulfill({ json: response(capabilities) });
      case "listProjects":
        return route.fulfill({
          json: response({
            items: [],
            page: { nextCursor: null, totalKnown: 0 },
          }),
        });
      case "getFeatureFlag":
        if (flag === "error")
          return route.fulfill({
            json: {
              ok: false,
              meta,
              error: {
                code: "UNSUPPORTED",
                message: "Unknown operation.",
                requestId: meta.requestId,
                retryable: false,
              },
            },
          });
        return route.fulfill({ json: response(flag) });
      default:
        throw new Error(`Unexpected resolver ${call.operation}`);
    }
  });
  await page.goto("/tests/core-harness.html#Settings");
  await expect(
    page.getByRole("heading", { name: "Capabilities" }),
  ).toBeVisible();
  return ops;
}

const panel = (page: Page) =>
  page.getByRole("region", { name: "Acceptance: shared decisions" });

test("hidden on a locked install (production default)", async ({ page }) => {
  const ops = await settings(page, lockedSharedDecisionsFlag);
  await expect.poll(() => ops.includes("getFeatureFlag")).toBe(true);
  await expect(panel(page)).toHaveCount(0);
});

test("hidden when the backend omits `released` (older backend)", async ({
  page,
}) => {
  const { released: _omit, ...older } = lockedSharedDecisionsFlag;
  void _omit;
  const ops = await settings(page, { ...older, enabled: true });
  await expect.poll(() => ops.includes("getFeatureFlag")).toBe(true);
  await expect(panel(page)).toHaveCount(0);
});

test("hidden when the flag read fails", async ({ page }) => {
  const ops = await settings(page, "error");
  await expect.poll(() => ops.includes("getFeatureFlag")).toBe(true);
  await expect(panel(page)).toHaveCount(0);
});

test("shown only when the backend reports released, with no axe violations", async ({
  page,
}) => {
  await settings(page, {
    ...lockedSharedDecisionsFlag,
    released: true,
    canEdit: true,
  });
  await expect(panel(page)).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include(
      '[aria-labelledby="shared-acceptance-title"], #shared-acceptance-title',
    )
    .analyze();
  expect(results.violations).toEqual([]);
});
