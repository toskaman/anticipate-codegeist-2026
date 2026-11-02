import React, { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { Badge } from "../components/ui";
import { stages, stageState, stageStateText, stageFor } from "./journey";
import type { Workflow } from "./useCoreWorkflow";
import { planStatusDisplay, scenarioName } from "./copy";
import { AccessibilityMenu } from "../components/AccessibilityControls";
import { preferenceAttributes, type PreferencesApi } from "./preferences";

function remaining(expiresAt: string) {
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms)) return "unknown expiry";
  if (ms <= 0) return "expired";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "expires in under a minute";
  if (minutes < 60) return `expires in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `expires in ${hours} h ${minutes % 60} min`;
  return `expires in ${Math.floor(hours / 24)} days`;
}

/** Isolated clock: only this chip re-renders, every 30 s. */
function ExpiryChip({
  expiresAt,
  expired,
}: {
  expiresAt: string;
  expired: boolean;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (expired) return;
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, [expired]);
  return (
    <span
      className={`ax-context__item ${expired ? "ax-context__item--danger" : ""}`}
    >
      <Icon name="clock" size={13} />
      <span className="ax-context__k">Snapshot</span>
      <span>{expired ? "Expired" : remaining(expiresAt)}</span>
    </span>
  );
}

export default function AppShell({
  w,
  theme,
  prefs,
  onStartDemo,
  children,
}: {
  w: Workflow;
  theme: string;
  prefs: PreferencesApi;
  onStartDemo?: () => void;
  children: React.ReactNode;
}) {
  const current = stageFor(w.page);
  const project = w.projects.find((p) => p.id === w.projectId);
  const journey = stages.filter((s) => s.step !== null);
  const settings = stages.find((s) => s.page === "Settings")!;
  const connected = w.resource.status === "ready";
  return (
    <div
      className="ax-app"
      data-theme={theme}
      {...preferenceAttributes(prefs.prefs)}
    >
      <a
        className="ax-skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="ax-sidebar">
        <div className="ax-brand">
          <span className="ax-brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <path
                d="M16 3 4 27h6.2L16 15.2 21.8 27H28z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="21.5" r="2.6" fill="currentColor" />
            </svg>
          </span>
          <span className="ax-brand__text">
            <span className="ax-brand__name">ANTICIPATE</span>
            <span className="ax-brand__tag">Decision firewall</span>
          </span>
        </div>
        <nav className="ax-nav" aria-label="Workspace screens">
          <p className="ax-nav__label" aria-hidden="true">
            Decision journey
          </p>
          <ol className="ax-nav__list">
            {journey.map((s) => {
              const state = stageState(w, s.page);
              const isCurrent = w.page === s.page;
              const descId = `nav-state-${s.step}`;
              return (
                <li key={s.page}>
                  <button
                    className={`ax-nav__item ax-nav__item--${state}`}
                    disabled={!!w.busy}
                    aria-current={isCurrent ? "page" : undefined}
                    aria-describedby={descId}
                    onClick={() => w.actions.go(s.page)}
                  >
                    <span className="ax-nav__step" aria-hidden="true">
                      {state === "done" ? (
                        <Icon name="check" size={13} />
                      ) : state === "attention" ? (
                        <Icon name="alert" size={13} />
                      ) : (
                        s.step
                      )}
                    </span>
                    <span className="ax-nav__text">
                      <span className="ax-nav__title">{s.page}</span>
                      <span className="ax-nav__sub" aria-hidden="true">
                        {s.short}
                      </span>
                    </span>
                  </button>
                  <span id={descId} className="ax-sr">
                    {`Step ${s.step}: ${s.short}. ${stageStateText[state]}.`}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="ax-nav__divider" aria-hidden="true" />
          <button
            className="ax-nav__item ax-nav__item--settings"
            disabled={!!w.busy}
            aria-current={w.page === settings.page ? "page" : undefined}
            onClick={() => w.actions.go(settings.page)}
          >
            <span className="ax-nav__step" aria-hidden="true">
              <Icon name="settings" size={14} />
            </span>
            <span className="ax-nav__text">
              <span className="ax-nav__title">Settings</span>
              <span className="ax-nav__sub" aria-hidden="true">
                Connections &amp; transparency
              </span>
            </span>
          </button>
        </nav>
        <div className="ax-sidebar__note">
          <Icon name="lock" size={14} />
          <p>
            Nothing changes in Jira without your approval and a separate
            execution confirmation.
          </p>
        </div>
      </aside>
      <div className="ax-column">
        <header className="ax-topbar">
          <div className="ax-crumbs">
            <span className="ax-crumbs__root">ANTICIPATE</span>
            <Icon name="arrowRight" size={12} />
            <span aria-current="location">{current.page}</span>
          </div>
          <div className="ax-topbar__status">
            {onStartDemo && (
              <button
                type="button"
                className="ax-btn ax-btn--primary ax-btn--sm ax-topbar__demo"
                disabled={!!w.busy}
                onClick={onStartDemo}
              >
                <Icon name="play" size={14} />
                Start demo
              </button>
            )}
            <AccessibilityMenu api={prefs} />
            {connected ? (
              <Badge tone="success" icon="dot" size="sm">
                Connected · live mode · CORE 0.2.0
              </Badge>
            ) : w.resource.status === "loading" ? (
              <Badge tone="neutral" icon="clock" size="sm">
                Connecting…
              </Badge>
            ) : (
              <Badge tone="danger" size="sm">
                Not connected
              </Badge>
            )}
          </div>
        </header>
        {(project || w.rootIssueKey || w.snapshot || w.plan) && (
          <div className="ax-context" aria-label="Current decision">
            {project && (
              <span className="ax-context__item">
                <span className="ax-context__k">Project</span>
                <span className="ax-context__v">{project.key}</span>
              </span>
            )}
            {w.rootIssueKey && (
              <span className="ax-context__item">
                <span className="ax-context__k">Change</span>
                <span className="ax-context__v">{w.rootIssueKey}</span>
              </span>
            )}
            {w.snapshot && (
              <ExpiryChip
                expiresAt={w.snapshot.expiresAt}
                expired={w.expired}
              />
            )}
            {w.scenarioId && (
              <span className="ax-context__item">
                <span className="ax-context__k">Option</span>
                <span className="ax-context__v ax-context__v--text">
                  {scenarioName(w.scenarioId)}
                </span>
              </span>
            )}
            {w.plan && (
              <span className="ax-context__item">
                <span className="ax-context__k">Plan</span>
                <span>{planStatusDisplay(w.plan, w.records).label}</span>
              </span>
            )}
          </div>
        )}
        <main id="main" tabIndex={-1} className="ax-main">
          {children}
        </main>
        <footer className="ax-footer">
          <span>ANTICIPATE · Decision firewall for software teams</span>
          <span>
            Backend authorization is required for every Jira action. Results
            reflect the evidence the app could read.
          </span>
        </footer>
      </div>
    </div>
  );
}
