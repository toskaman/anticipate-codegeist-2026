import { describe, expect, it } from "vitest";
import { comparison } from "../../tests/core-test-data";
import { impactDifference } from "./impactDifference";

describe("pairwise supplied impact records", () => {
  it("names overlap and unique records, deduplicates them, and leaves inputs unchanged", () => {
    const base = comparison.results[0];
    const impact = base.impacts[0];
    const left = {
      ...base,
      impacts: [
        { ...impact, nodeId: "shared" },
        { ...impact, nodeId: "left" },
        { ...impact, nodeId: "left" },
      ],
    };
    const right = {
      ...comparison.results[1],
      impacts: [
        { ...impact, nodeId: "right" },
        { ...impact, nodeId: "shared" },
      ],
      violations: [],
    };
    const before = JSON.stringify([left, right]);
    expect(impactDifference(left, right)).toEqual({
      leftOnly: ["left"],
      rightOnly: ["right"],
      shared: ["shared"],
      leftRules: ["P2"],
      rightRules: [],
    });
    expect(JSON.stringify([left, right])).toBe(before);
  });
  it("refuses comparisons from different snapshots or the same option", () => {
    expect(
      impactDifference(comparison.results[0], {
        ...comparison.results[1],
        snapshotId: "other",
      }),
    ).toBeNull();
    expect(
      impactDifference(comparison.results[0], comparison.results[0]),
    ).toBeNull();
  });
  it("handles empty supplied impacts without inferring a safe outcome", () => {
    const left = { ...comparison.results[0], impacts: [], violations: [] };
    const right = { ...comparison.results[1], impacts: [], violations: [] };
    expect(impactDifference(left, right)).toEqual({
      leftOnly: [],
      rightOnly: [],
      shared: [],
      leftRules: [],
      rightRules: [],
    });
  });
});
