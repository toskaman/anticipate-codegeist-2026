import { describe, it, expect } from "vitest";
import { loadExperience, fixtureClient } from "./adapters";
import { planSchema, comparisonsSchema } from "./api/provisional-contracts";
describe("single client integration boundary", () => {
  it("loads deterministic reads through the same snapshot", async () => {
    const data = await loadExperience();
    expect(data.kind).toBe("ready");
    if (data.kind !== "ready") throw new Error("Missing fixture");
    expect(data.snapshot.change).toBe("AUTH-142");
    expect(Object.values(data.scenarios).map((s) => s.violations)).toEqual([
      3, 1, 0,
    ]);
    expect(data.source).toBe("authored-fixture");
  });
  it("refuses fixture mutation and missing project lookups", async () => {
    const plan = planSchema.parse(
      await fixtureClient.request("generatePreventionPlan", {
        snapshotId: "demo-auth-v1-2026-11-02",
      }),
    );
    await expect(
      fixtureClient.request("approvePreventionPlan", {
        planId: plan.planId,
        version: plan.version,
        actionIds: [plan.actions[0].actionId],
      }),
    ).rejects.toMatchObject({ code: "REQUIRES_LIVE_BACKEND" });
    await expect(
      fixtureClient.request("getProjectSnapshot", { projectId: "missing" }),
    ).rejects.toThrow("not found");
  });
  it("keeps comparisons explicitly authored fixtures", async () => {
    const result = comparisonsSchema.parse(
      await fixtureClient.request("compareScenarios", {
        snapshotId: "demo-auth-v1-2026-11-02",
      }),
    );
    expect(result.source).toBe("authored-fixture");
    expect(result.results).toHaveLength(3);
  });
});
