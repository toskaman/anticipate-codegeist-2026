import { describe, it, expect, vi } from "vitest";
import { ErrorCode } from "@anticipate/contracts";
import { ForgeClient } from "./ForgeClient";
import { FixtureClient } from "./FixtureClient";
import {
  response,
  meta,
  capabilities,
  graph,
  plan,
  passport,
} from "../../tests/core-test-data";

describe("CORE 0.2.0 Forge boundary", () => {
  it("retains evidence refusal details and accepts a blocked Passport", async () => {
    const details = {
      addedEdges: [
        {
          from: "issue:ABC-2",
          to: "issue:ABC-1",
          kind: "DEPENDS_ON",
          status: "CONFIRMED",
        },
      ],
      removedEdges: [],
      becameUnknown: ["issue:ABC-3"],
    };
    await expect(
      new ForgeClient(async () => ({
        ok: false,
        meta,
        error: {
          code: "EVIDENCE_CHANGED",
          message: "New dependency found",
          details,
          requestId: meta.requestId,
          retryable: false,
        },
      })).request("executeApprovedPlan", {
        planId: plan.planId,
        idempotencyKey: "execution-key-0001",
      }),
    ).rejects.toMatchObject({ code: "EVIDENCE_CHANGED", details });
    const blocked = { ...plan, status: "EVIDENCE_CHANGED" as const };
    await expect(
      new ForgeClient(async () => response(passport(blocked))).request(
        "getPreventionPassport",
        { planId: plan.planId },
      ),
    ).resolves.toMatchObject({ plan: { status: "EVIDENCE_CHANGED" } });
  });
  it("refuses sample data for another project before UI consumption", async () => {
    await expect(
      new ForgeClient(async () =>
        response({
          projectKey: "OTHER",
          issueType: "Task",
          canCreate: true,
          missingPermissions: [],
          items: [],
          links: [],
          rootIssueKey: null,
          replacementIssueKey: null,
          note: "preview",
        }),
      ).request("previewSampleProject", { projectKey: "ABC" }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("uses exact resolver keys, validates input and parses a LIVE envelope", async () => {
    const transport = vi.fn(async () => response(capabilities));
    const client = new ForgeClient(transport);
    expect(await client.request("getCapabilities", {})).toEqual(capabilities);
    expect(transport).toHaveBeenCalledWith("getCapabilities", {});
    await expect(
      client.request("executeApprovedPlan", {
        planId: "p",
        idempotencyKey: "short",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("preserves every CORE error code, correlation and retryability", async () => {
    for (const code of ErrorCode.options) {
      const client = new ForgeClient(async () => ({
        ok: false,
        meta,
        error: {
          code,
          message: "Server declined request",
          requestId: meta.requestId,
          retryable: true,
        },
      }));
      await expect(client.request("getCapabilities", {})).rejects.toMatchObject(
        { code, requestId: meta.requestId, retryable: true },
      );
    }
  });
  it("rejects malformed, version-mismatched and demo envelopes without substituting fixtures", async () => {
    for (const payload of [
      capabilities,
      { ...response(capabilities), meta: { ...meta, contractVersion: "9" } },
      { ...response(capabilities), meta: { ...meta, mode: "DEMO_FIXTURE" } },
      response({ operations: [] }),
    ]) {
      await expect(
        new ForgeClient(async () => payload).request("getCapabilities", {}),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
    await expect(
      new ForgeClient(async () =>
        response({ ...graph, mode: "DEMO_FIXTURE" }),
      ).request("getEvidenceGraph", { snapshotId: graph.snapshotId }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("rejects cross-snapshot graphs, invalid endpoints and fixture source references", async () => {
    for (const bad of [
      { ...graph, snapshotId: "other" },
      { ...graph, edges: [{ ...graph.edges[0], to: "missing" }] },
      { ...graph, nodes: [...graph.nodes, graph.nodes[0]] },
      {
        ...graph,
        nodes: graph.nodes.map((n) => ({
          ...n,
          references: [
            {
              sourceSystem: "FIXTURE",
              sourceId: "fake",
              url: null,
              extractor: "test",
              observedAt: meta.generatedAt,
            },
          ],
        })),
      },
    ]) {
      await expect(
        new ForgeClient(async () => response(bad)).request("getEvidenceGraph", {
          snapshotId: graph.snapshotId,
        }),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
  });
  it("validates scenario/hash identity and plan-based recovery", async () => {
    await expect(
      new ForgeClient(async () => response(plan)).request(
        "generatePreventionPlan",
        { snapshotId: plan.snapshotId, scenarioId: "wrong" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(
      new ForgeClient(async () =>
        response({ ...plan, planHash: "changed" }),
      ).request("approvePlan", {
        planId: plan.planId,
        planHash: plan.planHash,
        approvedActionIds: [plan.actions[0].actionId],
        idempotencyKey: "test-approval-key-0001",
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    const transport = vi.fn(async () => response([]));
    await expect(
      new ForgeClient(transport).request("getExecutionStatus", {
        planId: plan.planId,
      }),
    ).resolves.toEqual([]);
    expect(transport).toHaveBeenCalledWith("getExecutionStatus", {
      planId: plan.planId,
    });
    const report = structuredClone(passport());
    report.plan!.snapshotId = "wrong";
    await expect(
      new ForgeClient(async () => response(report)).request(
        "getPreventionPassport",
        { planId: plan.planId },
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("times out without retrying a write", async () => {
    vi.useFakeTimers();
    try {
      const transport = vi.fn(() => new Promise<unknown>(() => {}));
      const pending = expect(
        new ForgeClient(transport, 50).request("executeApprovedPlan", {
          planId: plan.planId,
          idempotencyKey: "test-execution-key-0001",
        }),
      ).rejects.toMatchObject({ code: "TIMEOUT" });
      await vi.advanceTimersByTimeAsync(51);
      await pending;
      expect(transport).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it("aborts observation and reports a Bridge failure explicitly", async () => {
    const controller = new AbortController();
    const assertion = expect(
      new ForgeClient(() => new Promise(() => {})).request(
        "listProjects",
        {},
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await assertion;
    await expect(
      new ForgeClient(async () => {
        throw new Error("host unavailable");
      }).request("listProjects", {}),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
  it("fixture client still refuses all real mutations", async () => {
    for (const operation of [
      "approvePreventionPlan",
      "executeApprovedPlan",
      "getExecutionStatus",
    ] as const)
      await expect(
        new FixtureClient().request(operation, {}),
      ).rejects.toMatchObject({ code: "REQUIRES_LIVE_BACKEND" });
  });
});

it("bounds oversized and deeply nested responses before recursive schema validation", async () => {
  const huge = response({ ...graph, nodes: Array(20001).fill(graph.nodes[0]) });
  await expect(
    new ForgeClient(async () => huge).request("getEvidenceGraph", {
      snapshotId: graph.snapshotId,
    }),
  ).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
    message: expect.stringContaining("collection"),
  });
  let nested: unknown = "leaf";
  for (let i = 0; i < 70; i++) nested = { nested };
  const deep = response({
    ...plan,
    actions: plan.actions.map((a) => ({ ...a, payload: { nested } })),
  });
  await expect(
    new ForgeClient(async () => deep).request("generatePreventionPlan", {
      snapshotId: plan.snapshotId,
      scenarioId: plan.scenarioId,
    }),
  ).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
    message: expect.stringContaining("nesting"),
  });
});
