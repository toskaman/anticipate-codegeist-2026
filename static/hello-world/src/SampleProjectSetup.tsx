import React, { useEffect, useRef, useState } from "react";
import type { SampleProjectPlan } from "@anticipate/contracts";
import { CoreClientError, ForgeClient } from "./api/ForgeClient";
import DecisionDialog from "./components/DecisionDialog";
import { Panel } from "./components/ui";
import CoreOperationError, {
  type OperationFailure,
} from "./CoreOperationError";

export default function SampleProjectSetup({
  client,
  projectKey,
  canPreview,
  canCreate,
  onAnalyze,
  disabled,
  onBusyChange,
}: {
  client: ForgeClient;
  projectKey: string;
  canPreview: boolean;
  canCreate: boolean;
  disabled: boolean;
  onBusyChange(busy: boolean): void;
  onAnalyze(root: string, replacement: string | null): void;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SampleProjectPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [failure, setFailure] = useState<OperationFailure | null>(null);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );
  async function run(create: boolean) {
    if (pending.current || !projectKey || (create && !previewed)) return;
    setConfirmed(false);
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setFailure(null);
    setPreviewed(false);
    const abort = new AbortController();
    request.current = abort;
    try {
      const data = create
        ? await client.request(
            "createSampleProject",
            { projectKey, confirm: true },
            abort.signal,
          )
        : await client.request(
            "previewSampleProject",
            { projectKey },
            abort.signal,
          );
      if (abort.signal.aborted) return;
      setResult(data);
      setPreviewed(!create);
    } catch (error) {
      if (!abort.signal.aborted)
        setFailure({
          code: error instanceof CoreClientError ? error.code : "UNEXPECTED",
          message:
            error instanceof Error
              ? error.message
              : "Sample preparation failed. No success is assumed.",
          details: error instanceof CoreClientError ? error.details : undefined,
          mutation: create,
          retryable: false,
          context: "sample",
        });
    } finally {
      pending.current = false;
      onBusyChange(false);
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <Panel title="Demo project preparation" className="ax-sample-setup">
      <fieldset className="ax-sample-fields" disabled={disabled || busy}>
        <legend>Sample Jira data</legend>

        <button
          className="ax-btn"
          disabled={busy}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          Prepare a demo project
        </button>
        {open && (
          <>
            <p>
              This creates real, labelled sample tickets in an existing Jira
              project, not a new project or local fixtures. Review the preview
              before confirming. No Jira write happens when opening this panel.
            </p>
            {!projectKey && (
              <p>
                Choose an accessible Jira project above first. If no projects
                are available, create a project in Jira or ask your
                administrator for access, then refresh the project list.
              </p>
            )}
            {!canPreview && (
              <p>
                Sample preparation is not enabled by this backend. No demo
                result is substituted.
              </p>
            )}
            <button
              className="ax-btn"
              disabled={busy || !projectKey || !canPreview}
              onClick={() => void run(false)}
            >
              Preview sample data
            </button>
            {busy && (
              <p role="status">
                Checking Jira sample data… This can take a few seconds.
              </p>
            )}
            {failure && (
              <CoreOperationError
                failure={failure}
                onDismiss={() => setFailure(null)}
              />
            )}
            {result && (
              <>
                <h3>Sample data in {result.projectKey}</h3>
                <p>{result.note}</p>
                <p>
                  Labels: anticipate-sample and anticipate-sample-&lt;role&gt;.
                  Sample tickets remain in Jira; no automatic deletion is
                  performed.
                </p>
                {!!result.missingPermissions.length && (
                  <p role="alert">
                    Missing Jira permissions:{" "}
                    {result.missingPermissions.join(", ")}
                  </p>
                )}
                {!result.issueType && (
                  <p role="alert">No usable Jira issue type is available.</p>
                )}
                <ul>
                  {result.items.map((item) => (
                    <li key={item.role}>
                      {item.summary} · {item.issueKey ?? item.role} ·{" "}
                      {item.status}
                    </li>
                  ))}
                </ul>
                <h3>Proposed / reported relations</h3>
                <ul>
                  {result.links.map((link, index) => (
                    <li key={index}>
                      {link.from} → {link.to} · {link.relation} · {link.status}
                    </li>
                  ))}
                </ul>
                <p>
                  Relation labels above are returned by CORE. Preview is not
                  proof of a completed write.
                </p>
                {result.items.some((item) => item.status === "FAILED") ||
                result.links.some((link) => link.status === "FAILED") ? (
                  <p role="alert">
                    Some sample items or relations failed. Review the reported
                    results and preview again before creating missing sample
                    data.
                  </p>
                ) : null}
                <button
                  className="ax-btn"
                  disabled={
                    busy || !previewed || !result.canCreate || !canCreate
                  }
                  onClick={() => setConfirmed(true)}
                >
                  Create missing sample data in Jira
                </button>
                {!canCreate && (
                  <p>Sample creation is unavailable for this installation.</p>
                )}
                <button
                  className="ax-btn"
                  disabled={busy || !result.rootIssueKey}
                  onClick={() =>
                    result.rootIssueKey &&
                    onAnalyze(result.rootIssueKey, result.replacementIssueKey)
                  }
                >
                  Analyze {result.rootIssueKey ?? "sample root"}
                </button>
                <p>
                  Analysis uses real Jira evidence. A reported root can be
                  analyzed even if other sample items failed.
                </p>
              </>
            )}
            {confirmed && result && (
              <DecisionDialog
                icon="target"
                tone="danger"
                confirmLabel="Create sample data"
                title="Create labelled sample tickets in Jira?"
                onCancel={() => setConfirmed(false)}
                onConfirm={() => void run(true)}
              >
                <p>
                  Project {projectKey}: create the missing entries shown in the
                  preview (up to six tickets and four relations). Existing
                  sample entries are reused. This is a real Jira write, not a
                  simulation. It does not approve or execute a prevention plan.
                </p>
              </DecisionDialog>
            )}
          </>
        )}
      </fieldset>
    </Panel>
  );
}
