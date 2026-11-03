// @vitest-environment jsdom
// ORP-23 (#105): pin the WIRING of isPlanStale into the real hook gates
// (canSelectActions, canApprove, canExecute, confirmMutation), not just the
// helper. MOCK_TRANSPORT only.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PreventionPlan } from "@anticipate/contracts";
import { ForgeClient } from "../api/ForgeClient";
import { useCoreWorkflow } from "./useCoreWorkflow";
import {
  capabilities,
  graph,
  passport,
  plan,
  response,
} from "../../tests/core-test-data";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function setup(status: PreventionPlan["status"]) {
  const current: PreventionPlan = { ...plan, status };
  const calls: string[] = [];
  const client = new ForgeClient(async (operation) => {
    calls.push(operation);
    const data =
      operation === "getCapabilities"
        ? capabilities
        : operation === "listProjects"
          ? { items: [], page: { nextCursor: null, totalKnown: 0 } }
          : operation === "approvePlan"
            ? current
            : operation === "getPreventionPassport"
              ? passport(current)
              : operation === "getExecutionStatus"
                ? []
                : operation === "getEvidenceGraph"
                  ? graph
                  : null;
    if (data === null) throw new Error(`unexpected ${operation}`);
    return response(data);
  });
  return { client, calls, current };
}

async function recovered(status: PreventionPlan["status"]) {
  const { client, calls } = setup(status);
  const hook = renderHook(() => useCoreWorkflow(client));
  await waitFor(() => expect(hook.result.current.capabilities).not.toBeNull());
  act(() => hook.result.current.actions.setRecoveryId(plan.planId));
  await act(async () => {
    await hook.result.current.actions.recover();
  });
  await waitFor(() => expect(hook.result.current.plan?.status).toBe(status));
  act(() =>
    hook.result.current.actions.toggleAction(plan.actions[0]!.actionId, true),
  );
  return { hook, calls };
}

describe("hook gates for an INVALIDATED plan", () => {
  it("control: an APPROVED plan can be selected, approved and executed", async () => {
    const { hook } = await recovered("APPROVED");
    expect(hook.result.current.canSelectActions).toBe(true);
    expect(hook.result.current.canApprove).toBe(true);
    expect(hook.result.current.canExecute).toBe(true);
  });

  // canSelectActions and canExecute also require PENDING_APPROVAL/APPROVED,
  // so canApprove and confirmMutation are where the isPlanStale wiring is
  // the only barrier (toggleAction itself is not gated).
  it("blocks selection, approval and execution", async () => {
    const { hook } = await recovered("INVALIDATED");
    expect(hook.result.current.canSelectActions).toBe(false);
    expect(hook.result.current.canApprove).toBe(false);
    expect(hook.result.current.canExecute).toBe(false);
  });

  it("control: confirmMutation reaches approvePlan for an APPROVED plan", async () => {
    const { hook, calls } = await recovered("APPROVED");
    await act(async () => {
      await hook.result.current.actions.confirmMutation("approve");
    });
    expect(calls).toContain("approvePlan");
  });

  it("confirmMutation sends no approve or execute request", async () => {
    const { hook, calls } = await recovered("INVALIDATED");
    await act(async () => {
      await hook.result.current.actions.confirmMutation("approve");
      await hook.result.current.actions.confirmMutation("execute");
    });
    expect(calls).not.toContain("approvePlan");
    expect(calls).not.toContain("executeApprovedPlan");
  });
});
