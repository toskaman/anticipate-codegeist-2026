// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CapabilityAvailability } from "@anticipate/contracts";
import RadarAttention from "./RadarAttention";
import { ForgeClient } from "../api/ForgeClient";
import { capabilities, plan, response } from "../../tests/core-test-data";
import { radarAttention } from "../../tests/radar-test-data";
afterEach(cleanup);
it("drops a delayed read from a different plan and leaves loading without assuming a monitoring state", async () => {
  let oldResponse!: (value: unknown) => void;
  const reads: string[] = [];
  const client = new ForgeClient(async (_, input) => {
    const id = String(input.planId);
    reads.push(id);
    if (id === plan.planId)
      return new Promise((resolve) => {
        oldResponse = resolve;
      });
    return response({
      ...radarAttention,
      planId: id,
      needsReview: false,
      items: [],
      note: "Newest plan observations",
    });
  }, 5000);
  const w = {
    client,
    capabilities: CapabilityAvailability.parse({
      ...capabilities,
      operations: [
        ...capabilities.operations,
        "getPlanAttention",
        "checkPlanFreshness",
      ],
    }),
    plan,
    allowed: () => true,
    expired: false,
    evidenceFailure: null,
    busy: "",
    actions: { checkFreshness: async () => {} },
  };
  const view = render(<RadarAttention w={w} planId={plan.planId} />);
  expect(screen.getByRole("status").textContent).toContain("Loading radar");
  expect(screen.queryByText("Listening")).toBeNull();
  view.rerender(
    <RadarAttention
      w={{ ...w, plan: { ...plan, planId: "next-plan" } }}
      planId="next-plan"
    />,
  );
  await screen.findByText("Newest plan observations");
  await act(async () => {
    oldResponse(response({ ...radarAttention, note: "Stale plan response" }));
  });
  expect(screen.queryByText("Stale plan response")).toBeNull();
  expect(screen.getByText("Newest plan observations")).toBeTruthy();
  expect(reads).toEqual([plan.planId, "next-plan"]);
});

function radarWorkflow(overrides: Record<string, unknown> = {}) {
  const client = new ForgeClient(
    async () => response({ ...radarAttention, planId: plan.planId }),
    5000,
  );
  return {
    client,
    capabilities: CapabilityAvailability.parse({
      ...capabilities,
      operations: [
        ...capabilities.operations,
        "getPlanAttention",
        "checkPlanFreshness",
      ],
    }),
    plan,
    allowed: () => true,
    expired: false,
    evidenceFailure: null,
    busy: "",
    actions: { checkFreshness: async () => {} },
    ...overrides,
  };
}

it("keeps 'Needs review' and the re-check button while the evidence has not been re-checked", async () => {
  render(<RadarAttention w={radarWorkflow()} planId={plan.planId} />);
  expect(await screen.findByText("Needs review")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Re-check evidence" }),
  ).toBeTruthy();
  expect(screen.queryByText("Blocked: evidence changed")).toBeNull();
});

it("shows a single blocked state once the re-check confirmed that the evidence changed", async () => {
  render(
    <RadarAttention
      w={radarWorkflow({ plan: { ...plan, status: "EVIDENCE_CHANGED" } })}
      planId={plan.planId}
    />,
  );
  expect(await screen.findByText("Blocked: evidence changed")).toBeTruthy();
  expect(screen.queryByText("Needs review")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Re-check evidence" }),
  ).toBeNull();
  expect(
    screen.queryByText(
      "This decision is blocked. Rebuild the snapshot and review a new plan.",
    ),
  ).toBeNull();
});
