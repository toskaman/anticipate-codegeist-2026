import React, { useId, useState } from "react";
import type { SlipSimulation } from "@anticipate/contracts";
import { CoreClientError } from "../api/ForgeClient";
import { Badge, Notice, Panel } from "../components/ui";
import Icon from "../components/Icon";
import type { Workflow } from "../app/useCoreWorkflow";
import {
  SLIP_CAPABILITY,
  parseSlipDays,
  pathText,
  slipView,
} from "../app/slip";

/**
 * "What if it slips?" — CORE's deterministic slip simulation on live Jira due
 * dates and fix versions. Read-only: nothing is changed in Jira.
 */
export default function SlipPanel({ w }: { w: Workflow }) {
  const [raw, setRaw] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SlipSimulation | null>(null);
  const id = useId();
  const supported =
    w.capabilities?.operations.includes(SLIP_CAPABILITY) ?? false;
  const issueKey = w.rootIssueKey;
  if (!supported || !issueKey) return null;
  const days = parseSlipDays(raw);
  const view = result ? slipView(result) : null;

  async function run() {
    if (days === null || busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(await w.client.request("simulateSlip", { issueKey, days }));
    } catch (e) {
      setResult(null);
      setError(
        e instanceof CoreClientError
          ? e.message
          : "The slip simulation failed. Nothing was changed in Jira.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="What if it slips?"
      id="slip-title"
      description={`Optional: explore which recorded due dates and releases could move if ${issueKey} is delayed, without changing Jira.`}
      actions={
        <Badge tone="info" icon="scenarios" size="sm">
          Simulation · nothing changed in Jira
        </Badge>
      }
    >
      <form
        className="ax-slip__form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label htmlFor={`${id}-days`}>Delay in days</label>
        <input
          id={`${id}-days`}
          className="ax-slip__days"
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-invalid={days === null}
          aria-describedby={`${id}-hint`}
        />
        <button
          type="submit"
          className="ax-btn ax-btn--primary"
          disabled={days === null || busy}
        >
          {busy ? "Simulating…" : "Simulate slip"}
        </button>
        <p
          id={`${id}-hint`}
          className={days === null ? "ax-error-text" : "ax-muted ax-small"}
        >
          {days === null
            ? "Enter a whole number of days from 1 to 365."
            : "From 1 to 365 days. Uses Jira due dates and release dates; no dates are updated."}
        </p>
      </form>
      {!view && !busy && !error && (
        <p className="ax-muted ax-small">
          Choose a delay, then select Simulate slip to see which dates could
          move.
        </p>
      )}
      <p className="ax-muted ax-small ax-slip__status" role="status">
        {busy
          ? `Simulating a ${days ?? ""}-day slip of ${issueKey}…`
          : view
            ? "Simulation complete."
            : ""}
      </p>
      {error && (
        <div className="ax-slip__error" role="alert">
          <p className="ax-error-text">{error}</p>
          <p className="ax-small">
            No result is shown, and nothing was changed in Jira. Review the
            delay and select Try again; if Jira access is denied, ask your
            project administrator for access.
          </p>
          <button
            type="button"
            className="ax-btn"
            disabled={days === null || busy}
            onClick={() => void run()}
          >
            Try again
          </button>
        </div>
      )}
      {view && (
        <section
          className="ax-slip__result"
          aria-labelledby={`${id}-result`}
          aria-busy={busy}
        >
          <h3 id={`${id}-result`} className="ax-h4">
            Simulation result (nothing changed in Jira)
          </h3>
          <p className="ax-slip__headline">
            <strong>{view.headline}</strong>
          </p>
          {view.nothingMoves && (
            <Notice tone="neutral" icon="info" title="Nothing to move">
              No due date or release would change for this delay. This usually
              means {issueKey} and the issues that depend on it have no due
              dates or fix versions in Jira. Add them in Jira to simulate a
              slip.
            </Notice>
          )}
          {view.lateReleases.length > 0 && (
            <section aria-labelledby={`${id}-late`}>
              <h3 id={`${id}-late`} className="ax-h4">
                Releases that would be late
              </h3>
              <ul className="ax-slip__list">
                {view.lateReleases.map((r) => (
                  <li key={r.name}>
                    <Badge tone="danger" size="sm">
                      Late by {r.lateByDays}{" "}
                      {r.lateByDays === 1 ? "day" : "days"}
                    </Badge>{" "}
                    <strong>{r.name}</strong> · release date {r.releaseDate}
                    <span className="ax-slip__path">
                      Because of {r.issues.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {view.moved.length > 0 && (
            <section aria-labelledby={`${id}-moved`}>
              <h3 id={`${id}-moved`} className="ax-h4">
                Due dates that would move
              </h3>
              <ul className="ax-slip__list">
                {view.moved.map((m) => (
                  <li key={m.key}>
                    <strong>{m.key}</strong>: {m.oldDue} → {m.newDue} (+
                    {m.slipDays} {m.slipDays === 1 ? "day" : "days"})
                    <span className="ax-slip__path">
                      Path: {pathText(m.path)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(view.unknown.length > 0 || view.unreadable.length > 0) && (
            <Notice
              tone="warning"
              icon="help"
              title="Cannot be assessed (not assumed safe)"
            >
              <ul className="ax-slip__list">
                {view.unknown.map((u) => (
                  <li key={u.key}>
                    <strong>{u.key}</strong>: {u.reason}
                    <span className="ax-slip__path">
                      Path: {pathText(u.path)}
                    </span>
                  </li>
                ))}
                {view.unreadable.map((k) => (
                  <li key={k}>
                    <strong>{k}</strong>: you cannot read this issue
                  </li>
                ))}
              </ul>
            </Notice>
          )}
          {view.absorbed.length > 0 && (
            <p className="ax-muted ax-small">
              <Icon name="check" size={13} /> Still on time thanks to slack:{" "}
              {view.absorbed.map((a) => `${a.key} (due ${a.due})`).join(", ")}.
            </p>
          )}
          {view.onTimeReleases.length > 0 && (
            <p className="ax-muted ax-small">
              Releases still on time:{" "}
              {view.onTimeReleases.map((r) => r.name).join(", ")}.
            </p>
          )}
          {view.truncated && (
            <Notice tone="warning" icon="alert" title="Partial result">
              The dependency chain was longer than the analysis limit; later
              items are not shown.
            </Notice>
          )}
          <details className="ax-slip__assumptions" open>
            <summary>Assumptions of this simulation</summary>
            <ul>
              {view.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </Panel>
  );
}
