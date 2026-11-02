// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import ActionReview from "./ActionReview";
import { FixtureClient } from "./api/FixtureClient";
import { type AnticipateClient, planSchema } from "./api/provisional-contracts";
afterEach(cleanup);
async function setup() {
  const fixture = new FixtureClient();
  const plan = planSchema.parse(
    await fixture.request("generatePreventionPlan", {}),
  );
  plan.mode = "forge";
  const request = vi.fn(async (operation: string) => {
    if (operation === "generatePreventionPlan") return plan;
    if (operation === "approvePreventionPlan")
      return {
        ...plan,
        actions: plan.actions.map((a) => ({ ...a, approval: "APPROVED" })),
      };
    if (
      operation === "executeApprovedPlan" ||
      operation === "getExecutionStatus"
    )
      return {
        executionId: "exec-1",
        planId: plan.planId,
        status: "PARTIAL",
        actions: [
          {
            actionId: plan.actions[0].actionId,
            status: "VERIFIED",
            attempt: 1,
            jiraIssueUrl: null,
            error: null,
          },
          {
            actionId: plan.actions[1].actionId,
            status: "FAILED",
            attempt: 1,
            jiraIssueUrl: null,
            error: "Permission changed",
          },
        ],
      };
    throw new Error("Unsupported test operation");
  });
  const client: AnticipateClient = {
    getCapabilities: () => fixture.getCapabilities(),
    getProjects: () => fixture.getProjects(),
    request,
  };
  return { plan, request, client };
}
// jsdom has no native dialog top layer. Browser focus behavior is separately tested with Playwright.
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  value() {
    this.open = true;
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  value() {
    this.open = false;
  },
});
describe("action-level review with MOCK backend responses", () => {
  it("does not mutate on load and submits selected IDs only", async () => {
    const { plan, client, request } = await setup();
    render(<ActionReview client={client} snapshotId={plan.snapshotId} />);
    await screen.findByText("Review individual actions");
    expect(request.mock.calls.map((c) => c[0])).toEqual([
      "generatePreventionPlan",
    ]);
    fireEvent.click(screen.getByLabelText(`Select ${plan.actions[0].title}`));
    fireEvent.click(screen.getByText("Request approval for selected actions"));
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Confirm"));
    await screen.findByText(
      "Backend approval state received. No execution was started.",
    );
    expect(request).toHaveBeenCalledWith(
      "approvePreventionPlan",
      {
        planId: plan.planId,
        version: 1,
        actionIds: [plan.actions[0].actionId],
      },
      expect.any(AbortSignal),
    );
    expect(request.mock.calls.some((c) => c[0] === "executeApprovedPlan")).toBe(
      false,
    );
  });
  it("renders partial outcomes and never automatically retries failed writes", async () => {
    const { plan, client, request } = await setup();
    render(<ActionReview client={client} snapshotId={plan.snapshotId} />);
    await screen.findByText("Review individual actions");
    fireEvent.click(screen.getByLabelText(`Select ${plan.actions[0].title}`));
    fireEvent.click(screen.getByText("Request approval for selected actions"));
    fireEvent.click(screen.getByText("Confirm"));
    await screen.findByText(
      "Backend approval state received. No execution was started.",
    );
    fireEvent.click(screen.getByText("Execute backend-approved actions"));
    fireEvent.click(screen.getByText("Confirm"));
    await screen.findByText("Execution PARTIAL");
    expect(screen.getByText(/Permission changed/)).toBeTruthy();
    expect(
      (
        screen.getByText(
          "Execute backend-approved actions",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      request.mock.calls.filter((c) => c[0] === "executeApprovedPlan"),
    ).toHaveLength(1);
  });
  it("rejects unsafe evidence URLs", async () => {
    const { plan } = await setup();
    const invalid = structuredClone(plan);
    invalid.actions[0].evidence[0].url = "javascript:alert(1)";
    expect(planSchema.safeParse(invalid).success).toBe(false);
  });
  it("blocks stale snapshot plans before any approval", async () => {
    const { client } = await setup();
    render(<ActionReview client={client} snapshotId="different-snapshot" />);
    await screen.findByText(
      "Snapshot changed. Reload this plan before approving.",
    );
    expect(
      (
        screen.getByText(
          "Request approval for selected actions",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
