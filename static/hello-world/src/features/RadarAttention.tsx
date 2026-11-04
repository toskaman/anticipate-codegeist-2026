import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PlanAttention } from "@anticipate/contracts";
import { CoreClientError, type ForgeClient } from "../api/ForgeClient";
import type { Workflow } from "../app/useCoreWorkflow";
import { isPlanStale } from "../app/planGuards";
import { formatTime } from "../app/copy";
import { Badge, Notice, Panel } from "../components/ui";

const reasons: Record<PlanAttention["monitoring"]["reasons"][number], string> =
  {
    NO_QUERY: "This deployment cannot retrieve radar events.",
    NOT_INDEXED: "This plan has no indexed issue coverage.",
    PARTIAL_INDEX: "Some issues in this plan are outside radar coverage.",
    INDEX_WRITE_FAILED: "Some issue coverage could not be recorded.",
    FANOUT_CAPPED: "An event affected more plans than the radar could notify.",
    INVALID_EVENT: "An event could not be interpreted.",
    STORAGE_ERROR: "Radar observations could not be stored or retrieved.",
  };
const eventType = {
  LINK_CREATED: "Link created",
  LINK_DELETED: "Link deleted",
  ISSUE_DELETED: "Issue deleted",
};

type ReaderProps = {
  client: ForgeClient;
  planId: string;
  onRecheck: () => Promise<unknown> | undefined;
  disabledReason: string;
  historical: boolean;
};

function AttentionReader({
  client,
  planId,
  onRecheck,
  disabledReason,
  historical,
}: ReaderProps) {
  const [attention, setAttention] = useState<PlanAttention | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const id = useId();
  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setAttention(null);
    setError("");
    try {
      const next = await client.request(
        "getPlanAttention",
        { planId },
        current.signal,
      );
      if (!current.signal.aborted) setAttention(next);
    } catch (e) {
      if (!current.signal.aborted)
        setError(
          e instanceof CoreClientError
            ? e.message
            : "Radar observations could not be loaded. No monitoring state is assumed.",
        );
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [client, planId]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!checking && !loading && restoreFocus.current) {
      restoreFocus.current = false;
      refreshButton.current?.focus();
    }
  }, [checking, loading]);
  async function recheck() {
    if (loading || checking || disabledReason) return;
    setChecking(true);
    try {
      // The workflow owns drift guards: do not bypass them with a direct RPC.
      await onRecheck();
      if (mounted.current) await load();
    } catch (e) {
      if (mounted.current) {
        setAttention(null);
        setError(
          e instanceof Error
            ? e.message
            : "Evidence re-check did not complete. No freshness is assumed.",
        );
      }
    } finally {
      if (mounted.current) {
        restoreFocus.current = true;
        setChecking(false);
      }
    }
  }
  const state = attention?.monitoring.state;
  return (
    <Panel
      title="Decision Radar attention"
      id={`${id}-title`}
      className="ax-radar"
      description={
        historical
          ? "Current backend attention, separate from this recorded Passport. It does not change the historical record or its export."
          : "Backend event hints for this plan. They are not a freshness verdict or authorization to act."
      }
    >
      <p className="ax-small ax-muted">
        This screen reads the latest stored hints when opened or refreshed.
        Event delivery may be delayed; it is not a live connection or complete
        Jira coverage.
      </p>
      <div role="status" aria-live="polite">
        {checking
          ? "Re-checking evidence, then reloading radar attention…"
          : loading
            ? "Loading radar attention…"
            : ""}
      </div>
      {error && (
        <div role="alert">
          <p className="ax-error-text">{error}</p>
          <p>
            No radar result is shown. Approval and execution still perform their
            own server checks.
          </p>
        </div>
      )}
      {attention && (
        <section
          aria-label="Radar observations"
          aria-busy={loading || checking}
        >
          <Badge
            tone={
              state === "DEGRADED"
                ? "warning"
                : state === "ACTIVE"
                  ? "info"
                  : "neutral"
            }
          >
            {state === "ACTIVE"
              ? "Listening"
              : state === "DEGRADED"
                ? "Monitoring degraded"
                : "Radar not available for this plan"}
          </Badge>
          {state === "ACTIVE" && (
            <p className="ax-small ax-muted">
              Listening is the backend's reported monitoring state, not proof of
              complete event delivery.
            </p>
          )}
          {attention.monitoring.reasons.length > 0 && (
            <ul>
              {attention.monitoring.reasons.map((reason) => (
                <li key={reason}>{reasons[reason]}</li>
              ))}
            </ul>
          )}
          {attention.coverage && (
            <p>
              {attention.coverage.indexed} issue records indexed;{" "}
              {attention.coverage.unindexed} not indexed.
            </p>
          )}
          <p>{attention.note}</p>
          <p>
            {attention.monitoring.lastObservedAt ? (
              <>
                <span>
                  {!attention.needsReview
                    ? "No radar alerts since "
                    : "Last radar observation: "}
                </span>
                <time dateTime={attention.monitoring.lastObservedAt}>
                  {formatTime(attention.monitoring.lastObservedAt)}
                </time>
                {!attention.needsReview &&
                  " are listed in this response. Absence of alerts does not establish freshness."}
              </>
            ) : (
              "No radar observation time supplied. Absence of alerts does not establish freshness."
            )}
          </p>
          {attention.needsReview ? (
            <Notice tone="warning" title="Needs review">
              Relevant event hints were reported. Re-check the actual evidence
              before reviewing this decision again.
            </Notice>
          ) : (
            <p className="ax-muted">
              No review hints reported in this response. No conclusion about the
              decision is inferred.
            </p>
          )}
          {attention.items.length > 0 ? (
            <ol className="ax-radar__events">
              {attention.items.map((item, index) => (
                <li key={`${item.factId}-${index}`}>
                  <strong>{eventType[item.type]}</strong>
                  {item.linkType && <span> · {item.linkType}</span>}
                  <p>
                    Occurred{" "}
                    <time dateTime={item.occurredAt}>
                      {formatTime(item.occurredAt)}
                    </time>{" "}
                    · observed{" "}
                    <time dateTime={item.observedAt}>
                      {formatTime(item.observedAt)}
                    </time>
                    .
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            attention.needsReview && (
              <p>
                Event details were not supplied. The review hint remains
                unresolved.
              </p>
            )
          )}
          {attention.truncated && (
            <Notice tone="warning" title="More events exist">
              This response does not include every recorded event. The list is
              incomplete.
            </Notice>
          )}
          {attention.clearedAt && (
            <p className="ax-small ax-muted">
              The backend last cleared this plan's hints at{" "}
              <time dateTime={attention.clearedAt}>
                {formatTime(attention.clearedAt)}
              </time>
              . This does not replace a new freshness check.
            </p>
          )}
        </section>
      )}
      <div className="ax-radar__actions">
        {attention?.needsReview && (
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            disabled={!!disabledReason || loading || checking}
            aria-describedby={disabledReason ? `${id}-disabled` : undefined}
            onClick={() => void recheck()}
          >
            Re-check evidence
          </button>
        )}
        <button
          ref={refreshButton}
          type="button"
          className="ax-btn ax-btn--ghost"
          disabled={loading || checking}
          onClick={() => {
            restoreFocus.current = true;
            void load();
          }}
        >
          {error ? "Retry radar read" : "Refresh radar"}
        </button>
      </div>
      {attention?.needsReview && disabledReason && (
        <p id={`${id}-disabled`} className="ax-small ax-muted">
          {disabledReason}
        </p>
      )}
    </Panel>
  );
}

export default function RadarAttention({
  w,
  planId,
  historical = false,
}: {
  w: Pick<
    Workflow,
    | "client"
    | "capabilities"
    | "plan"
    | "allowed"
    | "expired"
    | "evidenceFailure"
    | "busy"
  > & { actions: Pick<Workflow["actions"], "checkFreshness"> };
  planId: string | undefined;
  historical?: boolean;
}) {
  if (!planId || !w.capabilities?.operations.includes("getPlanAttention"))
    return null;
  const disabledReason =
    w.plan?.planId !== planId
      ? "Recover this plan before re-checking its evidence."
      : !w.allowed("checkPlanFreshness")
        ? "Evidence re-check is not offered by this backend."
        : w.expired
          ? "Analyze again to review fresh evidence; this snapshot expired."
          : w.evidenceFailure || isPlanStale(w.plan.status)
            ? "This decision is blocked. Rebuild the snapshot and review a new plan."
            : w.busy
              ? "Another workflow operation is in progress."
              : "";
  return (
    <AttentionReader
      key={planId}
      client={w.client}
      planId={planId}
      onRecheck={w.actions.checkFreshness}
      disabledReason={disabledReason}
      historical={historical}
    />
  );
}
