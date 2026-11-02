import { describe, it, expect } from "vitest";
import {
  scenarioSchema,
  scenarios,
  fixturePassport,
  actionDetails,
  services,
} from "./domain";
describe("authored fixture integrity", () => {
  it("rejects unknown alternatives", () =>
    expect(() => scenarioSchema.parse("D")).toThrow());
  it("keeps unknown blockers even for the safest fixture", () => {
    expect(scenarios.C.violations).toBe(0);
    expect(scenarios.C.blockers).toContain("Support usage unknown");
  });
  it("cannot manufacture approval or verified execution in a fixture report", () => {
    const report = fixturePassport("C");
    expect(report.approvalTimeline).toEqual([]);
    expect(report.execution).toContain("Requires live");
    expect(report.disclosure).toContain("fictional");
  });
  it("every action cites existing evidence", () => {
    for (const action of actionDetails) {
      expect(action.evidenceIds.length).toBeGreaterThan(0);
      for (const id of action.evidenceIds)
        expect(services.some((service) => service.id === id)).toBe(true);
    }
  });
});
