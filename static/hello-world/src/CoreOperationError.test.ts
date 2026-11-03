import { describe, expect, it } from "vitest";
import { guidanceFor, PRIVATE_RECORD_GUIDANCE } from "./CoreOperationError";

const base = { retryable: false, mutation: false };

describe("guidanceFor PERMISSION_DENIED", () => {
  it("explains private records instead of blaming Jira permissions", () => {
    // Hosted refusal seen on the judge site (3 Nov 2026) for another user's plan.
    const g = guidanceFor({
      ...base,
      code: "PERMISSION_DENIED",
      message: "Plans are private to the user who created them.",
    });
    expect(g).toBe(PRIVATE_RECORD_GUIDANCE);
    expect(g).not.toContain("Check your Jira project permissions");
  });
  it("keeps the Jira permission guidance for other refusals", () => {
    expect(
      guidanceFor({
        ...base,
        code: "PERMISSION_DENIED",
        message: "You cannot browse project ABC.",
      }),
    ).toBe(
      "Check your Jira project permissions before trying this request again.",
    );
  });
});
