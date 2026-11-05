import React, { useEffect, useRef, useState } from "react";
import type {
  ComposeSafeChangesResult,
  PortfolioChange,
} from "@anticipate/contracts";
import { CoreClientError, type ForgeClient } from "../api/ForgeClient";
import { Badge, Notice } from "../components/ui";
import type { Tone } from "../app/copy";

export const COMPOSER_CAPABILITY = "composeSafeChanges";
type Candidate = ComposeSafeChangesResult["candidates"][number];
const verdictTone: Record<Candidate["verdict"], Tone> = {
  BLOCKED: "danger",
  NEEDS_REVIEW: "warning",
  PASS: "success",
};
const short = (id: string) => id.replace(/^issue:/, "");
const opText = (o: Candidate["transformations"][number]["after"]) =>
  o.op === "UPGRADE_NODE"
    ? `${o.breaking ? "breaking" : "non-breaking"} upgrade of ${short(o.nodeId)}`
    : o.op === "DEPRECATE_NODE"
      ? `deprecate (keep) ${short(o.nodeId)}`
      : o.op === "REMOVE_NODE"
        ? `remove ${short(o.nodeId)}`
        : `migrate ${short(o.fromNodeId)} → ${short(o.toNodeId)}`;

/**
 * Safe Change Composer: bounded, deterministic alternatives to the current portfolio, each re-simulated by the same
 * engine. Proposals only: nothing here approves or executes anything.
 */
export default function SafeChangeComposer({
  client,
  request,
  onSelect,
}: {
  client: Pick<ForgeClient, "request">;
  request: {
    projectId: string;
    rootIssueKey: string;
    source: "JIRA" | "DEMO_FIXTURE";
    snapshotId: string;
    changes: PortfolioChange[];
  };
  onSelect?(c: Candidate): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ComposeSafeChangesResult | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const seq = useRef(0);
  const sig = JSON.stringify(request);
  useEffect(() => {
    seq.current++;
    setResult(null);
    setError("");
    setPicked(null);
  }, [sig]);

  async function run() {
    const mine = ++seq.current;
    setBusy(true);
    setError("");
    try {
      const r = await client.request("composeSafeChanges", request);
      if (mine !== seq.current) return;
      if (r.snapshotId !== request.snapshotId)
        throw new CoreClientError(
          "INVALID_RESPONSE",
          "Alternatives do not match the analysed snapshot.",
        );
      setResult(r);
    } catch (e) {
      if (mine !== seq.current) return;
      setResult(null);
      setError(
        e instanceof CoreClientError
          ? e.message
          : "Alternatives could not be computed. Nothing was changed in Jira.",
      );
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  return (
    <section className="ax-composer" aria-labelledby="composer-title">
      <div className="ax-composer__head">
        <h3 id="composer-title">Safe Change Composer</h3>
        <Badge tone="info" icon="scenarios" size="sm">
          Proposals only · nothing executed
        </Badge>
      </div>
      <p className="ax-muted">
        Explore defensible alternatives to this portfolio. Each one is
        re-simulated on the same evidence, with its assumptions stated.
      </p>
      <button
        className="ax-btn"
        type="button"
        onClick={() => void run()}
        disabled={busy}
      >
        {busy ? "Composing alternatives…" : "Compose safer alternatives"}
      </button>
      {error && (
        <Notice tone="danger" role="alert" title="No alternatives shown">
          {error}
        </Notice>
      )}
      {result && (
        <>
          <ol
            className="ax-composer__list"
            aria-label="Candidate strategies, best first"
          >
            {result.candidates.map((c) => (
              <li
                key={c.candidateId}
                className={`ax-composer__cand${picked === c.candidateId ? " is-picked" : ""}`}
              >
                <div className="ax-composer__title">
                  <span
                    className="ax-composer__rank"
                    aria-label={`Rank ${c.rank}`}
                  >
                    #{c.rank}
                  </span>
                  <strong>{c.name}</strong>
                  <Badge tone={verdictTone[c.verdict]} size="sm">
                    {c.verdict.replace("_", " ").toLowerCase()}
                  </Badge>
                  {c.candidateId === result.baselineCandidateId && (
                    <Badge size="sm">current plan</Badge>
                  )}
                  {c.dominatedBy && (
                    <Badge size="sm" tone="neutral">
                      outperformed
                    </Badge>
                  )}
                </div>
                <p>{c.why}</p>
                <dl className="ax-composer__metrics">
                  <div>
                    <dt>Blockers</dt>
                    <dd>{c.blockers}</dd>
                  </div>
                  <div>
                    <dt>Conflicts</dt>
                    <dd>{c.conflicts}</dd>
                  </div>
                  <div>
                    <dt>Impacted</dt>
                    <dd>{c.impacted}</dd>
                  </div>
                  <div>
                    <dt>Unknowns</dt>
                    <dd>{c.unknowns}</dd>
                  </div>
                </dl>
                {c.transformations.length > 0 && (
                  <p>
                    <span className="ax-muted">Changes vs plan:</span>{" "}
                    {c.transformations
                      .map(
                        (t) =>
                          `${t.changeId}: ${opText(t.before)} → ${opText(t.after)}`,
                      )
                      .join("; ")}
                  </p>
                )}
                {c.phases.length > 1 && (
                  <p>
                    <span className="ax-muted">Phases:</span>{" "}
                    {c.phases
                      .map((p, i) => `${i + 1}. ${p.join(", ")}`)
                      .join("  ")}
                  </p>
                )}
                {c.resolvedConflicts.length > 0 && (
                  <p>
                    <span className="ax-muted">Resolves:</span>{" "}
                    {c.resolvedConflicts.map((k) => k.split(":")[0]).join(", ")}
                  </p>
                )}
                {c.assumptions.length > 0 && (
                  <ul className="ax-composer__assume" aria-label="Assumptions">
                    {c.assumptions.map((a) => (
                      <li key={a}>Assumes: {a}</li>
                    ))}
                  </ul>
                )}
                {c.requiredReviews.length > 0 && (
                  <details>
                    <summary>
                      Required reviews ({c.requiredReviews.length})
                    </summary>
                    <ul>
                      {c.requiredReviews.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <button
                  type="button"
                  className="ax-btn ax-btn--ghost"
                  aria-pressed={picked === c.candidateId}
                  onClick={() => {
                    setPicked(c.candidateId);
                    onSelect?.(c);
                  }}
                >
                  {picked === c.candidateId
                    ? "Selected for review"
                    : "Select for review"}
                </button>
              </li>
            ))}
          </ol>
          {picked && (
            <Notice tone="info" role="status" title="Selected for review">
              This candidate is not approved or executed. Turn it into a plan
              through the normal Scenario Lab, approval and verified execution
              steps.
            </Notice>
          )}
          <details>
            <summary>
              What the Composer cannot know ({result.limits.length})
            </summary>
            <ul>
              {result.limits.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
