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
for (const width of [1440, 1024, 390])
  for (const theme of ["dark", "light"])
    test(`screen accessibility ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
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
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${name} horizontal overflow at ${width}`,
        ).toBe(true);
        const clippedText = await page
          .locator("h1,h2,h3,p,button,label,small,.badge")
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const el = element as HTMLElement;
                return (
                  el.clientWidth > 0 &&
                  el.scrollWidth > el.clientWidth + 2 &&
                  getComputedStyle(el).whiteSpace !== "nowrap"
                );
              })
              .map((element) => ({
                tag: element.tagName,
                text: element.textContent?.slice(0, 90),
                width: (element as HTMLElement).clientWidth,
                scroll: (element as HTMLElement).scrollWidth,
              })),
          );
        expect(clippedText, `${name} clipped text ${theme} ${width}`).toEqual(
          [],
        );
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          results.violations,
          `${theme} ${name}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
        ).toEqual([]);
        await page
          .locator("#main")
          .evaluate((element) =>
            (element as HTMLElement).focus({ preventScroll: true }),
          );
        await page.screenshot({
          path: `../../evidence/experience/performance-visual-core/screens/${name.toLowerCase().replace(/ /g, "-")}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    });
