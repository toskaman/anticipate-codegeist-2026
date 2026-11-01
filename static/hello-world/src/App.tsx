import React, { lazy, Suspense, useState } from "react";
import {
  Shield,
  LayoutDashboard,
  Network,
  FlaskConical,
  ShieldCheck,
  ListChecks,
  FileCheck,
  Settings,
  ArrowUpRight,
  Sun,
  Moon,
  RotateCcw,
} from "lucide-react";
import {
  actionDetails,
  initialWorkflow,
  passport,
  type ScenarioId,
} from "./domain";
import "./style.css";
import ConfirmDialog from "./ConfirmDialog";
import { usePage } from "./usePage";
import { localAdapter, loadExperience } from "./adapters";
import { useResource } from "./useResource";
const Graph = lazy(() => import("./Graph"));
const Showcase = lazy(() => import("./Showcase"));
const pages = [
  "Mission Control",
  "Evidence Graph",
  "Scenario Lab",
  "Decision Firewall",
  "Prevention Plan",
  "Prevention Passport",
  "Settings",
  ...(import.meta.env.DEV ? ["Component Showcase"] : []),
];
const icons = [
  LayoutDashboard,
  Network,
  FlaskConical,
  ShieldCheck,
  ListChecks,
  FileCheck,
  Settings,
  Settings,
];
export default function App() {
  const [page, setPage] = usePage(pages);
  const [theme, setTheme] = useState(
    localStorage.getItem("anticipate-theme") || "dark",
  );
  const [scenario, setScenario] = useState<ScenarioId>("C");
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [compare, setCompare] = useState(true);
  const [confirm, setConfirm] = useState<"reset" | "approve" | null>(null);
  const [mode, setMode] = useState("demo");
  const [notice, setNotice] = useState("");
  const resource = useResource(loadExperience);
  if (resource.status !== "ready")
    return (
      <div className="app" data-theme={theme}>
        <main
          className="panel"
          role={resource.status === "error" ? "alert" : "status"}
        >
          <h1>
            {resource.status === "loading"
              ? "Loading local demo snapshot…"
              : "Project snapshot unavailable"}
          </h1>
          <p>DEMO DATA · No Jira changes will be made.</p>
          {resource.status === "error" && (
            <>
              <p>{resource.error}</p>
              <button onClick={resource.retry}>Retry snapshot</button>
            </>
          )}
        </main>
      </div>
    );
  const { services, scenarios, actions } = resource.data;
  const result = scenarios[scenario];
  function go(next: string) {
    setPage(next);
    location.hash = encodeURIComponent(next);
    document.getElementById("main")?.focus();
  }
  function exportReport() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(passport(scenario, workflow), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ANTICIPATE-DEMO-passport.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app" data-theme={theme}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside>
        <div className="brand">
          <Shield size={28} />
          <span>
            ANTICIPATE<small>THE DECISION FIREWALL</small>
          </span>
        </div>
        <label className="project">
          Workspace
          <select aria-label="Project">
            <option>Platform Engineering</option>
          </select>
        </label>
        <p className="eyebrow">WORKSPACE</p>
        <nav>
          {pages.map((name, i) => {
            const Icon = icons[i];
            return (
              <button
                key={name}
                aria-current={page === name ? "page" : undefined}
                onClick={() => go(name)}
              >
                <Icon size={18} />
                {name}
                {name === "Decision Firewall" && (
                  <span className="count">{result.violations}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="side-note">
          <span className="badge">DEMO DATA</span>
          <p>A safe place to test consequences.</p>
          <small>Fictional fixtures. No connected services.</small>
        </div>
        <button
          onClick={() => {
            const next = theme === "dark" ? "light" : "dark";
            setTheme(next);
            localStorage.setItem("anticipate-theme", next);
          }}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} Switch
          theme
        </button>
        <button onClick={() => setConfirm("reset")}>
          <RotateCcw size={16} />
          Reset demo
        </button>
      </aside>
      <div className="workspace">
        <header>
          <span>
            Platform Engineering <span className="muted">/ {page}</span>
          </span>
          <span className="badge">LOCAL DEMO · NO JIRA WRITES</span>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="title-row">
            <div>
              <p className="eyebrow">ANTICIPATE / {page.toUpperCase()}</p>
              <h1>{page}</h1>
              <p className="muted">
                Test the consequences. Prove the safeguards. Then ship.
              </p>
            </div>
            <button
              className="primary"
              onClick={() =>
                go(page === "Scenario Lab" ? "Prevention Plan" : "Scenario Lab")
              }
            >
              {page === "Scenario Lab"
                ? "Review prevention plan"
                : "Open Scenario Lab"}
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="disclosure">
            <ShieldCheck size={18} />
            <span>
              <strong>DEMO DATA</strong> — fictional local simulation. No Jira
              changes will be made.
            </span>
          </div>
          {notice && (
            <p role="status" className="disclosure">
              {notice}
              <button onClick={() => setNotice("")}>Dismiss</button>
            </p>
          )}
          {mode === "forge" ? (
            <section className="panel">
              <h2>Integration unavailable</h2>
              <p>
                Backend setup and agreed contracts are required. Demo results
                are not substituted for live data.
              </p>
              <button onClick={() => setMode("demo")}>Return to demo</button>
            </section>
          ) : (
            <>
              {page === "Mission Control" && (
                <>
                  <section className="hero">
                    <div>
                      <span className="badge">CHANGE UNDER REVIEW</span>
                      <h2>
                        A small API change.
                        <br />A system-wide consequence.
                      </h2>
                      <p>AUTH-142 — Remove legacy authentication API v1</p>
                      <button
                        className="primary"
                        onClick={() => go("Evidence Graph")}
                      >
                        Explore dependencies <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <div className="hero-stat">
                      <strong>05</strong>
                      <span>connected services</span>
                      <small>1 unresolved evidence gap</small>
                    </div>
                  </section>
                  <div className="stats">
                    {[
                      [
                        "Dependency coverage",
                        "3 / 5 confirmed",
                        "Evidence Graph",
                      ],
                      [
                        "Immediate removal",
                        "3 policy violations",
                        "Decision Firewall",
                      ],
                      [
                        "Pending decision",
                        "Owner review required",
                        "Prevention Plan",
                      ],
                    ].map(([title, value, target]) => (
                      <button
                        className="panel stat"
                        key={title}
                        onClick={() => go(target)}
                      >
                        <small>{title}</small>
                        <strong>{value}</strong>
                        <span>Review details ↗</span>
                      </button>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Proposed changes</h2>
                      <span className="muted">
                        Fixture snapshot · 02 Nov 2026
                      </span>
                    </div>
                    <button
                      className="change-row"
                      onClick={() => go("Scenario Lab")}
                    >
                      <span className="ticket">AUTH-142</span>
                      <span>
                        Remove legacy authentication API v1
                        <small>Platform Engineering · 5 dependencies</small>
                      </span>
                      <span className="badge warning">Needs review</span>
                      <ArrowUpRight size={18} />
                    </button>
                  </section>
                  <div className="two-col">
                    <section className="panel">
                      <h2>Recent scenario comparisons</h2>
                      {Object.entries(scenarios).map(([id, s]) => (
                        <button
                          className="list-row"
                          key={id}
                          onClick={() => {
                            if (!workflow.approved)
                              setScenario(id as ScenarioId);
                            else
                              setNotice(
                                "Reset the demo before changing an approved scenario.",
                              );
                            go("Scenario Lab");
                          }}
                        >
                          <span>
                            {id} · {s.name}
                          </span>
                          <span className="badge">{s.risk}</span>
                        </button>
                      ))}
                    </section>
                    <section className="panel">
                      <h2>Prevention readiness</h2>
                      <p>
                        {workflow.executed
                          ? "Local simulated execution complete"
                          : workflow.approved
                            ? "Local demo approval recorded"
                            : "Awaiting local review"}
                      </p>
                      <p className="muted">
                        Jira, Confluence, Forge and AI: pending backend
                        integration.
                      </p>
                      <button onClick={() => go("Settings")}>
                        View integration status ↗
                      </button>
                    </section>
                  </div>
                </>
              )}
              {page === "Component Showcase" && (
                <Suspense fallback={<p role="status">Loading components…</p>}>
                  <Showcase />
                </Suspense>
              )}
              {page === "Evidence Graph" && (
                <Suspense fallback={<p role="status">Loading graph…</p>}>
                  <Graph />
                </Suspense>
              )}
              {page === "Scenario Lab" && (
                <>
                  <section className="panel">
                    <span className="ticket">AUTH-142</span>
                    <h2>Remove legacy authentication API v1</h2>
                    <p className="muted">
                      Deterministic comparison of three authored fixtures. No AI
                      simulation is running.
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={compare}
                        onChange={(e) => setCompare(e.target.checked)}
                      />{" "}
                      Compare all scenarios
                    </label>
                    <div className="scenario-grid">
                      {(compare ? ["A", "B", "C"] : [scenario]).map((id) => {
                        const s = scenarios[id as ScenarioId];
                        return (
                          <button
                            className={
                              "scenario " + (scenario === id ? "selected" : "")
                            }
                            aria-pressed={scenario === id}
                            key={id}
                            onClick={() => {
                              if (workflow.approved) {
                                setNotice(
                                  "Reset the demo before changing an approved scenario.",
                                );
                                return;
                              }
                              setScenario(id as ScenarioId);
                            }}
                          >
                            <span className="eyebrow">SCENARIO {id}</span>
                            <h3>{s.name}</h3>
                            <span
                              className={
                                "badge " + (id === "A" ? "danger" : "warning")
                              }
                            >
                              {s.risk}
                            </span>
                            <strong>{s.violations} policy violations</strong>
                            <p>{s.summary}</p>
                          </button>
                        );
                      })}
                    </div>
                    <label>
                      Selected scenario{" "}
                      <select
                        value={scenario}
                        disabled={workflow.approved}
                        onChange={(e) =>
                          setScenario(e.target.value as ScenarioId)
                        }
                      >
                        {Object.entries(scenarios).map(([id, s]) => (
                          <option key={id} value={id}>
                            {id} · {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() =>
                        setNotice(
                          "Custom scenario parameters are unavailable in demo mode. Choose an authored fixture.",
                        )
                      }
                    >
                      Explore custom parameters
                    </button>
                  </section>
                  <div className="two-col">
                    <section className="panel">
                      <h2>Remaining blockers</h2>
                      {result.blockers.map((b) => (
                        <p key={b} className="warning-text">
                          △ {b}
                        </p>
                      ))}
                      <p>
                        All five connected services require review. Support
                        evidence remains UNKNOWN.
                      </p>
                      <button onClick={() => go("Evidence Graph")}>
                        Inspect supporting evidence ↗
                      </button>
                    </section>
                    <section className="panel">
                      <h2>Recommended safeguards</h2>
                      {result.mitigations.map((m) => (
                        <p key={m}>→ {m}</p>
                      ))}
                      <button onClick={() => go("Decision Firewall")}>
                        Review policy conditions ↗
                      </button>
                    </section>
                  </div>
                </>
              )}
              {page === "Decision Firewall" && (
                <section className="panel">
                  <h2>Policy review · Scenario {scenario}</h2>
                  <p>
                    Frontend demonstration only. Real enforcement requires
                    server-side authorization.
                  </p>
                  {[
                    [
                      "Mobile client compatibility",
                      scenario === "A" ? "FAILED" : "PASSED",
                      "E-02 · retain support for installed clients",
                    ],
                    [
                      "Checkout compatibility",
                      scenario === "A" ? "FAILED" : "PASSED",
                      "E-01, E-02 · keep v1 until clients migrate",
                    ],
                    [
                      "Rollback strategy",
                      scenario === "C" ? "PASSED" : "FAILED",
                      "E-04 · staged gateway rollback required",
                    ],
                    [
                      "Consumer ownership",
                      "UNKNOWN",
                      "E-03 · support owner must confirm usage",
                    ],
                    [
                      "Required approval",
                      workflow.approved ? "LOCAL DEMO APPROVED" : "REQUIRED",
                      "Service owner review; no real approval implied",
                    ],
                  ].map(([title, status, why]) => (
                    <article className="policy" key={title}>
                      <h3>{title}</h3>
                      <span className="badge">{status}</span>
                      <p>{why}</p>
                      <button onClick={() => go("Evidence Graph")}>
                        Review evidence
                      </button>
                    </article>
                  ))}
                  <p>
                    Scenario fixture reports {result.violations} violations.
                    Unknown conditions remain blockers even with zero
                    violations.
                  </p>
                </section>
              )}
              {page === "Prevention Plan" && (
                <section className="panel">
                  <h2>Safeguards before rollout</h2>
                  <p>
                    Scenario {scenario} · {result.name}. Demo approval does not
                    resolve real evidence gaps.
                  </p>
                  {actionDetails.map((a, i) => (
                    <article className="action" key={a.title}>
                      <span className="step">0{i + 1}</span>
                      <div>
                        <h3>{a.title}</h3>
                        <p>{a.description}</p>
                        <p>Reason: {a.reason}</p>
                        <small>
                          Target: {a.target} · Priority: {a.priority} ·
                          Approval: owner required
                        </small>
                        <p className="muted">
                          Evidence:{" "}
                          {a.evidenceIds
                            .map(
                              (id) =>
                                services.find((service) => service.id === id)
                                  ?.source,
                            )
                            .join("; ")}{" "}
                          · Expected: {a.outcome} · Verification:{" "}
                          {workflow.executed ? "simulated only" : "pending"}
                        </p>
                      </div>
                    </article>
                  ))}
                  <p className="warning-text">
                    Demo simulation — no Jira changes will be made.
                  </p>
                  <button
                    className="primary"
                    disabled={workflow.approved || scenario !== "C"}
                    onClick={() => setConfirm("approve")}
                  >
                    Approve local demo plan
                  </button>
                  <button
                    disabled={!workflow.approved || workflow.executed}
                    onClick={() => {
                      localAdapter
                        .executeApprovedPlan({ scenario, actions, workflow })
                        .then((plan) => {
                          setWorkflow(plan.workflow);
                          setNotice(
                            "Simulated execution complete. No external actions were performed.",
                          );
                        })
                        .catch((error) => setNotice(error.message));
                    }}
                  >
                    Simulate execution
                  </button>
                  <button onClick={() => go("Prevention Passport")}>
                    Open Prevention Passport ↗
                  </button>
                  {scenario !== "C" && (
                    <p>
                      Select guarded scenario C before approving this fixture
                      plan.
                    </p>
                  )}
                </section>
              )}
              {page === "Prevention Passport" && (
                <section className="panel passport">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        PREVENTION PASSPORT / DEMO
                      </span>
                      <h2>AUTH-142</h2>
                    </div>
                    <ShieldCheck size={48} />
                  </div>
                  <p>Remove legacy authentication API v1</p>
                  <p>
                    Snapshot: demo-auth-v1-2026-11-02 · Created:{" "}
                    {new Date().toLocaleDateString()}
                  </p>
                  <h3>Decision record</h3>
                  <p>
                    Selected scenario {scenario}: {result.name}. Compared A, B
                    and C.
                  </p>
                  <p>
                    {result.violations} fixture policy violations.{" "}
                    {workflow.executed
                      ? "Simulated execution complete."
                      : "Execution not performed."}
                  </p>
                  <h3>Dependencies & evidence</h3>
                  {services.map((s) => (
                    <p key={s.id}>
                      {s.label} · {s.evidence} · {s.source}
                    </p>
                  ))}
                  <h3>Mitigations</h3>
                  {result.mitigations.map((m) => (
                    <p key={m}>→ {m}</p>
                  ))}
                  <h3>Remaining uncertainty</h3>
                  {result.blockers.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                  <h3>Approval timeline</h3>
                  {workflow.timeline.length ? (
                    workflow.timeline.map((t) => (
                      <p key={t.event}>
                        {t.event} · {t.at}
                      </p>
                    ))
                  ) : (
                    <p>No local approval recorded.</p>
                  )}
                  <p>
                    <strong>
                      Fictional demo report. No certification, signature, or
                      real-world verification.
                    </strong>
                  </p>
                  <button className="primary" onClick={exportReport}>
                    Export demo JSON
                  </button>
                  <button onClick={() => window.print()}>
                    Print report / PDF
                  </button>
                </section>
              )}
              {page === "Settings" && (
                <>
                  <section className="panel">
                    <h2>Welcome to ANTICIPATE</h2>
                    <p>
                      Explore evidence, compare consequences, review safeguards,
                      then record a local decision.
                    </p>
                    <button
                      className="primary"
                      onClick={() => go("Evidence Graph")}
                    >
                      1. Explore evidence
                    </button>
                    <button onClick={() => go("Scenario Lab")}>
                      2. Compare scenarios
                    </button>
                    <button onClick={() => go("Prevention Plan")}>
                      3. Review plan
                    </button>
                  </section>
                  <section className="panel">
                    <h2>Environment & accessibility</h2>
                    <label>
                      Data mode{" "}
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                      >
                        <option value="demo">Local demo</option>
                        <option value="forge">Forge — unavailable</option>
                      </select>
                    </label>
                    <p>Jira · Confluence · Forge · AI: PENDING_BACKEND</p>
                    <p>
                      Use Tab to move, Enter to select. Graph has a textual
                      dependency alternative. Reduced motion follows your
                      operating system preference.
                    </p>
                    <p>
                      If data fails, return to demo or reset the local session.
                      No credentials are required.
                    </p>
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer>
          ANTICIPATE EXPERIENCE{" "}
          <span>Evidence before execution. · DEMO DATA</span>
        </footer>
      </div>
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "approve"
              ? "Approve this local simulation?"
              : "Reset the demo session?"
          }
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === "approve")
              localAdapter
                .approvePreventionPlan({ scenario, actions, workflow })
                .then((plan) => setWorkflow(plan.workflow))
                .catch((error) => setNotice(error.message));
            else {
              setWorkflow(initialWorkflow());
              setScenario("C");
              setMode("demo");
            }
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
