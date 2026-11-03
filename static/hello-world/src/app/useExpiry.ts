// Snapshot expiry and freshness guards, extracted from useCoreWorkflow.
// Pure helpers carry the exact legacy semantics; useExpired keeps its
// single re-render at the expiry instant.
import { useEffect, useReducer } from "react";
import { CoreClientError } from "../api/ForgeClient";

/** Pure core of useExpired: true once `expiresAt` has passed. */
export function isExpiredAt(expiresAt: string | null | undefined): boolean {
  const at = expiresAt ? Date.parse(expiresAt) : NaN;
  return Number.isFinite(at) ? at <= Date.now() : false;
}

/**
 * Mutation guard: throws SNAPSHOT_EXPIRED when there is no snapshot or it
 * has expired. An unparsable expiresAt does not throw, matching the legacy
 * `fresh()` guard (Date.parse yields NaN, and NaN <= now is false).
 */
export function assertSnapshotFresh(
  snapshot: { expiresAt: string } | null,
): void {
  if (!snapshot || Date.parse(snapshot.expiresAt) <= Date.now())
    throw new CoreClientError(
      "SNAPSHOT_EXPIRED",
      "Reload a snapshot and compare scenarios before reviewing a new plan.",
    );
}

/**
 * True once `expiresAt` has passed. Re-renders once at the expiry instant instead of
 * re-rendering the whole workspace every second (the previous 1 s clock).
 */
export function useExpired(expiresAt: string | null | undefined) {
  const [tick, bump] = useReducer((x: number) => x + 1, 0);
  const at = expiresAt ? Date.parse(expiresAt) : NaN;
  const expired = Number.isFinite(at) ? at <= Date.now() : false;
  useEffect(() => {
    if (!Number.isFinite(at)) return;
    const remaining = at - Date.now();
    if (remaining <= 0) return;
    // setTimeout overflows above 2^31-1 ms; re-arm for very distant expiries.
    const timer = setTimeout(bump, Math.min(remaining + 25, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [at, tick]);
  return expired;
}
