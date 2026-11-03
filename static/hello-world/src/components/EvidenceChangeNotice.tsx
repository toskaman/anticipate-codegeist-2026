import React from "react";
import type { Workflow } from "../app/useCoreWorkflow";
import EvidenceChangeDetails from "../EvidenceChangeDetails";
import { Notice } from "./ui";

export default function EvidenceChangeNotice({ w }: { w: Workflow }) {
  if (
    w.plan?.status !== "EVIDENCE_CHANGED" &&
    w.plan?.status !== "INVALIDATED" &&
    !w.evidenceFailure
  )
    return null;
  const reason =
    w.evidenceFailure?.message ??
    w.passport?.timeline
      .filter(
        (entry) =>
          entry.event.startsWith("Evidence changed") ||
          entry.event.startsWith("Plan invalidated"),
      )
      .slice(-1)[0]?.event;
  return (
    <Notice
      tone="warning"
      role="alert"
      title={
        <span role="heading" aria-level={2}>
          Evidence changed — this plan cannot execute
        </span>
      }
    >
      <p>{reason ?? "The evidence changed since this plan was built."}</p>
      <p>
        Rebuild the snapshot, compare again and review a new plan. This plan
        cannot be retried or re-approved.
      </p>
      {w.evidenceFailure && (
        <EvidenceChangeDetails details={w.evidenceFailure.details} />
      )}
      <button
        className="ax-btn"
        disabled={!!w.busy}
        onClick={w.actions.rebuildSnapshot}
      >
        Rebuild snapshot
      </button>
    </Notice>
  );
}
