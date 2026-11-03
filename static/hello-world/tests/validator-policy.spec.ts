import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  capabilities,
  graph,
  meta,
  passport,
  plan,
  response,
} from "./core-test-data";

// MOCK_TRANSPORT only: validator outage policy (Settings) and Passport gate.
type Policy = {
  onOutage: "ALLOW" | "BLOCK";
  updatedBy: string | null;
  updatedAt: string | null;
  canEdit: boolean;
};

async function settings(
  page: Page,
  opts: { signal: boolean; policy?: Policy; denySet?: boolean },
) {
  const sets: unknown[] = [];
  let policy = opts.policy;
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as {
      operation: string;
      input: { onOutage?: "ALLOW" | "BLOCK" };
    };
    switch (call.operation) {
      case "getCapabilities":
        return route.fulfill({
          json: response({
            ...capabilities,
            operations: opts.signal
              ? [...capabilities.operations, "validator:outage-policy"]
              : capabilities.operations,
          }),
        });
      case "listProjects":
        return route.fulfill({
          json: response({
            items: [],
            page: { nextCursor: null, totalKnown: 0 },
          }),
        });
      case "getValidatorPolicy":
        return route.fulfill({ json: response(policy) });
      case "setValidatorPolicy":
        sets.push(call.input);
        if (opts.denySet)
          return route.fulfill({
            json: {
              ok: false,
              meta,
              error: {
                code: "PERMISSION_DENIED",
                message: "Site administrator required.",
                requestId: meta.requestId,
                retryable: false,
              },
            },
          });
        policy = {
          ...policy!,
          onOutage: call.input.onOutage!,
          updatedBy: "admin-1",
          updatedAt: meta.generatedAt,
        };
        return route.fulfill({ json: response(policy) });
      default:
        throw new Error(`Unexpected resolver ${call.operation}`);
    }
  });
  await page.goto("/tests/core-harness.html#Settings");
  return sets;
}

const panel = (page: Page) =>
  page.getByRole("region", { name: "Workflow validator during an outage" });

test("outage policy is hidden when the backend does not advertise it", async ({
  page,
}) => {
  await settings(page, { signal: false });
  await expect(
    page.getByRole("heading", { name: "Capabilities" }),
  ).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
});

test("non-admins see the setting read-only, without a switch", async ({
  page,
}) => {
  await settings(page, {
    signal: true,
    policy: {
      onOutage: "ALLOW",
      updatedBy: null,
      updatedAt: null,
      canEdit: false,
    },
  });
  await expect(page.getByTestId("validator-policy-current")).toContainText(
    "During an outage: Allow",
  );
  await expect(page.getByTestId("validator-policy-current")).toContainText(
    "Default setting",
  );
  await expect(panel(page).getByRole("radio")).toHaveCount(0);
  await expect(panel(page)).toContainText(
    "Only a Jira site administrator can change this setting.",
  );
});

test("admins change the setting only after confirming", async ({ page }) => {
  const sets = await settings(page, {
    signal: true,
    policy: {
      onOutage: "ALLOW",
      updatedBy: null,
      updatedAt: null,
      canEdit: true,
    },
  });
  const block = panel(page).getByRole("radio", { name: "Block" });
  await block.click();
  const dialog = page.getByRole("dialog", {
    name: "Block gated transitions during an outage?",
  });
  await expect(dialog).toContainText("stop while ANTICIPATE is unavailable");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect(sets).toEqual([]);
  await expect(panel(page).getByRole("radio", { name: "Allow" })).toBeChecked();

  await block.click();
  await dialog.getByRole("button", { name: "Block during outages" }).click();
  await expect(page.getByTestId("validator-policy-current")).toContainText(
    "During an outage: Block",
  );
  await expect(page.getByTestId("validator-policy-current")).toContainText(
    "by an administrator",
  );
  expect(sets).toEqual([{ onOutage: "BLOCK" }]);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});

test("a refused change keeps the previous setting", async ({ page }) => {
  const sets = await settings(page, {
    signal: true,
    policy: {
      onOutage: "ALLOW",
      updatedBy: null,
      updatedAt: null,
      canEdit: true,
    },
    denySet: true,
  });
  await panel(page).getByRole("radio", { name: "Block" }).click();
  await page.getByRole("button", { name: "Block during outages" }).click();
  await expect(panel(page).getByRole("alert")).toContainText(
    "Nothing was changed",
  );
  await expect(page.getByTestId("validator-policy-current")).toContainText(
    "During an outage: Allow",
  );
  expect(sets).toEqual([{ onOutage: "BLOCK" }]);
});

for (const gate of [
  {
    status: "CLOSED" as const,
    reason:
      "the option chosen in plan test assumes work that Jira does not show as done yet (consumers still depend on it).",
    label: "Closed · the validator refuses it",
  },
  {
    status: "OPEN" as const,
    reason: "A valid decision attestation allows the Jira transition.",
    label: "Open · the validator allows it",
  },
  {
    status: "NOT_GATED" as const,
    reason: "ABC-1 is not labelled anticipate-change.",
    label: "Not gated by the validator",
  },
])
  test(`Passport shows the Jira transition gate (${gate.status})`, async ({
    page,
  }) => {
    const done = { ...plan, status: "COMPLETED" as const };
    const report = {
      ...passport(done, []),
      gate: { status: gate.status, reason: gate.reason },
    };
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
                ? []
                : call.operation === "getEvidenceGraph"
                  ? graph
                  : null;
      if (data === null) throw new Error(`Unexpected ${call.operation}`);
      await route.fulfill({ json: response(data) });
    });
    await page.goto("/tests/core-harness.html");
    await page.getByLabel("Recovery plan ID").fill(done.planId);
    await page
      .getByRole("button", { name: "Recover plan and execution status" })
      .click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /^Prevention Passport/ })
      .click();
    const row = page.getByTestId("passport-gate");
    await expect(row).toContainText("Jira transition");
    await expect(row).toContainText(gate.label);
    if (gate.status === "OPEN")
      await expect(row).not.toContainText(gate.reason);
    else await expect(row).toContainText(gate.reason);
  });
