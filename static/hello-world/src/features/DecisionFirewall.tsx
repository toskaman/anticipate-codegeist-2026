import React from "react";
import EvidenceChangeNotice from "../components/EvidenceChangeNotice";
import Icon, { type IconName } from "../components/Icon";
import {
  Badge,
  EmptyState,
  KeyValues,
  Notice,
  PageHeader,
  Panel,
  TechDetails,
} from "../components/ui";
import EvidencePath from "../components/EvidencePath";
import type { Workflow } from "../app/useCoreWorkflow";
import {
  capabilityStateCopy,
  evidenceCopy,
  plural,
  scenarioCopy,
  scenarioName,
  uncertaintyCopy,
  verdictCopy,
  type EvidenceStatus,
} from "../app/copy";

const verdictIcon: Record<string, IconName> = {
  BLOCKED: "octagon",
  NEEDS_REVIEW: "alert",
  PASS: "check",
};
const severityTone = (s: string) =>
  s === "BLOCKER" ? "danger" : s === "HIGH" ? "warning" : "neutral";
const severityStep: Record<string, string> = {
  BLOCKER: "Resolve before this option can proceed.",
  HIGH: "Review with the owners before approving actions.",
  MEDIUM: "Review and record how it is handled.",
  LOW: "Note it in the decision record.",
};

export default function DecisionFirewall({ w }: { w: Workflow }) {
  const r = w.currentResult;
  const g = w.snapshot;
  const nodeOf = (id: string) => g?.nodes.find((n) => n.id === id);
  const canGenerate =
    !w.busy && !w.expired && w.allowed("generatePreventionPlan");
  if (!r)
    return (
      <>
        <PageHeader
          step="Step 4 of 6 · Check safeguards"
          icon="shield"
          title="Decision Firewall"
          lead="Policies explain whether an option is blocked, needs review, or passes."
        />
        <EmptyState
          icon="shield"
          title="No option selected"
          action={
            <button
              className="ax-btn ax-btn--primary"
              onClick={() => w.actions.go("Scenario Lab")}
            >
              Go to Scenario Lab
            </button>
          }
        >
          Run a comparison and select a scenario first.
        </EmptyState>
      </>
    );
  const v = verdictCopy[r.verdict];
  const blockers = r.violations.filter((x) => x.severity === "BLOCKER").length;
  const option = scenarioCopy[r.scenarioId];
  const writeState = w.capabilities?.jiraWrite;
  return (
    <>
      <EvidenceChangeNotice w={w} />
      <PageHeader
        step="Step 4 of 6 · Check safeguards"
        icon="shield"
        title="Decision Firewall"
        lead="Why this option is acceptable, blocked, or needs a person to review it — with the evidence behind each reason."
        actions={
          <button
            className={`ax-btn ${r.verdict === "BLOCKED" ? "" : "ax-btn--primary"}`}
            disabled={!canGenerate}
            onClick={() => void w.actions.generatePlan()}
          >
            <Icon name="plan" size={15} />
            Generate prevention plan
          </button>
        }
      />
      <section
        className={`ax-verdict ax-verdict--${v.tone}`}
        aria-labelledby="verdict-title"
      >
        <span className="ax-verdict__icon" aria-hidden="true">
          <Icon name={verdictIcon[r.verdict]} size={28} />
        </span>
        <div className="ax-verdict__body">
          <p className="ax-eyebrow">
            Decision result · {scenarioName(r.scenarioId)}
          </p>
          <h2 id="verdict-title" className="ax-verdict__title">
            {v.headline}
          </h2>
          <p className="ax-verdict__summary">
            {r.violations.length
              ? `${plural(r.violations.length, "policy violation")}${blockers ? ` (${blockers} blocking)` : ""}`
              : "No policy violations"}
            {" and "}
            {plural(r.uncertainties.length, "open question")} reported for this
            option.
          </p>
          <div className="ax-badges">
            <Badge tone={v.tone} size="lg">
              {v.label}
            </Badge>
            {w.expired && (
              <Badge tone="neutral" icon="clock">
                Snapshot expired
              </Badge>
            )}
            {writeState && writeState !== "AVAILABLE" && (
              <Badge tone="warning" icon="lock">
                Jira writes: {capabilityStateCopy[writeState].label}
              </Badge>
            )}
          </div>
        </div>
        <div className="ax-verdict__next">
          <p className="ax-verdict__next-k">Next safe step</p>
          <p>{v.next}</p>
        </div>
      </section>
      <p className="ax-muted ax-small ax-scope-note">
        <Icon name="info" size={13} />
        These rules govern ANTICIPATE decisions. They are not Jira workflow
        validators and do not block Jira transitions.
      </p>
      {writeState && writeState !== "AVAILABLE" && (
        <Notice
          tone="warning"
          title="Approval and execution will be unavailable"
        >
          The backend reports Jira writes as{" "}
          {capabilityStateCopy[writeState].label.toLowerCase()}. You can still
          review and generate a plan.
        </Notice>
      )}
      <Panel
        title={r.violations.length ? "Why this result" : "Policy checks"}
        id="why-title"
        description={
          r.violations.length
            ? "Each reason traces the change through the affected dependency to the policy it triggers."
            : "No policy violations reported. Unknowns and approval requirements still apply."
        }
      >
        {r.violations.map((x, i) => (
          <article key={i} className="ax-reason">
            <ol className="ax-chain" aria-label={`Reason ${i + 1}`}>
              <li className="ax-chain__step">
                <span className="ax-chain__k">Proposed change</span>
                <span className="ax-chain__v">
                  {option?.title ?? r.scenarioId}
                </span>
                <span className="ax-chain__d">{option?.does}</span>
              </li>
              <li className="ax-chain__step">
                <span className="ax-chain__k">Affected dependency</span>
                {x.nodeIds.length ? (
                  x.nodeIds.map((id) => {
                    const n = nodeOf(id);
                    return (
                      <span key={id} className="ax-chain__v">
                        {n?.label ?? id}
                        {n && (
                          <span className="ax-chain__d">
                            {evidenceCopy[n.status as EvidenceStatus].label}{" "}
                            evidence
                          </span>
                        )}
                      </span>
                    );
                  })
                ) : (
                  <span className="ax-chain__d">
                    No record named by the backend
                  </span>
                )}
              </li>
              <li
                className={`ax-chain__step ax-chain__step--${severityTone(x.severity)}`}
              >
                <span className="ax-chain__k">Policy</span>
                <span className="ax-chain__v">{x.explanation}</span>
                <Badge tone={severityTone(x.severity)} size="sm">
                  {x.severity.toLowerCase()} severity
                </Badge>
              </li>
              <li className="ax-chain__step ax-chain__step--next">
                <span className="ax-chain__k">Review step</span>
                <span className="ax-chain__v">{severityStep[x.severity]}</span>
              </li>
            </ol>
            <details className="ax-tech">
              <summary>
                <Icon
                  name="chevronDown"
                  size={14}
                  className="ax-tech__chevron"
                />
                Evidence path and technical details
              </summary>
              <div className="ax-tech__body">
                <EvidencePath
                  graph={g}
                  edgeIds={x.pathEdgeIds}
                  label={`Evidence path for reason ${i + 1}`}
                />
                <KeyValues
                  compact
                  items={[
                    ["Rule ID", <code className="ax-code">{x.ruleId}</code>],
                    [
                      "Node IDs",
                      <code className="ax-code">
                        {x.nodeIds.join(", ") || "none"}
                      </code>,
                    ],
                    [
                      "Path",
                      <code className="ax-code">
                        {x.pathEdgeIds.join(" → ") || "Not supplied"}
                      </code>,
                    ],
                  ]}
                />
              </div>
            </details>
          </article>
        ))}
      </Panel>
      <Panel
        title="Remaining uncertainty"
        id="uncertainty-title"
        description="What the evidence cannot establish yet. These stay open until someone resolves them."
      >
        {r.uncertainties.length ? (
          <ul className="ax-uncertainty">
            {r.uncertainties.map((u, i) => (
              <li key={i}>
                <Badge tone="warning" icon="help" size="sm">
                  {uncertaintyCopy[u.reason] ?? u.reason}
                </Badge>
                <span>{u.explanation}</span>
                {u.nodeId && (
                  <span className="ax-muted ax-small">
                    {nodeOf(u.nodeId)?.label ?? u.nodeId}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ax-muted">
            No uncertainties reported by this simulation.
          </p>
        )}
      </Panel>
      <Notice
        tone="neutral"
        icon="plan"
        title="Next: prepare preventive actions"
      >
        Generating a plan changes nothing in Jira. Each proposed action needs
        your approval, and execution is a separate step.
      </Notice>
      <TechDetails>
        <KeyValues
          compact
          items={[
            ["Scenario ID", <code className="ax-code">{r.scenarioId}</code>],
            ["Snapshot ID", <code className="ax-code">{r.snapshotId}</code>],
            ["Result hash", <code className="ax-code">{r.resultHash}</code>],
            ["Verdict", r.verdict],
          ]}
        />
      </TechDetails>
    </>
  );
}
