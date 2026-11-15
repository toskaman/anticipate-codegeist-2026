import { SampleLink } from "@anticipate/contracts";
import { expect, it } from "vitest";

// The replacement link is created as a Jira "Relates" link (production 4.7.0 judge re-run).
// The UI must accept it; a stale installed contract would reject the whole preview as INVALID_RESPONSE.
it("accepts the sample replacement link as 'relates'", () => {
  for (const relation of ["blocks", "relates"]) {
    expect(
      SampleLink.parse({
        from: "api",
        relation,
        to: "v2",
        status: "EXISTS",
      }).relation,
    ).toBe(relation);
  }
  expect(() =>
    SampleLink.parse({
      from: "api",
      relation: "duplicates",
      to: "v2",
      status: "EXISTS",
    }),
  ).toThrow();
});
