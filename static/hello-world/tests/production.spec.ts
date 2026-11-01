import { test, expect } from "@playwright/test";
test("production has no fixture fallback or simulated action controls", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3001");
  await expect(
    page.getByRole("heading", { name: "Connect your installed workspace" }),
  ).toBeVisible();
  await expect(
    page.getByText("PENDING_BACKEND", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve local demo plan" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Simulate execution" }),
  ).toHaveCount(0);
  await expect(page.getByText("AUTH-142", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: "../../evidence/experience/v2-production/access-LOCAL-1440.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:3001/#Component%20Showcase");
  await expect(page.getByLabel("Graph resource preview")).toHaveCount(0);
});
