import { describe, it, expect } from "vitest";
import { loadExperience, localAdapter } from "./adapters";
describe("runtime adapter payload validation", () => {
  it("rejects malformed evidence instead of rendering it", async () => {
    const bad = {
      ...localAdapter,
      getEvidenceGraph: async () => [
        {
          id: "x",
          label: "bad",
          evidence: "UNVERIFIED",
          source: "",
          detail: "",
        },
      ],
    } as unknown as typeof localAdapter;
    await expect(loadExperience(bad)).rejects.toThrow();
  });
  it("rejects missing scenario comparisons", async () => {
    await expect(
      loadExperience({ ...localAdapter, compareScenarios: async () => [] }),
    ).rejects.toThrow("Complete A/B/C");
  });
  it("isolates fixture reads from caller mutation", async () => {
    const evidence = await localAdapter.getEvidenceGraph();
    evidence[0].label = "changed";
    expect((await localAdapter.getEvidenceGraph())[0].label).toBe(
      "Checkout Service",
    );
  });
  it("assembles the complete local snapshot through the adapter", async () => {
    const data = await loadExperience();
    expect(data.projects).toHaveLength(1);
    expect(data.services).toHaveLength(5);
    expect(Object.keys(data.scenarios)).toEqual(["A", "B", "C"]);
    expect(data.capabilities.mode).toBe("demo");
  });
});
