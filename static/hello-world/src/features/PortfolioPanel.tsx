import React, { useEffect, useId, useRef, useState } from "react";
import {
  PORTFOLIO_LIMITS,
  type GraphSnapshot,
  type SimulatePortfolioResult,
} from "@anticipate/contracts";
import { CoreClientError, type ForgeClient } from "../api/ForgeClient";
import type { Workflow } from "../app/useCoreWorkflow";
import {
  portfolioActions,
  portfolioChanges,
  type PortfolioDraft,
  applyCandidate,
} from "../app/portfolio";
import { useExpired } from "../app/useExpiry";
import { evidenceCopy, formatTime, verdictCopy } from "../app/copy";
import { Badge, Notice, Panel, TechDetails } from "../components/ui";
import SafeChangeComposer, { COMPOSER_CAPABILITY } from "./SafeChangeComposer";
import CollisionExplorer from "./CollisionExplorer";

function Limited<T>({
  items,
  children,
}: {
  items: T[];
  children: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <>
      {items.length ? (
        <ul className="ax-portfolio__list">
          {items.slice(0, 20).map((item, index) => (
            <li key={index}>{children(item, index)}</li>
          ))}
        </ul>
      ) : (
        <p className="ax-muted">None reported within this snapshot.</p>
      )}
      {items.length > 20 && (
        <p className="ax-muted">
          Showing 20 of {items.length} supplied entries. This view is bounded;
          omitted entries are not assumed clear.
        </p>
      )}
    </>
  );
}

function PortfolioResultView({
  result: r,
  composerAvailable,
  graph,
}: {
  result: SimulatePortfolioResult;
  composerAvailable: boolean;
  graph: GraphSnapshot;
}) {
  const node = (id: string) =>
    graph.nodes.find((n) => n.id === id)?.label ?? id;
  const change = (id: string) =>
    r.individual.find((c) => c.changeId === id)?.label ?? id;
  // Backend reasons cite change ids (e.g. "change-1"); show the names the user typed instead.
  // Longest ids first so "change-10" is not rewritten as "change-1" + "0".
  const changeIds = r.individual
    .map((c) => c.changeId)
    .sort((a, b) => b.length - a.length);
  const readable = (text: string) =>
    changeIds.reduce(
      (t, id) =>
        t.replace(
          new RegExp(
            `(^|[^A-Za-z0-9_-])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_-])`,
            "g",
          ),
          (_m, pre: string) => `${pre}“${change(id)}”`,
        ),
      text,
    );
  const status = (id: string) => {
    const statuses = [
      r.combined.result,
      ...r.individual.map((c) => c.result),
    ].flatMap((s) =>
      s.impacts.filter((i) => i.nodeId === id).map((i) => i.weakestStatus),
    );
    return statuses.includes("UNKNOWN") || !statuses.length
      ? "UNKNOWN"
      : statuses.includes("INFERRED")
        ? "INFERRED"
        : "CONFIRMED";
  };
  return (
    <div className="ax-portfolio__result">
      <h3>Combined simulation</h3>
      <Badge tone={verdictCopy[r.combined.result.verdict].tone}>
        {verdictCopy[r.combined.result.verdict].label}
      </Badge>
      <p>
        Frozen snapshot captured {formatTime(r.snapshot.createdAt)}.{" "}
        {r.snapshot.reused
          ? "Existing snapshot reused."
          : "Snapshot reuse was not confirmed."}{" "}
        This is not a live freshness check.
      </p>
      {(r.snapshot.truncated ||
        r.snapshot.coverage?.some((c) => c.state !== "FULL")) && (
        <Notice tone="warning" title="Evidence coverage is incomplete">
          {r.snapshot.truncated ? "The snapshot is truncated. " : ""}
          {r.snapshot.coverage
            ?.filter((c) => c.state !== "FULL")
            .map((c) => `${c.source}: ${c.detail}`)
            .join(" ")}
        </Notice>
      )}
      <h3>Shared affected records</h3>
      <p className="ax-small ax-muted">
        Badges retain the weakest supplied impact evidence across these
        simulations.
      </p>
      <Limited items={r.sharedImpacts}>
        {(item) => (
          <>
            <strong>{node(item.nodeId)}</strong>{" "}
            <Badge tone={evidenceCopy[status(item.nodeId)].tone} size="sm">
              {evidenceCopy[status(item.nodeId)].label}
            </Badge>
            <p>{item.changeIds.map(change).join(" · ")}</p>
          </>
        )}
      </Limited>
      <h3>Conflicts and reasons</h3>
      <Limited items={r.conflicts}>
        {(item) => (
          <>
            <strong>{item.changeIds.map(change).join(" + ")}</strong>
            <p>{readable(item.reason)}</p>
            <p className="ax-small">
              {item.nodeIds.map(node).join(" · ")}
              {item.evidenceGapEdgeIds.length
                ? ` · Evidence gaps: ${item.evidenceGapEdgeIds.join(", ")}`
                : ""}
            </p>
          </>
        )}
      </Limited>
      <h3>Collision explanations</h3>
      <Limited items={r.conflicts}>
        {(item) => (
          <CollisionExplorer
            result={r}
            graph={graph}
            conflict={item}
            composerAvailable={composerAvailable}
          />
        )}
      </Limited>
      <h3>Ordering constraints</h3>
      <p>
        An order is a structural hypothesis, not an execution queue or proof of
        migration.
      </p>
      {r.ordering.cycles.length ? (
        <Notice tone="warning" title="No compatible order reported">
          <Limited items={r.ordering.cycles}>
            {(cycle) => cycle.map(change).join(" → ")}
          </Limited>
        </Notice>
      ) : r.ordering.order?.length ? (
        <p>Suggested order: {r.ordering.order.map(change).join(" → ")}</p>
      ) : (
        <p>No order supplied; no sequence is assumed compatible.</p>
      )}
      <Limited items={r.ordering.constraints}>
        {(item) => (
          <>
            <strong>
              {change(item.before)} → {change(item.after)}
            </strong>
            <p>{readable(item.reason)}</p>
          </>
        )}
      </Limited>
      {r.ordering.proposed && (
        <>
          <h4>Your proposed order</h4>
          <p>{r.ordering.proposed.order.map(change).join(" → ")}</p>
          <p>
            {r.ordering.proposed.violatedConstraints.length
              ? "This order violates supplied constraints:"
              : "No violated constraints reported. This is not authorization to execute."}
          </p>
          <Limited items={r.ordering.proposed.violatedConstraints}>
            {(item) => readable(item.reason)}
          </Limited>
        </>
      )}
      <h3>Evidence gaps</h3>
      <Limited items={r.evidenceGaps.filter((entry) => entry.gaps.length)}>
        {(item) => (
          <>
            <strong>{change(item.changeId)}</strong>
            <Limited items={item.gaps}>
              {(gap) => (
                <>
                  {gap.kind === "UNKNOWN_NOT_MIGRATED"
                    ? "Unknown relationship was not migrated"
                    : "Unknown relationship on an impact path"}
                  : {node(gap.from)} → {node(gap.to)} · relationship{" "}
                  {gap.edgeId}
                </>
              )}
            </Limited>
          </>
        )}
      </Limited>
      <h3>Per-change verdict explanations</h3>
      <Limited items={r.verdictExplanations}>
        {(item) => (
          <>
            <strong>{change(item.changeId)}</strong>
            <p>
              On its own: {verdictCopy[item.standaloneVerdict].label}. Together:{" "}
              {verdictCopy[item.portfolioVerdict].label}.
            </p>
            <p>{item.explanation}</p>
            <Limited items={item.causes}>
              {(cause) => (
                <>
                  {change(cause.changeId)}: {cause.gainedNodeIds.length}{" "}
                  additional, {cause.maskedNodeIds.length} masked impact records
                  {cause.verdictEffect
                    ? "; affects the verdict"
                    : "; no verdict change attributed"}
                  .
                </>
              )}
            </Limited>
          </>
        )}
      </Limited>
      <Notice tone="neutral" title="Simulation assumptions">
        A migration or declared-compatible upgrade changes no Jira evidence.
        Missing impacts and a passing verdict are not proof that a real change
        is risk-free. {r.disclaimer}
      </Notice>
      <TechDetails label="Snapshot and reproducibility">
        <p>
          Snapshot: <code>{r.snapshotId}</code>
        </p>
        <p>
          Result hash (identity, not a cryptographic certificate):{" "}
          <code>{r.resultHash}</code>
        </p>
        <p>
          Depth {r.maxDepth}. {r.snapshot.nodeCount} records and{" "}
          {r.snapshot.edgeCount} relationships in the supplied snapshot.
        </p>
      </TechDetails>
    </div>
  );
}

function PortfolioEditor({
  client,
  graph,
  rootIssueKey,
  workflowBusy,
  composer = false,
}: {
  client: ForgeClient;
  graph: GraphSnapshot;
  rootIssueKey: string;
  workflowBusy: boolean;
  composer?: boolean;
}) {
  const [rows, setRows] = useState<PortfolioDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SimulatePortfolioResult | null>(null);
  const sequence = useRef(0);
  const addButton = useRef<HTMLButtonElement>(null);
  const active = useRef<AbortController | null>(null);
  const prefix = useId();
  const expired = useExpired(graph.expiresAt);
  useEffect(() => () => active.current?.abort(), []);
  const changes = portfolioChanges(rows, graph);
  const update = (next: PortfolioDraft[]) => {
    setRows(next);
    setResult(null);
    setError("");
  };
  const patch = (id: string, values: Partial<PortfolioDraft>) =>
    update(rows.map((row) => (row.id === id ? { ...row, ...values } : row)));
  const move = (index: number, step: number) => {
    const next = [...rows];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    update(next);
  };
  async function run() {
    if (!changes || busy || expired || workflowBusy) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const next = await client.request(
        "simulatePortfolio",
        {
          projectId: graph.projectId,
          rootIssueKey,
          source: graph.mode === "DEMO_FIXTURE" ? "DEMO_FIXTURE" : "JIRA",
          snapshotId: graph.snapshotId,
          changes,
          proposedOrder: changes.map((c) => c.id),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (
        next.snapshot.snapshotId !== graph.snapshotId ||
        next.snapshot.projectId !== graph.projectId ||
        next.snapshot.rootIssueKey !== rootIssueKey ||
        next.changeIds.length !== changes.length ||
        new Set(next.changeIds).size !== changes.length ||
        changes.some((change) => !next.changeIds.includes(change.id)) ||
        next.combined.result.snapshotId !== graph.snapshotId ||
        next.individual.some((c) => c.result.snapshotId !== graph.snapshotId)
      )
        throw new CoreClientError(
          "INVALID_RESPONSE",
          "Portfolio evidence does not match the analysed snapshot.",
        );
      setResult(next);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(
        e instanceof CoreClientError
          ? e.message
          : "The portfolio simulation failed. No Jira changes were requested.",
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <Panel
      title="Several changes at once"
      id={`${prefix}-title`}
      className="ax-portfolio"
      description="Optional: explore how several changes interact on the recorded evidence, without changing Jira."
      actions={
        <Badge tone="info" size="sm">
          Simulation
        </Badge>
      }
    >
      <p>
        Add up to {PORTFOLIO_LIMITS.maxChanges} named changes using the records
        already analysed. Use Move earlier or Move later to try a different
        order. This does not choose, approve or execute your single-change plan.
      </p>
      {expired && (
        <Notice tone="warning" title="Snapshot expired">
          Read fresh evidence before running another portfolio simulation. Any
          result below is historical.
        </Notice>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <fieldset disabled={busy || workflowBusy}>
          <legend>Proposed portfolio changes</legend>
          {!rows.length && (
            <p className="ax-muted">
              No changes added. Select Add change, then choose its action and
              record to begin.
            </p>
          )}
          {rows.map((row, index) => (
            <fieldset key={row.id} className="ax-portfolio__change">
              <legend>Change {index + 1}</legend>
              <div className="ax-portfolio__fields">
                <label>
                  Name
                  <input
                    id={`${prefix}-${row.id}-name`}
                    value={row.label}
                    maxLength={200}
                    onChange={(e) => patch(row.id, { label: e.target.value })}
                  />
                </label>
                <label>
                  Action
                  <select
                    value={row.action}
                    onChange={(e) =>
                      patch(row.id, {
                        action: e.target.value as PortfolioDraft["action"],
                      })
                    }
                  >
                    {Object.entries(portfolioActions).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Record
                  <select
                    value={row.nodeId}
                    onChange={(e) => patch(row.id, { nodeId: e.target.value })}
                  >
                    <option value="">Choose a loaded record</option>
                    {graph.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} · {evidenceCopy[n.status].label}
                      </option>
                    ))}
                  </select>
                </label>
                {row.action === "migrate" && (
                  <label>
                    Replacement record
                    <select
                      value={row.toNodeId}
                      onChange={(e) =>
                        patch(row.id, { toNodeId: e.target.value })
                      }
                    >
                      <option value="">Choose a different loaded record</option>
                      {graph.nodes
                        .filter((n) => n.id !== row.nodeId)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.label}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
              {row.action === "migrate" && (
                <p className="ax-small ax-muted">
                  Assumes USES and DEPENDS_ON consumers moved. Unknown
                  relationships are not migrated. No real migration happens
                  here.
                </p>
              )}
              {row.action === "compatible" && (
                <p className="ax-small ax-muted">
                  Compatibility is your simulation assumption, not a verified
                  migration or test result.
                </p>
              )}
              <div className="ax-portfolio__controls">
                <button
                  type="button"
                  className="ax-btn ax-btn--ghost"
                  disabled={index === 0}
                  aria-label={`Move change ${index + 1} earlier`}
                  onClick={() => move(index, -1)}
                >
                  Move earlier
                </button>
                <button
                  type="button"
                  className="ax-btn ax-btn--ghost"
                  disabled={index === rows.length - 1}
                  aria-label={`Move change ${index + 1} later`}
                  onClick={() => move(index, 1)}
                >
                  Move later
                </button>
                <button
                  type="button"
                  className="ax-btn ax-btn--ghost"
                  aria-label={`Remove change ${index + 1}`}
                  onClick={() => {
                    update(rows.filter((r) => r.id !== row.id));
                    requestAnimationFrame(() => addButton.current?.focus());
                  }}
                >
                  Remove change
                </button>
              </div>
            </fieldset>
          ))}
          <div className="ax-portfolio__controls">
            <button
              ref={addButton}
              type="button"
              className="ax-btn"
              disabled={
                rows.length >= PORTFOLIO_LIMITS.maxChanges ||
                !graph.nodes.length
              }
              onClick={() => {
                const id = ++sequence.current;
                update([
                  ...rows,
                  {
                    id: `change-${id}`,
                    label: `Change ${id}`,
                    nodeId: "",
                    action: "remove",
                    toNodeId: "",
                  },
                ]);
                requestAnimationFrame(() =>
                  document
                    .getElementById(`${prefix}-change-${id}-name`)
                    ?.focus(),
                );
              }}
            >
              Add change
            </button>
            <button
              type="submit"
              className="ax-btn ax-btn--primary"
              disabled={!changes || expired || busy || workflowBusy}
            >
              {busy ? "Simulating portfolio…" : "Simulate combined changes"}
            </button>
          </div>
          <p className="ax-small ax-muted">
            {rows.length} of {PORTFOLIO_LIMITS.maxChanges} changes.{" "}
            {rows.length && !changes
              ? "Name each change, select its record and, for migration, a different replacement."
              : "No result is assumed until the backend responds."}
          </p>
        </fieldset>
      </form>
      <p role="status" aria-live="polite" className="ax-small">
        {busy
          ? "Simulating combined changes. Nothing is being changed in Jira."
          : result
            ? "Portfolio simulation complete."
            : ""}
      </p>
      {error && (
        <div role="alert">
          <p className="ax-error-text">{error}</p>
          <p>
            No portfolio result is shown, and nothing was changed in Jira.
            Review the changes and try again; for an expired snapshot, return to
            Mission Control and select Analyze dependencies first.
          </p>
        </div>
      )}
      <section aria-busy={busy} aria-label="Portfolio simulation output">
        {result && (
          <PortfolioResultView
            result={result}
            graph={graph}
            composerAvailable={composer}
          />
        )}
      </section>
      {result && composer && changes && (
        <SafeChangeComposer
          client={client}
          request={{
            projectId: graph.projectId,
            rootIssueKey,
            source: graph.mode === "DEMO_FIXTURE" ? "DEMO_FIXTURE" : "JIRA",
            snapshotId: graph.snapshotId,
            changes,
          }}
          onSelect={(c) => update(applyCandidate(rows, c.transformations))}
        />
      )}
    </Panel>
  );
}

export default function PortfolioPanel({
  w,
}: {
  w: Pick<
    Workflow,
    "capabilities" | "snapshot" | "rootIssueKey" | "client" | "busy"
  >;
}) {
  if (
    w.capabilities?.portfolioSimulation !== "AVAILABLE" ||
    !w.capabilities.operations.includes("simulatePortfolio") ||
    !w.snapshot ||
    !w.rootIssueKey
  )
    return null;
  return (
    <PortfolioEditor
      key={`${w.snapshot.snapshotId}:${w.rootIssueKey}`}
      client={w.client}
      graph={w.snapshot}
      rootIssueKey={w.rootIssueKey}
      workflowBusy={!!w.busy}
      composer={w.capabilities.operations.includes(COMPOSER_CAPABILITY)}
    />
  );
}
