import { describe, expect, it } from "vitest";
import { CoreClientError } from "../api/ForgeClient";
import { isDefinitiveRefusal } from "./useCoreWorkflow";

describe("isDefinitiveRefusal", () => {
  it("accepts backend refusals that carry a requestId", () => {
    expect(
      isDefinitiveRefusal(
        new CoreClientError("PERMISSION_DENIED", "no", "req-1"),
      ),
    ).toBe(true);
    expect(
      isDefinitiveRefusal(new CoreClientError("CONFLICT", "no", "req-1")),
    ).toBe(true);
  });
  it("never treats unknown outcomes as refusals", () => {
    expect(isDefinitiveRefusal(new CoreClientError("TIMEOUT", "lost"))).toBe(
      false,
    );
    expect(
      isDefinitiveRefusal(new CoreClientError("INTERNAL", "x", "req-1")),
    ).toBe(false);
    expect(
      isDefinitiveRefusal(new CoreClientError("PERMISSION_DENIED", "no", null)),
    ).toBe(false);
    expect(isDefinitiveRefusal(new Error("boom"))).toBe(false);
  });
});
