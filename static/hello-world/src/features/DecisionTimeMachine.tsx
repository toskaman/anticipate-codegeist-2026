import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  compareCheckpoints,
  type DecisionHistory,
} from "@anticipate/contracts";
import { CoreClientError, type ForgeClient } from "../api/ForgeClient";
import { Badge, Notice, Panel } from "../components/ui";

export const HISTORY_CAPABILITY = "getDecisionHistory";
type Edge = DecisionHistory["checkpoints"][number]["added"][number];
const edgeText = (e: Edge) =>
  `${e.from.replace(/^issue:/, "")} ${e.kind.toLowerCase().replace("_", " ")} ${e.to.replace(/^issue:/, "")}`;
const fmt = (iso: string) => iso.replace("T", " ").slice(0, 16) + " UTC";
const stageLabel: Record<string, string> = {
  snapshot: "Evidence captured",
  freshness: "Re-check",
  approval: "Check at approval",
  execution: "Check at execution",
};

/**
 * Decision Time Machine: "Why was this decision acceptable before, and why is it blocked now?"
 * Shows only retained checkpoints; never fills gaps with today's Jira.
 */
export default function DecisionTimeMachine({
  client,
  planId,
}: {
  client: Pick<ForgeClient, "request">;
  planId: string;
}) {
  const [h, setH] = useState<DecisionHistory | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("cp-0");
  const [to, setTo] = useState("");
  const seq = useRef(0);
  const id = useId();

  async function load() {
    const mine = ++seq.current;
    setBusy(true);
    setError("");
    try {
      const r = await client.request("getDecisionHistory", { planId });
      if (mine !== seq.current) return;
      setH(r);
      setFrom(r.checkpoints[0]!.id);
      setTo(
        r.invalidation?.checkpointId ??
          r.checkpoints[r.checkpoints.length - 1]!.id,
      );
    } catch (e) {
      if (mine !== seq.current) return;
      setH(null);
      setError(
        e instanceof CoreClientError
          ? e.message
          : "Decision history could not be read. Nothing was changed.",
      );
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const cmp = useMemo(() => {
    if (!h) return null;
    const a = h.checkpoints.find((c) => c.id === from);
    const b = h.checkpoints.find((c) => c.id === to);
    return a && b ? compareCheckpoints(h.baseline.edges, a, b) : null;
  }, [h, from, to]);

  return (
    <Panel
      title="Decision Time Machine"
      id="time-machine-title"
      description="How the evidence behind this decision changed, from recorded checks only."
      actions={
        <Badge tone="info" icon="history" size="sm">
          Recorded history · read-only
        </Badge>
      }
    >
      {busy && (
        <p role="status" className="ax-muted">
          Reading decision history…
        </p>
      )}
      {error && (
        <Notice tone="danger" role="alert" title="History unavailable">
          {error}{" "}
          <button className="ax-btn ax-btn--ghost" onClick={() => void load()}>
            Try again
          </button>
        </Notice>
      )}
      {h && (
        <div className="ax-tm">
          <Notice
            tone={
              h.invalidation
                ? "danger"
                : h.canAuthorizeExecution
                  ? "success"
                  : "info"
            }
            title={
              h.invalidation
                ? "Why this decision is blocked now"
                : `Status: ${h.status}`
            }
          >
            {h.statusReason}
          </Notice>
          <ol className="ax-tm__line" aria-label="Recorded checkpoints">
            {h.checkpoints.map((c) => (
              <li
                key={c.id}
                className={`ax-tm__cp ${c.fresh ? "is-fresh" : "is-stale"}`}
                aria-current={
                  h.invalidation?.checkpointId === c.id ? "step" : undefined
                }
              >
                <Badge tone={c.fresh ? "success" : "danger"} size="sm">
                  {c.fresh ? "Evidence unchanged" : "Evidence changed"}
                </Badge>
                <strong>{stageLabel[c.stage] ?? c.stage}</strong>
                <time dateTime={c.at}>{fmt(c.at)}</time>
                {!c.fresh && <span className="ax-muted">{c.reason}</span>}
              </li>
            ))}
          </ol>
          <fieldset className="ax-inline-form">
            <legend>Compare two recorded checkpoints</legend>
            <label htmlFor={`${id}-a`}>Before</label>
            <select
              id={`${id}-a`}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {h.checkpoints.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                >{`${stageLabel[c.stage]} · ${fmt(c.at)}`}</option>
              ))}
            </select>
            <label htmlFor={`${id}-b`}>After</label>
            <select
              id={`${id}-b`}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {h.checkpoints.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                >{`${stageLabel[c.stage]} · ${fmt(c.at)}`}</option>
              ))}
            </select>
          </fieldset>
          {cmp && (
            <div className="ax-tm__diff" aria-live="polite">
              {cmp.added.length +
                cmp.removed.length +
                cmp.changedStatus.length +
                cmp.unknownNew.length ===
              0 ? (
                <p>No recorded difference between these checkpoints.</p>
              ) : (
                <ul>
                  {cmp.added.map((e) => (
                    <li key={`a${edgeText(e)}`}>
                      <Badge tone="danger" size="sm">
                        Added
                      </Badge>{" "}
                      {edgeText(e)}
                    </li>
                  ))}
                  {cmp.removed.map((e) => (
                    <li key={`r${edgeText(e)}`}>
                      <Badge tone="warning" size="sm">
                        Removed
                      </Badge>{" "}
                      {edgeText(e)}
                    </li>
                  ))}
                  {cmp.changedStatus.map((x) => (
                    <li key={`s${edgeText(x.edge)}`}>
                      <Badge tone="info" size="sm">
                        Evidence {x.before} → {x.after}
                      </Badge>{" "}
                      {edgeText(x.edge)}
                    </li>
                  ))}
                  {cmp.unknownNew.map((n) => (
                    <li key={`u${n}`}>
                      <Badge tone="warning" size="sm">
                        Became unknown
                      </Badge>{" "}
                      {n.replace(/^issue:/, "")}
                    </li>
                  ))}
                </ul>
              )}
              {cmp.partial && (
                <p className="ax-muted">
                  Partial: a checkpoint was truncated at its storage bound.
                </p>
              )}
            </div>
          )}
          <details>
            <summary>Recorded events ({h.events.length})</summary>
            <ul className="ax-tm__events">
              {h.events.map((e, k) => (
                <li key={k}>
                  <time dateTime={e.at}>{fmt(e.at)}</time>{" "}
                  <Badge size="sm">
                    {e.source === "RADAR"
                      ? "Radar"
                      : e.source === "APPROVAL"
                        ? "Approval"
                        : "Plan"}
                  </Badge>{" "}
                  {e.event}
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Limits of this history ({h.limits.length})</summary>
            <ul>
              {h.limits.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Panel>
  );
}
