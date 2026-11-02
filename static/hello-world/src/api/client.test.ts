import { describe, it, expect, vi } from "vitest";
import { ForgeClient } from "./ForgeClient";
import { FixtureClient } from "./FixtureClient";
describe("Forge boundary", () => {
  it("does not call guessed resolver names or substitute fixtures", async () => {
    const transport = vi.fn();
    const client = new ForgeClient(transport);
    expect((await client.getCapabilities()).operations).toEqual([]);
    await expect(client.getProjects()).rejects.toMatchObject({
      code: "UNSUPPORTED",
    });
    expect(transport).not.toHaveBeenCalled();
  });
  it("validates real configured project payloads", async () => {
    const client = new ForgeClient(async () => [{ id: "P", name: "Project" }], {
      getProjects: "reviewed.projects",
    });
    expect(await client.getProjects()).toEqual([{ id: "P", name: "Project" }]);
    const invalid = new ForgeClient(async () => [{ id: "P" }], {
      getProjects: "reviewed.projects",
    });
    await expect(invalid.getProjects()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("preserves permission and snapshot errors", async () => {
    for (const code of ["FORBIDDEN", "SNAPSHOT_EXPIRED"]) {
      const client = new ForgeClient(
        async () => {
          throw { code };
        },
        { getProjects: "projects" },
      );
      await expect(client.getProjects()).rejects.toMatchObject({ code });
    }
  });
  it("times out without inventing a successful write", async () => {
    vi.useFakeTimers();
    try {
      const client = new ForgeClient(
        () => new Promise(() => {}),
        { executeApprovedPlan: "execute" },
        50,
      );
      const assertion = expect(
        client.request("executeApprovedPlan", {
          planId: "p",
          version: 1,
          actionIds: ["a"],
          idempotencyKey: "k",
        }),
      ).rejects.toMatchObject({ code: "TIMEOUT" });
      await vi.advanceTimersByTimeAsync(51);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
  it("aborts observation when its consumer unmounts", async () => {
    const controller = new AbortController();
    const client = new ForgeClient(() => new Promise(() => {}), {
      getProjects: "projects",
    });
    const assertion = expect(
      client.getProjects(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await assertion;
  });
  it("rejects malformed capabilities", async () => {
    const client = new ForgeClient(async () => ({ operations: ["invented"] }), {
      getCapabilities: "capabilities",
    });
    await expect(client.getCapabilities()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("fixture client never grants real approvals or execution", async () => {
    const client = new FixtureClient();
    for (const operation of [
      "approvePreventionPlan",
      "executeApprovedPlan",
      "getExecutionStatus",
    ] as const)
      await expect(client.request(operation, {})).rejects.toMatchObject({
        code: "REQUIRES_LIVE_BACKEND",
      });
  });
});

it("never accepts fixture capability or plan payloads as Forge responses", async () => {
  const fixture = new FixtureClient();
  const capabilities = new ForgeClient(() => fixture.getCapabilities(), {
    getCapabilities: "capabilities",
  });
  await expect(capabilities.getCapabilities()).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
  const plans = new ForgeClient(
    () => fixture.request("generatePreventionPlan", {}),
    { generatePreventionPlan: "plan" },
  );
  await expect(
    plans.request("generatePreventionPlan", {}),
  ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
