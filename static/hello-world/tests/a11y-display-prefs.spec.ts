import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  capabilities,
  graph,
  lockedSharedDecisionsFlag,
  response,
} from "./core-test-data";

// Display & accessibility menu: disclosure behaviour, preference application,
// persistence, and the reduced-motion CSS guards. MOCK_TRANSPORT only.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(", ")}`,
  );

async function missionControl(page: Page, theme: "light" | "dark" = "dark") {
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as { operation: string };
    let data: unknown = null;
    switch (call.operation) {
      case "getCapabilities":
        data = capabilities;
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
      case "getChangeCandidates":
        data = {
          items: [],
          page: { nextCursor: null, totalKnown: 0 },
        };
        break;
      case "getGraphSnapshot":
      case "getEvidenceGraph":
        data = graph;
        break;
      case "getFeatureFlag":
        data = lockedSharedDecisionsFlag;
        break;
    }
    if (data === null)
      throw new Error(`Unexpected test resolver ${call.operation}`);
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${theme}`);
  await expect(
    page.getByRole("heading", { name: "Mission Control", exact: true }),
  ).toBeVisible();
}

const menuButton = (page: Page) =>
  page.getByRole("button", { name: "Display & accessibility", exact: true });
const menuDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Display and accessibility" });

test("display menu opens axe-clean, Escape closes and restores focus", async ({
  page,
}) => {
  await missionControl(page);
  const button = menuButton(page);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const dialog = menuDialog(page);
  await expect(dialog).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("display menu closes on outside pointer press", async ({ page }) => {
  await missionControl(page);
  const button = menuButton(page);
  await button.click();
  await expect(menuDialog(page)).toBeVisible();
  await page
    .getByRole("heading", { name: "Mission Control", exact: true })
    .click();
  await expect(menuDialog(page)).toHaveCount(0);
});

test("motion and text-size preferences apply and persist across reload", async ({
  page,
}) => {
  await missionControl(page);
  await menuButton(page).click();
  const dialog = menuDialog(page);
  await dialog
    .getByRole("group", { name: /Motion/ })
    .getByRole("radio", { name: "Reduce" })
    .check();
  await dialog
    .getByRole("group", { name: /Text size/ })
    .getByRole("radio", { name: "Larger" })
    .check();
  const app = page.locator(".ax-app");
  await expect(app).toHaveAttribute("data-motion", "reduce");
  await expect(app).toHaveAttribute("data-text-size", "larger");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Mission Control", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ax-app")).toHaveAttribute(
    "data-motion",
    "reduce",
  );
  await expect(page.locator(".ax-app")).toHaveAttribute(
    "data-text-size",
    "larger",
  );
  await menuButton(page).click();
  await expect(
    menuDialog(page).getByRole("radio", { name: "Reduce" }),
  ).toBeChecked();
  await expect(
    menuDialog(page).getByRole("radio", { name: "Larger" }),
  ).toBeChecked();
});

test("reduced motion collapses transition durations (media query and manual Reduce)", async ({
  page,
  browser,
}) => {
  await missionControl(page);
  const select = page.locator(".ax-app select").first();
  await expect(select).toBeVisible();
  const before = await select.evaluate(
    (el) => getComputedStyle(el).transitionDuration,
  );
  expect(before).not.toContain("0.001s");
  // Manual preference path: data-motion="reduce" on the app root.
  await menuButton(page).click();
  await menuDialog(page).getByRole("radio", { name: "Reduce" }).check();
  await expect(page.locator(".ax-app")).toHaveAttribute(
    "data-motion",
    "reduce",
  );
  await expect
    .poll(() =>
      select.evaluate((el) => getComputedStyle(el).transitionDuration),
    )
    .toContain("0.001s");
  // OS-level path: prefers-reduced-motion with the preference left on System.
  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const osPage = await reduced.newPage();
  try {
    await missionControl(osPage);
    const osSelect = osPage.locator(".ax-app select").first();
    await expect(osSelect).toBeVisible();
    await expect
      .poll(() =>
        osSelect.evaluate((el) => getComputedStyle(el).transitionDuration),
      )
      .toContain("0.001s");
  } finally {
    await reduced.close();
  }
});
