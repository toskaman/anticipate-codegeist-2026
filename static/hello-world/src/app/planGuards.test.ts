import { describe, expect, it } from "vitest";
import type { Workflow } from "./useCoreWorkflow";
import { isPlanStale, type PlanStatus } from "./planGuards";
import { stageState } from "./journey";

// ORP-22 (#101): INVALIDATED (PR #94) must block every mutation path and
// flag the decision stages, exactly like EVIDENCE_CHANGED.
describe("isPlanStale (approve / select / confirm-execute gate)", () => {
  it("blocks INVALIDATED and EVIDENCE_CHANGED plans", () => {
    expect(isPlanStale("INVALIDATED")).toBe(true);
    expect(isPlanStale("EVIDENCE_CHANGED")).toBe(true);
  });
  it("leaves every other status to the normal rules", () => {
    const others: PlanStatus[] = [
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "EXECUTING",
      "COMPLETED",
      "PARTIAL",
      "FAILED",
      "EXPIRED",
    ];
    for (const s of others) expect(isPlanStale(s)).toBe(false);
    expect(isPlanStale(null)).toBe(false);
    expect(isPlanStale(undefined)).toBe(false);
  });
});

describe("journey attention state", () => {
  const w = (status: PlanStatus) =>
    ({
      plan: { status },
      evidenceFailure: null,
      snapshot: { snapshotId: "s" },
      comparison: { results: [] },
      currentResult: { scenarioId: "C" },
      records: [],
      passport: null,
    }) as unknown as Workflow;
  for (const page of [
    "Decision Firewall",
    "Prevention Plan",
    "Prevention Passport",
  ])
    it(`flags ${page} for an INVALIDATED plan`, () => {
      expect(stageState(w("INVALIDATED"), page)).toBe("attention");
    });
  for (const page of ["Mission Control", "Evidence Graph", "Scenario Lab"])
    it(`does not flag ${page}, an earlier stage`, () => {
      expect(stageState(w("INVALIDATED"), page)).not.toBe("attention");
    });
  for (const page of [
    "Decision Firewall",
    "Prevention Plan",
    "Prevention Passport",
  ])
    it(`does not flag ${page} for an APPROVED plan`, () => {
      expect(stageState(w("APPROVED"), page)).not.toBe("attention");
    });
});
