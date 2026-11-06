import type {
  PlanAttention,
  ReleaseSafetyItem,
  ReleaseVerdict,
} from "@anticipate/contracts";

export type NextActionKind =
  | "recheck-stale"
  | "review-blocked"
  | "resolve-unknowns"
  | "review-change"
  | "reconcile-partial"
  | "execute-approved"
  | "simulate-together"
  | "none";

export interface NextAction {
  kind: NextActionKind;
  label: string;
  detail: string;
}

/**
 * The next permissible action for one release item, derived from recorded state only.
 * Priority: stale evidence first (acting on it would be unsafe), then the release-state
 * order (worst first, same as the backend), then "no action required".
 */
export function nextActionForItem(
  item: Pick<ReleaseSafetyItem, "state" | "decision">,
  attention: Pick<PlanAttention, "needsReview"> | null,
): NextAction {
  if (attention?.needsReview)
    return {
      kind: "recheck-stale",
      label: "Re-check plan freshness",
      detail:
        "New evidence was flagged after the decision. Re-check before any approval or execution.",
    };
  switch (item.state) {
    case "BLOCKED":
      return {
        kind: "review-blocked",
        label: "Review the blocking change",
        detail:
          "Open the change in Scenario Lab, compare alternatives, and record a new decision.",
      };
    case "EVIDENCE_INCOMPLETE":
      return {
        kind: "resolve-unknowns",
        label: "Resolve unknown evidence",
        detail:
          "Unknown relations are listed on the change. Confirm them in Jira; nothing here is assumed safe.",
      };
    case "NEEDS_REVIEW":
      return item.decision
        ? {
            kind: "review-change",
            label: "Review the recorded decision",
            detail:
              "A decision exists but is not complete. Continue the approval and execution steps.",
          }
        : {
            kind: "review-change",
            label: "Analyze and record a decision",
            detail:
              "No decision of yours is recorded for this change. Analyze it first.",
          };
    case "EXECUTION_PARTIAL":
      return {
        kind: "reconcile-partial",
        label: "Reconcile the partial execution",
        detail:
          "Some actions verified and some did not. Re-check freshness, then finish or re-plan.",
      };
    case "APPROVED_NOT_EXECUTED":
      return {
        kind: "execute-approved",
        label: "Execute, or re-check first",
        detail:
          "Actions are approved but nothing ran. Re-check freshness if time has passed, then execute.",
      };
    case "VERIFIED_FOR_RECORDED_SCOPE":
      return {
        kind: "none",
        label: "No action required",
        detail:
          "Verified for the recorded scope. Re-check only if the evidence moves.",
      };
  }
}

export interface ReleaseDigestInput {
  verdict: ReleaseVerdict;
  counts: Partial<Record<ReleaseVerdict, number>>;
  interactions: number;
  unknowns: number;
  stalePlans: number;
}

/** Release-level priority across all changes: the single most urgent next step. */
export function nextActionForRelease(d: ReleaseDigestInput): NextAction {
  if (d.stalePlans > 0)
    return {
      kind: "recheck-stale",
      label: `Re-check ${d.stalePlans} stale plan(s)`,
      detail:
        "Decisions whose evidence moved cannot authorize execution until re-checked.",
    };
  if ((d.counts.BLOCKED ?? 0) > 0)
    return {
      kind: "review-blocked",
      label: "Unblock the release",
      detail:
        "At least one change is blocked. Review it in Scenario Lab before anything ships.",
    };
  if (d.unknowns > 0)
    return {
      kind: "resolve-unknowns",
      label: "Close the evidence gaps",
      detail:
        "Unknown evidence is never safe. Confirm the listed relations in Jira.",
    };
  if (d.interactions > 0)
    return {
      kind: "simulate-together",
      label: "Simulate the interacting changes together",
      detail:
        "Changes interact. A portfolio simulation shows the collision before it ships.",
    };
  if ((d.counts.NEEDS_REVIEW ?? 0) > 0)
    return {
      kind: "review-change",
      label: "Review pending changes",
      detail: "Changes are waiting for a recorded decision.",
    };
  if ((d.counts.EXECUTION_PARTIAL ?? 0) > 0)
    return {
      kind: "reconcile-partial",
      label: "Reconcile partial executions",
      detail: "Some approved work verified and some did not.",
    };
  if ((d.counts.APPROVED_NOT_EXECUTED ?? 0) > 0)
    return {
      kind: "execute-approved",
      label: "Execute approved work",
      detail: "Approvals exist with no verified outcomes yet.",
    };
  return {
    kind: "none",
    label: "Release is ready for its recorded scope",
    detail:
      "Every change verified; nothing awaits action. Re-check on new evidence.",
  };
}
