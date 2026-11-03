// Plan states that must never lead to a new approval or execution in the UI.
// The backend refuses them too (EVIDENCE_CHANGED: drift refusal; INVALIDATED:
// executeApprovedPlan CONFLICT, PR #94); the UI guard only avoids offering them.
import type { PreventionPlan } from "@anticipate/contracts";

export type PlanStatus = PreventionPlan["status"];

/** True when the plan's evidence changed after it was built or approved. */
export function isPlanStale(status: PlanStatus | null | undefined): boolean {
  return status === "EVIDENCE_CHANGED" || status === "INVALIDATED";
}
