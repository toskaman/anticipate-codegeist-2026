import { describe, expect, it } from "vitest";
import { planStatusDisplay } from "./copy";
import { plan } from "../../tests/core-test-data";

const two = {
  ...plan,
  status: "COMPLETED" as const,
  actions: [plan.actions[0], { ...plan.actions[0], actionId: "record:ABC-2" }],
};
const verified = (actionId: string) => ({
  executionId: `e-${actionId}`,
  planId: plan.planId,
  actionId,
  status: "VERIFIED" as const,
  attempt: 1,
  idempotencyKey: "k",
  resultRef: null,
  error: null,
  updatedAt: "2026-11-02T00:00:00Z",
});

describe("plan status display", () => {
  it("shows Completed only when every proposed action is verified", () => {
    expect(
      planStatusDisplay(two, [
        verified("record:ABC-1"),
        verified("record:ABC-2"),
      ]),
    ).toEqual({ label: "Completed", tone: "success", gap: 0 });
  });
  it("shows the gap when a Completed plan has unverified actions", () => {
    expect(planStatusDisplay(two, [verified("record:ABC-1")])).toEqual({
      label: "Completed · 1 of 2 actions verified",
      tone: "warning",
      gap: 1,
    });
  });
  it("leaves other statuses and unknown records unchanged", () => {
    expect(planStatusDisplay({ ...two, status: "PARTIAL" }, []).label).toBe(
      "Partially completed",
    );
    expect(planStatusDisplay(two, null).label).toBe("Completed");
  });
});
