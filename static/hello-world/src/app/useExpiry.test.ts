// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoreClientError } from "../api/ForgeClient";
import { assertSnapshotFresh, isExpiredAt, useExpired } from "./useExpiry";

const NOW = new Date("2026-11-03T12:00:00.000Z");
const PAST = "2026-11-03T11:59:59.000Z";
const FUTURE = "2026-11-03T12:00:10.000Z";

function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CoreClientError);
    return (e as CoreClientError).code;
  }
  throw new Error("expected CoreClientError");
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("isExpiredAt freshness guard", () => {
  it("reports a past timestamp as expired", () => {
    vi.setSystemTime(NOW);
    expect(isExpiredAt(PAST)).toBe(true);
  });
  it("reports the exact expiry instant as expired", () => {
    vi.setSystemTime(NOW);
    expect(isExpiredAt(NOW.toISOString())).toBe(true);
  });
  it("reports a future timestamp as fresh", () => {
    vi.setSystemTime(NOW);
    expect(isExpiredAt(FUTURE)).toBe(false);
  });
  it("treats a missing or unparsable timestamp as not expired", () => {
    vi.setSystemTime(NOW);
    expect(isExpiredAt(null)).toBe(false);
    expect(isExpiredAt(undefined)).toBe(false);
    expect(isExpiredAt("not-a-date")).toBe(false);
  });
});

describe("assertSnapshotFresh mutation guard", () => {
  it("throws SNAPSHOT_EXPIRED when there is no snapshot", () => {
    vi.setSystemTime(NOW);
    expect(codeOf(() => assertSnapshotFresh(null))).toBe("SNAPSHOT_EXPIRED");
  });
  it("throws SNAPSHOT_EXPIRED with the workflow message when expired", () => {
    vi.setSystemTime(NOW);
    expect(codeOf(() => assertSnapshotFresh({ expiresAt: PAST }))).toBe(
      "SNAPSHOT_EXPIRED",
    );
    expect(() => assertSnapshotFresh({ expiresAt: PAST })).toThrowError(
      "Reload a snapshot and compare scenarios before reviewing a new plan.",
    );
  });
  it("does not throw for a fresh snapshot", () => {
    vi.setSystemTime(NOW);
    expect(() => assertSnapshotFresh({ expiresAt: FUTURE })).not.toThrowError();
  });
  it("does not throw for an unparsable expiresAt", () => {
    vi.setSystemTime(NOW);
    expect(() =>
      assertSnapshotFresh({ expiresAt: "not-a-date" }),
    ).not.toThrowError();
  });
});

describe("useExpired", () => {
  it("returns true for a past expiry", () => {
    vi.setSystemTime(NOW);
    const { result } = renderHook(() => useExpired(PAST));
    expect(result.current).toBe(true);
  });
  it("returns false without an expiry", () => {
    vi.setSystemTime(NOW);
    const { result } = renderHook(() => useExpired(null));
    expect(result.current).toBe(false);
  });
  it("flips to true once the expiry instant passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { result } = renderHook(() => useExpired(FUTURE));
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(10_000 + 50);
    });
    expect(result.current).toBe(true);
  });
});
