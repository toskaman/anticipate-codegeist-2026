import { test, expect } from "@playwright/test";
test("per-action fixture review requires live approval and never executes", async ({
  page,
}) => {
  await page.goto("/#Component%20Showcase");
  await expect(
    page.getByRole("heading", { name: "Review individual actions" }),
  ).toBeVisible();
  const approval = page.getByRole("button", {
    name: "Request approval for selected actions",
    exact: true,
  });
  await expect(approval).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Select Verify support consumer inventory" })
    .check();
  await approval.click();
  await expect(page.getByRole("dialog")).toContainText(
    "Submit only your selected action IDs",
  );
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Requires live authenticated backend",
  );
  await expect(
    page.getByRole("button", { name: "Execute backend-approved actions" }),
  ).toBeDisabled();
  await expect(
    page.locator(".action .badge").filter({ hasText: "APPROVED" }),
  ).toHaveCount(0);
  await page
    .getByRole("region", { name: "Action review", exact: true })
    .screenshot({
      path: "../../evidence/experience/v2-action-review/approval-requires-backend-MOCK-1280.png",
    });
});
