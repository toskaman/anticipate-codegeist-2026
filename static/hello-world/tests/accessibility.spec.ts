import { test, expect } from "@playwright/test";
test("mobile skip link focuses content without changing the current screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/#Scenario%20Lab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toHaveCSS("clip-path", "inset(50%)");
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS("top", "0px");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await expect(page).toHaveURL(/#Scenario%20Lab$/);
  await expect(
    page.getByRole("heading", { name: "Scenario Lab", exact: true }),
  ).toBeVisible();
});
test("history, keyboard dialog and reset on plan page", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Scenario Lab", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Prevention Plan", exact: true })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Scenario Lab", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Prevention Plan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Reset the demo session?",
  );
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset demo", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Execute backend-approved actions" }),
  ).toBeDisabled();
});
test("malformed URL recovers and Forge mode reports unavailable", async ({
  page,
}) => {
  await page.goto("/#%E0%A4%A");
  await expect(
    page.getByRole("heading", { name: "Mission Control", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByLabel("Data mode").selectOption("forge");
  await expect(
    page.getByRole("heading", { name: "Integration unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to ANTICIPATE" }),
  ).toBeVisible();
});
