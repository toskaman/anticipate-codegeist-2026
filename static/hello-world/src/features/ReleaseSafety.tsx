import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  ReleaseOverview,
  ReleaseSafety as ReleaseSafetyResult,
} from "@anticipate/contracts";
import { CoreClientError } from "../api/ForgeClient";
import { Badge, Metric, Notice, Panel, SourceLink } from "../components/ui";
import type { Tone } from "../app/copy";
import type { ForgeClient } from "../api/ForgeClient";

export const RELEASE_CAPABILITY = "getReleaseSafety";
export const OVERVIEW_CAPABILITY = "listReleaseSafety";
type Verdict = ReleaseSafetyResult["verdict"];

/** Worst first; the same order as the backend (src/engine/release.ts). */
export const VERDICTS: { v: Verdict; label: string; tone: Tone }[] = [
  { v: "BLOCKED", label: "Blocked", tone: "danger" },
  { v: "EVIDENCE_INCOMPLETE", label: "Evidence incomplete", tone: "warning" },
  { v: "NEEDS_REVIEW", label: "Needs review", tone: "warning" },
  { v: "EXECUTION_PARTIAL", label: "Execution partial", tone: "warning" },
  { v: "APPROVED_NOT_EXECUTED", label: "Approved, not executed", tone: "info" },
  {
    v: "VERIFIED_FOR_RECORDED_SCOPE",
    label: "Verified (recorded scope)",
    tone: "success",
  },
];
export const verdictMeta = (v: Verdict) => VERDICTS.find((x) => x.v === v)!;

export interface ReleaseSafetyProps {
  client: Pick<ForgeClient, "request">;
  supported: boolean;
  projectKey: string | null;
  overviewSupported?: boolean;
  /** Starts the normal analysis of a change (Evidence Graph → Scenario Lab → portfolio + Composer). */
  onReview?(issueKey: string): void;
}

/**
 * Release Safety Control Plane: "Can this release proceed, what is blocked, what still needs verification?"
 * Read-only. Every status is text + icon + colour, and every change links to its Jira issue.
 */
export default function ReleaseSafety({
  client,
  supported,
  projectKey,
  overviewSupported = false,
  onReview,
}: ReleaseSafetyProps) {
  const [fixVersion, setFixVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReleaseSafetyResult | null>(null);
  const [filter, setFilter] = useState<Verdict | "ALL">("ALL");
  const [overview, setOverview] = useState<ReleaseOverview | null>(null);
  const [ovBusy, setOvBusy] = useState(false);
  const seq = useRef(0);
  const id = useId();
  useEffect(() => {
    seq.current++;
    setResult(null);
    setOverview(null);
    setError("");
  }, [projectKey]);
  const visible = useMemo(
    () =>
      result
        ? result.items.filter((i) => filter === "ALL" || i.state === filter)
        : [],
    [result, filter],
  );
  if (!supported) return null;
  const versionError = /["\\\n\r]/.test(fixVersion)
    ? "Release names with quotes or backslashes are not supported."
    : "";

  async function run(version?: string | null) {
    if (!projectKey || busy || (version === undefined && versionError)) return;
    const mine = ++seq.current;
    setBusy(true);
    setError("");
    try {
      const r = await client.request("getReleaseSafety", {
        projectKey,
        fixVersion: version !== undefined ? version : fixVersion.trim() || null,
      });
      if (mine === seq.current) {
        setResult(r);
        setFilter("ALL");
      }
    } catch (e) {
      if (mine !== seq.current) return;
      setResult(null);
      setError(
        e instanceof CoreClientError
          ? e.message
          : "The release check failed. Nothing was changed in Jira.",
      );
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  async function loadOverview() {
    if (!projectKey || ovBusy) return;
    const mine = ++seq.current;
    setOvBusy(true);
    setError("");
    try {
      const r = await client.request("listReleaseSafety", { projectKey });
      if (mine !== seq.current) return;
      if (r.projectKey !== projectKey)
        throw new CoreClientError(
          "INVALID_RESPONSE",
          "Release overview belongs to another project.",
        );
      setOverview(r);
    } catch (e) {
      if (mine !== seq.current) return;
      setOverview(null);
      setError(
        e instanceof CoreClientError
          ? e.message
          : "The release overview failed. Nothing was changed in Jira.",
      );
    } finally {
      if (mine === seq.current) setOvBusy(false);
    }
  }

  function openRelease(name: string | null) {
    setFixVersion(name ?? "");
    void run(name);
  }

  const meta = result ? verdictMeta(result.verdict) : null;
  return (
    <Panel
      title="Release Safety"
      id="release-safety-title"
      description="Can this release proceed? Joins every change issue (label anticipate-change) with your recorded decisions, and flags changes that interact."
      actions={
        <Badge tone="info" icon="eye" size="sm">
          Read-only · nothing changed in Jira
        </Badge>
      }
    >
      {!projectKey ? (
        <p className="ax-muted">
          Choose a Jira project above to check its release.
        </p>
      ) : (
        <form
          className="ax-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
          aria-describedby={`${id}-hint`}
        >
          <label htmlFor={`${id}-ver`}>
            Release (fixVersion) in {projectKey}
          </label>
          <input
            id={`${id}-ver`}
            value={fixVersion}
            placeholder="All changes in the project"
            maxLength={255}
            spellCheck={false}
            aria-invalid={!!versionError}
            onChange={(e) => setFixVersion(e.target.value)}
          />
          <button
            className="ax-btn ax-btn--primary"
            type="submit"
            disabled={busy || !!versionError}
          >
            {busy ? "Checking release…" : "Check release"}
          </button>
          <p id={`${id}-hint`} className="ax-muted">
            {versionError ||
              "Leave empty to evaluate every change in the project (up to 100)."}
          </p>
        </form>
      )}
      {projectKey && overviewSupported && (
        <div className="ax-release-ov">
          <button
            type="button"
            className="ax-btn"
            onClick={() => void loadOverview()}
            disabled={ovBusy}
          >
            {ovBusy
              ? "Reading releases…"
              : "Show all releases needing attention"}
          </button>
          {overview && (
            <>
              <table className="ax-table">
                <caption className="ax-sr">
                  Releases of {overview.projectKey}, worst first
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Release</th>
                    <th scope="col">State</th>
                    <th scope="col">Changes</th>
                    <th scope="col">Interactions</th>
                    <th scope="col">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.releases.map((r) => {
                    const m = verdictMeta(r.verdict);
                    return (
                      <tr key={r.fixVersion ?? "(unscheduled)"}>
                        <th scope="row">
                          <button
                            type="button"
                            className="ax-link-btn"
                            onClick={() => openRelease(r.fixVersion)}
                          >
                            {r.fixVersion ?? "No release (unscheduled)"}
                          </button>
                          {r.releaseDate && (
                            <div className="ax-muted">{r.releaseDate}</div>
                          )}
                        </th>
                        <td>
                          <Badge tone={m.tone} size="sm">
                            {m.label}
                          </Badge>
                        </td>
                        <td>{r.changes}</td>
                        <td>{r.interactions}</td>
                        <td>{r.topReasons[0] ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {overview.releases.length === 0 && (
                <p className="ax-muted">
                  No change issues in {overview.projectKey}.
                </p>
              )}
              <ul className="ax-muted">
                {overview.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {error && (
        <Notice tone="danger" role="alert" title="Release check failed">
          {error}{" "}
          <button className="ax-btn ax-btn--ghost" onClick={() => void run()}>
            Try again
          </button>
        </Notice>
      )}
      {busy && (
        <p role="status" className="ax-muted">
          Reading changes and decisions…
        </p>
      )}
      {result && meta && (
        <div className="ax-release" aria-live="polite">
          <div
            className={`ax-release__verdict ax-release__verdict--${meta.tone}`}
            role="status"
          >
            <Badge tone={meta.tone} size="md">
              {meta.label}
            </Badge>
            <span className="ax-release__scope">
              {result.scope.projectKey}
              {result.scope.fixVersion
                ? ` · ${result.scope.fixVersion}`
                : " · all changes"}{" "}
              · {result.coverage.issuesRead} change(s) read
            </span>
            <ul className="ax-release__reasons">
              {result.verdictReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div
            className="ax-metrics"
            role="group"
            aria-label="Changes per state (select to filter)"
          >
            {VERDICTS.map(({ v, label, tone }) => (
              <button
                key={v}
                type="button"
                className={`ax-release__count${filter === v ? " is-active" : ""}`}
                aria-pressed={filter === v}
                onClick={() => setFilter(filter === v ? "ALL" : v)}
              >
                <Metric
                  value={result.counts[v] ?? 0}
                  label={label}
                  tone={tone}
                />
              </button>
            ))}
          </div>
          {result.interactions.length > 0 && (
            <Notice
              tone="warning"
              title={`${result.interactions.length} interaction(s) between changes`}
            >
              <ul>
                {result.interactions.map((x) => (
                  <li key={`${x.changes.join("|")}|${x.via ?? ""}`}>
                    {x.note}{" "}
                    {onReview && (
                      <button
                        type="button"
                        className="ax-link-btn"
                        onClick={() => onReview(x.changes[0])}
                      >
                        Analyze {x.changes[0]}, then add {x.changes[1]} in
                        Scenario Lab
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {result.coverage.interactionsTruncated && (
                <p>More interactions exist than shown.</p>
              )}
            </Notice>
          )}
          {visible.length === 0 ? (
            <p className="ax-muted">
              {result.items.length === 0
                ? "No change issues in this scope."
                : "No change in this state."}
            </p>
          ) : (
            <div className="ax-table-wrap">
              <table className="ax-table">
                <caption className="ax-sr">
                  Changes in the release and their decision state
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Change</th>
                    <th scope="col">State</th>
                    <th scope="col">Why</th>
                    <th scope="col">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((i) => {
                    const m = verdictMeta(i.state);
                    return (
                      <tr key={i.issue.key}>
                        <th scope="row">
                          <SourceLink url={i.issue.url}>
                            {i.issue.key}
                          </SourceLink>
                          <div className="ax-muted">{i.issue.summary}</div>
                        </th>
                        <td>
                          <Badge tone={m.tone} size="sm">
                            {m.label}
                          </Badge>
                        </td>
                        <td>
                          <ul className="ax-release__why">
                            {i.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          {i.decision ? (
                            <code>{i.decision.planId}</code>
                          ) : (
                            <span className="ax-muted">none of yours</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <details className="ax-release__unknowns">
            <summary>
              What this check cannot know ({result.coverage.unknowns.length})
            </summary>
            <ul>
              {result.coverage.unknowns.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
            <p className="ax-muted">
              Evaluated {result.scope.evaluatedAt} · JQL{" "}
              <code>{result.scope.jql}</code>
            </p>
          </details>
        </div>
      )}
    </Panel>
  );
}
