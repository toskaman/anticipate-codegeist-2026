import { test, expect } from "@playwright/test";
test("actual graph loading, empty and retry states", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Component Showcase" })
    .click();
  await page.getByLabel("Graph resource preview").selectOption("empty");
  await expect(
    page.getByText("No dependencies match.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Graph resource preview").selectOption("retry");
  await expect(
    page.getByRole("heading", { name: "Evidence unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry evidence" }).click();
  await expect(page.getByLabel("Search dependencies")).toBeVisible();
  await page.getByLabel("Graph resource preview").selectOption("slow");
  await expect(
    page.getByRole("heading", { name: "Loading evidence snapshot…" }),
  ).toBeVisible();
  await expect(page.getByLabel("Search dependencies")).toBeVisible();
});
