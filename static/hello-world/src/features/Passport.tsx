import EvidenceChangeNotice from "../components/EvidenceChangeNotice";
import React, { useMemo } from "react";
import Icon from "../components/Icon";
import {
  Badge,
  EmptyState,
  Notice,
  PageHeader,
  SourceLink,
} from "../components/ui";
import type { Workflow } from "../app/useCoreWorkflow";
import {
  actionTypeCopy,
  evidenceCopy,
  executionCopy,
  formatTime,
  planStatusCopy,
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
  const status = plan ? planStatusCopy[plan.status] : null;
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
          </div>
        </header>
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
          <p className="ax-report__refs" data-testid="passport-refs">
            Mode {p.mode} · snapshot {p.snapshotId} · plan {plan?.planId} ·
            scenario {plan?.scenarioId}
            {plan && <> · hash {plan.planHash}</>} · passport {p.passportId}
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
                      <strong>
                        {a.actionIds
                          .map((id) => {
                            const action = actionOf(id);
                            return action ? actionTypeCopy[action.type] : id;
                          })
                          .join(", ")}
                      </strong>
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
            <li>
              Only actions marked Verified were read back from Jira by the
              backend.
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
