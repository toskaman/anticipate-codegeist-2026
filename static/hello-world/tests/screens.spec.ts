import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const pages = [
  "Mission Control",
  "Evidence Graph",
  "Scenario Lab",
  "Decision Firewall",
  "Prevention Plan",
  "Prevention Passport",
  "Settings",
];
for (const theme of ["dark", "light"])
  test(`screen accessibility ${theme}`, async ({ page }) => {
    await page.goto("/");
    if (theme === "light")
      await page.getByRole("button", { name: "Switch theme" }).click();
    for (const name of pages) {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: new RegExp("^" + name) })
        .click();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      if (name === "Evidence Graph")
        await expect(page.getByLabel("Search dependencies")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations,
        `${theme} ${name}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
      ).toEqual([]);
      await page.screenshot({
        path: `../../evidence/${name.toLowerCase().replaceAll(" ", "-")}-${theme}.png`,
        fullPage: true,
      });
    }
  });
