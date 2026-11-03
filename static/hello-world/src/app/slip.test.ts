import { describe, expect, it } from "vitest";
import type { SlipSimulation } from "@anticipate/contracts";
import { parseSlipDays, pathText, slipView } from "./slip";

const base: SlipSimulation = {
  issueKey: "ABC-1",
  days: 10,
  assumptions: ["Blocked issues start after their blockers finish."],
  moved: [
    {
      key: "ABC-3",
      oldDue: "2026-12-01",
      newDue: "2026-12-04",
      slipDays: 3,
      path: ["ABC-1", "ABC-2", "ABC-3"],
    },
    {
      key: "ABC-2",
      oldDue: "2026-11-20",
      newDue: "2026-11-30",
      slipDays: 10,
      path: ["ABC-1", "ABC-2"],
    },
  ],
  absorbed: [{ key: "ABC-5", due: "2027-01-15", path: ["ABC-1", "ABC-5"] }],
  unknown: [{ key: "ABC-4", reason: "No due date", path: ["ABC-1", "ABC-4"] }],
  releases: [
    {
      name: "1.0",
      releaseDate: "2026-12-10",
      lateByDays: 0,
      issues: ["ABC-3"],
    },
    {
      name: "2.0",
      releaseDate: "2026-11-25",
      lateByDays: 5,
      issues: ["ABC-2"],
    },
    {
      name: "1.5",
      releaseDate: "2026-11-28",
      lateByDays: 2,
      issues: ["ABC-2"],
    },
  ],
  unreadable: ["ABC-9"],
  truncated: false,
};

describe("slipView", () => {
  it("puts late releases first, most late first, and separates on-time ones", () => {
    const v = slipView(base);
    expect(v.lateReleases.map((r) => r.name)).toEqual(["2.0", "1.5"]);
    expect(v.onTimeReleases.map((r) => r.name)).toEqual(["1.0"]);
  });
  it("orders moved dates by slip size and keeps the path", () => {
    const v = slipView(base);
    expect(v.moved.map((m) => m.key)).toEqual(["ABC-2", "ABC-3"]);
    expect(pathText(v.moved[1].path)).toBe("ABC-1 → ABC-2 → ABC-3");
  });
  it("summarises late releases, moved dates and items it cannot assess", () => {
    expect(slipView(base).headline).toBe(
      "If ABC-1 slips 10 days: 2 releases would be late, 2 due dates would move, 2 items cannot be assessed.",
    );
  });
  it("says plainly when nothing is late or unknown", () => {
    const v = slipView({
      ...base,
      days: 1,
      moved: [],
      unknown: [],
      unreadable: [],
      releases: [],
    });
    expect(v.headline).toBe(
      "If ABC-1 slips 1 day: no release would be late, 0 due dates would move.",
    );
  });
  it("does not mutate the backend result", () => {
    const copy = structuredClone(base);
    slipView(base);
    expect(base).toEqual(copy);
  });
});

describe("parseSlipDays", () => {
  it("accepts whole days from 1 to 365 only", () => {
    expect(parseSlipDays("1")).toBe(1);
    expect(parseSlipDays(" 365 ")).toBe(365);
    for (const bad of ["0", "366", "-3", "2.5", "", "abc", "1e2"])
      expect(parseSlipDays(bad)).toBeNull();
  });
});
