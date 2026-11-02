import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type AnticipateClient,
  planSchema,
  type ReviewPlan,
  type Execution,
  executionSchema,
} from "./api/provisional-contracts";
import { useResource } from "./useResource";
import ConfirmDialog from "./ConfirmDialog";
export default function ActionReview({
  client,
  snapshotId,
}: {
  client: AnticipateClient;
  snapshotId: string;
}) {
  const load = useCallback(
    async (signal?: AbortSignal) =>
      planSchema.parse(
        await client.request("generatePreventionPlan", { snapshotId }, signal),
      ),
    [client, snapshotId],
  );
  const resource = useResource(load);
  const [selected, setSelected] = useState<string[]>([]);
  const [updated, setUpdated] = useState<ReviewPlan | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<
    "approve" | "execute" | null
  >(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    setUpdated(null);
    setExecution(null);
    setSelected([]);
    setRequestKey(null);
    setNotice("");
    setBusy(false);
    pending.current = false;
    return () => {
      alive.current = false;
      mutation.current?.abort();
    };
  }, [client, snapshotId]);
  async function run(
    operation:
      "approvePreventionPlan" | "executeApprovedPlan" | "getExecutionStatus",
  ) {
    if (resource.status !== "ready" || pending.current) return;
    const plan = updated ?? resource.data;
    if (plan.snapshotId !== snapshotId) {
      setNotice("Snapshot changed. Refresh the plan before approval.");
      return;
    }
    pending.current = true;
    setBusy(true);
    const controller = new AbortController();
    mutation.current = controller;
    try {
      const approved = plan.actions
        .filter((action) => action.approval === "APPROVED")
        .map((action) => action.actionId);
      const key =
        operation === "executeApprovedPlan" ? crypto.randomUUID() : requestKey;
      if (operation === "executeApprovedPlan") setRequestKey(key);
      const input =
        operation === "getExecutionStatus"
          ? execution
            ? { executionId: execution.executionId }
            : { idempotencyKey: key }
          : {
              planId: plan.planId,
              version: plan.version,
              actionIds:
                operation === "approvePreventionPlan" ? selected : approved,
              ...(operation === "executeApprovedPlan"
                ? { idempotencyKey: key }
                : {}),
            };
      const response = await client.request(
        operation,
        input,
        controller.signal,
      );
      if (!alive.current || controller.signal.aborted) return;
      if (operation === "approvePreventionPlan") {
        const next = planSchema.parse(response);
        if (next.planId !== plan.planId || next.snapshotId !== snapshotId)
          throw new Error(
            "Approval response belongs to a different plan or snapshot",
          );
        setUpdated(next);
        setSelected([]);
        setNotice("Backend approval state received. No execution was started.");
      } else {
        const next = executionSchema.parse(response);
        if (next.planId !== plan.planId)
          throw new Error("Execution response belongs to a different plan");
        setExecution(next);
        setNotice(
          "Backend execution status received. Only VERIFIED actions count as verified outcomes.",
        );
      }
    } catch (error) {
      if (alive.current && !controller.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : "Operation could not be verified",
        );
    } finally {
      if (alive.current && !controller.signal.aborted) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  if (resource.status === "loading")
    return <p role="status">Loading action review…</p>;
  if (resource.status === "error")
    return (
      <section className="panel" role="alert">
        <h2>Plan unavailable</h2>
        <p>{resource.error}</p>
        <button onClick={resource.retry}>Retry plan</button>
      </section>
    );
  const plan = updated ?? resource.data;
  const approved = plan.actions.filter(
    (action) => action.approval === "APPROVED",
  );
  const stale = plan.snapshotId !== snapshotId;
  return (
    <section className="panel" aria-label="Action review">
      <h2>Review individual actions</h2>
      <p>
        Snapshot: {plan.snapshotId} · Plan version {plan.version}
      </p>
      {plan.mode === "fixture" && (
        <p className="disclosure">
          MOCK fixture review — live approval and execution require an
          authenticated backend.
        </p>
      )}
      {stale && (
        <p role="alert">Snapshot changed. Reload this plan before approving.</p>
      )}
      {plan.actions.map((action) => (
        <article className="action" key={action.actionId}>
          <input
            type="checkbox"
            aria-label={`Select ${action.title}`}
            disabled={busy || stale || action.approval !== "REQUIRED"}
            checked={selected.includes(action.actionId)}
            onChange={(event) =>
              setSelected((previous) =>
                event.target.checked
                  ? [...previous, action.actionId]
                  : previous.filter((id) => id !== action.actionId),
              )
            }
          />
          <div>
            <h3>{action.title}</h3>
            <span className="badge">{action.approval}</span>
            <p>Target: {action.target}</p>
            <p>Reason: {action.reason}</p>
            <p>Permission: {action.requiredPermission}</p>
            <p>Verification rule: {action.verificationRule}</p>
            {action.evidence.map((source) => (
              <p key={source.reference}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.reference}
                  </a>
                ) : (
                  source.reference
                )}
              </p>
            ))}
          </div>
        </article>
      ))}
      <button
        className="primary"
        disabled={busy || stale || selected.length === 0}
        onClick={() => setConfirmation("approve")}
      >
        Request approval for selected actions
      </button>
      <button
        disabled={
          busy ||
          stale ||
          plan.mode === "fixture" ||
          approved.length === 0 ||
          requestKey !== null
        }
        onClick={() => setConfirmation("execute")}
      >
        Execute backend-approved actions
      </button>
      <p className="muted">
        No Jira action executes on navigation or approval. Authorization and
        duplicate-write prevention belong to the backend.
      </p>
      {notice && <p role="status">{notice}</p>}
      {requestKey && (
        <>
          <p>
            Execution request key: {requestKey}. If the response is delayed,
            check its status before another write.
          </p>
          <button disabled={busy} onClick={() => run("getExecutionStatus")}>
            Refresh verified execution status
          </button>
        </>
      )}
      {execution && (
        <>
          <h3>Execution {execution.status}</h3>
          {execution.actions.map((action) => (
            <p key={action.actionId}>
              {action.actionId}: {action.status} · attempt {action.attempt}
              {action.error ? ` · ${action.error}` : ""}
            </p>
          ))}
          {["PARTIAL", "FAILED"].includes(execution.status) && (
            <p>
              Some actions are not verified. No automatic retry has been
              performed. A retry requires backend-provided eligibility.
            </p>
          )}
        </>
      )}
      {confirmation && (
        <ConfirmDialog
          title={
            confirmation === "approve"
              ? "Request approval for selected actions?"
              : "Execute backend-approved actions?"
          }
          description={
            confirmation === "approve"
              ? "Submit only your selected action IDs and plan version for backend authorization. Execution is a separate step."
              : "This can create or change Jira data. Only backend-approved actions will be requested. Check targets and permissions before confirming."
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const operation =
              confirmation === "approve"
                ? "approvePreventionPlan"
                : "executeApprovedPlan";
            setConfirmation(null);
            void run(operation);
          }}
        />
      )}
    </section>
  );
}
