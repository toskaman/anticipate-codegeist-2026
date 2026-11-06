import { describe, expect, it } from "vitest";
import type { ReleaseVerdict } from "@anticipate/contracts";
import {
  nextActionForItem,
  nextActionForRelease,
  type ReleaseDigestInput,
} from "./releaseNext";

const zero = (): Record<ReleaseVerdict, number> => ({
  BLOCKED: 0,
  EVIDENCE_INCOMPLETE: 0,
  NEEDS_REVIEW: 0,
  EXECUTION_PARTIAL: 0,
  APPROVED_NOT_EXECUTED: 0,
  VERIFIED_FOR_RECORDED_SCOPE: 0,
});
const digest = (over: Partial<ReleaseDigestInput>): ReleaseDigestInput => ({
  verdict: "NEEDS_REVIEW",
  counts: zero(),
  interactions: 0,
  unknowns: 0,
  stalePlans: 0,
  ...over,
});

describe("nextActionForItem", () => {
  it.each([
    ["BLOCKED", "review-blocked"],
    ["EVIDENCE_INCOMPLETE", "resolve-unknowns"],
    ["NEEDS_REVIEW", "review-change"],
    ["EXECUTION_PARTIAL", "reconcile-partial"],
    ["APPROVED_NOT_EXECUTED", "execute-approved"],
    ["VERIFIED_FOR_RECORDED_SCOPE", "none"],
  ] as const)("maps %s to %s", (state, kind) => {
    expect(nextActionForItem({ state, decision: null }, null).kind).toBe(kind);
  });
  it("stale evidence outranks every state", () => {
    for (const state of Object.keys(zero()) as ReleaseVerdict[]) {
      expect(
        nextActionForItem({ state, decision: null }, { needsReview: true })
          .kind,
      ).toBe("recheck-stale");
    }
  });
  it("distinguishes missing decisions from incomplete ones", () => {
    expect(
      nextActionForItem({ state: "NEEDS_REVIEW", decision: null }, null).label,
    ).toMatch(/Analyze/);
    expect(
      nextActionForItem(
        { state: "NEEDS_REVIEW", decision: { planId: "p" } as never },
        null,
      ).label,
    ).toMatch(/Continue|recorded decision/);
  });
});

describe("nextActionForRelease", () => {
  it("prioritizes stale plans, then blocked, unknowns, interactions", () => {
    expect(
      nextActionForRelease(
        digest({ stalePlans: 2, counts: { ...zero(), BLOCKED: 3 } }),
      ).kind,
    ).toBe("recheck-stale");
    expect(
      nextActionForRelease(
        digest({ counts: { ...zero(), BLOCKED: 1 }, interactions: 4 }),
      ).kind,
    ).toBe("review-blocked");
    expect(
      nextActionForRelease(digest({ unknowns: 2, interactions: 4 })).kind,
    ).toBe("resolve-unknowns");
    expect(nextActionForRelease(digest({ interactions: 2 })).kind).toBe(
      "simulate-together",
    );
  });
  it("reports ready only when nothing awaits action", () => {
    expect(
      nextActionForRelease(
        digest({
          verdict: "VERIFIED_FOR_RECORDED_SCOPE",
          counts: { ...zero(), VERIFIED_FOR_RECORDED_SCOPE: 5 },
        }),
      ).kind,
    ).toBe("none");
  });
});
