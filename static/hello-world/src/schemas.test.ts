import { describe, it, expect } from "vitest";
import { loadExperience, fixtureClient } from "./adapters";
import {
  type AnticipateClient,
  graphSchema,
} from "./api/provisional-contracts";
function clientWith(request: AnticipateClient["request"]): AnticipateClient {
  return {
    getCapabilities: () => fixtureClient.getCapabilities(),
    getProjects: () => fixtureClient.getProjects(),
    request,
  };
}
describe("shared runtime schemas", () => {
  it("rejects malformed evidence before rendering", async () => {
    const client = clientWith(async (op, input, signal) =>
      op === "getEvidenceGraph"
        ? {
            snapshotId: "demo-auth-v1-2026-11-02",
            services: [{ id: "bad", evidence: "UNVERIFIED" }],
          }
        : fixtureClient.request(op, input, signal),
    );
    await expect(loadExperience(client)).rejects.toThrow();
  });
  it("rejects incomplete comparisons", async () => {
    const client = clientWith(async (op, input, signal) =>
      op === "compareScenarios"
        ? {
            snapshotId: "demo-auth-v1-2026-11-02",
            source: "authored-fixture",
            results: [],
          }
        : fixtureClient.request(op, input, signal),
    );
    await expect(loadExperience(client)).rejects.toThrow("Complete A/B/C");
  });
  it("isolates fixture data from caller mutation", async () => {
    const first = graphSchema.parse(
      await fixtureClient.request("getEvidenceGraph", {}),
    );
    first.services[0].label = "changed";
    expect(
      graphSchema.parse(await fixtureClient.request("getEvidenceGraph", {}))
        .services[0].label,
    ).toBe("Checkout Service");
  });
  it("returns a genuine empty project state without inserting fixtures", async () => {
    const client = {
      ...clientWith((...args) => fixtureClient.request(...args)),
      getProjects: async () => [],
    };
    const data = await loadExperience(client);
    expect(data.kind).toBe("empty");
    expect(data.projects).toEqual([]);
  });
  it("rejects cross-snapshot comparisons", async () => {
    const client = clientWith(async (op, input, signal) => {
      const response = await fixtureClient.request(op, input, signal);
      return op === "compareScenarios"
        ? { ...(response as Record<string, unknown>), snapshotId: "other" }
        : response;
    });
    await expect(loadExperience(client)).rejects.toThrow("Snapshot mismatch");
  });
});

it("rejects mode substitution even when the snapshot ID matches", async () => {
  const client = clientWith(async (op, input, signal) => {
    const response = await fixtureClient.request(op, input, signal);
    return op === "getEvidenceGraph"
      ? { ...(response as Record<string, unknown>), mode: "forge" }
      : response;
  });
  await expect(loadExperience(client)).rejects.toThrow("Data mode mismatch");
});
it("rejects an aborted request without returning fixture data", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    fixtureClient.request(
      "getEvidenceGraph",
      { snapshotId: "demo-auth-v1-2026-11-02" },
      controller.signal,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
});

it("rejects incorrect simulator provenance in fixture mode", async () => {
  const client = clientWith(async (op, input, signal) => {
    const response = await fixtureClient.request(op, input, signal);
    return op === "compareScenarios"
      ? { ...(response as Record<string, unknown>), source: "simulator" }
      : response;
  });
  await expect(loadExperience(client)).rejects.toThrow("Comparison provenance");
});
