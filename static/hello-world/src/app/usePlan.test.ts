// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ExecutionRecord,
  PreventionPassport,
  PreventionPlan,
} from "@anticipate/contracts";
import { usePlanState } from "./usePlan";

afterEach(cleanup);

const fakePlan = {
  planId: "plan-1",
  actions: [{ actionId: "a-1" }, { actionId: "a-2" }],
} as unknown as PreventionPlan;
const fakePassport = {
  approvals: [{ actionIds: ["a-1", "a-9"] }],
} as unknown as PreventionPassport;
const fakeRecords = [{ actionId: "a-1" }] as unknown as ExecutionRecord[];

describe("usePlanState", () => {
  it("starts with no plan, passport, selection or evidence failure", () => {
    const { result } = renderHook(() => usePlanState());
    expect(result.current.plan).toBeNull();
    expect(result.current.passport).toBeNull();
    expect(result.current.selected).toEqual([]);
    expect(result.current.records).toBeNull();
    expect(result.current.evidenceFailure).toBeNull();
    expect(result.current.attempted).toBe(false);
    expect(result.current.approvalUncertain).toBe(false);
    expect(result.current.confirmation).toBeNull();
  });
  it("clearPlan resets plan, selection, records and confirmation", () => {
    const { result } = renderHook(() => usePlanState());
    act(() => {
      result.current.setPlan(fakePlan);
      result.current.setPassport(fakePassport);
      result.current.setSelected(["a-1"]);
      result.current.setRecords(fakeRecords);
      result.current.setAttempted(true);
      result.current.setApprovalUncertain(true);
      result.current.setConfirmation("approve");
      result.current.setEvidenceFailure({
        message: "changed",
        code: "EVIDENCE_CHANGED",
        retryable: false,
        mutation: false,
      });
    });
    act(() => {
      result.current.clearPlan();
    });
    expect(result.current.plan).toBeNull();
    expect(result.current.passport).toBeNull();
    expect(result.current.selected).toEqual([]);
    expect(result.current.records).toBeNull();
    expect(result.current.evidenceFailure).toBeNull();
    expect(result.current.attempted).toBe(false);
    expect(result.current.approvalUncertain).toBe(false);
    expect(result.current.confirmation).toBeNull();
  });
  it("approvedIds keeps only approvals that match plan actions", () => {
    const { result } = renderHook(() => usePlanState());
    act(() => {
      result.current.setPlan(fakePlan);
      result.current.setPassport(fakePassport);
    });
    expect([...result.current.approvedIds]).toEqual(["a-1"]);
  });
  it("approvedIds is empty without a passport", () => {
    const { result } = renderHook(() => usePlanState());
    act(() => {
      result.current.setPlan(fakePlan);
    });
    expect(result.current.approvedIds.size).toBe(0);
  });
});
