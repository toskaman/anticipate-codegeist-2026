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
