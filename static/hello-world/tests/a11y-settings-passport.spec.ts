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

// ORP-4 (#50). MOCK_TRANSPORT only: accessibility of Settings (validator
// outage policy and its confirmation dialog) and the Passport (screen and print).
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(", ")}`,
  );

async function adminSettings(page: Page, theme: "light" | "dark") {
  const sets: unknown[] = [];
  let policy = {
    onOutage: "ALLOW" as "ALLOW" | "BLOCK",
    updatedBy: null as string | null,
    updatedAt: null as string | null,
    canEdit: true,
  };
  await page.route("**/__core_test", async (route) => {
    const call = route.request().postDataJSON() as {
      operation: string;
      input: { onOutage?: "ALLOW" | "BLOCK" };
    };
    let data: unknown;
    switch (call.operation) {
      case "getCapabilities":
        data = {
          ...capabilities,
          operations: [...capabilities.operations, "validator:outage-policy"],
        };
        break;
      case "listProjects":
        data = { items: [], page: { nextCursor: null, totalKnown: 0 } };
        break;
      case "getValidatorPolicy":
        data = policy;
        break;
      case "setValidatorPolicy":
        sets.push(call.input);
        policy = {
          ...policy,
          onOutage: call.input.onOutage!,
          updatedBy: "admin-1",
          updatedAt: meta.generatedAt,
        };
        data = policy;
        break;
      default:
        throw new Error(`Unexpected resolver ${call.operation}`);
    }
    await route.fulfill({ json: response(data) });
  });
  await page.goto(`/tests/core-harness.html?theme=${theme}#Settings`);
  await expect(page.getByTestId("validator-policy-current")).toBeVisible();
  return sets;
}

for (const theme of ["light", "dark"] as const)
  test(`Settings outage policy and its dialog have no axe violations (${theme})`, async ({
    page,
  }) => {
    await adminSettings(page, theme);
    expect(await axe(page)).toEqual([]);
    await page
      .getByRole("region", { name: "Workflow validator during an outage" })
      .getByRole("radio", { name: "Block" })
      .click();
    await expect(
      page.getByRole("dialog", {
        name: "Block gated transitions during an outage?",
      }),
    ).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

test("outage policy confirmation works with the keyboard only", async ({
  page,
}) => {
  const sets = await adminSettings(page, "dark");
  const panel = page.getByRole("region", {
    name: "Workflow validator during an outage",
  });
  const allow = panel.getByRole("radio", { name: "Allow" });
  await allow.focus();
  // Arrow key moves to Block, which asks for confirmation instead of saving.
  await page.keyboard.press("ArrowRight");
  const dialog = page.getByRole("dialog", {
    name: "Block gated transitions during an outage?",
  });
  await expect(dialog).toBeVisible();
  // Focus starts on the safe choice.
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  // Tab stays inside the modal dialog.
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Block during outages" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  // Escape cancels: nothing saved, focus returns to the control that opened it.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(sets).toEqual([]);
  await expect(allow).toBeChecked();
  const block = panel.getByRole("radio", { name: "Block" });
  await expect(block).toBeFocused();
  // Confirm with the keyboard: Space on Block asks again, Tab, Enter.
  await page.keyboard.press("Space");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("validator-policy-current")).toContainText(
    "During an outage: Block",
  );
  expect(sets).toEqual([{ onOutage: "BLOCK" }]);
});

async function openPassport(page: Page, theme: "light" | "dark") {
  const done = { ...plan, status: "COMPLETED" as const };
  const report = {
    ...passport(done, []),
    gate: {
      status: "CLOSED" as const,
      reason:
        "the option chosen assumes work that Jira does not show as done yet (consumers still depend on it).",
    },
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
  await page.goto(`/tests/core-harness.html?theme=${theme}`);
  await page.getByLabel("Recovery plan ID").fill(done.planId);
  await page
    .getByRole("button", { name: "Recover plan and execution status" })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /^Prevention Passport/ })
    .click();
  await expect(page.getByTestId("passport-gate")).toBeVisible();
}

for (const theme of ["light", "dark"] as const)
  test(`Passport with a closed gate has no axe violations on screen and in print (${theme})`, async ({
    page,
  }) => {
    await openPassport(page, theme);
    // The summary is a labelled region and the gate status is text, not colour only.
    await expect(page.getByRole("region", { name: "In short" })).toContainText(
      "Jira transition: currently refused",
    );
    await expect(page.getByTestId("passport-gate")).toContainText(
      "Closed · the validator refuses it",
    );
    expect(await axe(page)).toEqual([]);
    await page.emulateMedia({ media: "print" });
    expect(await axe(page)).toEqual([]);
  });
