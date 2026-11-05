import EvidenceChangeNotice from "../components/EvidenceChangeNotice";
import React, { useMemo } from "react";
import type { PreventionPassport } from "@anticipate/contracts";
import Icon from "../components/Icon";
import {
  Badge,
  EmptyState,
  Notice,
  PageHeader,
  SourceLink,
} from "../components/ui";
import type { Workflow } from "../app/useCoreWorkflow";
const RadarAttention = React.lazy(() => import("./RadarAttention"));
const DecisionTimeMachine = React.lazy(() => import("./DecisionTimeMachine"));
import {
  actionTypeCopy,
  evidenceCopy,
  executionCopy,
  formatTime,
  planStatusDisplay,
  plural,
  scenarioName,
  uncertaintyCopy,
  verdictCopy,
  type EvidenceStatus,
} from "../app/copy";

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  const id = `passport-${n}`;
  return (
    <section className="ax-report__section" aria-labelledby={id}>
      <h2 id={id}>
        <span className="ax-report__n" aria-hidden="true">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

type ActionLookup = (
  id: string,
) =>
  | { type: string; targetIssueKey: string | null; targetProjectKey: string }
  | undefined;

/** "3 actions approved: Add a decision comment ×2, Link Jira issues". */
function approvalSummary(ids: string[], actionOf: ActionLookup) {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const a = actionOf(id);
    const label = a
      ? (actionTypeCopy[a.type as keyof typeof actionTypeCopy] ?? a.type)
      : id;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const parts = [...counts].map(([l, n]) => (n > 1 ? `${l} ×${n}` : l));
  return `${ids.length} action${ids.length === 1 ? "" : "s"} approved: ${parts.join(", ")}`;
}

function approvalTargets(ids: string[], actionOf: ActionLookup) {
  const keys = ids.map((id) => {
    const a = actionOf(id);
    if (!a) return id;
    return a.targetIssueKey ?? `new issue in ${a.targetProjectKey}`;
  });
  const shown = keys.slice(0, 12).join(", ");
  return keys.length > 12 ? `${shown} and ${keys.length - 12} more` : shown;
}

const retentionCopy = {
  LIVE: "Full snapshot available until",
  EXPIRED_SNAPSHOT:
    "The full snapshot has expired; this record keeps the decision as it was reviewed then. It does not reflect Jira today.",
  ARCHIVED:
    "The full snapshot was archived; only minimized provenance (counts and a digest) is kept. It does not reflect Jira today.",
} as const;

/** What the Jira workflow validator would decide now for the changed issue. */
const gateCopy: Record<
  NonNullable<PreventionPassport["gate"]>["status"],
  { label: string; tone: "success" | "warning" | "neutral" }
> = {
  OPEN: { label: "Open · the validator allows it", tone: "success" },
  CLOSED: { label: "Closed · the validator refuses it", tone: "warning" },
  NOT_GATED: { label: "Not gated by the validator", tone: "neutral" },
};

const gateSummary: Record<
  NonNullable<PreventionPassport["gate"]>["status"],
  string
> = {
  OPEN: "Jira transition: currently allowed by the workflow validator.",
  CLOSED:
    "Jira transition: currently refused by the workflow validator (reason below).",
  NOT_GATED:
    "Jira transition: this issue is not gated by the workflow validator.",
};

export default function Passport({ w }: { w: Workflow }) {
  const p = w.passport;
  const evidence = useMemo(() => {
    if (!p || !w.snapshot || w.snapshot.snapshotId !== p.snapshotId)
      return null;
    const c = { CONFIRMED: 0, INFERRED: 0, UNKNOWN: 0 } as Record<
      EvidenceStatus,
      number
    >;
    for (const e of w.snapshot.edges) c[e.status as EvidenceStatus]++;
    return c;
  }, [p, w.snapshot]);
  if (!p)
    return (
      <>
        <PageHeader
          step="Step 6 of 6 · Verify & record"
          icon="passport"
          title="Prevention Passport"
          lead="An audit-style record of the decision: evidence, alternatives, approvals and verified outcomes."
        />
        <EmptyState
          icon="passport"
          title="No Passport loaded"
          action={
            <button
              className="ax-btn ax-btn--primary"
              onClick={() => w.actions.go("Prevention Plan")}
            >
              Go to Prevention Plan
            </button>
          }
        >
          Load the Passport for a generated plan in Prevention Plan.
        </EmptyState>
      </>
    );
  const plan = p.plan;
  const historical = !!p.evidence && p.evidence.state !== "LIVE";
  const status = plan ? planStatusDisplay(plan, p.executions) : null;
  const selected = p.comparison.results.find(
    (r) => r.scenarioId === plan?.scenarioId,
  );
  const verified = p.executions.filter((e) => e.status === "VERIFIED").length;
  const timeline = [...p.timeline].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  const actionOf = (id: string) => plan?.actions.find((a) => a.actionId === id);
  return (
    <>
      <EvidenceChangeNotice w={w} />
      <PageHeader
        step="Step 6 of 6 · Verify & record"
        icon="passport"
        title="Prevention Passport"
        lead="The decision record: what was known, what was considered, who approved what, and what was verified."
        actions={
          <>
            <button
              className="ax-btn ax-btn--ghost"
              onClick={w.actions.exportPassport}
            >
              <Icon name="download" size={15} />
              Export Passport JSON
            </button>
            <button className="ax-btn" onClick={() => window.print()}>
              <Icon name="printer" size={15} />
              Print or save as PDF
            </button>
          </>
        }
      />
      {plan && w.capabilities?.operations.includes("getPlanAttention") && (
        <React.Suspense fallback={<p role="status">Loading radar tools…</p>}>
          <RadarAttention w={w} planId={plan.planId} historical />
        </React.Suspense>
      )}
      {plan && w.capabilities?.operations.includes("getDecisionHistory") && (
        <React.Suspense
          fallback={<p role="status">Loading decision history…</p>}
        >
          <DecisionTimeMachine client={w.client} planId={plan.planId} />
        </React.Suspense>
      )}
      <article className="ax-report" aria-labelledby="report-title">
        <header className="ax-report__header">
          <div className="ax-report__brand">
            <span className="ax-report__mark" aria-hidden="true">
              <Icon name="passport" size={18} />
            </span>
            <div>
              <p className="ax-eyebrow">ANTICIPATE · Prevention Passport</p>
              <p id="report-title" className="ax-report__title">
                {p.change.description}
              </p>
            </div>
          </div>
          <div className="ax-report__badges">
            <Badge tone={p.mode === "LIVE" ? "success" : "warning"} icon="dot">
              {p.mode === "LIVE" ? "Live mode record" : "Demo fixture"}
            </Badge>
            {status && <Badge tone={status.tone}>{status.label}</Badge>}
            {historical && (
              <Badge tone="info" icon="history">
                Historical record
              </Badge>
            )}
          </div>
        </header>
        {p.evidence && (
          <p className="ax-report__retention" data-testid="passport-retention">
            <Icon name={historical ? "history" : "clock"} size={14} />
            <span>
              {historical ? (
                <>
                  <strong>
                    Evidence as reviewed on {formatTime(p.evidence.capturedAt)}.
                  </strong>{" "}
                  {retentionCopy[p.evidence.state]}
                </>
              ) : (
                <>
                  Evidence captured {formatTime(p.evidence.capturedAt)}.{" "}
                  {retentionCopy.LIVE} {formatTime(p.evidence.expiresAt)}.
                </>
              )}
            </span>
          </p>
        )}
        <section
          className="ax-report__summary"
          aria-labelledby="report-summary-title"
          data-testid="passport-summary"
        >
          <h2 id="report-summary-title" className="ax-report__summary-k">
            In short
          </h2>
          <ul>
            <li>
              Option chosen:{" "}
              <strong>{plan ? scenarioName(plan.scenarioId) : "none"}</strong>
              {selected && <> ({verdictCopy[selected.verdict].label})</>}.
            </li>
            <li>
              <strong>
                {verified} of{" "}
                {plural(plan?.actions.length ?? 0, "proposed Jira action")}
              </strong>{" "}
              verified by reading Jira back.
            </li>
            {p.gate && <li>{gateSummary[p.gate.status]}</li>}
            <li>
              {p.openUnknowns.length
                ? `${plural(p.openUnknowns.length, "open question")} still unresolved.`
                : "No open questions recorded."}
            </li>
          </ul>
        </section>
        <Notice tone="neutral" icon="info" title="About this record">
          {p.disclaimer}
        </Notice>
        <Section n="01" title="Decision overview">
          <dl className="ax-report__facts">
            <div>
              <dt>Change</dt>
              <dd>{p.change.issueKey ?? p.change.targetNodeId}</dd>
            </div>
            <div>
              <dt>Selected option</dt>
              <dd>{plan ? scenarioName(plan.scenarioId) : "—"}</dd>
            </div>
            <div>
              <dt>Policy result</dt>
              <dd>
                {selected ? (
                  <Badge tone={verdictCopy[selected.verdict].tone} size="sm">
                    {verdictCopy[selected.verdict].label}
                  </Badge>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Recorded outcome</dt>
              <dd>{status?.label ?? "No plan"}</dd>
            </div>
            <div>
              <dt>Verified actions</dt>
              <dd>
                {verified} of {plan?.actions.length ?? 0}
              </dd>
            </div>
          </dl>
          {p.gate && (
            <p
              className={`ax-report__gate ax-report__gate--${p.gate.status.toLowerCase()}`}
              data-testid="passport-gate"
            >
              <span className="ax-report__gate-label">
                Jira transition, checked when this record was loaded
              </span>
              <Badge tone={gateCopy[p.gate.status].tone} size="sm">
                {gateCopy[p.gate.status].label}
              </Badge>
              {p.gate.status !== "OPEN" && p.gate.reason && (
                <span className="ax-report__gate-reason">{p.gate.reason}</span>
              )}
            </p>
          )}
          <p className="ax-report__refs" data-testid="passport-refs">
            Mode {p.mode} · snapshot {p.snapshotId} · plan {plan?.planId} ·
            scenario {plan?.scenarioId}
            {plan && <> · hash {plan.planHash}</>} · passport {p.passportId}
            {p.evidence && <> · evidence digest {p.evidence.snapshotDigest}</>}
          </p>
        </Section>
        <Section n="02" title="Evidence summary">
          {evidence ? (
            <div className="ax-report__evidence">
              {(["CONFIRMED", "INFERRED", "UNKNOWN"] as const).map((s) => (
                <div
                  key={s}
                  className={`ax-report__ev ax-report__ev--${s.toLowerCase()}`}
                >
                  <span className="ax-report__ev-n">{evidence[s]}</span>
                  <span>{evidenceCopy[s].label} relationships</span>
                </div>
              ))}
            </div>
          ) : p.evidence ? (
            <p>
              Recorded at decision time: {p.evidence.nodeCount} records,{" "}
              {p.evidence.edgeCount} relationships ({p.evidence.causalEdgeCount}{" "}
              causal). Confirmed / inferred / unknown breakdown needs the full
              snapshot, which{" "}
              {p.evidence.state === "LIVE"
                ? "is not loaded in this session"
                : "is no longer available"}
              .
            </p>
          ) : (
            <p className="ax-muted">
              Relationship counts are shown only while the matching snapshot is
              loaded. The open questions below come from the recorded audit.
            </p>
          )}
          <h3 className="ax-h4">Open questions at decision time</h3>
          {p.openUnknowns.length ? (
            <ul className="ax-uncertainty">
              {p.openUnknowns.map((u, i) => (
                <li key={i}>
                  <Badge tone="warning" icon="help" size="sm">
                    {uncertaintyCopy[u.reason] ?? u.reason}
                  </Badge>
                  <span>{u.explanation}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ax-muted">None recorded.</p>
          )}
        </Section>
        <Section n="03" title="Considered alternatives">
          <div
            className="ax-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Considered alternatives table"
          >
            <table className="ax-table">
              <thead>
                <tr>
                  <th scope="col">Option</th>
                  <th scope="col">Result</th>
                  <th scope="col" className="ax-num">
                    Affected
                  </th>
                  <th scope="col" className="ax-num">
                    Blockers
                  </th>
                  <th scope="col" className="ax-num">
                    Unknowns
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.comparison.results.map((r) => (
                  <tr
                    key={r.scenarioId}
                    className={
                      r.scenarioId === plan?.scenarioId ? "is-selected" : ""
                    }
                  >
                    <th scope="row">
                      {scenarioName(r.scenarioId)}
                      {r.scenarioId === plan?.scenarioId && (
                        <span className="ax-tag">Chosen</span>
                      )}
                    </th>
                    <td>
                      <Badge tone={verdictCopy[r.verdict].tone} size="sm">
                        {verdictCopy[r.verdict].label}
                      </Badge>
                    </td>
                    <td className="ax-num">{r.summary.impacted}</td>
                    <td className="ax-num">{r.summary.blockers}</td>
                    <td className="ax-num">{r.summary.unknowns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section n="04" title="Approvals">
          {p.approvals.length ? (
            <ul className="ax-report__list">
              {p.approvals.map((a, i) => (
                <li key={i}>
                  <Icon name="userCheck" size={15} />
                  <div>
                    <p>
                      <strong>{approvalSummary(a.actionIds, actionOf)}</strong>
                    </p>
                    <p className="ax-small">
                      Targets: {approvalTargets(a.actionIds, actionOf)}
                    </p>
                    <p className="ax-small ax-muted">
                      Approver account: {a.accountId ?? "No account supplied"} ·{" "}
                      {formatTime(a.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ax-muted">No authenticated approval recorded.</p>
          )}
        </Section>
        <Section n="05" title="Execution receipt">
          {p.executions.length ? (
            <div
              className="ax-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Execution receipt table"
            >
              <table className="ax-table">
                <thead>
                  <tr>
                    <th scope="col">Action</th>
                    <th scope="col">Outcome</th>
                    <th scope="col" className="ax-num">
                      Attempt
                    </th>
                    <th scope="col">Updated</th>
                    <th scope="col">Jira record</th>
                  </tr>
                </thead>
                <tbody>
                  {p.executions.map((r) => {
                    const c = executionCopy[r.status];
                    const a = actionOf(r.actionId);
                    return (
                      <tr
                        key={r.actionId}
                        className={r.status === "VERIFIED" ? "is-verified" : ""}
                      >
                        <th scope="row">
                          {a ? actionTypeCopy[a.type] : "Action"}
                          <span className="ax-table__sub">{r.actionId}</span>
                        </th>
                        <td>
                          <Badge tone={c.tone} size="sm">
                            {c.label}
                          </Badge>
                          {r.error && (
                            <span className="ax-table__sub ax-error-text">
                              {r.error.code}: {r.error.message}
                            </span>
                          )}
                        </td>
                        <td className="ax-num">{r.attempt}</td>
                        <td>{formatTime(r.updatedAt)}</td>
                        <td>
                          {r.resultRef ? (
                            <SourceLink url={r.resultRef.url}>
                              {r.resultRef.issueKey ?? "Result reference"}
                            </SourceLink>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ax-muted">No execution records returned.</p>
          )}
        </Section>
        <Section n="06" title="Decision timeline">
          {timeline.length ? (
            <ol className="ax-history">
              {timeline.map((t, i) => (
                <li key={i} style={{ "--i": i } as React.CSSProperties}>
                  <span className="ax-history__dot" aria-hidden="true" />
                  <time dateTime={t.at}>{formatTime(t.at)}</time>
                  <span>{t.event}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ax-muted">No timeline events recorded.</p>
          )}
        </Section>
        <Section n="07" title="Limitations">
          <ul className="ax-report__limits">
            <li>
              Based only on Jira records the app could read at snapshot time.
            </li>
            <li>
              {p.openUnknowns.length
                ? `${plural(p.openUnknowns.length, "open question")} ${p.openUnknowns.length === 1 ? "was" : "were"} recorded and remain${p.openUnknowns.length === 1 ? "s" : ""} unresolved here.`
                : "No open questions were recorded; unread evidence may still exist."}
            </li>
            {!!status?.gap && (
              <li>
                <strong>
                  {plural(status.gap, "proposed action")}{" "}
                  {status.gap === 1 ? "has" : "have"} no verified execution.
                </strong>{" "}
                {status.note ??
                  (plan?.status === "COMPLETED"
                    ? `The backend recorded this plan as Completed; treat ${status.gap === 1 ? "it" : "them"} as not done.`
                    : `Treat ${status.gap === 1 ? "it" : "them"} as not done.`)}
              </li>
            )}
            <li>
              Only actions marked Verified were read back from Jira by the
              backend.
            </li>
            {p.gate?.status === "CLOSED" && (
              <li>
                <strong>
                  The recorded outcome does not authorize the Jira transition.
                </strong>{" "}
                The workflow validator still refuses it until Jira shows the
                work this decision assumed.
              </li>
            )}
            <li>
              A completed decision means the approved Jira actions were applied
              and verified. Engineering work they track (for example a created
              issue or a migration) may still be open in Jira.
            </li>
            <li>
              This is an audit-style decision record — not a legal, compliance
              or cryptographic certificate.
            </li>
          </ul>
        </Section>
        <footer className="ax-report__footer">
          <span>Passport {p.passportId}</span>
          <span>Generated by ANTICIPATE · CORE 0.2.0</span>
        </footer>
      </article>
    </>
  );
}
