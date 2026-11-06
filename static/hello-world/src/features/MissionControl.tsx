import ReleaseSafety, {
  OVERVIEW_CAPABILITY,
  RELEASE_CAPABILITY,
} from "./ReleaseSafety";
import React, { useEffect, useState } from "react";
import SampleProjectSetup from "../SampleProjectSetup";
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

const demoSteps = [
  {
    title: "Choose a Jira project",
    text: "A company-managed software project you can edit.",
  },
  {
    title: "Preview, then create sample tickets",
    text: "Six labelled tickets; nothing is written before you confirm.",
  },
  {
    title: "Analyze the sample change",
    text: "Walk the full decision journey on real Jira evidence.",
  },
] as const;

function DemoCallout({
  w,
  projectKey,
  onStart,
}: {
  w: Workflow;
  projectKey: string;
  onStart(): void;
}) {
  const available = w.allowed("previewSampleProject");
  const current = !projectKey ? 0 : 1;
  return (
    <section className="ax-demo" aria-labelledby="demo-title">
      <div className="ax-demo__copy">
        <p className="ax-demo__eyebrow">
          <Icon name="sparkline" size={14} />
          New here? Start here
        </p>
        <h2 id="demo-title" className="ax-demo__title">
          Try the guided demo
        </h2>
        <p className="ax-demo__text">
          See ANTICIPATE end to end in a few minutes, using clearly labelled
          sample tickets in one of your Jira projects.
        </p>
        <div className="ax-demo__actions">
          <button
            type="button"
            className="ax-btn ax-btn--primary ax-btn--lg ax-demo__cta"
            disabled={!available || !!w.busy}
            aria-describedby="demo-cta-hint"
            onClick={onStart}
          >
            <Icon name="play" size={17} />
            Start the guided demo
            <Icon name="arrowRight" size={16} />
          </button>
          <p className="ax-demo__hint" id="demo-cta-hint">
            {available
              ? "Opens the demo setup below. No Jira write happens until you confirm."
              : "Sample preparation is not enabled by this backend."}
          </p>
        </div>
      </div>
      <ol className="ax-demo__steps" aria-label="Guided demo steps">
        {demoSteps.map((s, i) => (
          <li
            key={s.title}
            className={
              i === current ? "is-current" : i < current ? "is-done" : ""
            }
            aria-current={i === current ? "step" : undefined}
          >
            <span className="ax-demo__num" aria-hidden="true">
              {i < current ? <Icon name="check" size={13} /> : i + 1}
            </span>
            <span>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function MissionControl({
  w,
  demoRequest = 0,
  onStartDemo,
}: {
  w: Workflow;
  demoRequest?: number;
  onStartDemo?(): void;
}) {
  const [demoOpen, setDemoOpen] = useState(false);
  useEffect(() => {
    if (!demoRequest) return;
    setDemoOpen(true);
    // Wait for the panel to render (and the page to settle after navigation),
    // then bring it into view and focus the next useful control: the project
    // picker, or the preview button once a project is chosen.
    let frame = 0;
    let tries = 0;
    const focusNext = () => {
      const target = document.getElementById(
        w.projectId ? "sample-preview" : "project-select",
      ) as HTMLButtonElement | HTMLSelectElement | null;
      if ((!target || target.disabled) && tries++ < 60) {
        frame = requestAnimationFrame(focusNext);
        return;
      }
      const setup = document.getElementById("demo-setup");
      const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        setup?.closest(".ax-app")?.getAttribute("data-motion") === "reduce";
      setup?.scrollIntoView({
        block: "start",
        behavior: reduceMotion ? "instant" : "smooth",
      });
      target?.focus({ preventScroll: true });
    };
    frame = requestAnimationFrame(focusNext);
    return () => cancelAnimationFrame(frame);
    // Only react to new requests, not to project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoRequest]);
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
        lead="See direct and indirect dependencies before retiring, upgrading or delaying a Jira change."
      />
      <DemoCallout
        w={w}
        projectKey={project?.key ?? ""}
        onStart={onStartDemo ?? (() => setDemoOpen(true))}
      />
      <section className="ax-hero" aria-labelledby="hero-title">
        <div className="ax-hero__copy">
          <p id="hero-title" className="ax-hero__title">
            Know what depends on your next change.
          </p>
          <p className="ax-hero__text">
            A consumer two links away is easy to miss in a ticket. Trace the
            evidence, compare alternatives, and review safeguards before you
            act.
          </p>
          <p className="ax-hero__boundaries">
            <strong>Read-only:</strong> analysis and simulations.{" "}
            <strong>Explicit Jira writes:</strong> confirmed sample creation and
            execution of approved actions.
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
              <p>
                No projects available. Check your Jira project access, then
                reload this page.
              </p>
              <ul className="ax-small ax-steps-list">
                <li>
                  Choose a company-managed software project in Jira, or ask a
                  Jira administrator to give you access to one.
                </li>
                <li>
                  To prepare demo data you need permission to{" "}
                  <strong>browse</strong> the project,{" "}
                  <strong>create issues</strong> and{" "}
                  <strong>link issues</strong>. Dated sample creation also needs{" "}
                  <strong>Schedule Issues</strong> and the Due date field on the
                  create screen.
                </li>
                <li>
                  Then reload ANTICIPATE. Projects you can read appear in the
                  list below.
                </li>
              </ul>
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
          <div id="demo-setup" className="ax-demo-anchor">
            <SampleProjectSetup
              key={w.projectId}
              client={w.client}
              projectKey={project?.key ?? ""}
              canPreview={w.allowed("previewSampleProject")}
              canCreate={w.allowed("createSampleProject") && w.writesAvailable}
              disabled={!!w.operationBusy}
              onBusyChange={w.setSampleBusy}
              onAnalyze={w.actions.analyzeSample}
              open={demoOpen}
              onOpenChange={setDemoOpen}
            />
          </div>
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
      <ReleaseSafety
        client={w.client}
        supported={
          w.capabilities?.operations.includes(RELEASE_CAPABILITY) ?? false
        }
        projectKey={project?.key ?? null}
        onReview={(key) => {
          w.actions.chooseCandidate(key);
          void w.actions.analyze();
        }}
        overviewSupported={
          w.capabilities?.operations.includes(OVERVIEW_CAPABILITY) ?? false
        }
      />
    </>
  );
}
