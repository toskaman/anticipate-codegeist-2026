import React from "react";
import type { ExecutionRecord, ProposedAction } from "@anticipate/contracts";
import Icon from "../components/Icon";
import {
  Badge,
  EmptyState,
  KeyValues,
  Notice,
  PageHeader,
  Panel,
  SourceLink,
  TechDetails,
} from "../components/ui";
import EvidencePath from "../components/EvidencePath";
import DecisionDialog from "../components/DecisionDialog";
import type { Workflow } from "../app/useCoreWorkflow";
import {
  actionTypeCopy,
  executionCopy,
  formatTime,
  planStatusCopy,
  plural,
  scenarioName,
  type Tone,
} from "../app/copy";

type Lifecycle = { label: string; tone: Tone; detail: string };

function lifecycle(
  w: Workflow,
  a: ProposedAction,
  record: ExecutionRecord | undefined,
): Lifecycle {
  if (record) return executionCopy[record.status];
  if (w.attempted && w.approvedIds.has(a.actionId))
    return {
      label: "Outcome uncertain",
      tone: "warning",
      detail:
        "Execution was requested but no record has been returned. Check execution status.",
    };
  if (w.approvedIds.has(a.actionId))
    return {
      label: "Approved",
      tone: "accent",
      detail: "Approval is recorded by the backend. Not executed.",
    };
  if (w.selected.includes(a.actionId))
    return {
      label: "Selected",
      tone: "info",
      detail: "Selected for approval. Not yet recorded.",
    };
  return {
    label: "Not approved",
    tone: "neutral",
    detail: "No approval is recorded for this action.",
  };
}

type StepState = "done" | "current" | "todo" | "attention";
function Stepper({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="ax-stepper" aria-label="Plan progress">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className={`ax-stepper__item ax-stepper__item--${s.state}`}
        >
          <span className="ax-stepper__dot" aria-hidden="true">
            {s.state === "done" ? (
              <Icon name="check" size={13} />
            ) : s.state === "attention" ? (
              <Icon name="alert" size={13} />
            ) : (
              i + 1
            )}
          </span>
          <span className="ax-stepper__label">{s.label}</span>
          <span className="ax-sr">
            {s.state === "done"
              ? " — completed"
              : s.state === "current"
                ? " — current"
                : s.state === "attention"
                  ? " — needs attention"
                  : " — not started"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function PreventionPlan({ w }: { w: Workflow }) {
  const plan = w.plan;
  if (!plan)
    return (
      <>
        <PageHeader
          step="Step 5 of 6 · Approve & execute"
          icon="plan"
          title="Prevention Plan"
          lead="Proposed Jira actions, approved one by one, then executed in a separate step."
        />
        <EmptyState
          icon="plan"
          title="No plan yet"
          action={
            <button
              className="ax-btn ax-btn--primary"
              onClick={() => w.actions.go("Decision Firewall")}
            >
              Go to Decision Firewall
            </button>
          }
        >
          Generate a plan from the selected scenario in Decision Firewall.
        </EmptyState>
      </>
    );
  const recordOf = (id: string) => w.records?.find((r) => r.actionId === id);
  const approvedActions = plan.actions.filter((a) =>
    w.approvedIds.has(a.actionId),
  );
  const selectedActions = plan.actions.filter((a) =>
    w.selected.includes(a.actionId),
  );
  const anyFailed = w.records?.some((r) => r.status === "FAILED");
  const allVerified =
    !!w.records?.length && w.records.every((r) => r.status === "VERIFIED");
  const executed = w.attempted || !!w.records?.length;
  const steps: { label: string; state: StepState }[] = [
    {
      label: "Review actions",
      state: approvedActions.length || executed ? "done" : "current",
    },
    {
      label: "Approve",
      state: approvedActions.length
        ? "done"
        : selectedActions.length
          ? "current"
          : "todo",
    },
    {
      label: "Execute",
      state: executed ? "done" : w.canExecute ? "current" : "todo",
    },
    {
      label: "Verify results",
      state: allVerified
        ? "done"
        : anyFailed || (w.attempted && !w.records?.length)
          ? "attention"
          : executed
            ? "current"
            : "todo",
    },
  ];
  const writeBlocked = !w.writesAvailable;
  const approveHint = w.expired
    ? "The snapshot expired. Recover status, or analyze again for a new plan."
    : !w.snapshot
      ? "The snapshot is not loaded, so new approvals are disabled."
      : writeBlocked
        ? "Jira writes are unavailable for this workspace."
        : w.attempted || w.approvalUncertain
          ? "A Jira-affecting request is pending review. Check execution status first."
          : !w.selected.length
            ? "Select at least one action above."
            : `${plural(w.selected.length, "action")} selected.`;
  const executeHint = w.canExecute
    ? `${plural(approvedActions.length, "approved action")} ready. Each is attempted once.`
    : executed || w.executionMarked
      ? "Execution was already requested for this plan. It is never resubmitted automatically."
      : w.expired
        ? "The snapshot expired. Execution is disabled."
        : writeBlocked
          ? "Jira writes are unavailable for this workspace."
          : !approvedActions.length
            ? "Approve actions first. Only backend-recorded approvals can be executed."
            : w.approvalUncertain
              ? "Approval outcome is uncertain. Check execution status first."
              : "Execution is not available for this plan in its current state.";
  const status = planStatusCopy[plan.status];
  return (
    <>
      <PageHeader
        step="Step 5 of 6 · Approve & execute"
        icon="plan"
        title="Prevention Plan"
        lead="Review each proposed Jira action. Approving records your decision; executing is a separate, explicit step."
      />
      <section className="ax-plan-summary" aria-label="Plan summary">
        <div className="ax-plan-summary__main">
          <Badge tone={status.tone} size="lg">
            {status.label}
          </Badge>
          <span className="ax-plan-summary__text">
            {plural(plan.actions.length, "proposed action")} for{" "}
            <strong>{scenarioName(plan.scenarioId)}</strong> · created{" "}
            {formatTime(plan.createdAt)}
          </span>
        </div>
        <Stepper steps={steps} />
      </section>
      {w.expired && (
        <Notice tone="warning" role="alert" title="Snapshot expired">
          Approvals and execution are disabled for this plan. Status and
          Passport recovery remain available. To act again, analyze the change
          again and generate a new plan.
        </Notice>
      )}
      {(w.approvalUncertain || w.attempted) &&
        (w.records?.length && !w.approvalUncertain ? (
          <Notice
            tone="neutral"
            role="status"
            title="Execution was requested once"
          >
            Outcomes are listed under Verify results. Nothing is resubmitted
            automatically.
          </Notice>
        ) : (
          <Notice
            tone="warning"
            role="status"
            title="Jira-affecting request sent"
          >
            A mutation was requested. Check execution status before further
            decisions. No automatic resubmission.
          </Notice>
        ))}
      <Panel
        title="1 · Review proposed actions"
        id="review-title"
        description="Each action states its Jira target, the evidence behind it, the permission it needs and how its result is verified."
      >
        <ul className="ax-actions">
          {plan.actions.map((a) => {
            const record = recordOf(a.actionId);
            const state = lifecycle(w, a, record);
            const checkboxId = `approve-${a.actionId}`;
            return (
              <li
                key={a.actionId}
                className={`ax-action ax-action--${state.tone}`}
              >
                <div className="ax-action__head">
                  {!executed && (
                    <label className="ax-check" htmlFor={checkboxId}>
                      <input
                        id={checkboxId}
                        type="checkbox"
                        aria-label={`Approve ${a.actionId}`}
                        disabled={!w.canSelectActions}
                        checked={w.selected.includes(a.actionId)}
                        onChange={(e) =>
                          w.actions.toggleAction(a.actionId, e.target.checked)
                        }
                      />
                      <span aria-hidden="true">Approve</span>
                    </label>
                  )}
                  <div className="ax-action__title">
                    <h3>{actionTypeCopy[a.type] ?? a.type}</h3>
                    <p className="ax-action__target">
                      {a.targetIssueKey ? (
                        <>
                          on <strong>{a.targetIssueKey}</strong> in project{" "}
                          {a.targetProjectKey}
                        </>
                      ) : (
                        <>new issue in project {a.targetProjectKey}</>
                      )}
                    </p>
                  </div>
                  <span className="ax-action__state">
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </span>
                </div>
                <p className="ax-action__reason">{a.reason}</p>
                <KeyValues
                  items={[
                    ["Permission needed", a.requiredPermission],
                    ["How it is verified", a.verificationRule],
                    [
                      "Status",
                      <span className="ax-small">{state.detail}</span>,
                    ],
                  ]}
                />
                {record && (record.resultRef || record.error) && (
                  <div className="ax-action__result">
                    {record.resultRef && (
                      <SourceLink url={record.resultRef.url}>
                        {record.resultRef.issueKey ?? "Result reference"}
                      </SourceLink>
                    )}
                    {record.error && (
                      <span className="ax-error-text">
                        {record.error.code}: {record.error.message}
                      </span>
                    )}
                  </div>
                )}
                <details className="ax-tech">
                  <summary>
                    <Icon
                      name="chevronDown"
                      size={14}
                      className="ax-tech__chevron"
                    />
                    Evidence ({a.evidenceEdgeIds.length}) and exact payload
                  </summary>
                  <div className="ax-tech__body">
                    <EvidencePath
                      graph={w.snapshot}
                      edgeIds={a.evidenceEdgeIds}
                      label={`Evidence for ${a.actionId}`}
                    />
                    <p className="ax-small ax-muted">
                      Action ID: <code className="ax-code">{a.actionId}</code>
                    </p>
                    <pre
                      className="ax-pre"
                      role="region"
                      tabIndex={0}
                      aria-label={`Payload for ${a.actionId}`}
                    >
                      {JSON.stringify(a.payload, null, 2)}
                    </pre>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </Panel>
      <div className="ax-grid ax-grid--authorize">
        <section
          className="ax-panel ax-authorize"
          aria-labelledby="approve-title"
        >
          <h2 id="approve-title">2 · Approve selected actions</h2>
          <div className="ax-means">
            <div>
              <p className="ax-means__k">
                <Icon name="check" size={14} /> Approval does
              </p>
              <p>
                Record your decision for the selected actions against this exact
                plan version.
              </p>
            </div>
            <div>
              <p className="ax-means__k ax-means__k--no">
                <Icon name="x" size={14} /> Approval does not
              </p>
              <p>Write anything to Jira. Execution is a separate step.</p>
            </div>
          </div>
          <button
            className="ax-btn ax-btn--primary ax-btn--lg"
            disabled={!w.canApprove}
            aria-describedby="approve-hint"
            onClick={() => w.actions.requestConfirmation("approve")}
          >
            <Icon name="userCheck" size={16} />
            Approve selected actions
          </button>
          <p className="ax-field__hint" id="approve-hint">
            {approveHint}
          </p>
        </section>
        <section
          className="ax-panel ax-authorize ax-authorize--execute"
          aria-labelledby="execute-title"
        >
          <h2 id="execute-title">3 · Execute approved actions</h2>
          <p>
            Applies every backend-approved action to Jira, including approvals
            recorded earlier. Nothing runs on navigation or approval.
          </p>
          <p className="ax-small">
            <span className="ax-muted">Approved actions: </span>
            {approvedActions.length
              ? approvedActions
                  .map((a) => actionTypeCopy[a.type] ?? a.type)
                  .join(", ")
              : "None verified"}
          </p>
          <button
            className="ax-btn ax-btn--danger ax-btn--lg"
            disabled={!!w.busy || !w.canExecute}
            aria-describedby="execute-hint"
            onClick={() => w.actions.requestConfirmation("execute")}
          >
            <Icon name="play" size={15} />
            Execute approved actions
          </button>
          <p className="ax-field__hint" id="execute-hint">
            {executeHint}
          </p>
        </section>
      </div>
      <Panel
        title="4 · Verify results"
        id="verify-title"
        description="Outcomes as reported by the backend, per action. Only Verified means the change was read back from Jira."
        actions={
          <button
            className="ax-btn"
            disabled={
              !!w.busy ||
              !w.allowed("getExecutionStatus") ||
              !w.allowed("getPreventionPassport")
            }
            onClick={() => void w.actions.refreshStatus()}
          >
            <Icon name="refresh" size={15} />
            Check execution status
          </button>
        }
      >
        {!w.records ? (
          <p className="ax-muted">
            No status read yet. Execution records appear here after execution or
            a status check.
          </p>
        ) : !w.records.length ? (
          <Notice tone="neutral" title="No execution records returned">
            Absence is not proof that an outstanding request has stopped; no
            automatic retry is offered.
          </Notice>
        ) : (
          <ol className="ax-timeline" aria-label="Execution records">
            {w.records.map((r) => {
              const c = executionCopy[r.status];
              const action = plan.actions.find(
                (a) => a.actionId === r.actionId,
              );
              return (
                <li
                  key={r.actionId}
                  className={`ax-timeline__item ax-timeline__item--${c.tone} ${r.status === "VERIFIED" ? "is-verified" : ""}`}
                >
                  <span className="ax-timeline__dot" aria-hidden="true" />
                  <div className="ax-timeline__body">
                    <p className="ax-timeline__title">
                      <Badge tone={c.tone}>{c.label}</Badge>
                      <span>
                        {action ? actionTypeCopy[action.type] : "Action"}
                      </span>
                      <span className="ax-muted ax-small">
                        attempt {r.attempt} · {formatTime(r.updatedAt)}
                      </span>
                    </p>
                    <p className="ax-small ax-muted">{c.detail}</p>
                    <p className="ax-small" data-testid="execution-record">
                      {r.actionId}: {r.status} · attempt {r.attempt}
                      {r.error ? ` · ${r.error.code}: ${r.error.message}` : ""}
                      {r.resultRef && (
                        <>
                          {" "}
                          ·{" "}
                          <SourceLink url={r.resultRef.url}>
                            {r.resultRef.issueKey ?? "Result reference"}
                          </SourceLink>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div className="ax-panel__footer">
          <button
            className="ax-btn ax-btn--primary"
            disabled={!!w.busy || !w.allowed("getPreventionPassport")}
            onClick={() => void w.actions.openPassport()}
          >
            <Icon name="passport" size={15} />
            Open Prevention Passport
          </button>
        </div>
      </Panel>
      <TechDetails label="Plan technical details">
        <KeyValues
          compact
          items={[
            ["Plan ID", <code className="ax-code">{plan.planId}</code>],
            ["Plan hash", <code className="ax-code">{plan.planHash}</code>],
            ["Status", <code className="ax-code">{plan.status}</code>],
            ["Snapshot ID", <code className="ax-code">{plan.snapshotId}</code>],
            ["Scenario ID", <code className="ax-code">{plan.scenarioId}</code>],
          ]}
        />
      </TechDetails>
      {w.confirmation === "approve" && (
        <DecisionDialog
          title={`Record approval for ${plural(selectedActions.length, "action")}?`}
          icon="userCheck"
          tone="accent"
          confirmLabel="Record approval"
          onCancel={w.actions.cancelConfirmation}
          onConfirm={() => void w.actions.confirmMutation("approve")}
        >
          <ul className="ax-dialog__list">
            {selectedActions.map((a) => (
              <li key={a.actionId}>
                {actionTypeCopy[a.type]}
                {a.targetIssueKey && ` on ${a.targetIssueKey}`}
              </li>
            ))}
          </ul>
          <p>
            Approval is recorded against plan version{" "}
            <code className="ax-code">{plan.planHash}</code>.{" "}
            <strong>This does not execute Jira writes.</strong>
          </p>
        </DecisionDialog>
      )}
      {w.confirmation === "execute" && (
        <DecisionDialog
          title={`Execute ${plural(approvedActions.length, "approved action")} in Jira?`}
          icon="play"
          tone="danger"
          confirmLabel="Execute in Jira"
          onCancel={w.actions.cancelConfirmation}
          onConfirm={() => void w.actions.confirmMutation("execute")}
        >
          <p>
            <strong>
              This can create issues, links, labels or comments in Jira.
            </strong>
          </p>
          <ul className="ax-dialog__list">
            {approvedActions.map((a) => (
              <li key={a.actionId}>
                {actionTypeCopy[a.type]}
                {a.targetIssueKey
                  ? ` on ${a.targetIssueKey}`
                  : ` in ${a.targetProjectKey}`}
              </li>
            ))}
          </ul>
          <p className="ax-small">
            Each action is attempted once. If a response is lost, check status —
            nothing is retried automatically. Plan{" "}
            <code className="ax-code">{plan.planId}</code>.
          </p>
        </DecisionDialog>
      )}
    </>
  );
}
