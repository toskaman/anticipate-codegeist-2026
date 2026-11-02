import { test, expect } from "@playwright/test";
test("scenario, firewall, plan and passport keep one consistent decision", async ({
  page,
}) => {
  await page.goto("/#Scenario%20Lab");
  for (const [id, violations] of [
    ["A", 3],
    ["B", 1],
    ["C", 0],
  ] as const) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Scenario Lab", exact: true })
      .click();
    await page.getByLabel("Selected scenario").selectOption(id);
    await page
      .getByRole("button", { name: "Review policy checks", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `Policy review · Scenario ${id}` }),
    ).toBeVisible();
    await expect(
      page.locator(".policy .badge").filter({ hasText: /^FAILED$/ }),
    ).toHaveCount(violations);
    await expect(
      page.locator(".policy .badge").filter({ hasText: /^UNKNOWN$/ }),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Review prevention plan", exact: true })
      .click();
    if (id === "C")
      await expect(
        page.getByRole("heading", { name: "Review individual actions" }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", {
          name: "No authored plan for this alternative",
        }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "View Prevention Passport", exact: true })
      .click();
    await expect(
      page.getByText(`Selected scenario ${id}. Compared A, B and C.`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "No authenticated approval or verified execution recorded.",
      ),
    ).toBeVisible();
  }
});
