// Human-readable presentation of CORE 0.2.0 values. These maps change wording only;
// they never change, merge or upgrade the underlying backend value.
import type {
  CapabilityAvailability,
  PreventionPlan,
  ExecutionRecord,
  SimulationResult,
  UncertaintyRecord,
  ProposedAction,
} from "@anticipate/contracts";

export type Tone =
  "neutral" | "accent" | "info" | "success" | "warning" | "danger";

export type Verdict = SimulationResult["verdict"];
export const verdictCopy: Record<
  Verdict,
  { label: string; tone: Tone; headline: string; next: string }
> = {
  BLOCKED: {
    label: "Blocked",
    tone: "danger",
    headline: "Policy blocks this option",
    next: "Resolve the blocking dependencies, or choose another option.",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    tone: "warning",
    headline: "A person must review this option",
    next: "Review the reasons and open questions with the owners before you approve any action.",
  },
  PASS: {
    label: "Pass",
    tone: "success",
    headline: "No policy violation reported",
    next: "Open questions and human approval still apply. Pass does not mean the change is safe.",
  },
};

export type EvidenceStatus = "CONFIRMED" | "INFERRED" | "UNKNOWN";
export const evidenceCopy: Record<
  EvidenceStatus,
  { label: string; tone: Tone; description: string }
> = {
  CONFIRMED: {
    label: "Confirmed",
    tone: "accent",
    description: "Backed by a Jira record the app could read.",
  },
  INFERRED: {
    label: "Inferred",
    tone: "info",
    description: "Suggested by indirect evidence such as a text mention.",
  },
  UNKNOWN: {
    label: "Unknown",
    tone: "warning",
    description: "Not established. Treat as an open question.",
  },
};

export const uncertaintyCopy: Record<UncertaintyRecord["reason"], string> = {
  UNKNOWN_EDGE: "Unknown relationship",
  INFERRED_ONLY: "Inferred evidence only",
  ACCESS_LIMITED: "Access limited",
  TRUNCATED: "Snapshot truncated",
  MISSING_TEST_EVIDENCE: "No verifying test",
};

export const planStatusCopy: Record<
  PreventionPlan["status"],
  { label: string; tone: Tone }
> = {
  EVIDENCE_CHANGED: { label: "Evidence changed · re-review", tone: "warning" },
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_APPROVAL: { label: "Awaiting approval", tone: "warning" },
  APPROVED: { label: "Approved · not executed", tone: "accent" },
  EXECUTING: { label: "Executing", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  PARTIAL: { label: "Partially completed", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

/**
 * Plan status as shown to people. A backend COMPLETED plan in which not every
 * proposed action has a VERIFIED execution record is shown with the gap, so
 * "Completed" never reads as "everything proposed was done". Display only:
 * the backend status is unchanged and still decides what is allowed.
 */
export function planStatusDisplay(
  plan: PreventionPlan,
  records: readonly ExecutionRecord[] | null | undefined,
): { label: string; tone: Tone; gap: number; note?: string } {
  const base = planStatusCopy[plan.status];
  if (!records || !["COMPLETED", "PARTIAL"].includes(plan.status))
    return { ...base, gap: 0 };
  const verified = new Set(
    records.filter((r) => r.status === "VERIFIED").map((r) => r.actionId),
  );
  const attempted = new Set(records.map((r) => r.actionId));
  const total = plan.actions.length;
  const done = plan.actions.filter((a) => verified.has(a.actionId)).length;
  if (done >= total) return { ...base, gap: 0 };
  if (plan.status === "PARTIAL") {
    // CORE (P0 fix): approving only some actions ends in PARTIAL. When every
    // executed action is verified, the rest were simply never approved.
    const allExecutedVerified =
      records.length > 0 && records.every((r) => r.status === "VERIFIED");
    const notApproved = plan.actions.filter(
      (a) => !attempted.has(a.actionId),
    ).length;
    if (allExecutedVerified && notApproved > 0)
      return {
        label: `Approved actions verified · ${notApproved} not approved`,
        tone: "warning",
        gap: total - done,
        note: "Approved actions verified. Remaining actions are not approved, so this decision does not authorize the Jira transition.",
      };
    return { ...base, gap: total - done };
  }
  return {
    label: `Completed · ${done} of ${total} actions verified`,
    tone: "warning",
    gap: total - done,
  };
}

export const executionCopy: Record<
  ExecutionRecord["status"],
  { label: string; tone: Tone; detail: string }
> = {
  PENDING: {
    label: "Pending",
    tone: "neutral",
    detail: "Queued by the backend. Not yet attempted.",
  },
  CLAIMED: {
    label: "In progress",
    tone: "info",
    detail: "Claimed by the backend. Outcome not yet verified.",
  },
  SUBMITTED: {
    label: "Submitted · unverified",
    tone: "warning",
    detail: "Sent to Jira. The backend has not verified the result yet.",
  },
  VERIFIED: {
    label: "Verified",
    tone: "success",
    detail: "The backend read the change back from Jira.",
  },
  FAILED: {
    label: "Failed",
    tone: "danger",
    detail: "The backend reported a failure. No retry was made.",
  },
  SKIPPED: {
    label: "Skipped",
    tone: "neutral",
    detail: "The backend did not apply this action.",
  },
};

export const capabilityStateCopy: Record<
  CapabilityAvailability["jiraRead"],
  { label: string; tone: Tone }
> = {
  AVAILABLE: { label: "Available", tone: "success" },
  NOT_CONFIGURED: { label: "Not configured", tone: "neutral" },
  UNSUPPORTED: { label: "Not supported", tone: "neutral" },
  PERMISSION_REQUIRED: { label: "Permission required", tone: "warning" },
  DISABLED_BY_BUDGET: { label: "Disabled by budget", tone: "neutral" },
};

export const actionTypeCopy: Record<ProposedAction["type"], string> = {
  CREATE_ISSUE: "Create a Jira issue",
  ADD_ISSUE_LINK: "Link Jira issues",
  ADD_COMMENT: "Add a decision comment",
  ADD_LABEL: "Add a Jira label",
};

export const edgeKindCopy: Record<string, string> = {
  DEPENDS_ON: "depends on",
  BLOCKS: "blocks",
  USES: "uses",
  VERIFIED_BY: "is verified by",
  DOCUMENTED_IN: "is documented in",
  AFFECTS: "affects",
};

export const nodeKindCopy: Record<string, string> = {
  ISSUE: "Issue",
  PROJECT: "Project",
  COMPONENT: "Component",
  SERVICE: "Service",
  RELEASE: "Release",
  TEST: "Test",
  DOCUMENT: "Document",
  DECISION: "Decision",
};

/** Scenario wording for the three definitions this frontend sends (see simulationRequest). */
export const scenarioCopy: Record<
  string,
  { letter: string; title: string; does: string }
> = {
  "A-remove-now": {
    letter: "A",
    title: "Remove now",
    does: "Removes the change target immediately.",
  },
  "B-retain-temporarily": {
    letter: "B",
    title: "Retain temporarily",
    does: "Deprecates the target and keeps it in place for now.",
  },
  "C-migrate-then-retire": {
    letter: "C",
    title: "Migrate first",
    does: "Moves uses and depends-on links to the replacement you chose, then removes the target.",
  },
  "A-breaking-upgrade-now": {
    letter: "A",
    title: "Breaking upgrade now",
    does: "Ships the incompatible new version immediately. Every consumer is affected.",
  },
  "B-compatible-upgrade": {
    letter: "B",
    title: "Compatible upgrade",
    does: "Ships the new version behind a backward-compatible shim, so existing contracts keep working.",
  },
  "C-migrate-then-upgrade": {
    letter: "C",
    title: "Move consumers first",
    does: "Moves uses and depends-on links to the new version you chose, then ships the breaking upgrade.",
  },
};
export const scenarioOrder = [
  "A-remove-now",
  "B-retain-temporarily",
  "C-migrate-then-retire",
  "A-breaking-upgrade-now",
  "B-compatible-upgrade",
  "C-migrate-then-upgrade",
];
export const changeKindCopy = {
  retire: {
    title: "Retire or decommission",
    text: "Remove an API, component or service that others may still use.",
    replacementLabel: "Replacement for option C",
    noReplacement: "No replacement — compare A and B only",
    setup:
      "A removes the change target now. B deprecates it and keeps it for now. C migrates its users to a replacement you choose, then removes it.",
  },
  upgrade: {
    title: "Upgrade a dependency",
    text: "Ship a new version of a library, API or service that others consume.",
    replacementLabel: "New version for option C",
    noReplacement: "No new-version record — compare A and B only",
    setup:
      "A ships a breaking upgrade now. B ships it behind a backward-compatible shim. C moves consumers to the new version you choose, then upgrades.",
  },
} as const;
export function scenarioName(id: string) {
  return scenarioCopy[id]?.title ?? id;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Locale-stable timestamp; the raw ISO value stays available in technical details. */
export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
