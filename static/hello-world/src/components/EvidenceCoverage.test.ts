import { describe, expect, it } from "vitest";
import { coverageRows } from "./EvidenceCoverage";

describe("evidence coverage", () => {
  it("treats absent coverage as Jira only and never claims Teamwork Graph", () => {
    const rows = coverageRows({}, "NOT_CONFIGURED");
    expect(rows.map((r) => [r.name, r.label])).toEqual([
      ["Jira", "Included"],
      ["Teamwork Graph", "Not configured"],
    ]);
    expect(coverageRows({}, "AVAILABLE")[1].label).toBe(
      "Not used in this analysis",
    );
    expect(coverageRows({}, "PERMISSION_REQUIRED")[1].label).toBe(
      "Permission required",
    );
  });
  it("uses backend-reported coverage when present", () => {
    const rows = coverageRows(
      {
        coverage: [
          { source: "JIRA", state: "FULL", detail: "All links read." },
          {
            source: "TEAMWORK_GRAPH",
            state: "PARTIAL",
            detail: "2 of 5 sources readable.",
          },
        ],
      },
      "AVAILABLE",
    );
    expect(rows.map((r) => [r.name, r.label, r.detail])).toEqual([
      ["Jira", "Included", "All links read."],
      ["Teamwork Graph", "Partial coverage", "2 of 5 sources readable."],
    ]);
  });
});
