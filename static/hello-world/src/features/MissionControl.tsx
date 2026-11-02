import React from "react";
import type { ProjectSummary } from "@anticipate/contracts";
import Icon from "../components/Icon";
import { Badge, PageHeader, Panel, Notice } from "../components/ui";
import type { Workflow } from "../app/useCoreWorkflow";
import { capabilityStateCopy } from "../app/copy";

const availability: Record<ProjectSummary["dataAvailability"], string> = {
  READY: "ready",
  NO_SNAPSHOT: "no snapshot yet",
  INSUFFICIENT_PERMISSION: "insufficient permission",
  EMPTY: "empty",
};

const journey = [
  {
    icon: "target",
    title: "The question",
    text: "Pick the Jira change you want to make.",
  },
  {
    icon: "graph",
    title: "The evidence",
    text: "See what depends on it, and how sure we are.",
  },
  {
    icon: "scenarios",
    title: "The alternatives",
    text: "Compare removing, retaining or migrating.",
  },
  {
    icon: "shield",
    title: "The decision",
    text: "Policies explain what is blocked and why.",
  },
  {
    icon: "passport",
    title: "The proof",
    text: "Approve, execute, and keep a verified record.",
  },
] as const;

export default function MissionControl({ w }: { w: Workflow }) {
  const listing = w.resource.status === "ready" ? w.resource.data.first : null;
  const project = w.projects.find((p) => p.id === w.projectId);
  const analyzeEnabled =
    !!w.projectId &&
    !!w.rootIssueKey &&
    w.allowed("getGraphSnapshot") &&
    w.allowed("getEvidenceGraph");
  const analyzeHint = !w.projectId
    ? "Choose a Jira project first."
    : !w.rootIssueKey
      ? "Choose a change candidate or type its issue key."
      : !w.allowed("getGraphSnapshot") || !w.allowed("getEvidenceGraph")
        ? "Dependency analysis is not enabled by the backend."
        : `Reads up to 3 relationship hops around ${w.rootIssueKey}. Nothing is written to Jira.`;
  const recoverEnabled =
    !w.busy &&
    !!w.recoveryId &&
    w.allowed("getPreventionPassport") &&
    w.allowed("getExecutionStatus");
  const jiraRead = w.capabilities?.jiraRead;
  return (
    <>
      <PageHeader
        step="Step 1 of 6 · Choose a change"
        icon="target"
        title="Mission Control"
        lead="Start from a real Jira issue that describes a change you are considering."
      />
      <section className="ax-hero" aria-labelledby="hero-title">
        <div className="ax-hero__copy">
          <p id="hero-title" className="ax-hero__title">
            Make your next change with confidence.
          </p>
          <p className="ax-hero__text">
            Explore dependencies, compare options, and verify preventive actions
            before changing Jira.
          </p>
        </div>
        <ol className="ax-hero__journey" aria-label="How ANTICIPATE works">
          {journey.map((j, i) => (
            <li key={j.title}>
              <span className="ax-hero__journey-icon" aria-hidden="true">
                <Icon name={j.icon} size={16} />
              </span>
              <span className="ax-hero__journey-step">0{i + 1}</span>
              <strong>{j.title}</strong>
              <span>{j.text}</span>
            </li>
          ))}
        </ol>
      </section>
      <div className="ax-grid ax-grid--mission">
        <Panel
          className="ax-panel--primary"
          title="Analyze a change"
          id="analyze-title"
          description="Choose the Jira project and the issue that describes the change."
        >
          {listing === null && (
            <Notice
              tone="warning"
              role="alert"
              title="Project listing unavailable"
            >
              Jira read capability: {jiraRead}
              {jiraRead && ` (${capabilityStateCopy[jiraRead].label})`}. Project
              listing is not enabled.
            </Notice>
          )}
          {listing && !w.projects.length && (
            <Notice tone="neutral" title="No Jira projects found">
              No projects available. Check Jira project access; no demonstration
              project is inserted.
            </Notice>
          )}
          <fieldset className="ax-form" disabled={!!w.busy}>
            <legend className="ax-sr">Project and change</legend>
            <div className="ax-field">
              <span className="ax-field__num" aria-hidden="true">
                1
              </span>
              <div className="ax-field__body">
                <label htmlFor="project-select">Jira project</label>
                <div className="ax-field__row">
                  <select
                    id="project-select"
                    value={w.projectId}
                    onChange={(e) => w.actions.selectProject(e.target.value)}
                  >
                    <option value="">Choose a project</option>
                    {w.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.key} · {p.name} · {availability[p.dataAvailability]}
                      </option>
                    ))}
                  </select>
                  {w.projectCursor && (
                    <button
                      className="ax-btn ax-btn--ghost"
                      onClick={() => void w.actions.loadMoreProjects()}
                    >
                      Load more projects
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="ax-field">
              <span className="ax-field__num" aria-hidden="true">
                2
              </span>
              <div className="ax-field__body">
                <span className="ax-field__label" id="candidates-label">
                  Change to assess
                </span>
                <p className="ax-field__hint">
                  Candidates are issues labelled{" "}
                  <code className="ax-code">anticipate-change</code>. You can
                  also type any issue key you can access.
                </p>
                <div className="ax-field__row">
                  <button
                    className="ax-btn"
                    disabled={!w.projectId || !w.allowed("getChangeCandidates")}
                    onClick={() => void w.actions.loadCandidates()}
                  >
                    <Icon name="search" size={15} />
                    Load change candidates
                  </button>
                  {w.candidateCursor && (
                    <button
                      className="ax-btn ax-btn--ghost"
                      onClick={() => void w.actions.loadMoreCandidates()}
                    >
                      Load more changes
                    </button>
                  )}
                </div>
                {w.candidates?.length === 0 && (
                  <p className="ax-inline-empty">
                    <Icon name="info" size={14} />
                    No issues labelled anticipate-change. Enter an accessible
                    issue key below.
                  </p>
                )}
                {!!w.candidates?.length && (
                  <>
                    <label htmlFor="candidate-select" className="ax-mt-s">
                      Change candidate
                    </label>
                    <select
                      id="candidate-select"
                      value={
                        w.candidates.some((c) => c.key === w.rootIssueKey)
                          ? w.rootIssueKey
                          : ""
                      }
                      onChange={(e) =>
                        w.actions.chooseCandidate(e.target.value)
                      }
                    >
                      <option value="">Choose a change</option>
                      {w.candidates.map((c) => (
                        <option key={c.id} value={c.key}>
                          {c.key} · {c.summary}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <label htmlFor="issue-key" className="ax-mt-s">
                  Jira issue key
                </label>
                <input
                  id="issue-key"
                  value={w.rootIssueKey}
                  placeholder={project ? `${project.key}-123` : "ABC-123"}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="issue-key-hint"
                  onChange={(e) => w.actions.typeIssueKey(e.target.value)}
                />
                <p className="ax-field__hint" id="issue-key-hint">
                  The issue must belong to the selected project.
                </p>
              </div>
            </div>
            <div className="ax-form__submit">
              <button
                className="ax-btn ax-btn--primary ax-btn--lg"
                disabled={!analyzeEnabled}
                aria-describedby="analyze-hint"
                onClick={() => void w.actions.analyze()}
              >
                <Icon name="graph" size={17} />
                Analyze dependencies
                <Icon name="arrowRight" size={16} />
              </button>
              <p className="ax-field__hint" id="analyze-hint">
                {analyzeHint}
              </p>
            </div>
          </fieldset>
        </Panel>
        <div className="ax-stack">
          <Panel
            title="Recover an existing plan"
            id="recover-title"
            headingLevel={2}
            description="After a page reload or lost response, read the plan's status and audit again. Recovery never executes Jira actions."
          >
            <label htmlFor="recovery-id">Recovery plan ID</label>
            <input
              id="recovery-id"
              disabled={!!w.busy}
              value={w.recoveryId}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => w.actions.setRecoveryId(e.target.value)}
            />
            <button
              className="ax-btn ax-mt-s"
              disabled={!recoverEnabled}
              onClick={() => void w.actions.recover()}
            >
              <Icon name="history" size={15} />
              Recover plan and execution status
            </button>
          </Panel>
          <Panel title="What ANTICIPATE guarantees" id="guarantee-title">
            <ul className="ax-checklist">
              <li>
                <Icon name="eye" size={15} />
                <span>
                  Reads only the Jira records you can access. Unreadable
                  evidence stays{" "}
                  <Badge tone="warning" size="sm">
                    Unknown
                  </Badge>
                </span>
              </li>
              <li>
                <Icon name="scenarios" size={15} />
                <span>
                  Simulations are deterministic and change nothing in Jira.
                </span>
              </li>
              <li>
                <Icon name="userCheck" size={15} />
                <span>
                  Approval and execution are two separate, explicit steps.
                </span>
              </li>
              <li>
                <Icon name="passport" size={15} />
                <span>
                  Outcomes are marked verified only after the backend reads them
                  back.
                </span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
